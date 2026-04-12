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

  it("supports font size preset scaling", () => {
    const small = parseMarkdown("正文", "default", undefined, "small");
    const large = parseMarkdown("正文", "default", undefined, "large");

    expect(small).toContain("font-size: 14.4px");
    expect(large).toContain("font-size: 17.6px");
  });

  it("renders markdown tables", () => {
    const md = ["| 名称 | 值 |", "| --- | --- |", "| A | 1 |", "| B | **2** |"].join("\n");
    const html = parseMarkdown(md, "default");

    expect(html).toContain("<table");
    expect(html).toContain("<thead");
    expect(html).toContain("<tbody");
    expect(html).toContain("<th");
    expect(html).toContain(">名称<");
    expect(html).toContain(">A<");
    expect(html).toContain("<strong");
  });

  it("applies column alignment from separator", () => {
    const md = ["| 左 | 中 | 右 |", "| :--- | :---: | ---: |", "| a | b | c |"].join("\n");
    const html = parseMarkdown(md, "default");

    expect(html).toMatch(/<th[^>]*text-align: left[^>]*>左</);
    expect(html).toMatch(/<th[^>]*text-align: center[^>]*>中</);
    expect(html).toMatch(/<th[^>]*text-align: right[^>]*>右</);
    expect(html).toMatch(/<td[^>]*text-align: left[^>]*>a</);
    expect(html).toMatch(/<td[^>]*text-align: center[^>]*>b</);
    expect(html).toMatch(/<td[^>]*text-align: right[^>]*>c</);
  });

  it("accepts single-dash separator", () => {
    const md = ["| A | B |", "| :- | -: |", "| 1 | 2 |"].join("\n");
    const html = parseMarkdown(md, "default");

    expect(html).toContain("<table");
    expect(html).toMatch(/<th[^>]*text-align: left[^>]*>A</);
    expect(html).toMatch(/<th[^>]*text-align: right[^>]*>B</);
  });

  it("does not parse table when column count mismatches separator", () => {
    const md = ["有竖线 | 但不是表格", "| --- | --- | --- |", "正文继续"].join("\n");
    const html = parseMarkdown(md, "default");

    expect(html).not.toContain("<table");
  });

  it("renders image with optional title", () => {
    const md = '![封面](https://example.com/a.jpg "封面图")';
    const html = parseMarkdown(md, "default");

    expect(html).toContain("<img");
    expect(html).toContain('src="https://example.com/a.jpg"');
    expect(html).toContain('title="封面图"');
  });

  it("renders link with optional title", () => {
    const md = '[官网](https://example.com "Example Site")';
    const html = parseMarkdown(md, "default");

    expect(html).toContain("<a ");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('title="Example Site"');
  });
});
