import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../src/markdown.js";
import { THEME_NAMES, resolveTheme } from "../src/themes.js";

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


  it("wraps adjacent comic images without display or intervening markup", () => {
    const html = parseMarkdown(
      ["![第一格](https://example.com/1.jpg)", "![第二格](https://example.com/2.jpg)"].join("\n"),
      "wechat-native"
    );

    expect(html.match(/<img\b/gu)).toHaveLength(2);
    expect(html).toMatch(/<div style="margin: 0; padding: 0; font-size: 0; line-height: 0;"><img[^>]+1\.jpg[^>]*\/><img[^>]+2\.jpg[^>]*\/><\/div>/u);
    expect(html).not.toMatch(/<img[^>]*box-shadow\s*:/u);
  });

  it("wraps 20 blank-line-separated comic pages in a single gapless group", () => {
    const pages = Array.from({ length: 20 }, (_, index) => `![第${index + 1}页](https://example.com/${index + 1}.jpg)`);
    const md = ["# 漫画标题", "", ...pages.flatMap((page) => [page, "   \t", ""])].join("\n");
    const html = parseMarkdown(md, "wechat-native");
    const group = html.match(/<div style="margin: 0; padding: 0; font-size: 0; line-height: 0;">(.*?)<\/div>/u);

    expect(html).toContain("<h1");
    expect(group).not.toBeNull();
    expect(group?.[1]?.match(/<img\b/gu)).toHaveLength(20);
    expect(html.match(/<img\b/gu)).toHaveLength(20);
    expect(html.match(/<div style="margin: 0; padding: 0; font-size: 0; line-height: 0;">/gu)).toHaveLength(1);
    expect(group?.[1]).not.toMatch(/<p\b|\/>\s+<img/u);
    expect(html).not.toMatch(/<p[^>]*>\s*<img/u);
  });

  it("stops groups at prose, headings, code fences and captioned images, then starts new groups", () => {
    const md = [
      "![A](https://example.com/a.jpg)", "", "![B](https://example.com/b.jpg)", "", "正文分界", "",
      "![C](https://example.com/c.jpg)", "![D](https://example.com/d.jpg)", "",
      "## 小标题", "", "```md", "![代码图片](https://example.com/code.jpg)", "```", "",
      "![单图](https://example.com/single.jpg)", "", '![图注](https://example.com/caption.jpg "保留图注")', "",
      "![E](https://example.com/e.jpg)", "", "![F](https://example.com/f.jpg)"
    ].join("\n");
    const html = parseMarkdown(md, "default");
    const groups = [...html.matchAll(/<div style="margin: 0; padding: 0; font-size: 0; line-height: 0;">(.*?)<\/div>/gu)];

    expect(groups).toHaveLength(3);
    expect(groups.map((group) => [...(group[1] ?? "").matchAll(/src="([^"]+)"/gu)].map((match) => match[1]))).toEqual([
      ["https://example.com/a.jpg", "https://example.com/b.jpg"],
      ["https://example.com/c.jpg", "https://example.com/d.jpg"],
      ["https://example.com/e.jpg", "https://example.com/f.jpg"]
    ]);
    expect(html).toMatch(/<\/div>\n<p[^>]*>正文分界<\/p>\n<div/u);
    expect(html).toContain("<h2");
    expect(html).toContain("<code>![代码图片](https://example.com/code.jpg)</code>");
    expect(html).toContain("保留图注</p>");
    expect(html).toMatch(/single\.jpg[^>]*\/>\n<img[^>]*caption\.jpg[^>]*\/>\n<p/u);
    expect(html).not.toMatch(/<p[^>]*>\s*<img/u);
  });

  it("keeps a lone final image standalone after blank lines", () => {
    const html = parseMarkdown("前文\n\n![末页](https://example.com/end.jpg)\r\n \r\n", "default");

    expect(html.match(/<img\b/gu)).toHaveLength(1);
    expect(html).not.toContain('<div style="margin: 0; padding: 0; font-size: 0; line-height: 0;">');
    expect(html).toMatch(/<p[^>]*>前文<\/p>\n<img/u);
  });

  it("handles CRLF and trailing blanks without skipping a following caption or paragraph", () => {
    const md = [
      "![甲](https://example.com/1.jpg)", " ", "![乙](https://example.com/2.jpg)", " ",
      '![图注](https://example.com/3.jpg "说明")', "", "末段"
    ].join("\r\n");
    const html = parseMarkdown(md, "default");

    expect(html.match(/<div style="margin: 0; padding: 0; font-size: 0; line-height: 0;">/gu)).toHaveLength(1);
    expect(html).toMatch(/2\.jpg[^>]*\/><\/div>\n<img[^>]*3\.jpg/u);
    expect(html).toContain("说明</p>");
    expect(html).toContain("末段</p>");
  });

  it("removes only img display declarations across every theme and image context", () => {
    const md = [
      "前文 ![内联](https://example.com/inline.jpg) 后文", "",
      "![单图](https://example.com/single.jpg)", "",
      '![有图注](https://example.com/caption.jpg "说明")', "",
      "![相邻一](https://example.com/1.jpg)", "![相邻二](https://example.com/2.jpg)", "",
      "| 列 |", "| --- |", "| ![表格](https://example.com/table.jpg) |"
    ].join("\n");
    for (const name of THEME_NAMES) {
      const theme = resolveTheme(name);
      const expectedImageStyle = theme.img.split(";").filter((declaration) => !/^\s*display\s*:/iu.test(declaration)).join(";");
      const html = parseMarkdown(md, name);
      const styles = [...html.matchAll(/<img[^>]*style="([^"]*)"/gu)].map((match) => match[1]);

      expect(styles, name).toHaveLength(6);
      for (const style of styles) {
        expect(style, name).toBe(expectedImageStyle);
        expect(style, name).not.toMatch(/(?:^|;)\s*display\s*:/iu);
      }
      expect(html, name).toContain(`<p style="${theme.p}">前文`);
      expect(html, name).toContain("后文</p>");
      expect(html, name).toContain("说明</p>");
      expect(html, name).toContain("<table");
    }
    expect(resolveTheme("wechat-native").h1).toContain("display: block;");
    expect(parseMarkdown("# 标题", "wechat-native")).toContain('style="display: block;');
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
    expect(imageStyle).toContain("max-width: 100%; height: auto;");
    expect(imageStyle).not.toMatch(/(?:^|;)\s*display\s*:/iu);
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
