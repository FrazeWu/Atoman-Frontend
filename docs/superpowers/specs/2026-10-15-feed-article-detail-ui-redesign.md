# Feed 文章详情阅读页/抽屉 UI 重构设计规范

## 1. 目标与背景

当前 Feed 模块的文章详情抽屉 (`FeedArticleSheet.vue`) 以及独立详情页 (`FeedItemDetailView.vue`) 存在以下问题：
1. **Post 与 RSS 视觉层级割裂**：博客文章与外部 RSS 文章的元信息排版、动作按钮摆放逻辑不同（博客置于标题下，RSS 置于标题上及正文各处）。
2. **动作散落与视线跳跃**：来源订阅、前往源站、快捷收藏、模式切换（RSS/全文）、播客播放、评论入口散落在抽屉顶部、副标题以及底部各处，阅读时动作不易聚焦。
3. **首屏视觉焦点偏移**：RSS 文章将封面图置于最顶端，将文章标题压在图片下方，打开抽屉时第一眼无法直达文字核心。
4. **设计系统契合度**：需要进一步强化整体纯白报纸质感、0 投影 (`box-shadow: none`)、4px 圆角 (`border-radius: 4px`)、发丝分割线与沉浸衬线正文。

本设计规范针对上述问题，确立统一的**杂志报刊式沉浸头部 (Editorial Eyebrow & Integrated Action Strip)** 与阅读版式结构。

---

## 2. 核心架构与视觉层级

无论是博客文章（`Post`）还是外部抓取文章（`FeedItem`），均统一遵循自上而下的 4 级版式：

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. 顶部眉栏 (Eyebrow Meta)                                              │
│    [来源/频道可点击触发] · [作者] · [发布日期] · [字数与预估时长]             │
├────────────────────────────────────────────────────────────────────────┤
│ 2. 主标题 (Headline)                                                   │
│    大字号、高对比度、纯黑文本、文本平衡排版 (text-wrap: balance)                │
├────────────────────────────────────────────────────────────────────────┤
│ 3. 集成动作条 (Integrated Action Strip)                                 │
│    [左侧: 来源订阅 | 前往源站 ↗ | 播放播客]    [右侧: RSS/全文 | 收藏 | 评论]  │
├────────────────────────────────────────────────────────────────────────┤
│ 4. 导读头图 (Cover Image，如有)                                         │
│    宽幅导读大图（坏图平滑回退），紧接导语与正文                              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 详细元素与行为规范

### 3.1 顶部眉栏 (Eyebrow Meta)
- **容器**：`.article-eyebrow`，单行自然流动排列（`display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem;`）。
- **来源项**：
  - 若有关联来源，渲染为轻量按钮 `.article-source-badge`，支持 `@click="emit('open-source')"` 打开来源抽屉；
  - 若无来源对象，以纯文本柔和显示来源名。
- **作者项**：
  - Post 显示作者 display_name 并可链接至用户主页；
  - FeedItem 显示解析出的 author 字段；若无则自动跳过。
- **发布日期**：使用 `formatDate(...)` 显示友好相对或绝对日期。
- **阅读量/字数标签**：如 `约 1,200 字 · 3 分钟阅读`，颜色 `var(--a-color-muted)`。
- **分隔点**：使用 `·`，颜色 `var(--a-color-border-subtle)`。

### 3.2 主标题 (Headline)
- **元素**：`h1.article-headline`。
- **排版规范**：
  - 桌面端：`font-size: 2rem` (32px)，`line-height: 1.28`；
  - 移动端：`font-size: 1.65rem` (26px)，`line-height: 1.32`；
  - 属性：`font-weight: 600`，`color: var(--a-color-text)`，`text-wrap: balance`，`letter-spacing: -0.015em`；
  - 边距：上方距眉栏 `0.75rem`，下方距动作条 `1rem`。

### 3.3 集成动作条 (Integrated Action Strip)
- **容器**：`.article-action-strip`。
- **布局**：`display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem 1rem;`，底部带 `1px solid var(--a-color-border-soft)` 分隔细线，内下边距 `0.75rem`。
- **左侧功能簇（来源与多媒体）**：
  - **订阅按钮 (`subscribe-source`)**：
    - 未订阅：次级极简按钮（`variant="secondary"`，4px 圆角，尺寸 `sm`），未登录点击安全跳转登录并保留意图；
    - 已订阅：轻量标签显示“已订阅”，降低视觉权重，不抢正文。
  - **前往源站 (`article-source-link`)**：
    - 带有外链箭头图标 (`ExternalLink` 或 `ArrowUpRight`)，`target="_blank" rel="noopener noreferrer"`。
  - **播客音频播放 (`article-play-podcast`)**：
    - 仅播客类条目显示，`Play` / `Pause` 切换，32px 紧凑高度。
- **右侧功能簇（阅读控制与保存）**：
  - **内容模式切换 (`PSegmentedControl`)**：
    - 支持全文抓取时展示 `[RSS | 全文]` 紧凑胶囊；
    - 单模式显示语义字样（如 `全文` 或 `摘要`）。
  - **快捷收藏 (`quick-star / bookmark`)**：
    - 图标 + 文本（`已收藏` / `收藏`），支持快捷切换；未登录点击触发 `require-auth` 意图回跳。
  - **快速评论入口 (`article-comments-trigger`)**：
    - 展示评论图标与数量，点击展开侧边评论抽屉。

### 3.4 导读头图 (Cover Image)
- **容器**：`.article-cover`。
- **位置**：移至动作条下方，正文开头前。
- **尺寸与裁剪**：桌面端 `max-height: 360px`，移动端 `max-height: 220px`，`width: 100%`，`object-fit: cover`。
- **防穿透与回退**：外框带 `1px solid var(--a-color-border-soft)` 与 `border-radius: 4px`；图片加载失败时平滑降级为纯文本来源名占位或安全隐藏。

### 3.5 导语摘要 (Summary)
- **元素**：`p.article-summary`。
- **样式**：左侧 `2px solid var(--a-color-text)`，`padding-left: 0.75rem`，字号 `0.95rem`，色彩 `var(--a-color-muted)`，行高 `1.6`。

---

## 4. 纸感排版与无障碍设计原则

1. **绝对 0 阴影**：所有按钮、卡片、浮层遵循 `box-shadow: none !important`。
2. **严格 4px 圆角**：所有可交互元素均使用 `border-radius: 4px`，无大圆角与异形变形。
3. **衬线正文与阅读约束**：正文采用 `var(--a-font-serif)`，`max-width: 66ch`，行高 `1.78`。
4. **无障碍交互与触控尺寸**：所有交互元素触控最小尺寸不低于 36px，具有完整 `aria-label` 与 `aria-pressed` 状态声明。

---

## 5. 影响范围与测试验证

### 5.1 修改范围
- `Atoman-Frontend/src/components/feed/FeedArticleSheet.vue`：模板层级重构、动作条集成、样式更新。
- `Atoman-Frontend/src/assets/feed-reader.css`：呼应新动作条与头图间距。

### 5.2 测试用例更新与断言
- 更新 `tests/unit/components/feed/FeedArticleSheet.spec.ts`：
  - 验证新的眉栏结构渲染与来源点击触发；
  - 验证标题首屏第一重心；
  - 验证动作条包含订阅、源站链接、模式切换、快捷收藏等；
  - 确保原有 16 项功能测试 100% 保持通过。
