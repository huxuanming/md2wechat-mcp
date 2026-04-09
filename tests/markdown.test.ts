import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../src/markdown.js";

describe("parseMarkdown", () => {
  it("renders headings, paragraph, list, quote and code block", () => {
    const md = [
      "# 标题",
      "",
      "这是**测试**，带[链接](https://example.com)和`代码`。",
      "",
      "- 项目1",
      "- 项目2",
      "",
      "> 引用",
      "",
      "```ts",
      "const a = 1;",
      "```"
    ].join("\n");

    const html = parseMarkdown(md, "default", undefined);
    expect(html).toContain("<article");
    expect(html).toContain("<h1");
    expect(html).toContain("<strong");
    expect(html).toContain("<a href=\"https://example.com\"");
    expect(html).toContain("<ul");
    expect(html).toContain("<blockquote");
    expect(html).toContain("<pre");
    expect(html).toContain("const a = 1;");
  });

  it("injects title as h1 before body when title provided", () => {
    const html = parseMarkdown("正文", "default", "外部标题");
    const firstH1 = html.indexOf("<h1");
    const firstP = html.indexOf("<p");
    expect(firstH1).toBeGreaterThan(-1);
    expect(firstH1).toBeLessThan(firstP);
    expect(html).toContain("外部标题");
  });
});
