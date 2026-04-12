import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const apiMocks = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  draftAdd: vi.fn(),
  draftUpdate: vi.fn(),
  draftDelete: vi.fn(),
  draftBatchGet: vi.fn(),
  uploadImage: vi.fn(),
  addMaterial: vi.fn()
}));

vi.mock("../src/wechat-api.js", () => apiMocks);

import { handleToolCall } from "../src/tools.js";

describe("wechat_markdown_to_draft", () => {
  beforeEach(() => {
    apiMocks.draftAdd.mockReset();
    apiMocks.uploadImage.mockReset();
    apiMocks.addMaterial.mockReset();
  });

  it("creates draft using converted html and auto thumb media id", async () => {
    apiMocks.uploadImage.mockResolvedValue({ url: "https://cdn.example.com/inline.jpg" });
    apiMocks.addMaterial.mockResolvedValue({ media_id: "thumb_auto_1" });
    apiMocks.draftAdd.mockResolvedValue({ media_id: "draft_1" });

    const result = await handleToolCall("wechat_markdown_to_draft", {
      access_token: "token",
      article_title: "My Article",
      markdown: "![cover](./cover.jpg)\n\n# Hello"
    });

    expect(result.isError).not.toBe(true);
    expect(apiMocks.draftAdd).toHaveBeenCalledTimes(1);
    const [tokenArg, articlesArg] = apiMocks.draftAdd.mock.calls[0] as [string, Array<Record<string, unknown>>];
    expect(tokenArg).toBe("token");
    expect(articlesArg[0]?.title).toBe("My Article");
    expect(String(articlesArg[0]?.content)).toContain("<article");
    expect(String(articlesArg[0]?.content)).toContain("https://cdn.example.com/inline.jpg");
    expect(articlesArg[0]?.thumb_media_id).toBe("thumb_auto_1");
    expect((result.meta as { thumbMediaId?: string }).thumbMediaId).toBe("thumb_auto_1");
  });

  it("uses provided thumb_media_id when auto thumb is disabled", async () => {
    apiMocks.uploadImage.mockResolvedValue({ url: "https://cdn.example.com/inline.jpg" });
    apiMocks.addMaterial.mockResolvedValue({ media_id: "thumb_auto_ignored" });
    apiMocks.draftAdd.mockResolvedValue({ media_id: "draft_2" });

    const result = await handleToolCall("wechat_markdown_to_draft", {
      access_token: "token",
      article_title: "My Article",
      markdown: "![cover](./cover.jpg)\n\n# Hello",
      thumb_media_id: "thumb_manual_1"
    });

    expect(result.isError).not.toBe(true);
    expect(apiMocks.addMaterial).not.toHaveBeenCalled();
    const [, articlesArg] = apiMocks.draftAdd.mock.calls[0] as [string, Array<Record<string, unknown>>];
    expect(articlesArg[0]?.thumb_media_id).toBe("thumb_manual_1");
  });

  it("rejects invalid comment flags", async () => {
    const result = await handleToolCall("wechat_markdown_to_draft", {
      access_token: "token",
      article_title: "My Article",
      markdown: "# Hello",
      need_open_comment: 2
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("need_open_comment must be 0 or 1");
  });

  it("supports image path with parentheses and title in markdown", async () => {
    apiMocks.uploadImage.mockResolvedValue({ url: "https://cdn.example.com/cover.jpg" });
    apiMocks.addMaterial.mockResolvedValue({ media_id: "thumb_auto_2" });
    apiMocks.draftAdd.mockResolvedValue({ media_id: "draft_3" });

    const result = await handleToolCall("wechat_markdown_to_draft", {
      access_token: "token",
      article_title: "My Article",
      markdown: "![cover](./img(1).jpg \"Cover Title\")\n\n正文"
    });

    expect(result.isError).not.toBe(true);
    expect(apiMocks.uploadImage).toHaveBeenCalledWith("token", expect.stringContaining("img(1).jpg"));
    expect(apiMocks.addMaterial).toHaveBeenCalledWith("token", "thumb", expect.stringContaining("img(1).jpg"));
    const [, articlesArg] = apiMocks.draftAdd.mock.calls[0] as [string, Array<Record<string, unknown>>];
    const html = String(articlesArg[0]?.content);
    expect(html).toContain("https://cdn.example.com/cover.jpg");
    expect(html).toContain("Cover Title");
  });

  it("uses image with title 封面 as thumb and removes it from content", async () => {
    apiMocks.uploadImage.mockResolvedValue({ url: "https://cdn.example.com/inline.jpg" });
    apiMocks.addMaterial.mockResolvedValue({ media_id: "thumb_cover_1" });
    apiMocks.draftAdd.mockResolvedValue({ media_id: "draft_7" });

    const result = await handleToolCall("wechat_markdown_to_draft", {
      access_token: "token",
      article_title: "My Article",
      markdown: "![封面](./cover.jpg \"封面\")\n\n正文\n\n![图](./inline.jpg)"
    });

    expect(result.isError).not.toBe(true);
    expect(apiMocks.addMaterial).toHaveBeenCalledWith("token", "thumb", expect.stringContaining("cover.jpg"));
    expect(apiMocks.uploadImage).toHaveBeenCalledWith("token", expect.stringContaining("inline.jpg"));

    const [, articlesArg] = apiMocks.draftAdd.mock.calls[0] as [string, Array<Record<string, unknown>>];
    const html = String(articlesArg[0]?.content);
    expect(articlesArg[0]?.thumb_media_id).toBe("thumb_cover_1");
    expect(html).not.toContain("cover.jpg");
    expect(html).toContain("inline.jpg");
  });

  it("does not upload markdown image syntax inside fenced code blocks", async () => {
    apiMocks.uploadImage.mockResolvedValue({ url: "https://cdn.example.com/inline.jpg" });
    apiMocks.draftAdd.mockResolvedValue({ media_id: "draft_4" });

    const result = await handleToolCall("wechat_markdown_to_draft", {
      access_token: "token",
      article_title: "My Article",
      markdown: "```md\n![in-code](./should-not-upload.jpg)\n```\n\n正文"
    });

    expect(result.isError).not.toBe(true);
    expect(apiMocks.uploadImage).not.toHaveBeenCalled();
  });

  it("does not upload markdown image syntax inside inline code spans", async () => {
    apiMocks.uploadImage.mockResolvedValue({ url: "https://cdn.example.com/inline.jpg" });
    apiMocks.draftAdd.mockResolvedValue({ media_id: "draft_5" });

    const result = await handleToolCall("wechat_markdown_to_draft", {
      access_token: "token",
      article_title: "My Article",
      markdown: "这是示例 `![in-code](./should-not-upload.jpg)` 文本"
    });

    expect(result.isError).not.toBe(true);
    expect(apiMocks.uploadImage).not.toHaveBeenCalled();
  });

  it("preserves quoted title safely when replacing image src", async () => {
    apiMocks.uploadImage.mockResolvedValue({ url: "https://cdn.example.com/q.jpg" });
    apiMocks.draftAdd.mockResolvedValue({ media_id: "draft_6" });

    const result = await handleToolCall("wechat_markdown_to_draft", {
      access_token: "token",
      article_title: "My Article",
      markdown: "![cover](./a.png \"He said \\\"Hi\\\"\")"
    });

    expect(result.isError).not.toBe(true);
    const [, articlesArg] = apiMocks.draftAdd.mock.calls[0] as [string, Array<Record<string, unknown>>];
    const html = String(articlesArg[0]?.content);
    expect(html).toContain("https://cdn.example.com/q.jpg");
    expect(html).toContain("He said");
  });

  it("removes leading markdown h1 from body content", async () => {
    apiMocks.draftAdd.mockResolvedValue({ media_id: "draft_8" });

    const result = await handleToolCall("wechat_markdown_to_draft", {
      access_token: "token",
      article_title: "My Article",
      title: "同一个标题",
      markdown: "# 同一个标题\n\n正文"
    });

    expect(result.isError).not.toBe(true);
    const [, articlesArg] = apiMocks.draftAdd.mock.calls[0] as [string, Array<Record<string, unknown>>];
    const html = String(articlesArg[0]?.content);
    const h1Matches = html.match(/<h1\b/g) ?? [];
    expect(h1Matches.length).toBe(0);
    expect(html).toContain("正文");
  });

  it("passes font_size_preset through one-shot conversion", async () => {
    apiMocks.draftAdd.mockResolvedValue({ media_id: "draft_9" });

    const result = await handleToolCall("wechat_markdown_to_draft", {
      access_token: "token",
      article_title: "My Article",
      theme: "wechat-native",
      font_size_preset: "small",
      markdown: "正文"
    });

    expect(result.isError).not.toBe(true);
    const [, articlesArg] = apiMocks.draftAdd.mock.calls[0] as [string, Array<Record<string, unknown>>];
    const html = String(articlesArg[0]?.content);
    expect(html).toContain("font-size: 13.5px");
  });

  it("falls back to first markdown h1 when article_title is omitted", async () => {
    apiMocks.draftAdd.mockResolvedValue({ media_id: "draft_10" });

    const result = await handleToolCall("wechat_markdown_to_draft", {
      access_token: "token",
      markdown: "# 来自H1的标题\n\n正文"
    });

    expect(result.isError).not.toBe(true);
    const [, articlesArg] = apiMocks.draftAdd.mock.calls[0] as [string, Array<Record<string, unknown>>];
    expect(articlesArg[0]?.title).toBe("来自H1的标题");
  });

  it("falls back to markdown file name when article_title and h1 are both missing", async () => {
    apiMocks.draftAdd.mockResolvedValue({ media_id: "draft_11" });
    const tempDir = mkdtempSync(join(tmpdir(), "wechat-md-draft-title-"));
    const filePath = join(tempDir, "fallback-title-file.md");
    writeFileSync(filePath, "正文无H1", "utf8");

    try {
      const result = await handleToolCall("wechat_markdown_to_draft", {
        access_token: "token",
        markdown_path: filePath
      });

      expect(result.isError).not.toBe(true);
      const [, articlesArg] = apiMocks.draftAdd.mock.calls[0] as [string, Array<Record<string, unknown>>];
      expect(articlesArg[0]?.title).toBe("fallback-title-file");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
