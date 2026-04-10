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

export function createServer(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  server.registerTool(
    "convert_markdown_to_wechat_html",
    {
      description: "Convert Markdown to WeChat-friendly HTML with inline styles for copy/paste publishing workflows.",
      inputSchema: {
        markdown: z.string().optional().describe("Source markdown text. If both markdown and markdown_path are provided, markdown is used."),
        markdown_path: z.string().optional().describe("Local markdown file path. Use this to avoid sending full content through tokens."),
        theme: themeSchema.optional().default("default").describe("Theme name: default | tech | warm | apple | wechat-native"),
        title: z.string().optional().describe("Optional article title rendered as h1")
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
      description: "Open cached HTML path directly in the default browser for manual copy workflows.",
      inputSchema: {
        cacheHtmlPath: z.string().describe("Existing cached HTML file path to open directly")
      }
    },
    async (args) => handleToolCall("open_wechat_html_in_browser", args as Record<string, unknown>)
  );

  return server;
}

export async function main(): Promise<void> {
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
