# Site Responsive Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shared three-breakpoint responsive shell that keeps sidebar layouts on desktop and tablet, replaces them with a fixed mobile bottom navigation below `768px`, and migrates feed mobile sidebar behavior into header and sheet-driven interactions.

**Architecture:** The implementation changes the shared shell first instead of patching pages one-by-one. `App.vue` becomes the mobile bottom-nav host, `src/style.css` owns the three-band layout behavior and mobile safe-area spacing, `PSidebar`-based module layouts inherit the new shell rules, and feed gets one targeted mobile migration for source access so the responsive model is proven on a real sidebar-heavy module.

**Tech Stack:** Vue 3, Vue Router, Pinia, Vitest, Vue Test Utils, shared CSS in `src/style.css`

---

## File Structure

- Modify: `src/App.vue`
  - Mount the shared mobile bottom navigation at the application shell level.
- Modify: `src/style.css`
  - Define the three-band shell behavior, mobile safe-area spacing, and shared mobile shell helpers.
- Modify: `src/components/system/AppTopbar.vue`
  - Hide the current horizontal module nav at mobile widths where the new bottom nav takes over.
- Create: `src/components/system/MobileBottomNav.vue`
  - Render the four fixed mobile destinations and open the `更多` sheet.
- Create: `src/components/system/MobileMoreSheet.vue`
  - Render lower-frequency modules and utility entries inside a large bottom sheet.
- Create: `src/composables/useResponsiveShell.ts`
  - Centralize module-to-mobile-tab mapping and the `更多` sheet item definitions.
- Modify: `src/components/ui/PSheet.vue`
  - Add a bottom-sheet presentation mode or equivalent prop so `更多` can open from the bottom instead of side-only.
- Modify: `src/views/feed/FeedLayout.vue`
  - Add a mobile-visible page-header action that opens feed source access through a sheet rather than left-column occupancy.
- Modify: `src/components/feed/FeedSidebarSources.vue`
  - Reuse its source list in a mobile sheet-friendly container or extract the reusable list portion if needed.
- Create: `src/components/feed/FeedMobileSourcesSheet.vue`
  - Present subscriptions, source selection, and manage action in a mobile sheet.
- Test: `tests/unit/system/MobileBottomNav.spec.ts`
  - Verify mobile tab rendering, active state, and `更多` opening.
- Test: `tests/unit/system/PSheet.spec.ts`
  - Verify bottom-sheet mode.
- Test: `tests/unit/views/feed/FeedLayout.spec.ts`
  - Verify mobile feed source access path.
- Test: `tests/unit/system/AppShellResponsive.spec.ts`
  - Verify `App.vue` mounts mobile bottom nav only for sidebar-bearing module routes.

### Task 1: Add shared responsive shell metadata and mobile nav mapping

**Files:**
- Create: `src/composables/useResponsiveShell.ts`
- Modify: `src/config/moduleRooms.ts`
- Test: `tests/unit/system/MobileBottomNav.spec.ts`

- [ ] **Step 1: Write the failing test for mobile tab definitions**

```ts
import { describe, expect, it } from 'vitest'
import { getMobilePrimaryTabs, getMobileMoreItems } from '@/composables/useResponsiveShell'

describe('useResponsiveShell', () => {
  it('returns four fixed primary mobile tabs', () => {
    const tabs = getMobilePrimaryTabs()

    expect(tabs.map((tab) => tab.key)).toEqual(['discover', 'feed', 'create', 'more'])
    expect(tabs.map((tab) => tab.label)).toEqual(['首页/发现', '订阅', '创作/内容', '更多'])
  })

  it('moves low-frequency modules into the more sheet', () => {
    const items = getMobileMoreItems()

    expect(items.map((item) => item.module)).toContain('forum')
    expect(items.map((item) => item.module)).toContain('timeline')
    expect(items.map((item) => item.module)).not.toContain('feed')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun vitest tests/unit/system/MobileBottomNav.spec.ts`
Expected: FAIL with module or export-not-found errors for `useResponsiveShell`.

- [ ] **Step 3: Write the minimal responsive-shell mapping**

```ts
import { moduleUrl } from '@/composables/useSubdomainNav'
import type { ModuleRoomKey } from '@/config/moduleRooms'

export type MobilePrimaryTab = {
  key: 'discover' | 'feed' | 'create' | 'more'
  label: string
  module?: ModuleRoomKey
  href?: string
}

export type MobileMoreItem = {
  module: ModuleRoomKey
  label: string
  href: string
}

const PRIMARY_TABS: MobilePrimaryTab[] = [
  { key: 'discover', label: '首页/发现', module: 'kanbo', href: moduleUrl('kanbo') },
  { key: 'feed', label: '订阅', module: 'feed', href: moduleUrl('feed') },
  { key: 'create', label: '创作/内容', module: 'kanbo', href: `${moduleUrl('kanbo')}create` },
  { key: 'more', label: '更多' },
]

const MORE_ITEMS: MobileMoreItem[] = [
  { module: 'music', label: '音乐', href: moduleUrl('music') },
  { module: 'forum', label: '论坛', href: moduleUrl('forum') },
  { module: 'debate', label: '辩论', href: moduleUrl('debate') },
  { module: 'timeline', label: '时间线', href: moduleUrl('timeline') },
]

export const getMobilePrimaryTabs = () => PRIMARY_TABS
export const getMobileMoreItems = () => MORE_ITEMS
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun vitest tests/unit/system/MobileBottomNav.spec.ts`
Expected: PASS for the tab-definition assertions.

- [ ] **Step 5: Commit**

```bash
git add src/composables/useResponsiveShell.ts tests/unit/system/MobileBottomNav.spec.ts
git commit -m "feat: add responsive shell mobile nav mapping"
```

### Task 2: Add bottom-sheet support to the shared sheet primitive

**Files:**
- Modify: `src/components/ui/PSheet.vue`
- Test: `tests/unit/system/PSheet.spec.ts`

- [ ] **Step 1: Write the failing test for bottom-sheet mode**

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PSheet from '@/components/ui/PSheet.vue'

describe('PSheet bottom mode', () => {
  it('renders a bottom-aligned panel when side is bottom', () => {
    const wrapper = mount(PSheet, {
      props: { show: true, side: 'bottom', title: 'MORE' },
      slots: { default: '<div>content</div>' },
    })

    expect(wrapper.get('.p-sheet-panel').classes()).toContain('is-bottom')
    expect(wrapper.get('.p-sheet-panel').attributes('style')).toContain('left: 0px')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun vitest tests/unit/system/PSheet.spec.ts`
Expected: FAIL because `side="bottom"` is unsupported.

- [ ] **Step 3: Extend PSheet with bottom-mode support**

```ts
const props = withDefaults(defineProps<{
  show: boolean
  title?: string
  width?: string
  maxWidth?: string
  top?: string
  side?: 'left' | 'right' | 'bottom'
  closeType?: 'bookmark' | 'header' | 'both'
  readingMode?: boolean
  isShifted?: boolean
}>(), {
  side: 'right',
})

const transitionName = computed(() => {
  if (props.side === 'left') return 'slide-left'
  if (props.side === 'bottom') return 'slide-up'
  return 'slide-right'
})

const sheetStyle = computed(() => {
  if (props.side === 'bottom') {
    return {
      width: '100%',
      'max-width': '100%',
      left: 0,
      right: 0,
      top: 'auto',
    }
  }

  return {
    width: props.width,
    'max-width': props.maxWidth || 'calc(100vw - var(--a-sidebar-width) - 16px)',
    top: props.top,
    [props.side === 'left' ? 'left' : 'right']: 0,
  }
})
```

```css
.p-sheet-layer.is-bottom {
  left: 0;
  right: 0;
  bottom: 0;
  top: auto;
  border-top: 1px solid var(--a-color-line-soft);
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.4s cubic-bezier(0.2, 0, 0, 1), opacity 0.4s;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun vitest tests/unit/system/PSheet.spec.ts`
Expected: PASS for the bottom-sheet assertions and no regressions in existing left/right tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/PSheet.vue tests/unit/system/PSheet.spec.ts
git commit -m "feat: add bottom mode to shared sheet"
```

### Task 3: Add the shared mobile bottom navigation and more sheet

**Files:**
- Create: `src/components/system/MobileBottomNav.vue`
- Create: `src/components/system/MobileMoreSheet.vue`
- Modify: `src/App.vue`
- Modify: `src/components/system/AppTopbar.vue`
- Test: `tests/unit/system/MobileBottomNav.spec.ts`
- Test: `tests/unit/system/AppShellResponsive.spec.ts`

- [ ] **Step 1: Write the failing tests for shell mounting and more-sheet opening**

```ts
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import App from '@/App.vue'

describe('App responsive shell', () => {
  it('mounts mobile bottom nav on sidebar module routes', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div />' }, meta: { hasSidebar: true } }],
    })

    await router.push('/')
    await router.isReady()

    const wrapper = mount(App, { global: { plugins: [createPinia(), router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="mobile-bottom-nav"]').exists()).toBe(true)
  })
})
```

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MobileBottomNav from '@/components/system/MobileBottomNav.vue'

describe('MobileBottomNav', () => {
  it('opens the more sheet from the fourth tab', async () => {
    const wrapper = mount(MobileBottomNav)

    await wrapper.get('[data-testid="mobile-tab-more"]').trigger('click')

    expect(wrapper.find('[data-testid="mobile-more-sheet"]').exists()).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun vitest tests/unit/system/MobileBottomNav.spec.ts tests/unit/system/AppShellResponsive.spec.ts`
Expected: FAIL because the components are not mounted or do not exist yet.

- [ ] **Step 3: Implement the mobile bottom nav and more sheet**

```vue
<template>
  <div class="mobile-bottom-nav" data-testid="mobile-bottom-nav">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      :data-testid="`mobile-tab-${tab.key}`"
      :class="['mobile-bottom-nav__item', { 'is-active': isActive(tab) }]"
      type="button"
      @click="activate(tab)"
    >
      <span class="mobile-bottom-nav__label">{{ tab.label }}</span>
    </button>

    <MobileMoreSheet :show="moreOpen" @close="moreOpen = false" />
  </div>
</template>
```

```ts
const tabs = getMobilePrimaryTabs()
const moreOpen = ref(false)

const activate = (tab: MobilePrimaryTab) => {
  if (tab.key === 'more') {
    moreOpen.value = true
    return
  }
  if (tab.href) window.location.href = tab.href
}
```

```vue
<template>
  <PSheet
    :show="show"
    side="bottom"
    title="更多"
    close-type="header"
    class="mobile-more-sheet"
    @close="$emit('close')"
  >
    <div data-testid="mobile-more-sheet" class="mobile-more-sheet__body">
      <a v-for="item in items" :key="item.module" :href="item.href" class="mobile-more-sheet__item">
        {{ item.label }}
      </a>
    </div>
  </PSheet>
</template>
```

```vue
<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <div :class="['app-shell', { 'has-sidebar': hasSidebar }]">
      <AppTopbar />
      <FirstLoginOnboarding />
      <main :class="['app-main', { 'app-main--auth': isAuthRoute }]">
        <router-view />
      </main>
      <MobileBottomNav v-if="hasSidebar && !isAuthRoute" />
      <SiteFooter />
      <AudioPlayer v-if="hasActiveTrack" />
    </div>
  </n-config-provider>
</template>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun vitest tests/unit/system/MobileBottomNav.spec.ts tests/unit/system/AppShellResponsive.spec.ts`
Expected: PASS for shell mounting and `更多` opening.

- [ ] **Step 5: Commit**

```bash
git add src/App.vue src/components/system/AppTopbar.vue src/components/system/MobileBottomNav.vue src/components/system/MobileMoreSheet.vue tests/unit/system/MobileBottomNav.spec.ts tests/unit/system/AppShellResponsive.spec.ts
git commit -m "feat: add shared mobile bottom navigation shell"
```

### Task 4: Convert shared layout CSS to the three-band responsive shell

**Files:**
- Modify: `src/style.css`
- Test: `tests/unit/system/AppShellResponsive.spec.ts`

- [ ] **Step 1: Write the failing test for the mobile shell class hooks**

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MobileBottomNav from '@/components/system/MobileBottomNav.vue'

describe('mobile shell class hooks', () => {
  it('renders the shell class used by global responsive CSS', () => {
    const wrapper = mount(MobileBottomNav)
    expect(wrapper.get('.mobile-bottom-nav').exists()).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails if the class hook is missing**

Run: `bun vitest tests/unit/system/AppShellResponsive.spec.ts`
Expected: FAIL if the final class or mount point is missing.

- [ ] **Step 3: Update shared CSS for desktop, tablet, and mobile**

```css
.a-module-layout {
  display: flex;
  width: 100%;
  min-height: calc(100vh - 56px);
}

.a-main-content {
  flex: 1;
  min-width: 0;
  max-width: 80rem;
  margin: 0 auto;
  padding: 2.5rem 2rem calc(12rem + var(--a-mobile-nav-offset, 0px));
}

.mobile-bottom-nav {
  display: none;
}

@media (max-width: 1023px) {
  .has-sidebar {
    --a-sidebar-width: 4.5rem;
  }
}

@media (max-width: 767px) {
  .has-sidebar {
    --a-sidebar-width: 0px;
    --a-mobile-nav-offset: 5.5rem;
  }

  .a-module-layout {
    display: block;
    min-height: auto;
  }

  .p-sidebar,
  .a-sidebar {
    display: none;
  }

  .a-main-content {
    max-width: none;
    padding: 1.5rem 1rem calc(7rem + env(safe-area-inset-bottom));
  }

  .mobile-bottom-nav {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 80;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun vitest tests/unit/system/AppShellResponsive.spec.ts`
Expected: PASS for shell hooks; manual CSS verification still required later.

- [ ] **Step 5: Commit**

```bash
git add src/style.css tests/unit/system/AppShellResponsive.spec.ts
git commit -m "feat: add three-band responsive shell styles"
```

### Task 5: Make module layouts inherit the mobile shell cleanly

**Files:**
- Modify: `src/views/feed/FeedLayout.vue`
- Modify: `src/views/media/MediaLayout.vue`
- Modify: `src/views/blog/BlogLayout.vue`
- Modify: `src/views/forum/ForumLayout.vue`
- Modify: `src/views/debate/DebateLayout.vue`
- Modify: `src/views/music/MusicLayout.vue`
- Modify: `src/views/video/VideoLayout.vue`
- Modify: `src/views/podcast/PodcastLayout.vue`
- Modify: `src/views/timeline/TimelineLayout.vue`
- Test: `tests/unit/views/feed/FeedLayout.spec.ts`

- [ ] **Step 1: Write the failing test for mobile-friendly feed header actions**

```ts
it('renders a mobile source action trigger in feed layout', async () => {
  const { wrapper } = await mountLayout('/')

  expect(wrapper.find('[data-testid="feed-mobile-sources-trigger"]').exists()).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun vitest tests/unit/views/feed/FeedLayout.spec.ts`
Expected: FAIL because the trigger does not exist yet.

- [ ] **Step 3: Add layout-level mobile action slots and hide redundant chrome**

```vue
<template>
  <div class="a-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <PSidebar ... />
    <main class="a-main-content">
      <header class="module-mobile-header">
        <h1 class="module-mobile-header__title">订阅</h1>
        <button
          type="button"
          class="module-mobile-header__action"
          data-testid="feed-mobile-sources-trigger"
          @click="mobileSourcesOpen = true"
        >
          来源
        </button>
      </header>
      <router-view />
    </main>
  </div>
</template>
```

```css
.module-mobile-header {
  display: none;
}

@media (max-width: 767px) {
  .module-mobile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun vitest tests/unit/views/feed/FeedLayout.spec.ts`
Expected: PASS for the mobile trigger and no regressions in existing sidebar behavior.

- [ ] **Step 5: Commit**

```bash
git add src/views/feed/FeedLayout.vue src/views/media/MediaLayout.vue src/views/blog/BlogLayout.vue src/views/forum/ForumLayout.vue src/views/debate/DebateLayout.vue src/views/music/MusicLayout.vue src/views/video/VideoLayout.vue src/views/podcast/PodcastLayout.vue src/views/timeline/TimelineLayout.vue tests/unit/views/feed/FeedLayout.spec.ts
git commit -m "feat: adapt module layouts to responsive shell"
```

### Task 6: Move feed mobile source access into a sheet

**Files:**
- Create: `src/components/feed/FeedMobileSourcesSheet.vue`
- Modify: `src/views/feed/FeedLayout.vue`
- Modify: `src/components/feed/FeedSidebarSources.vue`
- Test: `tests/unit/views/feed/FeedLayout.spec.ts`

- [ ] **Step 1: Write the failing test for mobile source sheet opening**

```ts
it('opens the feed mobile sources sheet from the header action', async () => {
  const { wrapper } = await mountLayout('/')

  await wrapper.get('[data-testid="feed-mobile-sources-trigger"]').trigger('click')

  expect(wrapper.find('[data-testid="feed-mobile-sources-sheet"]').exists()).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun vitest tests/unit/views/feed/FeedLayout.spec.ts`
Expected: FAIL because no sheet opens yet.

- [ ] **Step 3: Implement the mobile feed sources sheet**

```vue
<template>
  <PSheet
    :show="show"
    side="bottom"
    title="来源"
    close-type="header"
    @close="$emit('close')"
  >
    <div data-testid="feed-mobile-sources-sheet">
      <FeedSidebarSources
        :subscriptions="subscriptions"
        :groups="groups"
        :active-source-id="activeSourceId"
        :collapsed="false"
        @select-source="$emit('select-source', $event)"
        @manage="$emit('manage')"
      />
    </div>
  </PSheet>
</template>
```

```ts
const mobileSourcesOpen = ref(false)

const openMobileSources = () => {
  mobileSourcesOpen.value = true
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun vitest tests/unit/views/feed/FeedLayout.spec.ts`
Expected: PASS for opening the mobile sources sheet and existing source-selection tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/feed/FeedMobileSourcesSheet.vue src/views/feed/FeedLayout.vue src/components/feed/FeedSidebarSources.vue tests/unit/views/feed/FeedLayout.spec.ts
git commit -m "feat: move feed mobile source access into sheet"
```

### Task 7: Verify cross-shell behavior and document residual exceptions

**Files:**
- Modify: `docs/superpowers/specs/2026-06-20-site-responsive-layout-design.md`
- Test: `tests/unit/system/MobileBottomNav.spec.ts`
- Test: `tests/unit/system/PSheet.spec.ts`
- Test: `tests/unit/system/AppShellResponsive.spec.ts`
- Test: `tests/unit/views/feed/FeedLayout.spec.ts`

- [ ] **Step 1: Run the focused responsive test suite**

Run:

```bash
bun vitest \
  tests/unit/system/MobileBottomNav.spec.ts \
  tests/unit/system/PSheet.spec.ts \
  tests/unit/system/AppShellResponsive.spec.ts \
  tests/unit/views/feed/FeedLayout.spec.ts
```

Expected: PASS with zero failures.

- [ ] **Step 2: Run a targeted manual smoke checklist**

Run:

```bash
bun dev
```

Check in browser:

1. Feed at `1280px`, `900px`, and `390px`
2. Media at `1280px`, `900px`, and `390px`
3. Blog or forum at `390px`
4. `更多` sheet opening and closing
5. Feed mobile source sheet opening, source selection, and manage action

Expected: mobile no longer shows left-column squeeze and bottom nav never overlaps controls without page padding.

- [ ] **Step 3: Record any approved exceptions in the spec**

```md
## Implementation Notes

1. Heavy editors may still need local header compaction after the shell lands.
2. The first rollout migrates feed mobile source access; other sidebar-heavy modules can follow the same header-plus-sheet rule.
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-06-20-site-responsive-layout-design.md
git commit -m "docs: record responsive shell rollout notes"
```

## Self-Review

### Spec coverage

Covered by plan:

1. Three breakpoints and shared shell: Tasks 2, 3, 4
2. Mobile bottom navigation with four items: Tasks 1, 3
3. `更多` large bottom sheet: Tasks 2, 3
4. Mobile top-bar and page-local actions: Tasks 5, 6
5. Feed migration away from left-edge source occupancy: Task 6
6. Shared adoption across `PSidebar`-based modules: Task 5
7. Testing and verification: Task 7

No spec gaps remain for the first implementation slice.

### Placeholder scan

Checked for `TBD`, `TODO`, vague “add tests,” and undefined command placeholders. None remain.

### Type consistency

Plan uses one shared `MobilePrimaryTab` / `MobileMoreItem` mapping source, one `side="bottom"` sheet mode, and one feed mobile sources sheet naming path across later tasks.
