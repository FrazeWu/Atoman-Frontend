# Feed Explore Channel Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh feed explore channel browsing with Feedly-inspired branded source cards and a stronger source drawer header while keeping the existing article-entry components after clicking a channel.

**Architecture:** Keep `src/views/feed/FeedRecommendedView.vue` as the page orchestrator, move strong-visual source presentation into a shared card/helper layer, and upgrade `FeedSourceArticlesSheet.vue` into a branded source header without replacing its existing article list interaction model. Prefer a frontend-only implementation using current `FeedExploreSource` and `FeedArticleSource` data, with deterministic avatar/color/url fallbacks instead of requiring backend changes.

**Tech Stack:** Vue 3, TypeScript, Vue Router, Pinia, Vitest

---

## File Structure

### Source identity and helpers

- Create: `src/utils/feedSourcePresentation.ts`
  - Own URL normalization, fallback avatar label generation, and deterministic source color derivation.

### Feed explore UI

- Create: `src/components/feed/FeedSourceIdentityCard.vue`
  - Render the strong-visual source card for channel explore mode.
- Modify: `src/components/feed/ChannelExplorePanel.vue`
  - Replace inline card markup with the shared identity card while preserving loading/error/pagination behavior.
- Modify: `src/components/feed/FeedSourceArticlesSheet.vue`
  - Redesign the drawer header into a branded hero while preserving existing article-row rendering and event behavior.
- Modify: `src/views/feed/FeedRecommendedView.vue`
  - Pass normalized source presentation data into the drawer and keep current mode/query/fetch logic intact.

### Types

- Modify: `src/types.ts`
  - Add optional visual fields on `FeedExploreSource` and `FeedArticleSource` only if needed by the new presentation layer.

### Tests

- Create: `tests/unit/utils/feedSourcePresentation.spec.ts`
  - Cover URL normalization, avatar label fallback, and deterministic color behavior.
- Create: `tests/unit/components/feed/FeedSourceIdentityCard.spec.ts`
  - Cover branded card rendering, URL display, and click emit behavior.
- Modify: `tests/unit/components/feed/FeedSourceArticlesSheet.spec.ts`
  - Cover branded header rendering while preserving subscribe/article-open behavior.
- Modify: `tests/unit/views/feed/FeedRecommendedView.spec.ts`
  - Verify explore channel mode still opens the drawer and reuses source article behavior.

## Task 1: Add Source Presentation Helpers

**Files:**
- Create: `src/utils/feedSourcePresentation.ts`
- Test: `tests/unit/utils/feedSourcePresentation.spec.ts`

- [ ] **Step 1: Write the failing helper tests**

Create `tests/unit/utils/feedSourcePresentation.spec.ts` with:

```ts
import { describe, expect, it } from 'vitest'

import {
  buildSourceAvatarLabel,
  buildSourceColor,
  normalizeSourceUrlForCard,
} from '@/utils/feedSourcePresentation'

describe('feedSourcePresentation', () => {
  it('normalizes a feed url for card display', () => {
    expect(normalizeSourceUrlForCard('https://dense-discovery.com/rss.xml')).toBe('dense-discovery.com/rss.xml')
    expect(normalizeSourceUrlForCard('https://www.example.com/feed')).toBe('example.com/feed')
  })

  it('falls back to title when url is missing', () => {
    expect(normalizeSourceUrlForCard(undefined, 'Dense Discovery')).toBe('Dense Discovery')
  })

  it('builds a stable avatar label from the title', () => {
    expect(buildSourceAvatarLabel('Dense Discovery')).toBe('D')
    expect(buildSourceAvatarLabel('  播客精选  ')).toBe('播')
  })

  it('builds a deterministic color from url-like input', () => {
    const first = buildSourceColor('https://dense-discovery.com/rss.xml')
    const second = buildSourceColor('https://dense-discovery.com/rss.xml')
    expect(first).toBe(second)
    expect(first).toMatch(/^hsl\\(/)
  })
})
```

- [ ] **Step 2: Run the helper tests to verify they fail**

Run:

```bash
bun test tests/unit/utils/feedSourcePresentation.spec.ts
```

Expected: FAIL with module-not-found errors for `@/utils/feedSourcePresentation`.

- [ ] **Step 3: Write the minimal helper implementation**

Create `src/utils/feedSourcePresentation.ts` with:

```ts
function stripProtocol(value: string) {
  return value.replace(/^https?:\/\//i, '').replace(/^www\./i, '')
}

export function normalizeSourceUrlForCard(url?: string, title?: string) {
  if (!url) return title || '未知来源'
  return stripProtocol(url).replace(/\/$/, '')
}

export function buildSourceAvatarLabel(title?: string) {
  const trimmed = (title || '').trim()
  if (!trimmed) return '?'
  return trimmed[0].toUpperCase()
}

export function buildSourceColor(seed?: string) {
  const input = seed || 'unknown-source'
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue} 58% 44%)`
}
```

- [ ] **Step 4: Run the helper tests to verify they pass**

Run:

```bash
bun test tests/unit/utils/feedSourcePresentation.spec.ts
```

Expected: PASS with 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/feedSourcePresentation.ts tests/unit/utils/feedSourcePresentation.spec.ts
git commit -m "feat: add feed source presentation helpers"
```

## Task 2: Extract the Branded Source Identity Card

**Files:**
- Create: `src/components/feed/FeedSourceIdentityCard.vue`
- Modify: `src/components/feed/ChannelExplorePanel.vue`
- Test: `tests/unit/components/feed/FeedSourceIdentityCard.spec.ts`

- [ ] **Step 1: Write the failing card component test**

Create `tests/unit/components/feed/FeedSourceIdentityCard.spec.ts` with:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import FeedSourceIdentityCard from '@/components/feed/FeedSourceIdentityCard.vue'

describe('FeedSourceIdentityCard', () => {
  it('renders a branded source card with avatar, title, url, and stats', async () => {
    const wrapper = mount(FeedSourceIdentityCard, {
      props: {
        title: 'Dense Discovery',
        displayUrl: 'dense-discovery.com/rss.xml',
        avatarLabel: 'D',
        color: 'hsl(170 58% 44%)',
        subscriptionCount: 128,
        recentItemCount: 27,
        lastPublishedAt: '2026-06-20T00:00:00Z',
      },
    })

    expect(wrapper.text()).toContain('Dense Discovery')
    expect(wrapper.text()).toContain('dense-discovery.com/rss.xml')
    expect(wrapper.text()).toContain('128')
    expect(wrapper.text()).toContain('27')
    await wrapper.trigger('click')
    expect(wrapper.emitted('select')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run the component test to verify it fails**

Run:

```bash
bun test tests/unit/components/feed/FeedSourceIdentityCard.spec.ts
```

Expected: FAIL because `FeedSourceIdentityCard.vue` does not exist yet.

- [ ] **Step 3: Write the branded card component**

Create `src/components/feed/FeedSourceIdentityCard.vue` with:

```vue
<template>
  <button type="button" class="source-card" data-test="channel-card" @click="$emit('select')">
    <div class="source-card-hero" :style="{ '--source-color': color }">
      <div class="source-card-subscribe">{{ subscriptionCount }} 订阅</div>
      <div class="source-card-avatar">{{ avatarLabel }}</div>
    </div>
    <div class="source-card-body">
      <h3>{{ title }}</h3>
      <p class="source-card-url">{{ displayUrl }}</p>
      <div class="source-card-meta">
        <span>{{ recentItemCount }} 篇近期内容</span>
        <span>{{ formatDate(lastPublishedAt) }}</span>
      </div>
    </div>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  displayUrl: string
  avatarLabel: string
  color: string
  subscriptionCount: number
  recentItemCount: number
  lastPublishedAt?: string
}>()

defineEmits<{
  (e: 'select'): void
}>()

function formatDate(date?: string) {
  if (!date) return '暂无更新'
  return new Date(date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}
</script>

<style scoped>
.source-card {
  width: 100%;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-bg);
  color: inherit;
  text-align: left;
  box-shadow: var(--a-shadow-paper-sm);
  overflow: hidden;
}

.source-card-hero {
  position: relative;
  min-height: 7.5rem;
  padding: 1rem;
  background: linear-gradient(135deg, var(--source-color), color-mix(in srgb, var(--source-color) 25%, white));
}

.source-card-subscribe {
  position: absolute;
  top: 1rem;
  right: 1rem;
  padding: 0.35rem 0.65rem;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.88);
  font-family: var(--a-font-meta);
  font-size: 0.68rem;
  font-weight: 800;
}

.source-card-avatar {
  position: absolute;
  left: 1rem;
  bottom: -1.35rem;
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  border: 3px solid var(--a-color-bg);
  border-radius: 1rem;
  background: var(--source-color);
  color: white;
  font-size: 1.15rem;
  font-weight: 900;
}

.source-card-body {
  display: grid;
  gap: 0.75rem;
  padding: 2rem 1rem 1rem;
}

.source-card-body h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 900;
}

.source-card-url {
  margin: 0;
  padding: 0.55rem 0.7rem;
  border: 1px dashed var(--a-color-line);
  background: var(--a-color-paper);
  color: var(--a-color-muted);
  font-size: 0.78rem;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.source-card-meta {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  color: var(--a-color-muted-soft);
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  font-weight: 800;
}
</style>
```

- [ ] **Step 4: Wire `ChannelExplorePanel.vue` to the new card**

Update `src/components/feed/ChannelExplorePanel.vue` so the `v-for` body becomes:

```vue
<FeedSourceIdentityCard
  v-for="source in items"
  :key="source.id"
  :title="source.title"
  :display-url="normalizeSourceUrlForCard(source.rssUrl, source.title)"
  :avatar-label="buildSourceAvatarLabel(source.title)"
  :color="buildSourceColor(source.rssUrl || source.id)"
  :subscription-count="source.subscriptionCount"
  :recent-item-count="source.recentItemCount"
  :last-published-at="source.lastPublishedAt"
  @select="emit('open-source', source)"
/>
```

and add:

```ts
import FeedSourceIdentityCard from '@/components/feed/FeedSourceIdentityCard.vue'
import {
  buildSourceAvatarLabel,
  buildSourceColor,
  normalizeSourceUrlForCard,
} from '@/utils/feedSourcePresentation'
```

- [ ] **Step 5: Run the card and channel panel tests**

Run:

```bash
bun test tests/unit/components/feed/FeedSourceIdentityCard.spec.ts tests/unit/views/feed/FeedRecommendedView.spec.ts
```

Expected: the new card test passes; existing feed view tests may still fail until the drawer header task lands.

- [ ] **Step 6: Commit**

```bash
git add src/components/feed/FeedSourceIdentityCard.vue src/components/feed/ChannelExplorePanel.vue tests/unit/components/feed/FeedSourceIdentityCard.spec.ts
git commit -m "feat: add branded feed source cards"
```

## Task 3: Upgrade the Source Drawer Header Without Replacing Article Rows

**Files:**
- Modify: `src/components/feed/FeedSourceArticlesSheet.vue`
- Modify: `tests/unit/components/feed/FeedSourceArticlesSheet.spec.ts`

- [ ] **Step 1: Write the failing drawer header assertions**

Extend `tests/unit/components/feed/FeedSourceArticlesSheet.spec.ts` with:

```ts
it('renders the branded source header with full url details', () => {
  const wrapper = mount(FeedSourceArticlesSheet, {
    props: {
      show: true,
      source: {
        type: 'external_rss',
        id: 'source-rss-1',
        title: 'Example RSS',
        rssUrl: 'https://example.com/feed.xml',
        subscribed: false,
      },
      items: [],
    },
    global: {
      stubs: {
        PSheet: { template: '<section><slot name="header" /><slot /></section>' },
        PEmpty: true,
        PPress: true,
      },
    },
  })

  expect(wrapper.text()).toContain('https://example.com/feed.xml')
  expect(wrapper.text()).toContain('Example RSS')
  expect(wrapper.find('[data-test="source-sheet-avatar"]').exists()).toBe(true)
})
```

- [ ] **Step 2: Run the drawer tests to verify they fail**

Run:

```bash
bun test tests/unit/components/feed/FeedSourceArticlesSheet.spec.ts
```

Expected: FAIL because the current header has no URL-first branded layout or avatar hook.

- [ ] **Step 3: Redesign the source drawer header**

Update the `FeedSourceArticlesSheet.vue` header area to:

```vue
<template #header>
  <div class="source-sheet-header" :style="{ '--source-color': sourceColor }">
    <div class="source-sheet-hero">
      <div class="source-sheet-avatar" data-test="source-sheet-avatar">{{ avatarLabel }}</div>
    </div>
    <div class="source-sheet-heading">
      <span class="source-sheet-kicker">SOURCE URL</span>
      <p class="source-sheet-url">{{ fullUrl }}</p>
      <h2>{{ source?.title || '来源' }}</h2>
    </div>
    <PPress
      v-if="source"
      :label="source.subscribed ? '已订阅' : '订阅'"
      :variant="source.subscribed ? 'secondary' : 'primary'"
      :disabled="source.subscribed || subscribeBusy"
      :loading="subscribeBusy"
      loading-text="处理中..."
      @click="$emit('subscribe')"
    />
  </div>
</template>
```

and add:

```ts
import { computed } from 'vue'
import {
  buildSourceAvatarLabel,
  buildSourceColor,
} from '@/utils/feedSourcePresentation'

const avatarLabel = computed(() => buildSourceAvatarLabel(props.source?.title))
const sourceColor = computed(() => buildSourceColor(props.source?.rssUrl || props.source?.id))
const fullUrl = computed(() => props.source?.rssUrl || props.source?.title || '未知来源')
```

while leaving the article list block and `open-article` event behavior intact.

- [ ] **Step 4: Run the drawer tests to verify they pass**

Run:

```bash
bun test tests/unit/components/feed/FeedSourceArticlesSheet.spec.ts
```

Expected: PASS with the old subscribe/article-open behavior preserved and the new branded header assertion passing.

- [ ] **Step 5: Commit**

```bash
git add src/components/feed/FeedSourceArticlesSheet.vue tests/unit/components/feed/FeedSourceArticlesSheet.spec.ts
git commit -m "feat: brand feed source drawer headers"
```

## Task 4: Verify Feed Explore Integration End-to-End At Unit Level

**Files:**
- Modify: `src/views/feed/FeedRecommendedView.vue`
- Modify: `tests/unit/views/feed/FeedRecommendedView.spec.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: Add only the optional type surface needed by the UI**

If the implementation needs optional visual fields, update `src/types.ts` like this:

```ts
export interface FeedExploreSource {
  id: string
  title: string
  rssUrl?: string
  subscriptionCount: number
  recentItemCount: number
  lastPublishedAt?: string
  subscribed: boolean
  description?: string
  avatarUrl?: string
  brandColor?: string
}

export interface FeedArticleSource {
  type: 'internal_channel' | 'external_rss'
  id: string
  title: string
  rssUrl?: string
  subscribed?: boolean
  subscriptionId?: string
  description?: string
  avatarUrl?: string
  brandColor?: string
}
```

Skip this edit if the UI can ship cleanly without new fields.

- [ ] **Step 2: Keep `FeedRecommendedView.vue` orchestration unchanged except for source shape pass-through**

If the map function is touched, keep it additive:

```ts
const mapExploreSource = (source: Record<string, any>): FeedExploreSource => ({
  id: source.id,
  title: source.title || '未命名来源',
  rssUrl: source.rss_url || source.rssUrl,
  subscriptionCount: Number(source.subscription_count ?? source.subscriptionCount ?? 0),
  recentItemCount: Number(source.recent_item_count ?? source.recentItemCount ?? 0),
  lastPublishedAt: source.last_published_at || source.lastPublishedAt || source.last_fetched_at || source.lastFetchedAt,
  subscribed: Boolean(source.subscribed),
  description: source.description || source.summary,
  avatarUrl: source.avatar_url || source.avatarUrl,
  brandColor: source.brand_color || source.brandColor,
})
```

- [ ] **Step 3: Add a feed explore integration test that protects the reuse boundary**

Extend `tests/unit/views/feed/FeedRecommendedView.spec.ts` with a test like:

```ts
it('opens the branded source drawer in channel mode while keeping source article rows intact', async () => {
  Object.assign(routeQuery, { mode: 'channels' })

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    if (url.includes('/feed/explore/sources')) {
      return new Response(JSON.stringify({
        data: [{
          id: 'source-1',
          title: 'Dense Discovery',
          rss_url: 'https://dense-discovery.com/rss.xml',
          subscription_count: 128,
          recent_item_count: 27,
          last_published_at: '2026-06-20T00:00:00Z',
        }],
        meta: { total: 1 },
      }), { status: 200 })
    }
    if (url.includes('/feed/timeline?')) {
      return new Response(JSON.stringify({
        data: [{
          type: 'feed_item',
          published_at: '2026-06-20T00:00:00Z',
          is_read: false,
          feed_item: {
            id: 'item-1',
            feed_source_id: 'source-1',
            guid: 'item-1',
            title: 'Source Article',
            link: 'https://dense-discovery.com/post',
            summary: 'summary',
            author: 'author',
            published_at: '2026-06-20T00:00:00Z',
            fetched_at: '2026-06-20T00:00:00Z',
          },
        }],
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
        PShortcutHints: true,
        FeedArticleSheet: true,
      },
    },
  })

  await flushPromises()
  await wrapper.get('[data-test="channel-card"]').trigger('click')
  await flushPromises()

  expect(wrapper.text()).toContain('Dense Discovery')
  expect(wrapper.text()).toContain('Source Article')
})
```

- [ ] **Step 4: Run the focused feed tests**

Run:

```bash
bun test tests/unit/utils/feedSourcePresentation.spec.ts tests/unit/components/feed/FeedSourceIdentityCard.spec.ts tests/unit/components/feed/FeedSourceArticlesSheet.spec.ts tests/unit/views/feed/FeedRecommendedView.spec.ts
```

Expected: PASS with the new visual presentation covered and no regressions to source drawer article reuse.

- [ ] **Step 5: Run a broader feed component verification pass**

Run:

```bash
bun test tests/unit/components/feed tests/unit/views/feed
```

Expected: PASS, confirming the visual refresh did not break sibling feed surfaces.

- [ ] **Step 6: Commit**

```bash
git add src/views/feed/FeedRecommendedView.vue src/types.ts tests/unit/views/feed/FeedRecommendedView.spec.ts
git commit -m "feat: refresh feed explore channel visuals"
```
