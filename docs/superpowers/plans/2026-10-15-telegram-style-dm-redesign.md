# Telegram 风格独立全屏私信工作台实现计划 (Telegram-Style DM Workspace Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于 Telegram Web 优秀交互范式，将私信全面重塑为独立全屏三栏工作台 `/messages`，包含即时检索会话列表、淡主色内嵌时间气泡流、Enter 发送与剪贴板贴图输入台、以及可折叠联系人名片抽屉。

**Architecture:** 
- `src/views/messages/MessagesWorkspaceView.vue` 作为独立顶级工作台入口，自适应视口高度（`100dvh - var(--a-topbar-height)`），承载三栏响应式架构（会话列表 320px + 主聊天舞台 flex:1 + 联系人名片抽屉 280px）；
- `DMConversationList.vue` 提供即时联系人/摘要检索、4px 微圆角头像、发信 `✓` 标记与语义未读徽标；
- `DMConversationPane.vue` 实现 5 分钟连续消息成组、跨天居中日期微胶囊、极简淡主色气泡（选项 A）与悬停微操作条；
- `DMComposer.vue` 实现 `Enter` 发送 / `Shift+Enter` 换行、剪贴板截图粘贴识别与待发图片暂存；
- `DMPartyProfileDrawer.vue` 提供 Telegram 经典的联系人名片抽屉；
- 路由 `/messages` 挂载，`/inbox?tab=dm` 自动重定向，顶栏私信链接同步直达。

**Tech Stack:** Vue 3.5, TypeScript 5.9, Pinia 3, Vue Router 4, Tailwind CSS v4, Tabler Icons Vue, Vitest.

## Global Constraints

- **R1 纯白表面**：卡片、页面、工作台基础背景一律使用 `#ffffff` / `var(--a-color-bg)`。严禁 `var(--a-color-surface)` 作为表面底色。
- **R2 柔和分界**：常规边线使用 `var(--a-color-border-soft)` 或 `var(--a-color-border)`。
- **R3 令牌阴影**：仅允许 `var(--a-shadow-*)`，严禁裸写 `rgb()` 阴影。
- **R4 小圆角**：4px（`var(--a-radius-card)` / `var(--a-radius-control)`），严禁 999px 大药丸或未经定义的粗大圆角。
- **R5 克制字重**：标题与人名使用 500（强调态 600），杜绝 700/800/bold。
- **R6 气泡色彩（选项 A）**：发送方使用 `color-mix(in srgb, var(--a-color-primary) 10%, #ffffff)` 淡雅微底 + 微弱主色描边；接收方为纯白 `#ffffff` + 柔和微边线。
- **R7 纯净用户文案**：杜绝开发者技术黑话，报错信息收敛为自然友好的用户指导语言。

---

### Task 1: 重构会话列表与收件箱选择器（`DMConversationList.vue` & `DMMailboxSelector.vue`）

**Files:**
- Modify: `src/components/dm/DMConversationList.vue`
- Modify: `src/components/dm/DMMailboxSelector.vue`
- Test: `tests/unit/components/dm/DMConversationList.spec.ts`

**Interfaces:**
- Consumes:
  - `DMConversation`, `DMMailbox` from `@/api/dm`
- Produces:
  - `DMConversationList.vue`:
    - Props: `conversations: DMConversation[]`, `activeConversationId: string`, `loading: boolean`, `hasMore: boolean`
    - Emits: `'open-conversation': [id: string]`, `'load-more': []`
    - Features: 搜索输入框实时过滤、4px 头像/首字母兜底、发信状态对勾 `✓`、未读计数胶囊、相对时间格式化
  - `DMMailboxSelector.vue`:
    - Props: `mailboxes: DMMailbox[]`, `activeMailboxKey: string`
    - Emits: `'select-mailbox': [key: string]`

- [ ] **Step 1: 编写测试用例 `tests/unit/components/dm/DMConversationList.spec.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DMConversationList from '@/components/dm/DMConversationList.vue'
import type { DMConversation } from '@/api/dm'

const mockConversations: DMConversation[] = [
  {
    id: 'conv-1',
    mailbox: { type: 'user', id: 'u1', display_name: 'Alice', unread_count: 0 },
    other_party: { type: 'user', id: 'u2', display_name: 'Bob', avatar_url: 'https://example.com/bob.jpg' },
    last_message_at: '2026-10-15T14:30:00Z',
    last_message_preview: '下午好',
    unread_count: 2,
    blocked: false,
    reply_as: { type: 'user', id: 'u1', display_name: 'Alice' },
  },
  {
    id: 'conv-2',
    mailbox: { type: 'user', id: 'u1', display_name: 'Alice', unread_count: 0 },
    other_party: { type: 'user', id: 'u3', display_name: 'Charlie' },
    last_message_at: '2026-10-14T09:00:00Z',
    last_message_preview: '收到，谢谢',
    unread_count: 0,
    blocked: false,
    reply_as: { type: 'user', id: 'u1', display_name: 'Alice' },
  },
]

describe('DMConversationList', () => {
  it('renders list with avatars, names, previews and unread badges', () => {
    const wrapper = mount(DMConversationList, {
      props: { conversations: mockConversations, activeConversationId: 'conv-1', loading: false, hasMore: false },
    })
    expect(wrapper.text()).toContain('Bob')
    expect(wrapper.text()).toContain('Charlie')
    expect(wrapper.find('[data-testid="dm-unread-badge"]').text()).toBe('2')
  })

  it('filters conversations when typing in the search box', async () => {
    const wrapper = mount(DMConversationList, {
      props: { conversations: mockConversations, activeConversationId: '', loading: false, hasMore: false },
    })
    const searchInput = wrapper.find('input[type="search"]')
    await searchInput.setValue('Charlie')
    expect(wrapper.text()).not.toContain('Bob')
    expect(wrapper.text()).toContain('Charlie')
  })

  it('emits open-conversation on item click', async () => {
    const wrapper = mount(DMConversationList, {
      props: { conversations: mockConversations, activeConversationId: '', loading: false, hasMore: false },
    })
    await wrapper.find('[data-testid="dm-conversation-conv-1"]').trigger('click')
    expect(wrapper.emitted('open-conversation')?.[0]).toEqual(['conv-1'])
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

运行：`bun run test:unit tests/unit/components/dm/DMConversationList.spec.ts`

- [ ] **Step 3: 重构 `DMConversationList.vue` 与 `DMMailboxSelector.vue`**

1. 在 `DMConversationList.vue` 中：
   - 顶部增加搜索输入框：`<input v-model="searchQuery" type="search" placeholder="搜索联系人或消息..." class="dm-conversation-search-input" />`；
   - 对 `conversations` 根据 `searchQuery` 进行响应式客户端模糊匹配；
   - 每个卡片增加头像渲染（`<img v-if="conversation.other_party.avatar_url" :src="..." />`，否则显示首字母微标）；
   - 卡片时间使用友好格式化（当天显示 `HH:mm`，跨天显示 `M/d` 或 `昨天`）；
   - 未读数使用微圆角胶囊 `data-testid="dm-unread-badge"`；
   - 纯白表面、4px 控制圆角、柔和分割线。
2. 在 `DMMailboxSelector.vue` 中：
   - 将粗糙的原生 `<select>` 升级为带纯白设计和向下箭头的下拉选择器，符合纯白极简系统规范。

- [ ] **Step 4: 运行测试并验证通过**

运行：`bun run test:unit tests/unit/components/dm/DMConversationList.spec.ts`
运行：`bun run type-check`

- [ ] **Step 5: 提交更改**

`git add src/components/dm/DMConversationList.vue src/components/dm/DMMailboxSelector.vue tests/unit/components/dm/DMConversationList.spec.ts`
`git commit -m "feat(dm): upgrade DMConversationList with search filter, avatars, and pure-white mailbox selector"`

---

### Task 2: 消息流与输入台深度重构（`DMConversationPane.vue` & `DMComposer.vue`）

**Files:**
- Modify: `src/components/dm/DMConversationPane.vue`
- Modify: `src/components/dm/DMComposer.vue`
- Test: `tests/unit/components/dm/DMConversationPane.spec.ts`
- Test: `tests/unit/components/dm/DMComposer.spec.ts`

**Interfaces:**
- Consumes:
  - `DMConversation`, `DMMessage`, `DMImage` from `@/api/dm`
- Produces:
  - `DMConversationPane.vue`:
    - Props: `conversation?: DMConversation | null`, `messages: DMMessage[]`, `hasMore: boolean`, `loading: boolean`, `mobile?: boolean`, `targetLabel?: string`
    - Emits: `'load-older': []`, `back: []`, `block: []`, `unblock: []`, `report: [messageId: string]`, `'toggle-drawer': []`
    - Features: 居中日期微指示条、5 分钟内连续消息聚合分组、选项 A 极简淡主色气泡、内嵌微型时间与送达对勾、悬浮微工具条（复制/举报）
  - `DMComposer.vue`:
    - Props: `modelValue?: string`, `disabled?: boolean`, `sending?: boolean`, `replyAsLabel?: string`, `error?: string`, `image?: DMImage | null`
    - Emits: `'update:modelValue': [value: string]`, `send: [payload: { content: string; imageId?: string }]`, `'upload-image': [file: File]`, `'remove-image': []`
    - Features: `Enter` 发送 / `Shift+Enter` 换行、剪贴板贴图粘贴监听、图片卡片预览、拉黑禁用引导

- [ ] **Step 1: 编写测试用例 `tests/unit/components/dm/DMComposer.spec.ts` 与 `DMConversationPane.spec.ts`**

```typescript
// tests/unit/components/dm/DMComposer.spec.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DMComposer from '@/components/dm/DMComposer.vue'

describe('DMComposer', () => {
  it('emits send on Enter keypress without Shift', async () => {
    const wrapper = mount(DMComposer, {
      props: { modelValue: '你好呀', disabled: false, sending: false },
    })
    const textarea = wrapper.find('textarea')
    await textarea.trigger('keydown.enter', { shiftKey: false })
    expect(wrapper.emitted('send')?.[0]).toEqual([{ content: '你好呀', imageId: undefined }])
  })

  it('does not emit send on Shift+Enter', async () => {
    const wrapper = mount(DMComposer, {
      props: { modelValue: '第一行', disabled: false, sending: false },
    })
    const textarea = wrapper.find('textarea')
    await textarea.trigger('keydown.enter', { shiftKey: true })
    expect(wrapper.emitted('send')).toBeUndefined()
  })

  it('detects image from paste event and emits upload-image', async () => {
    const wrapper = mount(DMComposer, { props: { disabled: false } })
    const file = new File(['dummy'], 'screenshot.png', { type: 'image/png' })
    const pasteEvent = {
      clipboardData: {
        files: [file],
      },
      preventDefault: () => {},
    }
    await wrapper.find('textarea').trigger('paste', pasteEvent)
    expect(wrapper.emitted('upload-image')?.[0]).toEqual([file])
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

运行：`bun run test:unit tests/unit/components/dm/DMComposer.spec.ts`

- [ ] **Step 3: 重构 `DMConversationPane.vue` 与 `DMComposer.vue`**

1. 在 `DMConversationPane.vue` 中：
   - 消息流聚合逻辑：编写 `groupedMessages` 计算属性，计算消息之间的时间跨度与发送人；
   - 跨天时插入日期指示条：`<div class="dm-date-divider"><span>{{ dateLabel }}</span></div>`；
   - 气泡结构：
     - 发送方气泡样式：`background: color-mix(in srgb, var(--a-color-primary) 10%, #ffffff); border: 1px solid color-mix(in srgb, var(--a-color-primary) 20%, transparent);`；
     - 接收方气泡样式：`background: #ffffff; border: 1px solid var(--a-color-border-soft);`；
     - 气泡内嵌右下角时间微标与对勾：`<span class="dm-bubble-meta">{{ formatMessageTime(message.created_at) }}<IconCheck :size="12" /></span>`；
     - 悬停浮层：移走裸露的举报文字，在 `.dm-message:hover` 时展示悬浮微条，提供复制文本按钮与举报按钮（`IconCopy`, `IconFlag`）；
   - 头部右侧操作区：增加展开侧边抽屉按钮（`@click="emit('toggle-drawer')"`）。
2. 在 `DMComposer.vue` 中：
   - 监听 `keydown.enter`：若无 `shiftKey` 则阻止默认事件并执行 `submit()`；
   - 监听 `paste`：提取 `e.clipboardData.files` 中的图片文件并触发 `emit('upload-image', file)`；
   - 图片预览卡片强化：轻量 4px 卡片，带删除快捷叉号；
   - 提示文案与拉黑态收敛。

- [ ] **Step 4: 运行测试并验证通过**

运行：`bun run test:unit tests/unit/components/dm/DMComposer.spec.ts tests/unit/components/dm/DMConversationPane.spec.ts`
运行：`bun run type-check`

- [ ] **Step 5: 提交更改**

`git add src/components/dm/DMConversationPane.vue src/components/dm/DMComposer.vue tests/unit/components/dm/DMComposer.spec.ts tests/unit/components/dm/DMConversationPane.spec.ts`
`git commit -m "feat(dm): modernize message grouping, bubbles, enter-to-send, and paste-image upload"`

---

### Task 3: 实现 Telegram 风格联系人名片抽屉（`DMPartyProfileDrawer.vue`）

**Files:**
- Create: `src/components/dm/DMPartyProfileDrawer.vue`
- Test: `tests/unit/components/dm/DMPartyProfileDrawer.spec.ts`

**Interfaces:**
- Consumes:
  - `DMParty`, `DMConversation` from `@/api/dm`
- Produces:
  - `DMPartyProfileDrawer.vue`:
    - Props: `party: DMParty`, `conversation?: DMConversation | null`
    - Emits: `'close': []`, `'block': []`, `'unblock': []`, `'report': []`
    - Features: 4px 大头像、用户昵称、身份类型标签、前往用户个人主页链接、拉黑/解除拉黑按钮、举报按钮、Escape 关闭

- [ ] **Step 1: 编写测试用例 `tests/unit/components/dm/DMPartyProfileDrawer.spec.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DMPartyProfileDrawer from '@/components/dm/DMPartyProfileDrawer.vue'
import type { DMParty, DMConversation } from '@/api/dm'

const mockParty: DMParty = {
  type: 'user',
  id: 'user-123',
  display_name: 'David',
  avatar_url: 'https://example.com/david.png',
}

const mockConv: DMConversation = {
  id: 'conv-123',
  mailbox: { type: 'user', id: 'my-id', display_name: 'Me', unread_count: 0 },
  other_party: mockParty,
  last_message_at: null,
  last_message_preview: '',
  unread_count: 0,
  blocked: false,
  reply_as: { type: 'user', id: 'my-id', display_name: 'Me' },
}

describe('DMPartyProfileDrawer', () => {
  it('renders party avatar, name, and profile link', () => {
    const wrapper = mount(DMPartyProfileDrawer, {
      props: { party: mockParty, conversation: mockConv },
    })
    expect(wrapper.text()).toContain('David')
    const profileLink = wrapper.find('a[href="/profile/user-123"]')
    expect(profileLink.exists()).toBe(true)
  })

  it('emits block when clicking block button and unblocked', async () => {
    const wrapper = mount(DMPartyProfileDrawer, {
      props: { party: mockParty, conversation: mockConv },
    })
    await wrapper.find('[data-testid="dm-drawer-block-btn"]').trigger('click')
    expect(wrapper.emitted('block')).toHaveLength(1)
  })

  it('emits close on clicking close button', async () => {
    const wrapper = mount(DMPartyProfileDrawer, {
      props: { party: mockParty, conversation: mockConv },
    })
    await wrapper.find('[data-testid="dm-drawer-close-btn"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

运行：`bun run test:unit tests/unit/components/dm/DMPartyProfileDrawer.spec.ts`

- [ ] **Step 3: 实现 `DMPartyProfileDrawer.vue`**

1. 结构：
   - 顶部 Header：标题“联系人信息”，关闭按钮（`IconX`，`data-testid="dm-drawer-close-btn"`）；
   - 主体：
     - 大尺寸 4px 微圆角头像与首字母兜底；
     - 昵称（`font-weight: 500`）与用户 ID；
     - 快速操作行：查看个人主页按钮（`<RouterLink :to="profilePath">`）；
     - 关系与风控：拉黑/解除拉黑按钮（`data-testid="dm-drawer-block-btn"`）、举报联系人按钮；
2. 样式遵循 Pure-White Minimal System：
   - 背景：`#ffffff` / `var(--a-color-bg)`；
   - 边线：`border-left: 1px solid var(--a-color-border-soft)`；
   - 圆角：4px。

- [ ] **Step 4: 运行测试并验证通过**

运行：`bun run test:unit tests/unit/components/dm/DMPartyProfileDrawer.spec.ts`
运行：`bun run type-check`

- [ ] **Step 5: 提交更改**

`git add src/components/dm/DMPartyProfileDrawer.vue tests/unit/components/dm/DMPartyProfileDrawer.spec.ts`
`git commit -m "feat(dm): create DMPartyProfileDrawer component for Telegram-style user info panel"`

---

### Task 4: 构建独立全屏工作台视图（`MessagesWorkspaceView.vue`）、路由注册与系统集成

**Files:**
- Create: `src/views/messages/MessagesWorkspaceView.vue`
- Modify: `src/router/buildBaseAppRoutes.ts`
- Modify: `src/views/feed/InboxPage.vue`
- Modify: `src/components/system/AppTopbarAuthControls.vue`
- Test: `tests/unit/views/messages/MessagesWorkspaceView.spec.ts`

**Interfaces:**
- Consumes:
  - `useDMStore` from `@/stores/dm`
  - `DMConversationList`, `DMConversationPane`, `DMComposer`, `DMPartyProfileDrawer`, `DMReportModal`
- Produces:
  - Route `/messages` pointing to `MessagesWorkspaceView.vue`
  - `/inbox?tab=dm` auto redirect to `/messages`
  - Topbar & Notification popover DM links pointing to `/messages`

- [ ] **Step 1: 编写测试用例 `tests/unit/views/messages/MessagesWorkspaceView.spec.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MessagesWorkspaceView from '@/views/messages/MessagesWorkspaceView.vue'
import { useDMStore } from '@/stores/dm'

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  RouterLink: { template: '<a><slot /></a>' },
}))

describe('MessagesWorkspaceView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders three-column layout structure', () => {
    const wrapper = mount(MessagesWorkspaceView)
    expect(wrapper.find('[data-testid="dm-workspace-layout"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="dm-conversation-list"]').exists()).toBe(true)
  })

  it('shows empty placeholder when no conversation is selected', () => {
    const wrapper = mount(MessagesWorkspaceView)
    expect(wrapper.text()).toContain('选择一个会话开始聊天')
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

运行：`bun run test:unit tests/unit/views/messages/MessagesWorkspaceView.spec.ts`

- [ ] **Step 3: 实现 `MessagesWorkspaceView.vue` 并注册路由**

1. 实现 `MessagesWorkspaceView.vue`：
   - 布局：三栏容器 `.messages-workspace`，高度 `calc(100dvh - var(--a-topbar-height))`，`background: var(--a-color-bg)`；
   - 左栏：放置 `DMMailboxSelector` 和 `DMConversationList`；
   - 中栏：当有活动会话时渲染 `DMConversationPane` + 插槽内 `DMComposer`；无会话时渲染居中的极简水印与占位提示“选择一个会话开始聊天”；
   - 右栏：当 `drawerOpen` 开启且有活动会话时渲染 `DMPartyProfileDrawer`；
   - 移动端适配：屏幕宽度 `< 768px` 时根据是否有活动会话切换会话列表与聊天窗，抽屉采用 `PSheet` 弹出；
   - 挂载逻辑：检查路由 `conversationId` 或 `targetType` & `targetId`，自动打开并初始化。
2. 更新路由：
   - 在 `src/router/buildBaseAppRoutes.ts` 中注册 `{ path: '/messages', component: () => import('@/views/messages/MessagesWorkspaceView.vue'), meta: { requiresAuth: true } }`；
3. 更新兼容性重定向：
   - 在 `src/views/feed/InboxPage.vue` 中：检测到 `route.query.tab === 'dm'` 时，自动 `router.replace('/messages')`；
4. 更新导航链接：
   - 在 `src/components/system/AppTopbarAuthControls.vue` 与 `NotificationPopover.vue` 中将私信入口从 `/inbox?tab=dm` 指向 `/messages`。

- [ ] **Step 4: 运行全量测试与规范检查**

运行：
- `bun run test:unit tests/unit/views/messages/ tests/unit/components/dm/`
- `bun run test:unit tests/unit/views/feed/InboxPage.spec.ts`
- `bun run test:unit tests/unit/ui/design-system-contract.spec.ts`
- `bun run type-check`
- `bun run build`

- [ ] **Step 5: 提交更改**

`git add src/views/messages/ src/router/buildBaseAppRoutes.ts src/views/feed/InboxPage.vue src/components/system/ tests/unit/views/messages/`
`git commit -m "feat(messages): implement MessagesWorkspaceView route /messages and integration"`

---

## Plan Self-Review & Verification Checklist

- [x] 所有任务均从“编写失败测试”开始（TDD 驱动）；
- [x] 气泡视觉严格遵循用户选择的“选项 A：极简淡主色微底 + 内嵌时间”；
- [x] 遵守 Pure-White Double-Notch 极简规范（纯白表面、4px 控制圆角、克制字重 500、柔和边线、语义令牌）；
- [x] 包含完整的向后兼容与重定向（`/inbox?tab=dm` -> `/messages`）；
- [x] 构建与类型检查覆盖。
