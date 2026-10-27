# 全站异步轻量操作反馈（Toast / 通知）统一治理实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建全局轻量响应式 `useToast` 状态管理与 `PToastHost` 容器，支持最多 3 条并发纵向堆叠、自动淡出与悬停暂停，同时保持与现有 `PToast.vue` 100% 声明式兼容，并将无反馈的剪贴板复制点位标准化接入 Toast 提示。

**Architecture:** 
1. 采用纯 Vue 3 Composition API 在 `src/composables/useToast.ts` 维护全局单例队列 `activeToasts` 与独立倒计时；
2. 在 `src/App.vue` 与 `apps/mobile/MobileApp.vue` 根层挂载 `PToastHost.vue`，通过 Teleport + TransitionGroup 实现标准 52px 纵向堆叠与 0 阴影极简外观；
3. 将现有 `PToast.vue` 升级为代理或保留其独立渲染能力，零破损兼容全站现有用法；
4. 针对 `BookNotesView`、`BookPrivateHighlights`、`DMConversationPane`、`StudioContentView` 等无反馈/内联提示点位接入 `useToast().success(...)`。

**Tech Stack:** Vue 3.4, TypeScript, Vitest, Vue Test Utils.

## Global Constraints

- 严格遵循 0 阴影（`box-shadow: none !important;`）与 4px 圆角（`var(--a-radius-none, 4px)`）规范；
- 遵循真数据原则，杜绝任何 Mock 数据或假状态；
- 用户精心设计的桌面端顶栏交互与视觉（`AppTopbarAuthControls.vue`）绝对不作任何改动；
- 修改完成前必须运行 `bun run type-check` 与 `bun run test:unit` 验证。

---

### Task 1: 核心状态管理 `src/composables/useToast.ts` 实现与单元测试

**Files:**
- Create: `src/composables/useToast.ts`
- Test: `tests/unit/composables/useToast.spec.ts`

**Interfaces:**
- Produces:
  - `useToast(): { show, success, error, warning, info, dismiss, clear, pause, resume, toasts }`
  - `ToastOptions`, `ToastItem`, `ToastType`

- [x] **Step 1: Write the failing test for `useToast`**

```ts
// tests/unit/composables/useToast.spec.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useToast } from '@/composables/useToast'

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    const { clear } = useToast()
    clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('adds a toast and exposes reactive list', () => {
    const toast = useToast()
    const id = toast.success('已复制')
    expect(toast.toasts.value.length).toBe(1)
    expect(toast.toasts.value[0]).toMatchObject({
      id,
      message: '已复制',
      type: 'success',
      duration: 1800,
    })
  })

  it('caps queue at 3 items and removes oldest first (FIFO)', () => {
    const toast = useToast()
    toast.info('Item 1')
    toast.info('Item 2')
    toast.info('Item 3')
    expect(toast.toasts.value.map(t => t.message)).toEqual(['Item 1', 'Item 2', 'Item 3'])
    toast.info('Item 4')
    expect(toast.toasts.value.map(t => t.message)).toEqual(['Item 2', 'Item 3', 'Item 4'])
  })

  it('automatically dismisses toast after duration', () => {
    const toast = useToast()
    toast.show({ message: 'Auto dismiss', duration: 1800 })
    expect(toast.toasts.value.length).toBe(1)
    vi.advanceTimersByTime(1800)
    expect(toast.toasts.value.length).toBe(0)
  })

  it('supports pause and resume for countdown', () => {
    const toast = useToast()
    const id = toast.show({ message: 'Hover me', duration: 1800 })
    vi.advanceTimersByTime(1000)
    toast.pause(id)
    vi.advanceTimersByTime(2000)
    expect(toast.toasts.value.length).toBe(1)
    toast.resume(id)
    vi.advanceTimersByTime(800)
    expect(toast.toasts.value.length).toBe(0)
  })

  it('manually dismisses a specific toast', () => {
    const toast = useToast()
    const id1 = toast.info('First')
    const id2 = toast.info('Second')
    toast.dismiss(id1)
    expect(toast.toasts.value.map(t => t.id)).toEqual([id2])
  })
})
```

- [x] **Step 2: Run test to confirm failure**

Run: `bun run test:unit tests/unit/composables/useToast.spec.ts`
Expected: Module `@/composables/useToast` not found.

- [x] **Step 3: Implement `src/composables/useToast.ts`**

Implement `useToast` with `activeToasts` ref, timer management Map, `pause`, `resume`, `show`, `success`, `error`, `warning`, `info`, `dismiss`, `clear`.

- [x] **Step 4: Run test to confirm pass**

Run: `bun run test:unit tests/unit/composables/useToast.spec.ts`
Expected: 5/5 tests pass.

- [x] **Step 5: Commit**

Run: `git add src/composables/useToast.ts tests/unit/composables/useToast.spec.ts && git commit -m "feat(ui): implement useToast composable with timer and queue governance"`

---

### Task 2: 全局容器 `PToastHost.vue` 实现、挂载与测试

**Files:**
- Create: `src/components/ui/PToastHost.vue`
- Modify: `src/App.vue`
- Modify: `apps/mobile/MobileApp.vue`
- Test: `tests/unit/components/PToastHost.spec.ts`

**Interfaces:**
- Consumes: `useToast()` from `src/composables/useToast.ts`
- Produces: `<PToastHost />` component

- [x] **Step 1: Write the failing test for `PToastHost`**

```ts
// tests/unit/components/PToastHost.spec.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PToastHost from '@/components/ui/PToastHost.vue'
import { useToast } from '@/composables/useToast'

describe('PToastHost', () => {
  beforeEach(() => {
    const { clear } = useToast()
    clear()
  })

  it('renders nothing when activeToasts is empty', () => {
    const wrapper = mount(PToastHost)
    expect(wrapper.findAll('.p-toast')).toHaveLength(0)
  })

  it('renders stacked toasts with correct types and positions', async () => {
    const toast = useToast()
    toast.success('操作成功')
    toast.error('出错了')
    const wrapper = mount(PToastHost)
    const items = wrapper.findAll('.p-toast')
    expect(items).toHaveLength(2)
    expect(items[0].classes()).toContain('p-toast--success')
    expect(items[0].text()).toContain('操作成功')
    expect(items[1].classes()).toContain('p-toast--error')
    expect(items[1].text()).toContain('出错了')
  })
})
```

- [x] **Step 2: Run test to confirm failure**

Run: `bun run test:unit tests/unit/components/PToastHost.spec.ts`
Expected: Component not found.

- [x] **Step 3: Implement `PToastHost.vue` and mount in root apps**

1. Create `src/components/ui/PToastHost.vue` with Teleport to body, TransitionGroup, 52px vertical stacking, pointerenter/leave pause/resume.
2. Mount `<PToastHost />` in `src/App.vue`.
3. Mount `<PToastHost />` in `apps/mobile/MobileApp.vue`.

- [x] **Step 4: Run test to confirm pass**

Run: `bun run test:unit tests/unit/components/PToastHost.spec.ts`
Expected: All tests pass.

- [x] **Step 5: Commit**

Run: `git add src/components/ui/PToastHost.vue src/App.vue apps/mobile/MobileApp.vue tests/unit/components/PToastHost.spec.ts && git commit -m "feat(ui): add PToastHost root container to desktop and mobile app roots"`

---

### Task 3: 现存 `PToast.vue` 100% 向后兼容与契约测试

**Files:**
- Modify: `src/components/ui/PToast.vue`
- Test: `tests/unit/components/PToast.spec.ts`

**Interfaces:**
- Consumes: `useToast()`
- Produces: `<PToast v-model="visible" :message="message" />`

- [x] **Step 1: Check existing `PToast.spec.ts` or create contract test**

Verify existing behavior with `v-model` and `:message`.
- [x] **Step 2: Update `PToast.vue` if needed to clean up single-instance limitation while keeping exact props & emits intact**
- [x] **Step 3: Run unit tests**

Run: `bun run test:unit tests/unit/components/PToast.spec.ts`
Expected: All pass.

- [x] **Step 4: Commit**

Run: `git add src/components/ui/PToast.vue tests/unit/components/PToast.spec.ts && git commit -m "refactor(ui): ensure PToast remains 100% backward compatible"`

---

### Task 4: 零反馈点位治理与单测断言

**Files:**
- Modify: `src/views/books/BookNotesView.vue`
- Modify: `src/components/books/BookPrivateHighlights.vue`
- Modify: `src/components/dm/DMConversationPane.vue`
- Modify: `src/views/studio/StudioContentView.vue`
- Test: `tests/unit/views/books/BookNotesView.spec.ts`
- Test: `tests/unit/views/studio/StudioContentView.spec.ts` (or relevant)

- [x] **Step 1: Update unit tests for target views**

Add assertions checking that `useToast().success` is called when copying citations, highlights, or sharing content.

- [x] **Step 2: Wire `useToast()` into target views**

1. `BookNotesView.vue`: In `copyCitation`, call `toast.success('引用已复制')` on success and `toast.error('复制失败')` on error.
2. `BookPrivateHighlights.vue`: In `copyText`, call `toast.success('文本已复制')`.
3. `DMConversationPane.vue`: In `copyMessage`, call `toast.success('消息已复制')`.
4. `StudioContentView.vue`: In `shareContent`, call `toast.success('分享地址已复制')`.

- [x] **Step 3: Run unit tests**

Run: `bun run test:unit tests/unit/views/books/BookNotesView.spec.ts tests/unit/views/studio/StudioContentView.spec.ts`
Expected: All pass.

- [x] **Step 4: Commit**

Run: `git add src/views/books/BookNotesView.vue src/components/books/BookPrivateHighlights.vue src/components/dm/DMConversationPane.vue src/views/studio/StudioContentView.vue tests/unit/ && git commit -m "feat(feedback): connect useToast to zero-feedback clipboard actions and studio sharing"`

---

### Task 5: 全站完整质量保证与构建验证

**Files:**
- Documentation: `docs/superpowers/plans/2026-10-27-toast-system-unification.md`
- Kanban: `<appDataDir>/brain/72e9f847-045b-4790-a46f-1fe17ce2f1c1/frontend-refactor-status.md`

- [x] **Step 1: Run TypeScript strict check**

Run: `cd Atoman-Frontend && bun run type-check`
Expected: 0 errors.

- [x] **Step 2: Run full unit test suite**

Run: `cd Atoman-Frontend && bun run test:unit`
Expected: 100% pass across all 549+ suites.

- [x] **Step 3: Run desktop and mobile production builds**

Run: `cd Atoman-Frontend && bun run build && bun run build:mobile`
Expected: Both builds succeed with 0 errors.

- [x] **Step 4: Update plan and kanban status**

Mark all tasks as completed in plan and update status board.

- [x] **Step 5: Final commit & push**

Run: `git commit -am "chore: complete toast system unification and verification" && git push origin main`
