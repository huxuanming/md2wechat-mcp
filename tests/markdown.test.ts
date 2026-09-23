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

  it("uses bottom-only spacing for paragraphs", () => {
    const html = parseMarkdown("第一段\n\n第二段", "default");

    expect(html).toMatch(/<p style="margin: 0 0 [^;]+;/u);
    expect(html).not.toMatch(/<p style="margin: [^0][^;]* 0;/u);
  });

  it("centers ordinary paragraphs wrapped in center tags", () => {
    const html = parseMarkdown("<center>这是**居中**文字</center>", "default");

    expect(html).toContain("text-align: center;");
    expect(html).toContain("这是<strong");
    expect(html).not.toContain("&lt;center&gt;");
    expect(html).not.toContain("&lt;/center&gt;");
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

  it("renders a standalone image directly and uses its title as a caption", () => {
    const md = '![封面](https://example.com/a.jpg "封面图")';
    const html = parseMarkdown(md, "default");

    expect(html).toContain("<img");
    expect(html).toContain('src="https://example.com/a.jpg"');
    expect(html).toContain('title="封面图"');
    expect(html).toContain('text-align: center; text-indent: 0;');
    expect(html).toContain(">封面图</p>");
    expect(html).not.toMatch(/<p[^>]*>\s*<img/u);
  });

  it("does not create a caption for a standalone image without a title", () => {
    const html = parseMarkdown("![封面](https://example.com/a.jpg)", "default");

    expect(html).toContain("<img");
    expect(html).not.toContain("text-indent: 0;");
    expect(html).not.toMatch(/<p[^>]*>\s*<img/u);
  });


  it("renders consecutive comic images without theme spacing, borders or rounded corners", () => {
    const html = parseMarkdown(
      ["![第一格](https://example.com/1.jpg)", "![第二格](https://example.com/2.jpg)"].join("\n"),
      "minimal-mono"
    );

    expect(html.match(/<img\b/gu)).toHaveLength(2);
    expect(html).toMatch(/<img[^>]+1\.jpg[^>]*\/>\n<img[^>]+2\.jpg[^>]*\/>/u);
    const imageStyles = [...html.matchAll(/<img[^>]*style="([^"]*)"/gu)].map((match) => match[1] ?? "");
    expect(imageStyles).toHaveLength(2);
    for (const imageStyle of imageStyles) {
      expect(imageStyle).not.toMatch(/(?:^|;)\s*(?:border|margin|border-radius)\s*:/u);
    }
  });

  it("renders link with optional title", () => {
    const md = '[官网](https://example.com "Example Site")';
    const html = parseMarkdown(md, "default");

    expect(html).toContain("<a ");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('title="Example Site"');
  });

  it("renders inline hashtags as WeChat topic quick-inserts", () => {
    const html = parseMarkdown("今日分享 #搞笑漫画，欢迎留言。", "default");

    expect(html).toContain(
      '<span leaf=""><a class="wx_topic_link" data-topic="1" data-recommend="" href="javascript:;">#搞笑漫画</a> </span>'
    );
  });

  it("accepts a space between an inline topic marker and its name", () => {
    const html = parseMarkdown("今天聊聊 # 无厘头。", "default");

    expect(html).toContain('class="wx_topic_link"');
    expect(html).toContain('>#无厘头</a>');
  });

  it("keeps a line-start hash followed by a space as a heading", () => {
    const html = parseMarkdown("# 无厘头", "default");

    expect(html).toContain("<h1");
    expect(html).not.toContain('class="wx_topic_link"');
  });

  it("does not convert hashtags inside inline code", () => {
    const html = parseMarkdown("使用 `#搞笑漫画` 作为示例。", "default");

    expect(html).toContain('<code');
    expect(html).toContain('#搞笑漫画');
    expect(html).not.toContain('class="wx_topic_link"');
  });

  it("does not convert URL fragments into topics", () => {
    const html = parseMarkdown("[章节](https://example.com/article#section)", "default");

    expect(html).toContain('href="https://example.com/article#section"');
    expect(html).not.toContain('class="wx_topic_link"');
  });

  it("renders Chinese quoted blockquote lines", () => {
    const md = '> “我的车明明还有 30% 的电，怎么突然就报警停机了？”';
    const html = parseMarkdown(md, "default");

    expect(html).toContain("<blockquote");
    expect(html).toContain("我的车明明还有 30% 的电，怎么突然就报警停机了？");
  });
  it("renders publisher theme highlights, dividers, image styling and custom list tokens", () => {
    const md = [
      "==黄色高亮== ++蓝色高亮++ %%粉色高亮%% &&绿色高亮&&",
      "",
      "!!红色强调!! @@蓝色强调@@ ^^橙色强调^^",
      "",
      "[SEC]",
      "",
      "1. 第一项",
      "2. 第二项",
      "",
      "- 无序项",
      "",
      "![示例](https://example.com/theme.jpg)"
    ].join("\n");
    const html = parseMarkdown(md, "ink-wash");

    expect(html).toContain("山  水  间");
    expect(html).toContain("background: #8b2a1f");
    expect(html).toContain("一");
    expect(html).toContain("※");
    expect(html).toContain("https://example.com/theme.jpg");
    const imageStyle = html.match(/<img[^>]*style="([^"]*)"/u)?.[1] ?? "";
    expect(imageStyle).toContain("max-width: 100%; height: auto; display: block;");
    expect(imageStyle).not.toMatch(/(?:^|;)\s*(?:border|margin|border-radius)\s*:/u);
    expect(html).not.toContain("==黄色高亮==");
    expect(html).not.toContain("!!红色强调!!");
  });

  it("does not treat theme hex colors as WeChat topics", () => {
    const html = parseMarkdown("**重点** ==高亮== #真实话题", "ink-wash");

    expect(html).toContain("color: #8b2a1f");
    expect(html).toContain("background: #f4e7b8");
    expect(html.match(/class=\"wx_topic_link\"/g)).toHaveLength(1);
    expect(html).toContain(">#真实话题</a>");
  });

  it("keeps code spans isolated from publisher highlight markers", () => {
    const html = parseMarkdown("`==not highlighted==` 和 ==highlighted==", "refined-blue");

    expect(html).toContain(">==not highlighted==</code>");
    expect(html).toContain(">highlighted</span>");
  });

});
