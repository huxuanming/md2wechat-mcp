# 微信 Markdown 转换 MCP

这个 MCP 服务提供三个工具：
- `convert_markdown_to_wechat_html`: 把 Markdown 转成可用于公众号排版流程的内联样式 HTML。
- `list_wechat_themes`: 返回可用主题。
- `open_wechat_html_in_browser`: 接收 `cacheHtmlPath` 直接打开，方便手动 `Cmd+A` / `Cmd+C`。

当前已支持常见 Markdown 语法（标题、段落、列表、引用、代码块、链接、强调）以及 GFM 风格表格。

转换成功后会自动缓存一份 HTML 到：
- `./.cache/wechat-mcp/`

## 运行

开发：
```bash
npm run dev
```

构建并运行：
```bash
npm run build
npm start
```

CLI 转换：
```bash
node dist/cli.js ./input.md --theme default
```

## MCP 配置示例

**npx（无需本地安装）：**

```json
{
  "mcpServers": {
    "md2wechat-mcp": {
      "command": "npx",
      "args": ["-y", "md2wechat-mcp"]
    }
  }
}
```

**本地路径：**

```json
{
  "mcpServers": {
    "md2wechat-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/md2wechat-mcp/dist/server.js"]
    }
  }
}
```

## 工具参数

### 1) `convert_markdown_to_wechat_html`
输入：
- `markdown` (string, optional): 直接传 Markdown 内容
- `markdown_path` (string, optional): 传本地 Markdown 文件路径（避免整篇内容走 token）
- `theme` (string, optional): `default | tech | warm | apple | wechat-native`
- `title` (string, optional)

规则：
- `markdown` 和 `markdown_path` 二选一
- 如果两者都传，优先使用 `markdown`

输出：
- `text` 内容为 HTML 字符串（`<article>...</article>`）
- `meta.cacheHtmlPath` 返回缓存文件路径

### 2) `list_wechat_themes`
输入：空对象
输出：主题列表

### 3) `open_wechat_html_in_browser`
输入：
- `cacheHtmlPath` (string, required): 已有缓存 HTML 路径，工具会直接打开

输出：
- JSON 文本，包含 `ok / opened / cacheHtmlPath`
- `meta.cacheHtmlPath` 返回缓存文件路径

## CLI 参数

`md2wechat <input> [options]`
- `--theme <theme>`
- `--title <title>`
- `--out <path>`
- `--cache-dir <path>`

## 测试

```bash
npm test
```
