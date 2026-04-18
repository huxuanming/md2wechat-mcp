export type Theme = {
  article: string;
  h1: string;
  h2: string;
  h3: string;
  p: string;
  li: string;
  blockquote: string;
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
};

export type FontSizePreset = "small" | "medium" | "large";

export const THEMES: Record<string, Theme> = {
  default: {
    article: "max-width: 860px; margin: 0 auto; color: #1f2329; font-size: 16px; line-height: 1.8;",
    h1: "font-size: 22px; line-height: 1.35; margin: 1.3em 0 0.7em; color: #102a43;",
    h2: "font-size: 18px; line-height: 1.4; margin: 1.2em 0 0.65em; color: #16324f; border-left: 4px solid #1f6feb; padding-left: 10px;",
    h3: "font-size: 16px; line-height: 1.45; margin: 1.1em 0 0.55em; color: #1f4b7a;",
    p: "margin: 0.85em 0;",
    li: "margin: 0.35em 0;",
    blockquote: "margin: 1em 0; padding: 0.8em 1em; color: #35495e; background: #f4f8ff; border-left: 4px solid #81a8d8;",
    code_inline: "font-family: Menlo, Consolas, monospace; font-size: 0.92em; background: #f2f4f8; padding: 0.1em 0.34em; border-radius: 4px;",
    pre: "margin: 1em 0; padding: 1em; background: #0b1f35; color: #eaf2ff; border-radius: 8px; overflow-x: auto; line-height: 1.6;",
    hr: "border: none; border-top: 1px solid #d0d7de; margin: 1.2em 0;",
    a: "color: #0969da; text-decoration: none; border-bottom: 1px solid #9cc1ea;",
    strong: "font-weight: 700; color: #0f3b66;",
    em: "font-style: italic; color: #2f5f8f;",
    table: "width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 0.95em;",
    thead: "",
    tbody: "",
    th: "border: 1px solid #d0d7de; padding: 8px 10px; background: #f6f8fa; text-align: left; font-weight: 700;",
    td: "border: 1px solid #d0d7de; padding: 8px 10px; text-align: left; vertical-align: top;"
  },
  tech: {
    article: "max-width: 860px; margin: 0 auto; color: #0f172a; font-size: 16px; line-height: 1.8;",
    h1: "font-size: 22px; line-height: 1.35; margin: 1.25em 0 0.68em; color: #111827;",
    h2: "font-size: 18px; line-height: 1.4; margin: 1.2em 0 0.62em; color: #111827; border-bottom: 2px solid #0ea5e9; padding-bottom: 4px;",
    h3: "font-size: 16px; line-height: 1.45; margin: 1.1em 0 0.52em; color: #0f172a;",
    p: "margin: 0.82em 0;",
    li: "margin: 0.32em 0;",
    blockquote: "margin: 1em 0; padding: 0.8em 1em; color: #0f172a; background: #f8fafc; border-left: 4px solid #38bdf8;",
    code_inline: "font-family: Menlo, Consolas, monospace; font-size: 0.92em; background: #eef2ff; color: #1e3a8a; padding: 0.1em 0.34em; border-radius: 4px;",
    pre: "margin: 1em 0; padding: 1em; background: #0f172a; color: #dbeafe; border-radius: 8px; overflow-x: auto; line-height: 1.58;",
    hr: "border: none; border-top: 1px solid #cbd5e1; margin: 1.15em 0;",
    a: "color: #0369a1; text-decoration: none; border-bottom: 1px solid #7dd3fc;",
    strong: "font-weight: 700; color: #1d4ed8;",
    em: "font-style: italic; color: #0c4a6e;",
    table: "width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 0.95em;",
    thead: "",
    tbody: "",
    th: "border: 1px solid #cbd5e1; padding: 8px 10px; background: #f8fafc; text-align: left; font-weight: 700;",
    td: "border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; vertical-align: top;"
  },
  warm: {
    article: "max-width: 860px; margin: 0 auto; color: #3b2f2f; font-size: 16px; line-height: 1.82;",
    h1: "font-size: 22px; line-height: 1.35; margin: 1.3em 0 0.7em; color: #5f2d1b;",
    h2: "font-size: 18px; line-height: 1.42; margin: 1.2em 0 0.64em; color: #7a3118; border-left: 4px solid #d97706; padding-left: 10px;",
    h3: "font-size: 16px; line-height: 1.46; margin: 1.1em 0 0.55em; color: #8a3d1f;",
    p: "margin: 0.86em 0;",
    li: "margin: 0.36em 0;",
    blockquote: "margin: 1em 0; padding: 0.8em 1em; color: #5c4033; background: #fff8ef; border-left: 4px solid #f59e0b;",
    code_inline: "font-family: Menlo, Consolas, monospace; font-size: 0.92em; background: #fff3e0; color: #7c2d12; padding: 0.1em 0.34em; border-radius: 4px;",
    pre: "margin: 1em 0; padding: 1em; background: #402217; color: #fdecd6; border-radius: 8px; overflow-x: auto; line-height: 1.6;",
    hr: "border: none; border-top: 1px solid #f3d3b0; margin: 1.2em 0;",
    a: "color: #b45309; text-decoration: none; border-bottom: 1px solid #f2b874;",
    strong: "font-weight: 700; color: #9a3412;",
    em: "font-style: italic; color: #92400e;",
    table: "width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 0.95em;",
    thead: "",
    tbody: "",
    th: "border: 1px solid #f3d3b0; padding: 8px 10px; background: #fff8ef; text-align: left; font-weight: 700;",
    td: "border: 1px solid #f3d3b0; padding: 8px 10px; text-align: left; vertical-align: top;"
  },
  apple: {
    article: "max-width: 820px; margin: 0 auto; color: #1d1d1f; font-size: 17px; line-height: 1.82; letter-spacing: 0.01em;",
    h1: "font-size: 22px; line-height: 1.28; margin: 1.35em 0 0.72em; color: #1d1d1f; font-weight: 700;",
    h2: "font-size: 18px; line-height: 1.35; margin: 1.25em 0 0.66em; color: #1d1d1f; font-weight: 650;",
    h3: "font-size: 16px; line-height: 1.42; margin: 1.15em 0 0.58em; color: #2c2c2e; font-weight: 600;",
    p: "margin: 0.95em 0;",
    li: "margin: 0.42em 0;",
    blockquote: "margin: 1.05em 0; padding: 0.9em 1.05em; color: #3a3a3c; background: #f5f5f7; border-left: 3px solid #d2d2d7; border-radius: 8px;",
    code_inline: "font-family: SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.91em; background: #f2f2f5; color: #1f1f22; padding: 0.1em 0.34em; border-radius: 5px;",
    pre: "margin: 1.05em 0; padding: 1.02em; background: #1c1c1e; color: #f5f5f7; border-radius: 10px; overflow-x: auto; line-height: 1.6;",
    hr: "border: none; border-top: 1px solid #e5e5ea; margin: 1.35em 0;",
    a: "color: #0066cc; text-decoration: none;",
    strong: "font-weight: 700; color: #1d1d1f;",
    em: "font-style: italic; color: #3a3a3c;",
    table: "width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 0.95em;",
    thead: "",
    tbody: "",
    th: "border: 1px solid #e5e5ea; padding: 8px 10px; background: #f5f5f7; text-align: left; font-weight: 700;",
    td: "border: 1px solid #e5e5ea; padding: 8px 10px; text-align: left; vertical-align: top;"
  },
  "wechat-native": {
    article:
      "max-width: 680px; margin: 0 auto; width: 100%; box-sizing: border-box; background-color: #ffffff; border-radius: 12px; padding: 16px; color: #333333; font-size: 15px; line-height: 1.75; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;",
    h1:
      "display: block; font-size: 22px; font-weight: 700; color: #163325; line-height: 1.32; margin: 36px 0 16px; letter-spacing: -0.015em; padding: 12px 16px 10px; background: linear-gradient(180deg, rgba(7,193,96,0.08) 0%, rgba(7,193,96,0.03) 100%); border-left: 5px solid #07c160; border-bottom: 1px dashed rgba(22,51,37,0.2); border-radius: 12px; box-shadow: 0 6px 14px rgba(7,193,96,0.05);",
    h2:
      "display: block; font-size: 18px; font-weight: 700; color: #067647; line-height: 1.4; margin: 34px 0 18px; padding: 10px 14px; background: linear-gradient(90deg, rgba(7,193,96,0.12) 0%, rgba(7,193,96,0.03) 70%, rgba(7,193,96,0) 100%); border-left: 4px solid #07c160; border-radius: 12px;",
    h3: "display: block; font-size: 16px; font-weight: 700; color: #0a6c44; line-height: 1.42; margin: 28px 0 14px; padding-left: 10px; border-left: 3px solid rgba(7,193,96,0.5);",
    p: "margin: 18px 0; line-height: 1.75; color: #333333;",
    li: "margin: 0.36em 0; color: #333333;",
    blockquote: "margin: 1.1em 0; padding: 0.85em 1em; color: #214737; background: #f3fbf7; border-left: 4px solid #07c160; border-radius: 8px;",
    code_inline: "font-family: 'SF Mono', Menlo, Consolas, monospace; padding: 3px 6px; background-color: #f0f7f2; color: #07c160; border-radius: 4px; font-size: 12px; line-height: 1.5;",
    pre: "margin: 1.05em 0; padding: 1em; background: #0f2d1f; color: #ecfff4; border-radius: 8px; overflow-x: auto; line-height: 1.6;",
    hr: "margin: 36px auto; border: none; height: 2px; width: 62%; background: linear-gradient(90deg, rgba(7,193,96,0) 0%, rgba(7,193,96,0.22) 20%, rgba(7,193,96,0.68) 50%, rgba(7,193,96,0.22) 80%, rgba(7,193,96,0) 100%);",
    a: "color: #067647; text-decoration: none; border-bottom: 1px solid rgba(7,193,96,0.45);",
    strong: "font-weight: 700; color: #067647; background: linear-gradient(180deg, rgba(7,193,96,0) 0%, rgba(7,193,96,0) 58%, rgba(7,193,96,0.16) 58%, rgba(7,193,96,0.16) 100%); padding: 0 3px;",
    em: "font-style: italic; color: #666666;",
    table: "width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 0.95em;",
    thead: "",
    tbody: "",
    th: "border: 1px solid #cde8db; padding: 8px 10px; background: #f3fbf7; text-align: left; font-weight: 700; color: #067647;",
    td: "border: 1px solid #cde8db; padding: 8px 10px; text-align: left; vertical-align: top;"
  }
};

export const THEME_NAMES = Object.keys(THEMES);

const FONT_SIZE_FACTORS: Record<FontSizePreset, number> = {
  small: 0.9,
  medium: 1,
  large: 1.1
};

function formatScaledNumber(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/\.?0+$/u, "");
}

function scaleFontSizeInStyle(style: string, factor: number): string {
  return style.replace(/font-size:\s*([0-9]*\.?[0-9]+)(px|em|rem)/giu, (_match, numText: string, unit: string) => {
    const num = Number(numText);
    if (!Number.isFinite(num)) {
      return `font-size: ${numText}${unit}`;
    }
    return `font-size: ${formatScaledNumber(num * factor)}${unit}`;
  });
}

export function resolveTheme(themeName: string, fontSizePreset: FontSizePreset = "medium"): Theme {
  const base = THEMES[themeName] ?? THEMES.default;
  const factor = FONT_SIZE_FACTORS[fontSizePreset] ?? 1;
  if (factor === 1) {
    return base;
  }

  return Object.fromEntries(Object.entries(base).map(([key, value]) => [key, scaleFontSizeInStyle(value, factor)])) as Theme;
}
