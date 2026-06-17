# Feed Sidebar Subscriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Feed subscription source index into the left sidebar below the main navigation, using real outline SVG icons and hiding sources when collapsed.

**Architecture:** Extend the shared `PaperSidebarItem` primitive so sidebar items can render Vue icon components in addition to the existing text fallback. Add a focused `FeedSidebarSources` component for grouped subscriptions and place it in `FeedLayout` below the four Feed navigation items. Keep add/manage sheets and timeline filtering in `FeedView`; use route query parameters as the shared boundary between sidebar source selection and the page timeline.

**Tech Stack:** Vue 3.5, TypeScript, Vue Router, Pinia, Naive UI `NIcon`, `@vicons/ionicons5`, Vitest, Vue Test Utils, Bun.

---

## File Structure

- Modify `src/components/ui/PaperSidebarItem.vue`
  - Responsibility: render one sidebar navigation item as a `RouterLink` or button.
  - Change: accept an `icon` component prop and render it through `NIcon`, while preserving `iconChar` compatibility for other modules.

- Modify `src/components/ui/PaperSidebar.vue`
  - Responsibility: layout and collapsed behavior for shared module sidebars.
  - Change: style icon area for both expanded and collapsed states; hide the `bottom` slot in collapsed state so Feed sources disappear.

- Create `src/components/feed/FeedSidebarSources.vue`
  - Responsibility: render grouped subscription sources inside the sidebar without a sheet/drawer shell.
  - Inputs: `subscriptions`, `groups`, `activeSourceId`, `collapsed`.
  - Outputs: `select-source`, `manage`.
  - Behavior: group subscriptions by `subscription_group_id`, render unassigned subscriptions under “未分类”, emit selected subscription IDs, emit manage click.

- Modify `src/views/feed/FeedLayout.vue`
  - Responsibility: Feed module shell and left sidebar.
  - Change: use real icons for the four nav items, fetch feed groups/subscriptions for authenticated users, render `FeedSidebarSources` under navigation, and update route query when a source is selected.

- Modify `src/views/feed/FeedView.vue`
  - Responsibility: Feed page content, timeline, add/manage/article sheets.
  - Change: remove the right-edge subscription index trigger/sheet; keep management sheet and expose it through a shared route query action or event-compatible behavior from layout.

- Create `tests/unit/components/PaperSidebarItem.spec.ts`
  - Responsibility: verify icon component rendering and `iconChar` fallback.

- Create `tests/unit/components/feed/FeedSidebarSources.spec.ts`
  - Responsibility: verify grouped source rendering, active state, collapsed hiding, and emitted events.

- Create `tests/unit/views/feed/FeedLayout.spec.ts`
  - Responsibility: verify the Feed sidebar wires nav icons and source selection to route query.

---

### Task 1: Add Component Icon Support to PaperSidebarItem

**Files:**
- Modify: `src/components/ui/PaperSidebarItem.vue`
- Test: `tests/unit/components/PaperSidebarItem.spec.ts`

- [ ] **Step 1: Create the failing component test**

Create `tests/unit/components/PaperSidebarItem.spec.ts` with:

```ts
import { mount, RouterLinkStub } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import PaperSidebarItem from '@/components/ui/PaperSidebarItem.vue'

const TestIcon = {
  name: 'TestIcon',
  render: () => h('svg', { 'data-testid': 'test-icon', viewBox: '0 0 16 16' }),
}

describe('PaperSidebarItem', () => {
  it('renders a Vue icon component when icon is provided', () => {
    const wrapper = mount(PaperSidebarItem, {
      props: { to: '/', index: 1, icon: TestIcon },
      global: { stubs: { RouterLink: RouterLinkStub } },
      slots: { default: '订阅' },
    })

    expect(wrapper.find('[data-testid="test-icon"]').exists()).toBe(true)
    expect(wrapper.find('.paper-sidebar-item-icon').exists()).toBe(true)
    expect(wrapper.text()).toContain('01/')
    expect(wrapper.text()).toContain('订阅')
  })

  it('keeps rendering iconChar for existing callers', () => {
    const wrapper = mount(PaperSidebarItem, {
      props: { active: true, index: 2, iconChar: '探' },
      slots: { default: '探索' },
    })

    expect(wrapper.find('.paper-sidebar-item-icon').text()).toBe('探')
    expect(wrapper.text()).toContain('02/')
    expect(wrapper.text()).toContain('探索')
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
bun run test:unit -- tests/unit/components/PaperSidebarItem.spec.ts
```

Expected: FAIL because `icon` is not a defined prop and no SVG component is rendered.

- [ ] **Step 3: Implement icon component support**

Update `src/components/ui/PaperSidebarItem.vue` to this complete component:

```vue
<template>
  <RouterLink
    v-if="to"
    :to="to"
    class="a-sidebar-item"
    :class="{ 'is-focused': isFocused }"
    active-class="active"
    :exact-active-class="exact ? 'active' : ''"
  >
    <span v-if="index" class="a-sidebar-item-num">{{ formattedIndex }}</span>
    <span v-if="icon || iconChar" class="paper-sidebar-item-icon" aria-hidden="true">
      <NIcon v-if="icon" size="22" :component="icon" />
      <template v-else>{{ iconChar }}</template>
    </span>
    <span class="paper-sidebar-item-label"><slot /></span>
  </RouterLink>
  <button
    v-else
    type="button"
    class="a-sidebar-item"
    :class="{ active, 'is-focused': isFocused }"
    @click="$emit('click')"
  >
    <span v-if="index" class="a-sidebar-item-num">{{ formattedIndex }}</span>
    <span v-if="icon || iconChar" class="paper-sidebar-item-icon" aria-hidden="true">
      <NIcon v-if="icon" size="22" :component="icon" />
      <template v-else>{{ iconChar }}</template>
    </span>
    <span class="paper-sidebar-item-label"><slot /></span>
  </button>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import { NIcon } from 'naive-ui'

const props = defineProps<{
  to?: string | object
  index?: number | string
  active?: boolean
  exact?: boolean
  icon?: Component
  iconChar?: string
  isFocused?: boolean
}>()

defineEmits(['click'])

const formattedIndex = computed(() => {
  if (typeof props.index === 'number') {
    return String(props.index).padStart(2, '0') + '/'
  }
  return props.index
})
</script>

<style scoped>
.a-sidebar-item {
  outline: none;
}

.a-sidebar-item.is-focused {
  background: var(--a-color-paper-wash);
  box-shadow: inset 4px 0 0 var(--a-color-ink);
}
</style>
```

- [ ] **Step 4: Run the component test and verify it passes**

Run:

```bash
bun run test:unit -- tests/unit/components/PaperSidebarItem.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit this task**

Only commit if the user explicitly requested commits for this session. If committing is authorized, run:

```bash
git add src/components/ui/PaperSidebarItem.vue tests/unit/components/PaperSidebarItem.spec.ts
git commit -m "feat: support sidebar item icons"
```

---

### Task 2: Add Sidebar Source List Component

**Files:**
- Create: `src/components/feed/FeedSidebarSources.vue`
- Test: `tests/unit/components/feed/FeedSidebarSources.spec.ts`

- [ ] **Step 1: Create the failing test**

Create `tests/unit/components/feed/FeedSidebarSources.spec.ts` with:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FeedSidebarSources from '@/components/feed/FeedSidebarSources.vue'
import type { Subscription, SubscriptionGroup } from '@/types'

const groups: SubscriptionGroup[] = [
  { id: 'g-tech', user_id: 'u1', name: '科技生活', created_at: '', updated_at: '' },
  { id: 'g-culture', user_id: 'u1', name: '文化生活', created_at: '', updated_at: '' },
]

const subscriptions: Subscription[] = [
  {
    id: 'sub-1',
    user_id: 'u1',
    feed_source_id: 'source-1',
    title: '少数派',
    subscription_group_id: 'g-tech',
    created_at: '',
  },
  {
    id: 'sub-2',
    user_id: 'u1',
    feed_source_id: 'source-2',
    title: '英格兰周报',
    subscription_group_id: 'g-culture',
    created_at: '',
  },
  {
    id: 'sub-3',
    user_id: 'u1',
    feed_source_id: 'source-3',
    feed_source: {
      id: 'source-3',
      title: '未分类来源',
      rss_url: 'https://example.com/rss.xml',
      source_type: 'external_rss',
      status: 'active',
      created_at: '',
    },
    created_at: '',
  },
]

describe('FeedSidebarSources', () => {
  it('renders grouped subscriptions and unassigned subscriptions', () => {
    const wrapper = mount(FeedSidebarSources, {
      props: { subscriptions, groups, activeSourceId: 'sub-2' },
    })

    expect(wrapper.text()).toContain('订阅源类别 / SOURCES')
    expect(wrapper.text()).toContain('科技生活')
    expect(wrapper.text()).toContain('少数派')
    expect(wrapper.text()).toContain('文化生活')
    expect(wrapper.text()).toContain('英格兰周报')
    expect(wrapper.text()).toContain('未分类')
    expect(wrapper.text()).toContain('未分类来源')
    expect(wrapper.find('[data-source-id="sub-2"]').classes()).toContain('is-active')
  })

  it('emits select-source and manage events', async () => {
    const wrapper = mount(FeedSidebarSources, {
      props: { subscriptions, groups, activeSourceId: null },
    })

    await wrapper.find('[data-source-id="sub-1"]').trigger('click')
    await wrapper.find('[data-testid="feed-sidebar-manage"]').trigger('click')

    expect(wrapper.emitted('select-source')).toEqual([["sub-1"]])
    expect(wrapper.emitted('manage')).toEqual([[]])
  })

  it('hides the source index when collapsed', () => {
    const wrapper = mount(FeedSidebarSources, {
      props: { subscriptions, groups, activeSourceId: null, collapsed: true },
    })

    expect(wrapper.find('.feed-sidebar-sources').classes()).toContain('is-collapsed')
    expect(wrapper.text()).not.toContain('少数派')
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
bun run test:unit -- tests/unit/components/feed/FeedSidebarSources.spec.ts
```

Expected: FAIL because `FeedSidebarSources.vue` does not exist.

- [ ] **Step 3: Implement the component**

Create `src/components/feed/FeedSidebarSources.vue` with:

```vue
<template>
  <section class="feed-sidebar-sources" :class="{ 'is-collapsed': collapsed }" aria-label="订阅源类别">
    <template v-if="!collapsed">
      <div class="feed-sidebar-sources__head">
        <span>订阅源类别 / SOURCES</span>
        <button
          type="button"
          class="feed-sidebar-sources__manage a-font-meta"
          data-testid="feed-sidebar-manage"
          @click="$emit('manage')"
        >
          管理
        </button>
      </div>

      <div v-if="subscriptions.length" class="feed-sidebar-sources__body">
        <div v-for="group in visibleGroups" :key="group.id" class="feed-sidebar-sources__group">
          <p class="feed-sidebar-sources__group-title">▱ {{ group.name }}</p>
          <button
            v-for="sub in group.subscriptions"
            :key="sub.id"
            type="button"
            class="feed-sidebar-sources__item"
            :class="{ 'is-active': activeSourceId === sub.id }"
            :data-source-id="sub.id"
            @click="$emit('select-source', sub.id)"
          >
            <span class="feed-sidebar-sources__badge">{{ sourceBadge(sub) }}</span>
            <span class="feed-sidebar-sources__name">{{ sourceTitle(sub) }}</span>
            <span v-if="activeSourceId === sub.id" class="feed-sidebar-sources__count">1</span>
          </button>
        </div>
      </div>

      <p v-else class="feed-sidebar-sources__empty a-muted">暂无订阅源</p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Subscription, SubscriptionGroup } from '@/types'

const props = defineProps<{
  subscriptions: Subscription[]
  groups: SubscriptionGroup[]
  activeSourceId?: string | null
  collapsed?: boolean
}>()

defineEmits<{
  (e: 'select-source', sourceId: string): void
  (e: 'manage'): void
}>()

const sourceTitle = (sub: Subscription) => sub.title || sub.feed_source?.title || '未命名订阅'

const sourceBadge = (sub: Subscription) => {
  const title = sourceTitle(sub)
  if (title.includes('播客') || sub.feed_source?.rss_url?.includes('podcast')) return '播客'
  if (title.includes('周报') || title.includes('Newsletter')) return '周报'
  return '博客'
}

const visibleGroups = computed(() => {
  const groups = props.groups
    .map((group) => ({
      ...group,
      subscriptions: props.subscriptions.filter((sub) => sub.subscription_group_id === group.id),
    }))
    .filter((group) => group.subscriptions.length)

  const unassigned = props.subscriptions.filter((sub) => !sub.subscription_group_id)
  if (unassigned.length) {
    groups.push({
      id: 'unassigned',
      user_id: '',
      name: '未分类',
      created_at: '',
      updated_at: '',
      subscriptions: unassigned,
    })
  }

  return groups
})
</script>

<style scoped>
.feed-sidebar-sources {
  margin-top: 2.75rem;
  min-width: 0;
}

.feed-sidebar-sources.is-collapsed {
  display: none;
}

.feed-sidebar-sources__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  color: var(--a-color-muted);
  font-family: var(--a-font-meta);
  font-size: 0.75rem;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.feed-sidebar-sources__manage {
  border: none;
  background: transparent;
  color: var(--a-color-fg);
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 900;
  padding: 0;
}

.feed-sidebar-sources__manage:hover {
  text-decoration: underline;
}

.feed-sidebar-sources__body {
  display: flex;
  flex-direction: column;
  gap: 1.65rem;
  margin-top: 1.8rem;
}

.feed-sidebar-sources__group {
  display: grid;
  gap: 0.75rem;
}

.feed-sidebar-sources__group-title {
  color: var(--a-color-muted-soft);
  font-size: 0.88rem;
  font-weight: 900;
  margin: 0;
}

.feed-sidebar-sources__item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.85rem;
  width: 100%;
  border: none;
  background: transparent;
  color: var(--a-color-fg);
  cursor: pointer;
  font: inherit;
  padding: 0.25rem 0.1rem 0.25rem 0.75rem;
  text-align: left;
}

.feed-sidebar-sources__item:hover .feed-sidebar-sources__name {
  text-decoration: underline;
}

.feed-sidebar-sources__item.is-active {
  font-weight: 900;
}

.feed-sidebar-sources__badge {
  background: #f8fafc;
  border-radius: 0.35rem;
  color: var(--a-color-fg);
  font-size: 0.78rem;
  font-weight: 900;
  padding: 0.28rem 0.45rem;
}

.feed-sidebar-sources__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feed-sidebar-sources__count {
  align-items: center;
  background: var(--a-color-ink);
  border-radius: 999px;
  color: var(--a-color-paper);
  display: inline-flex;
  font-size: 0.72rem;
  font-weight: 900;
  height: 1.35rem;
  justify-content: center;
  min-width: 1.35rem;
  padding: 0 0.35rem;
}

.feed-sidebar-sources__empty {
  margin: 1.5rem 0 0;
  font-size: 0.85rem;
}
</style>
```

- [ ] **Step 4: Run the component test and verify it passes**

Run:

```bash
bun run test:unit -- tests/unit/components/feed/FeedSidebarSources.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit this task**

Only commit if the user explicitly requested commits for this session. If committing is authorized, run:

```bash
git add src/components/feed/FeedSidebarSources.vue tests/unit/components/feed/FeedSidebarSources.spec.ts
git commit -m "feat: add feed sidebar sources"
```

---

### Task 3: Wire FeedLayout Sidebar Icons and Sources

**Files:**
- Modify: `src/views/feed/FeedLayout.vue`
- Test: `tests/unit/views/feed/FeedLayout.spec.ts`

- [ ] **Step 1: Create the failing layout test**

Create `tests/unit/views/feed/FeedLayout.spec.ts` with:

```ts
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { describe, expect, it, vi } from 'vitest'
import FeedLayout from '@/views/feed/FeedLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'

const routerPush = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/', query: {} }),
  useRouter: () => ({ push: routerPush }),
}))

vi.mock('@/composables/useSubdomainNav', () => ({
  modulePathUrl: (_module: string, path: string) => path,
}))

describe('FeedLayout', () => {
  it('renders four icon-backed navigation items and sidebar sources', async () => {
    const wrapper = mount(FeedLayout, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
        stubs: { RouterLink: RouterLinkStub, RouterView: { template: '<main />' } },
      },
    })

    const authStore = useAuthStore()
    authStore.isAuthenticated = true
    const feedStore = useFeedStore()
    feedStore.groups = [{ id: 'g1', user_id: 'u1', name: '科技生活', created_at: '', updated_at: '' }]
    feedStore.subscriptions = [{
      id: 'sub-1',
      user_id: 'u1',
      feed_source_id: 'source-1',
      title: '少数派',
      subscription_group_id: 'g1',
      created_at: '',
    }]

    await flushPromises()

    expect(wrapper.findAll('.a-sidebar-item')).toHaveLength(4)
    expect(wrapper.findAll('.paper-sidebar-item-icon svg')).toHaveLength(4)
    expect(wrapper.text()).toContain('订阅源类别 / SOURCES')
    expect(wrapper.text()).toContain('少数派')
  })

  it('pushes source query and resets page when a source is selected', async () => {
    const wrapper = mount(FeedLayout, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
        stubs: { RouterLink: RouterLinkStub, RouterView: { template: '<main />' } },
      },
    })

    const authStore = useAuthStore()
    authStore.isAuthenticated = true
    const feedStore = useFeedStore()
    feedStore.groups = [{ id: 'g1', user_id: 'u1', name: '科技生活', created_at: '', updated_at: '' }]
    feedStore.subscriptions = [{
      id: 'sub-1',
      user_id: 'u1',
      feed_source_id: 'source-1',
      title: '少数派',
      subscription_group_id: 'g1',
      created_at: '',
    }]

    await flushPromises()
    await wrapper.find('[data-source-id="sub-1"]').trigger('click')

    expect(routerPush).toHaveBeenCalledWith({ path: '/', query: { source_id: 'sub-1' } })
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
bun run test:unit -- tests/unit/views/feed/FeedLayout.spec.ts
```

Expected: FAIL because `FeedLayout` still uses `iconChar` text icons and does not render `FeedSidebarSources`.

- [ ] **Step 3: Update FeedLayout**

Replace `src/views/feed/FeedLayout.vue` with:

```vue
<template>
  <div class="a-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <PaperSidebar
      collapsible
      v-model:collapsed="sidebarCollapsed"
    >
      <PaperSidebarItem
        v-for="(item, index) in navItems"
        :key="item.to"
        :to="item.to"
        :index="index + 1"
        :icon="item.icon"
        :is-focused="uiStore.focusedSection === 'sidebar' && focusedSidebarIndex === index"
        :exact="item.exact"
      >
        {{ item.label }}
      </PaperSidebarItem>

      <template #bottom>
        <FeedSidebarSources
          v-if="authStore.isAuthenticated"
          :subscriptions="subscriptions"
          :groups="groups"
          :active-source-id="querySourceId"
          :collapsed="sidebarCollapsed"
          @select-source="selectSource"
          @manage="openManageSheet"
        />
      </template>
    </PaperSidebar>
    <main class="a-main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { BookmarkOutline, CompassOutline, LogoRss, StarOutline } from '@vicons/ionicons5'
import PaperSidebar from '@/components/ui/PaperSidebar.vue'
import PaperSidebarItem from '@/components/ui/PaperSidebarItem.vue'
import FeedSidebarSources from '@/components/feed/FeedSidebarSources.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { useUIStore } from '@/stores/ui'
import { useKeyboardLayout } from '@/composables/useKeyboardLayout'
import { useKeyboardList } from '@/composables/useKeyboardList'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const feedStore = useFeedStore()
const uiStore = useUIStore()

useKeyboardLayout()

const sidebarStorageKey = 'atoman.feed.sidebar.collapsed'
const sidebarCollapsed = ref(false)

const subscriptions = computed(() => feedStore.subscriptions)
const groups = computed(() => feedStore.groups)
const querySourceId = computed(() => typeof route.query.source_id === 'string' ? route.query.source_id : null)

const navItems = [
  { to: '/', label: '订阅', icon: LogoRss, exact: true },
  { to: '/explore', label: '探索', icon: CompassOutline },
  { to: '/reading-list', label: '稍后阅读', icon: BookmarkOutline },
  { to: '/starred', label: '收藏', icon: StarOutline },
]

const { focusedIndex: focusedSidebarIndex } = useKeyboardList({
  items: ref(navItems),
  section: 'sidebar',
})

const syncSidebarFocus = () => {
  const currentIndex = navItems.findIndex(item =>
    item.exact ? route.path === item.to : route.path.startsWith(item.to as string),
  )
  if (currentIndex !== -1) {
    focusedSidebarIndex.value = currentIndex
  }
}

const ensureSidebarSources = () => {
  if (!authStore.isAuthenticated) return
  void Promise.all([feedStore.fetchSubscriptions(), feedStore.fetchGroups()])
}

const selectSource = (sourceId: string) => {
  void router.push({ path: '/', query: { source_id: sourceId } })
}

const openManageSheet = () => {
  void router.push({ path: '/', query: { ...route.query, manage_subscriptions: '1' } })
}

watch(() => uiStore.focusedSection, (section) => {
  if (section === 'sidebar') {
    syncSidebarFocus()
  }
})

watch(focusedSidebarIndex, (newIndex) => {
  if (uiStore.focusedSection === 'sidebar' && navItems[newIndex]) {
    router.push(navItems[newIndex].to)
  }
})

watch(() => authStore.isAuthenticated, ensureSidebarSources, { immediate: true })

onMounted(() => {
  syncSidebarFocus()
  sidebarCollapsed.value = localStorage.getItem(sidebarStorageKey) === 'true'
})

watch(sidebarCollapsed, (collapsed) => {
  localStorage.setItem(sidebarStorageKey, String(collapsed))
})
</script>

<style scoped>
kbd {
  font-family: inherit;
  background: #fff;
  border: 1px solid var(--a-color-line-soft);
  padding: 0.1rem 0.3rem;
  border-radius: 0;
  font-weight: 900;
}
</style>
```

- [ ] **Step 4: Run the layout test and verify it passes**

Run:

```bash
bun run test:unit -- tests/unit/views/feed/FeedLayout.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit this task**

Only commit if the user explicitly requested commits for this session. If committing is authorized, run:

```bash
git add src/views/feed/FeedLayout.vue tests/unit/views/feed/FeedLayout.spec.ts
git commit -m "feat: wire feed sidebar sources"
```

---

### Task 4: Remove FeedView Source Drawer and Handle Sidebar Manage Query

**Files:**
- Modify: `src/views/feed/FeedView.vue`
- Test: `tests/unit/views/feed/FeedView.spec.ts`

- [ ] **Step 1: Add failing assertions to the existing FeedView test**

Open `tests/unit/views/feed/FeedView.spec.ts` and add this test to the existing `describe` block:

```ts
it('opens subscription management from manage_subscriptions query and clears the query', async () => {
  const replace = vi.fn()
  vi.doMock('vue-router', () => ({
    useRoute: () => ({ query: { manage_subscriptions: '1' } }),
    useRouter: () => ({ replace }),
  }))

  const wrapper = mount(FeedView, {
    global: {
      plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
      stubs: {
        AModal: true,
        PaperIndexTrigger: true,
        SubscriptionIndexSheet: true,
        SubscriptionAddSheet: true,
        SubscriptionManageSheet: { template: '<div data-testid="manage-sheet" />' },
        FeedArticleSheet: true,
        FeedTimelineFooter: true,
        ShortcutHints: true,
      },
    },
  })

  await flushPromises()

  expect(wrapper.find('[data-testid="manage-sheet"]').exists()).toBe(true)
  expect(replace).toHaveBeenCalledWith({ query: {} })
})
```

If the existing test file mocks `vue-router` at top level, adapt the assertion to that mock instead of using `vi.doMock`; the required behavior is: route query `manage_subscriptions=1` sets `showManageSheet` to true and then removes `manage_subscriptions` from the URL query.

- [ ] **Step 2: Run FeedView tests and verify the new assertion fails**

Run:

```bash
bun run test:unit -- tests/unit/views/feed/FeedView.spec.ts
```

Expected: FAIL because `FeedView` does not handle `manage_subscriptions` query yet, and still renders right-edge source drawer controls.

- [ ] **Step 3: Remove the source drawer template**

In `src/views/feed/FeedView.vue`, delete this template block:

```vue
<!-- Index Trigger fixed to the right edge -->
<PaperIndexTrigger 
  v-if="authStore.isAuthenticated" 
  :active="showIndex"
  @click="showIndex = !showIndex"
>
  {{ showIndex ? '收起' : '订阅源' }}
</PaperIndexTrigger>

<SubscriptionIndexSheet
  :show="showIndex"
  :subscriptions="subscriptions"
  :groups="groups"
  :active-source-id="querySourceId"
  @close="showIndex = false"
  @select-source="selectSource"
/>
```

- [ ] **Step 4: Remove unused imports and state from FeedView**

In the `<script setup>` imports, remove:

```ts
import PaperIndexTrigger from '@/components/ui/PaperIndexTrigger.vue'
import SubscriptionIndexSheet from '@/components/feed/SubscriptionIndexSheet.vue'
```

Remove this state line:

```ts
const showIndex = ref(false)
```

Remove this function:

```ts
const selectSource = (sourceId: string) => {
  void navigateModuleWithShutter(modulePathUrl('feed', `/?source_id=${encodeURIComponent(sourceId)}`))
  showIndex.value = false
}
```

If `navigateModuleWithShutter` becomes unused, remove:

```ts
import { useAsyncNavigate } from '@/composables/useAsyncNavigate'
const { navigateModuleWithShutter } = useAsyncNavigate()
```

Keep `modulePathUrl` if article metadata links still use it.

Remove the `showIndex` watcher:

```ts
watch(showIndex, (visible) => {
  if (visible && authStore.isAuthenticated) {
    if (!subscriptions.value.length || !groups.value.length) {
      void Promise.all([feedStore.fetchSubscriptions(), feedStore.fetchGroups()])
    }
  }
})
```

- [ ] **Step 5: Add manage query handling**

After the `watch(showManageSheet, ...)` block in `src/views/feed/FeedView.vue`, add:

```ts
watch(() => route.query.manage_subscriptions, async (value) => {
  if (value !== '1') return
  showManageSheet.value = true
  const { manage_subscriptions: _manageSubscriptions, ...query } = route.query
  await router.replace({ query })
}, { immediate: true })
```

- [ ] **Step 6: Run FeedView tests and verify they pass**

Run:

```bash
bun run test:unit -- tests/unit/views/feed/FeedView.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit this task**

Only commit if the user explicitly requested commits for this session. If committing is authorized, run:

```bash
git add src/views/feed/FeedView.vue tests/unit/views/feed/FeedView.spec.ts
git commit -m "refactor: move feed source index out of drawer"
```

---

### Task 5: Polish Shared Sidebar Collapsed and Expanded Styling

**Files:**
- Modify: `src/components/ui/PaperSidebar.vue`
- Modify: `src/components/ui/PaperSidebarItem.vue`
- Test: `tests/unit/components/PaperSidebarItem.spec.ts`
- Test: `tests/unit/components/feed/FeedSidebarSources.spec.ts`

- [ ] **Step 1: Add styling contract assertions**

Append this test to `tests/unit/components/PaperSidebarItem.spec.ts`:

```ts
it('places icon after the label content in DOM order for expanded sidebars', () => {
  const wrapper = mount(PaperSidebarItem, {
    props: { active: true, index: 1, icon: TestIcon },
    slots: { default: '订阅' },
  })

  const itemHtml = wrapper.html()
  expect(itemHtml.indexOf('01/')).toBeLessThan(itemHtml.indexOf('paper-sidebar-item-label'))
  expect(itemHtml.indexOf('paper-sidebar-item-label')).toBeLessThan(itemHtml.indexOf('paper-sidebar-item-icon'))
})
```

This fails with the Task 1 implementation because the icon is before the label.

- [ ] **Step 2: Run the style contract tests and verify failure**

Run:

```bash
bun run test:unit -- tests/unit/components/PaperSidebarItem.spec.ts tests/unit/components/feed/FeedSidebarSources.spec.ts
```

Expected: FAIL on DOM order.

- [ ] **Step 3: Move icon after label in PaperSidebarItem**

In both the `RouterLink` and `button` branches of `src/components/ui/PaperSidebarItem.vue`, change the child order to:

```vue
<span v-if="index" class="a-sidebar-item-num">{{ formattedIndex }}</span>
<span class="paper-sidebar-item-label"><slot /></span>
<span v-if="icon || iconChar" class="paper-sidebar-item-icon" aria-hidden="true">
  <NIcon v-if="icon" size="22" :component="icon" />
  <template v-else>{{ iconChar }}</template>
</span>
```

- [ ] **Step 4: Update PaperSidebar styles**

In `src/components/ui/PaperSidebar.vue`, replace the style block with:

```vue
<style scoped>
.a-sidebar {
  transition: width 0.2s ease;
}

.a-sidebar.is-collapsed {
  width: var(--a-sidebar-collapsed-width, 4.5rem);
}

.a-sidebar-head {
  display: grid;
  gap: 0.75rem;
  align-items: start;
  min-height: 4rem;
  position: relative;
}

.a-sidebar.is-collapsed .a-sidebar-head {
  justify-items: center;
}

.a-sidebar.is-collapsed .a-sidebar-label,
.a-sidebar.is-collapsed .a-sidebar-helper,
.a-sidebar.is-collapsed .paper-sidebar-bottom {
  display: none;
}

.a-sidebar-collapse-btn {
  position: absolute;
  top: 1.25rem;
  left: 1.25rem;
  width: 2.5rem;
  height: 2.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--a-color-fg);
  cursor: pointer;
  border-radius: 50%;
  transition: background-color 0.2s, color 0.2s;
  z-index: 10;
}

.a-sidebar-collapse-btn:hover {
  background: rgba(0, 0, 0, 0.05);
}

.paper-sidebar-nav {
  display: flex;
  flex-direction: column;
  padding-top: 1rem;
}

.paper-sidebar-bottom {
  margin-top: 2.75rem;
}

:deep(.a-sidebar-item) {
  align-items: center;
  border-radius: 0.75rem;
  display: grid;
  gap: 1rem;
  grid-template-columns: auto minmax(0, 1fr) auto;
  min-height: 3.75rem;
  padding: 0 1.35rem;
  transition: background-color 0.2s, color 0.2s, padding 0.2s;
}

:deep(.paper-sidebar-item-icon) {
  align-items: center;
  color: currentColor;
  display: inline-flex;
  flex-shrink: 0;
  justify-content: center;
  width: 1.5rem;
}

:deep(.paper-sidebar-item-icon .n-icon) {
  display: block;
}

.a-sidebar.is-collapsed :deep(.a-sidebar-item-num),
.a-sidebar.is-collapsed :deep(.paper-sidebar-item-label) {
  display: none;
}

.a-sidebar.is-collapsed :deep(.a-sidebar-item) {
  display: flex;
  justify-content: center;
  gap: 0;
  min-height: 3.5rem;
  padding: 0;
}

.a-sidebar.is-collapsed :deep(.paper-sidebar-item-icon) {
  width: auto;
}

.a-sidebar.is-collapsed .paper-sidebar-nav {
  padding-top: 1.25rem;
}

@media (max-width: 768px) {
  .a-sidebar.is-collapsed {
    width: var(--a-sidebar-collapsed-width, 4.5rem);
  }
}
</style>
```

- [ ] **Step 5: Run style contract tests and verify they pass**

Run:

```bash
bun run test:unit -- tests/unit/components/PaperSidebarItem.spec.ts tests/unit/components/feed/FeedSidebarSources.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit this task**

Only commit if the user explicitly requested commits for this session. If committing is authorized, run:

```bash
git add src/components/ui/PaperSidebar.vue src/components/ui/PaperSidebarItem.vue tests/unit/components/PaperSidebarItem.spec.ts tests/unit/components/feed/FeedSidebarSources.spec.ts
git commit -m "style: polish feed sidebar navigation"
```

---

### Task 6: Final Verification

**Files:**
- Verify changed source files and tests.

- [ ] **Step 1: Run focused unit tests**

Run:

```bash
bun run test:unit -- tests/unit/components/PaperSidebarItem.spec.ts tests/unit/components/feed/FeedSidebarSources.spec.ts tests/unit/views/feed/FeedLayout.spec.ts tests/unit/views/feed/FeedView.spec.ts
```

Expected: all tests PASS.

- [ ] **Step 2: Run type check**

Run:

```bash
bun run type-check
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 3: Start the dev server for manual UI verification**

Run:

```bash
bun run dev
```

Expected: Vite starts and prints a local URL.

- [ ] **Step 4: Verify the UI in a browser**

Use the browser to check:

1. Feed sidebar expanded state shows four nav rows with `01/` through `04/`, labels, and real SVG icons.
2. Subscription sources appear below the nav under `订阅源类别 / SOURCES`.
3. Clicking a source navigates to `/?source_id=<id>` and the timeline filters to that source.
4. Clicking `管理` opens the subscription management sheet.
5. Collapsing the sidebar hides nav labels, nav numbers, and all subscription sources; only four SVG icons remain visible.
6. Expanding the sidebar restores nav labels and source list.

- [ ] **Step 5: Stop dev server**

If the dev server was started in the foreground, press `Ctrl+C`. If it was started in the background by the harness, stop the recorded background task.

- [ ] **Step 6: Report verification evidence**

Report the focused test result, type-check result, and manual browser checks. Do not claim completion unless all required checks above pass, or explicitly state which check could not be run and why.

---

## Self-Review

- Spec coverage: The plan covers real SVG nav icons, source index below nav, collapsed icon-only behavior, route query source selection, management entry, and required type-check/manual UI verification.
- Placeholder scan: No TBD/TODO/implement-later placeholders remain. The only adaptive instruction is for an existing test mock shape, because the current file must be respected during implementation.
- Type consistency: `Subscription`, `SubscriptionGroup`, `activeSourceId`, `select-source`, `manage`, and query names are consistent across tasks.
