# 微信 Markdown 转换 MCP (Node.js)

这个 MCP 服务提供三个工具：
- `convert_markdown_to_wechat_html`: 把 Markdown 转成可用于公众号排版流程的内联样式 HTML。
- `list_wechat_themes`: 返回可用主题。
- `open_wechat_html_in_browser`: 接收 `cacheHtmlPath` 直接打开，方便手动 `Cmd+A` / `Cmd+C`。

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

```json
{
  "mcpServers": {
    "wechat-md-mcp-server": {
      "command": "node",
      "args": ["/absolute/path/to/wechat-md-mcp-server-node/dist/server.js"]
    }
  }
}
```

## 工具参数

### 1) `convert_markdown_to_wechat_html`
输入：
- `markdown` (string, required)
- `theme` (string, optional): `default | tech | warm | apple | wechat-native`
- `title` (string, optional)

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

`wechat-md-convert <input> [options]`
- `--theme <theme>`
- `--title <title>`
- `--out <path>`
- `--cache-dir <path>`

## 测试

```bash
npm test
```
