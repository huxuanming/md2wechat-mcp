#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseMarkdown } from "./markdown.js";
import { THEME_METADATA } from "./themes.js";

const GALLERY_IMAGE_URL = "https://theme-gallery.invalid/visual-language.svg";
const GALLERY_IMAGE_DATA_URI = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 480"><defs><linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#efe5d4"/><stop offset="1" stop-color="#c8d8d0"/></linearGradient></defs><rect width="900" height="480" fill="url(#paper)"/><circle cx="710" cy="118" r="76" fill="#e65a3b" opacity=".9"/><path d="M0 390 180 210l120 118 115-140 196 202Z" fill="#263c46" opacity=".88"/><path d="M350 390 565 170l215 220Z" fill="#f6f1e8" opacity=".86"/><text x="58" y="82" fill="#263c46" font-family="Georgia,serif" font-size="28" letter-spacing="6">VISUAL LANGUAGE</text><text x="60" y="126" fill="#5d6d69" font-family="sans-serif" font-size="18" letter-spacing="3">主题图片与图注样例</text></svg>`)}`;

const SAMPLE_MARKDOWN = `> 一套好主题不只是换颜色，它应该同时定义标题节奏、正文呼吸、强调层级与信息密度。

## 01 · 标题与正文节奏

这是用于横向比较的标准样文。它同时包含**核心重点**、*轻度强调*、\`inline code\` 和[示例链接](https://example.com)。正文会保持同样内容，让字体、颜色、留白和层级差异清楚可见。

==黄色高亮==用于结论，++蓝色高亮++用于术语，%%粉色高亮%%用于提醒，&&绿色高亮&&用于正向信息。也可以使用!!红色强调!!、@@蓝色强调@@和^^橙色强调^^。

[SEC]

## 02 · 列表系统

1. 第一层信息：先给结论，再补证据
2. 第二层信息：控制段落长度与阅读节奏
3. 第三层信息：让编号成为主题识别的一部分

- 无序列表用于并列观点
- 项目符号应与主色一致
- 移动端仍需保持清晰对齐

### 小标题与代码

\`theme\` 决定文章的视觉语气，\`font_size_preset\` 决定整体字号尺度。

\`\`\`ts
const theme = "visual-language";
const readable = true;
\`\`\`

## 03 · 图片与图注

![主题视觉语言样图](${GALLERY_IMAGE_URL} "主题图片说明：用于检查圆角、边框、留白与图注节奏")

## 04 · 表格与分隔

| 维度 | 观察重点 | 目标 |
| :--- | :--- | ---: |
| 标题 | 层级与识别度 | 清晰 |
| 正文 | 字号、行高、留白 | 耐读 |
| 强调 | 色彩与背景 | 克制 |

---

最后一段用于观察普通正文在文章尾部的收束感。主题应该有个性，但不能牺牲微信公众号里的可读性与复制稳定性。`;

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function galleryHtml(): string {
  const categories = [...new Set(THEME_METADATA.map((theme) => theme.category))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const cards = THEME_METADATA.map((meta, index) => {
    const rendered = parseMarkdown(SAMPLE_MARKDOWN, meta.name).replaceAll(GALLERY_IMAGE_URL, GALLERY_IMAGE_DATA_URI);
    return `
      <section class="theme-card" data-name="${escapeHtml(meta.name)}" data-category="${escapeHtml(meta.category)}" data-source="${meta.source}" style="--delay:${index * 28}ms">
        <header class="theme-card__header">
          <div>
            <p class="theme-card__index">THEME ${String(index + 1).padStart(2, "0")}</p>
            <h2>${escapeHtml(meta.name)}</h2>
          </div>
          <span class="theme-card__source">${meta.source === "classic" ? "经典主题" : "Publisher 适配"}</span>
          <p class="theme-card__description">${escapeHtml(meta.description)}</p>
          <p class="theme-card__category">${escapeHtml(meta.category)}</p>
        </header>
        <div class="theme-card__viewport">
          <div class="theme-card__paper">${rendered}</div>
        </div>
      </section>`;
  }).join("\n");

  const categoryFilters = categories.map((category) => `<button class="filter" data-filter-type="category" data-filter-value="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join("\n");
  const generatedAt = new Intl.DateTimeFormat("zh-CN", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Shanghai" }).format(new Date());

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>md2wechat-mcp · 主题视觉语言图鉴</title>
<style>
  :root {
    color-scheme: light;
    --ink: #15130f;
    --paper: #f2eee4;
    --paper-deep: #e5decf;
    --signal: #e23b24;
    --line: rgba(21, 19, 15, 0.18);
    --muted: #716b60;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    color: var(--ink);
    background:
      linear-gradient(rgba(21,19,15,.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(21,19,15,.035) 1px, transparent 1px),
      var(--paper);
    background-size: 28px 28px;
    font-family: "Songti SC", "Noto Serif SC", Georgia, serif;
  }
  .masthead {
    min-height: 52vh;
    padding: clamp(34px, 7vw, 96px) clamp(20px, 6vw, 88px) 48px;
    border-bottom: 1px solid var(--line);
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) minmax(250px, .65fr);
    gap: 48px;
    align-items: end;
    position: relative;
    overflow: hidden;
  }
  .masthead::after {
    content: "20";
    position: absolute;
    right: -0.04em;
    bottom: -0.23em;
    font: 900 clamp(220px, 36vw, 620px)/.8 "Arial Black", Impact, sans-serif;
    color: rgba(226, 59, 36, .075);
    letter-spacing: -.1em;
    pointer-events: none;
  }
  .eyebrow, .theme-card__index {
    margin: 0 0 14px;
    font: 700 11px/1.2 "SFMono-Regular", Menlo, Consolas, monospace;
    letter-spacing: .18em;
    text-transform: uppercase;
    color: var(--signal);
  }
  .masthead h1 {
    max-width: 950px;
    margin: 0;
    font-size: clamp(52px, 9vw, 138px);
    line-height: .87;
    letter-spacing: -.07em;
    font-weight: 900;
  }
  .masthead h1 span { display: block; color: var(--signal); }
  .masthead__aside {
    position: relative;
    z-index: 1;
    padding-left: 22px;
    border-left: 4px solid var(--signal);
  }
  .masthead__aside p { margin: 0 0 18px; font-size: 15px; line-height: 1.75; }
  .masthead__stats { display: flex; gap: 28px; font-family: Menlo, Consolas, monospace; }
  .masthead__stats strong { display: block; font-size: 30px; line-height: 1; }
  .masthead__stats span { color: var(--muted); font-size: 10px; letter-spacing: .08em; }
  .controls {
    position: sticky;
    top: 0;
    z-index: 10;
    padding: 16px clamp(20px, 4vw, 64px);
    background: rgba(242, 238, 228, .92);
    backdrop-filter: blur(18px);
    border-bottom: 1px solid var(--line);
  }
  .controls__row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .controls__row + .controls__row { margin-top: 10px; }
  .search {
    flex: 1 1 260px;
    min-width: 0;
    border: 0;
    border-bottom: 2px solid var(--ink);
    background: transparent;
    padding: 10px 2px;
    color: var(--ink);
    font: 700 14px/1.2 Menlo, Consolas, monospace;
    outline: none;
  }
  .search:focus { border-color: var(--signal); }
  .filter {
    border: 1px solid var(--line);
    background: rgba(255,255,255,.35);
    color: var(--ink);
    padding: 7px 11px;
    cursor: pointer;
    font: 600 12px/1 "PingFang SC", sans-serif;
    transition: .15s ease;
  }
  .filter:hover, .filter.is-active { border-color: var(--signal); color: #fff; background: var(--signal); }
  .result-count { margin-left: auto; color: var(--muted); font: 12px/1 Menlo, Consolas, monospace; }
  main { padding: clamp(24px, 5vw, 72px); }
  .theme-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: clamp(18px, 3vw, 42px); align-items: start; }
  .theme-card {
    min-width: 0;
    border: 1px solid var(--line);
    background: rgba(249, 246, 238, .72);
    box-shadow: 10px 10px 0 rgba(21,19,15,.07);
    animation: rise .55s both cubic-bezier(.2,.8,.2,1);
    animation-delay: var(--delay);
  }
  .theme-card.is-hidden { display: none; }
  @keyframes rise { from { opacity: 0; transform: translateY(18px); } }
  .theme-card__header {
    min-height: 186px;
    padding: 22px 24px 18px;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px 18px;
    border-bottom: 1px solid var(--line);
    position: relative;
  }
  .theme-card__header::before { content: ""; position: absolute; width: 52px; height: 5px; left: 24px; bottom: -3px; background: var(--signal); }
  .theme-card__header h2 { margin: 0; font: 800 clamp(24px, 3vw, 38px)/1 "Arial Narrow", "PingFang SC", sans-serif; letter-spacing: -.04em; }
  .theme-card__source { align-self: start; border: 1px solid currentColor; padding: 5px 8px; color: var(--signal); font: 700 10px/1 "PingFang SC", sans-serif; }
  .theme-card__description { grid-column: 1 / -1; margin: 7px 0 0; color: #4f4a42; font: 14px/1.7 "PingFang SC", sans-serif; }
  .theme-card__category { grid-column: 1 / -1; margin: 0; color: var(--muted); font: 700 11px/1.2 Menlo, Consolas, monospace; }
  .theme-card__viewport { height: min(68vh, 760px); overflow: auto; overscroll-behavior: contain; background: #d8d4cb; padding: clamp(10px, 2vw, 24px); }
  .theme-card__paper { width: min(100%, 430px); min-height: 100%; margin: 0 auto; background: #fff; box-shadow: 0 14px 40px rgba(23,20,16,.16); overflow: hidden; }
  .theme-card__paper > article { min-height: 100%; }
  .empty { display: none; padding: 90px 20px; text-align: center; color: var(--muted); font-size: 24px; }
  .empty.is-visible { display: block; }
  footer { padding: 28px clamp(20px, 5vw, 72px) 60px; border-top: 1px solid var(--line); color: var(--muted); font: 12px/1.7 Menlo, Consolas, monospace; }
  @media (max-width: 980px) {
    .masthead { grid-template-columns: 1fr; min-height: auto; }
    .theme-grid { grid-template-columns: 1fr; }
    .theme-card__viewport { height: 720px; }
  }
  @media (max-width: 560px) {
    .masthead { padding-top: 42px; }
    .masthead h1 { font-size: 52px; }
    main { padding: 16px; }
    .theme-card__header { padding: 18px; }
    .theme-card__viewport { padding: 8px; height: 650px; }
    .result-count { width: 100%; margin: 4px 0 0; }
  }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; scroll-behavior: auto !important; } }
</style>
</head>
<body>
  <header class="masthead">
    <div>
      <p class="eyebrow">MD2WECHAT / VISUAL LANGUAGE ATLAS</p>
      <h1>主题视觉<span>语言图鉴</span></h1>
    </div>
    <aside class="masthead__aside">
      <p>同一份中文样文、同一套语义结构，横向观察每个主题在标题、正文、列表、强调、代码与表格上的设计选择。</p>
      <div class="masthead__stats"><div><strong>${THEME_METADATA.length}</strong><span>全部主题</span></div><div><strong>${THEME_METADATA.filter((x) => x.source === "wechat-publisher").length}</strong><span>新适配</span></div></div>
    </aside>
  </header>
  <nav class="controls" aria-label="主题筛选">
    <div class="controls__row">
      <input id="search" class="search" type="search" placeholder="搜索主题名、描述或分类…" />
      <button class="filter is-active" data-filter-type="source" data-filter-value="all">全部</button>
      <button class="filter" data-filter-type="source" data-filter-value="classic">经典主题</button>
      <button class="filter" data-filter-type="source" data-filter-value="wechat-publisher">Publisher 适配</button>
      <span id="result-count" class="result-count">${THEME_METADATA.length} / ${THEME_METADATA.length}</span>
    </div>
    <div class="controls__row">${categoryFilters}</div>
  </nav>
  <main>
    <div id="theme-grid" class="theme-grid">${cards}</div>
    <div id="empty" class="empty">没有匹配的主题。</div>
  </main>
  <footer>生成时间：${escapeHtml(generatedAt)} · 主题数据来自当前 md2wechat-mcp 运行时 · 每个预览区域可独立滚动</footer>
<script>
  const cards = [...document.querySelectorAll('.theme-card')];
  const search = document.querySelector('#search');
  const count = document.querySelector('#result-count');
  const empty = document.querySelector('#empty');
  const state = { source: 'all', category: 'all', query: '' };
  function applyFilters() {
    let visible = 0;
    for (const card of cards) {
      const haystack = (card.dataset.name + ' ' + card.dataset.category + ' ' + card.textContent).toLowerCase();
      const matches = (state.source === 'all' || card.dataset.source === state.source)
        && (state.category === 'all' || card.dataset.category === state.category)
        && (!state.query || haystack.includes(state.query));
      card.classList.toggle('is-hidden', !matches);
      if (matches) visible += 1;
    }
    count.textContent = visible + ' / ' + cards.length;
    empty.classList.toggle('is-visible', visible === 0);
  }
  search.addEventListener('input', (event) => { state.query = event.target.value.trim().toLowerCase(); applyFilters(); });
  document.querySelectorAll('.filter').forEach((button) => {
    button.addEventListener('click', () => {
      const type = button.dataset.filterType;
      const value = button.dataset.filterValue;
      if (type === 'source') {
        state.source = value;
        document.querySelectorAll('[data-filter-type="source"]').forEach((item) => item.classList.toggle('is-active', item === button));
      } else {
        state.category = state.category === value ? 'all' : value;
        document.querySelectorAll('[data-filter-type="category"]').forEach((item) => item.classList.toggle('is-active', item.dataset.filterValue === state.category));
      }
      applyFilters();
    });
  });
</script>
</body>
</html>`;
}

const outputPath = resolve(process.argv[2] ?? "theme-gallery.html");
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, galleryHtml(), "utf8");
process.stdout.write(`${outputPath}\n`);
