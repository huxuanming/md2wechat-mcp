import { parseMarkdown } from "./markdown.js";
import { saveHtmlCache } from "./cache.js";
import { openFileInBrowser } from "./browser.js";
import { THEME_NAMES, THEMES, type FontSizePreset } from "./themes.js";
import { readFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";
import {
  getAccessToken,
  draftAdd,
  draftUpdate,
  draftDelete,
  draftBatchGet,
  uploadImage,
  addMaterial,
  type WechatArticle,
  type PermanentMaterialType
} from "./wechat-api.js";

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

const FONT_SIZE_PRESETS: FontSizePreset[] = ["small", "medium", "large"];

function invalidFontSizePresetResult(preset: unknown): ToolResult {
  return {
    content: [{ type: "text", text: `Invalid font_size_preset: ${String(preset)}. Available: ${FONT_SIZE_PRESETS.join(", ")}` }],
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

function getFileExtension(inputPath: string): string {
  const cleaned = inputPath.split(/[?#]/)[0] ?? inputPath;
  return extname(cleaned).toLowerCase().replace(".", "");
}

function isRemoteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

type MarkdownImageToken = {
  start: number;
  end: number;
  alt: string;
  src: string;
  title?: string;
  titleQuote?: "'" | "\"";
};

function isWhitespace(char: string): boolean {
  return /\s/.test(char);
}

type TextRange = { start: number; end: number };

function mergeRanges(ranges: TextRange[]): TextRange[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: TextRange[] = [sorted[0] as TextRange];
  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i] as TextRange;
    const last = merged[merged.length - 1] as TextRange;
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}

function computeExcludedRanges(markdown: string): TextRange[] {
  const ranges: TextRange[] = [];
  const lines = markdown.split("\n");
  let offset = 0;
  let inFence = false;
  let fenceChar = "";
  let fenceLen = 0;
  let fenceStart = -1;

  for (const line of lines) {
    const trimmedLeft = line.replace(/^\s{0,3}/, "");
    const fenceMatch = trimmedLeft.match(/^(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1] as string;
      const markerChar = marker[0] as string;
      const markerLen = marker.length;
      if (!inFence) {
        inFence = true;
        fenceChar = markerChar;
        fenceLen = markerLen;
        fenceStart = offset;
      } else if (markerChar === fenceChar && markerLen >= fenceLen) {
        ranges.push({ start: fenceStart, end: offset + line.length + 1 });
        inFence = false;
        fenceChar = "";
        fenceLen = 0;
        fenceStart = -1;
      }
    }
    offset += line.length + 1;
  }
  if (inFence && fenceStart >= 0) {
    ranges.push({ start: fenceStart, end: markdown.length });
  }

  // inline code spans outside fenced code
  const fenceRanges = mergeRanges(ranges);
  let i = 0;
  let fenceIdx = 0;
  while (i < markdown.length) {
    const activeFence = fenceRanges[fenceIdx];
    if (activeFence && i >= activeFence.start) {
      i = Math.max(i, activeFence.end);
      fenceIdx += 1;
      continue;
    }
    if (markdown[i] !== "`") {
      i += 1;
      continue;
    }

    let runLen = 1;
    while (i + runLen < markdown.length && markdown[i + runLen] === "`") runLen += 1;
    const start = i;
    i += runLen;
    let close = -1;
    while (i < markdown.length) {
      if (markdown[i] !== "`") {
        i += 1;
        continue;
      }
      let closeRun = 1;
      while (i + closeRun < markdown.length && markdown[i + closeRun] === "`") closeRun += 1;
      if (closeRun === runLen) {
        close = i + runLen;
        break;
      }
      i += closeRun;
    }
    if (close > 0) {
      ranges.push({ start, end: close });
      i = close;
    } else {
      i = start + runLen;
    }
  }

  return mergeRanges(ranges);
}

function findRangeAt(ranges: TextRange[], index: number): TextRange | undefined {
  let left = 0;
  let right = ranges.length - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const range = ranges[mid] as TextRange;
    if (index < range.start) right = mid - 1;
    else if (index >= range.end) left = mid + 1;
    else return range;
  }
  return undefined;
}

function readEscapedChar(input: string, cursor: number, escapable: Set<string>): { value: string; next: number } | undefined {
  if (input[cursor] !== "\\" || cursor + 1 >= input.length) return undefined;
  const nextChar = input[cursor + 1] as string;
  if (!escapable.has(nextChar)) return undefined;
  return { value: nextChar, next: cursor + 2 };
}

function escapeForQuotedTitle(value: string, quote: "'" | "\""): string {
  const escapedSlash = value.replaceAll("\\", "\\\\");
  return escapedSlash.replaceAll(quote, `\\${quote}`);
}

function parseMarkdownImageTokens(markdown: string): MarkdownImageToken[] {
  const tokens: MarkdownImageToken[] = [];
  const excludedRanges = computeExcludedRanges(markdown);

  let i = 0;
  while (i < markdown.length) {
    const blocked = findRangeAt(excludedRanges, i);
    if (blocked) {
      i = blocked.end;
      continue;
    }
    if (markdown[i] !== "!" || markdown[i + 1] !== "[") {
      i += 1;
      continue;
    }
    const start = i;
    let cursor = i + 2;

    let alt = "";
    let altClosed = false;
    while (cursor < markdown.length) {
      const c = markdown[cursor];
      const escaped = readEscapedChar(markdown, cursor, new Set(["\\", "]", "[", "(", ")", "\"", "'"]));
      if (escaped) {
        alt += escaped.value;
        cursor = escaped.next;
        continue;
      }
      if (c === "]") {
        altClosed = true;
        cursor += 1;
        break;
      }
      alt += c;
      cursor += 1;
    }
    if (!altClosed || markdown[cursor] !== "(") {
      i += 1;
      continue;
    }
    cursor += 1;

    while (cursor < markdown.length && isWhitespace(markdown[cursor])) cursor += 1;

    let src = "";
    if (markdown[cursor] === "<") {
      cursor += 1;
      while (cursor < markdown.length) {
        const c = markdown[cursor];
        const escaped = readEscapedChar(markdown, cursor, new Set(["\\", ">", "<", "(", ")", "\"", "'", " "]));
        if (escaped) {
          src += escaped.value;
          cursor = escaped.next;
          continue;
        }
        if (c === ">") {
          cursor += 1;
          break;
        }
        src += c;
        cursor += 1;
      }
    } else {
      let depth = 0;
      while (cursor < markdown.length) {
        const c = markdown[cursor];
        const escaped = readEscapedChar(markdown, cursor, new Set(["\\", "(", ")", " "]));
        if (escaped) {
          src += escaped.value;
          cursor = escaped.next;
          continue;
        }
        if (c === "(") {
          depth += 1;
          src += c;
          cursor += 1;
          continue;
        }
        if (c === ")") {
          if (depth === 0) break;
          depth -= 1;
          src += c;
          cursor += 1;
          continue;
        }
        if (isWhitespace(c) && depth === 0) break;
        src += c;
        cursor += 1;
      }
    }

    while (cursor < markdown.length && isWhitespace(markdown[cursor])) cursor += 1;

    let title: string | undefined;
    let titleQuote: "'" | "\"" | undefined;
    if (markdown[cursor] === "\"" || markdown[cursor] === "'") {
      titleQuote = markdown[cursor] as "'" | "\"";
      cursor += 1;
      let titleText = "";
      while (cursor < markdown.length) {
        const c = markdown[cursor];
        const escaped = readEscapedChar(markdown, cursor, new Set(["\\", "\"", "'"]));
        if (escaped) {
          titleText += escaped.value;
          cursor = escaped.next;
          continue;
        }
        if (c === titleQuote) {
          cursor += 1;
          break;
        }
        titleText += c;
        cursor += 1;
      }
      title = titleText;
      while (cursor < markdown.length && isWhitespace(markdown[cursor])) cursor += 1;
    }

    if (markdown[cursor] !== ")" || !src) {
      i += 1;
      continue;
    }

    tokens.push({ start, end: cursor + 1, alt, src, title, titleQuote });
    i = cursor + 1;
  }
  return tokens;
}

function replaceMarkdownImageSources(markdown: string, srcMap: Map<string, string>): string {
  const tokens = parseMarkdownImageTokens(markdown);
  if (tokens.length === 0) return markdown;

  let out = "";
  let last = 0;

  for (const token of tokens) {
    out += markdown.slice(last, token.start);
    const mapped = srcMap.get(token.src);
    if (!mapped) {
      out += markdown.slice(token.start, token.end);
      last = token.end;
      continue;
    }
    const quote = token.titleQuote ?? "\"";
    const titlePart = token.title ? ` ${quote}${escapeForQuotedTitle(token.title, quote)}${quote}` : "";
    out += `![${token.alt}](${mapped}${titlePart})`;
    last = token.end;
  }

  out += markdown.slice(last);
  return out;
}

async function uploadLocalImageSourcesInHtml(
  html: string,
  accessToken: string,
  baseDir: string
): Promise<{ html: string; uploadedCount: number }> {
  const uploadErrors: string[] = [];
  const uploadCache = new Map<string, string>();
  let uploadedCount = 0;

  const imgTags = [...html.matchAll(/<img\b[^>]*\bsrc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+)[^>]*>/giu)];
  if (imgTags.length === 0) {
    return { html, uploadedCount };
  }

  const replacements = new Map<string, string>();
  for (const match of imgTags) {
    const imgTag = match[0];
    if (replacements.has(imgTag)) {
      continue;
    }
    const srcMatch = imgTag.match(/src\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/iu);
    if (!srcMatch) {
      continue;
    }
    const rawSrc = srcMatch?.[1] ?? srcMatch?.[2] ?? srcMatch?.[3];
    if (!rawSrc) {
      continue;
    }
    const normalizedSrc = rawSrc.trim();
    if (!normalizedSrc || isRemoteUrl(normalizedSrc) || /^data:/iu.test(normalizedSrc)) {
      continue;
    }

    const cached = uploadCache.get(normalizedSrc);
    if (cached) {
      replacements.set(imgTag, imgTag.replace(srcMatch[0], `src="${cached}"`));
      continue;
    }

    const absPath = normalizedSrc.startsWith("/") ? normalizedSrc : resolve(baseDir, normalizedSrc);
    try {
      const uploaded = await uploadImage(accessToken, absPath);
      uploadCache.set(normalizedSrc, uploaded.url);
      uploadedCount += 1;
      replacements.set(imgTag, imgTag.replace(srcMatch[0], `src="${uploaded.url}"`));
    } catch (error) {
      uploadErrors.push(`${normalizedSrc}: ${(error as Error).message}`);
    }
  }

  if (uploadErrors.length > 0) {
    throw new Error(`Image upload failed:\n${uploadErrors.join("\n")}`);
  }

  let rewrittenHtml = html;
  for (const [before, after] of replacements) {
    rewrittenHtml = rewrittenHtml.split(before).join(after);
  }

  return { html: rewrittenHtml, uploadedCount };
}

function removeLeadingHtmlH1(html: string): string {
  return html.replace(/^\s*<h1\b[^>]*>[\s\S]*?<\/h1>\s*/iu, "");
}

function removeMarkdownSlice(markdown: string, start: number, end: number): string {
  const removed = `${markdown.slice(0, start)}${markdown.slice(end)}`;
  return removed.replace(/\n{3,}/g, "\n\n");
}

function removeLeadingAtxH1(markdown: string): string {
  const normalized = markdown.replace(/^\uFEFF/, "").replaceAll("\r\n", "\n");
  const lines = normalized.split("\n");

  let index = 0;
  while (index < lines.length && !lines[index]?.trim()) {
    index += 1;
  }

  if (lines[index]?.trim() === "---") {
    index += 1;
    while (index < lines.length && lines[index]?.trim() !== "---") {
      index += 1;
    }
    if (index < lines.length) {
      index += 1;
    }
  }

  while (index < lines.length && !lines[index]?.trim()) {
    index += 1;
  }

  const line = lines[index];
  if (!line || !/^\s{0,3}#\s+(.+?)\s*#*\s*$/u.test(line)) {
    return markdown;
  }

  lines.splice(index, 1);
  while (index < lines.length && !lines[index]?.trim()) {
    lines.splice(index, 1);
  }

  return lines.join("\n");
}

function extractLeadingAtxH1(markdown: string): string | undefined {
  const normalized = markdown.replace(/^\uFEFF/, "").replaceAll("\r\n", "\n");
  const lines = normalized.split("\n");

  let index = 0;
  while (index < lines.length && !lines[index]?.trim()) {
    index += 1;
  }

  if (lines[index]?.trim() === "---") {
    index += 1;
    while (index < lines.length && lines[index]?.trim() !== "---") {
      index += 1;
    }
    if (index < lines.length) {
      index += 1;
    }
  }

  while (index < lines.length && !lines[index]?.trim()) {
    index += 1;
  }

  const line = lines[index];
  const match = line?.match(/^\s{0,3}#\s+(.+?)\s*#*\s*$/u);
  return match?.[1]?.trim() || undefined;
}

function inferArticleTitle(
  rawArticleTitle: unknown,
  markdown: string,
  markdownPath?: string
): string | undefined {
  if (typeof rawArticleTitle === "string" && rawArticleTitle.trim()) {
    return rawArticleTitle.trim();
  }

  const headingTitle = extractLeadingAtxH1(markdown);
  if (headingTitle) {
    return headingTitle;
  }

  if (typeof markdownPath === "string" && markdownPath.trim()) {
    const base = basename(markdownPath.trim(), extname(markdownPath.trim())).trim();
    if (base) {
      return base;
    }
  }

  return undefined;
}

async function resolveMarkdownSource(args: Record<string, unknown>): Promise<{ markdown: string; markdownPath?: string } | ToolResult> {
  const directMarkdown = args.markdown;
  const markdownPath = args.markdown_path;

  if (directMarkdown !== undefined) {
    if (!validateMarkdown(directMarkdown)) {
      return {
        content: [{ type: "text", text: "markdown must be a non-empty string when provided." }],
        isError: true
      };
    }
    return { markdown: directMarkdown, markdownPath: typeof markdownPath === "string" ? markdownPath : undefined };
  }

  if (validateMarkdownPath(markdownPath)) {
    try {
      const markdown = await readFile(markdownPath, "utf8");
      if (!validateMarkdown(markdown)) {
        return {
          content: [{ type: "text", text: "markdown_path points to an empty markdown file." }],
          isError: true
        };
      }
      return { markdown, markdownPath };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Failed to read markdown_path: ${(error as Error).message}` }],
        isError: true
      };
    }
  }

  return {
    content: [{ type: "text", text: "Provide one markdown source: markdown or markdown_path." }],
    isError: true
  };
}

function isToolResult(value: ToolResult | { markdown: string; markdownPath?: string }): value is ToolResult {
  return "content" in value;
}

const PERMANENT_MATERIAL_TYPES: PermanentMaterialType[] = ["image", "voice", "video", "thumb"];

const MATERIAL_EXTENSION_RULES: Record<PermanentMaterialType, string[]> = {
  image: ["bmp", "png", "jpeg", "jpg", "gif"],
  voice: ["mp3", "wma", "wav", "amr"],
  video: ["mp4"],
  thumb: ["jpg", "jpeg"]
};

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

    markdown = removeLeadingAtxH1(markdown);

    const theme = args.theme ?? "default";
    if (typeof theme !== "string" || !(theme in THEMES)) {
      return invalidThemeResult(theme);
    }
    const fontSizePresetArg = args.font_size_preset ?? "medium";
    if (typeof fontSizePresetArg !== "string" || !FONT_SIZE_PRESETS.includes(fontSizePresetArg as FontSizePreset)) {
      return invalidFontSizePresetResult(fontSizePresetArg);
    }
    const fontSizePreset = fontSizePresetArg as FontSizePreset;

    const title = typeof args.title === "string" ? args.title : undefined;
    const accessToken = typeof args.access_token === "string" ? args.access_token.trim() : undefined;

    // Upload local images if access_token is provided
    if (accessToken) {
      const baseDir = typeof markdownPath === "string" ? dirname(markdownPath) : process.cwd();
      const uploadErrors: string[] = [];
      const uploadCache = new Map<string, string>();
      const imageTokens = parseMarkdownImageTokens(markdown);

      for (const token of imageTokens) {
        const rawPath = token.src;
        if (!rawPath || uploadCache.has(rawPath) || isRemoteUrl(rawPath)) continue;
        const absPath = rawPath.startsWith("/") ? rawPath : resolve(baseDir, rawPath);
        try {
          const result = await uploadImage(accessToken, absPath);
          uploadCache.set(rawPath, result.url);
        } catch (error) {
          uploadErrors.push(`${rawPath}: ${(error as Error).message}`);
        }
      }

      markdown = replaceMarkdownImageSources(markdown, uploadCache);

      if (uploadErrors.length > 0) {
        return {
          content: [{ type: "text", text: `Image upload failed:\n${uploadErrors.join("\n")}` }],
          isError: true
        };
      }
    }

    const html = parseMarkdown(markdown, theme, title, fontSizePreset);
    const savedPath = saveHtmlCache(html);

    const visibleMetaLines = [`cacheHtmlPath=${savedPath}`];

    return {
      content: [
        { type: "text", text: html },
        { type: "text", text: visibleMetaLines.join("\n") }
      ],
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

  if (name === "wechat_markdown_to_draft") {
    const accessToken = args.access_token;
    const rawArticleTitle = args.article_title;
    const author = typeof args.author === "string" ? args.author : undefined;
    const digest = typeof args.digest === "string" ? args.digest : undefined;
    const contentSourceUrl = typeof args.content_source_url === "string" ? args.content_source_url : undefined;
    const thumbMediaIdInput = typeof args.thumb_media_id === "string" ? args.thumb_media_id : undefined;
    const needOpenComment = args.need_open_comment;
    const onlyFansCanComment = args.only_fans_can_comment;

    if (typeof accessToken !== "string" || !accessToken.trim()) {
      return { content: [{ type: "text", text: "access_token is required." }], isError: true };
    }
    if (needOpenComment !== undefined && needOpenComment !== 0 && needOpenComment !== 1) {
      return { content: [{ type: "text", text: "need_open_comment must be 0 or 1." }], isError: true };
    }
    if (onlyFansCanComment !== undefined && onlyFansCanComment !== 0 && onlyFansCanComment !== 1) {
      return { content: [{ type: "text", text: "only_fans_can_comment must be 0 or 1." }], isError: true };
    }

    const source = await resolveMarkdownSource(args);
    if (isToolResult(source)) {
      return source;
    }

    const articleTitle = inferArticleTitle(rawArticleTitle, source.markdown, source.markdownPath);
    if (!articleTitle) {
      return {
        content: [{ type: "text", text: "article_title is required when markdown has no leading H1 and markdown_path is unavailable." }],
        isError: true
      };
    }

    let markdownForConvert = source.markdown;
    const markdownPath = source.markdownPath;
    const baseDir = markdownPath ? dirname(markdownPath) : process.cwd();
    const imageTokens = parseMarkdownImageTokens(markdownForConvert);

    let designatedCoverMediaId: string | undefined;
    let firstImageCoverMediaId: string | undefined;

    if (!thumbMediaIdInput) {
      const designatedCoverToken = imageTokens.find((token) => token.title?.trim() === "封面");
      if (designatedCoverToken && !isRemoteUrl(designatedCoverToken.src)) {
        const coverExt = getFileExtension(designatedCoverToken.src);
        if (coverExt === "jpg" || coverExt === "jpeg") {
          const coverPath = designatedCoverToken.src.startsWith("/") ? designatedCoverToken.src : resolve(baseDir, designatedCoverToken.src);
          try {
            const coverResult = await addMaterial(accessToken, "thumb", coverPath);
            designatedCoverMediaId = coverResult.media_id;
            markdownForConvert = removeMarkdownSlice(markdownForConvert, designatedCoverToken.start, designatedCoverToken.end);
          } catch (error) {
            return { content: [{ type: "text", text: `Cover upload failed: ${(error as Error).message}` }], isError: true };
          }
        }
      }

      if (!designatedCoverMediaId) {
        const firstLocalImage = imageTokens.find((token) => !isRemoteUrl(token.src));
        if (firstLocalImage) {
          const ext = getFileExtension(firstLocalImage.src);
          if (ext === "jpg" || ext === "jpeg") {
            const firstPath = firstLocalImage.src.startsWith("/") ? firstLocalImage.src : resolve(baseDir, firstLocalImage.src);
            try {
              const firstResult = await addMaterial(accessToken, "thumb", firstPath);
              firstImageCoverMediaId = firstResult.media_id;
            } catch {
              firstImageCoverMediaId = undefined;
            }
          }
        }
      }
    }

    markdownForConvert = removeLeadingAtxH1(markdownForConvert);

    const convertResult = await handleToolCall("convert_markdown_to_wechat_html", {
      markdown: markdownForConvert,
      markdown_path: markdownPath,
      theme: args.theme,
      font_size_preset: args.font_size_preset,
      access_token: accessToken
    });
    if (convertResult.isError) {
      return convertResult;
    }

    const html = convertResult.content[0]?.text;
    if (!validateMarkdown(html)) {
      return {
        content: [{ type: "text", text: "Failed to generate HTML content from markdown." }],
        isError: true
      };
    }

    const finalThumbMediaId = thumbMediaIdInput || designatedCoverMediaId || firstImageCoverMediaId;

    const article: WechatArticle = {
      title: articleTitle,
      content: html,
      ...(author ? { author } : {}),
      ...(digest ? { digest } : {}),
      ...(contentSourceUrl ? { content_source_url: contentSourceUrl } : {}),
      ...(finalThumbMediaId ? { thumb_media_id: finalThumbMediaId } : {}),
      ...(needOpenComment === 0 || needOpenComment === 1 ? { need_open_comment: needOpenComment } : {}),
      ...(onlyFansCanComment === 0 || onlyFansCanComment === 1 ? { only_fans_can_comment: onlyFansCanComment } : {})
    };

    try {
      const draftResult = await draftAdd(accessToken, [article]);
      return {
        content: [{ type: "text", text: JSON.stringify(draftResult, null, 2) }],
        meta: {
          mediaId: draftResult.media_id,
          cacheHtmlPath: convertResult.meta?.cacheHtmlPath,
          ...(finalThumbMediaId ? { thumbMediaId: finalThumbMediaId } : {})
        }
      };
    } catch (error) {
      return { content: [{ type: "text", text: (error as Error).message }], isError: true };
    }
  }

  if (name === "wechat_draft_update") {
    const accessToken = args.access_token;
    const mediaId = args.media_id;
    const index = args.index ?? 0;
    const article = args.article;
    const baseDirArg = args.base_dir;
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

    const baseDir = typeof baseDirArg === "string" && baseDirArg.trim() ? baseDirArg.trim() : process.cwd();
    const articleToUpdate: WechatArticle = { ...(article as WechatArticle) };

    if (typeof articleToUpdate.content === "string" && articleToUpdate.content.trim()) {
      try {
        const sanitizedHtml = removeLeadingHtmlH1(articleToUpdate.content);
        const replaced = await uploadLocalImageSourcesInHtml(sanitizedHtml, accessToken, baseDir);
        articleToUpdate.content = replaced.html;
      } catch (error) {
        return { content: [{ type: "text", text: (error as Error).message }], isError: true };
      }
    }
    try {
      const result = await draftUpdate(accessToken, mediaId, index, articleToUpdate);
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
    const ext = getFileExtension(filePath);
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

  if (name === "wechat_add_material") {
    const accessToken = args.access_token;
    const type = args.type;
    const filePath = args.file_path;
    const title = typeof args.title === "string" ? args.title.trim() : undefined;
    const introduction = typeof args.introduction === "string" ? args.introduction.trim() : undefined;

    if (typeof accessToken !== "string" || !accessToken.trim()) {
      return { content: [{ type: "text", text: "access_token is required." }], isError: true };
    }
    if (typeof type !== "string" || !PERMANENT_MATERIAL_TYPES.includes(type as PermanentMaterialType)) {
      return { content: [{ type: "text", text: "type must be one of: image, voice, video, thumb." }], isError: true };
    }
    if (typeof filePath !== "string" || !filePath.trim()) {
      return { content: [{ type: "text", text: "file_path is required." }], isError: true };
    }

    const ext = getFileExtension(filePath);
    const allowedExt = MATERIAL_EXTENSION_RULES[type as PermanentMaterialType];
    if (!ext || !allowedExt.includes(ext)) {
      return {
        content: [{ type: "text", text: `Invalid file extension for type=${type}. Allowed: ${allowedExt.join(", ")}.` }],
        isError: true
      };
    }

    if (type === "video" && (!title || !introduction)) {
      return {
        content: [{ type: "text", text: "For video material, both title and introduction are required." }],
        isError: true
      };
    }

    try {
      const result = await addMaterial(accessToken, type as PermanentMaterialType, filePath, title || introduction ? { title, introduction } : undefined);
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
