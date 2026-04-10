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

  // Images must be processed before links (pattern starts with `!`)
  escaped = escaped.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, (_m, alt: string, src: string) => {
    return stash(`<img src=\"${src}\" alt=\"${alt}\" style=\"max-width:100%;height:auto;display:block;margin:0.8em auto;\" />`);
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

function splitTableRow(line: string): string[] {
  const trimmed = line.trim();
  const normalized = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  return normalized.split("|").map((cell) => cell.trim());
}

function isTableSeparatorLine(line: string): boolean {
  const cells = splitTableRow(line);
  if (cells.length === 0) {
    return false;
  }
  return cells.every((cell) => /^:?-+:?$/u.test(cell));
}

function parseColumnAlignment(cell: string): "left" | "right" | "center" | null {
  const trimmed = cell.trim();
  const hasLeft = trimmed.startsWith(":");
  const hasRight = trimmed.endsWith(":");
  if (hasLeft && hasRight) return "center";
  if (hasRight) return "right";
  if (hasLeft) return "left";
  return null;
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
  let olStart = 1;
  let olNextExpected: number | undefined;

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
      if (listType === "ol") {
        const startAttr = olStart !== 1 ? ` start=\"${olStart}\"` : "";
        out.push(`<ol${startAttr} style=\"margin: 0.6em 0 0.9em 1.2em; padding: 0;\">${renderedItems}</ol>`);
        olNextExpected = olStart + listItems.length;
      } else {
        out.push(`<ul style=\"margin: 0.6em 0 0.9em 1.2em; padding: 0;\">${renderedItems}</ul>`);
        olNextExpected = undefined;
      }
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

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? "";
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

    const nextLineRaw = lines[i + 1];
    const nextLine = typeof nextLineRaw === "string" ? nextLineRaw.replace(/\s+$/u, "") : "";
    if (line.includes("|") && isTableSeparatorLine(nextLine)) {
      const headers = splitTableRow(line);
      const sepCells = splitTableRow(nextLine);
      if (headers.length === sepCells.length) {
        flushParagraph();
        flushList();

        const alignments = sepCells.map(parseColumnAlignment);
        const rows: string[][] = [];
        i += 2;
        while (i < lines.length) {
          const rowRaw = lines[i] ?? "";
          const rowLine = rowRaw.replace(/\s+$/u, "");
          if (!rowLine.trim() || !rowLine.includes("|")) {
            i -= 1;
            break;
          }
          rows.push(splitTableRow(rowLine));
          i += 1;
        }

        const headerHtml = headers
          .map((header, index) => {
            const align = alignments[index];
            const style = align ? `${theme.th} text-align: ${align};` : theme.th;
            return `<th style=\"${style}\">${inlineFormat(header, theme)}</th>`;
          })
          .join("");

        const bodyHtml = rows
          .map((row) => {
            const cells = headers.map((_, index) => row[index] ?? "");
            const cellHtml = cells
              .map((cell, index) => {
                const align = alignments[index];
                const style = align ? `${theme.td} text-align: ${align};` : theme.td;
                return `<td style=\"${style}\">${inlineFormat(cell, theme)}</td>`;
              })
              .join("");
            return `<tr>${cellHtml}</tr>`;
          })
          .join("");

        out.push(
          `<table style=\"${theme.table}\"><thead style=\"${theme.thead}\"><tr>${headerHtml}</tr></thead><tbody style=\"${theme.tbody}\">${bodyHtml}</tbody></table>`
        );
        continue;
      }
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

    const ol = line.match(/^\s*(\d+)\.\s+(.+)$/u);
    if (ol) {
      flushParagraph();
      const itemNum = parseInt(ol[1], 10);
      if (listType && listType !== "ol") {
        flushList();
      }
      if (listType !== "ol") {
        // Starting a new ol group: check if this continues a previous flushed group
        if (olNextExpected !== undefined && itemNum === olNextExpected) {
          olStart = itemNum;
        } else {
          olStart = itemNum;
          olNextExpected = undefined;
        }
      }
      listType = "ol";
      listItems.push(inlineFormat(ol[2], theme));
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
