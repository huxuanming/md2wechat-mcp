#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { handleToolCall } from "./tools.js";
import pkg from "../package.json" with { type: "json" };

const SERVER_NAME = pkg.name;
const SERVER_VERSION = pkg.version;

const themeSchema = z.enum(["default", "tech", "warm", "apple", "wechat-native"]);
const fontSizePresetSchema = z.enum(["small", "medium", "large"]);

const SERVER_INSTRUCTIONS = `
## 发布 Markdown 图文到微信公众号草稿箱

前置条件：MCP server 配置环境变量 WECHAT_APPID 和 WECHAT_APPSECRET。

严格执行规则（非常重要）：
1) 用户要求“发布/上传 Markdown 到草稿箱”时，必须先调用 convert_markdown_to_wechat_html，再调用 wechat_draft_add。
2) wechat_draft_add.articles[].content 必须使用 convert_markdown_to_wechat_html 返回的 content[0].text，不能直接使用原始 Markdown。
3) wechat_add_material 只用于上传素材（如封面），不能替代 wechat_draft_add 创建草稿。
4) 封面素材请通过一键工具自动处理，或手动调用 wechat_add_material(type=thumb) 后写入 wechat_draft_add.articles[].thumb_media_id。
5) 若要预览/打开 HTML，open_wechat_html_in_browser.cacheHtmlPath 必须使用 convert_markdown_to_wechat_html 返回的 meta.cacheHtmlPath，不要猜测临时路径。
6) 若客户端不展示 meta，必须从 convert_markdown_to_wechat_html 的 content[1].text 解析 cacheHtmlPath=...，不得用“最近文件”或路径猜测替代。

完整工作流（按顺序）：

推荐：可直接使用一键工具 wechat_markdown_to_draft 完成 Step 2/5 的核心链路（Step 1 仍需先获取 access_token）。
  一键工具会自动处理封面：
  - 若存在 title 为“封面”的本地 JPG/JPEG 图片，则该图作为封面并从正文移除；
  - 否则尝试用首张本地 JPG/JPEG 作为封面；
  - 若无可用图片则不上传封面。

Step 1 — 获取 access_token
  wechat_get_access_token() → { access_token, expires_in }
  同一次任务保存复用，无需重复获取（有效期 7200 秒）。

Step 2 — 转换 Markdown 并自动上传本地图片
  convert_markdown_to_wechat_html(markdown_path, access_token, theme?, title?, font_size_preset?)
  传入 access_token 后，![alt](./local/path) 形式的本地图片自动上传并替换为微信 CDN URL。
  返回：content[0].text（HTML）、content[1].text（可见元信息）、meta.cacheHtmlPath（缓存文件路径）。

Step 3（可选）— 上传文章内嵌图片
  wechat_upload_image(access_token, file_path) → { url }
  返回的 url 可用于文章 HTML 中的 <img src>，但不能用作封面 thumb_media_id。

Step 4（可选）— 上传永久素材（封面图/视频等）
  wechat_add_material(access_token, type, file_path, title?, introduction?) → { media_id, url? }
  type: image | voice | video | thumb
  当 type=video 时需要提供 title 和 introduction；返回的 media_id 可用于 thumb_media_id 或其他素材场景。

Step 5 — 新增草稿
  wechat_draft_add(access_token, articles: [{ title, content, author?, digest?, thumb_media_id?, ... }])
  content 必须使用 Step 2 返回的 content[0].text。返回 media_id 可用于后续更新或删除。

标准映射（必须遵循）：
  draft.content = convert.content[0].text
  draft.thumb_media_id = 使用 wechat_add_material(type=thumb) 返回的 media_id（或一键工具自动返回的封面）
  open.cacheHtmlPath = convert.meta.cacheHtmlPath
  fallback: open.cacheHtmlPath = parse(convert.content[1].text where line starts with "cacheHtmlPath=")

其他工具：
  wechat_draft_batchget — 分页查询草稿列表
  wechat_draft_update  — 按 media_id 更新草稿
  wechat_draft_delete  — 按 media_id 删除草稿

常见错误：40005=图片格式不支持，40009=图片超1MB，access_token过期重新调用Step1。
`.trim();

export function createServer(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION }, { instructions: SERVER_INSTRUCTIONS });

  server.registerTool(
    "convert_markdown_to_wechat_html",
    {
      description: "Convert Markdown to WeChat-friendly HTML. Output mapping: content[0].text is article HTML; meta.cacheHtmlPath is the cached file path for open_wechat_html_in_browser.cacheHtmlPath.",
      inputSchema: {
        markdown: z.string().optional().describe("Source markdown text. If both markdown and markdown_path are provided, markdown is used."),
        markdown_path: z.string().optional().describe("Local markdown file path. Use this to avoid sending full content through tokens."),
        theme: themeSchema.optional().default("default").describe("Theme name: default | tech | warm | apple | wechat-native"),
        title: z.string().optional().describe("Optional article title rendered as h1"),
        font_size_preset: fontSizePresetSchema.optional().default("medium").describe("Font size preset: small | medium | large"),
        access_token: z.string().optional().describe("WeChat API access token. When provided, local images referenced as ![alt](./path) are automatically uploaded to WeChat CDN and replaced with permanent URLs.")
      }
    },
    async (args) => handleToolCall("convert_markdown_to_wechat_html", args as Record<string, unknown>)
  );

  server.registerTool(
    "list_wechat_themes",
    {
      description: "List available rendering themes.",
      inputSchema: {}
    },
    async () => handleToolCall("list_wechat_themes", {})
  );

  server.registerTool(
    "open_wechat_html_in_browser",
    {
      description: "Open cached HTML in browser for manual copy workflows. Pass convert_markdown_to_wechat_html result meta.cacheHtmlPath; do not guess temp paths.",
      inputSchema: {
        cacheHtmlPath: z.string().describe("Use convert_markdown_to_wechat_html returned meta.cacheHtmlPath directly")
      }
    },
    async (args) => handleToolCall("open_wechat_html_in_browser", args as Record<string, unknown>)
  );

  const articleSchema = z.object({
    article_type: z.enum(["news", "newspic"]).optional().describe("Article type: news (text+image) or newspic (pure image). Defaults to news."),
    title: z.string().describe("Article title (max 32 chars)"),
    author: z.string().optional().describe("Author name (max 16 chars)"),
    digest: z.string().optional().describe("Article summary shown in list view (max 128 chars)"),
    content: z.string().describe("Article HTML content (max 20000 chars). Use convert_markdown_to_wechat_html to generate this."),
    content_source_url: z.string().optional().describe("Original article URL (max 1024 chars)"),
    thumb_media_id: z.string().optional().describe("Cover image media ID obtained from WeChat material upload API"),
    need_open_comment: z.union([z.literal(0), z.literal(1)]).optional().describe("Enable comments: 1 = yes, 0 = no"),
    only_fans_can_comment: z.union([z.literal(0), z.literal(1)]).optional().describe("Only followers can comment: 1 = yes, 0 = no")
  });

  server.registerTool(
    "wechat_get_access_token",
    {
      description: "Get WeChat API access_token. Reads AppID and AppSecret from environment variables WECHAT_APPID and WECHAT_APPSECRET. The token is valid for 7200 seconds.",
      inputSchema: {}
    },
    async () => handleToolCall("wechat_get_access_token", {})
  );

  server.registerTool(
    "wechat_draft_add",
    {
      description: "Add a new draft to WeChat Official Account draft box. articles[].content must be HTML from convert_markdown_to_wechat_html content[0].text.",
      inputSchema: {
        access_token: z.string().describe("WeChat API access token from wechat_get_access_token"),
        articles: z.array(articleSchema).min(1).describe("Array of articles to include in the draft (usually 1)")
      }
    },
    async (args) => handleToolCall("wechat_draft_add", args as Record<string, unknown>)
  );

  server.registerTool(
    "wechat_markdown_to_draft",
    {
      description: "One-shot tool: convert markdown to WeChat HTML and create draft. Cover is handled automatically (title=封面 preferred, else first local JPG/JPEG).",
      inputSchema: {
        access_token: z.string().describe("WeChat API access token from wechat_get_access_token"),
        article_title: z.string().optional().describe("Draft article title. Fallback: first markdown H1, then markdown file name."),
        markdown: z.string().optional().describe("Source markdown text. If both markdown and markdown_path are provided, markdown is used."),
        markdown_path: z.string().optional().describe("Local markdown file path"),
        theme: themeSchema.optional().default("default").describe("Theme name: default | tech | warm | apple | wechat-native"),
        title: z.string().optional().describe("Optional rendered h1 title for HTML"),
        font_size_preset: fontSizePresetSchema.optional().default("medium").describe("Font size preset: small | medium | large"),
        thumb_media_id: z.string().optional().describe("Optional explicit thumb media id override."),
        author: z.string().optional().describe("Author name"),
        digest: z.string().optional().describe("Article summary"),
        content_source_url: z.string().optional().describe("Original article URL"),
        need_open_comment: z.union([z.literal(0), z.literal(1)]).optional().describe("Enable comments: 1=yes, 0=no"),
        only_fans_can_comment: z.union([z.literal(0), z.literal(1)]).optional().describe("Only followers can comment: 1=yes, 0=no")
      }
    },
    async (args) => handleToolCall("wechat_markdown_to_draft", args as Record<string, unknown>)
  );

  server.registerTool(
    "wechat_draft_update",
    {
      description: "Update an existing draft in WeChat Official Account draft box by media_id.",
      inputSchema: {
        access_token: z.string().describe("WeChat API access token from wechat_get_access_token"),
        media_id: z.string().describe("Draft media_id returned from wechat_draft_add"),
        index: z.number().int().min(0).default(0).describe("0-based index of article to update within the draft"),
        article: articleSchema.describe("Updated article content")
      }
    },
    async (args) => handleToolCall("wechat_draft_update", args as Record<string, unknown>)
  );

  server.registerTool(
    "wechat_upload_image",
    {
      description: "Upload a local JPG/PNG image (max 1MB) to WeChat for use in article content. Returns a permanent image URL. Does not count toward the 100,000 material limit.",
      inputSchema: {
        access_token: z.string().describe("WeChat API access token from wechat_get_access_token"),
        file_path: z.string().describe("Absolute local path to the image file (JPG or PNG, max 1MB)")
      }
    },
    async (args) => handleToolCall("wechat_upload_image", args as Record<string, unknown>)
  );

  server.registerTool(
    "wechat_add_material",
    {
      description: "Upload permanent material to WeChat material library (image/voice/video/thumb). Returns media_id and image url when type=image.",
      inputSchema: {
        access_token: z.string().describe("WeChat API access token from wechat_get_access_token"),
        type: z.enum(["image", "voice", "video", "thumb"]).describe("Permanent material type"),
        file_path: z.string().describe("Absolute local file path"),
        title: z.string().optional().describe("Video title. Required when type=video"),
        introduction: z.string().optional().describe("Video introduction. Required when type=video")
      }
    },
    async (args) => handleToolCall("wechat_add_material", args as Record<string, unknown>)
  );

  server.registerTool(
    "wechat_draft_batchget",
    {
      description: "Query draft list from WeChat Official Account draft box with pagination.",
      inputSchema: {
        access_token: z.string().describe("WeChat API access token from wechat_get_access_token"),
        offset: z.number().int().min(0).default(0).describe("Starting offset (0 = first item)"),
        count: z.number().int().min(1).max(20).default(10).describe("Number of drafts to return (1-20)"),
        no_content: z.union([z.literal(0), z.literal(1)]).optional().default(0).describe("1 = exclude article content field to reduce response size, 0 = include (default)")
      }
    },
    async (args) => handleToolCall("wechat_draft_batchget", args as Record<string, unknown>)
  );

  server.registerTool(
    "wechat_draft_delete",
    {
      description: "Delete a draft from WeChat Official Account draft box by media_id. This action is irreversible.",
      inputSchema: {
        access_token: z.string().describe("WeChat API access token from wechat_get_access_token"),
        media_id: z.string().describe("Draft media_id to delete")
      }
    },
    async (args) => handleToolCall("wechat_draft_delete", args as Record<string, unknown>)
  );

  return server;
}

export async function main(): Promise<void> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    process.stdout.write(`${SERVER_NAME} v${SERVER_VERSION}

MCP server that converts Markdown to WeChat-friendly HTML.

Tools:
  convert_markdown_to_wechat_html  Convert Markdown to inline-styled HTML
  list_wechat_themes               List available themes
  open_wechat_html_in_browser      Open cached HTML in browser (use meta.cacheHtmlPath from convert result)
  wechat_get_access_token          Get WeChat access token from env
  wechat_upload_image              Upload inline article image
  wechat_add_material              Upload permanent material
  wechat_draft_add                 Add draft
  wechat_markdown_to_draft         One-shot markdown to draft
  wechat_draft_update              Update draft
  wechat_draft_batchget            Query draft list
  wechat_draft_delete              Delete draft

MCP config:
  {
    "mcpServers": {
      "${SERVER_NAME}": {
        "command": "npx",
        "args": ["-y", "${SERVER_NAME}"]
      }
    }
  }
`);
    process.exit(0);
  }

  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (import.meta.url === `file://${realpathSync(process.argv[1])}`) {
  main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
