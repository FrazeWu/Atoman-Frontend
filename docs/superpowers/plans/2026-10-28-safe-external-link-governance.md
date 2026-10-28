# 全站外链与站外跳转安全标准化治理实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 依据设计规范与 `AGENTS.md` 准则，建立全局外链安全状态中心 `useSafeLink.ts` 与轻量线框弹窗 `PSafeLinkModal.vue`，拦截站外未确认跳转，提供【取消】、【复制链接】（深度联动 `useToast`）与【继续前往】，并在双端根应用及 Markdown / 富文本容器中集成，建立自动化安全契约测试守护全站。

**Architecture:** 
1. 编写响应式单例状态中心 `src/composables/useSafeLink.ts`，管理外链校验、过滤、域名提取、弹层状态与剪贴板复制；
2. 研发符合 0 阴影与 4px 标准圆角的极简线框弹窗 `src/components/ui/PSafeLinkModal.vue`，并在桌面端 `src/App.vue` 与移动端 `apps/mobile/MobileApp.vue` 根层挂载；
3. 将基础链接组件 `PLink.vue` 及 Markdown / 评论渲染器和阅读容器与 `useSafeLink` 协同，拦截站外链接；
4. 建立自动化单测与静态契约测试 `tests/unit/ui/safe-link-contract.spec.ts`；
5. 执行全站类型检查、全量单元测试与双端生产打包。

**Tech Stack:** Vue 3.4, Vite, TypeScript 5.8, Vitest, Tailwind CSS v4.

## Global Constraints

- 严守 0 阴影规范（`box-shadow: none !important;`）与 4px 标准圆角（`border-radius: var(--a-radius-card, 4px)`）；
- 用户特调的桌面端顶栏交互与视觉（`AppTopbarAuthControls.vue`）绝对不作任何修改；
- 遵循真数据原则，杜绝任何假数据或 Mock；
- 前端用户可见文案严格收敛为简洁用户态，禁止暴露内部/开发者视角词汇；
- 站内相对路由（如 `/posts/...`、`/books/...`）与锚点（`#...`）正常放行，绝不误拦截；
- 修改完成前必须运行 `bun run type-check` 与 `bun run test:unit` 验证。

---

### Task 1: 全局外链安全状态中心 (`src/composables/useSafeLink.ts`)

**Files:**
- Create: `src/composables/useSafeLink.ts`
- Create: `tests/unit/composables/useSafeLink.spec.ts`

**Interfaces:**
- Consumes: `src/utils/safeExternalUrl.ts`, `src/composables/useToast.ts`
- Produces: `useSafeLink()`:
  - `safeLinkState: Readonly<Ref<SafeLinkState>>`
  - `isExternalLink(url: string): boolean`
  - `openSafeLink(url: string): boolean`
  - `closeSafeLink(): void`
  - `proceedToSafeLink(): void`
  - `copySafeLink(): Promise<void>`
  - `handleSafeLinkClick(event: MouseEvent): void`

- [ ] **Step 1: Write failing tests for `useSafeLink`**

```ts
// tests/unit/composables/useSafeLink.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSafeLink } from '@/composables/useSafeLink'

describe('useSafeLink', () => {
  beforeEach(() => {
    const { closeSafeLink } = useSafeLink()
    closeSafeLink()
  })

  it('correctly identifies external vs internal links', () => {
    const { isExternalLink } = useSafeLink()
    expect(isExternalLink('/posts/123')).toBe(false)
    expect(isExternalLink('#section')).toBe(false)
    expect(isExternalLink('https://github.com/atoman')).toBe(true)
    expect(isExternalLink('http://example.com')).toBe(true)
  })

  it('opens safe link modal and extracts hostname for valid external url', () => {
    const { safeLinkState, openSafeLink, closeSafeLink } = useSafeLink()
    const opened = openSafeLink('https://github.com/atoman/project')
    expect(opened).toBe(true)
    expect(safeLinkState.value.isOpen).toBe(true)
    expect(safeLinkState.value.targetUrl).toBe('https://github.com/atoman/project')
    expect(safeLinkState.value.targetHostname).toBe('github.com')

    closeSafeLink()
    expect(safeLinkState.value.isOpen).toBe(false)
  })

  it('rejects internal and invalid urls', () => {
    const { openSafeLink } = useSafeLink()
    expect(openSafeLink('/internal/path')).toBe(false)
    expect(openSafeLink('javascript:alert(1)')).toBe(false)
  })

  it('proceeds to open safe link in new window with noopener noreferrer', () => {
    const { openSafeLink, proceedToSafeLink, safeLinkState } = useSafeLink()
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    openSafeLink('https://example.org/docs')
    proceedToSafeLink()

    expect(openSpy).toHaveBeenCalledWith('https://example.org/docs', '_blank', 'noopener,noreferrer')
    expect(safeLinkState.value.isOpen).toBe(false)
    openSpy.mockRestore()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit tests/unit/composables/useSafeLink.spec.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `src/composables/useSafeLink.ts`**

```ts
// src/composables/useSafeLink.ts
import { ref, readonly } from 'vue'
import { safeExternalUrl } from '@/utils/safeExternalUrl'
import { useToast } from '@/composables/useToast'

export interface SafeLinkState {
  isOpen: boolean
  targetUrl: string
  targetHostname: string
}

const state = ref<SafeLinkState>({
  isOpen: false,
  targetUrl: '',
  targetHostname: '',
})

export function useSafeLink() {
  const toast = useToast()

  function isExternalLink(url: string): boolean {
    if (!url) return false
    const trimmed = url.trim()
    if (
      trimmed.startsWith('/') ||
      trimmed.startsWith('#') ||
      trimmed.startsWith('./') ||
      trimmed.startsWith('../') ||
      trimmed.startsWith('mailto:') ||
      trimmed.startsWith('tel:')
    ) {
      return false
    }
    if (typeof window === 'undefined') return false
    try {
      const parsed = new URL(trimmed, window.location.origin)
      return (
        parsed.origin !== window.location.origin &&
        (parsed.protocol === 'http:' || parsed.protocol === 'https:')
      )
    } catch {
      return false
    }
  }

  function openSafeLink(url: string): boolean {
    const safeUrl = safeExternalUrl(url)
    if (!safeUrl || !isExternalLink(safeUrl)) {
      return false
    }
    try {
      const parsed = new URL(safeUrl)
      state.value = {
        isOpen: true,
        targetUrl: safeUrl,
        targetHostname: parsed.hostname,
      }
      return true
    } catch {
      return false
    }
  }

  function closeSafeLink(): void {
    state.value.isOpen = false
  }

  function proceedToSafeLink(): void {
    if (!state.value.targetUrl) return
    if (typeof window !== 'undefined') {
      window.open(state.value.targetUrl, '_blank', 'noopener,noreferrer')
    }
    closeSafeLink()
  }

  async function copySafeLink(): Promise<void> {
    if (!state.value.targetUrl) return
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(state.value.targetUrl)
        toast.success('链接已复制')
      }
    } catch {
      toast.error('复制失败，请手动复制')
    }
  }

  function handleSafeLinkClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null
    const anchor = target?.closest('a')
    if (!anchor) return
    const href = anchor.getAttribute('href')
    if (href && isExternalLink(href)) {
      event.preventDefault()
      openSafeLink(href)
    }
  }

  return {
    safeLinkState: readonly(state),
    isExternalLink,
    openSafeLink,
    closeSafeLink,
    proceedToSafeLink,
    copySafeLink,
    handleSafeLinkClick,
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `bun run test:unit tests/unit/composables/useSafeLink.spec.ts`
Expected: PASS (4/4 tests pass).

- [ ] **Step 5: Commit**

Run: `git add src/composables/useSafeLink.ts tests/unit/composables/useSafeLink.spec.ts && git commit -m "feat(security): implement useSafeLink composable with external url validation and toast integration"`

---

### Task 2: 安全跳转确认弹窗组件 (`PSafeLinkModal.vue`) 与双端挂载

**Files:**
- Create: `src/components/ui/PSafeLinkModal.vue`
- Create: `tests/unit/components/PSafeLinkModal.spec.ts`
- Modify: `src/App.vue`
- Modify: `apps/mobile/MobileApp.vue`

**Interfaces:**
- Consumes: `useSafeLink()`
- Produces: `PSafeLinkModal.vue` component

- [ ] **Step 1: Write failing test for `PSafeLinkModal.vue`**

```ts
// tests/unit/components/PSafeLinkModal.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PSafeLinkModal from '@/components/ui/PSafeLinkModal.vue'
import { useSafeLink } from '@/composables/useSafeLink'

describe('PSafeLinkModal', () => {
  const { openSafeLink, closeSafeLink } = useSafeLink()

  beforeEach(() => {
    closeSafeLink()
  })

  it('does not render dialog when safeLinkState.isOpen is false', () => {
    const wrapper = mount(PSafeLinkModal, {
      global: {
        stubs: { Teleport: true },
      },
    })
    expect(wrapper.find('.p-safe-link-modal').exists()).toBe(false)
  })

  it('renders modal with target domain and buttons when open', async () => {
    openSafeLink('https://github.com/atoman')
    const wrapper = mount(PSafeLinkModal, {
      global: {
        stubs: { Teleport: true },
      },
    })

    expect(wrapper.find('.p-safe-link-modal').exists()).toBe(true)
    expect(wrapper.text()).toContain('github.com')
    expect(wrapper.find('[data-test="proceed-btn"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="copy-btn"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="cancel-btn"]').exists()).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `bun run test:unit tests/unit/components/PSafeLinkModal.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `PSafeLinkModal.vue`**

```vue
<!-- src/components/ui/PSafeLinkModal.vue -->
<template>
  <Teleport to="body">
    <Transition name="p-safe-modal-fade">
      <div
        v-if="safeLinkState.isOpen"
        class="p-safe-link-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="safe-link-title"
        @click.self="closeSafeLink"
        @keydown.esc="closeSafeLink"
      >
        <div class="p-safe-link-modal">
          <div class="p-safe-link-modal__header">
            <h2 id="safe-link-title" class="p-safe-link-modal__title">访问外部站点</h2>
            <button
              type="button"
              class="p-safe-link-modal__close"
              aria-label="关闭"
              @click="closeSafeLink"
            >
              ✕
            </button>
          </div>

          <div class="p-safe-link-modal__body">
            <p class="p-safe-link-modal__desc">
              你即将离开 Atoman 前往外部站点，请注意保护个人信息与安全。
            </p>

            <div class="p-safe-link-modal__card">
              <span class="p-safe-link-modal__host">{{ safeLinkState.targetHostname }}</span>
              <span class="p-safe-link-modal__url" :title="safeLinkState.targetUrl">{{ safeLinkState.targetUrl }}</span>
            </div>
          </div>

          <div class="p-safe-link-modal__actions">
            <button
              type="button"
              class="p-safe-link-modal__btn p-safe-link-modal__btn--cancel"
              data-test="cancel-btn"
              @click="closeSafeLink"
            >
              取消
            </button>
            <button
              type="button"
              class="p-safe-link-modal__btn p-safe-link-modal__btn--copy"
              data-test="copy-btn"
              @click="copySafeLink"
            >
              复制链接
            </button>
            <button
              type="button"
              class="p-safe-link-modal__btn p-safe-link-modal__btn--proceed"
              data-test="proceed-btn"
              @click="proceedToSafeLink"
            >
              继续前往 ↗
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { useSafeLink } from '@/composables/useSafeLink'

const { safeLinkState, closeSafeLink, proceedToSafeLink, copySafeLink } = useSafeLink()
</script>

<style scoped>
.p-safe-link-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.45);
}

.p-safe-link-modal {
  width: 100%;
  max-width: 440px;
  background: var(--a-color-bg, #ffffff);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
  box-shadow: none !important;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.p-safe-link-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem 0.75rem;
  border-bottom: 1px solid var(--a-color-border-soft, #e2e8f0);
}

.p-safe-link-modal__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.p-safe-link-modal__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--a-color-text-secondary, #64748b);
  border-radius: var(--a-radius-control, 4px);
  cursor: pointer;
}

.p-safe-link-modal__close:hover {
  background: var(--a-color-surface-muted, #f1f5f9);
  color: var(--a-color-text, #0f172a);
}

.p-safe-link-modal__body {
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.p-safe-link-modal__desc {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--a-color-text-secondary, #64748b);
}

.p-safe-link-modal__card {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem 1rem;
  background: var(--a-color-surface-muted, #f8fafc);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
  overflow: hidden;
}

.p-safe-link-modal__host {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
  word-break: break-all;
}

.p-safe-link-modal__url {
  font-size: 0.75rem;
  color: var(--a-color-text-secondary, #64748b);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.p-safe-link-modal__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem 1rem;
  border-top: 1px solid var(--a-color-border-soft, #e2e8f0);
}

.p-safe-link-modal__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.4375rem 0.875rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: var(--a-radius-control, 4px);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.p-safe-link-modal__btn--cancel {
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  background: transparent;
  color: var(--a-color-text-secondary, #64748b);
}

.p-safe-link-modal__btn--cancel:hover {
  background: var(--a-color-surface-muted, #f1f5f9);
  color: var(--a-color-text, #0f172a);
}

.p-safe-link-modal__btn--copy {
  border: 1px solid var(--a-color-border, #cbd5e1);
  background: var(--a-color-bg, #ffffff);
  color: var(--a-color-text, #0f172a);
}

.p-safe-link-modal__btn--copy:hover {
  background: var(--a-color-surface-muted, #f1f5f9);
}

.p-safe-link-modal__btn--proceed {
  border: 1px solid var(--a-color-text, #0f172a);
  background: var(--a-color-text, #0f172a);
  color: var(--a-color-bg, #ffffff);
}

.p-safe-link-modal__btn--proceed:hover {
  opacity: 0.9;
}

.p-safe-modal-fade-enter-active,
.p-safe-modal-fade-leave-active {
  transition: opacity 0.15s ease;
}

.p-safe-modal-fade-enter-from,
.p-safe-modal-fade-leave-to {
  opacity: 0;
}
</style>
```

- [ ] **Step 4: Mount `PSafeLinkModal.vue` in `App.vue` and `apps/mobile/MobileApp.vue`**

In `src/App.vue`:
Import `PSafeLinkModal from '@/components/ui/PSafeLinkModal.vue'` and add `<PSafeLinkModal />` next to `<PToastHost />`.

In `apps/mobile/MobileApp.vue`:
Import `PSafeLinkModal from '@/components/ui/PSafeLinkModal.vue'` and add `<PSafeLinkModal />` next to `<PToastHost />`.

- [ ] **Step 5: Run tests to verify pass**

Run: `bun run test:unit tests/unit/components/PSafeLinkModal.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

Run: `git add src/components/ui/PSafeLinkModal.vue tests/unit/components/PSafeLinkModal.spec.ts src/App.vue apps/mobile/MobileApp.vue && git commit -m "feat(ui): add PSafeLinkModal component and mount in desktop and mobile app roots"`

---

### Task 3: 全站外链事件拦截集成 (`PLink.vue` & 富文本容器)

**Files:**
- Modify: `src/components/ui/PLink.vue`
- Modify: `tests/unit/components/ui/PLink.spec.ts` (if exists) or create
- Modify: `src/components/feed/FeedReaderContent.vue`
- Modify: `src/components/feed/FeedArticleSheet.vue`

**Interfaces:**
- Consumes: `useSafeLink()`

- [ ] **Step 1: Update `src/components/ui/PLink.vue` to intercept external link click**

In `src/components/ui/PLink.vue`:
```ts
import { useSafeLink } from '@/composables/useSafeLink'

const { openSafeLink } = useSafeLink()

function handleClick(event: MouseEvent) {
  if (isExternal.value && safeHref.value) {
    event.preventDefault()
    openSafeLink(safeHref.value)
  }
  emit('click', event)
}
```

- [ ] **Step 2: Update `FeedReaderContent.vue` and `FeedArticleSheet.vue` to delegate external clicks**

In `src/components/feed/FeedReaderContent.vue`:
Wire container click to `handleSafeLinkClick`.

- [ ] **Step 3: Run unit tests**

Run: `bun run test:unit tests/unit/components/ui/PLink.spec.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

Run: `git add src/components/ui/PLink.vue src/components/feed/FeedReaderContent.vue && git commit -m "refactor(ui): integrate safe external link interception into PLink and feed reader content"`

---

### Task 4: 自动化安全外链契约测试 (`safe-link-contract.spec.ts`)

**Files:**
- Create: `tests/unit/ui/safe-link-contract.spec.ts`

- [ ] **Step 1: Write static contract test**

```ts
// tests/unit/ui/safe-link-contract.spec.ts
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

describe('safe-link-contract', () => {
  it('ensures PSafeLinkModal is mounted in App.vue and MobileApp.vue', () => {
    const desktopAppPath = resolve(process.cwd(), 'src/App.vue')
    const mobileAppPath = resolve(process.cwd(), 'apps/mobile/MobileApp.vue')

    expect(existsSync(desktopAppPath)).toBe(true)
    expect(existsSync(mobileAppPath)).toBe(true)

    const desktopContent = readFileSync(desktopAppPath, 'utf-8')
    const mobileContent = readFileSync(mobileAppPath, 'utf-8')

    expect(desktopContent).toContain('PSafeLinkModal')
    expect(mobileContent).toContain('PSafeLinkModal')
  })

  it('ensures PSafeLinkModal has box-shadow none constraint', () => {
    const modalPath = resolve(process.cwd(), 'src/components/ui/PSafeLinkModal.vue')
    expect(existsSync(modalPath)).toBe(true)
    const content = readFileSync(modalPath, 'utf-8')
    expect(content).toContain('box-shadow: none !important;')
  })
})
```

- [ ] **Step 2: Run contract test**

Run: `bun run test:unit tests/unit/ui/safe-link-contract.spec.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

Run: `git add tests/unit/ui/safe-link-contract.spec.ts && git commit -m "test(contract): add safe external link contract tests"`

---

### Task 5: 全站质量验证与双端打包交付

**Files:**
- Documentation: `docs/superpowers/plans/2026-10-28-safe-external-link-governance.md`
- Kanban: `<appDataDir>/brain/72e9f847-045b-4790-a46f-1fe17ce2f1c1/frontend-refactor-status.md`

- [ ] **Step 1: Run TypeScript strict check**

Run: `cd Atoman-Frontend && bun run type-check`
Expected: 0 errors.

- [ ] **Step 2: Run full unit test suite**

Run: `cd Atoman-Frontend && bun run test:unit`
Expected: 100% pass across all test suites.

- [ ] **Step 3: Run desktop and mobile production builds**

Run: `cd Atoman-Frontend && bun run build && bun run build:mobile`
Expected: Both builds succeed with 0 errors.

- [ ] **Step 4: Update plan and kanban status**

Mark all tasks as completed in plan and update status board.

- [ ] **Step 5: Final commit & push**

Run: `git commit -am "chore: complete safe external link governance" && git push origin main`
