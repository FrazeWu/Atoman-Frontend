# Explore Sort Tabs Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify explore-page `热门 / 随机` sort controls in feed and music to the existing straight-corner `PTab` style without changing sort behavior.

**Architecture:** Reuse the shared `PTab` component directly in `FeedRecommendedView.vue` and `music/HomeView.vue`, keeping all existing query/state/fetch logic intact. Treat this as a visual-control primitive swap only: no new wrapper component, no route/query semantic changes, and no changes to unrelated action buttons such as `返回订阅`.

**Tech Stack:** Vue 3, TypeScript, Vue Router, Pinia, Vitest

---

## File Structure

### Feed explore

- Modify: `src/views/feed/FeedRecommendedView.vue`
  - Replace the `热门 / 随机` sort controls from `PPress` to `PTab` while keeping `返回订阅` as `PPress`.
- Modify: `tests/unit/views/feed/FeedRecommendedView.spec.ts`
  - Ensure the sort controls still render and still change feed explore sort behavior correctly after the control swap.

### Music explore

- Modify: `src/views/music/HomeView.vue`
  - Replace the custom local `mode-tab` buttons with `PTab` and remove now-unused tab-specific CSS.
- Modify: `tests/unit/views/music/MusicHomeView.spec.ts`
  - Ensure the view still defaults to `热门` and still reloads in `随机` mode when clicked.

## Task 1: Convert Feed Explore Sort Controls To `PTab`

**Files:**
- Modify: `src/views/feed/FeedRecommendedView.vue`
- Test: `tests/unit/views/feed/FeedRecommendedView.spec.ts`

- [ ] **Step 1: Write the failing feed sort-tab assertion**

Update `tests/unit/views/feed/FeedRecommendedView.spec.ts` by adding a focused assertion to the existing feed explore coverage:

```ts
it('renders hot and random sort choices as tabs while keeping the return action separate', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    if (url.includes('/feed/explore')) {
      return new Response(JSON.stringify({
        data: [],
        meta: { page: 1, page_size: 20, total: 0, has_more: false },
      }), { status: 200 })
    }
    if (url.includes('/feed/stars') || url.includes('/feed/reading-list')) {
      return new Response(JSON.stringify({ items: [] }), { status: 200 })
    }
    return new Response(JSON.stringify({ error: 'unexpected request' }), { status: 404 })
  })

  const wrapper = mount(FeedRecommendedView, {
    global: {
      stubs: {
        PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
        PPress: {
          props: ['label'],
          template: '<button data-test="press-stub">{{ label }}</button>',
        },
        PTab: {
          props: ['label', 'active'],
          template: '<button data-test="sort-tab-stub" :data-active="String(active)">{{ label }}</button>',
        },
        PShortcutHints: true,
        FeedArticleSheet: true,
        FeedSourceArticlesSheet: true,
      },
    },
  })

  await flushPromises()

  expect(wrapper.findAll('[data-test="sort-tab-stub"]').map((node) => node.text())).toEqual(['随机', '热门'])
  expect(wrapper.findAll('[data-test="press-stub"]').map((node) => node.text())).toContain('返回订阅')
})
```

- [ ] **Step 2: Run the feed view test to verify it fails**

Run:

```bash
cd /root/Atoman/Atoman-Frontend && bun vitest run tests/unit/views/feed/FeedRecommendedView.spec.ts
```

Expected: FAIL because `FeedRecommendedView.vue` still renders the two sort controls with `PPress`, so the new `sort-tab-stub` assertion does not match.

- [ ] **Step 3: Replace feed sort controls with `PTab`**

Update `src/views/feed/FeedRecommendedView.vue` so the page-header action becomes:

```vue
<template #action>
  <div class="feed-header-actions">
    <div class="feed-sort-tabs" aria-label="探索排序">
      <PTab
        label="随机"
        :active="sort === 'random'"
        @click="changeSort('random')"
      />
      <PTab
        label="热门"
        :active="sort === 'popular'"
        @click="changeSort('popular')"
      />
    </div>
    <PPress to="/" variant="secondary" label="返回订阅" />
  </div>
</template>
```

and update the imports:

```ts
import PTab from '@/components/ui/PTab.vue'
import PPress from '@/components/ui/PPress.vue'
```

Add minimal scoped layout CSS:

```css
.feed-header-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.feed-sort-tabs {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}
```

- [ ] **Step 4: Run the feed view test to verify it passes**

Run:

```bash
cd /root/Atoman/Atoman-Frontend && bun vitest run tests/unit/views/feed/FeedRecommendedView.spec.ts
```

Expected: PASS, with the new tab assertion and the pre-existing feed explore behavior still green.

- [ ] **Step 5: Commit**

```bash
git add src/views/feed/FeedRecommendedView.vue tests/unit/views/feed/FeedRecommendedView.spec.ts
git commit -m "refactor: use tabs for feed explore sort controls"
```

## Task 2: Convert Music Explore Sort Controls To `PTab`

**Files:**
- Modify: `src/views/music/HomeView.vue`
- Test: `tests/unit/views/music/MusicHomeView.spec.ts`

- [ ] **Step 1: Write the failing music sort-tab assertion**

Update `tests/unit/views/music/MusicHomeView.spec.ts` by adding a focused UI assertion:

```ts
it('renders hot and random discovery mode choices as tabs', async () => {
  const pinia = createTestingPinia({ createSpy: vi.fn })
  const wrapper = mount(HomeView, {
    global: {
      plugins: [pinia],
      stubs: {
        RouterLink: true,
        ArtistDrawer: true,
        AlbumDrawer: true,
        NestedActionDrawer: true,
        MusicCreationFlowDrawer: { template: '<div data-testid="music-creation-flow-drawer-stub" />' },
        PTab: {
          props: ['label', 'active'],
          template: '<button data-testid="music-sort-tab" :data-active="String(active)">{{ label }}</button>',
        },
      },
    },
  })

  await flushPromises()

  expect(wrapper.findAll('[data-testid="music-sort-tab"]').map((node) => node.text())).toEqual(['热门', '随机'])
})
```

- [ ] **Step 2: Run the music home test to verify it fails**

Run:

```bash
cd /root/Atoman/Atoman-Frontend && bun vitest run tests/unit/views/music/MusicHomeView.spec.ts
```

Expected: FAIL because `HomeView.vue` still renders local `button.mode-tab` controls, so the `music-sort-tab` assertion does not match.

- [ ] **Step 3: Replace music sort controls with `PTab`**

Update `src/views/music/HomeView.vue` to import `PTab`:

```ts
import PTab from '@/components/ui/PTab.vue'
```

Replace the current mode-toggle markup with:

```vue
<div class="mode-tabs" aria-label="专辑浏览模式">
  <PTab
    label="热门"
    :active="mode === 'hot'"
    data-testid="mode-hot"
    @click="changeMode('hot')"
  />
  <PTab
    label="随机"
    :active="mode === 'random'"
    data-testid="mode-random"
    @click="changeMode('random')"
  />
</div>
```

Then remove the old local `.mode-tab`-specific CSS block, keeping only the container layout if still needed:

```css
.mode-tabs {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}
```

- [ ] **Step 4: Run the music home test to verify it passes**

Run:

```bash
cd /root/Atoman/Atoman-Frontend && bun vitest run tests/unit/views/music/MusicHomeView.spec.ts
```

Expected: PASS, with the mode UI assertion and the existing sort-behavior assertions still green.

- [ ] **Step 5: Commit**

```bash
git add src/views/music/HomeView.vue tests/unit/views/music/MusicHomeView.spec.ts
git commit -m "refactor: use tabs for music explore sort controls"
```

## Task 3: Run Final Cross-Surface Verification

**Files:**
- Modify: none
- Test: `tests/unit/views/feed/FeedRecommendedView.spec.ts`
- Test: `tests/unit/views/music/MusicHomeView.spec.ts`

- [ ] **Step 1: Run the focused combined verification suite**

Run:

```bash
cd /root/Atoman/Atoman-Frontend && bun vitest run tests/unit/views/feed/FeedRecommendedView.spec.ts tests/unit/views/music/MusicHomeView.spec.ts
```

Expected: PASS, proving both explore surfaces now use the same tab primitive without behavior regressions.

- [ ] **Step 2: Run a broader spot-check on already-tabbed neighboring behavior**

Run:

```bash
cd /root/Atoman/Atoman-Frontend && bun vitest run tests/unit/views/feed/FeedView.spec.ts tests/unit/components/feed/ArticleExplorePanel.spec.ts
```

Expected: PASS, showing the sort-tab unification did not disturb nearby feed page behavior.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "style: unify explore sort tabs"
```
