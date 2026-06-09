# Admin Settings Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 `/setting/access` 基础上实现模块设置中心，包含顶部启用模块栏、模块章节导航联动、Feed/Blog/Forum 的已确认配置项，以及占位模块的统一展示。

**Architecture:** 继续复用现有 `site-access` 设置入口，但把纯布尔 `modules.features` 扩展为“模块开关 + 结构化模块设置”双层模型。页面层面保留 `SettingLayout.vue` 作为后台框架，在 `/setting/access` 内构建独立的模块导航壳；业务层面把 Feed/Blog/Forum 新增规则拆成三个清晰单元：Feed 来源与全文抓取配置、Blog 评论模式、Forum 版主分配与分类权限。

**Tech Stack:** Vue 3, TypeScript, Pinia, Go, Gin, GORM, PostgreSQL/SQLite test DB, existing `A*` / `Paper*` UI primitives.

---

## File Structure

### Backend files to modify
- Modify: `server/internal/service/site_access.go` — 扩展站点设置载荷结构，增加结构化模块设置默认值、兼容读取与保存。
- Modify: `server/internal/service/site_access_test.go` — 覆盖新默认值、部分更新、旧数据兼容。
- Modify: `server/internal/handlers/admin_handler.go` — 继续复用 `/api/v1/settings/site-access`，返回和保存扩展后的载荷。
- Modify: `server/internal/handlers/site_access_handler_test.go` — 覆盖 settings 载荷与错误路径。
- Modify: `server/internal/handlers/blog_interaction_handler.go` — 让评论创建遵循全站评论模式，并允许匿名评论模式。
- Modify: `server/internal/handlers/blog_interaction_handler_test.go` — 覆盖匿名评论、登录评论、关闭评论三种路径。
- Modify: `server/internal/model/feed.go` — 让 `Comment` 支持匿名评论字段。
- Modify: `server/cmd/migrate/main.go` — 显式执行新迁移，保持 CLI 迁移入口可用。
- Modify: `server/cmd/start_server/main.go` — 启动时包含新模型 AutoMigrate 与显式迁移调用。
- Modify: `server/internal/modules/forum_moderation/service.go` — 从“全局 moderator 角色”改为“admin/owner 或按分类授权的 moderator assignment”。
- Modify: `server/internal/modules/forum_moderation/service_test.go` — 覆盖分配、分类作用域、权限缺失。
- Modify: `server/internal/modules/forum_moderation/http.go` — 新增版主管理 CRUD 路由。

### Backend files to create
- Create: `server/internal/model/forum_moderator_assignment.go` — 版主分配模型，记录用户、分类范围和权限位。
- Create: `server/internal/migrations/blog_guest_comments.go` — 迁移 `comments.user_id` 为可空并新增匿名字段。
- Create: `server/internal/modules/forum_moderation/http_test.go` — 覆盖版主管理接口权限与响应。

### Frontend files to modify
- Modify: `web/src/config/siteAccess.ts` — 扩展前端 settings 类型、默认值、合并逻辑和模块章节配置。
- Modify: `web/src/stores/siteAccess.ts` — 提供结构化 getter，如 `blogCommentMode`、`feedSourceAddEnabled`。
- Modify: `web/src/composables/useApi.ts` — 新增 forum moderator settings API 路径。
- Modify: `web/src/types.ts` — 扩展 comment 匿名字段、forum moderator assignment 类型。
- Modify: `web/src/views/setting/SettingLayout.vue` — `/setting/access` 使用聚焦布局，去掉外层重复侧边栏。
- Modify: `web/src/views/setting/SettingAccessView.vue` — 实现顶部启用模块栏、左侧模块导航、章节联动和模块表单。
- Modify: `web/src/views/setting/SettingFeedFullText.vue` — 抽离可复用的 Feed 源设置面板或复用新面板。
- Modify: `web/src/views/blog/PostDetailView.vue` — 把全站评论模式传入评论组件。
- Modify: `web/src/components/blog/CommentSection.vue` — 按全站评论模式渲染游客/登录评论表单。

### Frontend files to create
- Create: `web/src/components/setting/SettingFeedSourcePanel.vue` — Feed 来源管理与按源全文抓取开关。
- Create: `web/src/components/setting/SettingForumModeratorPanel.vue` — 版主分配、分类绑定、权限位管理。

### Contract docs to modify
- Modify: `docs/api-v1.md` — 同步 site-access 结构、评论权限规则、forum moderator settings API。

---

### Task 1: 扩展 site-access 契约为“模块开关 + 结构化设置”

**Files:**
- Modify: `server/internal/service/site_access.go`
- Modify: `server/internal/service/site_access_test.go`
- Modify: `server/internal/handlers/admin_handler.go`
- Modify: `server/internal/handlers/site_access_handler_test.go`
- Modify: `web/src/config/siteAccess.ts`
- Modify: `web/src/stores/siteAccess.ts`
- Modify: `docs/api-v1.md`

- [ ] **Step 1: 先写后端失败测试，锁定新载荷默认值**

在 `server/internal/service/site_access_test.go` 追加用例，先把我们真正要保存的结构钉死：

```go
func TestSiteAccessServiceDefaultMatrixIncludesStructuredSettings(t *testing.T) {
	db := newSiteAccessTestDB(t)
	matrix, err := NewSiteAccessService(db).Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}

	if matrix.Settings.Blog.CommentMode != "authenticated" {
		t.Fatalf("expected default blog comment mode authenticated, got %q", matrix.Settings.Blog.CommentMode)
	}
	if !matrix.Settings.Feed.AllowManageSources {
		t.Fatalf("expected feed source management enabled by default")
	}
	if matrix.Settings.Feed.FullTextMode != "per_source" {
		t.Fatalf("expected feed full text mode per_source, got %q", matrix.Settings.Feed.FullTextMode)
	}
	if !matrix.Settings.Forum.AllowCategoryRequest {
		t.Fatalf("expected forum category request enabled by default")
	}
	if !matrix.Settings.Forum.ModeratorPermissions.PinTopic {
		t.Fatalf("expected forum moderator pin permission enabled by default")
	}
}
```

- [ ] **Step 2: 运行后端定向测试，确认新结构当前会失败**

Run:

```bash
cd server && go test ./internal/service -run TestSiteAccessServiceDefaultMatrixIncludesStructuredSettings -v
```

Expected: FAIL，提示 `Settings` 字段或默认值不存在。

- [ ] **Step 3: 在 `site_access.go` 增加结构化设置类型与默认值**

把 `SiteAccessMatrix` 扩展为下面这组类型，并让 `DefaultSiteAccessMatrix()` 返回完整默认值：

```go
type SiteAccessMatrix struct {
	Version  int                 `json:"version"`
	Modules  map[string]SiteAccessModule `json:"modules"`
	Settings SiteAccessSettings  `json:"settings"`
}

type SiteAccessSettings struct {
	Feed  SiteAccessFeedSettings  `json:"feed"`
	Blog  SiteAccessBlogSettings  `json:"blog"`
	Forum SiteAccessForumSettings `json:"forum"`
}

type SiteAccessFeedSettings struct {
	AllowManageSources bool   `json:"allow_manage_sources"`
	AllowAddSource     bool   `json:"allow_add_source"`
	FullTextMode       string `json:"full_text_mode"`
}

type SiteAccessBlogSettings struct {
	CommentMode string `json:"comment_mode"`
}

type SiteAccessForumSettings struct {
	AllowCategoryRequest  bool                               `json:"allow_category_request"`
	ModeratorPermissions  SiteAccessForumModeratorPermissions `json:"moderator_permissions"`
}

type SiteAccessForumModeratorPermissions struct {
	ReviewCategoryRequest bool `json:"review_category_request"`
	PinTopic              bool `json:"pin_topic"`
	LockTopic             bool `json:"lock_topic"`
}
```

默认值使用：

```go
Settings: SiteAccessSettings{
	Feed: SiteAccessFeedSettings{
		AllowManageSources: true,
		AllowAddSource:     true,
		FullTextMode:       "per_source",
	},
	Blog: SiteAccessBlogSettings{
		CommentMode: "authenticated",
	},
	Forum: SiteAccessForumSettings{
		AllowCategoryRequest: true,
		ModeratorPermissions: SiteAccessForumModeratorPermissions{
			ReviewCategoryRequest: true,
			PinTopic:              true,
			LockTopic:             true,
		},
	},
},
```

同时保留现有 `modules.features`，其中：
- `feed.subscription.manage` 继续用于路由守卫
- `forum.category.request` 与 `settings.forum.allow_category_request` 同步保存

- [ ] **Step 4: 完成合并与校验逻辑，再补前端对应类型**

后端合并函数要允许“旧 payload 没有 `settings` 时落默认值”，前端 `web/src/config/siteAccess.ts` 同步改成：

```ts
export type BlogCommentMode = 'all' | 'authenticated' | 'disabled'
export type FeedFullTextMode = 'disabled' | 'per_source'

export type SiteAccessSettings = {
  feed: {
    allow_manage_sources: boolean
    allow_add_source: boolean
    full_text_mode: FeedFullTextMode
  }
  blog: {
    comment_mode: BlogCommentMode
  }
  forum: {
    allow_category_request: boolean
    moderator_permissions: {
      review_category_request: boolean
      pin_topic: boolean
      lock_topic: boolean
    }
  }
}
```

并让 `mergeSiteAccess()` 在没有 `settings` 时返回：

```ts
settings: {
  feed: {
    allow_manage_sources: true,
    allow_add_source: true,
    full_text_mode: 'per_source',
  },
  blog: {
    comment_mode: 'authenticated',
  },
  forum: {
    allow_category_request: true,
    moderator_permissions: {
      review_category_request: true,
      pin_topic: true,
      lock_topic: true,
    },
  },
}
```

- [ ] **Step 5: 运行契约测试并提交**

Run:

```bash
cd server && go test ./internal/service ./internal/handlers -run 'SiteAccess' -v
cd ../web && bun run type-check
```

Expected:
- Go tests PASS
- `bun run type-check` PASS

Commit:

```bash
git add server/internal/service/site_access.go server/internal/service/site_access_test.go server/internal/handlers/admin_handler.go server/internal/handlers/site_access_handler_test.go web/src/config/siteAccess.ts web/src/stores/siteAccess.ts docs/api-v1.md
git commit -m "feat(settings): extend site access with structured module settings"
```

---

### Task 2: 实现 Blog 评论模式与匿名评论能力

**Files:**
- Create: `server/internal/migrations/blog_guest_comments.go`
- Modify: `server/internal/model/feed.go`
- Modify: `server/cmd/migrate/main.go`
- Modify: `server/cmd/start_server/main.go`
- Modify: `server/internal/handlers/blog_interaction_handler.go`
- Modify: `server/internal/handlers/blog_interaction_handler_test.go`
- Modify: `web/src/types.ts`
- Modify: `web/src/components/blog/CommentSection.vue`
- Modify: `web/src/views/blog/PostDetailView.vue`

- [ ] **Step 1: 先写后端失败测试，锁定三种评论模式**

在 `server/internal/handlers/blog_interaction_handler_test.go` 增加三个测试：

```go
func TestCreateCommentRequiresLoginWhenCommentModeAuthenticated(t *testing.T) {}
func TestCreateCommentAllowsAnonymousWhenCommentModeAll(t *testing.T) {}
func TestCreateCommentRejectsWhenCommentModeDisabled(t *testing.T) {}
```

匿名模式测试里断言返回 `201`，并且评论记录满足：

```go
if comment.UserID != uuid.Nil {
	t.Fatalf("expected anonymous comment without user id")
}
if comment.GuestName != "匿名" {
	t.Fatalf("expected anonymous guest name")
}
```

- [ ] **Step 2: 运行 blog interaction 定向测试，确认当前匿名模式失败**

Run:

```bash
cd server && go test ./internal/handlers -run 'CreateComment' -v
```

Expected: FAIL，当前 `POST /api/blog/posts/:id/comments` 强依赖 `AuthMiddleware()` 和非空 `user_id`。

- [ ] **Step 3: 扩展评论模型与迁移**

在 `server/internal/model/feed.go` 把 `Comment` 改成可承载匿名作者：

```go
type Comment struct {
	Base
	TargetType   string     `json:"target_type" gorm:"type:varchar(16);not null;index:idx_comments_target,priority:1"`
	TargetID     uuid.UUID  `json:"target_id" gorm:"type:uuid;not null;index:idx_comments_target,priority:2"`
	UserID       *uuid.UUID `json:"user_id,omitempty" gorm:"type:uuid;index"`
	User         *User      `json:"user,omitempty" gorm:"foreignKey:UserID;references:UUID"`
	GuestName    string     `json:"guest_name" gorm:"type:varchar(64)"`
	Content      string     `json:"content" gorm:"type:text;not null"`
	TimestampSec *int       `json:"timestamp_sec,omitempty"`
	Status       string     `json:"status" gorm:"type:varchar(16);not null;default:'visible'"`
}
```

新增 `server/internal/migrations/blog_guest_comments.go`：

```go
package migrations

import (
	"gorm.io/gorm"
)

func MigrateBlogGuestComments(db *gorm.DB) error {
	if db.Dialector.Name() == "postgres" {
		if err := db.Exec(`ALTER TABLE comments ALTER COLUMN user_id DROP NOT NULL`).Error; err != nil {
			return err
		}
	}
	if err := db.Exec(`ALTER TABLE comments ADD COLUMN IF NOT EXISTS guest_name varchar(64) DEFAULT ''`).Error; err != nil {
		return err
	}
	return nil
}
```

并在 `server/cmd/migrate/main.go` 与 `server/cmd/start_server/main.go` 里调用 `migrations.MigrateBlogGuestComments(db)`。

- [ ] **Step 4: 把评论创建从“必须登录”改成“按全站模式判断”**

把 `SetupBlogInteractionRoutes()` 的评论创建路由单独拆出来，使用 `OptionalAuthMiddleware()`：

```go
blog.POST("/posts/:id/comments", middleware.OptionalAuthMiddleware(), CreateComment(db))
```

在 `CreateComment()` 里读取全站模式：

```go
matrix, err := service.NewSiteAccessService(db).PublicMatrix()
if err != nil {
	c.JSON(http.StatusInternalServerError, gin.H{"error": "settings_load_failed"})
	return
}
switch matrix.Settings.Blog.CommentMode {
case "disabled":
	c.JSON(http.StatusForbidden, gin.H{"error": "Comments are disabled for this site"})
	return
case "authenticated":
	if _, ok := c.Get("user_id"); !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Login required"})
		return
	}
}
```

生成评论实体时：

```go
comment := model.Comment{
	TargetType:   "post",
	TargetID:     post.ID,
	Content:      input.Content,
	TimestampSec: input.TimestampSec,
	Status:       "visible",
}
if userIDVal, ok := c.Get("user_id"); ok {
	userID := userIDVal.(uuid.UUID)
	comment.UserID = &userID
} else {
	comment.GuestName = "匿名"
}
```

前端 `CommentSection.vue` 改成接收 `commentMode`：

```ts
const props = defineProps<{
  postId: string
  allowComments: boolean
  commentMode: 'all' | 'authenticated' | 'disabled'
  postOwnerId?: string
}>()
```

展示规则：
- `disabled` 或 `!allowComments`：显示关闭提示
- `authenticated` 且未登录：显示登录提示
- `all`：游客也展示表单

- [ ] **Step 5: 运行测试、类型检查并提交**

Run:

```bash
cd server && go test ./internal/handlers -run 'CreateComment|GetPostComments' -v
cd ../web && bun run type-check
```

Expected:
- Go tests PASS
- `bun run type-check` PASS

Commit:

```bash
git add server/internal/migrations/blog_guest_comments.go server/internal/model/feed.go server/cmd/migrate/main.go server/cmd/start_server/main.go server/internal/handlers/blog_interaction_handler.go server/internal/handlers/blog_interaction_handler_test.go web/src/types.ts web/src/components/blog/CommentSection.vue web/src/views/blog/PostDetailView.vue
git commit -m "feat(blog): add site-level comment modes"
```

---

### Task 3: 实现 Forum 版主分配与分类权限

**Files:**
- Create: `server/internal/model/forum_moderator_assignment.go`
- Modify: `server/cmd/migrate/main.go`
- Modify: `server/cmd/start_server/main.go`
- Modify: `server/internal/modules/forum_moderation/service.go`
- Modify: `server/internal/modules/forum_moderation/service_test.go`
- Modify: `server/internal/modules/forum_moderation/http.go`
- Create: `server/internal/modules/forum_moderation/http_test.go`
- Modify: `docs/api-v1.md`

- [ ] **Step 1: 先写 service 失败测试，锁定“按分类授权”的真实行为**

在 `server/internal/modules/forum_moderation/service_test.go` 增加用例：

```go
func TestModeratorAssignmentAllowsLockOnlyInsideAssignedCategory(t *testing.T) {}
func TestModeratorAssignmentRejectsPinWithoutPermissionBit(t *testing.T) {}
func TestAdminBypassesModeratorAssignment(t *testing.T) {}
```

核心断言：

```go
if _, err := service.LockTopic(moderator, topicInAssignedCategory.ID); err != nil {
	t.Fatalf("expected moderator assignment to allow lock: %v", err)
}
if _, err := service.LockTopic(moderator, topicOutsideAssignedCategory.ID); err == nil {
	t.Fatalf("expected unassigned category lock to fail")
}
```

- [ ] **Step 2: 运行 forum moderation tests，确认当前只有全局 role，分类作用域还不存在**

Run:

```bash
cd server && go test ./internal/modules/forum_moderation -run 'ModeratorAssignment|LockTopic|PinTopic' -v
```

Expected: FAIL，当前 `requireModerator()` 只检查 `role >= moderator`。

- [ ] **Step 3: 增加版主分配模型**

创建 `server/internal/model/forum_moderator_assignment.go`：

```go
package model

import "github.com/google/uuid"

type ForumModeratorAssignment struct {
	Base
	UserID                uuid.UUID      `json:"user_id" gorm:"type:uuid;not null;index"`
	User                  *User          `json:"user,omitempty" gorm:"foreignKey:UserID;references:UUID"`
	CategoryID            *uuid.UUID     `json:"category_id,omitempty" gorm:"type:uuid;index"`
	Category              *ForumCategory `json:"category,omitempty" gorm:"foreignKey:CategoryID"`
	CanReviewCategoryRequest bool        `json:"can_review_category_request" gorm:"not null;default:false"`
	CanPinTopic           bool           `json:"can_pin_topic" gorm:"not null;default:false"`
	CanLockTopic          bool           `json:"can_lock_topic" gorm:"not null;default:false"`
}

func (ForumModeratorAssignment) TableName() string { return "forum_moderator_assignments" }
```

并在两个 AutoMigrate 入口里加入：

```go
&model.ForumModeratorAssignment{},
```

- [ ] **Step 4: 改 forum moderation service 为“admin/owner 或 assignment 权限”**

把 `requireModerator()` 改成两层判定：

```go
func (s *Service) canModerateCategory(user authctx.CurrentUser, categoryID *uuid.UUID, need func(model.ForumModeratorAssignment) bool) error {
	if user.ID == uuid.Nil {
		return apperr.Unauthorized("Login required")
	}
	if authctx.RoleAtLeast(user.Role, authctx.RoleAdmin) {
		return nil
	}

	var assignments []model.ForumModeratorAssignment
	q := s.db.Where("user_id = ?", user.ID)
	if categoryID != nil {
		q = q.Where("category_id IS NULL OR category_id = ?", *categoryID)
	}
	if err := q.Find(&assignments).Error; err != nil {
		return err
	}
	for _, assignment := range assignments {
		if need(assignment) {
			return nil
		}
	}
	return apperr.Forbidden("auth.forbidden", "Moderator permission required")
}
```

`LockTopic()` / `HideTopic()` / `HideReply()` 等行为按目标 topic/reply 所属分类去调用这个判定；分类申请审批使用：

```go
return s.canModerateCategory(user, nil, func(a model.ForumModeratorAssignment) bool {
	return a.CanReviewCategoryRequest
})
```

同时在 `http.go` 增加版主管理接口：

```go
group.GET("/moderators", h.listModeratorAssignments)
group.POST("/moderators", h.createModeratorAssignment)
group.PUT("/moderators/:assignmentID", h.updateModeratorAssignment)
group.DELETE("/moderators/:assignmentID", h.deleteModeratorAssignment)
```

这些接口只允许 `admin` / `owner`。

- [ ] **Step 5: 运行测试并提交**

Run:

```bash
cd server && go test ./internal/modules/forum_moderation -v
cd .. && go test ./internal/app -run Forum -v
```

Expected:
- forum moderation tests PASS
- router/forum integration tests PASS

Commit:

```bash
git add server/internal/model/forum_moderator_assignment.go server/cmd/migrate/main.go server/cmd/start_server/main.go server/internal/modules/forum_moderation/service.go server/internal/modules/forum_moderation/service_test.go server/internal/modules/forum_moderation/http.go server/internal/modules/forum_moderation/http_test.go docs/api-v1.md
git commit -m "feat(forum): add category-scoped moderator assignments"
```

---

### Task 4: 重构 `/setting/access` 为模块设置中心

**Files:**
- Modify: `web/src/views/setting/SettingLayout.vue`
- Modify: `web/src/views/setting/SettingAccessView.vue`
- Create: `web/src/components/setting/SettingFeedSourcePanel.vue`
- Create: `web/src/components/setting/SettingForumModeratorPanel.vue`
- Modify: `web/src/views/setting/SettingFeedFullText.vue`

- [ ] **Step 1: 先写一个轻量的前端配置测试，锁定模块顺序与占位策略**

创建 `web/tests/unit/siteAccess-settings.spec.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { mergeSiteAccess } from '@/config/siteAccess'

describe('site access settings defaults', () => {
  it('provides structured defaults for feed blog and forum settings', () => {
    const access = mergeSiteAccess(null)
    expect(access.settings.feed.allow_manage_sources).toBe(true)
    expect(access.settings.feed.full_text_mode).toBe('per_source')
    expect(access.settings.blog.comment_mode).toBe('authenticated')
    expect(access.settings.forum.moderator_permissions.lock_topic).toBe(true)
  })
})
```

- [ ] **Step 2: 运行前端定向测试，确认新 settings 已被类型系统接住**

Run:

```bash
cd web && bun run test:unit -- tests/unit/siteAccess-settings.spec.ts
```

Expected: PASS；如果失败，先修 `mergeSiteAccess()`，再进入 UI 重构。

- [ ] **Step 3: 让 `SettingLayout.vue` 为 `/setting/access` 提供全宽焦点模式**

`SettingLayout.vue` 新增：

```ts
const isAccessHub = computed(() => route.path === '/setting/access')
```

模板改成：

```vue
<div v-if="isAccessHub" class="setting-layout__focus">
  <RouterView />
</div>
<div v-else class="setting-layout__shell">
  <aside class="setting-layout__sidebar">...</aside>
  <section class="setting-layout__content">
    <RouterView />
  </section>
</div>
```

这样 `/setting/access` 不再出现外层设置导航与内层模块导航重复叠加。

- [ ] **Step 4: 在 `SettingAccessView.vue` 搭建顶部模块栏 + 左侧模块导航 + 章节联动**

页面骨架直接改成：

```vue
<section class="setting-access">
  <header class="setting-access__header">...</header>

  <ASurface class="setting-access__module-toggle-bar" :layer="1">
    <h3 class="a-title-sm">启用模块</h3>
    <div class="setting-access__module-toggle-grid">
      <label v-for="key in moduleNavOrder" :key="key" class="setting-access__module-toggle-item">
        <span>{{ moduleRooms[key].name }}</span>
        <input v-model="draft.modules[key].enabled" type="checkbox" />
      </label>
    </div>
  </ASurface>

  <div class="setting-access__shell">
    <aside class="setting-access__module-nav">
      <button
        v-for="key in moduleNavOrder"
        :key="key"
        type="button"
        :class="{ 'is-active': activeSection === key }"
        @click="scrollToSection(key)"
      >
        {{ moduleRooms[key].name }}
      </button>
    </aside>

    <div class="setting-access__sections">
      <section
        v-for="key in moduleNavOrder"
        :id="`module-${key}`"
        :key="key"
        :ref="(el) => registerSection(key, el)"
      >
        ...
      </section>
    </div>
  </div>
</section>
```

脚本使用 `IntersectionObserver`：

```ts
const activeSection = ref<ModuleRoomKey>('feed')
const sectionMap = new Map<ModuleRoomKey, HTMLElement>()

function scrollToSection(key: ModuleRoomKey) {
  sectionMap.get(key)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
```

`Music / Debate / Timeline / Podcast / Video` 章节内容统一只放：

```vue
<p class="setting-access__placeholder">暂未开放具体配置</p>
```

- [ ] **Step 5: 运行类型检查并提交**

Run:

```bash
cd web && bun run type-check
```

Expected: PASS。

Commit:

```bash
git add web/src/views/setting/SettingLayout.vue web/src/views/setting/SettingAccessView.vue web/src/components/setting/SettingFeedSourcePanel.vue web/src/components/setting/SettingForumModeratorPanel.vue web/src/views/setting/SettingFeedFullText.vue web/tests/unit/siteAccess-settings.spec.ts
git commit -m "feat(settings): build admin settings hub layout"
```

---

### Task 5: 接入 Feed / Blog / Forum 三个模块的实际配置面板

**Files:**
- Create: `web/src/components/setting/SettingFeedSourcePanel.vue`
- Create: `web/src/components/setting/SettingForumModeratorPanel.vue`
- Modify: `web/src/views/setting/SettingAccessView.vue`
- Modify: `web/src/composables/useApi.ts`
- Modify: `web/src/types.ts`
- Modify: `web/src/stores/siteAccess.ts`

- [ ] **Step 1: 先提炼 Feed 来源管理面板**

`SettingFeedSourcePanel.vue` 直接复用现有 `SettingFeedFullText.vue` 的 store 与来源列表逻辑，但删掉健康卡，只保留：

```vue
<div class="setting-feed-panel">
  <ATextarea v-model="rssUrl" label="新订阅源 URL" :rows="2" />
  <ABtn @click="submitSource" :disabled="!rssUrl.trim() || !allowAddSource">添加新源</ABtn>

  <div v-for="source in store.sources" :key="source.id" class="setting-feed-panel__source-row">
    <div>
      <strong>{{ source.title || source.rss_url }}</strong>
      <small>{{ source.rss_url }}</small>
    </div>
    <label>
      <span>全文抓取</span>
      <input
        :checked="source.full_text_enabled"
        type="checkbox"
        :disabled="fullTextMode !== 'per_source'"
        @click.prevent="toggleSource(source)"
      />
    </label>
  </div>
</div>
```

添加新源时直接复用现有订阅 API：

```ts
await fetch(api.v1.url + '/subscriptions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${authStore.token}`,
  },
  body: JSON.stringify({
    target_type: 'external_rss',
    rss_url: rssUrl.value.trim(),
  }),
})
```

- [ ] **Step 2: 接入 Blog 评论模式**

`SettingAccessView.vue` 的 Blog 章节使用单选组，而不是 checkbox：

```vue
<label v-for="mode in blogCommentModes" :key="mode.value" class="setting-access__radio-row">
  <input v-model="draft.settings.blog.comment_mode" type="radio" :value="mode.value" />
  <div>
    <strong>{{ mode.label }}</strong>
    <small>{{ mode.description }}</small>
  </div>
</label>
```

模式常量直接写死：

```ts
const blogCommentModes = [
  { value: 'all', label: '全部可评论', description: '游客可匿名评论，已登录用户正常署名。' },
  { value: 'authenticated', label: '仅登录用户可评论', description: '保持当前默认行为。' },
  { value: 'disabled', label: '关闭评论', description: '全站文章评论入口关闭。' },
] as const
```

- [ ] **Step 3: 接入 Forum 申请分类与版主管理**

`SettingForumModeratorPanel.vue` 的数据结构直接对应新后端接口：

```ts
type ForumModeratorAssignment = {
  id: string
  user_id: string
  category_id?: string
  can_review_category_request: boolean
  can_pin_topic: boolean
  can_lock_topic: boolean
  user?: { uuid: string; username: string; display_name?: string }
  category?: { id: string; name: string }
}
```

面板最小交互：
- 搜索用户
- 选择负责分类
- 勾选三个权限位
- 保存 assignment
- 删除 assignment

`SettingAccessView.vue` 的 Forum 章节保留一个总开关：

```vue
<label class="setting-access__feature-row">
  <div>
    <strong>申请分类</strong>
    <small>控制普通用户是否可发起新分类申请。</small>
  </div>
  <input v-model="draft.settings.forum.allow_category_request" type="checkbox" />
</label>
```

版主管理面板单独挂在下面：

```vue
<SettingForumModeratorPanel v-if="draft.modules.forum.enabled" />
```

- [ ] **Step 4: 跑前端检查与一个端到端 smoke**

Run:

```bash
cd web && bun run type-check
cd .. && go build ./...
```

Expected:
- `bun run type-check` PASS
- `go build ./...` PASS

如果本地前端能起服务，再额外做一次 smoke：

```bash
cd web && bun run dev
```

手动验证：
- `/setting/access` 顶部能切模块总开关
- Feed 章节能添加 RSS 源并切全文抓取
- Blog 章节能切评论模式
- Forum 章节能管理版主 assignment

- [ ] **Step 5: 提交**

```bash
git add web/src/components/setting/SettingFeedSourcePanel.vue web/src/components/setting/SettingForumModeratorPanel.vue web/src/views/setting/SettingAccessView.vue web/src/composables/useApi.ts web/src/types.ts web/src/stores/siteAccess.ts
git commit -m "feat(settings): wire feed blog forum module controls"
```

---

### Task 6: 收口路由、契约文档和最终验证

**Files:**
- Modify: `docs/api-v1.md`
- Modify: `web/src/router/routes/settings.ts` (如需保留 deep-dive route 文案)
- Modify: `web/src/views/setting/SettingFeedFullText.vue` (如需改成“诊断台”定位)

- [ ] **Step 1: 更新 API 契约**

在 `docs/api-v1.md` 的 `GET/PUT /api/v1/settings/site-access` 响应体示例里，把新结构写完整：

```json
{
  "version": 1,
  "modules": {
    "feed": {
      "enabled": true,
      "features": {
        "subscription.manage": true
      }
    }
  },
  "settings": {
    "feed": {
      "allow_manage_sources": true,
      "allow_add_source": true,
      "full_text_mode": "per_source"
    },
    "blog": {
      "comment_mode": "authenticated"
    },
    "forum": {
      "allow_category_request": true,
      "moderator_permissions": {
        "review_category_request": true,
        "pin_topic": true,
        "lock_topic": true
      }
    }
  }
}
```

同时新增 forum moderator settings API：

```text
GET    /api/v1/settings/forum-moderators
POST   /api/v1/settings/forum-moderators
PUT    /api/v1/settings/forum-moderators/:assignmentId
DELETE /api/v1/settings/forum-moderators/:assignmentId
```

- [ ] **Step 2: 调整旧页面文案，避免 Feed Full Text 与新的 Feed 章节冲突**

如果保留 `SettingFeedFullText.vue`，把标题改成“全文抓取诊断台”，说明它是深度诊断页，不是主设置入口：

```vue
<h2 class="a-title-sm">全文抓取诊断台</h2>
<p class="a-muted">模块设置页用于配置开关，这里保留给管理员做问题排查与失败重试。</p>
```

- [ ] **Step 3: 运行最终验证命令**

Run:

```bash
cd server && go test ./internal/service ./internal/handlers ./internal/modules/forum_moderation -v
cd .. && go build ./...
cd web && bun run type-check
```

Expected:
- 三组 Go 测试 PASS
- `go build ./...` PASS
- `bun run type-check` PASS

- [ ] **Step 4: 如验证通过，做最终提交**

```bash
git add docs/api-v1.md web/src/router/routes/settings.ts web/src/views/setting/SettingFeedFullText.vue
git commit -m "docs(settings): finalize admin settings hub contract"
```

- [ ] **Step 5: 人工验收清单**

在浏览器手动确认：

```text
1. /setting/access 左侧模块导航会随滚动切换高亮
2. 顶部启用模块栏不在模块章节里重复出现
3. Feed 章节可以添加新源，并能按订阅源控制全文抓取
4. Blog 评论模式切到 disabled 后，文章详情评论区关闭
5. Blog 评论模式切到 authenticated 时，游客只能看到登录提示
6. Blog 评论模式切到 all 时，游客可以匿名发表评论
7. Forum 章节可以创建、编辑、删除版主 assignment
8. 非分配版主不能锁帖/置顶，分配后只能在负责分类内操作
9. Music / Debate / Timeline / Podcast / Video 章节只显示“暂未开放具体配置”
```

---

## Self-Review

### Spec coverage
- 顶部启用模块栏：Task 4
- 左侧导航与滚动联动：Task 4
- Feed 三项配置：Task 1 + Task 5
- Blog 三档评论权限：Task 1 + Task 2 + Task 5
- Forum 申请分类与版主管理：Task 1 + Task 3 + Task 5
- 占位模块：Task 4
- API 契约更新：Task 1 + Task 6

### Placeholder scan
- 计划内没有 `TODO`、`TBD`、`similar to` 等占位语。
- 每个新增后端能力都有对应文件、测试和命令。

### Type consistency
- `site-access` 的结构化设置统一使用 `settings.feed / settings.blog / settings.forum`
- `blog.comment_mode` 统一使用 `all | authenticated | disabled`
- forum moderator assignment 统一使用 `can_review_category_request / can_pin_topic / can_lock_topic`

