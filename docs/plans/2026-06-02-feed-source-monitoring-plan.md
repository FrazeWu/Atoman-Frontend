# Feed Source Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把后台订阅源管理升级成“监控优先单页”，支持全局统一抓取间隔、源级失败状态、右侧条目抽屉和更顺手的人工处理流程。

**Architecture:** 后端分两条线补能力：一条给 `feed source` 增加源级抓取状态与全局抓取配置，另一条复用现有全文抓取管理接口补“按源查看条目”。前端保留设置页入口，但把 `SettingFeedSourcePanel` 从轻量表单升级成“左侧监控列表 + 右侧 PaperSheet 抽屉”的后台工作台。

**Tech Stack:** Vue 3.5、Pinia、TypeScript、Go、Gin、GORM、PostgreSQL、Vitest

---

## File Map

**Backend**
- Modify: `server/internal/model/feed.go`
  - 为 `FeedSource` 增加源级抓取状态字段，例如最近抓取状态、最近抓取错误、连续失败次数。
- Modify: `server/internal/service/rss_cron.go`
  - 接入全局抓取配置，记录源级抓取成功/失败状态。
- Modify: `server/internal/service/site_access.go`
  - 复用现有 `site_settings` 结构，为 feed 增加全局自动抓取开关与统一间隔。
- Modify: `server/internal/handlers/admin_handler.go`
  - 扩展订阅源列表返回字段、增加全局配置读写接口、增加按源查看条目接口的默认排序/过滤支持。
- Modify: `server/internal/handlers/admin_feed_fulltext_test.go`
  - 补充源级状态、全局配置、按源条目排序的测试。
- Create or Modify: `server/internal/service/rss_cron_test.go`
  - 增加源级状态更新与全局间隔配置行为测试。
- Modify: `docs/api-v1.md`
  - 同步后台监控台相关 API 契约。

**Frontend**
- Modify: `web/src/stores/adminFeedFulltext.ts`
  - 增加全局配置、源详情、右侧抽屉所需的筛选和按源条目拉取能力。
- Modify: `web/src/composables/useApi.ts`
  - 增加 feed source 监控台配置接口与按源条目接口映射。
- Modify: `web/src/types.ts`
  - 补充源级抓取状态、失败信息、连续失败次数、全局配置类型。
- Modify: `web/src/components/setting/SettingFeedSourcePanel.vue`
  - 重构为“顶部总控 + 左侧监控列表 + 右侧抽屉”。
- Create: `web/src/components/setting/SettingFeedSourceItemsSheet.vue`
  - 右侧抽屉，展示某个源的条目与异常详情。
- Modify: `web/tests/unit/components/setting/SettingFeedSourcePanel.spec.ts`
  - 补充监控列表、编辑 UX、右侧抽屉联动测试。
- Create: `web/tests/unit/components/setting/SettingFeedSourceItemsSheet.spec.ts`
  - 覆盖失败优先、状态展示、手动重试等行为。

## Task 1: 扩展站点设置，承载全局抓取总控

**Files:**
- Modify: `server/internal/service/site_access.go`
- Modify: `server/internal/service/site_access_test.go`
- Modify: `web/src/config/siteAccess.ts`
- Modify: `web/tests/unit/config/siteAccess.spec.ts`

- [ ] **Step 1: 先写后端站点设置测试，定义 feed 全局总控结构**

```go
func TestSiteAccessServiceSupportsFeedAutoSyncSettings(t *testing.T) {
	db := newSiteAccessTestDB(t)
	svc := NewSiteAccessService(db)

	input := SiteAccessMatrixInput{
		Version: SiteAccessPayloadVersion,
		Settings: &SiteAccessSettingsInput{
			Feed: &SiteAccessFeedSettingsInput{
				AutoSyncEnabled:         boolPtr(false),
				AutoSyncIntervalMinutes: intPtr(30),
			},
		},
	}

	if err := svc.SaveInput(input); err != nil {
		t.Fatalf("save input: %v", err)
	}

	matrix, err := svc.Load()
	if err != nil {
		t.Fatalf("load matrix: %v", err)
	}

	if matrix.Settings.Feed.AutoSyncEnabled != false {
		t.Fatalf("expected auto_sync_enabled=false, got %v", matrix.Settings.Feed.AutoSyncEnabled)
	}
	if matrix.Settings.Feed.AutoSyncIntervalMinutes != 30 {
		t.Fatalf("expected interval=30, got %d", matrix.Settings.Feed.AutoSyncIntervalMinutes)
	}
}
```

- [ ] **Step 2: 跑测试确认当前失败**

Run: `cd server && go test ./internal/service -run TestSiteAccessServiceSupportsFeedAutoSyncSettings -v`

Expected: FAIL，提示 `AutoSyncEnabled` 或 `AutoSyncIntervalMinutes` 未定义。

- [ ] **Step 3: 最小实现后端 feed 全局总控字段**

```go
type SiteAccessFeedSettings struct {
	AllowManageSources       bool   `json:"allow_manage_sources"`
	AllowAddSource           bool   `json:"allow_add_source"`
	FullTextMode             string `json:"full_text_mode"`
	AutoSyncEnabled          bool   `json:"auto_sync_enabled"`
	AutoSyncIntervalMinutes  int    `json:"auto_sync_interval_minutes"`
}

type SiteAccessFeedSettingsInput struct {
	AllowManageSources       *bool   `json:"allow_manage_sources"`
	AllowAddSource           *bool   `json:"allow_add_source"`
	FullTextMode             *string `json:"full_text_mode"`
	AutoSyncEnabled          *bool   `json:"auto_sync_enabled"`
	AutoSyncIntervalMinutes  *int    `json:"auto_sync_interval_minutes"`
}
```

```go
Feed: SiteAccessFeedSettings{
	AllowManageSources:      true,
	AllowAddSource:          true,
	FullTextMode:            SiteAccessFeedFullTextModePerSource,
	AutoSyncEnabled:         true,
	AutoSyncIntervalMinutes: 15,
},
```

- [ ] **Step 4: 补上保存/校验/前端默认值**

```ts
feed: {
  full_text_mode: 'per_source',
  auto_sync_enabled: true,
  auto_sync_interval_minutes: 15,
}
```

- [ ] **Step 5: 重新运行测试确认通过**

Run: `cd server && go test ./internal/service -run TestSiteAccessServiceSupportsFeedAutoSyncSettings -v`

Expected: PASS

- [ ] **Step 6: 跑前端配置测试确认结构同步**

Run: `cd web && bun run test:unit -- tests/unit/config/siteAccess.spec.ts`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add server/internal/service/site_access.go server/internal/service/site_access_test.go web/src/config/siteAccess.ts web/tests/unit/config/siteAccess.spec.ts
git commit -m "feat: add feed auto sync settings"
```

## Task 2: 给 FeedSource 增加源级抓取状态

**Files:**
- Modify: `server/internal/model/feed.go`
- Modify: `server/internal/service/rss_cron.go`
- Test: `server/internal/service/rss_cron_test.go`

- [ ] **Step 1: 先写源级抓取状态测试**

```go
func TestSyncSingleRSSRecordsSourceFailureState(t *testing.T) {
	db := newFullTextWorkerTestDB(t)
	source := model.FeedSource{
		SourceType: "external_rss",
		Hash:       "sync-failure-source",
		RssURL:     "https://127.0.0.1.invalid/feed.xml",
		Title:      "Broken Source",
	}
	if err := db.Create(&source).Error; err != nil {
		t.Fatalf("create source: %v", err)
	}

	SyncSingleRSS(db, source)

	var got model.FeedSource
	if err := db.First(&got, "id = ?", source.ID).Error; err != nil {
		t.Fatalf("reload source: %v", err)
	}

	if got.LastFetchStatus != "failed" {
		t.Fatalf("expected failed status, got %s", got.LastFetchStatus)
	}
	if got.ConsecutiveFetchFailures != 1 {
		t.Fatalf("expected consecutive failures=1, got %d", got.ConsecutiveFetchFailures)
	}
	if got.LastFetchError == "" {
		t.Fatal("expected last fetch error")
	}
}
```

- [ ] **Step 2: 跑测试确认当前失败**

Run: `cd server && go test ./internal/service -run TestSyncSingleRSSRecordsSourceFailureState -v`

Expected: FAIL，提示字段未定义或行为不存在。

- [ ] **Step 3: 在 FeedSource 上增加最小状态字段**

```go
LastFetchStatus         string     `json:"last_fetch_status" gorm:"type:varchar(24);not null;default:'idle'"`
LastFetchErrorCode      string     `json:"last_fetch_error_code" gorm:"type:varchar(64)"`
LastFetchError          string     `json:"last_fetch_error" gorm:"type:text"`
LastFetchFailureAt      *time.Time `json:"last_fetch_failure_at"`
ConsecutiveFetchFailures int       `json:"consecutive_fetch_failures" gorm:"not null;default:0"`
```

- [ ] **Step 4: 在 `SyncSingleRSS` 和批量抓取里记录成功/失败状态**

```go
if err != nil {
	now := time.Now()
	db.Model(&src).Updates(map[string]any{
		"last_fetch_status":          "failed",
		"last_fetch_error_code":      "rss_fetch_failed",
		"last_fetch_error":           err.Error(),
		"last_fetch_failure_at":      &now,
		"consecutive_fetch_failures": gorm.Expr("consecutive_fetch_failures + 1"),
	})
	return
}
```

```go
db.Model(&src).Updates(map[string]any{
	"last_fetched_at":             now,
	"last_fetch_status":           "success",
	"last_fetch_error_code":       "",
	"last_fetch_error":            "",
	"last_fetch_failure_at":       nil,
	"consecutive_fetch_failures":  0,
})
```

- [ ] **Step 5: 重新运行测试确认通过**

Run: `cd server && go test ./internal/service -run TestSyncSingleRSSRecordsSourceFailureState -v`

Expected: PASS

- [ ] **Step 6: 跑已有 RSS 相关测试避免回归**

Run: `cd server && go test ./internal/service -run 'TestSyncSingleRSS|TestSync.*RSS' -v`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add server/internal/model/feed.go server/internal/service/rss_cron.go server/internal/service/rss_cron_test.go
git commit -m "feat: record feed source sync status"
```

## Task 3: 扩展后台接口，提供监控台数据

**Files:**
- Modify: `server/internal/handlers/admin_handler.go`
- Modify: `server/internal/handlers/admin_feed_fulltext_test.go`
- Modify: `docs/api-v1.md`

- [ ] **Step 1: 先写订阅源列表扩展字段测试**

```go
func TestGetAdminFeedFullTextSourcesIncludesSourceFailureFields(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := newAdminFeedFullTextTestDB(t)
	now := time.Now().UTC().Truncate(time.Second)

	source := model.FeedSource{
		SourceType:              "external_rss",
		Hash:                    "source-status-row",
		RssURL:                  "https://example.com/feed.xml",
		Title:                   "Example Feed",
		LastFetchStatus:         "failed",
		LastFetchErrorCode:      "rss_fetch_failed",
		LastFetchError:          "timeout",
		LastFetchFailureAt:      &now,
		ConsecutiveFetchFailures: 3,
	}
	if err := db.Create(&source).Error; err != nil {
		t.Fatalf("create source: %v", err)
	}

	r := gin.New()
	r.GET("/api/admin/feed/fulltext/sources", GetAdminFeedFullTextSources(db))

	req := httptest.NewRequest(http.MethodGet, "/api/admin/feed/fulltext/sources", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}

	var payload struct {
		Data []struct {
			LastFetchStatus          string    `json:"last_fetch_status"`
			LastFetchErrorCode       string    `json:"last_fetch_error_code"`
			LastFetchError           string    `json:"last_fetch_error"`
			LastFetchFailureAt       time.Time `json:"last_fetch_failure_at"`
			ConsecutiveFetchFailures int       `json:"consecutive_fetch_failures"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode payload: %v", err)
	}
	if len(payload.Data) != 1 {
		t.Fatalf("expected 1 row, got %d", len(payload.Data))
	}
	if payload.Data[0].LastFetchStatus != "failed" || payload.Data[0].ConsecutiveFetchFailures != 3 {
		t.Fatalf("unexpected source failure fields: %+v", payload.Data[0])
	}
}
```

- [ ] **Step 2: 补全全局配置接口测试**

```go
func TestGetAndUpdateAdminFeedSourceSettings(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := newAdminFeedFullTextTestDB(t)
	require.NoError(t, service.NewSiteAccessService(db).SaveInput(service.SiteAccessMatrixInput{
		Version: service.SiteAccessPayloadVersion,
		Settings: &service.SiteAccessSettingsInput{
			Feed: &service.SiteAccessFeedSettingsInput{
				AutoSyncEnabled:         boolPtr(false),
				AutoSyncIntervalMinutes: intPtr(45),
			},
		},
	}))
}
```

- [ ] **Step 3: 跑测试确认失败**

Run: `cd server && go test ./internal/handlers -run 'TestGetAdminFeedFullTextSourcesIncludesSourceFailureFields|TestGetAndUpdateAdminFeedSourceSettings' -v`

Expected: FAIL，缺少字段或接口。

- [ ] **Step 4: 扩展源列表行和配置接口**

```go
type adminFeedFullTextSourceRow struct {
	ID                       uuid.UUID  `json:"id"`
	Title                    string     `json:"title"`
	RssURL                   string     `json:"rss_url"`
	FullTextEnabled          bool       `json:"full_text_enabled"`
	LastFetchStatus          string     `json:"last_fetch_status"`
	LastFetchErrorCode       string     `json:"last_fetch_error_code"`
	LastFetchError           string     `json:"last_fetch_error"`
	LastFetchFailureAt       *time.Time `json:"last_fetch_failure_at"`
	ConsecutiveFetchFailures int        `json:"consecutive_fetch_failures"`
	...
}
```

```go
feedFullText.GET("/settings", GetAdminFeedSourceMonitorSettings(db))
feedFullText.PUT("/settings", UpdateAdminFeedSourceMonitorSettings(db))
```

- [ ] **Step 5: 为按源条目视图固定失败优先排序**

```go
orderBy := `
CASE
  WHEN feed_items.full_text_status = 'failed' THEN 0
  WHEN feed_items.full_text_status = 'retry' THEN 1
  WHEN feed_items.full_text_status = 'pending' THEN 2
  WHEN feed_items.full_text_status = 'fetching' THEN 3
  ELSE 4
END,
feed_items.published_at DESC
`
```

- [ ] **Step 6: 更新 API 契约**

```md
#### GET /api/admin/feed/fulltext/settings
#### PUT /api/admin/feed/fulltext/settings
```

- [ ] **Step 7: 重新运行 handlers 测试确认通过**

Run: `cd server && go test ./internal/handlers -run 'TestGetAdminFeedFullTextSourcesIncludesSourceFailureFields|TestGetAndUpdateAdminFeedSourceSettings|TestGetAdminFeedFullTextItemsFilters' -v`

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add server/internal/handlers/admin_handler.go server/internal/handlers/admin_feed_fulltext_test.go docs/api-v1.md
git commit -m "feat: expose feed source monitoring data"
```

## Task 4: 扩展前端 store 和类型，承载监控台数据

**Files:**
- Modify: `web/src/stores/adminFeedFulltext.ts`
- Modify: `web/src/composables/useApi.ts`
- Modify: `web/src/types.ts`

- [ ] **Step 1: 先写 store 行为测试骨架**

```ts
it('fetches monitor settings and source items with failed-first filters', async () => {
  // mock fetch responses
  // expect fetchMonitorSettings / fetchItems to use new endpoints and filters
})
```

- [ ] **Step 2: 跑相关前端测试确认当前失败**

Run: `cd web && bun run test:unit -- tests/unit/components/setting/SettingFeedSourcePanel.spec.ts`

Expected: FAIL，缺少新类型或方法。

- [ ] **Step 3: 补充前端类型**

```ts
export interface FeedSource {
  ...
  last_fetch_status?: 'idle' | 'success' | 'failed'
  last_fetch_error_code?: string
  last_fetch_error?: string
  last_fetch_failure_at?: string
  consecutive_fetch_failures?: number
}

export interface FeedSourceMonitorSettings {
  auto_sync_enabled: boolean
  auto_sync_interval_minutes: number
}
```

- [ ] **Step 4: 扩展 API 映射与 store 方法**

```ts
settings: `${apiUrl}/admin/feed/fulltext/settings`,
```

```ts
async function fetchMonitorSettings(token: string | null) { ... }
async function updateMonitorSettings(payload: FeedSourceMonitorSettings, token: string | null) { ... }
```

- [ ] **Step 5: 重新运行测试确认通过**

Run: `cd web && bun run test:unit -- tests/unit/components/setting/SettingFeedSourcePanel.spec.ts`

Expected: PASS 或进入下一阶段页面行为失败。

- [ ] **Step 6: Commit**

```bash
git add web/src/stores/adminFeedFulltext.ts web/src/composables/useApi.ts web/src/types.ts
git commit -m "feat: add feed source monitoring store"
```

## Task 5: 实现右侧条目抽屉

**Files:**
- Create: `web/src/components/setting/SettingFeedSourceItemsSheet.vue`
- Test: `web/tests/unit/components/setting/SettingFeedSourceItemsSheet.spec.ts`

- [ ] **Step 1: 先写抽屉组件测试**

```ts
it('shows source summary and sorts failed items first', async () => {
  // mount sheet with mixed item statuses
  // expect failed item rendered before success item
})
```

```ts
it('emits retry action for failed item', async () => {
  // click retry button
  // expect emit or store call
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd web && bun run test:unit -- tests/unit/components/setting/SettingFeedSourceItemsSheet.spec.ts`

Expected: FAIL，组件不存在。

- [ ] **Step 3: 用 `PaperSheet` 实现右侧抽屉**

```vue
<PaperSheet
  :show="show"
  side="right"
  title="SOURCE ITEMS"
  @close="$emit('close')"
>
  <section class="sheet-summary">
    <strong>{{ source.title }}</strong>
    <p>{{ source.rss_url }}</p>
    <p>最近失败：{{ source.last_fetch_error || '无' }}</p>
  </section>
</PaperSheet>
```

- [ ] **Step 4: 在抽屉里实现“失败优先”的条目列表与重试按钮**

```ts
const orderedItems = computed(() => [...props.items].sort((a, b) => {
  const rank = { failed: 0, retry: 1, pending: 2, fetching: 3, success: 4 }
  return rank[a.full_text_status] - rank[b.full_text_status]
})
```

- [ ] **Step 5: 重新运行测试确认通过**

Run: `cd web && bun run test:unit -- tests/unit/components/setting/SettingFeedSourceItemsSheet.spec.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add web/src/components/setting/SettingFeedSourceItemsSheet.vue web/tests/unit/components/setting/SettingFeedSourceItemsSheet.spec.ts
git commit -m "feat: add feed source items sheet"
```

## Task 6: 重构设置页订阅源管理为监控台

**Files:**
- Modify: `web/src/components/setting/SettingFeedSourcePanel.vue`
- Modify: `web/tests/unit/components/setting/SettingFeedSourcePanel.spec.ts`

- [ ] **Step 1: 先写新行为测试**

```ts
it('shows monitor settings above source list', async () => {
  // expect auto sync toggle and interval select
})
```

```ts
it('opens right sheet when clicking a source row', async () => {
  // click source row
  // expect SettingFeedSourceItemsSheet visible
})
```

```ts
it('moves editing into selected source context and highlights current row', async () => {
  // click edit on row
  // expect row highlighted and editor state visible
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd web && bun run test:unit -- tests/unit/components/setting/SettingFeedSourcePanel.spec.ts`

Expected: FAIL，页面结构还没改。

- [ ] **Step 3: 把顶部表单重构成“总控区 + 列表区”**

```vue
<section class="setting-feed-panel__monitor-settings">
  <label>
    <span>自动抓取</span>
    <input v-model="monitorSettings.auto_sync_enabled" type="checkbox" />
  </label>
</section>
```

- [ ] **Step 4: 把订阅源列表改成整行可点击，并显示异常字段**

```vue
<button
  type="button"
  class="setting-feed-panel__row"
  :class="{ 'is-active': selectedSourceId === source.id, 'is-failing': source.last_fetch_status === 'failed' }"
  @click="openSource(source)"
>
```

- [ ] **Step 5: 接入右侧抽屉和局部条目加载**

```ts
const selectedSourceId = ref('')
const showItemsSheet = ref(false)

async function openSource(source: FeedSource) {
  selectedSourceId.value = source.id
  showItemsSheet.value = true
  await adminFeedFulltextStore.fetchItems(authStore.token, {
    sourceId: source.id,
    status: undefined,
    limit: 50,
  })
}
```

- [ ] **Step 6: 修复当前编辑 UX**

```ts
function startEdit(source: FeedSource) {
  editingId.value = source.id
  selectedSourceId.value = source.id
  draft.value = { title: source.title || '', rssUrl: source.rss_url || '' }
  sourceEditorRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
```

- [ ] **Step 7: 优化手工爬取反馈，避免整页跳动**

```ts
await adminFeedFulltextStore.syncSource(sourceId, authStore.token)
message.value = '已开始手工爬取'
await Promise.all([
  adminFeedFulltextStore.fetchSources(authStore.token, { limit: 100 }),
  selectedSourceId.value === sourceId
    ? adminFeedFulltextStore.fetchItems(authStore.token, { sourceId, limit: 50 })
    : Promise.resolve(),
])
```

- [ ] **Step 8: 重新运行面板与设置页测试**

Run: `cd web && bun run test:unit -- tests/unit/components/setting/SettingFeedSourcePanel.spec.ts tests/unit/views/setting/SettingAccessView.spec.ts`

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add web/src/components/setting/SettingFeedSourcePanel.vue web/tests/unit/components/setting/SettingFeedSourcePanel.spec.ts
git commit -m "feat: redesign feed source monitoring panel"
```

## Task 7: 全量验证与联调

**Files:**
- Verify only

- [ ] **Step 1: 跑后端相关测试**

Run: `cd server && go test ./internal/service ./internal/handlers -run 'Feed|SiteAccess' -v`

Expected: PASS

- [ ] **Step 2: 跑后端构建**

Run: `cd server && go build ./...`

Expected: exit 0

- [ ] **Step 3: 跑前端相关单测**

Run: `cd web && bun run test:unit -- tests/unit/config/siteAccess.spec.ts tests/unit/components/setting/SettingFeedSourcePanel.spec.ts tests/unit/components/setting/SettingFeedSourceItemsSheet.spec.ts tests/unit/views/setting/SettingAccessView.spec.ts`

Expected: PASS

- [ ] **Step 4: 跑前端类型检查**

Run: `cd web && bun run type-check`

Expected: exit 0

- [ ] **Step 5: 浏览器联调**

Run in browser:
- 打开 `http://127.0.0.1:4173/setting/access`
- 确认顶部有自动抓取开关和统一间隔
- 点击异常源，右侧抽屉打开
- 抽屉里失败条目排在成功条目前
- 手工爬取后只局部刷新，不丢失当前阅读位置

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: build feed source monitoring workspace"
```
