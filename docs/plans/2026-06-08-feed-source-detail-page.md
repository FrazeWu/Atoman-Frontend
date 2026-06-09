# Feed Source Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real backend-connected Feed/RSS subscription source detail page focused on that source's article stream.

**Architecture:** Add a feed module route at `/source/:id`, where `:id` is the user's subscription UUID. The page reuses the existing backend data paths: legacy `GET /api/feed/subscriptions` through `useFeedStore.fetchSubscriptions()` for subscription/source metadata, and current v1 `GET /api/v1/feed/timeline?source_id=<subscriptionId>` for the source article stream. The page keeps Quiet Stack direction by making the timeline the main paper stack and source metadata a quiet secondary side page.

**Tech Stack:** Vue 3, Vue Router 4, Pinia, Vitest, Testing Library Vue, existing Atoman `A*` / `Paper*` UI primitives, existing Go backend Feed APIs.

---

## Context from current code

- Feed module routes live in `web/src/router/routes/modules.ts`.
- Feed layout is `web/src/views/feed/FeedLayout.vue`; child views render inside its `router-view`.
- Current feed home is `web/src/views/feed/FeedView.vue`.
- Existing Feed source index sheet is `web/src/components/feed/SubscriptionIndexSheet.vue`; it currently emits `select-source` and `FeedView.vue` navigates to `/?source_id=...`.
- Existing article sheet is `web/src/components/feed/FeedArticleSheet.vue` and already renders `TimelineItem` data.
- Current frontend feed store is `web/src/stores/feed.ts`; `fetchSubscriptions()` calls real backend `GET /api/feed/subscriptions` and stores `Subscription[]` with `feed_source` preloaded.
- Current feed timeline endpoint for new clients is `/api/v1/feed/timeline`, mounted by `server/internal/app/router.go` through `server/internal/modules/feed/http.go`.
- There is no v1 endpoint that lists subscription metadata yet; this plan deliberately does not add backend API surface. It reuses the existing real subscription endpoint already used by the frontend.

## Files

- Create: `web/src/utils/feedSourceDetail.ts` — pure helpers for source-detail route paths, source summary derivation, v1 timeline URL building, and v1/legacy timeline response parsing.
- Create: `web/src/utils/feedSourceDetail.spec.ts` — TDD coverage for helper behavior.
- Create: `web/src/views/feed/FeedSourceDetailView.vue` — real backend-connected subscription source detail page.
- Create: `web/src/views/feed/FeedSourceDetailView.spec.ts` — component-level test proving the page fetches real API paths and renders backend data.
- Create: `web/src/router/routes/modules.spec.ts` — route table test for the new feed source detail route.
- Modify: `web/src/router/routes/modules.ts` — add `/source/:id` feed child route before `/item/:id`.
- Modify: `web/src/types.ts` — add missing `FeedSource` fields returned by backend source metadata.
- Modify: `web/src/views/feed/FeedView.vue` — make source index selection navigate to the new real detail page instead of filtering the home timeline query.

---

### Task 1: Add the feed source detail route

**Files:**
- Create: `web/src/router/routes/modules.spec.ts`
- Modify: `web/src/router/routes/modules.ts`

- [ ] **Step 1: Write the failing route test**

Create `web/src/router/routes/modules.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { moduleRoutes } from './modules'

describe('moduleRoutes.feed', () => {
  it('mounts subscription source detail before feed item detail', () => {
    const feedRoot = moduleRoutes.feed.find((route) => route.path === '/')
    const children = feedRoot?.children ?? []

    const sourceIndex = children.findIndex((route) => route.path === 'source/:id')
    const itemIndex = children.findIndex((route) => route.path === 'item/:id')

    expect(sourceIndex).toBeGreaterThanOrEqual(0)
    expect(itemIndex).toBeGreaterThanOrEqual(0)
    expect(sourceIndex).toBeLessThan(itemIndex)
    expect(children[sourceIndex].meta).toMatchObject({ requiresAuth: true })
  })
})
```

- [ ] **Step 2: Run the route test to verify RED**

Run:

```bash
bun --cwd web run test:unit -- src/router/routes/modules.spec.ts
```

Expected: FAIL because `source/:id` is not mounted yet.

- [ ] **Step 3: Add the minimal route**

In `web/src/router/routes/modules.ts`, inside the `feed` module child route list, add `source/:id` before `item/:id`:

```ts
{ path: 'stats', component: () => import('@/views/feed/FeedStatsView.vue'), meta: { requiresAuth: true } },
{ path: 'source/:id', component: () => import('@/views/feed/FeedSourceDetailView.vue'), meta: { requiresAuth: true } },
{ path: 'item/:id', component: () => import('@/views/feed/FeedItemDetailView.vue'), meta: { requiresAuth: true } },
```

- [ ] **Step 4: Run the route test to verify GREEN**

Run:

```bash
bun --cwd web run test:unit -- src/router/routes/modules.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit checkpoint if commits are authorized**

Only if the user explicitly authorized commits in the execution session:

```bash
git add web/src/router/routes/modules.ts web/src/router/routes/modules.spec.ts
git commit -m "feat: add feed source detail route"
```

---

### Task 2: Add typed source-detail helpers

**Files:**
- Create: `web/src/utils/feedSourceDetail.spec.ts`
- Create: `web/src/utils/feedSourceDetail.ts`
- Modify: `web/src/types.ts`

- [ ] **Step 1: Write the failing helper tests**

Create `web/src/utils/feedSourceDetail.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Subscription } from '@/types'
import {
  buildFeedSourceTimelineUrl,
  feedSourceDetailPath,
  parseFeedTimelineResponse,
  resolveFeedSourceDetail,
} from './feedSourceDetail'

const subscription: Subscription = {
  id: 'sub-1',
  user_id: 'user-1',
  feed_source_id: 'source-1',
  title: 'Personal Queue',
  subscription_group_id: 'group-1',
  subscription_group: {
    id: 'group-1',
    user_id: 'user-1',
    name: 'Design',
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
  },
  health_status: 'warning',
  error_message: 'Slow upstream',
  last_checked: '2026-06-08T10:00:00Z',
  created_at: '2026-06-01T00:00:00Z',
  feed_source: {
    id: 'source-1',
    source_type: 'external_rss',
    provider: 'rsshub',
    rss_url: 'https://example.com/feed.xml',
    canonical_url: 'https://example.com/feed.xml',
    site_url: 'https://example.com',
    hash: 'hash-1',
    title: 'Example Feed',
    cover_url: 'https://example.com/cover.jpg',
    health_status: 'warning',
    last_error: 'Upstream timeout',
    last_fetched_at: '2026-06-08T09:00:00Z',
    created_at: '2026-06-01T00:00:00Z',
  },
}

describe('feedSourceDetail helpers', () => {
  it('resolves display metadata from a subscription and its feed source', () => {
    expect(resolveFeedSourceDetail([subscription], 'sub-1')).toEqual({
      subscriptionId: 'sub-1',
      feedSourceId: 'source-1',
      displayTitle: 'Personal Queue',
      sourceTitle: 'Example Feed',
      sourceType: 'external_rss',
      provider: 'rsshub',
      rssUrl: 'https://example.com/feed.xml',
      siteUrl: 'https://example.com',
      coverUrl: 'https://example.com/cover.jpg',
      healthStatus: 'warning',
      errorMessage: 'Slow upstream',
      groupName: 'Design',
      lastChecked: '2026-06-08T10:00:00Z',
      lastFetchedAt: '2026-06-08T09:00:00Z',
    })
  })

  it('returns null for an unknown subscription id', () => {
    expect(resolveFeedSourceDetail([subscription], 'missing')).toBeNull()
  })

  it('builds the source detail route path with an encoded subscription id', () => {
    expect(feedSourceDetailPath('source with spaces')).toBe('/source/source%20with%20spaces')
  })

  it('builds the v1 timeline URL scoped to one subscription source', () => {
    expect(buildFeedSourceTimelineUrl('/api/v1', 'sub-1', {
      page: 2,
      limit: 20,
      unreadOnly: true,
    })).toBe('/api/v1/feed/timeline?page=2&limit=20&source_id=sub-1&unread_only=true')
  })

  it('parses both v1 meta and legacy timeline totals', () => {
    expect(parseFeedTimelineResponse({
      data: [{ type: 'feed_item', published_at: '2026-06-08T00:00:00Z', is_read: false }],
      meta: { page: 3, page_size: 10, total: 24 },
    }, 1, 20)).toMatchObject({ total: 24, page: 3, limit: 10 })

    expect(parseFeedTimelineResponse({
      data: [],
      total: 7,
      page: 2,
      limit: 5,
    }, 1, 20)).toMatchObject({ total: 7, page: 2, limit: 5 })
  })
})
```

- [ ] **Step 2: Run the helper tests to verify RED**

Run:

```bash
bun --cwd web run test:unit -- src/utils/feedSourceDetail.spec.ts
```

Expected: FAIL because `web/src/utils/feedSourceDetail.ts` does not exist and `FeedSource` lacks typed fields used by the test.

- [ ] **Step 3: Add missing `FeedSource` fields**

In `web/src/types.ts`, update the `FeedSource` interface to include fields already returned by backend `model.FeedSource`:

```ts
export interface FeedSource {
  id: string
  source_type: 'internal_user' | 'internal_channel' | 'internal_collection' | 'external_rss'
  source_id?: string
  provider?: FeedSourceProvider
  rss_url?: string
  canonical_url?: string
  site_url?: string
  hash: string
  title?: string
  cover_url?: string
  hidden?: boolean
  health_status?: 'healthy' | 'warning' | 'error' | 'failed' | 'stale'
  last_error?: string
  last_fetched_at?: string
  full_text_enabled?: boolean
  status?: 'healthy' | 'degraded' | 'failing' | 'disabled'
  success_count?: number
  retry_count?: number
  failed_count?: number
  pending_count?: number
  success_rate?: number
  last_success_at?: string
  last_failure_at?: string
  last_error_code?: string
  last_sync_status?: 'success' | 'failed' | 'idle'
  last_sync_error?: string
  last_sync_failed_at?: string
  consecutive_sync_failures?: number
  created_at: string
}
```

- [ ] **Step 4: Add the helper implementation**

Create `web/src/utils/feedSourceDetail.ts`:

```ts
import type { Subscription, TimelineItem } from '@/types'
import { buildFeedTimelineQuery } from '@/utils/feedTimelineQuery'

export interface FeedSourceDetailSummary {
  subscriptionId: string
  feedSourceId: string
  displayTitle: string
  sourceTitle: string
  sourceType: string
  provider: string
  rssUrl: string
  siteUrl: string
  coverUrl: string
  healthStatus: string
  errorMessage: string
  groupName: string
  lastChecked: string
  lastFetchedAt: string
}

export interface FeedSourceTimelineOptions {
  page: number
  limit: number
  unreadOnly?: boolean
}

export interface ParsedFeedTimelineResponse {
  items: TimelineItem[]
  total: number
  page: number
  limit: number
}

export function feedSourceDetailPath(subscriptionId: string) {
  return `/source/${encodeURIComponent(subscriptionId)}`
}

export function resolveFeedSourceDetail(subscriptions: Subscription[], subscriptionId: string): FeedSourceDetailSummary | null {
  const subscription = subscriptions.find((item) => item.id === subscriptionId)
  if (!subscription) return null

  const source = subscription.feed_source
  const displayTitle = subscription.title?.trim() || source?.title?.trim() || '未命名订阅'
  const sourceTitle = source?.title?.trim() || displayTitle

  return {
    subscriptionId: subscription.id,
    feedSourceId: subscription.feed_source_id,
    displayTitle,
    sourceTitle,
    sourceType: source?.source_type || '',
    provider: source?.provider || '',
    rssUrl: source?.rss_url || '',
    siteUrl: source?.site_url || '',
    coverUrl: source?.cover_url || '',
    healthStatus: subscription.health_status || source?.health_status || '',
    errorMessage: subscription.error_message || source?.last_error || '',
    groupName: subscription.subscription_group?.name || '',
    lastChecked: subscription.last_checked || '',
    lastFetchedAt: source?.last_fetched_at || '',
  }
}

export function buildFeedSourceTimelineUrl(apiUrl: string, subscriptionId: string, options: FeedSourceTimelineOptions) {
  const params = buildFeedTimelineQuery({
    page: options.page,
    limit: options.limit,
    sourceId: subscriptionId,
    unreadOnly: options.unreadOnly,
  })

  return `${apiUrl}/feed/timeline?${params.toString()}`
}

export function parseFeedTimelineResponse(payload: any, fallbackPage: number, fallbackLimit: number): ParsedFeedTimelineResponse {
  const meta = payload?.meta || {}
  const items = Array.isArray(payload?.data) ? payload.data : []

  return {
    items,
    total: Number(meta.total ?? payload?.total ?? 0),
    page: Number(meta.page ?? payload?.page ?? fallbackPage),
    limit: Number(meta.page_size ?? payload?.limit ?? fallbackLimit),
  }
}
```

- [ ] **Step 5: Run the helper tests to verify GREEN**

Run:

```bash
bun --cwd web run test:unit -- src/utils/feedSourceDetail.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit checkpoint if commits are authorized**

Only if the user explicitly authorized commits in the execution session:

```bash
git add web/src/types.ts web/src/utils/feedSourceDetail.ts web/src/utils/feedSourceDetail.spec.ts
git commit -m "feat: add feed source detail helpers"
```

---

### Task 3: Build the real backend-connected source detail page

**Files:**
- Create: `web/src/views/feed/FeedSourceDetailView.spec.ts`
- Create: `web/src/views/feed/FeedSourceDetailView.vue`

- [ ] **Step 1: Write the failing component test**

Create `web/src/views/feed/FeedSourceDetailView.spec.ts`:

```ts
import { render, screen, waitFor } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FeedSourceDetailView from './FeedSourceDetailView.vue'
import { useAuthStore } from '@/stores/auth'

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }))
}

const subscriptionPayload = {
  data: [
    {
      id: 'sub-1',
      user_id: 'user-1',
      feed_source_id: 'source-1',
      title: 'Design Notes',
      health_status: 'healthy',
      created_at: '2026-06-01T00:00:00Z',
      feed_source: {
        id: 'source-1',
        source_type: 'external_rss',
        provider: 'rss',
        rss_url: 'https://example.com/feed.xml',
        site_url: 'https://example.com',
        hash: 'hash-1',
        title: 'Example Feed',
        health_status: 'healthy',
        last_fetched_at: '2026-06-08T08:00:00Z',
        created_at: '2026-06-01T00:00:00Z',
      },
    },
  ],
}

const timelinePayload = {
  data: [
    {
      type: 'feed_item',
      published_at: '2026-06-08T09:00:00Z',
      is_read: false,
      feed_item: {
        id: 'item-1',
        feed_source_id: 'source-1',
        guid: 'guid-1',
        title: 'Quiet interfaces should still carry weight',
        link: 'https://example.com/post',
        summary: '<p>Soft hierarchy keeps the main text readable.</p>',
        author: 'Example Author',
        published_at: '2026-06-08T09:00:00Z',
        fetched_at: '2026-06-08T09:05:00Z',
        feed_source: subscriptionPayload.data[0].feed_source,
      },
    },
  ],
  meta: {
    page: 1,
    page_size: 20,
    total: 1,
    has_more: false,
  },
}

describe('FeedSourceDetailView', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)

    const authStore = useAuthStore()
    authStore.token = 'test-token'
    authStore.isAuthenticated = true

    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/feed/subscriptions')) return jsonResponse(subscriptionPayload)
      if (url.includes('/api/v1/feed/timeline')) return jsonResponse(timelinePayload)
      return jsonResponse({ data: [] })
    }))
  })

  it('loads subscription metadata and the source article stream from backend APIs', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/source/:id', component: FeedSourceDetailView }],
    })
    await router.push('/source/sub-1')
    await router.isReady()

    render(FeedSourceDetailView, {
      global: {
        plugins: [router],
        stubs: {
          FeedArticleSheet: true,
          FeedTimelineFooter: true,
        },
      },
    })

    expect(await screen.findByText('Design Notes')).toBeInTheDocument()
    expect(await screen.findByText('Quiet interfaces should still carry weight')).toBeInTheDocument()

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/v1/feed/timeline?page=1&limit=20&source_id=sub-1', {
        headers: { Authorization: 'Bearer test-token' },
      })
    })
  })
})
```

- [ ] **Step 2: Run the component test to verify RED**

Run:

```bash
bun --cwd web run test:unit -- src/views/feed/FeedSourceDetailView.spec.ts
```

Expected: FAIL because `FeedSourceDetailView.vue` does not exist yet.

- [ ] **Step 3: Add the source detail view**

Create `web/src/views/feed/FeedSourceDetailView.vue`:

```vue
<template>
  <div ref="pageRootRef" class="a-page-xl feed-source-detail-page">
    <RouterLink to="/" class="feed-source-back">← BACK TO ALL FEEDS</RouterLink>

    <div v-if="!authStore.isAuthenticated" class="feed-source-login-state">
      <p class="a-title-xl a-muted">订阅</p>
      <p class="a-muted feed-source-login-copy">登录后查看订阅源文章流。</p>
      <ABtn to="/login" size="lg">登录</ABtn>
    </div>

    <template v-else>
      <div v-if="loadingSource" class="feed-source-loading">
        <div class="a-skeleton feed-source-title-skeleton" />
        <div class="a-skeleton feed-source-line-skeleton" />
        <div class="a-skeleton feed-source-line-skeleton is-short" />
      </div>

      <AEmpty v-else-if="!sourceDetail" text="订阅源不存在或已取消订阅" />

      <template v-else>
        <header class="feed-source-hero">
          <div>
            <p class="feed-source-kicker">FEED SOURCE</p>
            <h1 class="feed-source-title">{{ sourceDetail.displayTitle }}</h1>
            <p class="feed-source-sub">
              来自 {{ sourceDetail.sourceTitle }} 的最新内容。这里优先呈现文章流，来源状态与订阅信息保持低音量。
            </p>
          </div>

          <div class="feed-source-hero-actions">
            <PaperPress
              variant="secondary"
              :label="unreadOnly ? '显示全部' : '只看未读'"
              @click="toggleUnreadOnly"
            />
          </div>
        </header>

        <section class="feed-source-stack">
          <aside class="feed-source-side-page" aria-label="订阅源信息">
            <p class="feed-source-side-label">SOURCE NOTE</p>
            <dl class="feed-source-facts">
              <div>
                <dt>类型</dt>
                <dd>{{ sourceTypeLabel }}</dd>
              </div>
              <div v-if="sourceDetail.groupName">
                <dt>分组</dt>
                <dd>{{ sourceDetail.groupName }}</dd>
              </div>
              <div v-if="sourceDetail.provider">
                <dt>提供方</dt>
                <dd>{{ sourceDetail.provider.toUpperCase() }}</dd>
              </div>
              <div v-if="sourceDetail.healthStatus">
                <dt>状态</dt>
                <dd>{{ sourceDetail.healthStatus }}</dd>
              </div>
              <div v-if="sourceDetail.lastFetchedAt">
                <dt>最近抓取</dt>
                <dd>{{ formatDate(sourceDetail.lastFetchedAt) }}</dd>
              </div>
            </dl>

            <div class="feed-source-side-actions">
              <a
                v-if="sourceDetail.siteUrl"
                :href="sourceDetail.siteUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="feed-source-side-link"
              >
                访问网站 ↗
              </a>
              <a
                v-if="sourceDetail.rssUrl"
                :href="sourceDetail.rssUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="feed-source-side-link"
              >
                RSS 源 ↗
              </a>
            </div>

            <p v-if="sourceDetail.errorMessage" class="feed-source-error-note">
              {{ sourceDetail.errorMessage }}
            </p>
          </aside>

          <main class="feed-source-main-paper">
            <div class="feed-source-stream-header">
              <div>
                <p class="feed-source-stream-kicker">LATEST ENTRIES</p>
                <h2>文章流</h2>
              </div>
              <p>{{ totalItems }} items</p>
            </div>

            <div v-if="loadingTimeline" class="feed-source-timeline-loading">
              <div v-for="i in 5" :key="i" class="a-skeleton feed-source-entry-skeleton" />
            </div>

            <AEmpty v-else-if="!timeline.length" :text="unreadOnly ? '这个订阅源暂无未读内容' : '这个订阅源暂无内容'" />

            <div v-else class="feed-source-timeline">
              <PaperEntry
                v-for="(item, index) in timeline"
                :key="itemKey(item)"
                :is-open="showArticleSheet && selectedArticle && itemKey(selectedArticle) === itemKey(item)"
                :is-read="item.is_read"
                @click="openArticleSheet(item, index)"
                :title="entryTitle(item)"
                :summary="entrySummary(item)"
              >
                <template #visual>
                  <div class="feed-source-entry-badges">
                    <PaperBadge :type="item.type === 'feed_item' ? 'external' : 'internal'" fill>
                      {{ item.type === 'feed_item' ? '外部' : '内部' }}
                    </PaperBadge>
                  </div>
                </template>

                <template #meta>
                  <span class="a-label a-muted">{{ entryAuthor(item) }}</span>
                  <span>{{ formatDate(item.published_at) }}</span>
                  <span v-if="item.is_read" class="a-label feed-source-read-label">已读</span>
                </template>

                <template #actions>
                  <a
                    v-if="entryOriginalUrl(item)"
                    :href="entryOriginalUrl(item)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="feed-source-original-link"
                    @click.stop
                  >
                    ↗ 原文
                  </a>
                </template>
              </PaperEntry>

              <FeedTimelineFooter
                :page="currentPage"
                :page-size="pageLimit"
                :total="totalItems"
                :loading="loadingTimeline"
                @change-page="changePage"
              />
            </div>
          </main>
        </section>
      </template>
    </template>

    <FeedArticleSheet :show="showArticleSheet" :article="selectedArticle" @close="showArticleSheet = false" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import ABtn from '@/components/ui/ABtn.vue'
import AEmpty from '@/components/ui/AEmpty.vue'
import PaperBadge from '@/components/ui/PaperBadge.vue'
import PaperEntry from '@/components/ui/PaperEntry.vue'
import PaperPress from '@/components/ui/PaperPress.vue'
import FeedArticleSheet from '@/components/feed/FeedArticleSheet.vue'
import FeedTimelineFooter from '@/components/feed/FeedTimelineFooter.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { useApiUrl } from '@/composables/useApi'
import type { TimelineItem } from '@/types'
import {
  buildFeedSourceTimelineUrl,
  parseFeedTimelineResponse,
  resolveFeedSourceDetail,
} from '@/utils/feedSourceDetail'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const feedStore = useFeedStore()
const apiUrl = useApiUrl()

const pageRootRef = ref<HTMLElement | null>(null)
const loadingSource = ref(false)
const loadingTimeline = ref(false)
const timeline = ref<TimelineItem[]>([])
const totalItems = ref(0)
const pageLimit = 20
const unreadOnly = ref(false)
const selectedArticle = ref<TimelineItem | null>(null)
const showArticleSheet = ref(false)

const sourceId = computed(() => String(route.params.id || ''))
const currentPage = computed(() => {
  const parsed = Number.parseInt(String(route.query.page || '1'), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
})
const sourceDetail = computed(() => resolveFeedSourceDetail(feedStore.subscriptions, sourceId.value))
const sourceTypeLabel = computed(() => {
  switch (sourceDetail.value?.sourceType) {
    case 'external_rss': return '外部 RSS'
    case 'internal_user': return '站内作者'
    case 'internal_channel': return '站内频道'
    case 'internal_collection': return '站内合集'
    default: return '订阅源'
  }
})

const authHeaders = () => ({ Authorization: `Bearer ${authStore.token}` })

const formatDate = (date?: string) => {
  if (!date) return ''
  return new Date(date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

const stripHtml = (html: string) => html
  .replace(/<[^>]*>/g, '')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .trim()

const itemKey = (item: TimelineItem) => {
  if (item.type === 'post' && item.post) return `post-${item.post.id}`
  if (item.type === 'feed_item' && item.feed_item) return `feed-${item.feed_item.id}`
  return `${item.type}-${item.published_at || ''}`
}

const entryTitle = (item: TimelineItem) => item.post?.title || item.feed_item?.title || '未命名条目'
const entrySummary = (item: TimelineItem) => stripHtml(item.post?.summary || item.feed_item?.summary || '')
const entryAuthor = (item: TimelineItem) => (
  item.post?.user?.display_name
  || item.post?.user?.username
  || item.feed_item?.author
  || item.feed_item?.feed_source?.title
  || sourceDetail.value?.displayTitle
  || 'RSS'
)
const entryOriginalUrl = (item: TimelineItem) => item.feed_item?.link || ''

const fetchSource = async () => {
  if (!authStore.isAuthenticated) return
  loadingSource.value = true
  try {
    await feedStore.fetchSubscriptions()
  } finally {
    loadingSource.value = false
  }
}

const fetchTimeline = async () => {
  if (!authStore.isAuthenticated || !sourceId.value) return
  loadingTimeline.value = true
  try {
    const response = await fetch(buildFeedSourceTimelineUrl(apiUrl, sourceId.value, {
      page: currentPage.value,
      limit: pageLimit,
      unreadOnly: unreadOnly.value,
    }), { headers: authHeaders() })

    if (!response.ok) {
      timeline.value = []
      totalItems.value = 0
      return
    }

    const payload = await response.json()
    const parsed = parseFeedTimelineResponse(payload, currentPage.value, pageLimit)
    timeline.value = parsed.items
    totalItems.value = parsed.total
  } finally {
    loadingTimeline.value = false
  }
}

const openArticleSheet = (item: TimelineItem, index: number) => {
  selectedArticle.value = timeline.value[index] || item
  showArticleSheet.value = true

  if (item.type === 'feed_item' && item.feed_item && !item.is_read) {
    item.is_read = true
    void feedStore.markItemsRead([item.feed_item.id])
  }
}

const scrollToTop = async () => {
  await nextTick()
  pageRootRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const changePage = async (page: number) => {
  if (page === currentPage.value) return
  await router.push({ query: { ...route.query, page: page > 1 ? String(page) : undefined } })
  await scrollToTop()
}

const toggleUnreadOnly = async () => {
  unreadOnly.value = !unreadOnly.value
  await router.replace({ query: { ...route.query, page: undefined } })
  await fetchTimeline()
}

watch([sourceId, currentPage], async () => {
  await fetchTimeline()
}, { immediate: true })

onMounted(async () => {
  if (!authStore.isAuthenticated) return
  await fetchSource()
})
</script>

<style scoped>
.feed-source-detail-page {
  padding-top: 2rem;
  padding-bottom: 12rem;
}

.feed-source-back {
  display: inline-block;
  margin-bottom: 2rem;
  color: var(--a-color-muted);
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-decoration: none;
}

.feed-source-back:hover {
  color: var(--a-color-ink);
  text-decoration: underline;
}

.feed-source-login-state {
  min-height: 50vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.feed-source-login-copy {
  max-width: 28rem;
  margin-bottom: 2rem;
}

.feed-source-loading {
  display: grid;
  gap: 1rem;
}

.feed-source-title-skeleton {
  width: min(42rem, 80%);
  height: 5rem;
}

.feed-source-line-skeleton {
  width: min(34rem, 70%);
  height: 1rem;
}

.feed-source-line-skeleton.is-short {
  width: min(22rem, 48%);
}

.feed-source-hero {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 2rem;
  margin-bottom: 2.75rem;
  padding-bottom: 1.75rem;
}

.feed-source-hero::after {
  content: '';
  display: block;
  position: absolute;
  width: min(22rem, 42vw);
  height: 1px;
  margin-top: 1.75rem;
  background: var(--a-color-line-soft);
}

.feed-source-kicker,
.feed-source-stream-kicker,
.feed-source-side-label {
  margin: 0 0 0.75rem;
  color: var(--a-color-muted-soft);
  font-family: var(--a-font-meta);
  font-size: 0.68rem;
  font-weight: 950;
  letter-spacing: 0.22em;
}

.feed-source-title {
  max-width: 56rem;
  margin: 0;
  color: var(--a-color-ink);
  font-family: var(--a-font-serif);
  font-size: clamp(3rem, 8vw, 7rem);
  font-weight: 900;
  letter-spacing: -0.07em;
  line-height: 0.9;
}

.feed-source-sub {
  max-width: 44rem;
  margin: 1.25rem 0 0;
  color: var(--a-color-muted);
  line-height: 1.8;
}

.feed-source-hero-actions {
  flex: 0 0 auto;
}

.feed-source-stack {
  display: grid;
  grid-template-columns: minmax(13rem, 18rem) minmax(0, 1fr);
  gap: clamp(2rem, 5vw, 4.5rem);
  align-items: start;
}

.feed-source-side-page {
  position: sticky;
  top: 7rem;
  padding: 1.5rem 0 0;
  color: var(--a-color-muted);
}

.feed-source-facts {
  display: grid;
  gap: 1rem;
  margin: 0;
}

.feed-source-facts div {
  padding-top: 0.85rem;
  border-top: 1px solid var(--a-color-line-soft);
}

.feed-source-facts dt {
  margin-bottom: 0.25rem;
  color: var(--a-color-muted-soft);
  font-family: var(--a-font-meta);
  font-size: 0.66rem;
  font-weight: 900;
  letter-spacing: 0.16em;
}

.feed-source-facts dd {
  margin: 0;
  color: var(--a-color-ink);
  font-size: 0.9rem;
}

.feed-source-side-actions {
  display: grid;
  gap: 0.65rem;
  margin-top: 1.75rem;
}

.feed-source-side-link,
.feed-source-original-link {
  color: var(--a-color-muted);
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-decoration: none;
}

.feed-source-side-link:hover,
.feed-source-original-link:hover {
  color: var(--a-color-ink);
  text-decoration: underline;
}

.feed-source-error-note {
  margin-top: 1.5rem;
  color: var(--a-color-danger, #9f1239);
  font-size: 0.82rem;
  line-height: 1.6;
}

.feed-source-main-paper {
  position: relative;
  padding: clamp(1.5rem, 4vw, 3rem);
  background: var(--a-color-paper);
  box-shadow: -28px 34px 90px rgba(15, 23, 42, 0.075);
}

.feed-source-main-paper::before {
  content: '';
  position: absolute;
  z-index: -1;
  inset: 1.25rem -1rem -1rem 1.5rem;
  background: var(--a-color-paper);
  box-shadow: -18px 24px 70px rgba(15, 23, 42, 0.045);
}

.feed-source-stream-header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding-bottom: 1.2rem;
}

.feed-source-stream-header::after {
  content: '';
  position: absolute;
  width: 12rem;
  height: 1px;
  margin-top: 1.2rem;
  background: var(--a-color-line-soft);
}

.feed-source-stream-header h2 {
  margin: 0;
  color: var(--a-color-ink);
  font-size: clamp(1.6rem, 3vw, 2.6rem);
  line-height: 1;
}

.feed-source-stream-header p {
  margin: 0;
  color: var(--a-color-muted-soft);
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.feed-source-timeline,
.feed-source-timeline-loading {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.feed-source-entry-skeleton {
  height: 7rem;
}

.feed-source-entry-badges {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
  flex-shrink: 0;
}

.feed-source-read-label {
  color: var(--a-color-success);
}

@media (max-width: 900px) {
  .feed-source-hero,
  .feed-source-stack,
  .feed-source-stream-header {
    display: block;
  }

  .feed-source-hero-actions,
  .feed-source-side-page {
    margin-top: 1.5rem;
  }

  .feed-source-side-page {
    position: static;
  }
}
</style>
```

- [ ] **Step 4: Run the component test to verify GREEN**

Run:

```bash
bun --cwd web run test:unit -- src/views/feed/FeedSourceDetailView.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit checkpoint if commits are authorized**

Only if the user explicitly authorized commits in the execution session:

```bash
git add web/src/views/feed/FeedSourceDetailView.vue web/src/views/feed/FeedSourceDetailView.spec.ts
git commit -m "feat: build feed source detail page"
```

---

### Task 4: Wire existing subscription index selection to the detail page

**Files:**
- Modify: `web/src/views/feed/FeedView.vue`
- Test: `web/src/utils/feedSourceDetail.spec.ts`

- [ ] **Step 1: Extend the existing helper test to protect the target route path**

`feedSourceDetailPath()` is already covered in Task 2. No new test file is needed. Keep this assertion in `web/src/utils/feedSourceDetail.spec.ts`:

```ts
expect(feedSourceDetailPath('source with spaces')).toBe('/source/source%20with%20spaces')
```

- [ ] **Step 2: Run the helper test before changing navigation**

Run:

```bash
bun --cwd web run test:unit -- src/utils/feedSourceDetail.spec.ts
```

Expected: PASS before wiring, proving the intended path helper is stable.

- [ ] **Step 3: Change source selection navigation**

In `web/src/views/feed/FeedView.vue`, add this import near the existing utility imports:

```ts
import { feedSourceDetailPath } from '@/utils/feedSourceDetail'
```

Replace the existing `selectSource` implementation:

```ts
const selectSource = (sourceId: string) => {
  void navigateModuleWithShutter(modulePathUrl('feed', `/?source_id=${encodeURIComponent(sourceId)}`))
  showIndex.value = false
}
```

with:

```ts
const selectSource = (sourceId: string) => {
  void navigateModuleWithShutter(modulePathUrl('feed', feedSourceDetailPath(sourceId)))
  showIndex.value = false
}
```

- [ ] **Step 4: Run focused tests to verify wiring did not break helpers/routes**

Run:

```bash
bun --cwd web run test:unit -- src/utils/feedSourceDetail.spec.ts src/router/routes/modules.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit checkpoint if commits are authorized**

Only if the user explicitly authorized commits in the execution session:

```bash
git add web/src/views/feed/FeedView.vue web/src/utils/feedSourceDetail.spec.ts
git commit -m "feat: link feed sources to detail page"
```

---

### Task 5: Full verification

**Files:**
- Verify only; no planned code changes.

- [ ] **Step 1: Run all focused unit tests**

Run:

```bash
bun --cwd web run test:unit -- src/router/routes/modules.spec.ts src/utils/feedSourceDetail.spec.ts src/views/feed/FeedSourceDetailView.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Run frontend type-check**

Run:

```bash
bun --cwd web run type-check
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 3: Run backend build only if backend files were changed**

This plan does not require backend changes. If the executor changes backend files anyway, run:

```bash
go build ./server/...
```

Expected: PASS.

- [ ] **Step 4: Run the app and manually verify the real page**

Start the backend and frontend with the project's usual commands, then open the feed module in a browser:

```bash
go run server/cmd/start_server/main.go
bun --cwd web run dev
```

Manual path to verify on localhost:

```text
/?site=feed
```

Verification flow:

1. Log in with an account that has at least one subscription.
2. Open the subscription source index from the feed page.
3. Select a subscription source.
4. Confirm the browser navigates to `/source/<subscription-id>?site=feed` on localhost routing.
5. Confirm the page title uses the subscription title or feed source title.
6. Confirm the main paper area shows only that source's articles from real backend data.
7. Toggle “只看未读” and confirm the timeline request includes `unread_only=true`.
8. Open an article and confirm the right-side article sheet displays real feed item content.
9. Confirm the page uses soft paper stacking, short/mid structural lines, and no heavy black card borders.

- [ ] **Step 5: Final status check**

Run:

```bash
git status --short
```

Expected: only intentional files from this plan are modified or created. `.superpowers/` preview artifacts from earlier visual brainstorming must not be committed.

---

## Self-review

- Spec coverage: This plan implements a real backend-connected detail page for the subscription module, focused on article flow. It does not continue mockup work.
- API scope: No backend endpoint is added. The page uses existing real endpoints: legacy `/api/feed/subscriptions` for subscription metadata and v1 `/api/v1/feed/timeline` for the article stream.
- Placeholder scan: No TBD/TODO/implement-later placeholders are present.
- Type consistency: `FeedSourceDetailSummary`, `feedSourceDetailPath`, `buildFeedSourceTimelineUrl`, and `parseFeedTimelineResponse` are defined before use. `FeedSource` type additions match fields already present on backend `model.FeedSource`.
- Scope check: This is one implementation plan for one page and its route. It does not attempt the full Quiet Stack redesign across all modules.
