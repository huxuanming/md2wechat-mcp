import { resolveTheme, type FontSizePreset, type Theme } from "./themes.js";

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
    const key = `\uE000${placeholders.size}\uE001`;
    placeholders.set(key, val);
    return key;
  };

  let escaped = escapeHtml(text);

  escaped = escaped.replace(/`([^`]+)`/g, (_, code: string) => {
    return stash(`<code style=\"${theme.code_inline}\">${code}</code>`);
  });

  // Images must be processed before links (pattern starts with `!`)
  escaped = escaped.replace(
    /!\[([^\]]*)\]\(((?:https?:\/\/|file:\/\/|\/|\.\.?\/)[^\s)]+)(?:\s+(?:"([^"]+)"|'([^']+)'|&quot;([^&]+)&quot;|&#39;([^&]+)&#39;))?\)/g,
    (_m, alt: string, src: string, t1?: string, t2?: string, t3?: string, t4?: string) => {
      const title = t1 ?? t2 ?? t3 ?? t4;
      const titleAttr = title ? ` title=\"${title}\"` : "";
      return stash(`<img src=\"${src}\" alt=\"${alt}\"${titleAttr} style=\"${theme.img}\" />`);
    }
  );

  escaped = escaped.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)(?:\s+(?:"([^"]+)"|'([^']+)'|&quot;([^&]+)&quot;|&#39;([^&]+)&#39;))?\)/g,
    (_m, label: string, href: string, t1?: string, t2?: string, t3?: string, t4?: string) => {
      const title = t1 ?? t2 ?? t3 ?? t4;
      const titleAttr = title ? ` title=\"${title}\"` : "";
      return stash(`<a href=\"${href}\"${titleAttr} style=\"${theme.a}\">${label}</a>`);
    }
  );

  // Convert user-authored topics before injecting styled markup. Otherwise hex
  // colors inside generated style attributes (for example #1a1a1a) can be
  // mistaken for topics and corrupt the HTML.
  escaped = escaped.replace(
    /(^|[^\p{L}\p{N}_#-])#\s*([\p{L}\p{N}_-]+)/gu,
    (_m, prefix: string, topic: string) =>
      `${prefix}<span leaf=\"\"><a class=\"wx_topic_link\" data-topic=\"1\" data-recommend=\"\" href=\"javascript:;\">#${topic}</a> </span>`
  );

  const highlightPatterns: Array<[RegExp, keyof Theme["highlights"]]> = [
    [/==([^=\n]+)==/g, "hl_yellow"],
    [/\+\+([^+\n]+)\+\+/g, "hl_blue"],
    [/%%([^%\n]+)%%/g, "hl_pink"],
    [/&amp;&amp;([^&\n]+)&amp;&amp;/g, "hl_green"],
    [/!!([^!\n]+)!!/g, "em_red"],
    [/@@([^@\n]+)@@/g, "em_blue"],
    [/\^\^([^\^\n]+)\^\^/g, "em_orange"]
  ];

  for (const [pattern, styleName] of highlightPatterns) {
    escaped = escaped.replace(pattern, (_m, content: string) => {
      return `<span style=\"${theme.highlights[styleName]}\">${content}</span>`;
    });
  }

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

const ORDERED_NUMBER_SETS: Record<string, string[]> = {
  chinese: ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"],
  roman_upper: ["", "Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ", "Ⅵ", "Ⅶ", "Ⅷ", "Ⅸ", "Ⅹ"],
  roman_lower: ["", "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"],
  circled: ["", "①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"],
  circled_filled: ["", "❶", "❷", "❸", "❹", "❺", "❻", "❼", "❽", "❾", "❿"]
};

function formatOrderedNumber(value: number, format: Theme["list_style"]["num_formatter"]): string {
  if (format === "padded") {
    return String(value).padStart(2, "0");
  }
  if (format === "decimal") {
    return String(value);
  }
  return ORDERED_NUMBER_SETS[format]?.[value] ?? String(value);
}

function renderListToken(theme: Theme, type: "ul" | "ol", index: number): string {
  if (type === "ul") {
    return `<span style=\"${theme.list_style.bullet_container}\">${escapeHtml(theme.list_style.bullet_char || " ")}</span>`;
  }

  const number = formatOrderedNumber(index, theme.list_style.num_formatter);
  const label = `${theme.list_style.num_prefix}${number}${theme.list_style.num_suffix}`;
  return `<span style=\"${theme.list_style.num_container}\">${escapeHtml(label)}</span>`;
}


type StandaloneImage = {
  alt: string;
  src: string;
  title?: string;
};

function parseStandaloneImage(line: string): StandaloneImage | undefined {
  const match = line.trim().match(
    /^!\[([^\]]*)\]\(((?:https?:\/\/|file:\/\/|\/|\.\.?\/)[^\s)]+)(?:\s+(?:"([^"]+)"|'([^']+)'))?\)$/u
  );
  if (!match) {
    return undefined;
  }

  return {
    alt: match[1] ?? "",
    src: match[2] ?? "",
    title: match[3] ?? match[4]
  };
}

function renderStandaloneImage(image: StandaloneImage, theme: Theme): string {
  const titleAttr = image.title ? ` title=\"${escapeHtml(image.title)}\"` : "";
  const imageHtml = `<img src=\"${escapeHtml(image.src)}\" alt=\"${escapeHtml(image.alt)}\"${titleAttr} style=\"${theme.img}\" />`;
  if (!image.title) {
    return imageHtml;
  }

  const captionStyle = `${theme.p} margin: -0.35em 0 1.25em; color: #6b7280; font-size: 0.86em; line-height: 1.6; text-align: center; text-indent: 0; font-weight: 400;`;
  return `${imageHtml}\n<p style=\"${captionStyle}\">${escapeHtml(image.title)}</p>`;
}

function renderComicImageGroup(images: StandaloneImage[], theme: Theme): string {
  const imageHtml = images.map((image) => renderStandaloneImage(image, theme)).join("");
  return `<div style=\"display: block; margin: 0; padding: 0; font-size: 0; line-height: 0;\">${imageHtml}</div>`;
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

export function parseMarkdown(md: string, themeName = "default", title?: string, fontSizePreset: FontSizePreset = "medium"): string {
  const theme = resolveTheme(themeName, fontSizePreset);
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
        const centered = text.match(/^<center\b[^>]*>([\s\S]*?)<\/center>$/iu);
        if (centered) {
          out.push(`<p style=\"${theme.p} text-align: center;\">${inlineFormat(centered[1]?.trim() ?? "", theme)}</p>`);
        } else {
          out.push(`<p style=\"${theme.p}\">${inlineFormat(text, theme)}</p>`);
        }
      }
    }
    paragraphBuffer = [];
  };

  const flushList = (): void => {
    if (listType && listItems.length > 0) {
      const activeListType = listType;
      const renderedItems = listItems
        .map((item, index) => {
          const number = activeListType === "ol" ? olStart + index : index + 1;
          return `<li style=\"${theme.li} list-style: none;\">${renderListToken(theme, activeListType, number)}${item}</li>`;
        })
        .join("");
      if (activeListType === "ol") {
        const startAttr = olStart !== 1 ? ` start=\"${olStart}\"` : "";
        out.push(`<ol${startAttr} style=\"${theme.ol}\">${renderedItems}</ol>`);
        olNextExpected = olStart + listItems.length;
      } else {
        out.push(`<ul style=\"${theme.ul}\">${renderedItems}</ul>`);
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

    if (/^(={3,}|~{3,}|\[SEC\])$/u.test(line.trim())) {
      flushParagraph();
      flushList();
      out.push(`<p style=\"${theme.section_divider}\">${escapeHtml(theme.section_divider_text)}</p>`);
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/u.test(line.trim())) {
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

    const standaloneImage = parseStandaloneImage(line);
    if (standaloneImage) {
      flushParagraph();
      flushList();

      const comicImages = standaloneImage.title ? [] : [standaloneImage];
      if (comicImages.length > 0) {
        let nextIndex = i + 1;
        while (nextIndex < lines.length) {
          const nextLine = (lines[nextIndex] ?? "").replace(/\s+$/u, "");
          const nextImage = parseStandaloneImage(nextLine);
          if (!nextImage || nextImage.title) break;
          comicImages.push(nextImage);
          nextIndex += 1;
        }
      }

      if (comicImages.length > 1) {
        out.push(renderComicImageGroup(comicImages, theme));
        i += comicImages.length - 1;
      } else {
        out.push(renderStandaloneImage(standaloneImage, theme));
      }
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
