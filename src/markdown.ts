import { THEMES, type Theme } from "./themes.js";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function inlineFormat(text: string, theme: Theme): string {
  const placeholders = new Map<string, string>();

  const stash = (val: string): string => {
    const key = `@@P${placeholders.size}@@`;
    placeholders.set(key, val);
    return key;
  };

  let escaped = escapeHtml(text);

  escaped = escaped.replace(/`([^`]+)`/g, (_, code: string) => {
    return stash(`<code style=\"${theme.code_inline}\">${code}</code>`);
  });

  escaped = escaped.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label: string, href: string) => {
    return `<a href=\"${href}\" style=\"${theme.a}\">${label}</a>`;
  });

  escaped = escaped.replace(/\*\*([^*]+)\*\*/g, (_m, content: string) => {
    return `<strong style=\"${theme.strong}\">${content}</strong>`;
  });

  escaped = escaped.replace(/\*([^*]+)\*/g, (_m, content: string) => {
    return `<em style=\"${theme.em}\">${content}</em>`;
  });

  for (const [key, value] of placeholders) {
    escaped = escaped.replaceAll(key, value);
  }

  return escaped;
}

export function parseMarkdown(md: string, themeName = "default", title?: string): string {
  const theme = THEMES[themeName] ?? THEMES.default;
  const lines = md.replaceAll("\r\n", "\n").split("\n");

  const out: string[] = [];
  if (title) {
    out.push(`<h1 style=\"${theme.h1}\">${inlineFormat(title, theme)}</h1>`);
  }

  let inCode = false;
  let codeLang = "";
  let codeLines: string[] = [];

  let listType: "ul" | "ol" | undefined;
  let listItems: string[] = [];

  let paragraphBuffer: string[] = [];

  const flushParagraph = (): void => {
    if (paragraphBuffer.length > 0) {
      const text = paragraphBuffer.map((part) => part.trim()).join(" ").trim();
      if (text) {
        out.push(`<p style=\"${theme.p}\">${inlineFormat(text, theme)}</p>`);
      }
    }
    paragraphBuffer = [];
  };

  const flushList = (): void => {
    if (listType && listItems.length > 0) {
      const renderedItems = listItems.map((item) => `<li style=\"${theme.li}\">${item}</li>`).join("");
      out.push(`<${listType} style=\"margin: 0.6em 0 0.9em 1.2em; padding: 0;\">${renderedItems}</${listType}>`);
    }
    listType = undefined;
    listItems = [];
  };

  const flushCode = (): void => {
    if (inCode) {
      const langHeader = codeLang
        ? `<div style=\"opacity: 0.75; margin-bottom: 0.55em;\">${escapeHtml(codeLang)}</div>`
        : "";
      const codeBody = codeLines.join("\n");
      out.push(`<pre style=\"${theme.pre}\">${langHeader}<code>${escapeHtml(codeBody)}</code></pre>`);
    }
    inCode = false;
    codeLang = "";
    codeLines = [];
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/u, "");

    const codeFence = line.match(/^```(.*)$/u);
    if (codeFence) {
      if (inCode) {
        flushCode();
      } else {
        flushParagraph();
        flushList();
        inCode = true;
        codeLang = codeFence[1]?.trim() ?? "";
      }
      continue;
    }

    if (inCode) {
      codeLines.push(raw);
      continue;
    }

    if (/^\s*$/u.test(line)) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/u);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      const text = heading[2].trim();
      const styleMap: Record<number, "h1" | "h2" | "h3"> = {
        1: "h1",
        2: "h2",
        3: "h3",
        4: "h3",
        5: "h3",
        6: "h3"
      };
      const styleKey = styleMap[level] ?? "h3";
      out.push(`<h${level} style=\"${theme[styleKey]}\">${inlineFormat(text, theme)}</h${level}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,})$/u.test(line.trim())) {
      flushParagraph();
      flushList();
      out.push(`<hr style=\"${theme.hr}\" />`);
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/u);
    if (quote) {
      flushParagraph();
      flushList();
      out.push(`<blockquote style=\"${theme.blockquote}\">${inlineFormat(quote[1] ?? "", theme)}</blockquote>`);
      continue;
    }

    const ul = line.match(/^\s*[-*+]\s+(.+)$/u);
    if (ul) {
      flushParagraph();
      if (listType && listType !== "ul") {
        flushList();
      }
      listType = "ul";
      listItems.push(inlineFormat(ul[1], theme));
      continue;
    }

    const ol = line.match(/^\s*\d+\.\s+(.+)$/u);
    if (ol) {
      flushParagraph();
      if (listType && listType !== "ol") {
        flushList();
      }
      listType = "ol";
      listItems.push(inlineFormat(ol[1], theme));
      continue;
    }

    flushList();
    paragraphBuffer.push(line);
  }

  flushParagraph();
  flushList();
  if (inCode) {
    flushCode();
  }

  const body = out.join("\n");
  return `<article style=\"${theme.article}\">\n${body}\n</article>`;
}
