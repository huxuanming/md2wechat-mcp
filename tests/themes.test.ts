import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../src/markdown.js";
import { THEME_METADATA, THEME_NAMES, THEMES, resolveTheme } from "../src/themes.js";

const root = resolve(import.meta.dirname, "..");
const themesDir = resolve(root, "assets", "themes");
const classicNames = ["default", "tech", "warm", "apple", "wechat-native"];

function readThemeJson(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(themesDir, `${name}.json`), "utf8")) as Record<string, unknown>;
}

function escapeText(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function extractSolidHex(style: string, property: "background" | "color"): string | undefined {
  return style.match(new RegExp(`(?:^|;)\\s*${property}:\\s*(#[0-9a-f]{6})\\b`, "iu"))?.[1];
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("theme registry", () => {
  it("loads every theme from the unified JSON directory", () => {
    const jsonNames = readdirSync(themesDir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => name.replace(/\.json$/u, ""))
      .sort();

    expect(jsonNames).toHaveLength(20);
    expect([...THEME_NAMES].sort()).toEqual(jsonNames);
    expect(Object.keys(THEMES).sort()).toEqual(jsonNames);
  });

  it("provides a unique Chinese display name for every English theme name", () => {
    const displayNames = new Set<string>();
    for (const metadata of THEME_METADATA) {
      const data = readThemeJson(metadata.name);
      expect(metadata.display_name.trim().length).toBeGreaterThan(0);
      expect(data.display_name).toBe(metadata.display_name);
      displayNames.add(metadata.display_name);
    }
    expect(displayNames.size).toBe(THEME_METADATA.length);
  });

  it("keeps all classic names and marks them as classic themes", () => {
    expect(THEME_NAMES.slice(0, classicNames.length)).toEqual(classicNames);
    for (const name of classicNames) {
      expect(THEME_METADATA.find((theme) => theme.name === name)?.source).toBe("classic");
      expect(readThemeJson(name).source).toBe("classic");
    }
  });

  it("gives every classic theme a complete and distinct visual language", () => {
    const dividerTexts = new Set<string>();
    const listLabels = new Set<string>();

    for (const name of classicNames) {
      const data = readThemeJson(name);
      const styles = data.styles as Record<string, string>;
      const highlights = data.highlights as Record<string, string>;
      const listStyle = data.list_style as Record<string, string>;

      expect(Object.keys(styles)).toEqual(expect.arrayContaining(["body", "h1", "h2", "h3", "p", "blockquote", "img", "code_block", "ul", "ol", "li", "table", "th", "td", "section_divider"]));
      expect(Object.keys(highlights)).toEqual(expect.arrayContaining(["hl_yellow", "hl_blue", "hl_pink", "hl_green", "em_red", "em_blue", "em_orange"]));
      expect(Object.keys(listStyle)).toEqual(expect.arrayContaining(["label", "num_container", "num_formatter", "bullet_container", "bullet_char"]));
      dividerTexts.add(String(data.section_divider_text));
      listLabels.add(String(listStyle.label));
    }

    expect(dividerTexts.size).toBe(classicNames.length);
    expect(listLabels.size).toBe(classicNames.length);
  });

  it("renders the complete semantic sample with every theme", () => {
    const markdown = [
      "## 标题",
      "",
      "==黄色== ++蓝色++ %%粉色%% &&绿色&& !!红色!! @@蓝色强调@@ ^^橙色^^",
      "",
      "1. 第一项",
      "2. 第二项",
      "",
      "- 无序项",
      "",
      "[SEC]",
      "",
      "![图片](https://example.com/theme.jpg)",
      "",
      "| 列一 | 列二 |",
      "| --- | --- |",
      "| A | B |"
    ].join("\n");

    for (const metadata of THEME_METADATA) {
      const theme = THEMES[metadata.name];
      const html = parseMarkdown(markdown, metadata.name);
      expect(html).toContain(escapeText(theme.section_divider_text));
      expect(html).toContain(`style="${theme.list_style.bullet_container}"`);
      if (theme.list_style.bullet_char) {
        expect(html).toContain(`>${escapeText(theme.list_style.bullet_char)}</span>`);
      }
      expect(html).toContain(theme.img);
      expect(html).toContain("<table");
      expect(html).not.toContain("==黄色==");
      expect(html).not.toContain("!!红色!!");
    }
  });

  it("keeps every theme image style free of shadows, borders and spacing", () => {
    for (const metadata of THEME_METADATA) {
      const imageStyle = resolveTheme(metadata.name).img;
      expect(imageStyle).toContain("max-width: 100%");
      expect(imageStyle).toContain("height: auto");
      expect(imageStyle).toContain("display: block");
      expect(imageStyle).not.toMatch(/(?:^|;)\s*(?:border|margin|border-radius|box-shadow)\s*:/u);
    }
  });

  it("adds safe horizontal padding and complete classic code typography", () => {
    for (const metadata of THEME_METADATA) {
      expect(resolveTheme(metadata.name).article).toContain("padding-left: 18px; padding-right: 18px;");
    }

    for (const name of classicNames) {
      const preStyle = resolveTheme(name).pre;
      expect(preStyle).toContain("font-family: 'SFMono-Regular', Menlo, Consolas, monospace;");
      expect(preStyle).toContain("font-size: 12.5px;");
    }
  });

  it("enforces readable minimum sizes for the small preset", () => {
    expect(resolveTheme("magazine-grid", "small").h2).toContain("font-size: 14px");
    expect(resolveTheme("minimal-bw", "small").h2).toContain("font-size: 14px");
    expect(resolveTheme("minimal-mono", "small").article).toContain("font-size: 14px");
    expect(resolveTheme("refined-blue", "small").pre).toContain("font-size: 12px");
  });

  it("scales fixed list badge metrics together with large text", () => {
    const listStyle = resolveTheme("mint-fresh", "large").list_style.num_container;
    expect(listStyle).toContain("font-size: 12.1px");
    expect(listStyle).toContain("min-width: 30.8px");
    expect(listStyle).toContain("height: 22px");
    expect(listStyle).toContain("line-height: 22px");
    expect(listStyle).toContain("border-radius: 11px");
  });

  it("keeps solid table, highlight and list-badge colors at accessible contrast", () => {
    for (const metadata of THEME_METADATA) {
      const theme = resolveTheme(metadata.name);
      const surfaces: Array<[string, string]> = [
        ["table header", theme.th],
        ["number badge", theme.list_style.num_container],
        ...Object.entries(theme.highlights)
      ];

      for (const [surfaceName, style] of surfaces) {
        const foreground = extractSolidHex(style, "color");
        const background = extractSolidHex(style, "background");
        if (foreground && background) {
          expect(
            contrastRatio(foreground, background),
            `${metadata.name} ${surfaceName}: ${foreground} on ${background}`
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

});
