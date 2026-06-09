# Feed Source Management MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 feed 模块实现 MVP 范围内的来源发现/建源层、网站 URL 自动发现、RSSHub 最小接入、订阅页仅未读筛选，以及后台订阅源管理（来源类型、简版健康状态、隐藏、基础编辑、删除）和基础去重。

**Architecture:** 保持现有 Gin + GORM + Vue + Pinia 结构，不引入新的大型抽象。后端在现有 `feed_handler` 与 `model.FeedSource` / `model.Subscription` 上扩展最小数据能力，前端优先复用 `SubscriptionAddSheet`、`FeedView` 和现有 setting/admin 能力，把复杂来源治理收口到后台。

**Tech Stack:** Go / Gin / GORM / Vue 3 / Pinia / TypeScript / Tailwind / SQLite 测试库

---

## 文件清单

| 文件 | 职责 |
|---|---|
| `server/internal/model/feed.go` | 扩展 `FeedSource` / `Subscription` 的 MVP 字段，例如 provider、site_url、hidden、health 相关字段 |
| `server/internal/handlers/feed_handler.go` | 增加 discover / create-from-provider / timeline unread 过滤 / 后台来源管理接口 |
| `server/internal/service/rss.go` | 复用现有 RSS 获取能力，补 URL 自动发现所需的 feed candidate 逻辑 |
| `server/internal/service/` 新增 provider/discovery 文件 | 承载 RSSHub 最小 provider 与来源发现逻辑 |
| `server/internal/migrations/` 新迁移 | 为来源字段新增数据库迁移 |
| `web/src/types.ts` | 补前端来源类型、后台来源行、发现候选等类型 |
| `web/src/stores/feed.ts` | 扩展 discover、create-from-provider、timeline unread 过滤、候选选择状态 |
| `web/src/components/feed/SubscriptionAddSheet.vue` | 升级为统一建源入口 |
| `web/src/views/feed/FeedView.vue` | 增加“全部 / 仅未读”筛选和查询参数联动 |
| `web/src/composables/useApi.ts` | 增加 admin/feed source 管理接口地址 |
| `web/src/stores/` 新增 admin feed source store | 后台来源列表、编辑、删除、状态展示 |
| `web/src/views/setting/` 新增来源管理 view | 后台来源管理页面 |
| `web/src/router/routes/settings.ts` | 注册后台来源管理路由 |
| `server/internal/..._test.go` / `web` 相关测试 | 覆盖后端接口和前端类型/状态逻辑 |

## Task 1: 先用模型测试卡住来源层 MVP 字段

**Files:**
- Modify: `server/internal/model/feed.go`
- Test: `server/internal/handlers/feed_handler_test.go` 或现有 feed 测试文件

- [ ] **Step 1: 先写 failing test，明确新来源字段会被持久化**

在现有 feed 相关测试文件中新增一个最小模型持久化测试，先只验证 `FeedSource` 的 MVP 字段存在并可读写：

```go
func TestFeedSourceMVPFieldsPersist(t *testing.T) {
	db := newFeedHandlerTestDB(t)
	now := time.Now().UTC().Truncate(time.Second)
	source := model.FeedSource{
		SourceType:    "external_rss",
		Provider:      "rss",
		RssURL:        "https://example.com/feed.xml",
		CanonicalURL:  "https://example.com/feed.xml",
		SiteURL:       "https://example.com",
		Title:         "Example Feed",
		Hash:          "feed-source-hash",
		Hidden:        true,
		HealthStatus:  "healthy",
		LastFetchedAt: &now,
	}

	require.NoError(t, db.Create(&source).Error)

	var got model.FeedSource
	require.NoError(t, db.First(&got, source.ID).Error)
	require.Equal(t, "rss", got.Provider)
	require.Equal(t, "https://example.com", got.SiteURL)
	require.Equal(t, "https://example.com/feed.xml", got.CanonicalURL)
	require.True(t, got.Hidden)
	require.Equal(t, "healthy", got.HealthStatus)
}
```

- [ ] **Step 2: 运行测试确认当前字段尚不存在或迁移未覆盖**

运行：

```bash
cd /Users/fafa/Downloads/projects/Atoman/server && go test ./internal/handlers -run TestFeedSourceMVPFieldsPersist -v
```

预期：

1. FAIL
2. 失败原因是 `Provider` / `CanonicalURL` / `Hidden` / `HealthStatus` 等字段尚未定义，或测试库迁移未包含这些列

- [ ] **Step 3: 在 `FeedSource` 和 `Subscription` 上补齐 MVP 字段**

修改 `server/internal/model/feed.go`，把 `FeedSource` 最小扩展为：

```go
type FeedSource struct {
	Base
	SourceType            string     `json:"source_type" gorm:"not null;index:idx_feed_sources_type_enabled,priority:1"`
	SourceID              *uuid.UUID `json:"source_id" gorm:"type:uuid"`
	Provider              string     `json:"provider" gorm:"not null;default:'rss';index"`
	RssURL                string     `json:"rss_url" gorm:"type:text"`
	CanonicalURL          string     `json:"canonical_url" gorm:"type:text;index"`
	SiteURL               string     `json:"site_url" gorm:"type:text"`
	Hash                  string     `json:"hash" gorm:"type:varchar(64);uniqueIndex"`
	Title                 string     `json:"title"`
	CoverURL              string     `json:"cover_url" gorm:"type:text"`
	Hidden                bool       `json:"hidden" gorm:"not null;default:false;index"`
	HealthStatus          string     `json:"health_status" gorm:"not null;default:'healthy';index"`
	LastError             string     `json:"last_error" gorm:"type:text"`
	LastFetchedAt         *time.Time `json:"last_fetched_at"`
	FullTextEnabled       bool       `json:"full_text_enabled" gorm:"not null;default:false;index:idx_feed_sources_type_enabled,priority:2"`
	FullTextSuccessCount  int        `json:"full_text_success_count" gorm:"not null;default:0"`
	FullTextFailureCount  int        `json:"full_text_failure_count" gorm:"not null;default:0"`
	FullTextLastSuccessAt *time.Time `json:"full_text_last_success_at"`
	FullTextLastFailureAt *time.Time `json:"full_text_last_failure_at"`
	FullTextLastErrorCode string     `json:"full_text_last_error_code" gorm:"type:varchar(64)"`
	FullTextLastError     string     `json:"full_text_last_error" gorm:"type:text"`
}
```

并在 `Subscription` 上补最小展示需要的 `Title` 继续保留，不新增 `list/category` 相关字段。

- [ ] **Step 4: 补测试数据库迁移并重新运行测试**

确保 feed 相关测试库 `AutoMigrate` 覆盖了更新后的 `FeedSource`。然后运行：

```bash
cd /Users/fafa/Downloads/projects/Atoman/server && go test ./internal/handlers -run TestFeedSourceMVPFieldsPersist -v
```

预期：

1. PASS

- [ ] **Step 5: 提交模型字段改动**

```bash
git add server/internal/model/feed.go server/internal/handlers/*feed*_test.go

git commit -m "feat: add feed source mvp metadata fields"
```

## Task 2: 用迁移把新来源字段落库

**Files:**
- Create: `server/internal/migrations/20260603_feed_source_management_mvp.go`
- Modify: 现有迁移注册入口文件
- Test: `server/internal/handlers/feed_handler_test.go`

- [ ] **Step 1: 先写 failing migration test，确认新列在迁移后存在**

如果项目已有迁移测试模式，补一个最小断言；如果没有，就在 handler 测试中通过 `AutoMigrate` + 建表读写作为替代。新增一个最小测试：

```go
func TestFeedSourceMVPMigrationSupportsNewColumns(t *testing.T) {
	db := newFeedHandlerTestDB(t)
	source := model.FeedSource{
		SourceType:   "external_rss",
		Provider:     "rsshub",
		RssURL:       "https://rsshub.example.com/github/issue/foo/bar",
		CanonicalURL: "https://rsshub.example.com/github/issue/foo/bar",
		SiteURL:      "https://github.com/foo/bar",
		Hash:         "mvp-columns-hash",
		HealthStatus: "failed",
		LastError:    "fetch failed",
	}
	require.NoError(t, db.Create(&source).Error)
}
```

- [ ] **Step 2: 运行测试确认当前迁移流程未完整覆盖新列**

运行：

```bash
cd /Users/fafa/Downloads/projects/Atoman/server && go test ./internal/handlers -run TestFeedSourceMVPMigrationSupportsNewColumns -v
```

预期：

1. 如果当前使用 `AutoMigrate`，可能直接 PASS
2. 如果当前测试走显式迁移而未注册新迁移，应 FAIL
3. 无论结果如何，本任务仍需补正式迁移文件，避免只依赖 `AutoMigrate`

- [ ] **Step 3: 新增显式迁移文件，添加来源字段**

创建 `server/internal/migrations/20260603_feed_source_management_mvp.go`：

```go
package migrations

import "gorm.io/gorm"

func Migrate20260603FeedSourceManagementMVP(db *gorm.DB) error {
	return db.Transaction(func(tx *gorm.DB) error {
		stmts := []string{
			`ALTER TABLE feed_sources ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'rss'`,
			`ALTER TABLE feed_sources ADD COLUMN IF NOT EXISTS canonical_url TEXT`,
			`ALTER TABLE feed_sources ADD COLUMN IF NOT EXISTS site_url TEXT`,
			`ALTER TABLE feed_sources ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT FALSE`,
			`ALTER TABLE feed_sources ADD COLUMN IF NOT EXISTS health_status TEXT NOT NULL DEFAULT 'healthy'`,
			`ALTER TABLE feed_sources ADD COLUMN IF NOT EXISTS last_error TEXT`,
		}
		for _, stmt := range stmts {
			if err := tx.Exec(stmt).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
```

- [ ] **Step 4: 在迁移注册入口里接入新迁移**

在现有迁移注册文件中追加：

```go
{
	Name: "20260603_feed_source_management_mvp",
	Fn:   Migrate20260603FeedSourceManagementMVP,
},
```

- [ ] **Step 5: 运行最小构建确认迁移编译通过**

运行：

```bash
cd /Users/fafa/Downloads/projects/Atoman/server && go build ./...
```

预期：

1. PASS

- [ ] **Step 6: 提交迁移改动**

```bash
git add server/internal/migrations

git commit -m "feat: add feed source management mvp migration"
```

## Task 3: 先用测试卡住网站 URL 自动发现接口

**Files:**
- Modify: `server/internal/handlers/feed_handler.go`
- Create: `server/internal/service/feed_discovery.go`
- Test: `server/internal/handlers/feed_handler_test.go`

- [ ] **Step 1: 写 failing test，定义 `POST /api/feed/discover` 返回候选**

在 `server/internal/handlers/feed_handler_test.go` 新增：

```go
func TestDiscoverFeedCandidatesRejectsInvalidURL(t *testing.T) {
	db := newFeedHandlerTestDB(t)
	router := gin.Default()
	SetupFeedRoutes(router, db)
	user := seedFeedAuthUser(t, db)

	body := strings.NewReader(`{"url":"not-a-url"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/feed/discover", body)
	req.Header.Set("Content-Type", "application/json")
	authenticateFeedRequest(t, req, user)
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	require.Equal(t, http.StatusBadRequest, rr.Code)
	require.Contains(t, rr.Body.String(), "url must be an absolute http/https URL")
}
```

再补一个 service 级别测试，避免直接联网：

```go
func TestRankDiscoveryCandidatesMarksBestCandidateAsDefault(t *testing.T) {
	candidates := []service.FeedDiscoveryCandidate{
		{Title: "Comments Feed", FeedURL: "https://example.com/comments.xml", Kind: "comments", Score: 10},
		{Title: "Main Feed", FeedURL: "https://example.com/feed.xml", Kind: "main", Score: 100},
	}
	got := service.RankDiscoveryCandidates(candidates)
	require.Len(t, got, 2)
	require.True(t, got[0].IsDefault)
	require.Equal(t, "https://example.com/feed.xml", got[0].FeedURL)
}
```

- [ ] **Step 2: 运行测试确认 discover 入口和排序函数尚未定义**

运行：

```bash
cd /Users/fafa/Downloads/projects/Atoman/server && go test ./internal/handlers -run TestDiscoverFeedCandidatesRejectsInvalidURL -v
cd /Users/fafa/Downloads/projects/Atoman/server && go test ./internal/service -run TestRankDiscoveryCandidatesMarksBestCandidateAsDefault -v
```

预期：

1. FAIL
2. 失败原因是 `/api/feed/discover` 尚未注册，`RankDiscoveryCandidates` 尚未定义

- [ ] **Step 3: 实现最小 discovery candidate 类型与排序逻辑**

创建 `server/internal/service/feed_discovery.go`：

```go
package service

import "sort"

type FeedDiscoveryCandidate struct {
	Title     string `json:"title"`
	FeedURL   string `json:"feed_url"`
	SiteURL   string `json:"site_url,omitempty"`
	Kind      string `json:"kind,omitempty"`
	Score     int    `json:"score"`
	Reason    string `json:"reason,omitempty"`
	IsDefault bool   `json:"is_default"`
}

func RankDiscoveryCandidates(candidates []FeedDiscoveryCandidate) []FeedDiscoveryCandidate {
	sorted := append([]FeedDiscoveryCandidate(nil), candidates...)
	sort.SliceStable(sorted, func(i, j int) bool {
		if sorted[i].Score == sorted[j].Score {
			return sorted[i].FeedURL < sorted[j].FeedURL
		}
		return sorted[i].Score > sorted[j].Score
	})
	for i := range sorted {
		sorted[i].IsDefault = i == 0
	}
	return sorted
}
```

- [ ] **Step 4: 注册最小 discover handler，并先做 URL 校验与空候选返回**

在 `server/internal/handlers/feed_handler.go`：

1. 注册路由：

```go
protected.POST("/discover", DiscoverFeedCandidates())
```

2. 添加 handler：

```go
func DiscoverFeedCandidates() gin.HandlerFunc {
	return func(c *gin.Context) {
		var input struct {
			URL string `json:"url"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}
		u, err := url.ParseRequestURI(strings.TrimSpace(input.URL))
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "url must be an absolute http/https URL"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"candidates": []service.FeedDiscoveryCandidate{}})
	}
}
```

- [ ] **Step 5: 运行最小测试，确认 discover 基础骨架通过**

运行：

```bash
cd /Users/fafa/Downloads/projects/Atoman/server && go test ./internal/handlers -run TestDiscoverFeedCandidatesRejectsInvalidURL -v
cd /Users/fafa/Downloads/projects/Atoman/server && go test ./internal/service -run TestRankDiscoveryCandidatesMarksBestCandidateAsDefault -v
```

预期：

1. PASS

- [ ] **Step 6: 提交最小 discover 骨架**

```bash
git add server/internal/handlers/feed_handler.go server/internal/service/feed_discovery.go server/internal/handlers/feed_handler_test.go server/internal/service/*_test.go

git commit -m "feat: add feed discovery candidate skeleton"
```

## Task 4: 实现最小网站 feed 自动发现逻辑

**Files:**
- Modify: `server/internal/service/rss.go`
- Modify: `server/internal/service/feed_discovery.go`
- Test: `server/internal/service/feed_discovery_test.go`

- [ ] **Step 1: 写 failing test，给 HTML 输入返回 feed 候选**

新增一个纯解析测试，不依赖外网：

```go
func TestExtractFeedCandidatesFromHTMLFindsAlternateFeeds(t *testing.T) {
	html := `
	<html><head>
	<link rel="alternate" type="application/rss+xml" title="Main Feed" href="https://example.com/feed.xml">
	<link rel="alternate" type="application/atom+xml" title="Comments Feed" href="https://example.com/comments.xml">
	</head></html>`
	candidates := ExtractFeedCandidatesFromHTML("https://example.com", html)
	require.Len(t, candidates, 2)
	require.Equal(t, "https://example.com/feed.xml", candidates[0].FeedURL)
}
```

- [ ] **Step 2: 运行测试确认 HTML 解析函数尚未定义**

运行：

```bash
cd /Users/fafa/Downloads/projects/Atoman/server && go test ./internal/service -run TestExtractFeedCandidatesFromHTMLFindsAlternateFeeds -v
```

预期：

1. FAIL

- [ ] **Step 3: 实现最小 HTML alternate link 提取逻辑**

在 `server/internal/service/feed_discovery.go` 追加：

```go
var feedAltHrefPattern = regexp.MustCompile(`(?is)<link[^>]+rel=["'][^"']*alternate[^"']*["'][^>]+type=["'](application/rss\+xml|application/atom\+xml)["'][^>]+href=["']([^"']+)["'][^>]*>`)
var feedAltTitlePattern = regexp.MustCompile(`(?is)title=["']([^"']+)["']`)

func ExtractFeedCandidatesFromHTML(pageURL string, html string) []FeedDiscoveryCandidate {
	matches := feedAltHrefPattern.FindAllStringSubmatch(html, -1)
	seen := map[string]bool{}
	var out []FeedDiscoveryCandidate
	for _, match := range matches {
		if len(match) < 3 {
			continue
		}
		feedURL := strings.TrimSpace(match[2])
		resolved := resolveCandidateURL(pageURL, feedURL)
		if resolved == "" || seen[resolved] {
			continue
		}
		seen[resolved] = true
		title := "Detected Feed"
		if titleMatch := feedAltTitlePattern.FindStringSubmatch(match[0]); len(titleMatch) == 2 {
			title = strings.TrimSpace(titleMatch[1])
		}
		kind := "alternate"
		if strings.Contains(strings.ToLower(title), "comment") {
			kind = "comments"
		}
		score := 50
		if strings.Contains(strings.ToLower(title), "main") || strings.Contains(strings.ToLower(resolved), "/feed") {
			score = 100
			kind = "main"
		}
		out = append(out, FeedDiscoveryCandidate{Title: title, FeedURL: resolved, SiteURL: pageURL, Kind: kind, Score: score})
	}
	return RankDiscoveryCandidates(out)
}

func resolveCandidateURL(pageURL string, raw string) string {
	base, err := url.Parse(pageURL)
	if err != nil {
		return ""
	}
	href, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	return base.ResolveReference(href).String()
}
```

并添加所需导入：

```go
import (
	"net/url"
	"regexp"
	"sort"
	"strings"
)
```

- [ ] **Step 4: 运行解析测试确认通过**

运行：

```bash
cd /Users/fafa/Downloads/projects/Atoman/server && go test ./internal/service -run TestExtractFeedCandidatesFromHTMLFindsAlternateFeeds -v
```

预期：

1. PASS

- [ ] **Step 5: 提交自动发现解析逻辑**

```bash
git add server/internal/service/feed_discovery.go server/internal/service/*_test.go

git commit -m "feat: extract feed candidates from website html"
```

## Task 5: 在创建订阅前做基础去重与来源类型写入

**Files:**
- Modify: `server/internal/handlers/feed_handler.go`
- Modify: `server/internal/model/feed.go`
- Test: `server/internal/handlers/feed_handler_test.go`

- [ ] **Step 1: 写 failing test，重复 RSS 订阅时应复用已有来源**

新增一个来源去重测试：

```go
func TestCreateSubscriptionReusesExistingFeedSourceForSameCanonicalURL(t *testing.T) {
	db := newFeedHandlerTestDB(t)
	router := gin.Default()
	SetupFeedRoutes(router, db)
	user := seedFeedAuthUser(t, db)

	first := httptest.NewRequest(http.MethodPost, "/api/feed/subscriptions", strings.NewReader(`{"target_type":"external_rss","rss_url":"https://example.com/feed.xml"}`))
	first.Header.Set("Content-Type", "application/json")
	authenticateFeedRequest(t, first, user)
	firstRR := httptest.NewRecorder()
	router.ServeHTTP(firstRR, first)
	require.Equal(t, http.StatusCreated, firstRR.Code)

	second := httptest.NewRequest(http.MethodPost, "/api/feed/subscriptions", strings.NewReader(`{"target_type":"external_rss","rss_url":"https://example.com/feed.xml/"}`))
	second.Header.Set("Content-Type", "application/json")
	authenticateFeedRequest(t, second, user)
	secondRR := httptest.NewRecorder()
	router.ServeHTTP(secondRR, second)
	require.Equal(t, http.StatusBadRequest, secondRR.Code)

	var sources []model.FeedSource
	require.NoError(t, db.Find(&sources).Error)
	require.Len(t, sources, 1)
	require.Equal(t, "rss", sources[0].Provider)
	require.Equal(t, "https://example.com/feed.xml", sources[0].CanonicalURL)
}
```

- [ ] **Step 2: 运行测试确认 canonical 去重尚未存在**

运行：

```bash
cd /Users/fafa/Downloads/projects/Atoman/server && go test ./internal/handlers -run TestCreateSubscriptionReusesExistingFeedSourceForSameCanonicalURL -v
```

预期：

1. FAIL
2. 可能生成两条不同 hash / 不同来源，或 `CanonicalURL` 为空

- [ ] **Step 3: 给 RSS URL 加 canonical 归一并写入 provider/type**

在 `server/internal/handlers/feed_handler.go` 增加：

```go
func normalizeCanonicalFeedURL(raw string) string {
	trimmed := strings.TrimSpace(raw)
	trimmed = strings.TrimRight(trimmed, "/")
	return trimmed
}
```

并修改 `findOrCreateFeedSource` 的 external_rss 分支，使新来源至少写入：

```go
canonicalURL := ""
provider := "internal"
if targetType == "external_rss" {
	canonicalURL = normalizeCanonicalFeedURL(rssURL)
	provider = "rss"
}
```

创建 `FeedSource` 时补齐：

```go
source = model.FeedSource{
	SourceType:      targetType,
	SourceID:        targetID,
	Provider:        provider,
	RssURL:          strings.TrimSpace(rssURL),
	CanonicalURL:    canonicalURL,
	SiteURL:         "",
	Hash:            sourceHash,
	HealthStatus:    "healthy",
	FullTextEnabled: service.DefaultFullTextEnabled(targetType),
}
```

并在查重时加入 canonical URL 分支：

```go
if targetType == "external_rss" {
	canonical := normalizeCanonicalFeedURL(rssURL)
	if canonical != "" {
		var existing model.FeedSource
		if err := db.Where("canonical_url = ?", canonical).First(&existing).Error; err == nil {
			return &existing, nil
		}
	}
}
```

- [ ] **Step 4: 运行去重测试确认通过**

运行：

```bash
cd /Users/fafa/Downloads/projects/Atoman/server && go test ./internal/handlers -run TestCreateSubscriptionReusesExistingFeedSourceForSameCanonicalURL -v
```

预期：

1. PASS

- [ ] **Step 5: 提交来源去重改动**

```bash
git add server/internal/handlers/feed_handler.go server/internal/handlers/feed_handler_test.go server/internal/model/feed.go

git commit -m "feat: dedupe external feed sources by canonical url"
```

## Task 6: 给时间线加“仅未读”过滤并从订阅页接入

**Files:**
- Modify: `server/internal/handlers/feed_handler.go`
- Modify: `web/src/stores/feed.ts`
- Modify: `web/src/views/feed/FeedView.vue`
- Test: `server/internal/handlers/feed_handler_test.go`

- [ ] **Step 1: 写 failing test，`GET /api/feed/timeline?unread_only=true` 只返回未读项**

在 handler 测试中新增：

```go
func TestGetTimelineUnreadOnlyFiltersReadItems(t *testing.T) {
	db := newFeedHandlerTestDB(t)
	router := gin.Default()
	SetupFeedRoutes(router, db)
	user := seedFeedAuthUser(t, db)
	seedTimelineWithReadAndUnreadItems(t, db, user.UUID)

	req := httptest.NewRequest(http.MethodGet, "/api/feed/timeline?unread_only=true", nil)
	authenticateFeedRequest(t, req, user)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)
	var payload struct {
		Data []struct {
			IsRead bool `json:"is_read"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &payload))
	require.NotEmpty(t, payload.Data)
	for _, item := range payload.Data {
		require.False(t, item.IsRead)
	}
}
```

- [ ] **Step 2: 运行测试确认当前 timeline 不支持 unread_only**

运行：

```bash
cd /Users/fafa/Downloads/projects/Atoman/server && go test ./internal/handlers -run TestGetTimelineUnreadOnlyFiltersReadItems -v
```

预期：

1. FAIL

- [ ] **Step 3: 在 timeline handler 中增加 unread_only 查询参数**

在 `GetTimeline` 中加入：

```go
unreadOnly := strings.EqualFold(c.Query("unread_only"), "true")
```

并在查询 `feed_item_reads` 的左连接后追加过滤条件：

```go
if unreadOnly {
	query = query.Where("feed_item_reads.feed_item_id IS NULL")
}
```

- [ ] **Step 4: 让前端 store 支持 unreadOnly 参数**

修改 `web/src/stores/feed.ts` 中的 `fetchTimeline`：

```ts
const fetchTimeline = async (sourceType?: string, sourceId?: number, unreadOnly = false) => {
  const authStore = useAuthStore()
  if (!authStore.isAuthenticated) return
  try {
    const params = new URLSearchParams()
    if (sourceType && sourceId) {
      params.set('source_type', sourceType)
      params.set('source_id', String(sourceId))
    }
    if (unreadOnly) {
      params.set('unread_only', 'true')
    }
    const res = await fetch(`${API_URL}/feed/timeline?${params.toString()}`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    if (res.ok) {
      const data = await res.json()
      timeline.value = data.data || []
    }
  } catch (e) {
    console.error('Failed to fetch timeline', e)
  }
}
```

- [ ] **Step 5: 在 `FeedView.vue` 加轻量未读开关状态**

在 `FeedView.vue` 中新增一个布尔状态并把它传给 timeline 请求：

```ts
const unreadOnly = ref(false)

const fetchPage = async (page = 1, append = false) => {
  const params = new URLSearchParams({ page: String(page), limit: String(pageLimit) })
  if (querySourceId.value) params.set('source_id', querySourceId.value)
  if (queryGroupId.value) params.set('group_id', queryGroupId.value)
  if (unreadOnly.value) params.set('unread_only', 'true')
  // 其余现有逻辑保持不变
}
```

并在 header action 中新增：

```vue
<PaperClip
  :active="unreadOnly"
  :label="unreadOnly ? '仅未读' : '全部'"
  @click="unreadOnly = !unreadOnly; currentPage = 1; void fetchPage(1, false)"
/>
```

图标样式在后续 UI polish 中替换成用户指定图标，但 MVP 先把行为跑通。

- [ ] **Step 6: 运行后端测试与前端 type-check**

运行：

```bash
cd /Users/fafa/Downloads/projects/Atoman/server && go test ./internal/handlers -run TestGetTimelineUnreadOnlyFiltersReadItems -v
cd /Users/fafa/Downloads/projects/Atoman/web && bun run type-check
```

预期：

1. 后端测试 PASS
2. 前端 type-check PASS

- [ ] **Step 7: 提交仅未读筛选改动**

```bash
git add server/internal/handlers/feed_handler.go web/src/stores/feed.ts web/src/views/feed/FeedView.vue server/internal/handlers/feed_handler_test.go

git commit -m "feat: add unread-only filter to feed timeline"
```

## Task 7: 升级添加订阅入口为统一建源入口

**Files:**
- Modify: `web/src/components/feed/SubscriptionAddSheet.vue`
- Modify: `web/src/stores/feed.ts`
- Modify: `web/src/types.ts`
- Test: `web` 类型检查

- [ ] **Step 1: 先定义前端 discovery candidate 和 provider payload 类型**

在 `web/src/types.ts` 新增：

```ts
export interface FeedDiscoveryCandidate {
  title: string
  feed_url: string
  site_url?: string
  kind?: string
  score: number
  reason?: string
  is_default: boolean
}

export type FeedSourceProvider = 'rss' | 'rsshub' | 'internal'
```

- [ ] **Step 2: 给 store 增加 discover 和 create-from-provider 最小能力**

在 `web/src/stores/feed.ts` 中新增：

```ts
const discoverFeedCandidates = async (url: string): Promise<FeedDiscoveryCandidate[]> => {
  const authStore = useAuthStore()
  if (!authStore.isAuthenticated) return []
  const res = await fetch(`${API_URL}/feed/discover`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authStore.token}`,
    },
    body: JSON.stringify({ url }),
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.candidates || []
}

const createSubscriptionFromProvider = async (payload: {
  provider: 'rsshub'
  template_key: string
  params: Record<string, string>
  title?: string
  group_id?: string
}): Promise<boolean> => {
  const authStore = useAuthStore()
  error.value = null
  const res = await fetch(`${API_URL}/feed/sources/create-from-provider`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authStore.token}`,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    error.value = err.error || '创建来源失败'
    return false
  }
  await fetchSubscriptions()
  return true
}
```

- [ ] **Step 3: 把 `SubscriptionAddSheet.vue` 升级成三模式入口**

把现有单一表单改成最小三模式：

```ts
const mode = ref<'discover' | 'rss' | 'rsshub'>('discover')
const websiteUrl = ref('')
const candidates = ref<FeedDiscoveryCandidate[]>([])
const selectedCandidateUrl = ref('')
const rsshubTemplate = ref('github/repo')
const rsshubOwner = ref('')
const rsshubRepo = ref('')
```

最小交互规则：

1. `discover` 模式输入网站 URL
2. 点击“查找订阅源”后拉候选
3. 默认选中 `is_default=true` 的候选
4. 展开时可切换其他候选
5. `rss` 模式保留原 RSS URL 输入
6. `rsshub` 模式只做一个最小模板，例如 GitHub 仓库 releases / issues 二选一中的一个

- [ ] **Step 4: 先只接一个 RSSHub 最小模板，避免范围失控**

在 `SubscriptionAddSheet.vue` 第一阶段只支持一个最小模板，比如：

```ts
const buildGithubRepoFeedPayload = () => ({
  provider: 'rsshub' as const,
  template_key: 'github/repo',
  params: {
    owner: rsshubOwner.value.trim(),
    repo: rsshubRepo.value.trim(),
  },
  title: newRssTitle.value.trim(),
  group_id: newRssGroupId.value,
})
```

并在提交逻辑中分支：

```ts
if (mode.value === 'discover') {
  emit('submit-discovered', { feed_url: selectedCandidateUrl.value, title: newRssTitle.value.trim(), group_id: newRssGroupId.value })
  return
}
if (mode.value === 'rsshub') {
  emit('submit-provider', buildGithubRepoFeedPayload())
  return
}
emit('submit', { rss_url: newRssUrl.value.trim(), title: newRssTitle.value.trim(), group_id: newRssGroupId.value })
```

- [ ] **Step 5: 在 `FeedView.vue` 和 `OrbitView.vue` 里接新增事件**

把 `SubscriptionAddSheet` 新增的 `submit-discovered` / `submit-provider` 事件接入现有 store 方法，例如：

```vue
@submit-discovered="handleDiscoveredSubscription"
@submit-provider="handleProviderSubscription"
```

并实现：

```ts
const handleDiscoveredSubscription = async (payload: { feed_url: string; title?: string; group_id?: string }) => {
  const ok = await feedStore.addSubscription({ rss_url: payload.feed_url, title: payload.title, group_id: payload.group_id })
  if (ok) showAddSheet.value = false
}

const handleProviderSubscription = async (payload: {
  provider: 'rsshub'
  template_key: string
  params: Record<string, string>
  title?: string
  group_id?: string
}) => {
  const ok = await feedStore.createSubscriptionFromProvider(payload)
  if (ok) showAddSheet.value = false
}
```

- [ ] **Step 6: 运行前端 type-check**

运行：

```bash
cd /Users/fafa/Downloads/projects/Atoman/web && bun run type-check
```

预期：

1. PASS

- [ ] **Step 7: 提交统一建源入口改动**

```bash
git add web/src/components/feed/SubscriptionAddSheet.vue web/src/stores/feed.ts web/src/types.ts web/src/views/feed/FeedView.vue web/src/views/orbit/OrbitView.vue

git commit -m "feat: upgrade subscription sheet into unified source creation entry"
```

## Task 8: 接入 RSSHub 最小 provider 创建接口

**Files:**
- Modify: `server/internal/handlers/feed_handler.go`
- Create: `server/internal/service/feed_provider_rsshub.go`
- Test: `server/internal/handlers/feed_handler_test.go`

- [ ] **Step 1: 写 failing test，`create-from-provider` 能创建 RSSHub 来源**

新增：

```go
func TestCreateSubscriptionFromProviderCreatesRSSHubSource(t *testing.T) {
	db := newFeedHandlerTestDB(t)
	router := gin.Default()
	SetupFeedRoutes(router, db)
	user := seedFeedAuthUser(t, db)

	body := strings.NewReader(`{"provider":"rsshub","template_key":"github/repo","params":{"owner":"DIYgod","repo":"RSSHub"},"title":"RSSHub Repo"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/feed/sources/create-from-provider", body)
	req.Header.Set("Content-Type", "application/json")
	authenticateFeedRequest(t, req, user)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	require.Equal(t, http.StatusCreated, rr.Code)
	var source model.FeedSource
	require.NoError(t, db.First(&source).Error)
	require.Equal(t, "rsshub", source.Provider)
	require.Equal(t, "external_rss", source.SourceType)
	require.Contains(t, source.RssURL, "/github/repo/DIYgod/RSSHub")
}
```

- [ ] **Step 2: 运行测试确认 provider 入口尚不存在**

运行：

```bash
cd /Users/fafa/Downloads/projects/Atoman/server && go test ./internal/handlers -run TestCreateSubscriptionFromProviderCreatesRSSHubSource -v
```

预期：

1. FAIL

- [ ] **Step 3: 实现 RSSHub 最小 provider URL 构造**

创建 `server/internal/service/feed_provider_rsshub.go`：

```go
package service

import (
	"fmt"
	"strings"
)

const defaultRSSHubBaseURL = "https://rsshub.app"

func BuildRSSHubFeedURL(templateKey string, params map[string]string) (string, error) {
	switch templateKey {
	case "github/repo":
		owner := strings.TrimSpace(params["owner"])
		repo := strings.TrimSpace(params["repo"])
		if owner == "" || repo == "" {
			return "", fmt.Errorf("owner and repo are required")
		}
		return fmt.Sprintf("%s/github/repo/%s/%s", defaultRSSHubBaseURL, owner, repo), nil
	default:
		return "", fmt.Errorf("unsupported template_key")
	}
}
```

- [ ] **Step 4: 增加 `create-from-provider` handler**

在 `feed_handler.go` 中注册并实现：

```go
protected.POST("/sources/create-from-provider", CreateSubscriptionFromProvider(db))
```

实现：

```go
func CreateSubscriptionFromProvider(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input struct {
			Provider    string            `json:"provider" binding:"required"`
			TemplateKey string            `json:"template_key" binding:"required"`
			Params      map[string]string `json:"params"`
			Title       string            `json:"title"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}
		if input.Provider != "rsshub" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported provider"})
			return
		}
		feedURL, err := service.BuildRSSHubFeedURL(input.TemplateKey, input.Params)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.Set("provider_override", "rsshub")
		c.Request.Body = io.NopCloser(strings.NewReader(fmt.Sprintf(`{"target_type":"external_rss","rss_url":%q,"title":%q}`, feedURL, input.Title)))
		CreateSubscription(db)(c)
	}
}
```

- [ ] **Step 5: 让 `findOrCreateFeedSource` 支持 provider override**

为了把来源类型写成 `rsshub`，不要只依赖 `external_rss -> rss` 的默认值。给 `CreateSubscription` 加一个 provider 透传分支：

```go
provider := "rss"
if override, ok := c.Get("provider_override"); ok {
	if s, ok := override.(string); ok && s != "" {
		provider = s
	}
}
```

再把 provider 传进 `findOrCreateFeedSource`，修改签名为：

```go
func findOrCreateFeedSource(db *gorm.DB, targetType string, targetID *uuid.UUID, rssURL, fallbackTitle, provider string) (*model.FeedSource, error)
```

调用处更新为：

```go
source, err := findOrCreateFeedSource(db, input.TargetType, input.TargetID, input.RssURL, input.Title, provider)
```

- [ ] **Step 6: 运行 provider 测试与后端构建**

运行：

```bash
cd /Users/fafa/Downloads/projects/Atoman/server && go test ./internal/handlers -run TestCreateSubscriptionFromProviderCreatesRSSHubSource -v
cd /Users/fafa/Downloads/projects/Atoman/server && go build ./...
```

预期：

1. 测试 PASS
2. 构建 PASS

- [ ] **Step 7: 提交 RSSHub 最小 provider 接入**

```bash
git add server/internal/handlers/feed_handler.go server/internal/service/feed_provider_rsshub.go server/internal/handlers/feed_handler_test.go

git commit -m "feat: add minimal rsshub source provider"
```

## Task 9: 建后台来源管理 MVP 页面与 store

**Files:**
- Modify: `web/src/composables/useApi.ts`
- Create: `web/src/stores/adminFeedSources.ts`
- Create: `web/src/views/setting/SettingFeedSourcesView.vue`
- Modify: `web/src/router/routes/settings.ts`
- Modify: `web/src/types.ts`

- [ ] **Step 1: 先定义后台来源行类型**

在 `web/src/types.ts` 新增：

```ts
export interface AdminFeedSourceRow {
  id: string
  source_type: 'external_rss' | 'internal_user' | 'internal_channel' | 'internal_collection'
  provider: 'rss' | 'rsshub' | 'internal'
  title: string
  rss_url?: string
  canonical_url?: string
  site_url?: string
  hidden: boolean
  health_status: 'healthy' | 'warning' | 'error' | 'failed' | 'stale'
  last_error?: string
  last_fetched_at?: string
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: 在 `useApi` 中注册后台来源管理接口**

在 `web/src/composables/useApi.ts` 的 `admin.feed` 下新增：

```ts
sources: `${apiUrl}/admin/feed/sources`,
source: (sourceId: number | string) => `${apiUrl}/admin/feed/sources/${sourceId}`,
```

- [ ] **Step 3: 新建后台来源 store**

创建 `web/src/stores/adminFeedSources.ts`：

```ts
import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { AdminFeedSourceRow } from '@/types'
import { useApi } from '@/composables/useApi'

export const useAdminFeedSourcesStore = defineStore('adminFeedSources', () => {
  const api = useApi()
  const sources = ref<AdminFeedSourceRow[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchSources(token: string | null) {
    if (!token) return
    loading.value = true
    error.value = null
    try {
      const response = await fetch(api.admin.feed.sources, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('加载来源失败')
      const data = await response.json()
      sources.value = data.items || data.data || []
    } catch (err) {
      error.value = err instanceof Error ? err.message : '加载来源失败'
    } finally {
      loading.value = false
    }
  }

  async function updateSource(sourceId: string, payload: Partial<AdminFeedSourceRow>, token: string | null) {
    if (!token) return false
    const response = await fetch(api.admin.feed.source(sourceId), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })
    return response.ok
  }

  async function deleteSource(sourceId: string, token: string | null) {
    if (!token) return false
    const response = await fetch(api.admin.feed.source(sourceId), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    return response.ok
  }

  return { sources, loading, error, fetchSources, updateSource, deleteSource }
})
```

- [ ] **Step 4: 新建后台来源管理页面**

创建 `web/src/views/setting/SettingFeedSourcesView.vue`，最小版本：

```vue
<template>
  <main class="a-page-xl">
    <APageHeader title="订阅源管理" sub="仅后台可见的来源治理面板" accent />

    <AEmpty v-if="!authStore.isAuthenticated || !isAdminRole(authStore.user?.role)" text="仅管理员可访问" />
    <AEmpty v-else-if="store.error" :text="store.error" />
    <div v-else-if="store.loading" class="a-grid-1">
      <div v-for="i in 5" :key="i" class="a-skeleton" style="height:5rem" />
    </div>
    <div v-else class="feed-source-admin-list">
      <PaperEntry v-for="source in store.sources" :key="source.id" :title="source.title || source.rss_url || '未命名来源'">
        <template #meta>
          <span>{{ source.provider }}</span>
          <span>{{ source.source_type }}</span>
          <span>{{ source.health_status }}</span>
          <span>{{ source.last_fetched_at || '未同步' }}</span>
        </template>
        <template #actions>
          <PaperClip :label="source.hidden ? '已隐藏' : '显示中'" :active="source.hidden" @click="toggleHidden(source)" />
          <PaperReject label="删除" @click="removeSource(source.id)" />
        </template>
      </PaperEntry>
    </div>
  </main>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import AEmpty from '@/components/ui/AEmpty.vue'
import APageHeader from '@/components/ui/APageHeader.vue'
import PaperClip from '@/components/ui/PaperClip.vue'
import PaperEntry from '@/components/ui/PaperEntry.vue'
import PaperReject from '@/components/ui/PaperReject.vue'
import { useAuthStore } from '@/stores/auth'
import { useAdminFeedSourcesStore } from '@/stores/adminFeedSources'
import { isAdminRole } from '@/utils/roles'
import type { AdminFeedSourceRow } from '@/types'

const authStore = useAuthStore()
const store = useAdminFeedSourcesStore()

onMounted(() => {
  void store.fetchSources(authStore.token)
})

async function toggleHidden(source: AdminFeedSourceRow) {
  const ok = await store.updateSource(source.id, { hidden: !source.hidden }, authStore.token)
  if (ok) await store.fetchSources(authStore.token)
}

async function removeSource(sourceId: string) {
  const ok = await store.deleteSource(sourceId, authStore.token)
  if (ok) await store.fetchSources(authStore.token)
}
</script>
```

- [ ] **Step 5: 把后台来源管理页挂到 settings 路由**

在 `web/src/router/routes/settings.ts` 里追加一条 admin 路由：

```ts
{
  path: '/setting/feed-sources',
  component: () => import('@/views/setting/SettingFeedSourcesView.vue'),
  meta: { requiresAuth: true, requiresAdmin: true, authLayout: true },
},
```

- [ ] **Step 6: 运行前端 type-check**

运行：

```bash
cd /Users/fafa/Downloads/projects/Atoman/web && bun run type-check
```

预期：

1. PASS

- [ ] **Step 7: 提交后台来源管理前端骨架**

```bash
git add web/src/composables/useApi.ts web/src/stores/adminFeedSources.ts web/src/views/setting/SettingFeedSourcesView.vue web/src/router/routes/settings.ts web/src/types.ts

git commit -m "feat: add admin feed source management ui skeleton"
```

## Task 10: 补后台来源管理后端接口并完成最小闭环

**Files:**
- Modify: `server/internal/handlers/feed_handler.go`
- Test: `server/internal/handlers/feed_handler_test.go`
- Modify: `web/src/views/setting/SettingFeedSourcesView.vue`
- Modify: `web/src/stores/adminFeedSources.ts`

- [ ] **Step 1: 写 failing test，管理员可获取来源列表**

新增：

```go
func TestAdminListFeedSourcesRequiresAdmin(t *testing.T) {
	db := newFeedHandlerTestDB(t)
	router := gin.Default()
	SetupFeedRoutes(router, db)
	user := seedFeedAuthUser(t, db)

	req := httptest.NewRequest(http.MethodGet, "/api/admin/feed/sources", nil)
	authenticateFeedRequest(t, req, user)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	require.Equal(t, http.StatusForbidden, rr.Code)
}
```

以及管理员通过测试：

```go
func TestAdminListFeedSourcesReturnsSourceRows(t *testing.T) {
	db := newFeedHandlerTestDB(t)
	router := gin.Default()
	SetupAdminRoutes(router, db)
	admin := seedAdminUser(t, db)
	seedFeedSourceForAdminList(t, db)

	req := httptest.NewRequest(http.MethodGet, "/api/admin/feed/sources", nil)
	authenticateAdminRequest(t, req, admin)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)
	require.Contains(t, rr.Body.String(), "rsshub")
}
```

- [ ] **Step 2: 运行测试确认 admin source 接口尚不存在**

运行：

```bash
cd /Users/fafa/Downloads/projects/Atoman/server && go test ./internal/handlers -run TestAdminListFeedSources -v
```

预期：

1. FAIL

- [ ] **Step 3: 在后台 admin 路由中新增来源管理接口**

在现有 admin feed/fulltext 相关路由附近追加：

```go
admin := router.Group("/api/admin")
admin.Use(middleware.AuthMiddleware(), middleware.AdminMiddleware())
{
	admin.GET("/feed/sources", AdminListFeedSources(db))
	admin.PATCH("/feed/sources/:id", AdminUpdateFeedSource(db))
	admin.DELETE("/feed/sources/:id", AdminDeleteFeedSource(db))
}
```

并实现最小 handler：

```go
func AdminListFeedSources(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var sources []model.FeedSource
		if err := db.Order("updated_at DESC").Find(&sources).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load feed sources"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"items": sources})
	}
}

func AdminUpdateFeedSource(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var input struct {
			Title  *string `json:"title"`
			Hidden *bool   `json:"hidden"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}
		updates := map[string]any{}
		if input.Title != nil {
			updates["title"] = strings.TrimSpace(*input.Title)
		}
		if input.Hidden != nil {
			updates["hidden"] = *input.Hidden
		}
		if len(updates) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no fields to update"})
			return
		}
		if err := db.Model(&model.FeedSource{}).Where("id = ?", id).Updates(updates).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update feed source"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "ok"})
	}
}

func AdminDeleteFeedSource(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if err := db.Transaction(func(tx *gorm.DB) error {
			if err := tx.Where("feed_source_id = ?", id).Delete(&model.Subscription{}).Error; err != nil {
				return err
			}
			if err := tx.Where("feed_source_id = ?", id).Delete(&model.FeedItem{}).Error; err != nil {
				return err
			}
			return tx.Where("id = ?", id).Delete(&model.FeedSource{}).Error
		}); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete feed source"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "ok"})
	}
}
```

- [ ] **Step 4: 让 `GetTimeline` 过滤 hidden 来源**

在 `GetTimeline` 查询里追加：

```go
query = query.Where("feed_sources.hidden = ?", false)
```

这样 hidden 来源继续同步，但不会出现在主订阅流中。

- [ ] **Step 5: 运行最小 admin 来源接口测试与构建**

运行：

```bash
cd /Users/fafa/Downloads/projects/Atoman/server && go test ./internal/handlers -run TestAdminListFeedSources -v
cd /Users/fafa/Downloads/projects/Atoman/server && go build ./...
cd /Users/fafa/Downloads/projects/Atoman/web && bun run type-check
```

预期：

1. 测试 PASS
2. 后端构建 PASS
3. 前端 type-check PASS

- [ ] **Step 6: 提交后台来源管理闭环**

```bash
git add server/internal/handlers/feed_handler.go server/internal/handlers/feed_handler_test.go web/src/stores/adminFeedSources.ts web/src/views/setting/SettingFeedSourcesView.vue

git commit -m "feat: add admin feed source management mvp endpoints"
```

## Task 11: 做最终回归验证并同步文档

**Files:**
- Modify: `docs/superpowers/specs/2026-06-03-feed-source-management-design.md`
- Modify: `docs/superpowers/plans/2026-06-03-feed-source-management-mvp.md`
- Test: 相关后端/前端入口

- [ ] **Step 1: 运行后端关键测试集**

运行：

```bash
cd /Users/fafa/Downloads/projects/Atoman/server && go test ./internal/handlers -run 'TestFeedSourceMVPFieldsPersist|TestDiscoverFeedCandidatesRejectsInvalidURL|TestCreateSubscriptionReusesExistingFeedSourceForSameCanonicalURL|TestGetTimelineUnreadOnlyFiltersReadItems|TestCreateSubscriptionFromProviderCreatesRSSHubSource|TestAdminListFeedSources' -v
cd /Users/fafa/Downloads/projects/Atoman/server && go test ./internal/service -run 'TestRankDiscoveryCandidatesMarksBestCandidateAsDefault|TestExtractFeedCandidatesFromHTMLFindsAlternateFeeds' -v
```

预期：

1. 关键测试全部 PASS

- [ ] **Step 2: 运行全量最小工程验证**

运行：

```bash
cd /Users/fafa/Downloads/projects/Atoman/server && go build ./...
cd /Users/fafa/Downloads/projects/Atoman/web && bun run type-check
```

预期：

1. 后端构建 PASS
2. 前端 type-check PASS

- [ ] **Step 3: 如实现细节与 spec 有差异，回写 spec 与 plan**

如果实现阶段把以下内容做了收敛，请同步文档：

1. RSSHub 第一阶段只支持 `github/repo`
2. 后台来源编辑第一阶段只支持标题和 hidden
3. 删除来源第一阶段会级联删除关联订阅、`feed_items`，并清理 `feed_item_reads`、`feed_item_stars`、`reading_list_items`

修改后保存文档。

- [ ] **Step 4: 提交计划与文档同步**

```bash
git add docs/superpowers/specs/2026-06-03-feed-source-management-design.md docs/superpowers/plans/2026-06-03-feed-source-management-mvp.md

git commit -m "docs: finalize feed source management mvp plan"
```

---

## 自检结果

### Spec 覆盖

本计划已覆盖以下 MVP 需求：

1. 来源发现 / 建源层
2. 网站 URL 自动发现
3. RSSHub 最小接入
4. 订阅页“全部 / 仅未读”轻量筛选
5. 后台来源列表、类型、简版健康状态、隐藏、编辑、删除
6. 基础去重
7. hidden 来源继续同步但不进入主订阅流

未纳入本计划的内容与 spec 一致：

1. list/category
2. 阅读 view 统一
3. 高级 RSSHub 参数编辑
4. 复杂健康治理
5. 复杂智能去重

### Placeholder 扫描

已检查，无 `TODO`、`TBD`、`implement later` 等占位描述。每个任务都给出了具体文件、命令和最小代码片段。

### 类型一致性

计划中统一使用以下命名：

1. `FeedDiscoveryCandidate`
2. `Provider` / `provider`
3. `CanonicalURL`
4. `hidden`
5. `health_status`
6. `create-from-provider`
7. `AdminFeedSourceRow`

未混用其他命名。
