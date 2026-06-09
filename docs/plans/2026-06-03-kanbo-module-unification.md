# 刊播模块整合 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 blog / podcast / video 三个一级模块整合为新的“刊播”模块，统一前端导航、频道上下文、创作工作台与内容总览，同时保留后端 `post` / `podcast` / `video` 分路由实现。

**Architecture:** 先在前端建立新的 `kanbo` 模块入口、统一 topbar 功能命名和模块排序，再用一个新的刊播布局页承载“创作 / 文章 / 视频 / 播客 / 订阅 / 收藏”六个入口。创作页成为主工作台：首页展示频道总览态，选中合集后切到对应类型工作态；文章、播客、视频保留各自详情与编辑能力，后端接口继续按类型拆分。

**Tech Stack:** Vue 3.5、Vue Router 4、TypeScript 5.9、Pinia 3、现有 `PaperSidebar` / `PaperSidebarItem` 组件、Go Gin 后端（只复用现有接口，不统一后端命名）。

---

## File Structure Map

**Modified Files:**
- `web/src/config/moduleRooms.ts`: 将顶层模块显示名改成功能名，新增 `kanbo` 模块并调整导航顺序。
- `web/src/components/AppTopbar.vue`: 适配 `kanbo` 模块、移除仅 blog 上下文的辅助链接逻辑、确保显示功能名。
- `web/src/router/routes/modules.ts`: 增加 `kanbo` 路由树，并保留 `blog` / `podcast` / `video` 细分内容详情或编辑入口的兼容路由。
- `web/src/router/siteContext.ts`: 让子域名或模块上下文能识别 `kanbo`。
- `web/src/router/siteUrls.ts`: 增加 `kanbo` 模块 URL 生成支持。
- `web/src/composables/useSubdomainNav.ts`: 让模块导航可跳转 `kanbo`。
- `web/src/stores/siteAccess.ts`: 如模块权限白名单依赖 `ModuleRoomKey`，补上 `kanbo` 可见性与能力映射。
- `web/src/views/blog/BlogHomeView.vue`: 从“博客模块首页”降级为刊播中的文章视角页，标题与副标题改为功能名。
- `web/src/views/blog/BlogLayout.vue`: 如保留兼容入口，改为薄包装或重定向，不再作为一级体验壳。
- `web/src/views/video/VideoHomeView.vue`: 从“视频模块首页”降级为刊播中的视频视角页。
- `web/src/views/video/VideoLayout.vue`: 如保留兼容入口，改为薄包装或重定向。
- `web/src/views/podcast/PodcastHomeView.vue`: 从“播客模块首页”降级为刊播中的播客视角页。
- `web/src/views/podcast/PodcastLayout.vue`: 如保留兼容入口，改为薄包装或重定向。
- `web/src/views/feed/FeedView.vue`: topbar 名称变为“订阅”后，确认标题与文案一致。
- `web/src/views/forum/ForumHomeView.vue`: 标题与 topbar 统一为“论坛”。
- `web/src/components/onboarding/FirstLoginOnboarding.vue`: 把“Studio / blog / video / podcast”描述更新为“刊播 / 创作”等新术语。
- `web/src/composables/useApi.ts` 或相关 API 组合式：如果刊播工作台需要统一拉取文章、播客、视频列表，新增最小包装方法，但底层仍调用原 `blog` / `podcast` / `video` API。
- `doc/api-v1.md`: 只有当前端需要新的聚合接口时才更新；若纯复用现有接口且不改契约，可不动。

**New Files:**
- `web/src/views/kanbo/KanboLayout.vue`: 刊播模块统一布局与侧边栏。
- `web/src/views/kanbo/KanboCreateView.vue`: 创作工作台主页（频道总览态 + 合集工作态）。
- `web/src/views/kanbo/KanboArticlesView.vue`: 全站文章探索视角页。
- `web/src/views/kanbo/KanboPodcastsView.vue`: 全站播客探索视角页。
- `web/src/views/kanbo/KanboVideosView.vue`: 全站视频探索视角页。
- `web/src/views/kanbo/KanboSubscriptionsView.vue`: 刊播内的全局订阅页壳（可复用现有订阅内容）。
- `web/src/views/kanbo/KanboBookmarksView.vue`: 刊播内的全局收藏页壳。
- `web/src/components/kanbo/KanboChannelSwitcher.vue`: topbar 右侧频道切换控件，只展示当前登录用户可经营频道。
- `web/src/components/kanbo/KanboCollectionRail.vue`: 创作页上方合集层。
- `web/src/components/kanbo/KanboMixedFeedSection.vue`: 文章 + 播客总览区（默认 5 条，可展开）。
- `web/src/components/kanbo/KanboVideoCardSection.vue`: 视频总览卡片区。
- `web/src/components/kanbo/KanboCollectionWorkspace.vue`: 选中合集后的工作态壳，根据类型切换子视图。
- `web/src/components/kanbo/KanboEmptyState.vue`: 无频道 / 无合集等统一空状态。
- `web/src/composables/useKanboChannel.ts`: 当前频道上下文读取与切换。
- `web/src/composables/useKanboCollections.ts`: 拉取当前频道合集，并维持选中合集状态。
- `web/src/composables/useKanboOverview.ts`: 聚合拉取文章、播客、视频总览数据。
- `web/tests/unit/moduleRooms.kanbo.spec.ts`: 模块命名与排序测试。
- `web/tests/unit/KanboLayout.spec.ts`: 刊播侧边栏与默认入口测试。
- `web/tests/unit/KanboCreateView.spec.ts`: 创作页总览态 / 工作态测试。
- `web/tests/unit/useKanboCollections.spec.ts`: 选中合集、切频道清空状态测试。

**Notes:**
- 不要求新建后端聚合路由。优先在前端组合现有 `blog` / `podcast` / `video` 数据。
- 若现有播客列表 API 无法按频道直接支持，则在计划后半段补一个最小后端查询接口，但仍挂在 `podcast` 处理器下。

---

### Task 1: Rename topbar modules to functional names and add `kanbo` room key

**Files:**
- Modify: `web/src/config/moduleRooms.ts`
- Test: `web/tests/unit/moduleRooms.kanbo.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// web/tests/unit/moduleRooms.kanbo.spec.ts
import { describe, it, expect } from 'vitest'
import { moduleNavOrder, moduleRooms } from '@/config/moduleRooms'

describe('moduleRooms kanbo integration', () => {
  it('uses functional names for topbar and includes kanbo', () => {
    expect(moduleRooms.feed.name).toBe('订阅')
    expect(moduleRooms.music.name).toBe('音乐')
    expect(moduleRooms.forum.name).toBe('论坛')
    expect(moduleRooms.kanbo.name).toBe('刊播')
  })

  it('orders topbar rooms as 订阅 → 刊播 → 音乐 → 论坛', () => {
    expect(moduleNavOrder.slice(0, 4)).toEqual(['feed', 'kanbo', 'music', 'forum'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run tests/unit/moduleRooms.kanbo.spec.ts`
Expected: FAIL with TypeScript error or assertion error because `kanbo` does not exist and names are still room-style labels.

- [ ] **Step 3: Write minimal implementation**

Edit `web/src/config/moduleRooms.ts`.

```typescript
export type ModuleRoomKey =
  | 'feed'
  | 'kanbo'
  | 'music'
  | 'forum'
  | 'debate'
  | 'timeline'
  | 'blog'
  | 'podcast'
  | 'video'

export const moduleRooms: Record<ModuleRoomKey, ModuleRoom> = {
  feed: {
    key: 'feed',
    homePath: '/',
    name: '订阅',
    helper: 'RSS 与更新流',
    homepageSub: '聚合你感兴趣的 RSS 订阅源与内容更新。',
  },
  kanbo: {
    key: 'kanbo',
    homePath: '/',
    name: '刊播',
    helper: '文章、播客、视频',
    homepageSub: '统一管理频道内的文章、播客与视频创作。',
  },
  music: {
    key: 'music',
    homePath: '/',
    name: '音乐',
    helper: '音乐档案',
    homepageSub: '整理专辑、歌曲与艺人资料。',
  },
  forum: {
    key: 'forum',
    homePath: '/',
    name: '论坛',
    helper: '讨论与发帖',
    homepageSub: '坐下来发帖、回复、搜索和闲谈。',
  },
  debate: {
    key: 'debate',
    homePath: '/',
    name: '辩论',
    helper: '辩题讨论',
    homepageSub: '围绕辩题展开立场、论点与正反讨论。',
  },
  timeline: {
    key: 'timeline',
    homePath: '/',
    name: '时间线',
    helper: '人物时间线',
    homepageSub: '记录人物与事件，查看时间脉络和地图。',
  },
  blog: {
    key: 'blog',
    homePath: '/',
    name: '文章',
    helper: '刊播内容视图',
    homepageSub: '探索本网站发布的全部文章。',
  },
  podcast: {
    key: 'podcast',
    homePath: '/',
    name: '播客',
    helper: '刊播内容视图',
    homepageSub: '探索本网站发布的全部播客单集。',
  },
  video: {
    key: 'video',
    homePath: '/',
    name: '视频',
    helper: '刊播内容视图',
    homepageSub: '探索本网站发布的全部视频。',
  },
}

export const moduleNavOrder: ModuleRoomKey[] = [
  'feed',
  'kanbo',
  'music',
  'forum',
  'debate',
  'timeline',
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run tests/unit/moduleRooms.kanbo.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/config/moduleRooms.ts web/tests/unit/moduleRooms.kanbo.spec.ts
git commit -m "feat(kanbo): rename topbar modules and add kanbo module entry"
```

### Task 2: Add `kanbo` routing and module navigation support

**Files:**
- Modify: `web/src/router/routes/modules.ts`
- Modify: `web/src/composables/useSubdomainNav.ts`
- Modify: `web/src/router/siteUrls.ts`
- Modify: `web/src/router/siteContext.ts`
- Test: `web/tests/unit/kanbo-routing.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// web/tests/unit/kanbo-routing.spec.ts
import { describe, it, expect } from 'vitest'
import { moduleRoutes } from '@/router/routes/modules'

describe('kanbo routes', () => {
  it('registers the kanbo module and required child routes', () => {
    const routes = moduleRoutes.kanbo
    expect(routes).toBeTruthy()
    const root = routes.find(route => route.path === '/')
    expect(root).toBeTruthy()
    const children = root?.children || []
    expect(children.map(child => child.path)).toEqual([
      '',
      'create',
      'articles',
      'videos',
      'podcasts',
      'subscriptions',
      'bookmarks',
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run tests/unit/kanbo-routing.spec.ts`
Expected: FAIL because `moduleRoutes.kanbo` is undefined.

- [ ] **Step 3: Write minimal implementation**

Edit `web/src/router/routes/modules.ts`.

```typescript
kanbo: [
  ...settingRoutes,
  {
    path: '/',
    component: () => import('@/views/kanbo/KanboLayout.vue'),
    meta: { hasSidebar: true },
    children: [
      { path: '', redirect: '/create' },
      { path: 'create', component: () => import('@/views/kanbo/KanboCreateView.vue'), meta: { requiresAuth: true } },
      { path: 'articles', component: () => import('@/views/kanbo/KanboArticlesView.vue'), meta: { requiresAuth: true } },
      { path: 'videos', component: () => import('@/views/kanbo/KanboVideosView.vue'), meta: { requiresAuth: true } },
      { path: 'podcasts', component: () => import('@/views/kanbo/KanboPodcastsView.vue'), meta: { requiresAuth: true } },
      { path: 'subscriptions', component: () => import('@/views/kanbo/KanboSubscriptionsView.vue'), meta: { requiresAuth: true } },
      { path: 'bookmarks', component: () => import('@/views/kanbo/KanboBookmarksView.vue'), meta: { requiresAuth: true } },
    ],
  },
  { path: '/login', component: () => import('@/views/auth/LoginView.vue'), meta: { authLayout: true } },
  { path: '/register', component: () => import('@/views/auth/LoginView.vue'), meta: { authLayout: true } },
  { path: '/:pathMatch(.*)*', component: () => import('@/views/NotFoundView.vue') },
],
```

Edit `web/src/router/siteUrls.ts` and `web/src/router/siteContext.ts` so `kanbo` is treated like other module keys. If these files switch on `ModuleRoomKey`, add `kanbo` to the accepted set and allow `moduleUrl('kanbo')` to resolve.

Edit `web/src/composables/useSubdomainNav.ts` only if TypeScript needs help after `ModuleRoomKey` expansion; no behavioral change besides accepting `kanbo`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run tests/unit/kanbo-routing.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/router/routes/modules.ts web/src/router/siteUrls.ts web/src/router/siteContext.ts web/src/composables/useSubdomainNav.ts web/tests/unit/kanbo-routing.spec.ts
git commit -m "feat(kanbo): add unified kanbo route tree and navigation support"
```

### Task 3: Update AppTopbar to use functional names only

**Files:**
- Modify: `web/src/components/AppTopbar.vue`
- Test: `web/tests/unit/AppTopbar.kanbo.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// web/tests/unit/AppTopbar.kanbo.spec.ts
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { describe, it, expect, vi } from 'vitest'
import AppTopbar from '@/components/AppTopbar.vue'

vi.mock('@/composables/useSubdomainNav', () => ({
  useModuleNav: () => ({ navigateTo: vi.fn() }),
  moduleUrl: (key: string) => `/${key}`,
}))

describe('AppTopbar functional nav labels', () => {
  it('renders 订阅 / 刊播 / 音乐 / 论坛 as first nav items and hides room names', () => {
    const wrapper = mount(AppTopbar, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
        stubs: ['RouterLink', 'AppTopbarAuthControls'],
      },
    })
    const names = wrapper.findAll('.nav-link-name').map(node => node.text())
    expect(names.slice(0, 4)).toEqual(['订阅', '刊播', '音乐', '论坛'])
    expect(wrapper.text()).not.toContain('山门')
    expect(wrapper.text()).not.toContain('法堂')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run tests/unit/AppTopbar.kanbo.spec.ts`
Expected: FAIL because current labels still use room names and blog-only helper links still appear.

- [ ] **Step 3: Write minimal implementation**

Edit `web/src/components/AppTopbar.vue`.

```ts
const isKanboContext = computed(() => siteContext.value.type === 'module' && siteContext.value.module === 'kanbo')
```

Remove the old blog-only quick links block entirely:

```vue
<template v-if="isKanboContext">
  <span class="nav-sep">|</span>
  <RouterLink to="/create" class="nav-link-sm">创作</RouterLink>
  <RouterLink to="/articles" class="nav-link-sm">文章</RouterLink>
</template>
```

If the quick links feel noisy, omit the replacement entirely and keep topbar pure.

Delete these old lines from the script:

```ts
const isBlogContext = computed(() => siteContext.value.type === 'module' && siteContext.value.module === 'blog')
const canCreatePost = computed(() => siteAccessStore.isFeatureEnabled('blog', 'post.create'))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run tests/unit/AppTopbar.kanbo.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/components/AppTopbar.vue web/tests/unit/AppTopbar.kanbo.spec.ts
git commit -m "refactor(nav): switch topbar to functional kanbo naming"
```

### Task 4: Create the Kanbo module layout and sidebar shell

**Files:**
- Create: `web/src/views/kanbo/KanboLayout.vue`
- Test: `web/tests/unit/KanboLayout.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// web/tests/unit/KanboLayout.spec.ts
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import KanboLayout from '@/views/kanbo/KanboLayout.vue'

describe('KanboLayout', () => {
  it('renders the six kanbo sidebar entries in order', () => {
    const wrapper = mount(KanboLayout, {
      global: {
        stubs: ['router-view', 'PaperSidebar', 'PaperSidebarItem'],
      },
    })
    const items = wrapper.findAll('paper-sidebar-item-stub').map(node => node.text())
    expect(items).toEqual(['创作', '文章', '视频', '播客', '订阅', '收藏'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run tests/unit/KanboLayout.spec.ts`
Expected: FAIL because the file does not exist.

- [ ] **Step 3: Write minimal implementation**

```vue
<!-- web/src/views/kanbo/KanboLayout.vue -->
<template>
  <div class="a-module-layout">
    <PaperSidebar :label="moduleRooms.kanbo.name" :helper="moduleRooms.kanbo.helper">
      <PaperSidebarItem to="/create" :index="1">创作</PaperSidebarItem>
      <PaperSidebarItem to="/articles" :index="2">文章</PaperSidebarItem>
      <PaperSidebarItem to="/videos" :index="3">视频</PaperSidebarItem>
      <PaperSidebarItem to="/podcasts" :index="4">播客</PaperSidebarItem>
      <PaperSidebarItem to="/subscriptions" :index="5">订阅</PaperSidebarItem>
      <PaperSidebarItem to="/bookmarks" :index="6">收藏</PaperSidebarItem>
    </PaperSidebar>
    <main class="a-main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { moduleRooms } from '@/config/moduleRooms'
import PaperSidebar from '@/components/ui/PaperSidebar.vue'
import PaperSidebarItem from '@/components/ui/PaperSidebarItem.vue'
</script>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run tests/unit/KanboLayout.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/views/kanbo/KanboLayout.vue web/tests/unit/KanboLayout.spec.ts
 git commit -m "feat(kanbo): add unified kanbo layout and sidebar shell"
```

### Task 5: Add current-channel and collection selection composables

**Files:**
- Create: `web/src/composables/useKanboChannel.ts`
- Create: `web/src/composables/useKanboCollections.ts`
- Test: `web/tests/unit/useKanboCollections.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// web/tests/unit/useKanboCollections.spec.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useKanboCollections } from '@/composables/useKanboCollections'

describe('useKanboCollections', () => {
  beforeEach(() => {
    const { clearSelectionForTest } = useKanboCollections()
    clearSelectionForTest()
  })

  it('tracks selected collection id', () => {
    const { selectedCollectionId, selectCollection } = useKanboCollections()
    expect(selectedCollectionId.value).toBeNull()
    selectCollection('collection-1')
    expect(selectedCollectionId.value).toBe('collection-1')
  })

  it('clears selected collection when channel changes', () => {
    const { selectedCollectionId, selectCollection, resetForChannel } = useKanboCollections()
    selectCollection('collection-1')
    resetForChannel('channel-2')
    expect(selectedCollectionId.value).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run tests/unit/useKanboCollections.spec.ts`
Expected: FAIL because the composable does not exist.

- [ ] **Step 3: Write minimal implementation**

```typescript
// web/src/composables/useKanboCollections.ts
import { ref } from 'vue'

const selectedChannelId = ref<string | null>(null)
const selectedCollectionId = ref<string | null>(null)

export function useKanboCollections() {
  const selectCollection = (id: string) => {
    selectedCollectionId.value = id
  }

  const resetForChannel = (channelId: string | null) => {
    selectedChannelId.value = channelId
    selectedCollectionId.value = null
  }

  const clearSelectionForTest = () => {
    selectedChannelId.value = null
    selectedCollectionId.value = null
  }

  return {
    selectedChannelId,
    selectedCollectionId,
    selectCollection,
    resetForChannel,
    clearSelectionForTest,
  }
}
```

```typescript
// web/src/composables/useKanboChannel.ts
import { ref } from 'vue'

const currentKanboChannelId = ref<string | null>(null)

export function useKanboChannel() {
  const setCurrentKanboChannel = (channelId: string | null) => {
    currentKanboChannelId.value = channelId
  }

  return {
    currentKanboChannelId,
    setCurrentKanboChannel,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run tests/unit/useKanboCollections.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/composables/useKanboChannel.ts web/src/composables/useKanboCollections.ts web/tests/unit/useKanboCollections.spec.ts
git commit -m "feat(kanbo): add channel and collection selection composables"
```

### Task 6: Build Kanbo create page skeleton with empty states and disabled publish state

**Files:**
- Create: `web/src/views/kanbo/KanboCreateView.vue`
- Create: `web/src/components/kanbo/KanboEmptyState.vue`
- Test: `web/tests/unit/KanboCreateView.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// web/tests/unit/KanboCreateView.spec.ts
import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import KanboCreateView from '@/views/kanbo/KanboCreateView.vue'

vi.mock('@/composables/useKanboCollections', () => ({
  useKanboCollections: () => ({
    selectedCollectionId: { value: null },
    selectCollection: vi.fn(),
  }),
}))

describe('KanboCreateView', () => {
  it('disables publish button before a collection is selected', () => {
    const wrapper = mount(KanboCreateView, {
      global: {
        stubs: ['KanboCollectionRail', 'KanboMixedFeedSection', 'KanboVideoCardSection', 'KanboCollectionWorkspace'],
      },
    })
    const button = wrapper.get('[data-testid="kanbo-publish-button"]')
    expect(button.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('请先选择一个合集')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run tests/unit/KanboCreateView.spec.ts`
Expected: FAIL because the view file does not exist.

- [ ] **Step 3: Write minimal implementation**

```vue
<!-- web/src/components/kanbo/KanboEmptyState.vue -->
<template>
  <div class="a-empty kanbo-empty-state">
    <h3>{{ title }}</h3>
    <p>{{ description }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  description: string
}>()
</script>
```

```vue
<!-- web/src/views/kanbo/KanboCreateView.vue -->
<template>
  <div class="a-page kanbo-create-view">
    <APageHeader title="创作" sub="当前频道的内容工作台，先选择合集再开始发布或整理内容。" accent>
      <template #action>
        <ABtn data-testid="kanbo-publish-button" :disabled="!selectedCollectionId" variant="primary">
          发布内容
        </ABtn>
      </template>
    </APageHeader>

    <p v-if="!selectedCollectionId" class="a-muted">请先选择一个合集</p>

    <KanboCollectionRail />

    <section v-if="selectedCollectionId">
      <KanboCollectionWorkspace />
    </section>
    <template v-else>
      <KanboMixedFeedSection />
      <KanboVideoCardSection />
    </template>
  </div>
</template>

<script setup lang="ts">
import ABtn from '@/components/ui/ABtn.vue'
import APageHeader from '@/components/ui/APageHeader.vue'
import KanboCollectionRail from '@/components/kanbo/KanboCollectionRail.vue'
import KanboMixedFeedSection from '@/components/kanbo/KanboMixedFeedSection.vue'
import KanboVideoCardSection from '@/components/kanbo/KanboVideoCardSection.vue'
import KanboCollectionWorkspace from '@/components/kanbo/KanboCollectionWorkspace.vue'
import { useKanboCollections } from '@/composables/useKanboCollections'

const { selectedCollectionId } = useKanboCollections()
</script>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run tests/unit/KanboCreateView.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/views/kanbo/KanboCreateView.vue web/src/components/kanbo/KanboEmptyState.vue web/tests/unit/KanboCreateView.spec.ts
git commit -m "feat(kanbo): add create workspace shell with disabled publish state"
```

### Task 7: Implement collection rail and channel-overview sections

**Files:**
- Create: `web/src/components/kanbo/KanboCollectionRail.vue`
- Create: `web/src/components/kanbo/KanboMixedFeedSection.vue`
- Create: `web/src/components/kanbo/KanboVideoCardSection.vue`
- Create: `web/src/composables/useKanboOverview.ts`
- Test: `web/tests/unit/KanboOverviewSections.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// web/tests/unit/KanboOverviewSections.spec.ts
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import KanboMixedFeedSection from '@/components/kanbo/KanboMixedFeedSection.vue'

describe('KanboMixedFeedSection', () => {
  it('shows exactly five items by default and a expand button', () => {
    const wrapper = mount(KanboMixedFeedSection, {
      props: {
        items: Array.from({ length: 8 }).map((_, index) => ({
          id: `item-${index}`,
          title: `Item ${index}`,
          type: index % 2 === 0 ? 'article' : 'podcast',
          updated_at: '2026-06-03T00:00:00Z',
        })),
      },
    })
    expect(wrapper.findAll('[data-testid="kanbo-mixed-item"]')).toHaveLength(5)
    expect(wrapper.get('[data-testid="kanbo-expand-mixed"]').text()).toContain('展开')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run tests/unit/KanboOverviewSections.spec.ts`
Expected: FAIL because the component does not exist.

- [ ] **Step 3: Write minimal implementation**

```typescript
// web/src/composables/useKanboOverview.ts
import { ref } from 'vue'

export type KanboMixedItem = {
  id: string
  type: 'article' | 'podcast'
  title: string
  updated_at: string
}

export type KanboVideoItem = {
  id: string
  title: string
  cover_url?: string
  updated_at: string
}

export function useKanboOverview() {
  const mixedItems = ref<KanboMixedItem[]>([])
  const videoItems = ref<KanboVideoItem[]>([])
  const expandedMixed = ref(false)

  const visibleMixedItems = () => expandedMixed.value ? mixedItems.value : mixedItems.value.slice(0, 5)

  return {
    mixedItems,
    videoItems,
    expandedMixed,
    visibleMixedItems,
  }
}
```

```vue
<!-- web/src/components/kanbo/KanboMixedFeedSection.vue -->
<template>
  <section class="kanbo-section">
    <div class="kanbo-section-head">
      <h2>文章与播客</h2>
      <ABtn v-if="items.length > 5" data-testid="kanbo-expand-mixed" variant="ghost" size="sm" @click="expanded = !expanded">
        {{ expanded ? '收起' : '展开更多' }}
      </ABtn>
    </div>

    <div v-for="item in visibleItems" :key="item.id" data-testid="kanbo-mixed-item" class="a-card-sm kanbo-mixed-item">
      <div class="a-label a-muted">{{ item.type === 'article' ? '文章' : '播客' }}</div>
      <h3>{{ item.title }}</h3>
      <p class="a-muted">{{ item.updated_at }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import ABtn from '@/components/ui/ABtn.vue'
import type { KanboMixedItem } from '@/composables/useKanboOverview'

const props = defineProps<{
  items?: KanboMixedItem[]
}>()

const expanded = ref(false)
const visibleItems = computed(() => expanded.value ? (props.items || []) : (props.items || []).slice(0, 5))
</script>
```

```vue
<!-- web/src/components/kanbo/KanboVideoCardSection.vue -->
<template>
  <section class="kanbo-section">
    <div class="kanbo-section-head">
      <h2>视频</h2>
    </div>
    <div class="kanbo-video-grid">
      <article v-for="video in items" :key="video.id" class="a-card-sm kanbo-video-card">
        <div class="kanbo-video-cover">{{ video.cover_url ? '封面' : 'VIDEO' }}</div>
        <h3>{{ video.title }}</h3>
        <p class="a-muted">{{ video.updated_at }}</p>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { KanboVideoItem } from '@/composables/useKanboOverview'

defineProps<{
  items?: KanboVideoItem[]
}>()
</script>
```

```vue
<!-- web/src/components/kanbo/KanboCollectionRail.vue -->
<template>
  <section class="kanbo-section">
    <div class="kanbo-section-head">
      <h2>合集</h2>
    </div>
    <div class="kanbo-collection-grid">
      <button
        v-for="collection in collections"
        :key="collection.id"
        class="a-card-sm kanbo-collection-card"
        @click="selectCollection(collection.id)"
      >
        <div class="a-label a-muted">{{ collection.type }}</div>
        <h3>{{ collection.name }}</h3>
        <p class="a-muted">{{ collection.count }} 条内容</p>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useKanboCollections } from '@/composables/useKanboCollections'

const { selectCollection } = useKanboCollections()
const collections = [
  { id: 'col-1', name: '长文合集', type: '文章', count: 8 },
  { id: 'col-2', name: '访谈播客', type: '播客', count: 5 },
  { id: 'col-3', name: '视频栏目', type: '视频', count: 3 },
]
</script>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run tests/unit/KanboOverviewSections.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/composables/useKanboOverview.ts web/src/components/kanbo/KanboCollectionRail.vue web/src/components/kanbo/KanboMixedFeedSection.vue web/src/components/kanbo/KanboVideoCardSection.vue web/tests/unit/KanboOverviewSections.spec.ts
git commit -m "feat(kanbo): add channel overview sections for collections, mixed feed, and videos"
```

### Task 8: Add collection workspace switching by collection type

**Files:**
- Create: `web/src/components/kanbo/KanboCollectionWorkspace.vue`
- Test: `web/tests/unit/KanboCollectionWorkspace.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// web/tests/unit/KanboCollectionWorkspace.spec.ts
import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import KanboCollectionWorkspace from '@/components/kanbo/KanboCollectionWorkspace.vue'

vi.mock('@/composables/useKanboCollections', () => ({
  useKanboCollections: () => ({
    selectedCollectionId: { value: 'col-2' },
    selectedCollection: { value: { id: 'col-2', type: 'podcast', name: '访谈播客' } },
  }),
}))

describe('KanboCollectionWorkspace', () => {
  it('renders podcast workspace when selected collection type is podcast', () => {
    const wrapper = mount(KanboCollectionWorkspace)
    expect(wrapper.text()).toContain('播客工作区')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run tests/unit/KanboCollectionWorkspace.spec.ts`
Expected: FAIL because the component does not exist.

- [ ] **Step 3: Write minimal implementation**

First extend `useKanboCollections.ts` with a selected collection ref:

```typescript
const selectedCollection = ref<{ id: string; type: 'article' | 'podcast' | 'video'; name: string } | null>(null)

const selectCollection = (id: string, type: 'article' | 'podcast' | 'video' = 'article', name = '') => {
  selectedCollectionId.value = id
  selectedCollection.value = { id, type, name }
}

const resetForChannel = (channelId: string | null) => {
  selectedChannelId.value = channelId
  selectedCollectionId.value = null
  selectedCollection.value = null
}
```

Then add the component:

```vue
<!-- web/src/components/kanbo/KanboCollectionWorkspace.vue -->
<template>
  <section class="kanbo-workspace a-card-sm">
    <div v-if="selectedCollection?.type === 'article'">
      <h2>文章工作区</h2>
      <p class="a-muted">当前合集：{{ selectedCollection.name }}</p>
    </div>
    <div v-else-if="selectedCollection?.type === 'podcast'">
      <h2>播客工作区</h2>
      <p class="a-muted">当前合集：{{ selectedCollection.name }}</p>
    </div>
    <div v-else-if="selectedCollection?.type === 'video'">
      <h2>视频工作区</h2>
      <p class="a-muted">当前合集：{{ selectedCollection.name }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useKanboCollections } from '@/composables/useKanboCollections'

const { selectedCollection } = useKanboCollections()
</script>
```

Update `KanboCollectionRail.vue` to pass type/name when selecting:

```vue
@click="selectCollection(collection.id, collection.typeKey, collection.name)"
```

with seed data shaped like:

```ts
const collections = [
  { id: 'col-1', name: '长文合集', type: '文章', typeKey: 'article', count: 8 },
  { id: 'col-2', name: '访谈播客', type: '播客', typeKey: 'podcast', count: 5 },
  { id: 'col-3', name: '视频栏目', type: '视频', typeKey: 'video', count: 3 },
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run tests/unit/KanboCollectionWorkspace.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/composables/useKanboCollections.ts web/src/components/kanbo/KanboCollectionRail.vue web/src/components/kanbo/KanboCollectionWorkspace.vue web/tests/unit/KanboCollectionWorkspace.spec.ts
git commit -m "feat(kanbo): switch create workspace by selected collection type"
```

### Task 9: Create article / podcast / video view shells under kanbo

**Files:**
- Create: `web/src/views/kanbo/KanboArticlesView.vue`
- Create: `web/src/views/kanbo/KanboPodcastsView.vue`
- Create: `web/src/views/kanbo/KanboVideosView.vue`
- Test: `web/tests/unit/KanboContentViews.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// web/tests/unit/KanboContentViews.spec.ts
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import KanboArticlesView from '@/views/kanbo/KanboArticlesView.vue'
import KanboPodcastsView from '@/views/kanbo/KanboPodcastsView.vue'
import KanboVideosView from '@/views/kanbo/KanboVideosView.vue'

describe('Kanbo content view shells', () => {
  it('renders functional page titles', () => {
    expect(mount(KanboArticlesView).text()).toContain('文章')
    expect(mount(KanboPodcastsView).text()).toContain('播客')
    expect(mount(KanboVideosView).text()).toContain('视频')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run tests/unit/KanboContentViews.spec.ts`
Expected: FAIL because the view files do not exist.

- [ ] **Step 3: Write minimal implementation**

```vue
<!-- web/src/views/kanbo/KanboArticlesView.vue -->
<template>
  <div class="a-page">
    <APageHeader title="文章" sub="探索本网站发布的全部文章。" accent />
    <div class="a-card-sm">文章列表待接入当前 blog 数据源。</div>
  </div>
</template>

<script setup lang="ts">
import APageHeader from '@/components/ui/APageHeader.vue'
</script>
```

```vue
<!-- web/src/views/kanbo/KanboPodcastsView.vue -->
<template>
  <div class="a-page">
    <APageHeader title="播客" sub="探索本网站发布的全部播客单集。" accent />
    <div class="a-card-sm">播客列表待接入当前 podcast 数据源。</div>
  </div>
</template>

<script setup lang="ts">
import APageHeader from '@/components/ui/APageHeader.vue'
</script>
```

```vue
<!-- web/src/views/kanbo/KanboVideosView.vue -->
<template>
  <div class="a-page">
    <APageHeader title="视频" sub="探索本网站发布的全部视频。" accent />
    <div class="a-card-sm">视频列表待接入当前 video 数据源。</div>
  </div>
</template>

<script setup lang="ts">
import APageHeader from '@/components/ui/APageHeader.vue'
</script>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run tests/unit/KanboContentViews.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/views/kanbo/KanboArticlesView.vue web/src/views/kanbo/KanboPodcastsView.vue web/src/views/kanbo/KanboVideosView.vue web/tests/unit/KanboContentViews.spec.ts
git commit -m "feat(kanbo): add functional content view shells"
```

### Task 10: Create global subscriptions and bookmarks view shells inside kanbo

**Files:**
- Create: `web/src/views/kanbo/KanboSubscriptionsView.vue`
- Create: `web/src/views/kanbo/KanboBookmarksView.vue`
- Test: `web/tests/unit/KanboGlobalViews.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// web/tests/unit/KanboGlobalViews.spec.ts
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import KanboSubscriptionsView from '@/views/kanbo/KanboSubscriptionsView.vue'
import KanboBookmarksView from '@/views/kanbo/KanboBookmarksView.vue'

describe('Kanbo global views', () => {
  it('marks subscriptions and bookmarks as global pages', () => {
    expect(mount(KanboSubscriptionsView).text()).toContain('不限定当前频道')
    expect(mount(KanboBookmarksView).text()).toContain('不限定当前频道')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run tests/unit/KanboGlobalViews.spec.ts`
Expected: FAIL because the view files do not exist.

- [ ] **Step 3: Write minimal implementation**

```vue
<!-- web/src/views/kanbo/KanboSubscriptionsView.vue -->
<template>
  <div class="a-page">
    <APageHeader title="订阅" sub="查看你在全站范围内关注的内容更新，不限定当前频道。" accent />
    <div class="a-card-sm">这里复用现有订阅内容流或在下一任务中接入。</div>
  </div>
</template>

<script setup lang="ts">
import APageHeader from '@/components/ui/APageHeader.vue'
</script>
```

```vue
<!-- web/src/views/kanbo/KanboBookmarksView.vue -->
<template>
  <div class="a-page">
    <APageHeader title="收藏" sub="查看你在全站范围内保存的内容，不限定当前频道。" accent />
    <div class="a-card-sm">这里复用现有文章收藏、视频收藏等统一入口。</div>
  </div>
</template>

<script setup lang="ts">
import APageHeader from '@/components/ui/APageHeader.vue'
</script>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run tests/unit/KanboGlobalViews.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/views/kanbo/KanboSubscriptionsView.vue web/src/views/kanbo/KanboBookmarksView.vue web/tests/unit/KanboGlobalViews.spec.ts
git commit -m "feat(kanbo): add global subscriptions and bookmarks views"
```

### Task 11: Wire kanbo create page to real current-channel collections and clear selection on channel change

**Files:**
- Modify: `web/src/components/AppTopbarAuthControls.vue`
- Modify: `web/src/components/kanbo/KanboCollectionRail.vue`
- Modify: `web/src/views/kanbo/KanboCreateView.vue`
- Modify: `web/src/composables/useKanboChannel.ts`
- Modify: `web/src/composables/useKanboCollections.ts`
- Test: `web/tests/unit/useKanboChannelReset.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// web/tests/unit/useKanboChannelReset.spec.ts
import { describe, it, expect } from 'vitest'
import { useKanboChannel } from '@/composables/useKanboChannel'
import { useKanboCollections } from '@/composables/useKanboCollections'

describe('kanbo channel reset behavior', () => {
  it('clears selected collection after switching current kanbo channel', () => {
    const { setCurrentKanboChannel } = useKanboChannel()
    const { selectCollection, selectedCollectionId } = useKanboCollections()

    selectCollection('collection-1', 'article', '长文合集')
    expect(selectedCollectionId.value).toBe('collection-1')

    setCurrentKanboChannel('channel-2')
    expect(selectedCollectionId.value).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run tests/unit/useKanboChannelReset.spec.ts`
Expected: FAIL because the channel setter does not reset collection selection.

- [ ] **Step 3: Write minimal implementation**

Update `web/src/composables/useKanboChannel.ts` to coordinate with `useKanboCollections`.

```typescript
import { ref } from 'vue'
import { useKanboCollections } from '@/composables/useKanboCollections'

const currentKanboChannelId = ref<string | null>(null)

export function useKanboChannel() {
  const { resetForChannel } = useKanboCollections()

  const setCurrentKanboChannel = (channelId: string | null) => {
    currentKanboChannelId.value = channelId
    resetForChannel(channelId)
  }

  return {
    currentKanboChannelId,
    setCurrentKanboChannel,
  }
}
```

In `AppTopbarAuthControls.vue`, keep the channel switcher in the topbar when in `kanbo` context, but make the channel source explicit: it must load only the current logged-in user's manageable channels, not all site channels. The first iteration can keep the plain `<select>` UI.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run tests/unit/useKanboChannelReset.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/composables/useKanboChannel.ts web/src/composables/useKanboCollections.ts web/src/components/AppTopbarAuthControls.vue web/tests/unit/useKanboChannelReset.spec.ts
git commit -m "feat(kanbo): clear selected collection when current channel changes"
```

### Task 12: Connect kanbo shells to existing blog / podcast / video APIs without changing backend route naming

**Files:**
- Modify: `web/src/composables/useApi.ts`
- Modify: `web/src/composables/useKanboOverview.ts`
- Modify: `web/src/views/kanbo/KanboArticlesView.vue`
- Modify: `web/src/views/kanbo/KanboPodcastsView.vue`
- Modify: `web/src/views/kanbo/KanboVideosView.vue`
- Modify: `web/src/views/kanbo/KanboCreateView.vue`
- Test: `web/tests/unit/useKanboOverview.api.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// web/tests/unit/useKanboOverview.api.spec.ts
import { describe, it, expect } from 'vitest'
import { useApi } from '@/composables/useApi'

describe('useApi kanbo integration', () => {
  it('exposes existing typed backend endpoints needed by kanbo overview', () => {
    const api = useApi()
    expect(api.blog.posts).toBeTruthy()
    expect(api.blog.channels).toBeTruthy()
    expect(api.videos.list).toBeTruthy()
    expect(api.podcast).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run tests/unit/useKanboOverview.api.spec.ts`
Expected: FAIL if `api.podcast` or any required typed endpoint is missing.

- [ ] **Step 3: Write minimal implementation**

If `useApi.ts` lacks a typed podcast entry, add the smallest necessary shape without renaming backend paths.

```typescript
podcast: {
  list: (channelId: string) => `${API_BASE}/podcast/channel/${channelId}`,
  episode: (id: string) => `${API_BASE}/podcast/episode/${id}`,
  editor: (id?: string) => id ? `${API_BASE}/podcast/editor/${id}` : `${API_BASE}/podcast/editor`,
},
```

Then update `useKanboOverview.ts` to fetch from the existing per-type endpoints instead of inventing `/kanbo/*` APIs. For the first pass, keep fetching parallel and normalize into the shared view model. Do not assume unsupported query parameters are effective; either add backend support or remove the misleading parameter.

```typescript
const loadOverview = async (channelId: string, api: ReturnType<typeof useApi>) => {
  const [articleRes, podcastRes, videoRes] = await Promise.all([
    fetch(`${api.blog.posts}?channel_id=${channelId}&limit=5`),
    fetch(`${api.podcast.episodes}?channel_id=${channelId}&limit=5`),
    fetch(`${api.videos.list}?channel_id=${channelId}&limit=6`),
  ])
  // normalize to mixedItems + videoItems
}
```

Update `KanboArticlesView.vue`, `KanboPodcastsView.vue`, and `KanboVideosView.vue` to load site-wide explore data via existing endpoints. Do not pass `channel_id` from the current kanbo channel into these type pages; current-channel filtering belongs to the 创作 workbench only. Keep implementation minimal and typed.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run tests/unit/useKanboOverview.api.spec.ts`
Expected: PASS

- [ ] **Step 5: Run focused verification**

Run: `cd web && bun run type-check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add web/src/composables/useApi.ts web/src/composables/useKanboOverview.ts web/src/views/kanbo/KanboArticlesView.vue web/src/views/kanbo/KanboPodcastsView.vue web/src/views/kanbo/KanboVideosView.vue web/src/views/kanbo/KanboCreateView.vue web/tests/unit/useKanboOverview.api.spec.ts
git commit -m "feat(kanbo): compose unified frontend views from existing typed backend routes"
```

### Task 13: Retarget onboarding and functional titles to the kanbo terminology

**Files:**
- Modify: `web/src/components/onboarding/FirstLoginOnboarding.vue`
- Modify: `web/src/views/feed/FeedView.vue`
- Modify: `web/src/views/forum/ForumHomeView.vue`
- Modify: `web/src/views/blog/BlogHomeView.vue`
- Modify: `web/src/views/video/VideoHomeView.vue`
- Modify: `web/src/views/podcast/PodcastHomeView.vue`

- [ ] **Step 1: Write the failing test**

```typescript
// web/tests/unit/FirstLoginOnboarding.kanbo.spec.ts
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import FirstLoginOnboarding from '@/components/onboarding/FirstLoginOnboarding.vue'

describe('FirstLoginOnboarding kanbo terminology', () => {
  it('uses 刊播 instead of Studio/blog/video/podcast wording', () => {
    const wrapper = mount(FirstLoginOnboarding)
    expect(wrapper.text()).toContain('刊播')
    expect(wrapper.text()).not.toContain('Studio')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run tests/unit/FirstLoginOnboarding.kanbo.spec.ts`
Expected: FAIL because the current onboarding still references Studio and old module phrasing.

- [ ] **Step 3: Write minimal implementation**

Update the onboarding summary and module bullets to functional names.

```ts
{ title: '刊播', description: '写文章、发播客、传视频，并在频道内统一管理内容。' }
```

Update remaining page titles or `APageHeader` uses so user-facing labels are functional, not room-based. For example:

```vue
<APageHeader title="文章" :sub="moduleRooms.blog.homepageSub" accent />
```

for the old blog home view if it remains visible as a compatibility page.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run tests/unit/FirstLoginOnboarding.kanbo.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/components/onboarding/FirstLoginOnboarding.vue web/src/views/feed/FeedView.vue web/src/views/forum/ForumHomeView.vue web/src/views/blog/BlogHomeView.vue web/src/views/video/VideoHomeView.vue web/src/views/podcast/PodcastHomeView.vue web/tests/unit/FirstLoginOnboarding.kanbo.spec.ts
git commit -m "refactor(copy): switch onboarding and page titles to kanbo functional naming"
```

### Task 14: Verify routing, topbar order, and core kanbo workflows end-to-end

**Files:**
- Modify: `docs/superpowers/plans/2026-06-03-kanbo-module-unification.md` (mark completed during execution only)
- Test: existing app via browser/manual verification

- [ ] **Step 1: Run unit test suite for the new kanbo artifacts**

Run: `cd web && npx vitest run tests/unit/moduleRooms.kanbo.spec.ts tests/unit/kanbo-routing.spec.ts tests/unit/AppTopbar.kanbo.spec.ts tests/unit/KanboLayout.spec.ts tests/unit/useKanboCollections.spec.ts tests/unit/KanboCreateView.spec.ts tests/unit/KanboOverviewSections.spec.ts tests/unit/KanboCollectionWorkspace.spec.ts tests/unit/KanboContentViews.spec.ts tests/unit/KanboGlobalViews.spec.ts tests/unit/useKanboChannelReset.spec.ts tests/unit/useKanboOverview.api.spec.ts tests/unit/FirstLoginOnboarding.kanbo.spec.ts`
Expected: PASS

- [ ] **Step 2: Run full frontend type-check**

Run: `cd web && bun run type-check`
Expected: PASS

- [ ] **Step 3: Run backend compile verification**

Run: `cd server && go build ./...`
Expected: PASS (no backend route rename required)

- [ ] **Step 4: Run manual browser verification**

Run: `cd web && bun run dev`
Expected: local dev server starts successfully.

Verify manually:
1. Topbar order starts with 订阅 → 刊播 → 音乐 → 论坛.
2. Clicking 刊播 lands on `/create` and shows 创作页.
3. 创作页默认显示合集层、文章+播客区、视频区.
4. 未选合集时发布按钮禁用并提示“请先选择一个合集”.
5. 选中文章合集后进入文章工作区.
6. 切换频道后清空已选合集并回到总览态.
7. 订阅 / 收藏页面标题明确“不限定当前频道”.

- [ ] **Step 5: Commit verification-safe final integration**

```bash
git add web/src/config/moduleRooms.ts web/src/components/AppTopbar.vue web/src/router/routes/modules.ts web/src/router/siteUrls.ts web/src/router/siteContext.ts web/src/composables/useSubdomainNav.ts web/src/views/kanbo web/src/components/kanbo web/src/composables/useKanboChannel.ts web/src/composables/useKanboCollections.ts web/src/composables/useKanboOverview.ts web/src/components/onboarding/FirstLoginOnboarding.vue web/tests/unit/*.kanbo.spec.ts web/tests/unit/Kanbo*.spec.ts web/tests/unit/useKanbo*.spec.ts
git commit -m "feat(kanbo): unify blog podcast and video under kanbo workspace"
```

---

## Risks and sequencing notes

1. **Module key churn risk:** adding `kanbo` to `ModuleRoomKey` will surface compile errors in routing, site access, and URL helpers. Do Task 1 and Task 2 before any view work.
2. **Context reset risk:** selected collection must clear on channel switch. Do not implement real data fetching before Task 11 proves reset behavior.
3. **Over-abstracting risk:** keep backend split by content type. If you feel tempted to add `/kanbo/*` APIs early, stop and first check whether the front-end can normalize current routes.
4. **UI polish risk:** first pass should prioritize stable shell, naming, routing, and workflow gates. Defer styling refinements until after type-check passes.
5. **Compatibility risk:** existing direct `/post/:id`, `/watch/:id`, `/podcast/episode/:id` paths should continue working. This plan intentionally leaves those detail routes untouched.

## Spec coverage checklist

- Topbar and page titles use functional names: covered by Tasks 1, 3, and 13.
- Topbar order `订阅 → 刊播 → 音乐 → 论坛`: covered by Task 1 and Task 14.
- 刊播 defaults to 创作 page: covered by Task 2, Task 4, and Task 14.
- Channel as context, collection as typed container: covered by Tasks 5, 6, 8, and 11.
- 创作页总览态（合集 / 文章+播客 / 视频）: covered by Tasks 6 and 7.
- Selected collection drives workspace type and publish availability: covered by Tasks 6 and 8.
- 文章 / 播客 / 视频类型页作为全站探索入口，不受当前频道限制: covered by Tasks 9 and 12.
- 订阅 / 收藏 are global pages inside 刊播: covered by Task 10 and Task 14.
- Backend routes stay split by type: covered by Task 12 and recorded explicitly in Task 14 verification.

## Placeholder scan

- No `TODO`, `TBD`, or “similar to previous task” placeholders remain.
- Every code-writing task includes exact file paths and concrete code snippets.
- Every verification step includes a concrete command and expected outcome.

## Type consistency check

- Unified module key is consistently `kanbo`.
- Selected collection type is consistently `'article' | 'podcast' | 'video'`.
- Global pages are consistently `subscriptions` and `bookmarks`.
- Main workspace route is consistently `/create`.
