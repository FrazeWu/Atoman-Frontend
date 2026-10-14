# 通知模块全栈 UI 重构设计规范 (Notification Module Redesign)

- **创建日期**：2026-10-14
- **目标分支**：`feature/notification-module-redesign` -> `main`
- **设计规范版本**：Pure-White Double-Notch Minimal System (2026-06-05-flat-paper-ui-design)

---

## 1. 背景与目标

### 1.1 现状分析与痛点
1. **缺乏快捷触达**：
   - 目前在全局顶栏（Topbar）点击通知铃铛时，只能强制跳离当前阅读、播放或工作视图，全屏跳转到 `/inbox` 页面。
   - 用户无法在不打断当前体验的前提下，快速瞥视（Glance）最新互动动态或一键清空未读。
2. **消息中心主页（`/inbox`）布局臃肿低效**：
   - 现有的 3 栏传统邮件结构（分类栏 -> 摘要列表 -> 详情展示卡片）造成了严重的视觉与交互浪费。
   - 一条普通的“点赞”或“回复”通知本身仅有一两句话，用户点击列表项后右侧只是重复展示同一段话和两个按钮，大量屏幕空间被无意义留白占据。
3. **通知卡片表现力薄弱**：
   - 缺少上下文引用（如原评摘要、被引用的帖子片段），用户难以直接感知互动的上下文。
   - 缺少直观的动作类型语义标识（仅靠平铺文本区分赞、评、@、系统通知）。
4. **通知流与私信聊天杂糅**：
   - 私信（DM）是双向即时通讯，而通知是单向触达流。现存实现将私信作为一个普通 Tab 硬塞进通知列表中，使得界面模式切换突兀。

### 1.2 重构目标
1. **全局快捷预览**：引入顶部导航栏纯白悬浮面板（`NotificationPopover.vue`），支持就地快速查看最新未读通知、一键已读与一键直达内容。
2. **现代化流式双栏消息中心**：彻底重构 `/inbox` 为「左侧分类导航 + 主区域自包含富通知流」；在进入「私信」标签时无缝切换为专业双栏聊天工作台。
3. **富交互通知卡片（`NotificationItemCard.vue`）**：
   - 头像 + 动作类型语义徽标 + 自然动语文案 + 相对时间戳。
   - 嵌入式原评/原帖上下文引用块，一眼即知来龙去脉。
   - 行内快捷操作：主跳转按钮、快捷标为已读、免打扰（静音）菜单。
4. **严格契约与纯白极简系统一致性**：
   - 容器与卡片底色纯白（`var(--a-color-bg)`）。
   - 阴影收敛至 `var(--a-shadow-*)`，圆角收敛至 `4px`（`var(--a-radius-card)` / `var(--a-radius-control)`），标题与强调字重为 `500` / `600`。
   - 杜绝技术内部词汇，全面采用自然用户语言。

---

## 2. 总体架构与组件分解

```
Atoman-Frontend
├── src/
│   ├── components/
│   │   ├── system/
│   │   │   ├── AppTopbarAuthControls.vue        # [修改] 集成 NotificationPopover
│   │   │   └── NotificationPopover.vue          # [新增] 顶部通知悬浮面板组件
│   │   └── notification/
│   │       ├── NotificationItemCard.vue         # [新增] 富通知卡片（自包含流式卡片）
│   │       ├── NotificationContextQuote.vue     # [新增] 原文/被回复内容上下文引用块
│   │       └── NotificationEmptyState.vue       # [新增] 纯白极简空状态指示
│   ├── views/
│   │   └── feed/
│   │       └── InboxPage.vue                    # [重构] 双栏流式消息中心 / 私信工作台
│   └── stores/
│       ├── notification.ts                      # [增强] 支持乐观已读、过滤状态缓存与快速查询
│       └── inbox.ts                             # [复用] 维护 WebSocket 长连接与 Toast
```

---

## 3. 详细设计与交互规范

### 3.1 顶部通知悬浮面板 (`NotificationPopover.vue`)

#### 1. 结构与呈现
- **触发与定位**：
  - 点击 `AppTopbarAuthControls.vue` 中的铃铛图标触发（支持 Escape 键、点击外部区域或点击跳转项时自动收起）。
  - 面板定位于铃铛下方，宽 `380px`，最大高度 `480px`，带平滑淡入展开动效。
- **面板头部（Header）**：
  - 左侧：标题「通知」，右侧紧跟未读计数胶囊徽章（采用 `font-variant-numeric: tabular-nums`，圆角 `4px`）。
  - 右侧：「全部已读」轻量按钮（`PButton variant="ghost" size="sm"`），仅存在未读时可用。
- **列表内容区（List Body）**：
  - 渲染最近 6~8 条最新通知，采用紧凑版 `NotificationItemCard`。
  - 每条包含发送者头像、动作类型徽标、文案和相对时间，若未读显示 `6px` 蓝色圆点。
  - 点击卡片：乐观将该项标记为已读，关闭 Popover，直接路由跳转到目标内容（文章/视频/歌曲评论锚点等）。
- **面板底部（Footer）**：
  - 提供两个简洁动作入口：
    - 「进入收件箱查看全部」-> 路由导航至 `/inbox`。
    - 「私信信箱」-> 路由导航至 `/inbox?tab=dm`。
- **响应式兜底**：
  - 屏幕宽度 `< 768px` 时，点击铃铛直接打开 `/inbox` 或弹出底部抽屉，避免悬浮层在移动端溢出可视区。

---

### 3.2 消息中心主页面 (`InboxPage.vue`) 双栏流式重构

#### 1. 分栏信息架构
摒弃传统三栏，重塑为响应式双栏：
- **左侧导航栏（Navigation Sidebar，宽 220px）**：
  - 分类项目：
    - `全部通知 (all)`
    - `点赞 (like)`
    - `@我 (mention)`
    - `回复我 (reply)`
    - `论坛讨论 (forum)`
    - `协作提案 (collaboration)`
    - `系统公告 (system)`
  - 底部分隔线下方：
    - `私信 (dm)`（带有独立的 DM 未读数徽章）
    - `通知偏好设置`（直达 `/settings?tab=notification`）
- **主内容流区（Main Feed Pane，自适应宽）**：
  - **顶部工具条（Toolbar）**：
    - 当前分类标题与未读统计。
    - 过滤切换：单选分段器「全部」与「仅看未读」。
    - 快捷动作：「本类全部标为已读」（二次确认或直接触发并撤销）。
  - **通知流（Notification Feed）**：
    - 垂直排列的 `NotificationItemCard`，采用卡片间微柔边框分隔（`1px solid var(--a-color-border-soft)`）。
    - 滚动触底平滑分页加载更多。
    - 卡片自身具备完整阅读与点击跳转能力，无需向右分栏展开。
  - **私信（DM）模式切换**：
    - 当激活 Tab 为 `dm` 时，主区域转为双栏私信工作台：
      - 左：私信邮箱选择与会话列表（`DMMailboxSelector` + `DMConversationList`）。
      - 右：即时对话消息流与富文本输入区（`DMConversationPane` + `DMComposer`）。

---

### 3.3 富通知卡片设计 (`NotificationItemCard.vue`)

#### 1. 结构与视觉层次
```
+-------------------------------------------------------------------------+
| [Avatar]  张三 回复了你在《夜曲》下的评论 · 10分钟前          [●] [标为已读] [...] |
|   (角标)                                                                 |
|                                                                         |
|   +-------------------------------------------------------------------+ |
|   | 对方回复：“这首吉他 Solo 和鼓点的过渡太丝滑了！”                        | |
|   | 引用原评：“整首歌的混音空间感比录音室版好太多。”                       | |
|   +-------------------------------------------------------------------+ |
|                                                                         |
|                                                     [ 前往来源内容 -> ] |
+-------------------------------------------------------------------------+
```

1. **Avatar & Badge**：
   - 头像大小 `36px`（移动端 `32px`）。
   - 动作徽标（`14px`）：
     - 点赞：`Heart`（`var(--a-color-danger)`）
     - 回复：`MessageSquare`（`var(--a-color-primary)`）
     - @提及：`AtSign`（`var(--a-color-success)`）
     - 协作提案：`GitPullRequest` / `Edit`（`var(--a-color-warning)`）
     - 系统公告：`ShieldAlert` / `Bell`（`var(--a-color-blog)`）
2. **Context Quote Block (`NotificationContextQuote.vue`)**：
   - 背景为微柔底色（`var(--a-color-surface-muted)`）或左侧边线（`2px solid var(--a-color-border)`）。
   - 展现交互双方的内容截断（最多 2 行，超出省略号）。
3. **Actions & States**：
   - 未读状态：卡片左侧或标题旁带实心蓝色标记点 `6px`，卡片底色保持纯白，文字高对比。
   - 已读状态：标记点隐去，时间与主体文字呈现柔和灰度。
   - 更多菜单（`...`）：提供「不再提醒此类动态」与「不再提醒此内容」。

---

## 4. 纯白双缺口极简设计系统（Pure-White Minimal System）硬性约束

| 维度 | 规则标准 | 禁止模式 |
| :--- | :--- | :--- |
| **容器表面 (Surface)** | `var(--a-color-bg)` / `#ffffff` 纯白 | 严禁 `var(--a-color-surface)` 作为大卡片面底，严禁毛玻璃 `backdrop-filter` |
| **分割线 (Borders)** | 外轮廓 `var(--a-color-border)`，内部分隔 `var(--a-color-border-soft)` | 严禁硬编码 hex 或生硬黑色线条 |
| **圆角 (Radius)** | 卡片 `var(--a-radius-card)` (4px)，按钮/控件 `var(--a-radius-control)` (4px) | 严禁 `8px`, `12px`, `16px` 或 `999px` 大胶囊（头像除外） |
| **字重 (Typography)** | 标题与动作 `500`，重点强调态 `600` | 严禁 `700`, `800`, `bold` 等笨重字重 |
| **阴影 (Shadows)** | 仅使用 `var(--a-shadow-sm)` 与 `var(--a-shadow-lg)` | 严禁裸写 `box-shadow: 0 4px ... rgb(...)` |
| **文案 (Copy)** | 自然用户态，如“暂无通知”、“来源已不可用” | 严禁出现“UUID”、“API Error”、“System”等开发者用语 |

---

## 5. 数据状态流与业务逻辑契约

1. **乐观已读处理（Optimistic Read）**：
   - 用户点击卡片或“标记已读”时，Pinia store 立即本地减少对应分类与全局未读计数，并向后端异步发送 `PUT /api/v1/notifications/{id}/read`。
2. **WebSocket 实时推送联动**：
   - 现有 `useInboxStore` 收到 `event: 'notification'` 时：
     - `useNotificationStore.receiveNotification(n)` 将新通知推至顶部列表。
     - Topbar 铃铛未读数即时跳变。
     - 若当前用户正打开 Popover 或处于对应 Tab，视图即刻无缝插入新卡片。
3. **免打扰联动**：
   - 点击免打扰后调用 `POST /api/v1/notifications/mutes`，本地即时过滤掉该源（source）的现有卡片并更新未读数。

---

## 6. 验证与测试策略

1. **单元测试与组件快照契约**：
   - `NotificationPopover.spec.ts`：测试浮层展开/关闭、快捷全部已读、条目跳转契约。
   - `NotificationItemCard.spec.ts`：测试不同类型通知的徽章渲染、上下文引用提取与点击触发。
   - `InboxPage.spec.ts`：更新原有的三栏测试，验证双栏结构、分类切换、仅看未读过滤及 DM 双栏工作台切换。
2. **工程健康度检查**：
   - `bun run type-check` 保证 0 TS 类型报错。
   - `bun run test:unit` 全量测试套件通过。
   - `bun run build` 确保生产环境打包编译成功。
