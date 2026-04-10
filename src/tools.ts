import { parseMarkdown } from "./markdown.js";
import { saveHtmlCache } from "./cache.js";
import { openFileInBrowser } from "./browser.js";
import { THEME_NAMES, THEMES } from "./themes.js";
import { readFile } from "node:fs/promises";
import { getAccessToken, draftAdd, draftUpdate, draftDelete, draftBatchGet, uploadImage, type WechatArticle } from "./wechat-api.js";

export type TextContent = { type: "text"; text: string };

export type ToolResult = {
  content: TextContent[];
  isError?: boolean;
  meta?: Record<string, unknown>;
};

export function listThemesPayload(): {
  themes: Array<{ name: string; description: string }>;
} {
  return {
    themes: [
      { name: "default", description: "Balanced enterprise style" },
      { name: "tech", description: "Clean technical publication style" },
      { name: "warm", description: "Warmer brand/media style" },
      { name: "apple", description: "Apple-like minimalist editorial style" },
      { name: "wechat-native", description: "WeChat native-like green visual style" }
    ]
  };
}

function invalidThemeResult(theme: unknown): ToolResult {
  return {
    content: [{ type: "text", text: `Invalid theme: ${String(theme)}. Available: ${[...THEME_NAMES].sort().join(", ")}` }],
    isError: true
  };
}

function validateMarkdown(markdown: unknown): markdown is string {
  return typeof markdown === "string" && markdown.trim().length > 0;
}

function validateMarkdownPath(path: unknown): path is string {
  return typeof path === "string" && path.trim().length > 0;
}

function validateCachePath(path: unknown): path is string {
  return typeof path === "string" && path.trim().length > 0;
}

export async function handleToolCall(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  if (name === "list_wechat_themes") {
    return {
      content: [{ type: "text", text: JSON.stringify(listThemesPayload(), null, 2) }]
    };
  }

  if (name === "convert_markdown_to_wechat_html") {
    const directMarkdown = args.markdown;
    const markdownPath = args.markdown_path;

    let markdown: string | undefined;
    if (directMarkdown !== undefined) {
      if (!validateMarkdown(directMarkdown)) {
        return {
          content: [{ type: "text", text: "markdown must be a non-empty string when provided." }],
          isError: true
        };
      }
      markdown = directMarkdown;
    } else if (validateMarkdownPath(markdownPath)) {
      try {
        markdown = await readFile(markdownPath, "utf8");
      } catch (error) {
        return {
          content: [{ type: "text", text: `Failed to read markdown_path: ${(error as Error).message}` }],
          isError: true
        };
      }
      if (!validateMarkdown(markdown)) {
        return {
          content: [{ type: "text", text: "markdown_path points to an empty markdown file." }],
          isError: true
        };
      }
    }

    if (!validateMarkdown(markdown)) {
      return {
        content: [{ type: "text", text: "Provide one markdown source: markdown or markdown_path." }],
        isError: true
      };
    }

    const theme = args.theme ?? "default";
    if (typeof theme !== "string" || !(theme in THEMES)) {
      return invalidThemeResult(theme);
    }

    const title = typeof args.title === "string" ? args.title : undefined;

    // Upload local images if access_token is provided
    const accessToken = typeof args.access_token === "string" ? args.access_token.trim() : undefined;
    if (accessToken) {
      const baseDir = typeof markdownPath === "string" ? markdownPath.replace(/[^/\\]+$/, "") : "";
      const localImagePattern = /!\[([^\]]*)\]\((?!https?:\/\/)([^)]+)\)/g;
      const uploadErrors: string[] = [];
      const uploadCache = new Map<string, string>();

      const matches = [...markdown.matchAll(localImagePattern)];
      for (const match of matches) {
        const rawPath = match[2];
        if (!rawPath || uploadCache.has(rawPath)) continue;
        const absPath = rawPath.startsWith("/") ? rawPath : `${baseDir}${rawPath}`;
        try {
          const result = await uploadImage(accessToken, absPath);
          uploadCache.set(rawPath, result.url);
        } catch (error) {
          uploadErrors.push(`${rawPath}: ${(error as Error).message}`);
        }
      }

      for (const [localPath, cdnUrl] of uploadCache) {
        markdown = markdown.replaceAll(`](${localPath})`, `](${cdnUrl})`);
      }

      if (uploadErrors.length > 0) {
        return {
          content: [{ type: "text", text: `Image upload failed:\n${uploadErrors.join("\n")}` }],
          isError: true
        };
      }
    }

    const html = parseMarkdown(markdown, theme, title);
    const savedPath = saveHtmlCache(html);

    return {
      content: [{ type: "text", text: html }],
      meta: { cacheHtmlPath: savedPath }
    };
  }

  if (name === "open_wechat_html_in_browser") {
    const cacheHtmlPath = args.cacheHtmlPath;
    if (!validateCachePath(cacheHtmlPath)) {
      return {
        content: [{ type: "text", text: "cacheHtmlPath is required and must be a non-empty string." }],
        isError: true
      };
    }
    const openedPath = cacheHtmlPath;

    try {
      await openFileInBrowser(openedPath);
    } catch (error) {
      return {
        content: [{ type: "text", text: `Browser open failed: ${(error as Error).message}` }],
        isError: true,
        meta: { cacheHtmlPath: openedPath }
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ ok: true, opened: true, cacheHtmlPath: openedPath })
        }
      ],
      meta: { cacheHtmlPath: openedPath }
    };
  }

  if (name === "wechat_get_access_token") {
    const appid = process.env.WECHAT_APPID;
    const secret = process.env.WECHAT_APPSECRET;
    if (!appid) {
      return { content: [{ type: "text", text: "Environment variable WECHAT_APPID is not set." }], isError: true };
    }
    if (!secret) {
      return { content: [{ type: "text", text: "Environment variable WECHAT_APPSECRET is not set." }], isError: true };
    }
    try {
      const result = await getAccessToken(appid, secret);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: (error as Error).message }], isError: true };
    }
  }

  if (name === "wechat_draft_add") {
    const accessToken = args.access_token;
    const articles = args.articles;
    if (typeof accessToken !== "string" || !accessToken.trim()) {
      return { content: [{ type: "text", text: "access_token is required." }], isError: true };
    }
    if (!Array.isArray(articles) || articles.length === 0) {
      return { content: [{ type: "text", text: "articles must be a non-empty array." }], isError: true };
    }
    try {
      const result = await draftAdd(accessToken, articles as WechatArticle[]);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: (error as Error).message }], isError: true };
    }
  }

  if (name === "wechat_draft_update") {
    const accessToken = args.access_token;
    const mediaId = args.media_id;
    const index = args.index ?? 0;
    const article = args.article;
    if (typeof accessToken !== "string" || !accessToken.trim()) {
      return { content: [{ type: "text", text: "access_token is required." }], isError: true };
    }
    if (typeof mediaId !== "string" || !mediaId.trim()) {
      return { content: [{ type: "text", text: "media_id is required." }], isError: true };
    }
    if (typeof index !== "number") {
      return { content: [{ type: "text", text: "index must be a number." }], isError: true };
    }
    if (typeof article !== "object" || article === null) {
      return { content: [{ type: "text", text: "article is required." }], isError: true };
    }
    try {
      const result = await draftUpdate(accessToken, mediaId, index, article as WechatArticle);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: (error as Error).message }], isError: true };
    }
  }

  if (name === "wechat_upload_image") {
    const accessToken = args.access_token;
    const filePath = args.file_path;
    if (typeof accessToken !== "string" || !accessToken.trim()) {
      return { content: [{ type: "text", text: "access_token is required." }], isError: true };
    }
    if (typeof filePath !== "string" || !filePath.trim()) {
      return { content: [{ type: "text", text: "file_path is required." }], isError: true };
    }
    const ext = filePath.toLowerCase().split(".").pop();
    if (ext !== "jpg" && ext !== "jpeg" && ext !== "png") {
      return { content: [{ type: "text", text: "Only JPG and PNG files are supported." }], isError: true };
    }
    try {
      const result = await uploadImage(accessToken, filePath);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: (error as Error).message }], isError: true };
    }
  }

  if (name === "wechat_draft_batchget") {
    const accessToken = args.access_token;
    const offset = args.offset ?? 0;
    const count = args.count ?? 10;
    const noContent = args.no_content ?? 0;
    if (typeof accessToken !== "string" || !accessToken.trim()) {
      return { content: [{ type: "text", text: "access_token is required." }], isError: true };
    }
    if (typeof offset !== "number" || typeof count !== "number") {
      return { content: [{ type: "text", text: "offset and count must be numbers." }], isError: true };
    }
    if (count < 1 || count > 20) {
      return { content: [{ type: "text", text: "count must be between 1 and 20." }], isError: true };
    }
    try {
      const result = await draftBatchGet(accessToken, offset, count, noContent as 0 | 1);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: (error as Error).message }], isError: true };
    }
  }

  if (name === "wechat_draft_delete") {
    const accessToken = args.access_token;
    const mediaId = args.media_id;
    if (typeof accessToken !== "string" || !accessToken.trim()) {
      return { content: [{ type: "text", text: "access_token is required." }], isError: true };
    }
    if (typeof mediaId !== "string" || !mediaId.trim()) {
      return { content: [{ type: "text", text: "media_id is required." }], isError: true };
    }
    try {
      const result = await draftDelete(accessToken, mediaId);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: (error as Error).message }], isError: true };
    }
  }

  return {
    content: [{ type: "text", text: `Unknown tool: ${name}` }],
    isError: true
  };
}
