import { parseMarkdown } from "./markdown.js";
import { saveHtmlCache } from "./cache.js";
import { openFileInBrowser } from "./browser.js";
import { THEME_NAMES, THEMES } from "./themes.js";

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
    const markdown = args.markdown;
    if (!validateMarkdown(markdown)) {
      return {
        content: [{ type: "text", text: "markdown is required and must be a non-empty string." }],
        isError: true
      };
    }

    const theme = args.theme ?? "default";
    if (typeof theme !== "string" || !(theme in THEMES)) {
      return invalidThemeResult(theme);
    }

    const title = typeof args.title === "string" ? args.title : undefined;
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

  return {
    content: [{ type: "text", text: `Unknown tool: ${name}` }],
    isError: true
  };
}
