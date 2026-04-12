# 微信 Markdown 转换 MCP

这个 MCP 服务提供以下工具：
- `convert_markdown_to_wechat_html`: 把 Markdown 转成可用于公众号排版流程的内联样式 HTML。
- `list_wechat_themes`: 返回可用主题。
- `open_wechat_html_in_browser`: 打开转换后的缓存 HTML（`cacheHtmlPath` 必须来自 `convert_markdown_to_wechat_html` 返回值）。
- `wechat_get_access_token`: 获取公众号接口调用凭证（读取环境变量）。
- `wechat_upload_image`: 上传“文章内图片”并返回 URL（不占素材库配额）。
- `wechat_add_material`: 上传永久素材（`image | voice | video | thumb`）。
- `wechat_draft_add`: 新增草稿。
- `wechat_markdown_to_draft`: 一键把 Markdown 转 HTML 并创建草稿。
- `wechat_draft_update`: 更新草稿指定文章。
- `wechat_draft_batchget`: 分页查询草稿列表。
- `wechat_draft_delete`: 删除草稿。

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
- `font_size_preset` (string, optional, default `medium`): `small | medium | large`
- `access_token` (string, optional): 传入后会自动上传本地图片并替换为微信 URL

规则：
- `markdown` 和 `markdown_path` 二选一
- 如果两者都传，优先使用 `markdown`
- 顶部一级标题（`# 标题`）会在转换时从正文移除（避免正文重复显示大标题）

输出：
- `content[0].text`：HTML 字符串（`<article>...</article>`）
- `content[1].text`：可见元信息文本（含 `cacheHtmlPath=...`）
- `meta.cacheHtmlPath` 返回缓存文件路径（后续 `open_wechat_html_in_browser.cacheHtmlPath` 必须使用这个字段）
- 兼容说明：若客户端不展示 `meta`，从 `content[1].text` 解析 `cacheHtmlPath=...`

### 2) `list_wechat_themes`
输入：空对象
输出：主题列表

### 3) `open_wechat_html_in_browser`
输入：
- `cacheHtmlPath` (string, required): 请直接传 `convert_markdown_to_wechat_html` 返回的 `meta.cacheHtmlPath`，不要手猜 `/tmp` 路径

输出：
- JSON 文本，包含 `ok / opened / cacheHtmlPath`
- `meta.cacheHtmlPath` 返回缓存文件路径

### 4) `wechat_add_material`
对应官方接口：`POST /cgi-bin/material/add_material`

输入：
- `access_token` (string, required)
- `type` (string, required): `image | voice | video | thumb`
- `file_path` (string, required): 本地文件绝对路径
- `title` (string, optional): `type=video` 时必填
- `introduction` (string, optional): `type=video` 时必填

输出：
- `media_id` (string): 新增的永久素材 ID
- `url` (string, optional): 仅 `image` 类型返回

### 5) `wechat_get_access_token`
输入：空对象

依赖环境变量：
- `WECHAT_APPID`
- `WECHAT_APPSECRET`

输出：
- `access_token`
- `expires_in`

### 6) `wechat_upload_image`
对应官方接口：`POST /cgi-bin/media/uploadimg`

输入：
- `access_token` (string, required)
- `file_path` (string, required): 本地图片路径，仅支持 `jpg/jpeg/png`

输出：
- `url` (string): 文章内可用的图片 URL

### 7) `wechat_draft_add`
对应官方接口：`POST /cgi-bin/draft/add`

输入：
- `access_token` (string, required)
- `articles` (array, required): 至少 1 篇，字段与公众号草稿接口一致，核心字段：
- `title` (string, required)
- `content` (string, required): 建议使用 `convert_markdown_to_wechat_html` 生成
- `author`/`digest`/`content_source_url`/`thumb_media_id`/`need_open_comment`/`only_fans_can_comment` (optional)

输出：
- `media_id` (string)

### 8) `wechat_draft_update`
对应官方接口：`POST /cgi-bin/draft/update`

输入：
- `access_token` (string, required)
- `media_id` (string, required)
- `index` (number, optional, default `0`)
- `article` (object, required): 同 `wechat_draft_add` 单篇文章结构

输出：
- `errcode`
- `errmsg`

### 9) `wechat_markdown_to_draft`
一键工具：内部自动执行 `convert_markdown_to_wechat_html` + `wechat_draft_add`。
封面自动策略（默认启用，无需传封面参数）：
- 若存在 `title="封面"` 的本地 `jpg/jpeg` 图片：该图上传为封面，并从正文移除
- 否则：尝试使用首张本地 `jpg/jpeg` 图片作为封面
- 若无可用图片：不上传封面，草稿仍会创建
- 顶部一级标题（`# 标题`）会在转换时从正文移除（避免正文重复显示大标题）

输入（核心）：
- `access_token` (string, required)
- `article_title` (string, required)
- `markdown` 或 `markdown_path` (至少一个)

输入（可选）：
- `theme` / `title`
- `font_size_preset`（可选，`small | medium | large`，默认 `medium`）
- `thumb_media_id`（可选，显式覆盖自动封面）
- `author` / `digest` / `content_source_url`
- `need_open_comment` / `only_fans_can_comment`

说明：
- `auto_thumb_from_first_image` 参数已移除；封面由 `wechat_markdown_to_draft` 内置策略自动处理。

输出：
- 草稿创建结果（含 `media_id`）
- `meta.cacheHtmlPath`（转换缓存路径）
- `meta.thumbMediaId`（若自动或手动封面可用）

### 10) `wechat_draft_batchget`
对应官方接口：`POST /cgi-bin/draft/batchget`

输入：
- `access_token` (string, required)
- `offset` (number, optional, default `0`)
- `count` (number, optional, default `10`, 范围 `1-20`)
- `no_content` (`0 | 1`, optional, default `0`)

输出：
- `total_count`
- `item_count`
- `item`

### 11) `wechat_draft_delete`
对应官方接口：`POST /cgi-bin/draft/delete`

输入：
- `access_token` (string, required)
- `media_id` (string, required)

输出：
- `errcode`
- `errmsg`

## 典型调用流程

前置：`wechat_markdown_to_draft` 也必须先拿到 `access_token`（可通过 `wechat_get_access_token` 获取）。

1. 推荐直接调用 `wechat_markdown_to_draft` 一步完成转换+建草稿（在已持有 `access_token` 的前提下）
2. 或者使用分步模式：`wechat_get_access_token` → `convert_markdown_to_wechat_html` → `wechat_draft_add`
3. 封面默认自动处理（`title="封面"` 优先；否则首图）；也可手动 `wechat_add_material(type=thumb)` 后在草稿里显式传 `thumb_media_id`
4. 使用 `wechat_draft_update / wechat_draft_batchget / wechat_draft_delete` 做后续管理

## 给 AI 的执行规范（建议写入系统提示）

当用户说“把 Markdown 上传到公众号草稿箱”时，必须遵循：
1. 必须先调用 `convert_markdown_to_wechat_html`。
2. `wechat_draft_add.articles[].content` 必须使用上一步返回的 `content[0].text`。
3. 不要把原始 Markdown 直接传给 `wechat_draft_add`。
4. `wechat_add_material` 仅用于素材上传（封面/音视频），不能替代 `wechat_draft_add` 创建草稿。
5. 需要手动封面时，先调用 `wechat_add_material(type=thumb)`，再将返回 `media_id` 写入 `wechat_draft_add.articles[].thumb_media_id`。
6. 调用 `open_wechat_html_in_browser` 时，`cacheHtmlPath` 必须来自 `convert_markdown_to_wechat_html` 返回的 `meta.cacheHtmlPath`。

## MCP 调用示例（可直接复制）

### `wechat_get_access_token`
```json
{
  "name": "wechat_get_access_token",
  "arguments": {}
}
```

### `convert_markdown_to_wechat_html`
```json
{
  "name": "convert_markdown_to_wechat_html",
  "arguments": {
    "markdown_path": "/absolute/path/article.md",
    "theme": "wechat-native",
    "font_size_preset": "small",
    "title": "文章标题",
    "access_token": "ACCESS_TOKEN"
  }
}
```

### `convert_markdown_to_wechat_html` -> `open_wechat_html_in_browser`（字段级映射）
```text
open.arguments.cacheHtmlPath = convert.meta.cacheHtmlPath
```

若客户端不展示 `meta`，可从 `convert` 的第二段 `content` 读取：
```text
convert.content[1].text:
cacheHtmlPath=/abs/path/to/wechat-xxx.html
```

提取规则（示例）：
```text
cacheHtmlPath = line that starts with "cacheHtmlPath="
value = text after "="
```

```json
{
  "name": "open_wechat_html_in_browser",
  "arguments": {
    "cacheHtmlPath": "<convert_result.meta.cacheHtmlPath>"
  }
}
```

### `wechat_add_material`
```json
{
  "name": "wechat_add_material",
  "arguments": {
    "access_token": "ACCESS_TOKEN",
    "type": "thumb",
    "file_path": "/absolute/path/cover.jpg"
  }
}
```

### `wechat_upload_image`
```json
{
  "name": "wechat_upload_image",
  "arguments": {
    "access_token": "ACCESS_TOKEN",
    "file_path": "/absolute/path/inline-image.jpg"
  }
}
```

### `wechat_draft_add`
```json
{
  "name": "wechat_draft_add",
  "arguments": {
    "access_token": "ACCESS_TOKEN",
    "articles": [
      {
        "title": "文章标题",
        "author": "作者名",
        "digest": "摘要",
        "content": "<article>...</article>",
        "thumb_media_id": "THUMB_MEDIA_ID",
        "need_open_comment": 1,
        "only_fans_can_comment": 0
      }
    ]
  }
}
```

### `wechat_draft_update`
```json
{
  "name": "wechat_draft_update",
  "arguments": {
    "access_token": "ACCESS_TOKEN",
    "media_id": "DRAFT_MEDIA_ID",
    "index": 0,
    "article": {
      "title": "更新后的标题",
      "content": "<article>...</article>",
      "thumb_media_id": "THUMB_MEDIA_ID"
    }
  }
}
```

### `wechat_markdown_to_draft`
```json
{
  "name": "wechat_markdown_to_draft",
  "arguments": {
    "access_token": "ACCESS_TOKEN",
    "article_title": "文章标题",
    "markdown_path": "/absolute/path/article.md",
    "theme": "wechat-native",
    "font_size_preset": "medium",
    "title": "页面H1标题",
    "author": "作者名",
    "digest": "摘要"
  }
}
```

### `wechat_draft_batchget`
```json
{
  "name": "wechat_draft_batchget",
  "arguments": {
    "access_token": "ACCESS_TOKEN",
    "offset": 0,
    "count": 10,
    "no_content": 1
  }
}
```

### `wechat_draft_delete`
```json
{
  "name": "wechat_draft_delete",
  "arguments": {
    "access_token": "ACCESS_TOKEN",
    "media_id": "DRAFT_MEDIA_ID"
  }
}
```

## CLI 参数

`md2wechat <input> [options]`
- `--theme <theme>`
- `--title <title>`
- `--font-size-preset <preset>`
- `--out <path>`
- `--cache-dir <path>`

## 测试

```bash
npm test
```
