import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { openFileInBrowser } = vi.hoisted(() => ({
  openFileInBrowser: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("../src/browser.js", () => ({
  openFileInBrowser
}));

import { handleToolCall, listThemesPayload } from "../src/tools.js";

describe("tools", () => {
  beforeEach(() => {
    openFileInBrowser.mockClear();
  });

  it("returns theme list payload", () => {
    const payload = listThemesPayload();
    expect(payload.themes.length).toBe(5);
    expect(payload.themes.some((x) => x.name === "wechat-native")).toBe(true);
  });

  it("returns error for invalid theme", async () => {
    const result = await handleToolCall("convert_markdown_to_wechat_html", { markdown: "# Hi", theme: "bad-theme" });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("Invalid theme");
  });

  it("returns error for invalid font_size_preset", async () => {
    const result = await handleToolCall("convert_markdown_to_wechat_html", {
      markdown: "# Hi",
      font_size_preset: "huge"
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("Invalid font_size_preset");
  });

  it("returns error for empty markdown", async () => {
    const result = await handleToolCall("convert_markdown_to_wechat_html", { markdown: "" });
    expect(result.isError).toBe(true);
  });

  it("returns error when both markdown sources are missing", async () => {
    const result = await handleToolCall("convert_markdown_to_wechat_html", {});
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("Provide one markdown source");
  });

  it("returns html and cache path for html conversion", async () => {
    const result = await handleToolCall("convert_markdown_to_wechat_html", { markdown: "# Hi", theme: "default" });
    expect(result.isError).not.toBe(true);
    expect(result.content[0]?.type).toBe("text");
    expect(result.content[0]?.text).toContain("<article");
    expect(result.content[1]?.text).toContain("cacheHtmlPath=");
    expect((result as { meta?: { cacheHtmlPath?: string } }).meta?.cacheHtmlPath).toBeTruthy();
  });

  it("removes leading markdown h1 in convert output", async () => {
    const result = await handleToolCall("convert_markdown_to_wechat_html", {
      markdown: "# 主标题\n\n正文",
      theme: "default"
    });
    expect(result.isError).not.toBe(true);
    const html = String(result.content[0]?.text);
    const h1Matches = html.match(/<h1\b/g) ?? [];
    expect(h1Matches.length).toBe(0);
    expect(html).toContain("正文");
  });

  it("applies small font_size_preset", async () => {
    const result = await handleToolCall("convert_markdown_to_wechat_html", {
      markdown: "正文",
      theme: "default",
      font_size_preset: "small"
    });
    expect(result.isError).not.toBe(true);
    expect(result.content[0]?.text).toContain("font-size: 14.4px");
  });

  it("reads markdown from markdown_path", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "wechat-md-tools-"));
    const inputPath = join(tempDir, "input.md");
    writeFileSync(inputPath, "# FromFile\n\nBodyFromFile", "utf8");

    try {
      const result = await handleToolCall("convert_markdown_to_wechat_html", { markdown_path: inputPath, theme: "default" });
      expect(result.isError).not.toBe(true);
      expect(result.content[0]?.text).toContain("BodyFromFile");
      expect(result.content[0]?.text).not.toContain("<h1");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("prioritizes markdown when markdown and markdown_path are both provided", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "wechat-md-tools-"));
    const inputPath = join(tempDir, "input.md");
    writeFileSync(inputPath, "# FromFile\n\nBodyFromFile", "utf8");

    try {
      const result = await handleToolCall("convert_markdown_to_wechat_html", {
        markdown: "# FromArg\n\nBodyFromArg",
        markdown_path: inputPath,
        theme: "default"
      });
      expect(result.isError).not.toBe(true);
      expect(result.content[0]?.text).toContain("BodyFromArg");
      expect(result.content[0]?.text).not.toContain("BodyFromFile");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("opens provided cache path directly", async () => {
    const inputPath = "/tmp/existing-wechat.html";
    const result = await handleToolCall("open_wechat_html_in_browser", { cacheHtmlPath: inputPath });
    expect(result.isError).not.toBe(true);
    expect(result.content[0]?.text).toContain(inputPath);
    expect((result as { meta?: { cacheHtmlPath?: string } }).meta?.cacheHtmlPath).toBe(inputPath);
    expect(openFileInBrowser).toHaveBeenCalledWith(inputPath);
  });

  it("returns error when cacheHtmlPath is missing", async () => {
    const result = await handleToolCall("open_wechat_html_in_browser", {});
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("cacheHtmlPath is required");
  });

  it("returns error when cacheHtmlPath is empty", async () => {
    const result = await handleToolCall("open_wechat_html_in_browser", { cacheHtmlPath: "   " });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("cacheHtmlPath is required");
  });

  it("returns unknown tool error", async () => {
    const result = await handleToolCall("convert_markdown_to_wechat_clipboard", {});
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("Unknown tool");
  });

  it("returns unknown tool error for arbitrary name", async () => {
    const result = await handleToolCall("not_exists", {});
    expect(result.isError).toBe(true);
  });

  it("validates required type for wechat_add_material", async () => {
    const result = await handleToolCall("wechat_add_material", {
      access_token: "token",
      file_path: "/tmp/a.jpg"
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("type must be one of");
  });

  it("validates extension by material type", async () => {
    const result = await handleToolCall("wechat_add_material", {
      access_token: "token",
      type: "thumb",
      file_path: "/tmp/a.png"
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("Invalid file extension");
  });

  it("requires video description fields for video material", async () => {
    const result = await handleToolCall("wechat_add_material", {
      access_token: "token",
      type: "video",
      file_path: "/tmp/a.mp4",
      title: "demo"
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("title and introduction are required");
  });

  it("validates required access_token for wechat_markdown_to_draft", async () => {
    const result = await handleToolCall("wechat_markdown_to_draft", {
      article_title: "title",
      markdown: "# Hello"
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("access_token is required");
  });

  it("requires article_title only when no h1 and no markdown_path fallback are available", async () => {
    const result = await handleToolCall("wechat_markdown_to_draft", {
      access_token: "token",
      markdown: "Hello"
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("article_title is required when markdown has no leading H1");
  });
});
