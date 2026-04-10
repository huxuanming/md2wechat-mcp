---
name: wechat-draft-publish
description: Use when the user wants to publish a Markdown article (with images) to WeChat Official Account draft box. Covers the full workflow: get token → convert MD to HTML (auto-upload local images) → optionally upload cover → add draft.
---

# 发布 Markdown 图文到微信公众号草稿箱

## 前置条件

确认 MCP server 已配置以下环境变量：
- `WECHAT_APPID` — 公众号 AppID
- `WECHAT_APPSECRET` — 公众号 AppSecret

## 完整工作流

### Step 1 — 获取 access_token

```
wechat_get_access_token()
→ { access_token, expires_in }
```

保存 `access_token`，后续步骤均需要。token 有效期 7200 秒，同一次任务无需重复获取。

### Step 2 — 转换 Markdown 并上传本地图片

```
convert_markdown_to_wechat_html(
  markdown_path | markdown,
  access_token,   ← 传入后自动上传本地图片
  theme?,         ← 默认 default，可选 tech / warm / apple / wechat-native
  title?
)
→ HTML 字符串（图片已替换为微信 CDN URL）
```

**关键点：**
- 传入 `access_token` 时，`![alt](./local/path)` 会自动上传并替换为永久 CDN URL
- 远程图片 `![alt](https://...)` 直接渲染为 `<img>` 标签，微信可能过滤外链
- 若 Markdown 无本地图片，`access_token` 可省略

### Step 3（可选）— 上传封面图

若草稿需要封面图（`thumb_media_id`）：

```
wechat_upload_image(
  access_token,
  file_path  ← 本地 JPG/PNG，≤1MB
)
→ { url }
```

注意：此接口返回的是图片 URL，**不是** `thumb_media_id`。封面图需通过素材库接口上传获得 media_id，或在公众号后台已有素材时直接使用其 media_id。

### Step 4 — 新增草稿

```
wechat_draft_add(
  access_token,
  articles: [{
    title,           ← 必填
    content,         ← Step 2 返回的 HTML
    author?,
    digest?,         ← 摘要，列表页展示
    thumb_media_id?, ← 封面图 media_id
    content_source_url?,
    need_open_comment?,      ← 0|1
    only_fans_can_comment?,  ← 0|1
  }]
)
→ { media_id }
```

保存返回的 `media_id`，可用于后续 `wechat_draft_update` 或 `wechat_draft_delete`。

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 图片上传失败 40005 | 格式不是 JPG/PNG | 转换格式后重试 |
| 图片上传失败 40009 | 文件超过 1MB | 压缩后重试 |
| 草稿内容被截断 | content 超 20000 字符 | 拆分为多篇 |
| access_token 过期 | 超过 7200 秒 | 重新调用 Step 1 |
