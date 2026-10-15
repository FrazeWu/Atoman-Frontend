# Telegram 风格独立全屏私信工作台设计规范 (Telegram-Style DM Workspace Design Spec)

- **日期**：2026-10-15
- **分支/模块**：`Atoman-Frontend` / `src/views/messages/`, `src/components/dm/`
- **状态**：Draft -> Ready for Implementation

---

## 1. 目标与背景 (Goals & Context)

### 1.1 现状与痛点
现有私信功能作为 `/inbox?tab=dm` 下的一个内嵌子模块存在诸多体验与视觉上的不足：
1. **视觉粗糙且失衡**：发送方消息气泡采用高对比纯黑底色（`#111827`），与整体纯白极简系统脱节；接收方消息旁裸露悬挂“举报”文字按钮；
2. **现代即时通信能力缺失**：
   - 缺少头像展示（虽然 API 底层数据包含 `avatar_url`）；
   - 消息气泡缺少内嵌时间戳与跨天居中日期分割线；
   - 缺少连续消息成组（Message Grouping），多条连发消息造成视觉零碎；
   - 输入框缺少现代聊天必备交互（`Enter` 发送、`Shift+Enter` 换行、剪贴板贴图直接识别上传）；
3. **空间受限**：嵌套在通知收件箱内导致横向与纵向视口被分割，无法提供沉浸式桌面沟通体验。

### 1.2 重塑愿景
参考 **Telegram Web (Web K / Desktop)** 的优秀交互范式，将私信提升为独立顶层沉浸式工作台 `/messages`。严格遵循 Atoman 的 **Pure-White Double-Notch 极简设计系统**（纯白表面、4px 控制圆角、克制字重 500/600、柔和分割线、语义令牌色彩）。

---

## 2. 路由与架构规划 (Routing & Architecture)

### 2.1 路由定义
- **新增顶级路由**：
  - 路径：`/messages`
  - 视图组件：`src/views/messages/MessagesWorkspaceView.vue`
  - 权限要求：`meta: { requiresAuth: true }`
- **向后兼容与重定向**：
  - 访问 `/inbox?tab=dm` 时，由 `InboxPage.vue` 检测到后自动平滑跳转至 `/messages`，保持书签和历史链接的健壮性；
  - 顶部导航栏（`AppTopbarAuthControls.vue`）通知下拉浮层底部的“私信”链接更新为指向 `/messages`。
- **URL 查询参数支持**：
  - `/messages?conversationId=:id`：自动打开并高亮指定会话；
  - `/messages?targetType=:type&targetId=:id`：直接以指定联系人发起新会话草稿（如 `/messages?targetType=user&targetId=123`）。

### 2.2 响应式三栏/自适应视口布局
整个页面充满视口高度（`height: calc(100dvh - var(--a-topbar-height))`），结构分为三栏：

```
+---------------------------------------------------------------------------------------------------------+
| MessagesWorkspaceView                                                                                   |
+----------------------+----------------------------------------------------------+-----------------------+
| 左栏: 会话导航与搜索区 | 中栏: 主聊天舞台                                           | 右栏: 联系人名片抽屉   |
| (320px 固定)          | (flex: 1 弹性撑满)                                        | (280px 可展开/折叠)   |
|                      |                                                          |                       |
| [ 搜索联系人... ]     | [ 对方头像 + 昵称 + 在线状态 ]           [ 搜索 | 名片 | ••• ] | [ 大头像 + 资料详情 ] |
| [ 收件箱身份切换下拉 ] | -------------------------------------------------------- | [ 用户主页跳转链接 ]  |
|                      | (日期微胶囊) "2026年4月17日"                              | [ 私信权限状态说明 ]  |
| [ 会话 1 (头像+摘要) ]|                                                          |                       |
| [ 会话 2 (活跃高亮) ] |   [对方头像] 纯白气泡 (14:30)                             | [ 拉黑/取消拉黑操作 ] |
| [ 会话 3 ... ]       |              [悬停快捷条: 复制/举报]                      | [ 举报该用户操作 ]    |
|                      |                          淡雅微底我方气泡 (14:32 ✓)       |                       |
|                      |                          成组第二条气泡 (14:33 ✓)         |                       |
|                      | -------------------------------------------------------- |                       |
|                      | [图片预览卡片(如有)]                                     |                       |
|                      | [输入框: Enter 发送 / Shift+Enter 换行 / 粘贴图片] [发送] |                       |
+----------------------+----------------------------------------------------------+-----------------------+
```

- **桌面端（≥ 768px）**：左栏固定 320px，中栏弹性伸展，右栏由顶部名片按钮切换显隐（默认桌面宽屏下若选中会话可常驻或记忆展开状态）。
- **移动端（< 768px）**：
  - 状态 A：默认全屏显示会话列表；
  - 状态 B：点击会话后滑入全屏聊天窗口，顶部左侧提供返回会话列表按钮；
  - 状态 C：点击联系人头部时，通过底栏弹窗（`PSheet`）展示联系人资料与操作。

---

## 3. 详细组件设计 (Component Design)

### 3.1 会话列表与收件箱切换 (`DMConversationList.vue` & `DMMailboxSelector.vue`)
- **快速关键词过滤**：列表顶部常驻搜索输入框，支持本地对联系人昵称或最后消息预览进行即时模糊过滤；
- **收件箱选择器（`DMMailboxSelector.vue`）**：
  - 弃用粗糙的原生 `<select>`，重构为符合规范的纯白下拉触发器；
  - 标识当前发信身份（“我的私信” vs 管理的“频道私信”），并标注各自的未读红点或计数；
- **会话卡片项（Item）**：
  - **头像微圆角（4px）**：展示对方头像图片，图片加载失败或为空时展示带文字首字母徽标（兜底背景为 `var(--a-color-surface-muted)`）；
  - **首行**：联系人昵称（`font-weight: 500`）+ 相对格式化时间（`14:32` / `昨天` / `4/17`）；
  - **次行**：最后一条消息文字预览截断（若我方发出则带发送状态图标，图片消息显示 `[图片]`）+ 未读消息徽标（`var(--a-color-primary)` 微型圆角胶囊）；
  - **激活态**：选中项背景为 `var(--a-color-surface-muted)`，左侧配有 2px 细主色指示线。

### 3.2 聊天流与气泡体系 (`DMConversationPane.vue`)
- **居中日期徽标（Date Pill）**：
  - 跨自然日的消息流上方渲染居中的日期指示条（如“2026年4月17日”或“今天”）；
  - 采用极简微字号（`0.75rem`）、柔和文字颜色（`var(--a-color-muted)`），无边框或极淡底色；
- **连续消息成组（Message Grouping）**：
  - 若相邻多条消息来自同一发送者且发送时间间隔在 5 分钟以内：
    - 合并为一组：首条消息渲染发送者身份，末条消息附带微型时间戳，中间消息省略重复头像；
    - 组内气泡上下间距为紧凑的 `2px`，组与组之间保持舒适的 `12px` 间隙；
- **气泡视觉（选项 A：极简高雅淡主色）**：
  - **接收方气泡**：
    - 底色：纯白 `#ffffff` / `var(--a-color-bg)`
    - 边框：`1px solid var(--a-color-border-soft)`
    - 圆角：4px（`var(--a-radius-card)`）
    - 文字：`var(--a-color-text)`
    - 内部右下角内嵌显示紧凑时间（`0.7rem`，`var(--a-color-muted)`）
  - **发送方气泡**：
    - 底色：`color-mix(in srgb, var(--a-color-primary) 10%, #ffffff)`
    - 边框：`1px solid color-mix(in srgb, var(--a-color-primary) 20%, transparent)`
    - 圆角：4px
    - 文字：`var(--a-color-text)`
    - 内部右下角内嵌显示紧凑时间与送达指示（`14:32 ✓`）
- **悬停操作微浮层（Hover Toolbar）**：
  - 彻底移除原本裸露挂在气泡旁的粗糙“举报”文字按钮；
  - 鼠标悬停在气泡上时，在气泡边缘优雅淡入操作工具条（复制内容、举报消息）；
- **图片卡片渲染**：
  - 附带图片的私信消息渲染自适应等比缩略图，圆角 4px，点击可唤起大图预览。

### 3.3 输入台增强 (`DMComposer.vue`)
- **键盘快捷响应**：
  - 默认键盘敲击 `Enter` 直接发送消息；
  - 敲击 `Shift + Enter` 插入换行；
- **剪贴板贴图直接识别**：
  - 在输入区域监听 `@paste` 事件；
  - 若剪贴板中存在图像文件（`image/png`, `image/jpeg`, `image/webp`），自动提取并触发图片上传流程，生成待发送预览卡片；
- **图片暂存预览卡片**：
  - 待发送图片以 4px 微圆角悬浮卡片展示在输入框上方，提供快速移除（`X`）图标按钮；
- **拉黑拦截与状态收敛**：
  - 若会话已被拉黑，输入框锁定为禁用状态，展示收敛提示文案并提供一键“解除拉黑”快捷按钮。

### 3.4 联系人资料与操作抽屉 (`DMPartyProfileDrawer.vue`)
- **资料展示**：展示对方 4px 微圆角大头像、完整昵称、ID、个人简介与身份标签；
- **快捷动作**：
  - 前往个人主页：点击跳转 `/profile/:id`；
  - 会话拉黑管理：切换拉黑/取消拉黑状态；
  - 举报入口：唤起举报模态弹窗（`DMReportModal.vue`）；
- **独立关闭**：右上角提供关闭图标按钮，支持快捷键 `Escape` 关闭。

---

## 4. 数据流与 Store 状态机 (Data Flow & Store Integration)

1. **页面初始化**：
   - 挂载时触发 `dmStore.fetchMailboxes()` 与 `dmStore.fetchConversations()`；
   - 检查 `route.query.conversationId`：若存在则调用 `dmStore.openConversation(id)`；
   - 检查 `route.query.targetType` & `route.query.targetId`：若存在则调用 `dmStore.openTarget(...)`；
   - 桌面端若无指定参数且会话列表非空，自动高亮首个会话；
2. **实时通信与通知联动**：
   - `dmStore` 内置实时事件监听（`dm.message.created`, `dm.message.read`, `dm.mailbox.updated`）；
   - 新消息到达当前处于激活状态的会话时，自动追加到消息流末尾并平滑触底滚动；
   - 对方阅读消息时实时刷新未读标志。

---

## 5. 极简设计契约遵循 (Design System Contract)

- **纯白表面**：卡片与面板基础底色一律为 `#ffffff` / `var(--a-color-bg)`，严禁 `var(--a-color-surface)` 作为顶层底色；
- **柔和分割**：常规边线采用 `var(--a-color-border-soft)`；
- **控制圆角**：统一为 4px（`var(--a-radius-card)` 与 `var(--a-radius-control)`），严禁 999px 大药丸；
- **克制字重**：标题与人名一律使用 500（激活强调态 600），杜绝 700/800/bold；
- **无开发者生硬词汇**：报错提示收敛为自然友好的用户指导语言。

---

## 6. 测试与验证策略 (Testing & Verification)

1. **单元测试矩阵**：
   - `tests/unit/views/messages/MessagesWorkspaceView.spec.ts`：测试三栏联动、路由参数加载、空状态与抽屉显隐；
   - `tests/unit/components/dm/DMConversationList.spec.ts`：测试关键字过滤、未读红点显示、选中激活高亮；
   - `tests/unit/components/dm/DMConversationPane.spec.ts`：测试连续发信分组、日期分割条、气泡时间显示、悬浮工具栏；
   - `tests/unit/components/dm/DMComposer.spec.ts`：测试 Enter 发送、Shift+Enter 换行、剪贴板贴图与拉黑禁用态；
   - `tests/unit/components/dm/DMPartyProfileDrawer.spec.ts`：测试名片渲染、个人主页跳转、拉黑/举报操作派发；
2. **静态契约与构建验证**：
   - `bun run test:unit tests/unit/ui/design-system-contract.spec.ts`（设计系统规范检查 100% 通过）；
   - `bun run type-check`（TypeScript 严格类型检查 0 错误）；
   - `bun run build`（前端生产构建顺利通过）。
