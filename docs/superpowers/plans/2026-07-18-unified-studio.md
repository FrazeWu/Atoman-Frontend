# 统一创作中心实施计划

> **面向执行代理：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务执行，并使用复选框跟踪步骤。

**目标：** 建立唯一的 `/studio` 创作中心，以一个全局当前频道统一管理博客、播客和视频，并完成 Dashboard、内容与合集管理、数据、互动、设置和编辑器闭环。

**架构：** 后端新增独立 `studio` 领域，统一频道状态和 Studio 查询协议，博客、播客、视频仍各自负责内容写入和消费 API。前端新增独立 Studio 壳层和共享管理组件，删除三个模块旧创作入口；合集按频道和模块分型，并嵌入内容管理页。

**技术栈：** Go、Gin、GORM、PostgreSQL、Swagger、Vue 3、TypeScript、Pinia、Vue Router、Vitest、Playwright。

---

## 执行约束

- 设计依据：`Atoman-Frontend/docs/superpowers/specs/2026-07-18-unified-studio-design.md`。
- 当前前端工作区存在大量无关改动，执行前必须使用 `superpowers:using-git-worktrees` 创建隔离工作区。
- 不修改 `Atoman-iOS`。
- 不保留旧 Studio 路由、旧默认频道 API 或旧创作者统计 API 的兼容层。
- 迁移必须保留现有频道、合集、内容和订阅关系。
- 每个任务只提交该任务列出的文件，不带入工作区其他修改。

## 文件结构

后端：

- `Atoman-Backend/internal/model/feed.go`：移除频道模块类型，给合集增加模块类型。
- `Atoman-Backend/internal/model/studio.go`：Studio 当前频道、模块设置和指标事件模型。
- `Atoman-Backend/internal/migrations/unified_studio.go`：保留数据并迁移统一频道语义。
- `Atoman-Backend/internal/modules/studio/`：Studio 状态、频道、合集、Dashboard、内容、数据、互动和设置 API。
- `Atoman-Backend/internal/modules/blog/`、`internal/handlers/podcast_handler.go`、`internal/handlers/video_handler.go`：内容写入校验和指标事件接入。
- `Atoman-Backend/internal/modules/feed/`：去除频道类型假设，保持用户关注和频道订阅的全量更新语义。
- `Atoman-Backend/internal/app/router.go`：注册 `/api/v1/studio`。
- `Atoman-Backend/docs/`：同步 Swagger。

前端：

- `Atoman-Frontend/src/views/studio/StudioLayout.vue`：Studio 壳层。
- `Atoman-Frontend/src/views/studio/StudioDashboardView.vue`：三模块单页 Dashboard。
- `Atoman-Frontend/src/views/studio/StudioModuleLayout.vue`：模块二级导航。
- `Atoman-Frontend/src/views/studio/StudioContentView.vue`：内容管理与合集筛选。
- `Atoman-Frontend/src/views/studio/StudioAnalyticsView.vue`：数据中心。
- `Atoman-Frontend/src/views/studio/StudioInteractionsView.vue`：互动管理。
- `Atoman-Frontend/src/views/studio/StudioSettingsView.vue`：创作设置。
- `Atoman-Frontend/src/views/studio/StudioChannelView.vue`：频道设置。
- `Atoman-Frontend/src/components/studio/`：Dashboard 区块、内容表格、合集侧边面板和频道选择器。
- `Atoman-Frontend/src/stores/studio.ts`：Studio 状态和请求。
- `Atoman-Frontend/src/router/routes/studio.ts`：唯一 Studio 路由树。

---

### 任务 1：迁移统一频道、合集类型和 Studio 状态

**文件：**

- 修改：`Atoman-Backend/internal/model/feed.go`
- 新建：`Atoman-Backend/internal/model/studio.go`
- 新建：`Atoman-Backend/internal/migrations/unified_studio.go`
- 新建：`Atoman-Backend/internal/migrations/unified_studio_test.go`
- 修改：`Atoman-Backend/cmd/migrate/main.go`
- 修改：`Atoman-Backend/cmd/migrate/main_test.go`

- [ ] **步骤 1：先写迁移失败测试**

```go
func TestRunUnifiedStudioMigrationPreservesChannelsCollectionsAndContent(t *testing.T)
func TestRunUnifiedStudioMigrationBackfillsCollectionContentType(t *testing.T)
func TestRunUnifiedStudioMigrationSelectsOneCurrentChannelPerUser(t *testing.T)
func TestRunUnifiedStudioMigrationDoesNotMergeChannelsWithSameOwner(t *testing.T)
```

断言旧频道和内容原 ID 不变、合集类型从旧频道回填、当前频道按博客/播客/视频/最早频道的顺序选择，而且不同旧频道不自动合并。

- [ ] **步骤 2：运行测试确认失败**

```bash
cd /root/Atoman/Atoman-Backend
go test ./internal/migrations -run 'TestRunUnifiedStudioMigration' -count=1
```

预期：因模型和迁移函数不存在而失败。

- [ ] **步骤 3：定义新模型**

`internal/model/feed.go` 先给合集增加模块类型。为保证本任务提交后仍可编译，旧 `Channel.ContentType`、`Channel.IsDefault` 和 `UserDefaultChannel` 暂时保留，并在任务 2 删除：

```go
type Collection struct {
	Base
	ChannelID   uuid.UUID  `json:"channel_id" gorm:"type:uuid;not null;index;uniqueIndex:idx_collection_channel_type_name,priority:1"`
	Channel     *Channel   `json:"channel,omitempty" gorm:"foreignKey:ChannelID"`
	ContentType string     `json:"content_type" gorm:"type:varchar(16);not null;index;uniqueIndex:idx_collection_channel_type_name,priority:2"`
	CreatedBy   *uuid.UUID `json:"created_by,omitempty" gorm:"type:uuid;index"`
	Name        string     `json:"name" gorm:"not null;uniqueIndex:idx_collection_channel_type_name,priority:3"`
	Description string     `json:"description" gorm:"type:text"`
	CoverURL    string     `json:"cover_url" gorm:"type:text"`
	IsDefault   bool       `json:"is_default" gorm:"default:false;index"`
}
```

`internal/model/studio.go`：

```go
type UserStudioState struct {
	UserID    uuid.UUID  `json:"user_id" gorm:"type:uuid;primaryKey"`
	ChannelID *uuid.UUID `json:"channel_id,omitempty" gorm:"type:uuid;index"`
	Channel   *Channel   `json:"channel,omitempty" gorm:"foreignKey:ChannelID"`
}

type StudioModuleSettings struct {
	Base
	UserID               uuid.UUID  `json:"user_id" gorm:"type:uuid;not null;uniqueIndex:idx_studio_settings_scope,priority:1"`
	ChannelID            uuid.UUID  `json:"channel_id" gorm:"type:uuid;not null;uniqueIndex:idx_studio_settings_scope,priority:2"`
	ContentType          string     `json:"content_type" gorm:"type:varchar(16);not null;uniqueIndex:idx_studio_settings_scope,priority:3"`
	DefaultCollectionID  *uuid.UUID `json:"default_collection_id,omitempty" gorm:"type:uuid;index"`
	DefaultVisibility    string     `json:"default_visibility" gorm:"not null;default:'public'"`
	DefaultPublishStatus string     `json:"default_publish_status" gorm:"not null;default:'published'"`
	AutoplayEnabled      bool       `json:"autoplay_enabled" gorm:"not null;default:false"`
}
```

- [ ] **步骤 4：实现可重复运行的迁移**

`RunUnifiedStudioMigration` 在事务内完成：增加并回填合集类型、创建 Studio 状态和设置表、选择初始频道、重建合集唯一索引。迁移开始时检查列和表是否存在，确保重复执行结果不变；旧表和旧字段等 API 切换完成后在任务 2 删除。

- [ ] **步骤 5：注册迁移并通过测试**

```go
if err := migrations.RunUnifiedStudioMigration(db); err != nil {
	return fmt.Errorf("unified studio migration: %w", err)
}
```

```bash
cd /root/Atoman/Atoman-Backend
go test ./internal/migrations -run 'TestRunUnifiedStudioMigration' -count=1
go test ./cmd/migrate -run 'TestRunMigrations' -count=1
```

预期：全部通过。

- [ ] **步骤 6：提交**

```bash
git -C /root/Atoman/Atoman-Backend add internal/model/feed.go internal/model/studio.go internal/migrations/unified_studio.go internal/migrations/unified_studio_test.go cmd/migrate/main.go cmd/migrate/main_test.go
git -C /root/Atoman/Atoman-Backend commit -m "feat(studio): unify channel and collection models"
```

---

### 任务 2：实现 Studio 状态、频道和合集 API

**文件：**

- 新建：`Atoman-Backend/internal/modules/studio/dto.go`
- 新建：`Atoman-Backend/internal/modules/studio/repo.go`
- 新建：`Atoman-Backend/internal/modules/studio/service.go`
- 新建：`Atoman-Backend/internal/modules/studio/http.go`
- 新建：`Atoman-Backend/internal/modules/studio/http_test.go`
- 修改：`Atoman-Backend/internal/app/router.go`
- 修改：`Atoman-Backend/internal/app/router_test.go`
- 修改：`Atoman-Backend/internal/model/feed.go`
- 修改：`Atoman-Backend/internal/migrations/unified_studio.go`
- 修改：`Atoman-Backend/internal/migrations/unified_studio_test.go`
- 修改：`Atoman-Backend/internal/handlers/user_handler.go`
- 修改：`Atoman-Backend/internal/handlers/user_handler_test.go`
- 修改：`Atoman-Backend/internal/service/user_bootstrap_service.go`
- 修改：`Atoman-Backend/internal/service/owner_bootstrap_service_test.go`
- 修改：`Atoman-Backend/internal/handlers/auth_handler_test.go`
- 修改：`Atoman-Backend/cmd/migrate/main.go`
- 修改：`Atoman-Backend/cmd/migrate/main_test.go`
- 删除：`Atoman-Backend/internal/migrations/channel_default_selection.go`
- 删除：`Atoman-Backend/internal/migrations/channel_default_selection_test.go`

- [ ] **步骤 1：写路由和权限失败测试**

```go
func TestStudioStateReturnsCurrentChannelAndOwnedChannels(t *testing.T)
func TestStudioStatePatchRejectsForeignChannel(t *testing.T)
func TestStudioChannelCreateBecomesCurrentWhenStateIsEmpty(t *testing.T)
func TestStudioChannelDeleteRejectsNonEmptyChannel(t *testing.T)
func TestStudioCollectionsAreScopedByChannelAndModule(t *testing.T)
func TestStudioCollectionMutationRejectsWrongModule(t *testing.T)
```

- [ ] **步骤 2：运行测试确认失败**

```bash
cd /root/Atoman/Atoman-Backend
go test ./internal/modules/studio -count=1
```

预期：包不存在。

- [ ] **步骤 3：定义 DTO 和模块校验**

```go
type Module string

const (
	ModuleBlog Module = "blog"
	ModulePodcast Module = "podcast"
	ModuleVideo Module = "video"
)

type StateResponse struct {
	CurrentChannel *ChannelSummary  `json:"current_channel"`
	Channels       []ChannelSummary `json:"channels"`
}

type PutStateInput struct {
	ChannelID uuid.UUID `json:"channel_id" binding:"required"`
}
```

`ParseModule` 只接受三个常量，其他值返回 `400`。

- [ ] **步骤 4：实现服务规则**

- 状态只返回自有频道，切换时校验所有权。
- 创建首个频道后自动写入当前频道状态。
- 非空频道删除返回 `409`。
- 合集查询和增删改都以 `channel_id + content_type` 为范围。
- 删除合集时清理内容关联，并清空引用它的默认合集设置。

- [ ] **步骤 5：移除旧默认频道能力**

- 从 `SetupUserRoutes` 删除 `/me/default-channels` 两个路由及对应处理器和 DTO。
- 删除 `model.UserDefaultChannel`；`Channel.ContentType` 和 `Channel.IsDefault` 留到任务 3 在全部调用方切换后删除。
- `unified_studio.go` 使用文件内私有 legacy 结构读取旧表，然后删除旧 `user_default_channels` 表；频道旧字段在任务 3 删除。
- 从 `runMigrations` 删除 `RunChannelDefaultSelectionMigration` 调用，并删除该旧迁移文件。
- 增加测试确认旧默认频道路由为 `404`，Studio 状态只返回一个当前频道。
- 将用户初始化改为创建一个用户名频道、一个 `UserStudioState` 和博客/播客/视频三个默认合集，不再创建三套频道选择。

- [ ] **步骤 6：注册 API**

```go
func RegisterRoutes(group *gin.RouterGroup, service *Service) {
	group.Use(middleware.AuthMiddleware())
	group.GET("/state", getState(service))
	group.PATCH("/state", patchState(service))
	group.GET("/channels", listChannels(service))
	group.POST("/channels", createChannel(service))
	group.PATCH("/channels/:id", updateChannel(service))
	group.DELETE("/channels/:id", deleteChannel(service))
	group.GET("/:module/collections", listCollections(service))
	group.POST("/:module/collections", createCollection(service))
	group.PATCH("/:module/collections/:id", updateCollection(service))
	group.DELETE("/:module/collections/:id", deleteCollection(service))
}
```

`internal/app/router.go` 注册 `studio.RegisterRoutes(group.Group("/studio"), studio.NewService(db))`。

- [ ] **步骤 7：运行测试并提交**

```bash
cd /root/Atoman/Atoman-Backend
go test ./internal/modules/studio ./internal/app -run 'TestStudio' -count=1
```

预期：全部通过。

```bash
git -C /root/Atoman/Atoman-Backend add internal/modules/studio internal/app/router.go internal/app/router_test.go internal/model/feed.go internal/migrations/unified_studio.go internal/migrations/unified_studio_test.go internal/migrations/channel_default_selection.go internal/migrations/channel_default_selection_test.go internal/handlers/user_handler.go internal/handlers/user_handler_test.go internal/handlers/auth_handler_test.go internal/service/user_bootstrap_service.go internal/service/owner_bootstrap_service_test.go cmd/migrate/main.go cmd/migrate/main_test.go
git -C /root/Atoman/Atoman-Backend commit -m "feat(studio): add channel state and collection APIs"
```

---

### 任务 3：统一三个模块的频道与合集写入规则

**文件：**

- 修改：`Atoman-Backend/internal/model/feed.go`
- 修改：`Atoman-Backend/internal/migrations/unified_studio.go`
- 修改：`Atoman-Backend/internal/migrations/unified_studio_test.go`
- 修改：`Atoman-Backend/internal/migrations/blog_single_collection.go`
- 修改：`Atoman-Backend/internal/migrations/blog_single_collection_test.go`
- 修改：`Atoman-Backend/internal/modules/studio/service.go`
- 修改：`Atoman-Backend/internal/modules/blog/service.go`
- 修改：`Atoman-Backend/internal/modules/blog/service_test.go`
- 修改：`Atoman-Backend/internal/modules/blog/http_test.go`
- 修改：`Atoman-Backend/internal/handlers/blog_helpers.go`
- 修改：`Atoman-Backend/internal/handlers/podcast_handler.go`
- 修改：`Atoman-Backend/internal/handlers/podcast_handler_test.go`
- 修改：`Atoman-Backend/internal/handlers/video_handler.go`
- 修改：`Atoman-Backend/internal/handlers/video_handler_test.go`
- 修改：`Atoman-Backend/internal/modules/feed/service.go`
- 修改：`Atoman-Backend/internal/modules/feed/service_test.go`
- 修改：`Atoman-Backend/internal/modules/feed/http.go`
- 修改：`Atoman-Backend/internal/modules/feed/http_test.go`
- 修改：`Atoman-Backend/internal/modules/feed/repo.go`
- 修改：`Atoman-Backend/internal/modules/comment/target_test.go`

- [ ] **步骤 1：写跨模块频道与合集测试**

```go
func TestBlogPublishAcceptsGlobalChannelAndBlogCollection(t *testing.T)
func TestPodcastPublishAcceptsSameGlobalChannelAndPodcastCollection(t *testing.T)
func TestVideoPublishAcceptsSameGlobalChannelAndVideoCollection(t *testing.T)
func TestPublishRejectsCollectionFromAnotherModule(t *testing.T)
func TestDraftAllowsNoCollectionAndPublishRequiresCollection(t *testing.T)
func TestChannelSubscriptionIncludesBlogPodcastAndVideoUpdates(t *testing.T)
func TestFollowingUserIncludesUpdatesFromAllOwnedChannels(t *testing.T)
```

- [ ] **步骤 2：运行定向测试确认失败**

```bash
cd /root/Atoman/Atoman-Backend
go test ./internal/modules/blog ./internal/handlers ./internal/modules/feed -run 'Test(BlogPublishAccepts|PodcastPublishAccepts|VideoPublishAccepts|PublishRejects|DraftAllows|ChannelSubscriptionIncludes|FollowingUserIncludes)' -count=1
```

预期：旧频道类型校验或合集无类型导致失败。

- [ ] **步骤 3：增加统一写入校验助手**

```go
func (s *Service) ValidateContentScope(userID, channelID uuid.UUID, module Module, collectionIDs []uuid.UUID, publishing bool) error
```

频道必须属于用户；草稿允许空合集；发布必须至少一个合集；所有合集必须属于频道和指定模块。

- [ ] **步骤 4：替换旧模块类型判断并修正订阅查询**

- 三个内容写入流程分别使用 `ModuleBlog`、`ModulePodcast`、`ModuleVideo`。
- 删除所有频道类型判断。
- 频道订阅只按 `channel_id`，用户关注展开其全部频道。
- 频道更新流按内容自身类型生成目标路径，合集不再单独决定更新流归属。
- 全部调用方切换后，从 `model.Channel` 删除 `ContentType` 和 `IsDefault`；内容类型常量改为合集和 Studio 模块常量。
- 更新历史博客迁移和测试中的频道构造，最后由 `RunUnifiedStudioMigration` 删除频道旧字段。

- [ ] **步骤 5：运行测试并提交**

```bash
cd /root/Atoman/Atoman-Backend
go test ./internal/modules/blog ./internal/handlers ./internal/modules/feed ./internal/modules/comment ./internal/migrations -run 'Test(BlogPublishAccepts|PodcastPublishAccepts|VideoPublishAccepts|PublishRejects|DraftAllows|ChannelSubscriptionIncludes|FollowingUserIncludes|RunUnifiedStudioMigration)' -count=1
```

预期：全部通过。

```bash
git -C /root/Atoman/Atoman-Backend add internal/model/feed.go internal/migrations/unified_studio.go internal/migrations/unified_studio_test.go internal/migrations/blog_single_collection.go internal/migrations/blog_single_collection_test.go internal/modules/studio/service.go internal/modules/blog internal/handlers/blog_helpers.go internal/handlers/podcast_handler.go internal/handlers/podcast_handler_test.go internal/handlers/video_handler.go internal/handlers/video_handler_test.go internal/modules/feed internal/modules/comment/target_test.go
git -C /root/Atoman/Atoman-Backend commit -m "refactor(studio): share channels across creator modules"
```

---

### 任务 4：实现 Dashboard 和统一内容管理查询

**文件：**

- 新建：`Atoman-Backend/internal/modules/studio/dashboard.go`
- 新建：`Atoman-Backend/internal/modules/studio/content.go`
- 新建：`Atoman-Backend/internal/modules/studio/dashboard_test.go`
- 新建：`Atoman-Backend/internal/modules/studio/content_test.go`
- 修改：`Atoman-Backend/internal/modules/studio/dto.go`
- 修改：`Atoman-Backend/internal/modules/studio/http.go`

- [ ] **步骤 1：写 Dashboard 和内容筛选失败测试**

```go
func TestDashboardReturnsThreeIndependentModuleSections(t *testing.T)
func TestDashboardKeepsModuleErrorInsideSection(t *testing.T)
func TestStudioContentsFilterByChannelModuleStatusVisibilityAndCollection(t *testing.T)
func TestStudioContentsDefaultToUpdatedDescending(t *testing.T)
func TestStudioContentsNeverReturnAnotherOwnersContent(t *testing.T)
```

- [ ] **步骤 2：定义统一返回类型**

```go
type DashboardSection struct {
	Module  Module               `json:"module"`
	Metrics map[string]int64     `json:"metrics"`
	Recent  []StudioContentItem  `json:"recent"`
	Issues  []StudioContentIssue `json:"issues"`
	Error   string               `json:"error,omitempty"`
}

type DashboardResponse struct {
	ChannelSubscriberCount int64              `json:"channel_subscriber_count"`
	Sections               []DashboardSection `json:"sections"`
}
```

- [ ] **步骤 3：实现 Dashboard 和内容查询**

- 三模块查询相互隔离，每段最多三条最近内容。
- 频道订阅数只在顶层返回一次。
- 内容查询支持 `q`、`status`、`visibility`、`collection_id`、`page`、`page_size`，默认按更新时间倒序。
- 三个模块分别构造查询并映射统一内容 DTO，公共服务只处理参数、所有权和分页。

- [ ] **步骤 4：注册端点并运行测试**

```go
group.GET("/dashboard", getDashboard(service))
group.GET("/:module/contents", listContents(service))
```

```bash
cd /root/Atoman/Atoman-Backend
go test ./internal/modules/studio -run 'Test(Dashboard|StudioContents)' -count=1
```

预期：全部通过。

- [ ] **步骤 5：提交**

```bash
git -C /root/Atoman/Atoman-Backend add internal/modules/studio
git -C /root/Atoman/Atoman-Backend commit -m "feat(studio): add dashboard and content queries"
```

---

### 任务 5：实现指标事件、数据中心、互动管理和创作设置

**文件：**

- 修改：`Atoman-Backend/internal/model/studio.go`
- 修改：`Atoman-Backend/internal/migrations/unified_studio.go`
- 修改：`Atoman-Backend/internal/migrations/unified_studio_test.go`
- 新建：`Atoman-Backend/internal/modules/studio/analytics.go`
- 新建：`Atoman-Backend/internal/modules/studio/interactions.go`
- 新建：`Atoman-Backend/internal/modules/studio/settings.go`
- 新建：`Atoman-Backend/internal/modules/studio/analytics_test.go`
- 新建：`Atoman-Backend/internal/modules/studio/interactions_test.go`
- 新建：`Atoman-Backend/internal/modules/studio/settings_test.go`
- 修改：`Atoman-Backend/internal/modules/blog/http.go`
- 修改：`Atoman-Backend/internal/handlers/podcast_handler.go`
- 修改：`Atoman-Backend/internal/handlers/video_handler.go`
- 修改：`Atoman-Backend/internal/modules/studio/http.go`

- [ ] **步骤 1：写数据、互动和设置失败测试**

```go
func TestStudioAnalyticsUsesEventTimeForSevenTwentyEightAndNinetyDays(t *testing.T)
func TestStudioInteractionsReturnOnlyOwnedChannelModuleComments(t *testing.T)
func TestStudioVideoInteractionsFilterTimestampComments(t *testing.T)
func TestStudioSettingsRejectForeignDefaultCollection(t *testing.T)
func TestStudioSettingsAreScopedByUserChannelAndModule(t *testing.T)
func TestStudioShareRecordsEventAndRejectsPrivateContent(t *testing.T)
```

- [ ] **步骤 2：增加最小指标事件模型**

```go
type StudioMetricEvent struct {
	Base
	ChannelID   uuid.UUID `json:"channel_id" gorm:"type:uuid;not null;index:idx_studio_metric_scope,priority:1"`
	ContentType string    `json:"content_type" gorm:"type:varchar(16);not null;index:idx_studio_metric_scope,priority:2"`
	ContentID   uuid.UUID `json:"content_id" gorm:"type:uuid;not null;index:idx_studio_metric_scope,priority:3"`
	Metric      string    `json:"metric" gorm:"type:varchar(16);not null;index"`
}
```

只记录现有关系表不能按时间还原的 `view`、`play`、`complete` 和 `share`。点赞、评论、收藏趋势查询现有记录。

同时把 `StudioMetricEvent` 加入 `RunUnifiedStudioMigration` 的 AutoMigrate，并在迁移测试中断言 `(channel_id, content_type, content_id, created_at)` 查询索引存在。

- [ ] **步骤 3：实现指标、数据、互动和设置**

- 博客阅读、播客播放与完播、视频播放、Studio 分享写入指标事件。
- 数据中心接受 `range=7|28|90`，默认 28，按 UTC 自然日聚合。
- 互动查询关联统一评论表，只返回当前用户、频道和模块内容下的评论。
- `unreplied=true` 筛选未回复根评论，`anchored=true` 用于播客和视频时间锚点。
- 设置按用户、频道、模块 upsert；默认合集必须属于当前范围；博客连续播放固定为 false。

- [ ] **步骤 4：注册端点并运行测试**

```go
group.GET("/:module/analytics", getAnalytics(service))
group.GET("/:module/interactions", listInteractions(service))
group.GET("/:module/settings", getSettings(service))
group.PATCH("/:module/settings", patchSettings(service))
group.POST("/:module/contents/:id/share", shareContent(service))
```

```bash
cd /root/Atoman/Atoman-Backend
go test ./internal/modules/studio ./internal/modules/blog ./internal/handlers -run 'TestStudio' -count=1
```

预期：全部通过。

- [ ] **步骤 5：提交**

```bash
git -C /root/Atoman/Atoman-Backend add internal/model/studio.go internal/migrations/unified_studio.go internal/migrations/unified_studio_test.go internal/modules/studio internal/modules/blog/http.go internal/handlers/podcast_handler.go internal/handlers/video_handler.go
git -C /root/Atoman/Atoman-Backend commit -m "feat(studio): add analytics interactions and settings"
```

---

### 任务 6：同步 Studio API 文档并完成后端验证

**文件：**

- 修改：`Atoman-Backend/internal/modules/studio/http.go`
- 新建：`Atoman-Backend/docs/swagger_studio_test.go`
- 修改：`Atoman-Backend/docs/docs.go`
- 修改：`Atoman-Backend/docs/swagger.json`
- 修改：`Atoman-Backend/docs/swagger.yaml`

- [ ] **步骤 1：写 Swagger 契约测试**

断言 `/api/v1/studio/state`、`/dashboard`、`/{module}/contents`、`/{module}/collections`、`/{module}/analytics`、`/{module}/interactions` 和 `/{module}/settings` 存在，写入端点声明 BearerAuth 及 `400`、`401`、`403` 响应。

- [ ] **步骤 2：补齐注解并生成文档**

为每个端点补充 `@Summary`、`@Tags studio`、参数、返回类型和安全声明，然后运行：

```bash
cd /root/Atoman/Atoman-Backend
go run github.com/swaggo/swag/cmd/swag@v1.16.6 init -g cmd/start_server/main.go -o docs
```

预期：重新生成 `docs.go`、`swagger.json` 和 `swagger.yaml`。

- [ ] **步骤 3：运行后端验证**

```bash
cd /root/Atoman/Atoman-Backend
go test ./internal/modules/studio ./internal/modules/blog ./internal/modules/feed ./internal/handlers ./internal/migrations ./internal/app ./docs -count=1
go build ./...
```

预期：测试和构建全部通过。

- [ ] **步骤 4：提交**

```bash
git -C /root/Atoman/Atoman-Backend add internal/modules/studio/http.go docs/swagger_studio_test.go docs/docs.go docs/swagger.json docs/swagger.yaml
git -C /root/Atoman/Atoman-Backend commit -m "docs(studio): publish unified creator APIs"
```

---

### 任务 7：建立前端 Studio 类型、API 和状态存储

**文件：**

- 修改：`Atoman-Frontend/src/types.ts`
- 修改：`Atoman-Frontend/src/composables/useApi.ts`
- 新建：`Atoman-Frontend/src/stores/studio.ts`
- 新建：`Atoman-Frontend/tests/unit/stores/studio.spec.ts`

- [ ] **步骤 1：写 store 失败测试**

```ts
it('loads one current channel for all creator modules')
it('switches channel and reloads the active studio resource')
it('keeps dashboard section failures isolated')
it('passes collection filters to content requests')
it('resets studio state after logout')
```

- [ ] **步骤 2：定义前端契约**

```ts
export type StudioModule = 'blog' | 'podcast' | 'video'

export type StudioChannel = {
  id: string
  name: string
  slug: string
  cover_url: string
}

export type StudioState = {
  current_channel: StudioChannel | null
  channels: StudioChannel[]
}

export type StudioContentFilters = {
  q: string
  status: '' | 'published' | 'draft'
  visibility: '' | 'public' | 'subscribers' | 'private'
  collection_id: string
  page: number
}
```

- [ ] **步骤 3：增加 API 路径**

```ts
studio: {
  state: `${apiUrl}/studio/state`,
  channels: `${apiUrl}/studio/channels`,
  channel: (id: string) => `${apiUrl}/studio/channels/${id}`,
  dashboard: `${apiUrl}/studio/dashboard`,
  contents: (module: StudioModule) => `${apiUrl}/studio/${module}/contents`,
  collections: (module: StudioModule) => `${apiUrl}/studio/${module}/collections`,
  collection: (module: StudioModule, id: string) => `${apiUrl}/studio/${module}/collections/${id}`,
  analytics: (module: StudioModule) => `${apiUrl}/studio/${module}/analytics`,
  interactions: (module: StudioModule) => `${apiUrl}/studio/${module}/interactions`,
  settings: (module: StudioModule) => `${apiUrl}/studio/${module}/settings`,
  share: (module: StudioModule, id: string) => `${apiUrl}/studio/${module}/contents/${id}/share`,
},
```

- [ ] **步骤 4：实现 store**

Store 公开：

```ts
loadState(force?: boolean): Promise<void>
selectChannel(channelId: string): Promise<void>
loadDashboard(): Promise<void>
loadContents(module: StudioModule, filters: StudioContentFilters): Promise<void>
loadCollections(module: StudioModule): Promise<void>
createCollection(module: StudioModule, input: StudioCollectionInput): Promise<void>
updateCollection(module: StudioModule, id: string, input: StudioCollectionInput): Promise<void>
deleteCollection(module: StudioModule, id: string): Promise<void>
loadAnalytics(module: StudioModule, range: 7 | 28 | 90): Promise<void>
loadInteractions(module: StudioModule, filters: StudioInteractionFilters): Promise<void>
loadSettings(module: StudioModule): Promise<void>
saveSettings(module: StudioModule, input: StudioSettingsInput): Promise<void>
reset(): void
```

所有请求使用当前频道 ID；切换频道清空 Dashboard、内容、数据和互动缓存。

- [ ] **步骤 5：运行测试并提交**

```bash
cd /root/Atoman/Atoman-Frontend
bun run test:unit -- tests/unit/stores/studio.spec.ts
bun run type-check
```

预期：通过。

```bash
git -C /root/Atoman/Atoman-Frontend add src/types.ts src/composables/useApi.ts src/stores/studio.ts tests/unit/stores/studio.spec.ts
git -C /root/Atoman/Atoman-Frontend commit -m "feat(studio): add unified client state"
```

---

### 任务 8：建立唯一 Studio 路由、顶部入口和壳层

**文件：**

- 新建：`Atoman-Frontend/src/router/routes/studio.ts`
- 修改：`Atoman-Frontend/src/router/buildAppRoutes.ts`
- 修改：`Atoman-Frontend/src/router/routes/modules.ts`
- 修改：`Atoman-Frontend/src/components/system/AppTopbarAuthControls.vue`
- 修改：`Atoman-Frontend/src/views/blog/BlogLayout.vue`
- 修改：`Atoman-Frontend/src/views/podcast/PodcastLayout.vue`
- 修改：`Atoman-Frontend/src/views/video/VideoLayout.vue`
- 修改：`Atoman-Frontend/src/components/system/AppSidebar.vue`
- 修改：`Atoman-Frontend/src/components/blog/BlogCollectionSheet.vue`
- 修改：`Atoman-Frontend/src/views/blog/BlogHomeView.vue`
- 修改：`Atoman-Frontend/src/views/blog/BlogSubscriptionsView.vue`
- 修改：`Atoman-Frontend/src/views/blog/ChannelView.vue`
- 修改：`Atoman-Frontend/src/views/blog/CollectionView.vue`
- 修改：`Atoman-Frontend/src/views/podcast/PodcastHomeView.vue`
- 修改：`Atoman-Frontend/src/views/video/VideoHomeView.vue`
- 修改：`Atoman-Frontend/src/views/portal/HomeView.vue`
- 新建：`Atoman-Frontend/src/views/studio/StudioLayout.vue`
- 新建：`Atoman-Frontend/src/views/studio/StudioDashboardView.vue`
- 新建：`Atoman-Frontend/src/views/studio/StudioModuleLayout.vue`
- 新建：`Atoman-Frontend/src/views/studio/StudioContentView.vue`
- 新建：`Atoman-Frontend/src/views/studio/StudioAnalyticsView.vue`
- 新建：`Atoman-Frontend/src/views/studio/StudioInteractionsView.vue`
- 新建：`Atoman-Frontend/src/views/studio/StudioSettingsView.vue`
- 新建：`Atoman-Frontend/src/views/studio/StudioChannelView.vue`
- 新建：`Atoman-Frontend/src/components/studio/StudioChannelSelector.vue`
- 新建：`Atoman-Frontend/tests/unit/router/studioRoutes.spec.ts`
- 新建：`Atoman-Frontend/tests/unit/views/studio/StudioLayout.spec.ts`
- 修改：`Atoman-Frontend/tests/unit/components/AppTopbarAuthControls.spec.ts`
- 修改：`Atoman-Frontend/tests/unit/components/blog/BlogCollectionSheet.spec.ts`
- 修改：`Atoman-Frontend/tests/unit/views/blog/BlogHomeView.spec.ts`
- 修改：`Atoman-Frontend/tests/unit/views/blog/BlogLayout.spec.ts`
- 修改：`Atoman-Frontend/tests/unit/views/video/VideoLayout.spec.ts`

- [ ] **步骤 1：写导航失败测试**

断言登录后顶部栏只出现一个 `/studio` 创作中心按钮；全站其他页面和侧边栏不含创作按钮；Studio 路由需要登录；四个旧创作地址不在路由表中；Studio 一级导航只有 Dashboard、博客、播客、视频和频道设置。

- [ ] **步骤 2：定义路由树**

```ts
export const studioRoutes: RouteRecordRaw[] = [{
  path: '/studio',
  component: () => import('@/views/studio/StudioLayout.vue'),
  meta: { requiresAuth: true },
  children: [
    { path: '', component: () => import('@/views/studio/StudioDashboardView.vue') },
    { path: 'channel', component: () => import('@/views/studio/StudioChannelView.vue') },
    {
      path: ':module(blog|podcast|video)',
      component: () => import('@/views/studio/StudioModuleLayout.vue'),
      children: [
        { path: '', redirect: to => `/studio/${to.params.module}/content` },
        { path: 'content', component: () => import('@/views/studio/StudioContentView.vue') },
        { path: 'analytics', component: () => import('@/views/studio/StudioAnalyticsView.vue') },
        { path: 'interactions', component: () => import('@/views/studio/StudioInteractionsView.vue') },
        { path: 'settings', component: () => import('@/views/studio/StudioSettingsView.vue') },
      ],
    },
    { path: 'blog/new', component: () => import('@/views/blog/PostEditorView.vue') },
    { path: 'blog/:id/edit', component: () => import('@/views/blog/PostEditorView.vue') },
    { path: 'podcast/new', component: () => import('@/views/podcast/PodcastEditorView.vue') },
    { path: 'podcast/:id/edit', component: () => import('@/views/podcast/PodcastEditorView.vue') },
    { path: 'video/new', component: () => import('@/views/video/VideoEditorView.vue') },
    { path: 'video/:id/edit', component: () => import('@/views/video/VideoEditorView.vue') },
  ],
}]
```

六个编辑路由保留各模块现有 feature gate。

- [ ] **步骤 3：实现壳层和唯一入口**

- `StudioLayout` 首次挂载加载状态，页头渲染频道选择器，无频道时显示创建空状态。
- 桌面端左侧固定导航，移动端收进菜单面板。
- 为所有子路由创建可运行的第一版页面，完整处理加载、空数据和请求失败；任务 9 到 11 再拆分展示组件和补齐交互细节。
- 顶部栏使用 `PencilLine` 图标和“创作中心”文字链接 `/studio`。
- 删除旧频道管理下拉项、模块默认频道选择，以及 AppSidebar、模块首页、频道页、合集页和门户页中的所有创作链接。

- [ ] **步骤 4：运行测试并提交**

```bash
cd /root/Atoman/Atoman-Frontend
bun run test:unit -- tests/unit/router/studioRoutes.spec.ts tests/unit/views/studio/StudioLayout.spec.ts tests/unit/components/AppTopbarAuthControls.spec.ts tests/unit/components/blog/BlogCollectionSheet.spec.ts tests/unit/views/blog/BlogHomeView.spec.ts tests/unit/views/blog/BlogLayout.spec.ts tests/unit/views/video/VideoLayout.spec.ts
bun run type-check
```

预期：通过。

```bash
git -C /root/Atoman/Atoman-Frontend add src/router/routes/studio.ts src/router/buildAppRoutes.ts src/router/routes/modules.ts src/components/system/AppTopbarAuthControls.vue src/components/system/AppSidebar.vue src/components/blog/BlogCollectionSheet.vue src/views/blog/BlogLayout.vue src/views/blog/BlogHomeView.vue src/views/blog/BlogSubscriptionsView.vue src/views/blog/ChannelView.vue src/views/blog/CollectionView.vue src/views/podcast/PodcastLayout.vue src/views/podcast/PodcastHomeView.vue src/views/video/VideoLayout.vue src/views/video/VideoHomeView.vue src/views/portal/HomeView.vue src/views/studio src/components/studio/StudioChannelSelector.vue tests/unit/router/studioRoutes.spec.ts tests/unit/views/studio/StudioLayout.spec.ts tests/unit/components/AppTopbarAuthControls.spec.ts tests/unit/components/blog/BlogCollectionSheet.spec.ts tests/unit/views/blog/BlogHomeView.spec.ts tests/unit/views/blog/BlogLayout.spec.ts tests/unit/views/video/VideoLayout.spec.ts
git -C /root/Atoman/Atoman-Frontend commit -m "feat(studio): add the single creator workspace"
```

---

### 任务 9：实现三模块单页 Dashboard

**文件：**

- 修改：`Atoman-Frontend/src/views/studio/StudioDashboardView.vue`
- 新建：`Atoman-Frontend/src/components/studio/StudioDashboardSection.vue`
- 新建：`Atoman-Frontend/tests/unit/views/studio/StudioDashboardView.spec.ts`
- 新建：`Atoman-Frontend/tests/unit/components/studio/StudioDashboardSection.spec.ts`

- [ ] **步骤 1：写 Dashboard 失败测试**

```ts
it('renders blog podcast and video sections on one page')
it('does not add metrics from different modules together')
it('shows one channel subscriber count in the page header')
it('shows three recent items and actionable issues per module')
it('keeps successful sections visible when one section fails')
it('routes create and manage actions to the selected module')
```

- [ ] **步骤 2：实现 Dashboard**

- 标题只显示“Dashboard”，频道订阅数在页头显示一次。
- 博客、播客、视频按固定顺序渲染三个全宽区块。
- 区块使用紧凑指标行、最近内容列表和问题列表，不嵌套装饰卡片。
- 新建按钮进入模块 new 路由，管理按钮进入模块 content 路由。

- [ ] **步骤 3：运行测试并提交**

```bash
cd /root/Atoman/Atoman-Frontend
bun run test:unit -- tests/unit/views/studio/StudioDashboardView.spec.ts tests/unit/components/studio/StudioDashboardSection.spec.ts
bun run type-check
```

预期：通过。

```bash
git -C /root/Atoman/Atoman-Frontend add src/views/studio/StudioDashboardView.vue src/components/studio/StudioDashboardSection.vue tests/unit/views/studio/StudioDashboardView.spec.ts tests/unit/components/studio/StudioDashboardSection.spec.ts
git -C /root/Atoman/Atoman-Frontend commit -m "feat(studio): add three-module dashboard"
```

---

### 任务 10：实现内容管理和合集侧边面板

**文件：**

- 修改：`Atoman-Frontend/src/views/studio/StudioModuleLayout.vue`
- 修改：`Atoman-Frontend/src/views/studio/StudioContentView.vue`
- 新建：`Atoman-Frontend/src/components/studio/StudioContentTable.vue`
- 新建：`Atoman-Frontend/src/components/studio/StudioCollectionSheet.vue`
- 新建：`Atoman-Frontend/src/config/studioModules.ts`
- 新建：`Atoman-Frontend/tests/unit/views/studio/StudioContentView.spec.ts`
- 新建：`Atoman-Frontend/tests/unit/components/studio/StudioCollectionSheet.spec.ts`

- [ ] **步骤 1：写筛选和合集失败测试**

```ts
it('renders content analytics interactions and settings navigation')
it('requests content with status visibility collection search and page filters')
it('keeps filters in route query state')
it('opens collection management from the icon beside the filter')
it('creates renames and deletes collections in the side sheet')
it('passes the active collection to the create route')
it('does not pass a collection from the all-collections filter')
```

- [ ] **步骤 2：定义模块配置和筛选协议**

```ts
export const studioModules = {
  blog: { label: '博客', itemLabel: '文章', createLabel: '写文章' },
  podcast: { label: '播客', itemLabel: '单集', createLabel: '发布单集' },
  video: { label: '视频', itemLabel: '视频', createLabel: '上传视频' },
} satisfies Record<StudioModule, StudioModuleConfig>
```

搜索、状态、可见性、合集和页码同步到 route query；筛选变化重置到第一页；选中普通合集时新建链接附加 `?collection=<id>`。

- [ ] **步骤 3：实现合集侧边面板**

- 合集筛选旁使用 `Settings2` 图标按钮，tooltip 为“管理合集”。
- 面板使用现有 `PSheet`，支持新建、重命名、修改描述和删除。
- 删除前二次确认，成功后重新加载合集和内容。
- 不创建合集页面或合集路由。

- [ ] **步骤 4：运行测试并提交**

```bash
cd /root/Atoman/Atoman-Frontend
bun run test:unit -- tests/unit/views/studio/StudioContentView.spec.ts tests/unit/components/studio/StudioCollectionSheet.spec.ts
bun run type-check
```

预期：通过。

```bash
git -C /root/Atoman/Atoman-Frontend add src/views/studio/StudioModuleLayout.vue src/views/studio/StudioContentView.vue src/components/studio/StudioContentTable.vue src/components/studio/StudioCollectionSheet.vue src/config/studioModules.ts tests/unit/views/studio/StudioContentView.spec.ts tests/unit/components/studio/StudioCollectionSheet.spec.ts
git -C /root/Atoman/Atoman-Frontend commit -m "feat(studio): add content and collection management"
```

---

### 任务 11：实现数据、互动、设置和频道页面

**文件：**

- 修改：`Atoman-Frontend/src/views/studio/StudioAnalyticsView.vue`
- 修改：`Atoman-Frontend/src/views/studio/StudioInteractionsView.vue`
- 修改：`Atoman-Frontend/src/views/studio/StudioSettingsView.vue`
- 修改：`Atoman-Frontend/src/views/studio/StudioChannelView.vue`
- 新建：`Atoman-Frontend/tests/unit/views/studio/StudioAnalyticsView.spec.ts`
- 新建：`Atoman-Frontend/tests/unit/views/studio/StudioInteractionsView.spec.ts`
- 新建：`Atoman-Frontend/tests/unit/views/studio/StudioSettingsView.spec.ts`
- 新建：`Atoman-Frontend/tests/unit/views/studio/StudioChannelView.spec.ts`

- [ ] **步骤 1：写四个页面的失败测试**

断言数据中心默认 28 天并可切换 7、28、90 天；互动支持未回复及时间锚点筛选；设置以当前频道和模块加载且博客不显示连续播放；频道页支持创建、编辑、切换和删除空频道。

- [ ] **步骤 2：实现四个页面**

- 数据中心使用 `PSegmentedControl` 和现有 Chart.js，不增加图表依赖。
- 互动管理复用统一评论 API 完成回复、删除和置顶。
- 设置保存默认合集、可见性、发布状态；播客和视频显示连续播放。
- 频道选择器和频道页共用 Studio store；创建首个频道后返回 Dashboard。

- [ ] **步骤 3：运行测试并提交**

```bash
cd /root/Atoman/Atoman-Frontend
bun run test:unit -- tests/unit/views/studio
bun run type-check
```

预期：通过。

```bash
git -C /root/Atoman/Atoman-Frontend add src/views/studio tests/unit/views/studio
git -C /root/Atoman/Atoman-Frontend commit -m "feat(studio): add analytics interactions settings and channels"
```

---

### 任务 12：接入三个编辑器并删除旧创作页面

**文件：**

- 修改：`Atoman-Frontend/src/views/blog/PostEditorView.vue`
- 修改：`Atoman-Frontend/src/views/podcast/PodcastEditorView.vue`
- 修改：`Atoman-Frontend/src/views/video/VideoEditorView.vue`
- 删除：`Atoman-Frontend/src/stores/defaultChannels.ts`
- 删除：`Atoman-Frontend/tests/unit/stores/defaultChannels.spec.ts`
- 删除：`Atoman-Frontend/src/views/blog/BlogManageView.vue`
- 删除：`Atoman-Frontend/src/views/blog/CollectionManageView.vue`
- 删除：`Atoman-Frontend/src/views/blog/ChannelManageView.vue`
- 删除：`Atoman-Frontend/src/views/blog/ChannelManageDetailView.vue`
- 删除：`Atoman-Frontend/src/views/podcast/PodcastCreatorView.vue`
- 删除：`Atoman-Frontend/src/views/podcast/creator/PodcastCreatorDashboard.vue`
- 删除：`Atoman-Frontend/src/views/podcast/creator/PodcastCreatorManage.vue`
- 删除：`Atoman-Frontend/src/views/podcast/creator/PodcastCreatorAnalytics.vue`
- 删除：`Atoman-Frontend/src/views/podcast/creator/PodcastCreatorInteractions.vue`
- 删除：`Atoman-Frontend/src/views/podcast/creator/PodcastCreatorSettings.vue`
- 删除：`Atoman-Frontend/src/views/video/VideoManageView.vue`
- 修改：`Atoman-Frontend/tests/unit/views/blog/PostEditorView.spec.ts`
- 修改：`Atoman-Frontend/tests/unit/views/video/VideoEditorView.spec.ts`
- 新建：`Atoman-Frontend/tests/unit/views/podcast/PodcastEditorView.studio.spec.ts`
- 修改：`Atoman-Frontend/tests/unit/views/podcast/podcast-routing-prefix.spec.ts`

- [ ] **步骤 1：写编辑器 Studio 状态失败测试**

```ts
it('uses the studio current channel without rendering a channel picker')
it('preselects the collection query parameter')
it('allows saving a draft without a collection')
it('requires a collection before publishing')
it('returns drafts to the module content route with the collection filter')
it('switches studio state to the edited contents channel before loading')
```

- [ ] **步骤 2：修改频道和合集来源**

```ts
const currentChannelId = computed(() => studioStore.currentChannel?.id || '')
const preselectedCollectionId = computed(() => (
  typeof route.query.collection === 'string' ? route.query.collection : ''
))
```

删除默认频道 store、频道列表请求和频道选择控件，并更新仍引用旧 store 的测试。编辑旧内容时根据内容 `channel_id` 切换 Studio 状态，再加载对应合集。

- [ ] **步骤 3：修改保存和跳转**

- 草稿允许空合集，发布前检查至少一个合集。
- 草稿保存后进入 `/studio/<module>/content`，存在预选合集时保留筛选。
- 发布成功继续进入各自公开详情页。

- [ ] **步骤 4：删除旧页面并确认无引用**

```bash
cd /root/Atoman/Atoman-Frontend
rg -n "BlogManageView|CollectionManageView|ChannelManageView|PodcastCreator|VideoManageView|defaultChannels|/posts/manage|/podcasts/creator|/videos/creator|/videos/manage" src
```

预期：无输出。

- [ ] **步骤 5：运行测试并提交**

```bash
cd /root/Atoman/Atoman-Frontend
bun run test:unit -- tests/unit/views/blog/PostEditorView.spec.ts tests/unit/views/podcast/PodcastEditorView.studio.spec.ts tests/unit/views/podcast/podcast-routing-prefix.spec.ts tests/unit/views/video/VideoEditorView.spec.ts tests/unit/router/studioRoutes.spec.ts
bun run type-check
```

预期：通过。

```bash
git -C /root/Atoman/Atoman-Frontend add src/stores/defaultChannels.ts tests/unit/stores/defaultChannels.spec.ts src/views/blog src/views/podcast src/views/video tests/unit/views/blog tests/unit/views/podcast tests/unit/views/video tests/unit/router/studioRoutes.spec.ts
git -C /root/Atoman/Atoman-Frontend commit -m "refactor(studio): move all creation into one workspace"
```

---

### 任务 13：完成端到端验收和全量构建

**文件：**

- 新建：`Atoman-Frontend/tests/e2e/studio.spec.ts`
- 修改：`Atoman-Frontend/tests/e2e/specs/blog.spec.ts`
- 修改：`Atoman-Frontend/tests/e2e/specs/auth.spec.ts`
- 修改：`Atoman-Frontend/tests/unit/router/routes.spec.ts`
- 修改：`Atoman-Frontend/tests/unit/ui/ui-guidelines.spec.ts`

- [ ] **步骤 1：写 Studio 端到端流程**

覆盖：从顶部栏进入 Studio；创建或选择频道；同页查看三模块摘要；在博客内容管理创建合集并从该合集新建草稿；草稿返回并保留筛选；切换播客和视频时频道不变；旧创作地址进入 NotFound。

- [ ] **步骤 2：运行前端验证**

```bash
cd /root/Atoman/Atoman-Frontend
bun run test:unit -- tests/unit/stores/studio.spec.ts tests/unit/router/studioRoutes.spec.ts tests/unit/views/studio tests/unit/components/studio
bun run test:unit
bun run type-check
bun run build
bun run test:e2e -- tests/e2e/studio.spec.ts
```

预期：全部通过。

- [ ] **步骤 3：运行后端验证**

```bash
cd /root/Atoman/Atoman-Backend
go test ./internal/modules/studio ./internal/modules/blog ./internal/modules/feed ./internal/handlers ./internal/migrations ./internal/app ./docs -count=1
go build ./...
```

预期：全部通过。

- [ ] **步骤 4：提交验收测试**

```bash
git -C /root/Atoman/Atoman-Frontend add tests/e2e/studio.spec.ts tests/e2e/specs/blog.spec.ts tests/e2e/specs/auth.spec.ts tests/unit/router/routes.spec.ts tests/unit/ui/ui-guidelines.spec.ts
git -C /root/Atoman/Atoman-Frontend commit -m "test(studio): cover unified creator workflow"
```

---

## 完成检查

- [ ] 全站只有一个 `/studio` 创作入口。
- [ ] 当前频道在三个模块间保持一致。
- [ ] Dashboard 同页展示三个独立摘要区。
- [ ] 内容管理包含合集筛选和合集管理侧边面板。
- [ ] 没有独立合集页面。
- [ ] 三个编辑器都继承当前频道并支持合集预选。
- [ ] 旧创作路由和旧默认频道 API 已移除。
- [ ] 现有频道、合集、内容和订阅数据迁移后仍保留。
- [ ] Swagger、后端构建、前端类型检查、单元测试和 Studio E2E 全部通过。
