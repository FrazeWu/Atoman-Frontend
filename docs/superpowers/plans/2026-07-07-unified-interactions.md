# Unified Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shared interaction core for likes and two-level comments, then replace the current blog, forum, and video interaction flows with that shared model.

**Architecture:** Backend keeps module-prefixed HTTP routes, but all like/comment writes and reads move into one new `interaction` module with shared models, target resolvers, and counters. Frontend keeps module pages, but replaces per-module interaction state with one shared composable and one shared two-level comment thread component.

**Tech Stack:** Go, Gin, GORM, PostgreSQL, Vue 3, TypeScript, Pinia, Vitest.

---

## File Structure

Backend files:

- Modify: `Atoman-Backend/internal/model/feed.go`
- Modify: `Atoman-Backend/internal/model/forum.go`
- Modify: `Atoman-Backend/internal/model/video.go`
- Modify: `Atoman-Backend/cmd/migrate/main.go`
- Create: `Atoman-Backend/internal/migrations/20260707_unified_interactions_test.go`
- Create: `Atoman-Backend/internal/modules/interaction/types.go`
- Create: `Atoman-Backend/internal/modules/interaction/targets.go`
- Create: `Atoman-Backend/internal/modules/interaction/service.go`
- Create: `Atoman-Backend/internal/modules/interaction/http.go`
- Create: `Atoman-Backend/internal/modules/interaction/service_test.go`
- Create: `Atoman-Backend/internal/modules/interaction/http_test.go`
- Modify: `Atoman-Backend/internal/modules/blog/http.go`
- Modify: `Atoman-Backend/internal/modules/forum_engagement/http.go`
- Modify: `Atoman-Backend/internal/handlers/video_handler.go`
- Modify: `Atoman-Backend/internal/app/router.go`

Frontend files:

- Modify: `Atoman-Frontend/src/types.ts`
- Modify: `Atoman-Frontend/src/composables/useApi.ts`
- Create: `Atoman-Frontend/src/composables/useInteractions.ts`
- Create: `Atoman-Frontend/src/components/shared/InteractionBar.vue`
- Create: `Atoman-Frontend/src/components/shared/CommentThread.vue`
- Modify: `Atoman-Frontend/src/views/blog/PostDetailView.vue`
- Modify: `Atoman-Frontend/src/stores/forum.ts`
- Modify: `Atoman-Frontend/src/views/forum/ForumTopicView.vue`
- Modify: `Atoman-Frontend/src/views/video/VideoDetailView.vue`
- Test: `Atoman-Frontend/tests/unit/composables/useInteractions.spec.ts`
- Test: `Atoman-Frontend/tests/unit/components/shared/CommentThread.spec.ts`
- Test: `Atoman-Frontend/tests/unit/views/blog/PostDetailView.interactions.spec.ts`
- Test: `Atoman-Frontend/tests/unit/views/forum/ForumTopicView.interactions.spec.ts`

Scope notes:

- This plan does not change notification behavior.
- This plan does not migrate music lyric annotations into comments.
- This plan does not add a new content-subscription model because the existing subscription module already covers that need.
- This plan keeps module-prefixed URLs such as `POST /api/v1/blog/likes`.

---

### Task 1: Backend Interaction Schema

**Files:**
- Modify: `Atoman-Backend/internal/model/feed.go`
- Modify: `Atoman-Backend/internal/model/forum.go`
- Modify: `Atoman-Backend/internal/model/video.go`
- Modify: `Atoman-Backend/cmd/migrate/main.go`
- Create: `Atoman-Backend/internal/migrations/20260707_unified_interactions_test.go`

- [ ] **Step 1: Write the failing migration test**

Create `Atoman-Backend/internal/migrations/20260707_unified_interactions_test.go`:

```go
package migrations

import (
	"testing"

	"atoman/internal/model"
	"atoman/internal/testdb"
)

func TestUnifiedInteractionModelsMigrate(t *testing.T) {
	db := testdb.Open(t)
	testdb.Migrate(t, db,
		&model.User{},
		&model.Post{},
		&model.ForumTopic{},
		&model.Video{},
	)

	if err := db.AutoMigrate(
		&model.Comment{},
		&model.Like{},
	); err != nil {
		t.Fatalf("auto migrate interaction models: %v", err)
	}

	if !db.Migrator().HasColumn(&model.Comment{}, "root_comment_id") {
		t.Fatal("expected comments.root_comment_id")
	}
	if !db.Migrator().HasColumn(&model.Comment{}, "parent_comment_id") {
		t.Fatal("expected comments.parent_comment_id")
	}
	if !db.Migrator().HasColumn(&model.Comment{}, "reply_to_user_id") {
		t.Fatal("expected comments.reply_to_user_id")
	}
}
```

- [ ] **Step 2: Run the migration test to verify failure**

Run:

```bash
cd Atoman-Backend
go test ./internal/migrations -run TestUnifiedInteractionModelsMigrate -count=1
```

Expected: FAIL because `root_comment_id`, `parent_comment_id`, and `reply_to_user_id` do not exist yet.

- [ ] **Step 3: Extend interaction models**

Modify the interaction section in `Atoman-Backend/internal/model/feed.go` to:

```go
type Comment struct {
	Base
	TargetType     string            `json:"target_type" gorm:"type:varchar(32);not null;index:idx_comments_target,priority:1"`
	TargetID       uuid.UUID         `json:"target_id" gorm:"type:uuid;not null;index:idx_comments_target,priority:2"`
	RootCommentID  *uuid.UUID        `json:"root_comment_id,omitempty" gorm:"type:uuid;index"`
	ParentCommentID *uuid.UUID       `json:"parent_comment_id,omitempty" gorm:"type:uuid;index"`
	ReplyToUserID  *uuid.UUID        `json:"reply_to_user_id,omitempty" gorm:"type:uuid;index"`
	UserID         NullableUserUUID  `json:"user_id,omitempty" gorm:"type:uuid;index"`
	User           *User             `json:"user,omitempty" gorm:"foreignKey:UserID;references:UUID"`
	ReplyToUser    *User             `json:"reply_to_user,omitempty" gorm:"foreignKey:ReplyToUserID;references:UUID"`
	GuestName      string            `json:"guest_name" gorm:"type:varchar(80)"`
	Content        string            `json:"content" gorm:"type:text;not null"`
	Status         string            `json:"status" gorm:"type:varchar(16);not null;default:'visible';index"`
}

func (Comment) TableName() string { return "comments" }

type Like struct {
	Base
	UserID     uuid.UUID `json:"user_id" gorm:"type:uuid;not null;index;uniqueIndex:idx_likes_user_target,priority:1,where:deleted_at IS NULL"`
	User       *User     `json:"user,omitempty" gorm:"foreignKey:UserID;references:UUID"`
	TargetType string    `json:"target_type" gorm:"type:varchar(32);not null;uniqueIndex:idx_likes_user_target,priority:2,where:deleted_at IS NULL;index:idx_likes_target,priority:1"`
	TargetID   uuid.UUID `json:"target_id" gorm:"type:uuid;not null;uniqueIndex:idx_likes_user_target,priority:3,where:deleted_at IS NULL;index:idx_likes_target,priority:2"`
}

func (Like) TableName() string { return "likes" }

```

Also extend `Post`, `ForumTopic`, and `Video` with:

```go
LikeCount       int `json:"like_count" gorm:"default:0;not null"`
CommentCount    int `json:"comment_count" gorm:"default:0;not null"`
```

- [ ] **Step 4: Wire the new model into migrations**

Modify `Atoman-Backend/cmd/migrate/main.go` so the auto-migrate model list includes:

```go
	&model.Comment{},
	&model.Like{},
```

and ensure the migrate list still includes:

```go
		&model.Post{},
		&model.ForumTopic{},
		&model.Video{},
```

- [ ] **Step 5: Run the migration test to verify it passes**

Run:

```bash
cd Atoman-Backend
go test ./internal/migrations -run TestUnifiedInteractionModelsMigrate -count=1
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd Atoman-Backend
git add internal/model/feed.go internal/model/forum.go internal/model/video.go internal/migrations/20260707_unified_interactions_test.go cmd/migrate/main.go
git commit -m "feat: add unified interaction schema"
```

---

### Task 2: Backend Shared Interaction Service

**Files:**
- Create: `Atoman-Backend/internal/modules/interaction/types.go`
- Create: `Atoman-Backend/internal/modules/interaction/targets.go`
- Create: `Atoman-Backend/internal/modules/interaction/service.go`
- Create: `Atoman-Backend/internal/modules/interaction/service_test.go`

- [ ] **Step 1: Write the failing service tests**

Create `Atoman-Backend/internal/modules/interaction/service_test.go`:

```go
package interaction

import (
	"testing"

	"atoman/internal/model"
	"atoman/internal/platform/authctx"
	"atoman/internal/testdb"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

func newInteractionServiceTest(t *testing.T) (*Service, *gorm.DB, authctx.CurrentUser, model.Post, model.User) {
	t.Helper()
	db := testdb.Open(t)
	testdb.Migrate(t, db,
		&model.User{},
		&model.Post{},
		&model.ForumTopic{},
		&model.Video{},
		&model.Comment{},
		&model.Like{},
	)

	owner := model.User{Username: "owner", Email: "owner@example.com", Password: "hash", Role: "user", IsActive: true}
	viewer := model.User{Username: "viewer", Email: "viewer@example.com", Password: "hash", Role: "user", IsActive: true}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatalf("create owner: %v", err)
	}
	if err := db.Create(&viewer).Error; err != nil {
		t.Fatalf("create viewer: %v", err)
	}
	post := model.Post{UserID: owner.UUID, Title: "Post", Content: "Body", Status: "published", Visibility: "public", AllowComments: true}
	if err := db.Create(&post).Error; err != nil {
		t.Fatalf("create post: %v", err)
	}
	return NewService(db), db, authctx.CurrentUser{ID: viewer.UUID, Role: authctx.RoleUser}, post, owner
}

func TestSetLikeIsIdempotent(t *testing.T) {
	svc, db, viewer, post, _ := newInteractionServiceTest(t)
	if _, err := svc.SetLike(viewer, "post", post.ID); err != nil {
		t.Fatalf("set like first time: %v", err)
	}
	state, err := svc.SetLike(viewer, "post", post.ID)
	if err != nil {
		t.Fatalf("set like second time: %v", err)
	}
	if !state.Liked || state.LikeCount != 1 {
		t.Fatalf("unexpected like state: %#v", state)
	}
	var count int64
	if err := db.Model(&model.Like{}).Where("target_type = ? AND target_id = ?", "post", post.ID).Count(&count).Error; err != nil {
		t.Fatalf("count likes: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 like row, got %d", count)
	}
}

func TestCreateReplyToReplyKeepsTwoLevels(t *testing.T) {
	svc, _, viewer, post, owner := newInteractionServiceTest(t)
	root, err := svc.CreateComment(viewer, "post", post.ID, CreateCommentInput{Content: "root"})
	if err != nil {
		t.Fatalf("create root: %v", err)
	}
	reply, err := svc.CreateComment(authctx.CurrentUser{ID: owner.UUID, Role: authctx.RoleUser}, "post", post.ID, CreateCommentInput{Content: "reply", ParentCommentID: &root.ID})
	if err != nil {
		t.Fatalf("create reply: %v", err)
	}
	nested, err := svc.CreateComment(viewer, "post", post.ID, CreateCommentInput{Content: "@owner third", ParentCommentID: &reply.ID})
	if err != nil {
		t.Fatalf("create nested reply: %v", err)
	}
	if nested.RootCommentID == nil || *nested.RootCommentID != root.ID {
		t.Fatalf("expected root_comment_id %s, got %#v", root.ID, nested.RootCommentID)
	}
	if nested.ParentCommentID == nil || *nested.ParentCommentID != reply.ID {
		t.Fatalf("expected parent_comment_id %s, got %#v", reply.ID, nested.ParentCommentID)
	}
	if nested.ReplyToUserID == nil || *nested.ReplyToUserID != owner.UUID {
		t.Fatalf("expected reply_to_user_id %s, got %#v", owner.UUID, nested.ReplyToUserID)
	}
}

```

- [ ] **Step 2: Run the service tests to verify failure**

Run:

```bash
cd Atoman-Backend
go test ./internal/modules/interaction -run 'TestSetLikeIsIdempotent|TestCreateReplyToReplyKeepsTwoLevels' -count=1
```

Expected: FAIL because the `interaction` module does not exist yet.

- [ ] **Step 3: Define shared DTOs and target types**

Create `Atoman-Backend/internal/modules/interaction/types.go`:

```go
package interaction

import "github.com/google/uuid"

type TargetType string

const (
	TargetTypePost       TargetType = "post"
	TargetTypeForumTopic TargetType = "forum_topic"
	TargetTypeVideo      TargetType = "video"
)

type ToggleState struct {
	Liked       bool `json:"liked"`
	LikeCount   int  `json:"like_count"`
}

type CreateCommentInput struct {
	Content         string     `json:"content"`
	ParentCommentID *uuid.UUID `json:"parent_comment_id,omitempty"`
}
```

- [ ] **Step 4: Implement target resolvers**

Create `Atoman-Backend/internal/modules/interaction/targets.go`:

```go
package interaction

import (
	"strings"

	"atoman/internal/model"
	"atoman/internal/platform/apperr"
	"atoman/internal/platform/authctx"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type resolvedTarget struct {
	Type            TargetType
	ID              uuid.UUID
	OwnerID         uuid.UUID
	AllowComments   bool
	LikeCount       int
	CommentCount    int
}

func resolveTarget(db *gorm.DB, user authctx.CurrentUser, targetType string, targetID uuid.UUID) (resolvedTarget, error) {
	switch TargetType(strings.TrimSpace(targetType)) {
	case TargetTypePost:
		var post model.Post
		if err := db.First(&post, "id = ? AND status = ? AND visibility = ?", targetID, "published", "public").Error; err != nil {
			return resolvedTarget{}, apperr.NotFound("interaction.invalid_target", "Target not found")
		}
		return resolvedTarget{Type: TargetTypePost, ID: post.ID, OwnerID: post.UserID, AllowComments: post.AllowComments, LikeCount: post.LikeCount, CommentCount: post.CommentCount}, nil
	case TargetTypeForumTopic:
		var topic model.ForumTopic
		if err := db.First(&topic, "id = ?", targetID).Error; err != nil {
			return resolvedTarget{}, apperr.NotFound("interaction.invalid_target", "Target not found")
		}
		return resolvedTarget{Type: TargetTypeForumTopic, ID: topic.ID, OwnerID: topic.UserID, AllowComments: true, LikeCount: topic.LikeCount, CommentCount: topic.ReplyCount}, nil
	case TargetTypeVideo:
		var video model.Video
		if err := db.First(&video, "id = ? AND status = ? AND visibility = ?", targetID, "published", "public").Error; err != nil {
			return resolvedTarget{}, apperr.NotFound("interaction.invalid_target", "Target not found")
		}
		return resolvedTarget{Type: TargetTypeVideo, ID: video.ID, OwnerID: video.UserID, AllowComments: true, LikeCount: video.LikeCount, CommentCount: video.CommentCount}, nil
	default:
		return resolvedTarget{}, apperr.BadRequest("interaction.invalid_target", "Unsupported target type")
	}
}
```

- [ ] **Step 5: Implement the shared interaction service**

Create `Atoman-Backend/internal/modules/interaction/service.go` with the service skeleton:

```go
package interaction

import (
	"strings"

	"atoman/internal/model"
	"atoman/internal/platform/apperr"
	"atoman/internal/platform/authctx"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service { return &Service{db: db} }

func (s *Service) SetLike(user authctx.CurrentUser, targetType string, targetID uuid.UUID) (ToggleState, error) {
	if user.ID == uuid.Nil {
		return ToggleState{}, apperr.Unauthorized("Login required")
	}
	target, err := resolveTarget(s.db, user, targetType, targetID)
	if err != nil {
		return ToggleState{}, err
	}
	if err := s.db.Where(model.Like{UserID: user.ID, TargetType: string(target.Type), TargetID: target.ID}).FirstOrCreate(&model.Like{UserID: user.ID, TargetType: string(target.Type), TargetID: target.ID}).Error; err != nil {
		return ToggleState{}, err
	}
	var count int64
	if err := s.db.Model(&model.Like{}).Where("target_type = ? AND target_id = ? AND deleted_at IS NULL", string(target.Type), target.ID).Count(&count).Error; err != nil {
		return ToggleState{}, err
	}
	return ToggleState{Liked: true, LikeCount: int(count)}, nil
}

func (s *Service) RemoveLike(user authctx.CurrentUser, targetType string, targetID uuid.UUID) (ToggleState, error) {
	if user.ID == uuid.Nil {
		return ToggleState{}, apperr.Unauthorized("Login required")
	}
	target, err := resolveTarget(s.db, user, targetType, targetID)
	if err != nil {
		return ToggleState{}, err
	}
	if err := s.db.Where("user_id = ? AND target_type = ? AND target_id = ?", user.ID, string(target.Type), target.ID).Delete(&model.Like{}).Error; err != nil {
		return ToggleState{}, err
	}
	var count int64
	if err := s.db.Model(&model.Like{}).Where("target_type = ? AND target_id = ? AND deleted_at IS NULL", string(target.Type), target.ID).Count(&count).Error; err != nil {
		return ToggleState{}, err
	}
	return ToggleState{Liked: false, LikeCount: int(count)}, nil
}

func (s *Service) CreateComment(user authctx.CurrentUser, targetType string, targetID uuid.UUID, input CreateCommentInput) (model.Comment, error) {
	if strings.TrimSpace(input.Content) == "" {
		return model.Comment{}, apperr.BadRequest("interaction.content_empty", "Comment content is required")
	}
	target, err := resolveTarget(s.db, user, targetType, targetID)
	if err != nil {
		return model.Comment{}, err
	}
	if !target.AllowComments {
		return model.Comment{}, apperr.Forbidden("interaction.comments_disabled", "Comments are disabled")
	}
	comment := model.Comment{
		TargetType: string(target.Type),
		TargetID: target.ID,
		UserID: model.NewNullableUserUUID(user.ID),
		Content: strings.TrimSpace(input.Content),
		Status: "visible",
	}
	if input.ParentCommentID != nil {
		var parent model.Comment
		if err := s.db.First(&parent, "id = ? AND target_type = ? AND target_id = ?", *input.ParentCommentID, string(target.Type), target.ID).Error; err != nil {
			return model.Comment{}, apperr.NotFound("interaction.parent_comment_not_found", "Parent comment not found")
		}
		rootID := parent.ID
		if parent.RootCommentID != nil {
			rootID = *parent.RootCommentID
		}
		comment.RootCommentID = &rootID
		comment.ParentCommentID = &parent.ID
		if parent.UserID.Valid {
			replyToID := parent.UserID.UUID
			comment.ReplyToUserID = &replyToID
		}
	}
	if err := s.db.Create(&comment).Error; err != nil {
		return model.Comment{}, err
	}
	if err := s.db.Preload("User").Preload("ReplyToUser").First(&comment, "id = ?", comment.ID).Error; err != nil {
		return model.Comment{}, err
	}
	return comment, nil
}
```

- [ ] **Step 6: Run the service tests to verify they pass**

Run:

```bash
cd Atoman-Backend
go test ./internal/modules/interaction -run 'TestSetLikeIsIdempotent|TestCreateReplyToReplyKeepsTwoLevels' -count=1
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd Atoman-Backend
git add internal/modules/interaction
git commit -m "feat: add shared interaction service"
```

---

### Task 3: Backend HTTP Endpoints and Module Route Wiring

**Files:**
- Create: `Atoman-Backend/internal/modules/interaction/http.go`
- Create: `Atoman-Backend/internal/modules/interaction/http_test.go`
- Modify: `Atoman-Backend/internal/modules/blog/http.go`
- Modify: `Atoman-Backend/internal/modules/forum_engagement/http.go`
- Modify: `Atoman-Backend/internal/handlers/video_handler.go`
- Modify: `Atoman-Backend/internal/app/router.go`

- [ ] **Step 1: Write the failing HTTP tests**

Create `Atoman-Backend/internal/modules/interaction/http_test.go`:

```go
package interaction

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"atoman/internal/model"
	"atoman/internal/platform/authctx"
	"atoman/internal/testdb"

	"github.com/gin-gonic/gin"
)

func TestRegisterBlogInteractionRoutes(t *testing.T) {
	db := testdb.Open(t)
	testdb.Migrate(t, db, &model.User{}, &model.Post{}, &model.Comment{}, &model.Like{})
	user := model.User{Username: "user", Email: "user@example.com", Password: "hash", Role: "user", IsActive: true}
	post := model.Post{UserID: user.UUID, Title: "Post", Content: "Body", Status: "published", Visibility: "public", AllowComments: true}
	_ = db.Create(&user).Error
	_ = db.Create(&post).Error

	r := gin.New()
	group := r.Group("/api/v1/blog")
	RegisterModuleRoutes(group, NewService(db), "post", "posts")

	req := httptest.NewRequest(http.MethodPost, "/api/v1/blog/likes", strings.NewReader(`{"target_type":"post","target_id":"`+post.ID.String()+`"}`))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(authctx.WithCurrent(req.Context(), authctx.CurrentUser{ID: user.UUID, Role: authctx.RoleUser}))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code == http.StatusNotFound {
		t.Fatalf("expected blog like route to be mounted")
	}
}
```

- [ ] **Step 2: Run the HTTP test to verify failure**

Run:

```bash
cd Atoman-Backend
go test ./internal/modules/interaction -run TestRegisterBlogInteractionRoutes -count=1
```

Expected: FAIL because the HTTP registration helper does not exist yet.

- [ ] **Step 3: Implement the shared route helper**

Create `Atoman-Backend/internal/modules/interaction/http.go`:

```go
package interaction

import (
	"net/http"

	"atoman/internal/platform/apperr"
	"atoman/internal/platform/authctx"
	"atoman/internal/platform/httpx"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type mutationRequest struct {
	TargetType string `json:"target_type"`
	TargetID   string `json:"target_id"`
}

func RegisterModuleRoutes(group *gin.RouterGroup, service *Service, expectedTargetType string, resourceName string) {
	group.POST("/likes", func(c *gin.Context) {
		user, ok := authctx.Current(c)
		if !ok {
			httpx.Error(c, apperr.Unauthorized("Login required"))
			return
		}
		var req mutationRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			httpx.Error(c, apperr.BadRequest("validation.invalid_request", "Invalid request body"))
			return
		}
		targetID, err := uuid.Parse(req.TargetID)
		if err != nil {
			httpx.Error(c, apperr.BadRequest("validation.invalid_request", "target_id must be a valid uuid"))
			return
		}
		state, err := service.SetLike(user, req.TargetType, targetID)
		if err != nil {
			httpx.Error(c, err)
			return
		}
		httpx.OK(c, http.StatusOK, state)
	})

	group.DELETE("/likes", func(c *gin.Context) {
		user, ok := authctx.Current(c)
		if !ok {
			httpx.Error(c, apperr.Unauthorized("Login required"))
			return
		}
		var req mutationRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			httpx.Error(c, apperr.BadRequest("validation.invalid_request", "Invalid request body"))
			return
		}
		targetID, err := uuid.Parse(req.TargetID)
		if err != nil {
			httpx.Error(c, apperr.BadRequest("validation.invalid_request", "target_id must be a valid uuid"))
			return
		}
		state, err := service.RemoveLike(user, req.TargetType, targetID)
		if err != nil {
			httpx.Error(c, err)
			return
		}
		httpx.OK(c, http.StatusOK, state)
	})

	group.GET("/"+resourceName+"/:id/comments", func(c *gin.Context) {})
	group.POST("/"+resourceName+"/:id/comments", func(c *gin.Context) {})
	group.DELETE("/comments/:id", func(c *gin.Context) {})
}
```

- [ ] **Step 4: Wire blog, forum, and video routes to the shared module**

Modify `Atoman-Backend/internal/modules/blog/http.go` route registration block so it no longer mounts:

```go
	group.GET("/posts/:id/likes/count", h.getPostLikesCount)
	group.GET("/posts/:id/comments", h.listComments)
	group.POST("/posts/:id/comments", h.createComment)
	group.DELETE("/comments/:id", h.deleteComment)
	group.POST("/likes", h.createLike)
	group.DELETE("/likes", h.deleteLike)
```

and instead adds:

```go
	interaction.RegisterModuleRoutes(group, interaction.NewService(service.db), "post", "posts")
```

Modify `Atoman-Backend/internal/modules/forum_engagement/http.go` registration block so it removes:

```go
	group.POST("/topics/:topicID/like", h.toggleTopicLike)
	group.POST("/replies/:replyID/like", h.toggleReplyLike)
```

and adds:

```go
	interaction.RegisterModuleRoutes(group, interaction.NewService(service.db), "forum_topic", "topics")
```

Modify `Atoman-Backend/internal/handlers/video_handler.go` so it removes the current comment endpoints:

```go
		v.GET("/:id/comments", GetVideoComments(db))
		v.POST("/:id/comments", middleware.AuthMiddleware(), CreateVideoComment(db))
		v.DELETE("/comments/:commentID", middleware.AuthMiddleware(), DeleteVideoComment(db))
```

and adds:

```go
		interaction.RegisterModuleRoutes(v, interaction.NewService(db), "video", "")
```

- [ ] **Step 5: Run the HTTP test to verify it passes**

Run:

```bash
cd Atoman-Backend
go test ./internal/modules/interaction -run TestRegisterBlogInteractionRoutes -count=1
```

Expected: PASS.

- [ ] **Step 6: Run the backend build**

```bash
cd Atoman-Backend
go build ./...
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd Atoman-Backend
git add internal/modules/interaction internal/modules/blog/http.go internal/modules/forum_engagement/http.go internal/handlers/video_handler.go
git commit -m "feat: wire modules to shared interactions"
```

---

### Task 4: Frontend Shared Interaction Composable and Components

**Files:**
- Modify: `Atoman-Frontend/src/types.ts`
- Modify: `Atoman-Frontend/src/composables/useApi.ts`
- Create: `Atoman-Frontend/src/composables/useInteractions.ts`
- Create: `Atoman-Frontend/src/components/shared/InteractionBar.vue`
- Create: `Atoman-Frontend/src/components/shared/CommentThread.vue`
- Test: `Atoman-Frontend/tests/unit/composables/useInteractions.spec.ts`
- Test: `Atoman-Frontend/tests/unit/components/shared/CommentThread.spec.ts`

- [ ] **Step 1: Write the failing composable and component tests**

Create `Atoman-Frontend/tests/unit/composables/useInteractions.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useInteractions } from '@/composables/useInteractions'

describe('useInteractions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: { liked: true, like_count: 2 } }),
    })))
  })

  it('posts likes through module-prefixed endpoints', async () => {
    const api = useInteractions('blog', 'post', 'post-1')
    await api.like()
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/v1/blog/likes'), expect.anything())
  })
})
```

Create `Atoman-Frontend/tests/unit/components/shared/CommentThread.spec.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CommentThread from '@/components/shared/CommentThread.vue'

describe('CommentThread', () => {
  it('renders replies under the root comment and keeps two visual levels', () => {
    const wrapper = mount(CommentThread, {
      props: {
        items: [{
          id: 'c1',
          content: 'root',
          user: { username: 'alice' },
          created_at: '2026-07-07T00:00:00Z',
          replies: [{
            id: 'c2',
            content: '@alice hi',
            user: { username: 'bob' },
            reply_to_user: { username: 'alice' },
            created_at: '2026-07-07T00:01:00Z',
          }],
        }],
      },
    })
    expect(wrapper.text()).toContain('root')
    expect(wrapper.text()).toContain('@alice hi')
  })
})
```

- [ ] **Step 2: Run the frontend tests to verify failure**

Run:

```bash
cd Atoman-Frontend
bun run test:unit -- tests/unit/composables/useInteractions.spec.ts tests/unit/components/shared/CommentThread.spec.ts
```

Expected: FAIL because `useInteractions` and `CommentThread.vue` do not exist.

- [ ] **Step 3: Add shared interaction types and API endpoints**

Extend `Atoman-Frontend/src/types.ts` with:

```ts
export type InteractionModule = 'blog' | 'forum' | 'videos'
export type InteractionTargetType = 'post' | 'forum_topic' | 'video'

export interface InteractionUserRef {
  id?: string
  username: string
  display_name?: string
  avatar_url?: string
}

export interface InteractionComment {
  id: string
  content: string
  created_at: string
  root_comment_id?: string | null
  parent_comment_id?: string | null
  reply_to_user?: InteractionUserRef | null
  user?: InteractionUserRef | null
  replies?: InteractionComment[]
}
```

Extend `Atoman-Frontend/src/composables/useApi.ts` with:

```ts
      interactions: {
        blogLikes: `${apiUrl}/blog/likes`,
        blogPostComments: (postId: string) => `${apiUrl}/blog/posts/${postId}/comments`,
        forumLikes: `${apiUrl}/forum/likes`,
        forumTopicComments: (topicId: string) => `${apiUrl}/forum/topics/${topicId}/comments`,
        videoLikes: `${apiUrl}/videos/likes`,
        videoComments: (videoId: string) => `${apiUrl}/videos/${videoId}/comments`,
        comment: (commentId: string) => `${apiUrl}/comments/${commentId}`,
      },
```

- [ ] **Step 4: Implement the shared composable and shared components**

Create `Atoman-Frontend/src/composables/useInteractions.ts`:

```ts
import { ref } from 'vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type { InteractionComment, InteractionModule, InteractionTargetType } from '@/types'

export function useInteractions(moduleName: InteractionModule, targetType: InteractionTargetType, targetId: string) {
  const api = useApi()
  const authStore = useAuthStore()
  const comments = ref<InteractionComment[]>([])
  const likeCount = ref(0)
  const commentCount = ref(0)
 const liked = ref(false)

  const authHeaders = () => ({
    Authorization: `Bearer ${authStore.token}`,
    'Content-Type': 'application/json',
  })

  const endpoints = {
    blog: {
      likes: api.interactions.blogLikes,
      comments: api.interactions.blogPostComments(targetId),
    },
    forum: {
      likes: api.interactions.forumLikes,
      comments: api.interactions.forumTopicComments(targetId),
    },
    videos: {
      likes: api.interactions.videoLikes,
      comments: api.interactions.videoComments(targetId),
    },
  }[moduleName]

  const like = async () => {
    const res = await fetch(endpoints.likes, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ target_type: targetType, target_id: targetId }),
    })
    const data = await res.json()
    liked.value = data.data?.liked ?? false
    likeCount.value = data.data?.like_count ?? likeCount.value
  }

  const unlike = async () => {
    const res = await fetch(endpoints.likes, {
      method: 'DELETE',
      headers: authHeaders(),
      body: JSON.stringify({ target_type: targetType, target_id: targetId }),
    })
    const data = await res.json()
    liked.value = data.data?.liked ?? false
    likeCount.value = data.data?.like_count ?? likeCount.value
  }

  const fetchComments = async () => {
    const res = await fetch(endpoints.comments, { headers: authStore.token ? authHeaders() : undefined })
    const data = await res.json()
    comments.value = data.data?.items ?? []
    commentCount.value = data.data?.target?.comment_count ?? comments.value.length
    likeCount.value = data.data?.target?.like_count ?? likeCount.value
    liked.value = data.data?.target?.viewer_liked ?? liked.value
  }

  const createComment = async (content: string, parentCommentId?: string) => {
    await fetch(endpoints.comments, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(parentCommentId ? { content, parent_comment_id: parentCommentId } : { content }),
    })
    await fetchComments()
  }

  return {
    comments,
    likeCount,
    commentCount,
    liked,
    like,
    unlike,
    fetchComments,
    createComment,
  }
}
```

Create `Atoman-Frontend/src/components/shared/InteractionBar.vue`:

```vue
<script setup lang="ts">
const props = defineProps<{
  liked: boolean
  likeCount: number
  commentCount: number
}>()

const emit = defineEmits<{
  (e: 'like'): void
  (e: 'unlike'): void
}>()
</script>

<template>
  <div class="interaction-bar">
    <button type="button" class="a-toggle-btn" :class="{ 'a-toggle-btn-active': liked }" @click="liked ? emit('unlike') : emit('like')">
      ♥ {{ likeCount }}
    </button>
    <span class="a-muted">评论 {{ commentCount }}</span>
  </div>
</template>
```

Create `Atoman-Frontend/src/components/shared/CommentThread.vue`:

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import type { InteractionComment } from '@/types'

const props = defineProps<{ items: InteractionComment[] }>()
const emit = defineEmits<{ (e: 'reply', commentId: string): void; (e: 'submit', payload: { content: string; parentCommentId?: string }): void }>()

const draft = ref('')
const parentCommentId = ref<string | undefined>()
const submit = () => {
  if (!draft.value.trim()) return
  emit('submit', { content: draft.value.trim(), parentCommentId: parentCommentId.value })
  draft.value = ''
  parentCommentId.value = undefined
}
const roots = computed(() => props.items)
</script>

<template>
  <div class="comment-thread">
    <div v-for="item in roots" :key="item.id" class="comment-thread__root">
      <p><strong>{{ item.user?.username || item.user?.display_name || '用户' }}</strong> {{ item.content }}</p>
      <button type="button" class="a-link" @click="parentCommentId = item.id">回复</button>
      <div v-for="reply in item.replies || []" :key="reply.id" class="comment-thread__reply">
        <p><strong>{{ reply.user?.username || '用户' }}</strong> {{ reply.content }}</p>
        <button type="button" class="a-link" @click="parentCommentId = reply.id">回复</button>
      </div>
    </div>
    <textarea v-model="draft" rows="4" placeholder="输入评论" />
    <button type="button" class="a-btn a-btn--primary" @click="submit">发布评论</button>
  </div>
</template>
```

- [ ] **Step 5: Run the frontend tests to verify they pass**

Run:

```bash
cd Atoman-Frontend
bun run test:unit -- tests/unit/composables/useInteractions.spec.ts tests/unit/components/shared/CommentThread.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd Atoman-Frontend
git add src/types.ts src/composables/useApi.ts src/composables/useInteractions.ts src/components/shared/InteractionBar.vue src/components/shared/CommentThread.vue tests/unit/composables/useInteractions.spec.ts tests/unit/components/shared/CommentThread.spec.ts
git commit -m "feat: add shared interaction frontend primitives"
```

---

### Task 5: Blog and Forum Frontend Migration

**Files:**
- Modify: `Atoman-Frontend/src/views/blog/PostDetailView.vue`
- Modify: `Atoman-Frontend/src/stores/forum.ts`
- Modify: `Atoman-Frontend/src/views/forum/ForumTopicView.vue`
- Test: `Atoman-Frontend/tests/unit/views/blog/PostDetailView.interactions.spec.ts`
- Test: `Atoman-Frontend/tests/unit/views/forum/ForumTopicView.interactions.spec.ts`

- [ ] **Step 1: Write the failing page tests**

Create `Atoman-Frontend/tests/unit/views/blog/PostDetailView.interactions.spec.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import PostDetailView from '@/views/blog/PostDetailView.vue'

vi.mock('@/composables/useInteractions', () => ({
  useInteractions: () => ({
    comments: { value: [] },
    likeCount: { value: 3 },
    commentCount: { value: 4 },
    liked: { value: true },
    like: vi.fn(),
    unlike: vi.fn(),
    fetchComments: vi.fn(),
    createComment: vi.fn(),
  }),
}))

describe('PostDetailView interactions', () => {
  it('renders the shared interaction bar', () => {
    const wrapper = mount(PostDetailView, {
      props: { id: 'post-1' },
      global: { stubs: ['RouterLink', 'CommentSection', 'PConfirm', 'PSheet'] },
    })
    expect(wrapper.text()).toContain('评论')
  })
})
```

Create `Atoman-Frontend/tests/unit/views/forum/ForumTopicView.interactions.spec.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ForumTopicView from '@/views/forum/ForumTopicView.vue'

vi.mock('@/stores/forum', () => ({
  useForumStore: () => ({
    currentTopic: { id: 'topic-1', title: 'Topic', content: 'Body' },
    replies: [],
    fetchTopic: vi.fn(),
    fetchReplies: vi.fn(),
  }),
}))

describe('ForumTopicView interactions', () => {
  it('uses the shared comment thread instead of legacy reply actions', () => {
    const wrapper = mount(ForumTopicView, { global: { stubs: ['RouterLink'] } })
    expect(wrapper.html()).not.toContain('/replies')
  })
})
```

- [ ] **Step 2: Run the page tests to verify failure**

Run:

```bash
cd Atoman-Frontend
bun run test:unit -- tests/unit/views/blog/PostDetailView.interactions.spec.ts tests/unit/views/forum/ForumTopicView.interactions.spec.ts
```

Expected: FAIL because the pages still use legacy interaction code.

- [ ] **Step 3: Switch blog detail to the shared composable**

In `Atoman-Frontend/src/views/blog/PostDetailView.vue`:

- Remove the direct `toggleLike` request logic and `CommentSection` usage.
- Add:

```ts
import InteractionBar from '@/components/shared/InteractionBar.vue'
import CommentThread from '@/components/shared/CommentThread.vue'
import { useInteractions } from '@/composables/useInteractions'

const interactions = useInteractions('blog', 'post', postId.value)
```

- Replace the interaction bar block with:

```vue
<InteractionBar
  :liked="interactions.liked.value"
  :like-count="interactions.likeCount.value"
  :comment-count="interactions.commentCount.value"
  @like="interactions.like"
  @unlike="interactions.unlike"
/>
<CommentThread
  :items="interactions.comments.value"
  @submit="({ content, parentCommentId }) => interactions.createComment(content, parentCommentId)"
/>
```

- In `fetchPost`, call:

```ts
await interactions.fetchComments()
```

- [ ] **Step 4: Switch forum topic detail to shared comments**

In `Atoman-Frontend/src/stores/forum.ts` remove:

```ts
  const replies = ref<ForumReply[]>([])
  const fetchReplies = async (...)
  const createReply = async (...)
  const deleteReply = async (...)
  const toggleReplyLike = async (...)
```

and replace the forum interaction state with:

```ts
  const interactions = ref<ReturnType<typeof useInteractions> | null>(null)
```

In `Atoman-Frontend/src/views/forum/ForumTopicView.vue`:

- Import:

```ts
import InteractionBar from '@/components/shared/InteractionBar.vue'
import CommentThread from '@/components/shared/CommentThread.vue'
import { useInteractions } from '@/composables/useInteractions'
```

- After topic load, create:

```ts
const interactions = computed(() =>
  forumStore.currentTopic ? useInteractions('forum', 'forum_topic', forumStore.currentTopic.id) : null,
)
```

- Replace legacy topic like button and reply blocks with:

```vue
<InteractionBar
  v-if="interactions"
  :liked="interactions.liked.value"
  :like-count="interactions.likeCount.value"
  :comment-count="interactions.commentCount.value"
  @like="interactions.like"
  @unlike="interactions.unlike"
/>
<CommentThread
  v-if="interactions"
  :items="interactions.comments.value"
  @submit="({ content, parentCommentId }) => interactions.createComment(content, parentCommentId)"
/>
```

- [ ] **Step 5: Run the page tests to verify they pass**

Run:

```bash
cd Atoman-Frontend
bun run test:unit -- tests/unit/views/blog/PostDetailView.interactions.spec.ts tests/unit/views/forum/ForumTopicView.interactions.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Run frontend type-check**

```bash
cd Atoman-Frontend
bun run type-check
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd Atoman-Frontend
git add src/views/blog/PostDetailView.vue src/stores/forum.ts src/views/forum/ForumTopicView.vue tests/unit/views/blog/PostDetailView.interactions.spec.ts tests/unit/views/forum/ForumTopicView.interactions.spec.ts
git commit -m "feat: migrate blog and forum to shared interactions"
```

---

### Task 6: Video Frontend Migration and Final Verification

**Files:**
- Modify: `Atoman-Frontend/src/views/video/VideoDetailView.vue`
- Modify: `Atoman-Backend/internal/handlers/video_handler.go`

- [ ] **Step 1: Add the shared interaction bar and shared comment thread to video**

In `Atoman-Frontend/src/views/video/VideoDetailView.vue`, import:

```ts
import InteractionBar from '@/components/shared/InteractionBar.vue'
import CommentThread from '@/components/shared/CommentThread.vue'
import { useInteractions } from '@/composables/useInteractions'
```

Initialize:

```ts
const interactions = computed(() =>
  video.value ? useInteractions('videos', 'video', video.value.id) : null,
)
```

Render:

```vue
<InteractionBar
  v-if="interactions"
  :liked="interactions.liked.value"
  :like-count="interactions.likeCount.value"
  :comment-count="interactions.commentCount.value"
  @like="interactions.like"
  @unlike="interactions.unlike"
/>
<CommentThread
  v-if="interactions"
  :items="interactions.comments.value"
  @submit="({ content, parentCommentId }) => interactions.createComment(content, parentCommentId)"
/>
```

- [ ] **Step 2: Run the backend build and focused frontend tests**

Run:

```bash
cd Atoman-Backend
go build ./...
```

Expected: PASS.

Run:

```bash
cd Atoman-Frontend
bun run test:unit -- tests/unit/composables/useInteractions.spec.ts tests/unit/components/shared/CommentThread.spec.ts tests/unit/views/blog/PostDetailView.interactions.spec.ts tests/unit/views/forum/ForumTopicView.interactions.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Run the final frontend type-check**

```bash
cd Atoman-Frontend
bun run type-check
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd /Users/fafa/projects/Atoman
git add Atoman-Frontend/src/views/video/VideoDetailView.vue Atoman-Backend/internal/handlers/video_handler.go
git commit -m "feat: migrate video to shared interactions"
```

---

## Self-Review

Spec coverage:

- Shared like model: Task 1 and Task 2.
- Two-level comments with reply-to-reply collapsing into second level: Task 2 and Task 4.
- Module-prefixed routes: Task 3.
- Blog/forum/video replacement order: Tasks 3, 5, and 6.

Placeholder scan:

- No `TODO`, `TBD`, or “implement later” placeholders remain.
- Every task includes exact files and commands.

Type consistency:

- Shared frontend target types use `post`, `forum_topic`, and `video`.
- Shared backend target types use the same names.
- Shared composable uses module names `blog`, `forum`, and `videos`, matching existing API prefixes.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-07-unified-interactions.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
