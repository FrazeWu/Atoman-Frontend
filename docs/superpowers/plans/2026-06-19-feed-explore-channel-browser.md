# Feed Explore Channel Browser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a two-mode feed explore page with `文章浏览` and `频道浏览`, where channel browse shows popular external RSS sources and opens a drawer with source articles.

**Architecture:** Extend the backend feed module with a public source-explore endpoint plus source-id-based article retrieval, then refactor the frontend explore page into article and channel panels under the existing route. Reuse the current source drawer UI where possible, but stop assuming all source article fetches come from a subscription id.

**Tech Stack:** Vue 3, Pinia, Vue Router, Vitest, Go, Gin, GORM

---

## File Structure

### Frontend

- Modify: `src/views/feed/FeedRecommendedView.vue`
  - Keep as the page container and route/query orchestrator.
- Create: `src/components/feed/ArticleExplorePanel.vue`
  - Own the current article-mode timeline rendering and article-mode controls.
- Create: `src/components/feed/ChannelExplorePanel.vue`
  - Render the channel card grid, empty/error/loading states, and pagination.
- Modify: `src/components/feed/FeedSourceArticlesSheet.vue`
  - Accept source-based drawer metadata cleanly for both subscribed and unsubscribed sources.
- Modify: `src/composables/useApi.ts`
  - Add feed source explore and source article endpoints.
- Modify: `src/types.ts`
  - Add a dedicated `FeedExploreSource` type.
- Modify: `tests/unit/views/feed/FeedRecommendedView.spec.ts`
  - Cover mode switching, channel fetches, and drawer behavior.
- Create: `tests/unit/components/feed/ChannelExplorePanel.spec.ts`
  - Cover card rendering, loading, empty, error, and click emit behavior.

### Backend

- Modify: `internal/modules/feed/repo.go`
  - Add source explore query and source-id article query helpers.
- Modify: `internal/modules/feed/legacy_compat.go`
  - Add the new public source explore handler and update public source article query behavior.
- Modify: `internal/modules/feed/http_test.go`
  - Add public handler tests for source explore and source article reads.
- Modify: `internal/modules/feed/service_test.go`
  - Add query-level behavior tests for source ranking/exclusion if the existing test helpers already cover this layer.

## Task 1: Add Backend Tests For Public Source Explore

**Files:**
- Modify: `Atoman-Backend/internal/modules/feed/http_test.go`
- Test: `Atoman-Backend/internal/modules/feed/http_test.go`

- [ ] **Step 1: Write the failing handler test for source explore**

Add tests shaped like this near the existing explore tests:

```go
func TestGetExploreSourcesHandlerAllowsAnonymousPublicRead(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	gin.SetMode(gin.TestMode)
	service, _, _ := newFeedTestService(t)

	router := gin.New()
	RegisterRoutes(router.Group("/api/v1/feed"), service)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/feed/explore/sources?page=1&limit=20", nil)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected anonymous source explore to return 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var payload struct {
		Data []struct {
			ID                string `json:"id"`
			Title             string `json:"title"`
			SubscriptionCount int64  `json:"subscription_count"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(payload.Data) == 0 {
		t.Fatalf("expected source explore items, got body %s", rr.Body.String())
	}
}
```

- [ ] **Step 2: Write the failing handler test for source-id article fetch without a subscription**

Add a second test:

```go
func TestGetSubscribedFeedHandlerAllowsPublicReadByFeedSourceID(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	gin.SetMode(gin.TestMode)
	service, db, _ := newFeedTestService(t)

	var feedItem model.FeedItem
	if err := db.Where("title = ?", "Feed item").First(&feedItem).Error; err != nil {
		t.Fatalf("find feed item: %v", err)
	}

	router := gin.New()
	RegisterRoutes(router.Group("/api/v1/feed"), service)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/feed/timeline?feed_source_id="+feedItem.FeedSourceID.String(), nil)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected public source timeline to return 200, got %d with body %s", rr.Code, rr.Body.String())
	}

	var payload struct {
		Data []TimelineItemDTO `json:"data"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(payload.Data) == 0 {
		t.Fatalf("expected source timeline items, got body %s", rr.Body.String())
	}
}
```

- [ ] **Step 3: Run the backend handler tests to verify they fail**

Run:

```bash
go test ./internal/modules/feed -run 'TestGetExploreSourcesHandlerAllowsAnonymousPublicRead|TestGetSubscribedFeedHandlerAllowsPublicReadByFeedSourceID' -v
```

Expected: FAIL because `/api/v1/feed/explore/sources` does not exist yet and `feed_source_id` public filtering is not implemented.

- [ ] **Step 4: Implement the minimal repo queries for source explore**

Add source DTO/query support in `Atoman-Backend/internal/modules/feed/repo.go` with code like:

```go
type ExploreSourceRow struct {
	ID                uuid.UUID  `json:"id"`
	Title             string     `json:"title"`
	RSSURL            string     `json:"rss_url"`
	SubscriptionCount int64      `json:"subscription_count"`
	RecentItemCount   int64      `json:"recent_item_count"`
	LastPublishedAt   *time.Time `json:"last_published_at"`
}

func (r *Repo) ListExploreSources(limit int, offset int) ([]ExploreSourceRow, error) {
	var rows []ExploreSourceRow
	err := r.db.Table("feed_sources").
		Select(`
			feed_sources.id,
			feed_sources.title,
			feed_sources.rss_url,
			COUNT(DISTINCT subscriptions.id) AS subscription_count,
			COUNT(DISTINCT feed_items.id) AS recent_item_count,
			MAX(feed_items.published_at) AS last_published_at
		`).
		Joins("LEFT JOIN subscriptions ON subscriptions.feed_source_id = feed_sources.id").
		Joins("LEFT JOIN feed_items ON feed_items.feed_source_id = feed_sources.id").
		Where("feed_sources.source_type = ?", "external_rss").
		Where("feed_sources.hidden = ?", false).
		Group("feed_sources.id").
		Having("COUNT(feed_items.id) > 0").
		Order("subscription_count DESC, last_published_at DESC NULLS LAST").
		Offset(offset).
		Limit(limit).
		Scan(&rows).Error
	return rows, err
}
```

- [ ] **Step 5: Implement source count support**

Add:

```go
func (r *Repo) CountExploreSources() (int64, error) {
	var count int64
	err := r.db.Table("feed_sources").
		Joins("JOIN feed_items ON feed_items.feed_source_id = feed_sources.id").
		Where("feed_sources.source_type = ?", "external_rss").
		Where("feed_sources.hidden = ?", false).
		Distinct("feed_sources.id").
		Count(&count).Error
	return count, err
}
```

- [ ] **Step 6: Implement the minimal handler for source explore**

In `Atoman-Backend/internal/modules/feed/legacy_compat.go`, add a public handler like:

```go
func GetExploreSources(db *gorm.DB) gin.HandlerFunc {
	repo := NewRepo(db)
	return func(c *gin.Context) {
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
		if page < 1 {
			page = 1
		}
		if limit < 1 {
			limit = 20
		}
		if limit > 100 {
			limit = 100
		}
		offset := (page - 1) * limit

		rows, err := repo.ListExploreSources(limit, offset)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch explore sources"})
			return
		}
		total, err := repo.CountExploreSources()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count explore sources"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"data": rows,
			"meta": gin.H{
				"page": page,
				"page_size": limit,
				"total": total,
				"has_more": int64(offset+len(rows)) < total,
			},
		})
	}
}
```

- [ ] **Step 7: Register the new route**

In the feed route registration block, add:

```go
public.GET("/explore/sources", GetExploreSources(service.db))
```

Use the actual router grouping style already present in the file instead of inventing a new group.

- [ ] **Step 8: Extend the timeline handler to support `feed_source_id` public filtering**

In the existing timeline handler path, parse:

```go
feedSourceID := c.Query("feed_source_id")
```

Then branch so that:

```go
if feedSourceID != "" {
	// fetch by feed source id without requiring subscription ownership
}
```

Use a repo helper that loads recent feed items for a public external source:

```go
func (r *Repo) ListFeedItemsBySourceID(feedSourceID uuid.UUID, limit int, offset int) ([]model.FeedItem, error) {
	var items []model.FeedItem
	err := r.db.Preload("FeedSource").
		Joins("JOIN feed_sources ON feed_sources.id = feed_items.feed_source_id").
		Where("feed_items.feed_source_id = ?", feedSourceID).
		Where("feed_sources.hidden = ?", false).
		Order("feed_items.published_at DESC").
		Offset(offset).
		Limit(limit).
		Find(&items).Error
	return items, err
}
```

- [ ] **Step 9: Run the backend handler tests to verify they pass**

Run:

```bash
go test ./internal/modules/feed -run 'TestGetExploreSourcesHandlerAllowsAnonymousPublicRead|TestGetSubscribedFeedHandlerAllowsPublicReadByFeedSourceID' -v
```

Expected: PASS

- [ ] **Step 10: Commit the backend public source explore foundation**

```bash
git -C /root/Atoman/Atoman-Backend add internal/modules/feed/http_test.go internal/modules/feed/repo.go internal/modules/feed/legacy_compat.go
git -C /root/Atoman/Atoman-Backend commit -m "feat(feed): add public source explore endpoints"
```

## Task 2: Tighten Backend Ranking And Exclusion Behavior

**Files:**
- Modify: `Atoman-Backend/internal/modules/feed/http_test.go`
- Modify: `Atoman-Backend/internal/modules/feed/service_test.go`
- Modify: `Atoman-Backend/internal/modules/feed/repo.go`

- [ ] **Step 1: Write the failing repo/service test for hidden source exclusion**

Add a test similar to:

```go
func TestListExploreSourcesExcludesHiddenSources(t *testing.T) {
	service, db, _ := newFeedTestService(t)

	var hidden model.FeedSource
	if err := db.Where("hidden = ?", true).First(&hidden).Error; err != nil {
		t.Fatalf("find hidden source: %v", err)
	}

	rows, err := service.repo.ListExploreSources(20, 0)
	if err != nil {
		t.Fatalf("list explore sources: %v", err)
	}
	for _, row := range rows {
		if row.ID == hidden.ID {
			t.Fatalf("hidden source leaked into explore sources: %#v", row)
		}
	}
}
```

- [ ] **Step 2: Write the failing ranking test**

Add:

```go
func TestListExploreSourcesOrdersBySubscriptionCountThenFreshness(t *testing.T) {
	service, _, _ := newFeedTestService(t)

	rows, err := service.repo.ListExploreSources(20, 0)
	if err != nil {
		t.Fatalf("list explore sources: %v", err)
	}
	if len(rows) < 2 {
		t.Fatalf("expected at least two explore sources, got %d", len(rows))
	}
	if rows[0].SubscriptionCount < rows[1].SubscriptionCount {
		t.Fatalf("expected source ordering by subscription_count desc, got %#v", rows)
	}
}
```

- [ ] **Step 3: Run the focused backend tests to verify expected failures**

Run:

```bash
go test ./internal/modules/feed -run 'TestListExploreSourcesExcludesHiddenSources|TestListExploreSourcesOrdersBySubscriptionCountThenFreshness' -v
```

Expected: FAIL if seed data and ordering rules are not yet fully aligned.

- [ ] **Step 4: Refine the repo query to make ranking deterministic**

Update `ListExploreSources` ordering to:

```go
Order("subscription_count DESC").
Order("last_published_at DESC NULLS LAST").
Order("feed_sources.created_at DESC")
```

Also ensure the query does not overcount subscriptions because of feed-item joins by using `COUNT(DISTINCT subscriptions.id)`.

- [ ] **Step 5: Add any missing test fixture setup required for deterministic ordering**

If the current test fixture does not naturally produce two ranked sources, seed them explicitly in the test using existing models:

```go
source := model.FeedSource{...}
item := model.FeedItem{FeedSourceID: source.ID, ...}
subscription := model.Subscription{FeedSourceID: source.ID, UserID: anotherUser.ID}
```

Keep the fixture local to the test; do not mutate global seed helpers for unrelated behavior.

- [ ] **Step 6: Run the focused backend tests to verify they pass**

Run:

```bash
go test ./internal/modules/feed -run 'TestListExploreSourcesExcludesHiddenSources|TestListExploreSourcesOrdersBySubscriptionCountThenFreshness' -v
```

Expected: PASS

- [ ] **Step 7: Commit the query-hardening changes**

```bash
git -C /root/Atoman/Atoman-Backend add internal/modules/feed/http_test.go internal/modules/feed/service_test.go internal/modules/feed/repo.go
git -C /root/Atoman/Atoman-Backend commit -m "test(feed): cover source explore ranking rules"
```

## Task 3: Add Frontend Types And API Endpoints

**Files:**
- Modify: `Atoman-Frontend/src/types.ts`
- Modify: `Atoman-Frontend/src/composables/useApi.ts`
- Test: `Atoman-Frontend/tests/unit/views/feed/FeedRecommendedView.spec.ts`

- [ ] **Step 1: Write the failing frontend test for channel-mode bootstrap**

Add a spec that mounts `FeedRecommendedView` with `routeQuery.mode = 'channels'` and expects a channel fetch to happen:

```ts
it('fetches channel explore data when mode=channels', async () => {
  Object.assign(routeQuery, { mode: 'channels' })

  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    if (url.includes('/feed/explore/sources')) {
      return new Response(JSON.stringify({
        data: [{ id: 'source-1', title: 'Source One', rss_url: 'https://example.com/rss.xml', subscription_count: 3, recent_item_count: 8, last_published_at: '2026-06-19T00:00:00Z', subscribed: false }],
        meta: { page: 1, page_size: 20, total: 1, has_more: false },
      }), { status: 200 })
    }
    return new Response(JSON.stringify({ data: [], meta: { page: 1, page_size: 20, total: 0, has_more: false } }), { status: 200 })
  })

  mount(FeedRecommendedView, { global: { stubs: { ... } } })
  await flushPromises()

  expect(fetchSpy.mock.calls.some(([url]) => String(url).includes('/feed/explore/sources'))).toBe(true)
})
```

- [ ] **Step 2: Run the failing frontend test**

Run:

```bash
bun test tests/unit/views/feed/FeedRecommendedView.spec.ts --runInBand
```

Expected: FAIL because the frontend does not yet know about `mode=channels` or `/feed/explore/sources`.

- [ ] **Step 3: Add the new frontend type**

In `src/types.ts`, add:

```ts
export interface FeedExploreSource {
  id: string
  title: string
  rssUrl?: string
  subscriptionCount: number
  recentItemCount: number
  lastPublishedAt?: string
  subscribed: boolean
}
```

- [ ] **Step 4: Add API endpoint helpers**

In `src/composables/useApi.ts`, extend `feed` with:

```ts
exploreSources: `${apiUrl}/feed/explore/sources`,
sourceTimeline: `${apiUrl}/feed/timeline`,
```

Keep naming aligned with current feed API naming. Do not add a second helper if `timeline` can be reused for the source drawer query string.

- [ ] **Step 5: Run the frontend test again to verify it still fails for the right reason**

Run:

```bash
bun test tests/unit/views/feed/FeedRecommendedView.spec.ts --runInBand
```

Expected: still FAIL, but now because the view behavior has not been implemented yet rather than because the endpoint helper is missing.

- [ ] **Step 6: Commit the type and API wiring**

```bash
git -C /root/Atoman/Atoman-Frontend add src/types.ts src/composables/useApi.ts tests/unit/views/feed/FeedRecommendedView.spec.ts
git -C /root/Atoman/Atoman-Frontend commit -m "feat(feed): add channel explore API types"
```

## Task 4: Extract The Article Explore Panel

**Files:**
- Create: `Atoman-Frontend/src/components/feed/ArticleExplorePanel.vue`
- Modify: `Atoman-Frontend/src/views/feed/FeedRecommendedView.vue`
- Test: `Atoman-Frontend/tests/unit/views/feed/FeedRecommendedView.spec.ts`

- [ ] **Step 1: Write the failing test that article mode still renders article rows**

Add:

```ts
it('keeps article mode as the default explore surface', async () => {
  const wrapper = mount(FeedRecommendedView, { global: { stubs: { ... } } })
  await flushPromises()
  expect(wrapper.text()).toContain('探索条目')
})
```

- [ ] **Step 2: Run the test to confirm it currently passes before extraction**

Run:

```bash
bun test tests/unit/views/feed/FeedRecommendedView.spec.ts --runInBand -t "keeps article mode as the default explore surface"
```

Expected: PASS

- [ ] **Step 3: Extract the timeline block into `ArticleExplorePanel.vue`**

Move the current article list markup into a focused component with props like:

```vue
<script setup lang="ts">
import type { FeedItem, TimelineItem } from '@/types'

defineProps<{
  items: TimelineItem[]
  loading: boolean
  totalItems: number
  page: number
  pageSize: number
  selectedArticle: TimelineItem | null
  showArticleSheet: boolean
  focusedIndex: number
  starredIds: Set<string>
  readingListIds: Set<string>
  feedItemSource: (item: FeedItem) => any
  sourceTriggerLabel: (source: any) => string
}>()
```

Keep emits narrow:

```ts
const emit = defineEmits<{
  (e: 'open-article', item: TimelineItem, index: number): void
  (e: 'open-source', item: FeedItem): void
  (e: 'toggle-star', id: string): void
  (e: 'toggle-reading-list', id: string): void
  (e: 'change-page', page: number): void
  (e: 'play-podcast', item: FeedItem): void
}>()
```

- [ ] **Step 4: Replace the inline article markup in `FeedRecommendedView.vue`**

Use:

```vue
<ArticleExplorePanel
  v-if="mode === 'articles'"
  :items="items"
  :loading="loading"
  :total-items="totalItems"
  :page="page"
  :page-size="pageLimit"
  :selected-article="selectedArticle"
  :show-article-sheet="showArticleSheet"
  :focused-index="focusedIndex"
  :starred-ids="starredIds"
  :reading-list-ids="readingListIds"
  :feed-item-source="feedItemSource"
  :source-trigger-label="sourceTriggerLabel"
  @open-article="openArticleSheet"
  @open-source="openFeedItemSourceSheet"
  @toggle-star="toggleStar"
  @toggle-reading-list="toggleReadingList"
  @change-page="changePage"
  @play-podcast="playPodcast"
/>
```

- [ ] **Step 5: Run the focused frontend test suite**

Run:

```bash
bun test tests/unit/views/feed/FeedRecommendedView.spec.ts --runInBand
```

Expected: PASS for existing article-mode behavior.

- [ ] **Step 6: Commit the article-panel extraction**

```bash
git -C /root/Atoman/Atoman-Frontend add src/components/feed/ArticleExplorePanel.vue src/views/feed/FeedRecommendedView.vue tests/unit/views/feed/FeedRecommendedView.spec.ts
git -C /root/Atoman/Atoman-Frontend commit -m "refactor(feed): extract article explore panel"
```

## Task 5: Build The Channel Explore Panel

**Files:**
- Create: `Atoman-Frontend/src/components/feed/ChannelExplorePanel.vue`
- Create: `Atoman-Frontend/tests/unit/components/feed/ChannelExplorePanel.spec.ts`

- [ ] **Step 1: Write the failing panel tests**

Create `tests/unit/components/feed/ChannelExplorePanel.spec.ts` with tests like:

```ts
it('renders source cards with counts and timestamps', () => {
  const wrapper = mount(ChannelExplorePanel, {
    props: {
      items: [{ id: 'source-1', title: 'Source One', rssUrl: 'https://example.com/rss.xml', subscriptionCount: 3, recentItemCount: 8, lastPublishedAt: '2026-06-19T00:00:00Z', subscribed: false }],
      loading: false,
      error: '',
      page: 1,
      pageSize: 20,
      totalItems: 1,
    },
  })

  expect(wrapper.text()).toContain('Source One')
  expect(wrapper.text()).toContain('3')
})

it('emits open-source when a card is clicked', async () => {
  const wrapper = mount(ChannelExplorePanel, {
    props: {
      items: [{ id: 'source-1', title: 'Source One', subscriptionCount: 3, recentItemCount: 8, subscribed: false }],
      loading: false,
      error: '',
      page: 1,
      pageSize: 20,
      totalItems: 1,
    },
  })

  await wrapper.get('[data-test=\"channel-card\"]').trigger('click')
  expect(wrapper.emitted('open-source')?.[0]?.[0]?.id).toBe('source-1')
})
```

- [ ] **Step 2: Run the new component test to verify it fails**

Run:

```bash
bun test tests/unit/components/feed/ChannelExplorePanel.spec.ts --runInBand
```

Expected: FAIL because the component does not exist yet.

- [ ] **Step 3: Implement the minimal component**

Create `src/components/feed/ChannelExplorePanel.vue` with props:

```ts
defineProps<{
  items: FeedExploreSource[]
  loading: boolean
  error: string
  totalItems: number
  page: number
  pageSize: number
}>()

const emit = defineEmits<{
  (e: 'open-source', source: FeedExploreSource): void
  (e: 'retry'): void
  (e: 'change-page', page: number): void
}>()
```

Use a responsive card grid with:

```vue
<button
  v-for="item in items"
  :key="item.id"
  type="button"
  class="channel-card"
  data-test="channel-card"
  @click="emit('open-source', item)"
>
  <h3>{{ item.title }}</h3>
  <p>{{ item.subscriptionCount }} 订阅 · {{ item.recentItemCount }} 篇最近内容</p>
  <p>{{ formatDate(item.lastPublishedAt) }}</p>
</button>
```

Include:

1. skeleton block for loading
2. `PEmpty` for empty state
3. inline retry button for error state
4. `FeedTimelineFooter` for pagination

- [ ] **Step 4: Run the new component test to verify it passes**

Run:

```bash
bun test tests/unit/components/feed/ChannelExplorePanel.spec.ts --runInBand
```

Expected: PASS

- [ ] **Step 5: Commit the channel panel**

```bash
git -C /root/Atoman/Atoman-Frontend add src/components/feed/ChannelExplorePanel.vue tests/unit/components/feed/ChannelExplorePanel.spec.ts
git -C /root/Atoman/Atoman-Frontend commit -m "feat(feed): add channel explore panel"
```

## Task 6: Add Mode Switching And Channel Fetching To The Explore View

**Files:**
- Modify: `Atoman-Frontend/src/views/feed/FeedRecommendedView.vue`
- Modify: `Atoman-Frontend/tests/unit/views/feed/FeedRecommendedView.spec.ts`

- [ ] **Step 1: Write the failing mode-switch test**

Add:

```ts
it('switches to channel mode and syncs the query string', async () => {
  const wrapper = mount(FeedRecommendedView, { global: { stubs: { ... } } })
  await flushPromises()

  await wrapper.get('[data-test=\"explore-mode-channels\"]').trigger('click')

  expect(routerPush).toHaveBeenCalledWith(expect.objectContaining({
    query: expect.objectContaining({ mode: 'channels', page: '1' }),
  }))
})
```

- [ ] **Step 2: Write the failing channel-render test**

Add:

```ts
it('renders channel cards in channel mode', async () => {
  Object.assign(routeQuery, { mode: 'channels' })

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    if (url.includes('/feed/explore/sources')) {
      return new Response(JSON.stringify({
        data: [{ id: 'source-1', title: 'Source One', rss_url: 'https://example.com/rss.xml', subscription_count: 3, recent_item_count: 8, last_published_at: '2026-06-19T00:00:00Z', subscribed: false }],
        meta: { page: 1, page_size: 20, total: 1, has_more: false },
      }), { status: 200 })
    }
    return new Response(JSON.stringify({ items: [] }), { status: 200 })
  })

  const wrapper = mount(FeedRecommendedView, { global: { stubs: { ... } } })
  await flushPromises()

  expect(wrapper.text()).toContain('Source One')
})
```

- [ ] **Step 3: Run the failing view tests**

Run:

```bash
bun test tests/unit/views/feed/FeedRecommendedView.spec.ts --runInBand
```

Expected: FAIL because mode state, channel list state, and query sync are not implemented yet.

- [ ] **Step 4: Add mode state and query normalization**

In `FeedRecommendedView.vue`, add:

```ts
const mode = ref<'articles' | 'channels'>(route.query.mode === 'channels' ? 'channels' : 'articles')

const syncModeFromRoute = () => {
  mode.value = route.query.mode === 'channels' ? 'channels' : 'articles'
}
```

Watch route query:

```ts
watch(() => route.query.mode, () => {
  syncModeFromRoute()
  page.value = normalizePage(route.query.page)
  void loadCurrentMode()
})
```

- [ ] **Step 5: Add channel fetch state**

Add view state:

```ts
const channelItems = ref<FeedExploreSource[]>([])
const channelLoading = ref(false)
const channelError = ref('')
const channelTotalItems = ref(0)
```

Map backend payloads:

```ts
const mapExploreSource = (item: any): FeedExploreSource => ({
  id: item.id,
  title: item.title,
  rssUrl: item.rss_url,
  subscriptionCount: Number(item.subscription_count || 0),
  recentItemCount: Number(item.recent_item_count || 0),
  lastPublishedAt: item.last_published_at,
  subscribed: Boolean(item.subscribed),
})
```

- [ ] **Step 6: Implement `fetchChannelExplore`**

Add:

```ts
const fetchChannelExplore = async () => {
  channelLoading.value = true
  channelError.value = ''
  try {
    const params = new URLSearchParams({ page: String(page.value), limit: String(pageLimit) })
    const headers = authStore.isAuthenticated ? authHeaders() : {}
    const res = await fetch(`${api.feed.exploreSources}?${params.toString()}`, { headers })
    if (!res.ok) throw new Error('fetch failed')
    const data = await res.json()
    channelItems.value = (data.data || []).map(mapExploreSource)
    channelTotalItems.value = Number(data.meta?.total || 0)
  } catch (error) {
    channelItems.value = []
    channelTotalItems.value = 0
    channelError.value = error instanceof Error ? error.message : '加载频道失败'
  } finally {
    channelLoading.value = false
  }
}
```

- [ ] **Step 7: Implement mode-aware load and mode switch**

Add:

```ts
const loadCurrentMode = async () => {
  if (mode.value === 'channels') {
    await fetchChannelExplore()
    return
  }
  await fetchExplore()
}

const changeMode = async (nextMode: 'articles' | 'channels') => {
  if (mode.value === nextMode) return
  await router.push({
    path: '/explore',
    query: {
      ...route.query,
      site: 'feed',
      mode: nextMode,
      page: '1',
    },
  })
}
```

- [ ] **Step 8: Render the mode switch and channel panel**

In the header action area, add two buttons with stable test hooks:

```vue
<PPress
  data-test="explore-mode-articles"
  label="文章浏览"
  :variant="mode === 'articles' ? 'primary' : 'secondary'"
  @click="changeMode('articles')"
/>
<PPress
  data-test="explore-mode-channels"
  label="频道浏览"
  :variant="mode === 'channels' ? 'primary' : 'secondary'"
  @click="changeMode('channels')"
/>
```

Below the header:

```vue
<ArticleExplorePanel v-if="mode === 'articles'" ... />
<ChannelExplorePanel
  v-else
  :items="channelItems"
  :loading="channelLoading"
  :error="channelError"
  :page="page"
  :page-size="pageLimit"
  :total-items="channelTotalItems"
  @open-source="openExploreSourceSheet"
  @retry="fetchChannelExplore"
  @change-page="changePage"
/>
```

- [ ] **Step 9: Make page changes mode-aware**

Update:

```ts
const changePage = async (nextPage: number) => {
  await router.push({
    path: '/explore',
    query: {
      ...route.query,
      site: 'feed',
      mode: mode.value,
      page: String(nextPage),
      ...(mode.value === 'articles' ? { sort: sort.value } : {}),
    },
  })
}
```

- [ ] **Step 10: Run the frontend view tests**

Run:

```bash
bun test tests/unit/views/feed/FeedRecommendedView.spec.ts --runInBand
```

Expected: PASS

- [ ] **Step 11: Commit the view-mode changes**

```bash
git -C /root/Atoman/Atoman-Frontend add src/views/feed/FeedRecommendedView.vue tests/unit/views/feed/FeedRecommendedView.spec.ts
git -C /root/Atoman/Atoman-Frontend commit -m "feat(feed): add channel mode to explore view"
```

## Task 7: Make The Drawer Work For Unsubscribed Sources

**Files:**
- Modify: `Atoman-Frontend/src/views/feed/FeedRecommendedView.vue`
- Modify: `Atoman-Frontend/src/components/feed/FeedSourceArticlesSheet.vue`
- Modify: `Atoman-Frontend/tests/unit/views/feed/FeedRecommendedView.spec.ts`

- [ ] **Step 1: Write the failing drawer test for a channel-card source**

Add:

```ts
it('opens source drawer from channel mode and fetches by feed_source_id', async () => {
  Object.assign(routeQuery, { mode: 'channels' })

  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    if (url.includes('/feed/explore/sources')) {
      return new Response(JSON.stringify({
        data: [{ id: 'source-1', title: 'Source One', rss_url: 'https://example.com/rss.xml', subscription_count: 3, recent_item_count: 8, last_published_at: '2026-06-19T00:00:00Z', subscribed: false }],
        meta: { page: 1, page_size: 20, total: 1, has_more: false },
      }), { status: 200 })
    }
    if (url.includes('/feed/timeline?') && url.includes('feed_source_id=source-1')) {
      return new Response(JSON.stringify({
        data: [{ type: 'feed_item', feed_item: { id: 'feed-item-2', feed_source_id: 'source-1', title: 'Source Item', link: 'https://example.com/a', summary: 'Summary', author: 'Author', published_at: '2026-06-19T00:00:00Z', fetched_at: '2026-06-19T00:00:00Z' } }],
      }), { status: 200 })
    }
    return new Response(JSON.stringify({ items: [] }), { status: 200 })
  })

  const wrapper = mount(FeedRecommendedView, { global: { stubs: { ... } } })
  await flushPromises()
  await wrapper.get('[data-test=\"channel-card\"]').trigger('click')
  await flushPromises()

  expect(fetchSpy.mock.calls.some(([url]) => String(url).includes('feed_source_id=source-1'))).toBe(true)
})
```

- [ ] **Step 2: Run the failing drawer test**

Run:

```bash
bun test tests/unit/views/feed/FeedRecommendedView.spec.ts --runInBand -t "opens source drawer from channel mode and fetches by feed_source_id"
```

Expected: FAIL because the drawer still assumes subscription-based loading.

- [ ] **Step 3: Add a source mapping helper for channel cards**

In `FeedRecommendedView.vue`, add:

```ts
const toArticleSource = (item: FeedExploreSource): FeedArticleSource => withSubscriptionState({
  type: 'external_rss',
  id: item.id,
  title: item.title,
  rssUrl: item.rssUrl,
  subscribed: item.subscribed,
})
```

- [ ] **Step 4: Update source article fetching to prefer `feed_source_id`**

Replace the current early-return logic with:

```ts
const fetchSourceArticles = async (source: FeedArticleSource) => {
  sourceArticlesLoading.value = true
  try {
    const params = new URLSearchParams({ limit: '100' })
    if (source.id) {
      params.set('feed_source_id', source.id)
    } else if (source.subscriptionId) {
      params.set('source_id', source.subscriptionId)
    }
    const headers = authStore.isAuthenticated ? authHeaders() : {}
    const response = await fetch(`${api.feed.timeline}?${params.toString()}`, { headers })
    if (!response.ok) throw new Error('fetch failed')
    const data = await response.json()
    sourceArticles.value = data.data || []
  } catch (error) {
    sourceArticles.value = []
  } finally {
    sourceArticlesLoading.value = false
  }
}
```

- [ ] **Step 5: Add a dedicated open handler for channel-mode cards**

Use:

```ts
const openExploreSourceSheet = async (item: FeedExploreSource) => {
  const source = toArticleSource(item)
  selectedSource.value = source
  showSourceSheet.value = true
  sourceArticles.value = []
  await fetchSourceArticles(source)
}
```

- [ ] **Step 6: Ensure the drawer shows subscribe state correctly**

Update `FeedSourceArticlesSheet.vue` only if required so it renders correctly when `source.subscriptionId` is absent but `source.id` and `source.subscribed` are present. Keep the contract compatible with the current article-mode source trigger.

- [ ] **Step 7: Run the focused drawer test and full view tests**

Run:

```bash
bun test tests/unit/views/feed/FeedRecommendedView.spec.ts --runInBand
```

Expected: PASS

- [ ] **Step 8: Commit the source drawer compatibility changes**

```bash
git -C /root/Atoman/Atoman-Frontend add src/views/feed/FeedRecommendedView.vue src/components/feed/FeedSourceArticlesSheet.vue tests/unit/views/feed/FeedRecommendedView.spec.ts
git -C /root/Atoman/Atoman-Frontend commit -m "fix(feed): support explore drawer for unsubscribed sources"
```

## Task 8: Final Verification

**Files:**
- Verify: `Atoman-Backend/internal/modules/feed/...`
- Verify: `Atoman-Frontend/src/views/feed/...`
- Verify: `Atoman-Frontend/tests/unit/...`

- [ ] **Step 1: Run backend feed tests**

Run:

```bash
go test ./internal/modules/feed/... -v
```

Expected: PASS

- [ ] **Step 2: Run the focused frontend unit tests**

Run:

```bash
bun test tests/unit/views/feed/FeedRecommendedView.spec.ts tests/unit/components/feed/ChannelExplorePanel.spec.ts --runInBand
```

Expected: PASS

- [ ] **Step 3: Run any formatter or linter already used by the repo for touched files**

Run the repo-standard commands only. If this repo uses Bun scripts, use those exact scripts instead of inventing new commands. Record the exact command used in the implementation notes or commit message if it is non-obvious.

- [ ] **Step 4: Smoke-check explore mode behavior manually**

Verify:

1. `/explore?site=feed` opens in article mode
2. switching to `频道浏览` updates the query to `mode=channels`
3. channel cards render
4. clicking a card opens the drawer
5. drawer article list loads without requiring an existing subscription
6. switching back to `文章浏览` preserves article behavior

- [ ] **Step 5: Commit any final test or polish changes**

```bash
git -C /root/Atoman/Atoman-Backend status --short
git -C /root/Atoman/Atoman-Frontend status --short
```

Commit only feature-related files that were intentionally changed.

## Self-Review

### Spec coverage

- Dual top-level modes: covered in Task 6.
- Channel cards and drawer interaction: covered in Tasks 5 and 7.
- Source popularity/activity ordering: covered in Tasks 1 and 2.
- Anonymous public reads: covered in Tasks 1 and 8.
- Reuse of existing source drawer behavior: covered in Tasks 4 and 7.

### Placeholder scan

- No `TODO` or `TBD` placeholders left in this plan.
- Each code-changing task includes concrete code snippets, commands, and target files.

### Type consistency

- `FeedExploreSource` is introduced in Task 3 and used consistently in Tasks 5 through 7.
- `feed_source_id` is the backend/frontend source drawer query parameter used consistently after Task 1.
