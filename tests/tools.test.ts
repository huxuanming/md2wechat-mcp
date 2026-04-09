import { beforeEach, describe, expect, it, vi } from "vitest";

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

  it("returns error for empty markdown", async () => {
    const result = await handleToolCall("convert_markdown_to_wechat_html", { markdown: "" });
    expect(result.isError).toBe(true);
  });

  it("returns html and cache path for html conversion", async () => {
    const result = await handleToolCall("convert_markdown_to_wechat_html", { markdown: "# Hi", theme: "default" });
    expect(result.isError).not.toBe(true);
    expect(result.content[0]?.type).toBe("text");
    expect(result.content[0]?.text).toContain("<article");
    expect((result as { meta?: { cacheHtmlPath?: string } }).meta?.cacheHtmlPath).toBeTruthy();
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
});
