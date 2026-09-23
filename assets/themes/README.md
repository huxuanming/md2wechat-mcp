# WeChat theme pack

This directory is the single source of truth for all 20 themes used by the MCP.
Every theme follows the same JSON vocabulary: `styles`, `highlights`,
`section_divider_text`, `code_colors`, and `list_style`.

- `default`, `tech`, `warm`, `apple`, and `wechat-native` are maintained as
  backward-compatible classic themes. Their original names and visual identities
  are preserved while their typography, lists, highlights, images, tables, code
  blocks, and dividers now meet the same completeness baseline as newer themes.
- The other 15 themes are adapted from
  [`jiji262/wechat-publisher`](https://github.com/jiji262/wechat-publisher/tree/main/assets/themes),
  source commit `84754be2e2dfa1c6468c7c7ae25f93ca6f7ec9a8` (MIT).

Mobile and WeChat compatibility normalization is applied centrally in
`src/themes.ts`; visual language remains theme-specific rather than being forced
into one shared appearance.
