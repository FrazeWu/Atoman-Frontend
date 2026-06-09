# Feed Explore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `http://localhost:5173/explore?site=feed` 变成可用的外部 RSS / 播客内容发现流，支持 `random` 与 `popular` 两种模式，并在失败时给出明确反馈。

**Architecture:** 后端继续复用现有 `server/internal/modules/feed/` 模块，但把 `GetExploreFeed` 语义收紧为“仅返回 external_rss 的 feed_item”，不再混入站内 `post`。前端继续复用 [FeedRecommendedView.vue](/Users/fafa/Downloads/projects/Atoman/web/src/views/feed/FeedRecommendedView.vue:1) 的现有布局，只修正请求路径、补失败态，并保持现有收藏、稍后阅读、播客播放等交互。

**Tech Stack:** Go, Gin, GORM, SQLite 测试；Vue 3, TypeScript, Pinia, Vitest

---

## 文件结构

**后端**

- 修改 [server/internal/modules/feed/http.go](/Users/fafa/Downloads/projects/Atoman/server/internal/modules/feed/http.go:1)
  负责 feed explore 的 HTTP 路由契约、`sort` 参数校验与查询参数归一化。
- 修改 [server/internal/modules/feed/service.go](/Users/fafa/Downloads/projects/Atoman/server/internal/modules/feed/service.go:1)
  负责把 explore 结果限定为外部 `feed_item`，并把 `popular` 定义为“近期优质内容优先”。
- 修改 [server/internal/modules/feed/repo.go](/Users/fafa/Downloads/projects/Atoman/server/internal/modules/feed/repo.go:1)
  负责外部 `feed_items` 的随机查询、质量排序查询、计数查询与最小筛选条件。
- 修改 [server/internal/modules/feed/service_test.go](/Users/fafa/Downloads/projects/Atoman/server/internal/modules/feed/service_test.go:1)
  补 explore 行为的服务层测试。
- 新建 [server/internal/modules/feed/http_test.go](/Users/fafa/Downloads/projects/Atoman/server/internal/modules/feed/http_test.go:1)
  补 `sort` 参数校验和 HTTP 响应语义测试。

**前端**

- 修改 [web/src/views/feed/FeedRecommendedView.vue](/Users/fafa/Downloads/projects/Atoman/web/src/views/feed/FeedRecommendedView.vue:1)
  修正接口路径，补失败态文案和重试行为，保持原有卡片 UI。
- 新建 [web/tests/unit/views/feed/FeedRecommendedView.spec.ts](/Users/fafa/Downloads/projects/Atoman/web/tests/unit/views/feed/FeedRecommendedView.spec.ts:1)
  覆盖成功渲染、切换排序、失败态显示。

---

### Task 1: 收紧 feed explore 的服务层语义

**Files:**
- Modify: [server/internal/modules/feed/repo.go](/Users/fafa/Downloads/projects/Atoman/server/internal/modules/feed/repo.go:1)
- Modify: [server/internal/modules/feed/service.go](/Users/fafa/Downloads/projects/Atoman/server/internal/modules/feed/service.go:1)
- Test: [server/internal/modules/feed/service_test.go](/Users/fafa/Downloads/projects/Atoman/server/internal/modules/feed/service_test.go:1)

- [ ] **Step 1: 先写服务层失败测试，明确 explore 只能返回外部 `feed_item`**

在 [server/internal/modules/feed/service_test.go](/Users/fafa/Downloads/projects/Atoman/server/internal/modules/feed/service_test.go:1) 追加下面两个测试：

```go
func TestGetExploreFeedReturnsOnlyExternalFeedItems(t *testing.T) {
	service, db, user := newFeedTestService(t)

	internalPost := model.Post{
		UserID:  user.ID,
		Title:   "Internal only",
		Content: "body",
		Status:  "published",
	}
	if err := db.Create(&internalPost).Error; err != nil {
		t.Fatalf("create internal post: %v", err)
	}

	source := model.FeedSource{
		SourceType: "external_rss",
		RssURL:     "https://planet.example/feed.xml",
		Hash:       "planet-feed-hash",
		Title:      "Planet Feed",
	}
	if err := db.Create(&source).Error; err != nil {
		t.Fatalf("create external source: %v", err)
	}

	now := time.Now().UTC()
	itemsToCreate := []model.FeedItem{
		{
			FeedSourceID: source.ID,
			GUID:         "popular-1",
			Title:        "Featured audio entry",
			Link:         "https://planet.example/posts/1",
			Summary:      "with summary",
			ImageURL:     "https://planet.example/cover.jpg",
			EnclosureURL: "https://planet.example/audio.mp3",
			EnclosureType:"audio/mpeg",
			PublishedAt:  now.Add(-30 * time.Minute),
			FetchedAt:    now,
		},
		{
			FeedSourceID: source.ID,
			GUID:         "popular-2",
			Title:        "Plain entry",
			Link:         "https://planet.example/posts/2",
			PublishedAt:  now.Add(-2 * time.Hour),
			FetchedAt:    now,
		},
	}
	for _, item := range itemsToCreate {
		if err := db.Create(&item).Error; err != nil {
			t.Fatalf("create feed item: %v", err)
		}
	}

	items, total, err := service.GetExploreFeed(user, FeedQuery{Page: 1, PageSize: 10, Sort: "popular"})
	if err != nil {
		t.Fatalf("get explore feed: %v", err)
	}
	if total < 2 {
		t.Fatalf("expected external feed items total, got %d", total)
	}
	if len(items) == 0 {
		t.Fatalf("expected explore items")
	}
	for _, item := range items {
		if item.Type != "feed_item" {
			t.Fatalf("expected only feed_item entries, got %#v", item)
		}
		if item.FeedItem == nil {
			t.Fatalf("expected feed_item payload, got %#v", item)
		}
		if item.FeedItem.FeedSource == nil || item.FeedItem.FeedSource.SourceType != "external_rss" {
			t.Fatalf("expected external_rss source, got %#v", item.FeedItem.FeedSource)
		}
	}
}

func TestGetExploreFeedPopularPrefersMoreCompleteRecentItems(t *testing.T) {
	service, db, user := newFeedTestService(t)

	source := model.FeedSource{
		SourceType: "external_rss",
		RssURL:     "https://ranking.example/feed.xml",
		Hash:       "ranking-feed-hash",
		Title:      "Ranking Feed",
	}
	if err := db.Create(&source).Error; err != nil {
		t.Fatalf("create source: %v", err)
	}

	now := time.Now().UTC()
	plain := model.FeedItem{
		FeedSourceID: source.ID,
		GUID:         "plain",
		Title:        "Plain item",
		Link:         "https://ranking.example/plain",
		PublishedAt:  now.Add(-10 * time.Minute),
		FetchedAt:    now,
	}
	rich := model.FeedItem{
		FeedSourceID: source.ID,
		GUID:         "rich",
		Title:        "Rich item",
		Link:         "https://ranking.example/rich",
		Summary:      "summary",
		ImageURL:     "https://ranking.example/rich.jpg",
		EnclosureURL: "https://ranking.example/rich.mp3",
		EnclosureType:"audio/mpeg",
		PublishedAt:  now.Add(-20 * time.Minute),
		FetchedAt:    now,
	}
	if err := db.Create(&plain).Error; err != nil {
		t.Fatalf("create plain item: %v", err)
	}
	if err := db.Create(&rich).Error; err != nil {
		t.Fatalf("create rich item: %v", err)
	}

	items, _, err := service.GetExploreFeed(user, FeedQuery{Page: 1, PageSize: 10, Sort: "popular"})
	if err != nil {
		t.Fatalf("get explore feed: %v", err)
	}
	if len(items) == 0 {
		t.Fatalf("expected explore items")
	}
	if items[0].FeedItem == nil {
		t.Fatalf("expected first item feed payload")
	}
	if items[0].FeedItem.GUID != "rich" {
		t.Fatalf("expected richer item first, got %s", items[0].FeedItem.GUID)
	}
}
```

- [ ] **Step 2: 运行服务层测试，确认当前实现会失败**

Run:

```bash
go test ./server/internal/modules/feed -run 'TestGetExploreFeed(ReturnsOnlyExternalFeedItems|PopularPrefersMoreCompleteRecentItems)$' -v
```

Expected:

```text
FAIL
```

失败点应体现至少一个事实：
1. 当前 explore 结果混入 `post`
2. 当前 `popular` 依赖 `feed_item_stars`，并不符合“内容完整度 + 时间”的新定义

- [ ] **Step 3: 用最小实现改 repo 查询，只保留外部 `feed_item` 并加入简单质量排序**

在 [server/internal/modules/feed/repo.go](/Users/fafa/Downloads/projects/Atoman/server/internal/modules/feed/repo.go:1) 做下面的最小替换：

```go
func (r *Repo) ListExploreFeedItems(sort string, limit int, offset int) ([]model.FeedItem, error) {
	var items []model.FeedItem

	db := r.db.
		Model(&model.FeedItem{}).
		Joins("JOIN feed_sources ON feed_sources.id = feed_items.feed_source_id").
		Where("feed_sources.source_type = ?", "external_rss").
		Where("TRIM(COALESCE(feed_items.title, '')) <> ''").
		Where("TRIM(COALESCE(feed_items.link, '')) <> ''").
		Preload("FeedSource").
		Offset(offset).
		Limit(limit)

	switch sort {
	case "random":
		db = db.Order("RANDOM()")
	case "popular":
		db = db.Order(`
			(CASE WHEN feed_items.summary IS NOT NULL AND TRIM(feed_items.summary) <> '' THEN 1 ELSE 0 END) +
			(CASE WHEN feed_items.image_url IS NOT NULL AND TRIM(feed_items.image_url) <> '' THEN 1 ELSE 0 END) +
			(CASE WHEN feed_items.enclosure_url IS NOT NULL AND TRIM(feed_items.enclosure_url) <> '' THEN 1 ELSE 0 END) +
			(CASE WHEN feed_items.published_at IS NOT NULL THEN 1 ELSE 0 END) DESC,
			feed_items.published_at DESC,
			feed_items.created_at DESC
		`)
	default:
		db = db.Order("feed_items.published_at DESC, feed_items.created_at DESC")
	}

	err := db.Find(&items).Error
	return items, err
}

func (r *Repo) CountExploreFeedItems() (int64, error) {
	var count int64
	err := r.db.
		Model(&model.FeedItem{}).
		Joins("JOIN feed_sources ON feed_sources.id = feed_items.feed_source_id").
		Where("feed_sources.source_type = ?", "external_rss").
		Where("TRIM(COALESCE(feed_items.title, '')) <> ''").
		Where("TRIM(COALESCE(feed_items.link, '')) <> ''").
		Count(&count).Error
	return count, err
}
```

并在 [server/internal/modules/feed/service.go](/Users/fafa/Downloads/projects/Atoman/server/internal/modules/feed/service.go:1) 把 `GetExploreFeed` 收敛成只返回 `feed_item`：

```go
func (s *Service) GetExploreFeed(user authctx.CurrentUser, query FeedQuery) ([]TimelineItemDTO, int64, error) {
	if user.ID == uuid.Nil {
		return nil, 0, apperr.Unauthorized("Login required")
	}

	page := normalizedPage(query.Page)
	limit := normalizedPageSize(query.PageSize)
	offset := (page - 1) * limit

	feedItems, err := s.repo.ListExploreFeedItems(strings.TrimSpace(query.Sort), limit, offset)
	if err != nil {
		return nil, 0, err
	}

	legacyfeed.AnnotateDuplicateFeedItems(feedItems)
	readMap, err := s.readMap(user.ID, feedItems)
	if err != nil {
		return nil, 0, err
	}

	items := make([]TimelineItemDTO, 0, len(feedItems))
	for i := range feedItems {
		items = append(items, TimelineItemDTO{
			Type:        "feed_item",
			FeedItem:    &feedItems[i],
			PublishedAt: feedItems[i].PublishedAt,
			IsRead:      readMap[feedItems[i].ID],
		})
	}

	total, err := s.repo.CountExploreFeedItems()
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}
```

- [ ] **Step 4: 跑服务层测试，确认新语义通过**

Run:

```bash
go test ./server/internal/modules/feed -run 'TestGetExploreFeed(ReturnsOnlyExternalFeedItems|PopularPrefersMoreCompleteRecentItems)$' -v
```

Expected:

```text
PASS
```

- [ ] **Step 5: 提交后端语义收敛**

```bash
git add server/internal/modules/feed/repo.go server/internal/modules/feed/service.go server/internal/modules/feed/service_test.go
git commit -m "feat(feed): narrow explore to external feed items"
```

---

### Task 2: 校正 feed explore 的 HTTP 路由和参数校验

**Files:**
- Modify: [server/internal/modules/feed/http.go](/Users/fafa/Downloads/projects/Atoman/server/internal/modules/feed/http.go:1)
- Create: [server/internal/modules/feed/http_test.go](/Users/fafa/Downloads/projects/Atoman/server/internal/modules/feed/http_test.go:1)

- [ ] **Step 1: 先写 HTTP 失败测试，锁定合法路径和非法 sort 行为**

新建 [server/internal/modules/feed/http_test.go](/Users/fafa/Downloads/projects/Atoman/server/internal/modules/feed/http_test.go:1)：

```go
package feed

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"atoman/internal/model"
	"atoman/internal/platform/authctx"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func newFeedHTTPTestRouter(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)

	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := db.AutoMigrate(
		&model.User{},
		&model.FeedSource{},
		&model.FeedItem{},
		&model.FeedItemRead{},
		&model.FeedItemStar{},
		&model.ReadingListItem{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	user := model.User{Username: "alice", Email: "alice@example.com", Password: "hash", Role: authctx.RoleUser, IsActive: true}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	r := gin.New()
	group := r.Group("/api/v1/feed")
	group.Use(func(c *gin.Context) {
		c.Set(authctx.ContextUserKey, authctx.CurrentUser{
			ID:       user.UUID,
			Username: user.Username,
			Role:     authctx.RoleUser,
		})
		c.Next()
	})
	RegisterRoutes(group, NewService(db))
	return r
}

func TestGetExploreFeedRejectsInvalidSort(t *testing.T) {
	router := newFeedHTTPTestRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/feed/explore?sort=weird", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d with %s", w.Code, w.Body.String())
	}
}

func TestGetExploreFeedRouteExists(t *testing.T) {
	router := newFeedHTTPTestRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/feed/explore?sort=random", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code == http.StatusNotFound {
		t.Fatalf("expected mounted explore route")
	}
}
```

- [ ] **Step 2: 运行 HTTP 测试，确认当前非法 sort 仍被放过**

Run:

```bash
go test ./server/internal/modules/feed -run 'TestGetExploreFeed(RejectsInvalidSort|RouteExists)$' -v
```

Expected:

```text
FAIL
```

当前失败点应至少包含：
1. `sort=weird` 没有返回 `400`

- [ ] **Step 3: 在 handler 中补 sort 校验，并固定前端应该调用的路径契约**

在 [server/internal/modules/feed/http.go](/Users/fafa/Downloads/projects/Atoman/server/internal/modules/feed/http.go:1) 做这两个改动：

1. 保持 explore 路由为 `GET /api/v1/feed/explore`
2. 在 `getExploreFeed` 里校验 `sort`

示例代码：

```go
func (h *Handler) getExploreFeed(c *gin.Context) {
	user, ok := authctx.Current(c)
	if !ok {
		httpx.Error(c, apperr.Unauthorized("Login required"))
		return
	}

	sort := strings.TrimSpace(c.DefaultQuery("sort", "random"))
	switch sort {
	case "random", "popular":
	default:
		httpx.Error(c, apperr.BadRequest("validation.invalid_request", "sort must be random or popular"))
		return
	}

	query := queryFromContext(c)
	query.Sort = sort

	items, total, err := h.service.GetExploreFeed(user, query)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.List(c, items, normalizedPageFromQuery(c), normalizedPageSizeFromQuery(c), total)
}
```

同时补充 import：

```go
import "strings"
```

- [ ] **Step 4: 跑 HTTP 测试，确认路由与参数契约通过**

Run:

```bash
go test ./server/internal/modules/feed -run 'TestGetExploreFeed(RejectsInvalidSort|RouteExists)$' -v
```

Expected:

```text
PASS
```

- [ ] **Step 5: 提交 HTTP 契约修复**

```bash
git add server/internal/modules/feed/http.go server/internal/modules/feed/http_test.go
git commit -m "feat(feed): validate explore sort params"
```

---

### Task 3: 收口 FeedRecommendedView 的请求路径与失败态

**Files:**
- Modify: [web/src/views/feed/FeedRecommendedView.vue](/Users/fafa/Downloads/projects/Atoman/web/src/views/feed/FeedRecommendedView.vue:1)
- Create: [web/tests/unit/views/feed/FeedRecommendedView.spec.ts](/Users/fafa/Downloads/projects/Atoman/web/tests/unit/views/feed/FeedRecommendedView.spec.ts:1)

- [ ] **Step 1: 先写前端失败测试，锁定请求路径、排序切换和失败态**

新建 [web/tests/unit/views/feed/FeedRecommendedView.spec.ts](/Users/fafa/Downloads/projects/Atoman/web/tests/unit/views/feed/FeedRecommendedView.spec.ts:1)：

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import FeedRecommendedView from '@/views/feed/FeedRecommendedView.vue'

const fetchMock = vi.fn()

vi.stubGlobal('fetch', fetchMock)

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    token: 'token',
    isAuthenticated: true,
  }),
}))

vi.mock('@/stores/feed', () => ({
  useFeedStore: () => ({
    starredItemIds: new Set<string>(),
    readingListItemIds: new Set<string>(),
    fetchStarredIds: vi.fn(),
    fetchReadingListIds: vi.fn(),
    toggleStar: vi.fn(),
    toggleReadingListItem: vi.fn(),
  }),
}))

vi.mock('@/stores/player', () => ({
  usePlayerStore: () => ({
    currentSong: null,
    isPlaying: false,
    setQueueFromCurrentItems: vi.fn(),
    createPodcastSong: vi.fn(() => null),
    playSong: vi.fn(),
  }),
}))

describe('FeedRecommendedView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    fetchMock.mockReset()
  })

  it('loads feed explore items from the feed explore endpoint', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            type: 'feed_item',
            feed_item: {
              id: 'item-1',
              title: 'Entry',
              link: 'https://example.com/1',
              summary: 'summary',
              published_at: '2026-06-02T00:00:00Z',
              feed_source: { title: 'Example Feed' },
            },
          },
        ],
      }),
    })

    const wrapper = mount(FeedRecommendedView, {
      global: {
        stubs: {
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/api/feed/explore?sort=random', expect.any(Object))
    expect(wrapper.text()).toContain('Entry')
  })

  it('switches to popular sort when the tab is clicked', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    })

    const wrapper = mount(FeedRecommendedView, {
      global: {
        stubs: {
          FeedArticleSheet: true,
        },
      },
    })
    await flushPromises()

    const tabs = wrapper.findAllComponents({ name: 'PaperTab' })
    await tabs[1].vm.$emit('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenLastCalledWith('/api/feed/explore?sort=popular', expect.any(Object))
  })

  it('shows a failure message when the explore request fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'boom' }),
    })

    const wrapper = mount(FeedRecommendedView, {
      global: {
        stubs: {
          FeedArticleSheet: true,
        },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('加载失败，请稍后再试')
  })
})
```

- [ ] **Step 2: 运行前端单测，确认当前路径和失败态都不符合预期**

Run:

```bash
bun run vitest web/tests/unit/views/feed/FeedRecommendedView.spec.ts
```

Expected:

```text
FAIL
```

当前失败点应至少包含：
1. 请求地址还是 `/api/feed/explore/feed`
2. 页面失败时没有出现“加载失败，请稍后再试”

- [ ] **Step 3: 以最小改动补前端状态与正确请求路径**

在 [web/src/views/feed/FeedRecommendedView.vue](/Users/fafa/Downloads/projects/Atoman/web/src/views/feed/FeedRecommendedView.vue:1) 做下面替换：

```ts
const errorMessage = ref('')
```

模板状态区替换为：

```vue
    <div v-if="loading" class="feed-loading">
      <div v-for="i in 5" :key="i" class="a-skeleton feed-skeleton" />
    </div>

    <AEmpty v-else-if="errorMessage" text="加载失败，请稍后再试" :sub="errorMessage" />

    <AEmpty v-else-if="!items.length" text="暂无发现内容" />
```

`fetchExplore` 替换为：

```ts
const fetchExplore = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const res = await fetch(`${API_URL}/feed/explore?sort=${sort.value}`, {
      headers: authHeaders(),
    })

    if (!res.ok) {
      items.value = []
      errorMessage.value = '请稍后重试'
      return
    }

    const d = await res.json()
    items.value = d.data || []
  } catch (e) {
    console.error(e)
    items.value = []
    errorMessage.value = '请稍后重试'
  } finally {
    loading.value = false
  }
}
```

保留 `changeSort()` 现有结构，不额外引入 watcher。

- [ ] **Step 4: 跑前端单测与类型检查**

Run:

```bash
bun run vitest web/tests/unit/views/feed/FeedRecommendedView.spec.ts
bun run type-check
```

Expected:

```text
PASS
```

以及 TypeScript 检查通过。

- [ ] **Step 5: 提交 feed explore 前端收口**

```bash
git add web/src/views/feed/FeedRecommendedView.vue web/tests/unit/views/feed/FeedRecommendedView.spec.ts
git commit -m "feat(feed): wire explore page to live endpoint"
```

---

### Task 4: 做最终联调验证

**Files:**
- Modify: 无
- Verify: 当前工作区

- [ ] **Step 1: 跑后端 feed 模块测试，确认没有回归**

Run:

```bash
go test ./server/internal/modules/feed -v
```

Expected:

```text
PASS
```

- [ ] **Step 2: 跑后端总构建**

Run:

```bash
go build ./...
```

Expected:

```text
退出码 0
```

- [ ] **Step 3: 跑前端目标单测与全量类型检查**

Run:

```bash
bun run vitest web/tests/unit/views/feed/FeedRecommendedView.spec.ts
bun run type-check
```

Expected:

```text
PASS
```

- [ ] **Step 4: 手动验证浏览器页面**

打开：

```text
http://localhost:5173/explore?site=feed
```

检查：

1. 页面不再是静态空壳
2. `随机` 与 `热门` 切换会刷新列表
3. 列表项能显示标题、来源、时间
4. 有音频附件的条目会出现播放按钮
5. 请求失败时出现“加载失败，请稍后再试”

- [ ] **Step 5: 提交最终验证状态**

```bash
git status --short
```

Expected:

```text
只剩本任务相关改动，或工作树干净
```

---

## 自检

### Spec 覆盖

已覆盖的 spec 点：

1. `/explore` 页面从空壳变成真实外部内容流
2. 内容范围只限 `external_rss`
3. `random` 与 `popular` 双模式
4. 前端失败态
5. 对应后端查询接口
6. 参数错误返回 `400`
7. 最小必要验证命令

未纳入本计划的 spec 点：

1. “相同 link 的最小去重”没有单独拆成任务，因为当前 spec 已允许在实现成本偏高时先依赖数据库现状；如果联调中发现明显重复，再补一个小任务即可

### Placeholder 扫描

已检查：

1. 无 `TODO`
2. 无 `TBD`
3. 无“自行实现”类占位词
4. 每个代码步骤都给了实际代码块或明确命令

### 类型一致性

已检查：

1. 后端仍使用 `TimelineItemDTO`
2. 前端仍使用 `TimelineItem`
3. 路径契约统一为 `GET /api/v1/feed/explore`
4. `sort` 统一为 `random | popular`
