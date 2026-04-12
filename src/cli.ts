#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Command } from "commander";
import { parseMarkdown } from "./markdown.js";
import { saveHtmlCache } from "./cache.js";
import { THEME_NAMES } from "./themes.js";

function validateTheme(theme: string): string {
  if (THEME_NAMES.includes(theme)) {
    return theme;
  }

  throw new Error(`Invalid theme: ${theme}. Available: ${[...THEME_NAMES].sort().join(", ")}`);
}

function validateFontSizePreset(value: string): "small" | "medium" | "large" {
  if (value === "small" || value === "medium" || value === "large") {
    return value;
  }
  throw new Error(`Invalid font size preset: ${value}. Available: small, medium, large`);
}

export async function main(argv: string[] = process.argv): Promise<number> {
  const program = new Command();
  program
    .name("md2wechat")
    .description("Convert Markdown to WeChat HTML.")
    .argument("<input>", "Input markdown file path")
    .option("--theme <theme>", "Rendering theme", "default")
    .option("--title <title>", "Optional title override")
    .option("--font-size-preset <preset>", "Font size preset: small | medium | large", "medium")
    .option("--out <path>", "Optional output html path; if omitted, use .cache/wechat-mcp")
    .option("--cache-dir <path>", "Override cache directory (or set WECHAT_MCP_CACHE_DIR).")
    .showHelpAfterError();

  program.parse(argv);

  const inputPath = resolve(program.args[0]);
  const markdown = readFileSync(inputPath, "utf8");
  const opts = program.opts<{ theme: string; title?: string; fontSizePreset: string; out?: string; cacheDir?: string }>();
  const theme = validateTheme(opts.theme);
  const fontSizePreset = validateFontSizePreset(opts.fontSizePreset);

  const html = parseMarkdown(markdown, theme, opts.title, fontSizePreset);

  let outputPath: string;
  if (opts.out) {
    outputPath = resolve(opts.out);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, html, "utf8");
  } else {
    outputPath = saveHtmlCache(html, dirname(inputPath), opts.cacheDir);
  }

  process.stdout.write(`Input: ${inputPath}\n`);
  process.stdout.write(`Theme: ${theme}\n`);
  process.stdout.write(`Font size preset: ${fontSizePreset}\n`);
  process.stdout.write(`Output: ${outputPath}\n`);
  return 0;
}

if (import.meta.url === `file://${realpathSync(process.argv[1])}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
