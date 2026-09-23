import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export type FontSizePreset = "small" | "medium" | "large";

export type ThemeListStyle = {
  label: string;
  num_container: string;
  num_prefix: string;
  num_suffix: string;
  num_formatter: "decimal" | "padded" | "chinese" | "roman_upper" | "roman_lower" | "circled" | "circled_filled";
  bullet_container: string;
  bullet_char: string;
};

export type ThemeHighlights = {
  hl_yellow: string;
  hl_blue: string;
  hl_pink: string;
  hl_green: string;
  em_red: string;
  em_blue: string;
  em_orange: string;
};

export type Theme = {
  article: string;
  h1: string;
  h2: string;
  h3: string;
  p: string;
  ul: string;
  ol: string;
  li: string;
  blockquote: string;
  img: string;
  code_inline: string;
  pre: string;
  hr: string;
  a: string;
  strong: string;
  em: string;
  table: string;
  thead: string;
  tbody: string;
  th: string;
  td: string;
  section_divider: string;
  section_divider_text: string;
  highlights: ThemeHighlights;
  list_style: ThemeListStyle;
};

export type ThemeSource = "classic" | "wechat-publisher";

export type ThemeMetadata = {
  name: string;
  display_name: string;
  description: string;
  category: string;
  source: ThemeSource;
};

type ThemeJson = {
  theme_name: string;
  display_name: string;
  description: string;
  category?: string;
  source?: ThemeSource;
  styles: Record<string, string>;
  highlights: ThemeHighlights;
  section_divider_text: string;
  list_style: ThemeListStyle;
  code_colors?: Record<string, string>;
};

const REQUIRED_STYLE_KEYS = [
  "body",
  "h1",
  "h2",
  "h3",
  "p",
  "blockquote",
  "img",
  "strong",
  "em",
  "code_inline",
  "code_block",
  "ul",
  "ol",
  "li",
  "hr",
  "a",
  "table",
  "th",
  "td",
  "section_divider"
] as const;

const REQUIRED_HIGHLIGHT_KEYS: Array<keyof ThemeHighlights> = [
  "hl_yellow",
  "hl_blue",
  "hl_pink",
  "hl_green",
  "em_red",
  "em_blue",
  "em_orange"
];

const REQUIRED_LIST_STYLE_KEYS: Array<keyof ThemeListStyle> = [
  "label",
  "num_container",
  "num_prefix",
  "num_suffix",
  "num_formatter",
  "bullet_container",
  "bullet_char"
];

const THEME_ORDER = [
  "default",
  "tech",
  "warm",
  "apple",
  "wechat-native",
  "refined-blue",
  "business-navy",
  "sage-premium",
  "minimal-mono",
  "minimal-bw",
  "academic-paper",
  "news-bold",
  "warm-editorial",
  "ink-wash",
  "elegant-ink",
  "magazine-grid",
  "warm-orange",
  "mint-fresh",
  "sunset-coral",
  "girly-pink"
];

const PUBLISHER_CATEGORIES: Record<string, string> = {
  "academic-paper": "学术 / 研究",
  "business-navy": "商业 / 投研",
  "elegant-ink": "人文 / 深度",
  "girly-pink": "时尚 / 情感",
  "ink-wash": "传统文化 / 随笔",
  "magazine-grid": "杂志 / 专题",
  "minimal-bw": "极简 / 观点",
  "minimal-mono": "技术 / 工程",
  "mint-fresh": "生活 / 轻话题",
  "news-bold": "新闻 / 热点",
  "refined-blue": "AI / 产品 / 深度",
  "sage-premium": "研究 / 数据分析",
  "sunset-coral": "热点 / 榜单 / 潮流",
  "warm-editorial": "观点 / 随笔",
  "warm-orange": "生活 / 美食 / 旅行"
};

function requireString(value: unknown, field: string, filePath: string): string {
  if (typeof value !== "string") {
    throw new Error(`Invalid theme JSON ${filePath}: ${field} must be a string.`);
  }
  return value;
}

function validateThemeJson(value: unknown, filePath: string): ThemeJson {
  if (!value || typeof value !== "object") {
    throw new Error(`Invalid theme JSON ${filePath}: root must be an object.`);
  }

  const parsed = value as Partial<ThemeJson>;
  requireString(parsed.theme_name, "theme_name", filePath);
  requireString(parsed.display_name, "display_name", filePath);
  requireString(parsed.description, "description", filePath);
  requireString(parsed.section_divider_text, "section_divider_text", filePath);

  if (!parsed.styles || typeof parsed.styles !== "object") {
    throw new Error(`Invalid theme JSON ${filePath}: styles must be an object.`);
  }
  for (const key of REQUIRED_STYLE_KEYS) {
    requireString(parsed.styles[key], `styles.${key}`, filePath);
  }

  if (!parsed.highlights || typeof parsed.highlights !== "object") {
    throw new Error(`Invalid theme JSON ${filePath}: highlights must be an object.`);
  }
  for (const key of REQUIRED_HIGHLIGHT_KEYS) {
    requireString(parsed.highlights[key], `highlights.${key}`, filePath);
  }

  if (!parsed.list_style || typeof parsed.list_style !== "object") {
    throw new Error(`Invalid theme JSON ${filePath}: list_style must be an object.`);
  }
  for (const key of REQUIRED_LIST_STYLE_KEYS) {
    requireString(parsed.list_style[key], `list_style.${key}`, filePath);
  }

  const validNumberFormats: ThemeListStyle["num_formatter"][] = [
    "decimal",
    "padded",
    "chinese",
    "roman_upper",
    "roman_lower",
    "circled",
    "circled_filled"
  ];
  if (!validNumberFormats.includes(parsed.list_style.num_formatter)) {
    throw new Error(`Invalid theme JSON ${filePath}: unsupported list_style.num_formatter.`);
  }

  if (parsed.source !== undefined && parsed.source !== "classic" && parsed.source !== "wechat-publisher") {
    throw new Error(`Invalid theme JSON ${filePath}: unsupported source ${String(parsed.source)}.`);
  }

  return parsed as ThemeJson;
}

function normalizeArticleStyle(style: string): string {
  return `max-width: 680px; width: 100%; margin: 0 auto; box-sizing: border-box; overflow-wrap: break-word; ${style} padding-left: 18px; padding-right: 18px;`;
}

function hasCssProperty(style: string, property: string): boolean {
  return new RegExp(`(?:^|;)\\s*${property}\\s*:`, "iu").test(style);
}

function normalizeCodeBlockStyle(style: string): string {
  const normalizedWhitespace = style.replace(/white-space:\s*pre(?:-wrap)?;/giu, "");
  const fontFamily = hasCssProperty(normalizedWhitespace, "font-family")
    ? ""
    : " font-family: 'SFMono-Regular', Menlo, Consolas, monospace;";
  const fontSize = hasCssProperty(normalizedWhitespace, "font-size") ? "" : " font-size: 12.5px;";
  return `${normalizedWhitespace}${fontFamily}${fontSize} white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; box-sizing: border-box; max-width: 100%;`;
}

function normalizeTableStyle(style: string): string {
  return `${style} max-width: 100%; box-sizing: border-box;`;
}

function adaptTheme(theme: ThemeJson): Theme {
  const styles = theme.styles;
  return {
    article: normalizeArticleStyle(styles.body),
    h1: styles.h1,
    h2: styles.h2,
    h3: styles.h3,
    p: styles.p,
    ul: styles.ul,
    ol: styles.ol,
    li: styles.li,
    blockquote: styles.blockquote,
    img: styles.img,
    code_inline: styles.code_inline,
    pre: normalizeCodeBlockStyle(styles.code_block),
    hr: styles.hr,
    a: styles.a,
    strong: styles.strong,
    em: styles.em,
    table: normalizeTableStyle(styles.table),
    thead: "",
    tbody: "",
    th: styles.th,
    td: styles.td,
    section_divider: styles.section_divider,
    section_divider_text: theme.section_divider_text,
    highlights: { ...theme.highlights },
    list_style: { ...theme.list_style }
  };
}

function loadThemes(): { themes: Record<string, Theme>; metadata: ThemeMetadata[] } {
  const themesDir = fileURLToPath(new URL("../assets/themes/", import.meta.url));
  const loaded = readdirSync(themesDir)
    .filter((name) => name.endsWith(".json"))
    .map((fileName) => {
      const filePath = join(themesDir, fileName);
      const parsed = validateThemeJson(JSON.parse(readFileSync(filePath, "utf8")) as unknown, filePath);
      const expectedName = fileName.replace(/\.json$/u, "");
      if (parsed.theme_name !== expectedName) {
        throw new Error(`Invalid theme JSON ${filePath}: theme_name must match file name ${expectedName}.`);
      }
      return parsed;
    });

  const orderIndex = new Map(THEME_ORDER.map((name, index) => [name, index]));
  loaded.sort((a, b) => {
    const aIndex = orderIndex.get(a.theme_name) ?? Number.MAX_SAFE_INTEGER;
    const bIndex = orderIndex.get(b.theme_name) ?? Number.MAX_SAFE_INTEGER;
    return aIndex - bIndex || a.theme_name.localeCompare(b.theme_name);
  });

  const themes: Record<string, Theme> = {};
  const metadata: ThemeMetadata[] = [];
  for (const theme of loaded) {
    if (themes[theme.theme_name]) {
      throw new Error(`Duplicate theme name: ${theme.theme_name}`);
    }
    const source = theme.source ?? "wechat-publisher";
    themes[theme.theme_name] = adaptTheme(theme);
    metadata.push({
      name: theme.theme_name,
      display_name: theme.display_name,
      description: theme.description,
      category: theme.category ?? PUBLISHER_CATEGORIES[theme.theme_name] ?? "其他",
      source
    });
  }

  if (!themes.default) {
    throw new Error("Theme registry must include assets/themes/default.json.");
  }

  return { themes, metadata };
}

const loadedThemes = loadThemes();

export const THEMES: Record<string, Theme> = loadedThemes.themes;
export const THEME_METADATA: ThemeMetadata[] = loadedThemes.metadata;
export const THEME_NAMES = THEME_METADATA.map((theme) => theme.name);

const FONT_SIZE_FACTORS: Record<FontSizePreset, number> = {
  small: 0.9,
  medium: 1,
  large: 1.1
};

function formatScaledNumber(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/\.?0+$/u, "");
}

const MINIMUM_FONT_SIZES_PX: Partial<Record<keyof Theme, number>> = {
  article: 14,
  h1: 22,
  h2: 14,
  h3: 13,
  p: 14,
  li: 14,
  blockquote: 14,
  code_inline: 12,
  pre: 12,
  th: 12,
  td: 12
};

function scaleFontSizeInStyle(style: string, factor: number, minimumPx = 0): string {
  return style.replace(/font-size:\s*([0-9]*\.?[0-9]+)(px|em|rem)/giu, (_match, numText: string, unit: string) => {
    const num = Number(numText);
    if (!Number.isFinite(num)) {
      return `font-size: ${numText}${unit}`;
    }
    const scaled = unit.toLowerCase() === "px" ? Math.max(num * factor, minimumPx) : num * factor;
    return `font-size: ${formatScaledNumber(scaled)}${unit}`;
  });
}

function scalePixelLengths(value: string, factor: number): string {
  return value.replace(/([0-9]*\.?[0-9]+)px/giu, (_match, numText: string) => {
    const num = Number(numText);
    return Number.isFinite(num) ? `${formatScaledNumber(num * factor)}px` : `${numText}px`;
  });
}

function scaleListTokenStyle(style: string, factor: number): string {
  const withScaledFont = scaleFontSizeInStyle(style, factor);
  return withScaledFont.replace(
    /(min-width|width|height|line-height|padding(?:-(?:top|right|bottom|left))?|border-radius|margin-right):\s*([^;]+);/giu,
    (_match, property: string, value: string) => `${property}: ${scalePixelLengths(value, factor)};`
  );
}

export function resolveTheme(themeName: string, fontSizePreset: FontSizePreset = "medium"): Theme {
  const base = THEMES[themeName] ?? THEMES.default;
  const factor = FONT_SIZE_FACTORS[fontSizePreset] ?? 1;

  const scaledStyles = Object.fromEntries(
    Object.entries(base).map(([key, value]) => {
      const minimumPx = MINIMUM_FONT_SIZES_PX[key as keyof Theme] ?? 0;
      return [key, typeof value === "string" ? scaleFontSizeInStyle(value, factor, minimumPx) : value];
    })
  ) as unknown as Theme;

  scaledStyles.highlights = Object.fromEntries(
    Object.entries(base.highlights).map(([key, value]) => [key, scaleFontSizeInStyle(value, factor)])
  ) as ThemeHighlights;
  scaledStyles.list_style = {
    ...base.list_style,
    num_container: scaleListTokenStyle(base.list_style.num_container, factor),
    bullet_container: scaleListTokenStyle(base.list_style.bullet_container, factor)
  };
  return scaledStyles;
}
