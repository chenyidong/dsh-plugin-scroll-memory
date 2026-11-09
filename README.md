# dsh-plugin-scroll-memory

让 DSH 的**插件管理页**记住列表的滚动位置：从插件详情返回列表时回到原处，不再跳回顶部。

[English](#english) · 简体中文

## 问题

插件页把列表和详情渲染在同一个滚动容器里。打开详情时列表被整体替换，容器高度塌回一屏，
`scrollTop` 被浏览器夹到 0；返回列表时没有任何代码把它写回去，于是永远回到顶部。

在插件多的时候这一点很烦：想逐个看一遍插件，每次返回都要重新滚一遍。

## 效果

滚到列表中间 → 点开任意插件详情 → 点「返回插件」→ 停在原处。

在详情里继续往下滚不影响记忆的位置：翻到详情底部再返回，还是回到原来那一行。

## 覆盖范围

详情态用 DSH 内核自带的三个标记识别，三种详情页都生效：

| 标记 | 对应页面 |
| --- | --- |
| `[data-plugin-detail]` | 组合包详情 |
| `[data-plugin-item-detail]` | 官方插件条目详情 |
| `[data-market-detail]` | 「发现」市场条目详情 |

## 做法

纯客户端插件，约 100 行，只做两件事：

1. 容器处于**列表态**时，持续记录它的 `scrollTop`。
2. 详情节点消失（= 刚回到列表）时，下一帧把记录值写回；列表还没撑开高度就再补一帧。

判断一律读实时 DOM，而不是缓存状态。这一条很关键：切到详情时浏览器会把 `scrollTop` 夹到 0
并补一个 `scroll` 事件，而那一刻详情节点已经存在，所以这个伪事件不会被误记成「列表在顶部」。
在详情里滚动同理，滚的是详情自己，不会覆盖列表位置。

不注册 slot、不读任何 host 服务、不改内核 `app.asar`，卸载即净。

## 安装

```bash
dsh plugin --profile <profile> add github:chenyidong/dsh-plugin-scroll-memory
```

装完重启该 profile。

本地开发时也可以直接 link 源码目录：

```bash
dsh plugin --profile <profile> add link:/path/to/dsh-plugin-scroll-memory
```

## 测试

```bash
node test.cjs
```

用假 DOM 跑三种情形：列表滚动 → 进详情 → 返回；详情里继续滚不污染列表位置；列表在顶部时返回仍在顶部。

## 限制

- 只在 Web / 桌面端的插件页生效；终端 TUI 不适用。
- 依赖内核的 `data-plugin-body` / `data-plugin-detail` 等标记，宿主大版本改 DOM 时需跟着调整。
- **离开插件页再回来不保留位置**（容器会被重新挂载）。本插件只解决「列表 ↔ 详情」这一跳。

## English

The DSH plugin manager renders its list and the plugin detail in the same scroll container.
Opening a detail replaces the list, the container collapses to one screen and `scrollTop` is
clamped to 0 — nothing writes it back, so going back always lands at the top.

This plugin remembers the list offset and restores it when the detail is dismissed:

- records `scrollTop` while the list is visible;
- on detail dismissal, writes it back on the next frame, with one retry for lists whose height
  is not yet laid out.

Detail state is detected from the markers the core already ships (`[data-plugin-detail]`,
`[data-plugin-item-detail]`, `[data-market-detail]`), so bundle details, official plugin item
details and marketplace entries are all covered. Detection reads the live DOM, not cached state:
the browser clamps `scrollTop` to 0 when the container shrinks and fires a `scroll` event, and at
that moment the detail node already exists — so that fake event is never mistaken for "the list
is at the top".

No slots, no host services, no changes to the core `app.asar`. Uninstall leaves nothing behind.

```bash
dsh plugin --profile <profile> add github:chenyidong/dsh-plugin-scroll-memory
```

Known limit: leaving the plugin page and coming back does not restore the position — the
container is remounted. This plugin covers the list ↔ detail round trip.

## License

[MIT](./LICENSE) © 2026 chen.com
