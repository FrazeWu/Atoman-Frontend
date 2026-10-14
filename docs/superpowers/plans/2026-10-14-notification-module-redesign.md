# 通知模块全栈 UI 重构实施计划 (Notification Module Redesign Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全面重塑通知模块 UI，包括顶部导航栏纯白悬浮面板（`NotificationPopover.vue`）、现代化流式双栏消息中心（`InboxPage.vue`）、以及自包含富通知卡片体系（`NotificationItemCard.vue`）。

**Architecture:** 
1. 顶栏集成 `NotificationPopover.vue` 挂载于铃铛图标，支持即时预览未读、一键已读与平滑跳转。
2. 抽离可复用的富通知卡片 `NotificationItemCard.vue` 与上下文引用组件 `NotificationContextQuote.vue`，具备动作语义徽标、原文引用与行内快捷操作。
3. 将 `/inbox` 重构为高效双栏架构（左侧分类导航 + 主区域自包含通知流 / 私信工作台切换）。

**Tech Stack:** Vue 3.5, TypeScript 5.9, Pinia 3, Tabler Icons, Vitest, Pure-White Double-Notch Minimal System.

## Global Constraints

- **R1 纯白表面**：容器、浮层、卡片背景强制使用 `var(--a-color-bg)` / `#ffffff`，严禁 `var(--a-color-surface)`。
- **R2 柔和分界**：边线使用 `var(--a-color-border)`，内部分隔使用 `var(--a-color-border-soft)`。
- **R3 令牌阴影**：仅允许 `var(--a-shadow-sm)` 与 `var(--a-shadow-lg)`，严禁裸写 `rgb()` 阴影。
- **R4 小圆角**：卡片与控件统一采用 4px（`var(--a-radius-card)` / `var(--a-radius-control)`）。
- **R5 克制字重**：标题与常规文本字重 500，强调态 600，杜绝 700/800/bold。
- **R8 纯净用户文案**：禁止暴露内部黑话（如“UUID”、“API Error”），采用自然用户态。

---

### Task 1: 富通知卡片组件（`NotificationContextQuote.vue` & `NotificationItemCard.vue`）

**Files:**
- Create: `src/components/notification/NotificationContextQuote.vue`
- Create: `src/components/notification/NotificationItemCard.vue`
- Test: `tests/unit/components/notification/NotificationItemCard.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  // NotificationItemCard.vue
  props: {
    notification: Notification
    compact?: boolean // 用于 Popover 紧凑模式
    active?: boolean
  }
  emits: {
    'click': [id: string]
    'mark-read': [id: string]
    'mute-type': [notification: Notification]
    'mute-source': [notification: Notification]
  }
  ```

- [ ] **Step 1: 编写失败的单元测试**
  在 `tests/unit/components/notification/NotificationItemCard.spec.ts` 中编写测试：
  - 验证点赞、回复、@我、系统公告等不同类型通知的徽章图标与文案渲染。
  - 验证上下文引用块渲染。
  - 验证未读实心圆点存在，已读状态下圆点隐藏。
  - 验证点击卡片、标记已读与免打扰事件派发。

- [ ] **Step 2: 运行测试确保失败**
  运行 `bun run test:unit tests/unit/components/notification/NotificationItemCard.spec.ts`，确保模块尚未存在导致失败。

- [ ] **Step 3: 实现 `NotificationContextQuote.vue`**
  渲染引用上下文块：展示对方回复或原评摘要（最多 2 行截断，背景微柔或左边框标记）。

- [ ] **Step 4: 实现 `NotificationItemCard.vue`**
  实现富通知卡片：
  - 头像区：`36px` 圆形头像，右下角动作类型徽标（赞=Heart, 评=MessageSquare, @=AtSign, 协作=Edit, 系统=ShieldAlert）。
  - 主体区：动态行为句子、相对时间戳、`NotificationContextQuote`。
  - 操作区：未读蓝点（`6px`）、标记已读按钮、前往按钮、免打扰更多操作下拉。
  - 样式遵循 Pure-White 规范：底色纯白、圆角 4px、细边框 `var(--a-color-border-soft)`。

- [ ] **Step 5: 重新运行测试确保通过**
  运行 `bun run test:unit tests/unit/components/notification/NotificationItemCard.spec.ts`。

- [ ] **Step 6: 提交代码**
  `git add src/components/notification tests/unit/components/notification && git commit -m "feat(notification): create NotificationItemCard and NotificationContextQuote components"`

---

### Task 2: 顶部通知悬浮面板（`NotificationPopover.vue` & `AppTopbarAuthControls.vue`）

**Files:**
- Create: `src/components/system/NotificationPopover.vue`
- Modify: `src/components/system/AppTopbarAuthControls.vue`
- Test: `tests/unit/components/system/NotificationPopover.spec.ts`

**Interfaces:**
- Consumes: `NotificationItemCard.vue`, `useNotificationStore`, `useInboxStore`
- Produces: `NotificationPopover.vue` (顶部 Popover 面板)

- [ ] **Step 1: 编写失败的单元测试**
  在 `tests/unit/components/system/NotificationPopover.spec.ts` 中编写测试：
  - 浮层展开与收起状态切换。
  - 渲染最近未读列表（复用 `NotificationItemCard compact`）。
  - 点击“全部标为已读”触发 `notificationStore.markAllRead`。
  - 点击条目触发已读并路由跳转、面板自动关闭。
  - 查看全部与私信底部跳转入口。

- [ ] **Step 2: 运行测试确认失败**
  运行 `bun run test:unit tests/unit/components/system/NotificationPopover.spec.ts`。

- [ ] **Step 3: 实现 `NotificationPopover.vue`**
  - 纯白面板（`380px` 宽，最大高度 `480px`），边框 `var(--a-color-border-soft)`，阴影 `var(--a-shadow-lg)`，圆角 `4px`。
  - 头部：标题「通知」+ 未读数量胶囊 + 幽灵按钮「全部已读」。
  - 列表区：最新通知列表（紧凑卡片渲染），空状态呈现「暂无未读通知」。
  - 底部栏：固定「进入收件箱查看全部」与「私信」链接。
  - 挂载 Escape 与外部点击自动关闭监听。

- [ ] **Step 4: 集成到 `AppTopbarAuthControls.vue`**
  - 替换原有的直接 `<RouterLink to="/inbox">` 为点击切换 Popover 的触发按钮（保留可访问性与键盘导航）。
  - 在移动端窄屏下保持直接点击跳转 `/inbox` 的兼容降级。

- [ ] **Step 5: 重新运行测试确保通过**
  运行 `bun run test:unit tests/unit/components/system/NotificationPopover.spec.ts tests/unit/components/AppTopbar.auth-loading.spec.ts`。

- [ ] **Step 6: 提交代码**
  `git add src/components/system tests/unit/components/system && git commit -m "feat(notification): implement NotificationPopover in AppTopbarAuthControls"`

---

### Task 3: 消息中心主页面流式双栏重构（`InboxPage.vue`）

**Files:**
- Modify: `src/views/feed/InboxPage.vue`
- Test: `tests/unit/views/feed/InboxPage.spec.ts`

**Interfaces:**
- Consumes: `NotificationItemCard.vue`, `useNotificationStore`, `useDMStore`, `useInboxStore`

- [ ] **Step 1: 编写失败的单元测试**
  在 `tests/unit/views/feed/InboxPage.spec.ts` 中编写或更新测试：
  - 双栏布局验证：左侧分类导航 + 右侧通知流（不再存在传统第三栏详情卡片）。
  - 分类切换（全部/点赞/@我/回复/协作/系统）。
  - 「全部」与「仅看未读」过滤开关联动。
  - 切换至「私信 (dm)」时，主区域无缝渲染双栏聊天工作台（邮箱选择/会话列表 + 会话窗口）。

- [ ] **Step 2: 重构 `InboxPage.vue` 模板与排版**
  - 移除原 `.inbox-body` 的 3 栏网格，重塑为响应式双栏：
    - `.inbox-category-pane`（左侧导航，固定 `220px`）。
    - `.inbox-main-pane`（主展示区域，包含顶部工具栏与流式卡片列表）。
  - 将通知列表项替换为 `NotificationItemCard`，实现行内操作。
  - 增强顶部工具栏：分类标题、未读数统计、「全部/仅未读」分段切换器、一键全部已读。
  - 当 `activeTab === 'dm'` 时，挂载私信双栏工作台，保留原有会话与输入逻辑。

- [ ] **Step 3: 运行测试确保通过**
  运行 `bun run test:unit tests/unit/views/feed/InboxPage.spec.ts`。

- [ ] **Step 4: 提交代码**
  `git add src/views/feed/InboxPage.vue tests/unit/views/feed/InboxPage.spec.ts && git commit -m "refactor(inbox): overhaul InboxPage to modern dual-pane stream and chat workspace"`

---

### Task 4: 全局工程验证、契约同步与生产构建

**Files:**
- Modify/Verify: 全局相关测试契约

- [ ] **Step 1: 运行全量 TypeScript 类型检查**
  运行 `bun run type-check`，确保 0 错误。

- [ ] **Step 2: 运行全部通知与收件箱相关测试套件**
  运行 `bun run test:unit tests/unit/components/notification/ tests/unit/components/system/NotificationPopover.spec.ts tests/unit/views/feed/InboxPage.spec.ts`。

- [ ] **Step 3: 运行生产环境打包验证**
  运行 `bun run build`，确保静态编译成功。

- [ ] **Step 4: 检查并提交整合提交**
  确认 working tree clean。
