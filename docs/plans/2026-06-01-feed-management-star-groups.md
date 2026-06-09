# Feed Management And Star Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Feed-only subscription management, Feed star grouping, and YouTube-style Feed sidebar collapse.

**Architecture:** Keep the current `/api/feed` frontend path as the implementation target because Feed UI currently calls that API directly. Add small backend model/API extensions, keep “+ 订阅” as an independent sheet, and isolate subscription management in a dedicated right-side sheet so `FeedView.vue` does not absorb all UI logic.

**Tech Stack:** Go, Gin, GORM, PostgreSQL/SQLite migration compatibility, Vue 3.5, Pinia, TypeScript strict, Tailwind/CSS variables.

---

## File Structure

- Modify `server/internal/model/feed.go`: add `FeedStarGroup` model and optional `GroupID` relation on `FeedItemStar`.
- Modify `server/cmd/migrate/main.go`: include `FeedStarGroup` in explicit migrations.
- Modify `server/cmd/start_server/main.go`: include `FeedStarGroup` in startup AutoMigrate where feed compatibility models are migrated.
- Modify `server/internal/handlers/feed_handler.go`: add routes and handlers for subscription rename/update, star groups, star movement, and grouped star listing.
- Modify `server/internal/handlers/feed_handler_test.go`: add focused handler tests for subscription update and star group behavior.
- Modify `web/src/types.ts`: add `FeedStarGroup`, `StarredFeedItem`, and optional `group_id` on starred item responses.
- Modify `web/src/stores/feed.ts`: add subscription update, star group CRUD, move star group, and grouped star fetch actions.
- Modify `web/src/components/shared/FeedSidebar.vue`: support expanded/collapsed rendering and icon-only mode.
- Modify `web/src/views/feed/FeedLayout.vue`: own Feed sidebar collapsed state and persist it to `localStorage`.
- Modify `web/src/components/feed/SubscriptionAddSheet.vue`: keep independent add sheet and ensure default group is selected.
- Create `web/src/components/feed/SubscriptionManageSheet.vue`: right-side management sheet for groups and existing subscriptions.
- Modify `web/src/views/feed/FeedView.vue`: add separate “订阅源管理” button/sheet while preserving “+ 订阅”.
- Modify `web/src/views/feed/FeedStarredView.vue`: add Feed star group filter, group creation, and move-to-group UI.
- Modify `doc/api-v1.md`: document `/api/feed` behavior changes and v1 contract expectations.

---

### Task 1: Backend Model And Migration

**Files:**
- Modify: `server/internal/model/feed.go`
- Modify: `server/cmd/migrate/main.go`
- Modify: `server/cmd/start_server/main.go`
- Test: `server/internal/handlers/feed_handler_test.go`

- [ ] **Step 1: Write the failing migration/model test**

Add this test to `server/internal/handlers/feed_handler_test.go`:

```go
func TestFeedStarGroupModelMigratesWithFeedItemStarGroupID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := newFeedHandlerTestDB(t)

	if err := db.AutoMigrate(&model.User{}, &model.FeedStarGroup{}, &model.FeedItemStar{}); err != nil {
		t.Fatalf("migrate star groups: %v", err)
	}

	if !db.Migrator().HasTable(&model.FeedStarGroup{}) {
		t.Fatal("expected feed_star_groups table")
	}
	if !db.Migrator().HasColumn(&model.FeedItemStar{}, "GroupID") {
		t.Fatal("expected feed_item_stars.group_id column")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd server && go test ./internal/handlers -run TestFeedStarGroupModelMigratesWithFeedItemStarGroupID -count=1
```

Expected: FAIL with `undefined: model.FeedStarGroup` or missing column.

- [ ] **Step 3: Add the model fields**

In `server/internal/model/feed.go`, replace `FeedItemStar` and add `FeedStarGroup`:

```go
type FeedStarGroup struct {
	Base
	UserID uuid.UUID `json:"user_id" gorm:"type:uuid;not null;index"`
	User   *User     `json:"user,omitempty" gorm:"foreignKey:UserID;references:UUID"`
	Name   string    `json:"name" gorm:"not null"`
}

func (FeedStarGroup) TableName() string { return "feed_star_groups" }

type FeedItemStar struct {
	UserID     uuid.UUID      `json:"user_id" gorm:"type:uuid;not null;primaryKey;index"`
	FeedItemID uuid.UUID      `json:"feed_item_id" gorm:"type:uuid;not null;primaryKey;index"`
	FeedItem   *FeedItem      `json:"feed_item,omitempty" gorm:"foreignKey:FeedItemID"`
	GroupID    *uuid.UUID     `json:"group_id" gorm:"type:uuid;index"`
	Group      *FeedStarGroup `json:"group,omitempty" gorm:"foreignKey:GroupID"`
	StarredAt  time.Time      `json:"starred_at"`
}
```

- [ ] **Step 4: Register migrations**

In both `server/cmd/migrate/main.go` and the feed AutoMigrate block in `server/cmd/start_server/main.go`, add:

```go
&model.FeedStarGroup{},
```

Place it near `&model.FeedItemStar{}` so feed models stay grouped.

- [ ] **Step 5: Run the model test**

Run:

```bash
cd server && go test ./internal/handlers -run TestFeedStarGroupModelMigratesWithFeedItemStarGroupID -count=1
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/internal/model/feed.go server/cmd/migrate/main.go server/cmd/start_server/main.go server/internal/handlers/feed_handler_test.go
git commit -m "feat(feed): add star group model"
```

---

### Task 2: Backend Subscription Rename And Group Update

**Files:**
- Modify: `server/internal/handlers/feed_handler.go`
- Modify: `server/internal/handlers/feed_handler_test.go`

- [ ] **Step 1: Write failing handler test**

Add a helper in `server/internal/handlers/feed_handler_test.go` if absent:

```go
func setupFeedAuthRouter(userID uuid.UUID) *gin.Engine {
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("user_id", userID)
		c.Next()
	})
	return r
}
```

Add the test:

```go
func TestUpdateSubscriptionRenamesAndMovesOwnSubscription(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := newFeedHandlerTestDB(t)
	if err := db.AutoMigrate(&model.User{}, &model.SubscriptionGroup{}, &model.Subscription{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	user := model.User{Username: "alice", Email: "alice@example.com", Password: "hash", Role: "user", IsActive: true}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	source := model.FeedSource{SourceType: "external_rss", Hash: "source-update-sub", RssURL: "https://example.com/feed.xml", Title: "Original Source"}
	if err := db.Create(&source).Error; err != nil {
		t.Fatalf("create source: %v", err)
	}
	group := model.SubscriptionGroup{UserID: user.UUID, Name: "Tech"}
	if err := db.Create(&group).Error; err != nil {
		t.Fatalf("create group: %v", err)
	}
	sub := model.Subscription{UserID: user.UUID, FeedSourceID: source.ID, Title: "Old title"}
	if err := db.Create(&sub).Error; err != nil {
		t.Fatalf("create sub: %v", err)
	}

	r := setupFeedAuthRouter(user.UUID)
	r.PUT("/api/feed/subscriptions/:id", UpdateSubscription(db))

	body := strings.NewReader(fmt.Sprintf(`{"title":"Renamed","group_id":"%s"}`, group.ID))
	req := httptest.NewRequest(http.MethodPut, "/api/feed/subscriptions/"+sub.ID.String(), body)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	var updated model.Subscription
	if err := db.First(&updated, "id = ?", sub.ID).Error; err != nil {
		t.Fatalf("load updated: %v", err)
	}
	if updated.Title != "Renamed" {
		t.Fatalf("expected renamed title, got %q", updated.Title)
	}
	if updated.SubscriptionGroupID == nil || *updated.SubscriptionGroupID != group.ID {
		t.Fatalf("expected group %s, got %v", group.ID, updated.SubscriptionGroupID)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd server && go test ./internal/handlers -run TestUpdateSubscriptionRenamesAndMovesOwnSubscription -count=1
```

Expected: FAIL with `undefined: UpdateSubscription`.

- [ ] **Step 3: Add route**

In `SetupFeedRoutes`, add inside protected routes near subscription delete/list:

```go
protected.PUT("/subscriptions/:id", UpdateSubscription(db))
```

- [ ] **Step 4: Implement handler**

Add to `server/internal/handlers/feed_handler.go` near `DeleteSubscription`:

```go
func UpdateSubscription(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDVal, _ := c.Get("user_id")
		userID := userIDVal.(uuid.UUID)

		id, err := uuid.Parse(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid subscription id"})
			return
		}

		var input struct {
			Title   *string    `json:"title"`
			GroupID *uuid.UUID `json:"group_id"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}

		var sub model.Subscription
		if err := db.Where("id = ? AND user_id = ?", id, userID).First(&sub).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Subscription not found"})
			return
		}

		updates := map[string]interface{}{}
		if input.Title != nil {
			updates["title"] = strings.TrimSpace(*input.Title)
		}
		if input.GroupID != nil {
			var group model.SubscriptionGroup
			if err := db.Where("id = ? AND user_id = ?", *input.GroupID, userID).First(&group).Error; err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Subscription group not found"})
				return
			}
			updates["subscription_group_id"] = *input.GroupID
		}
		if len(updates) > 0 {
			if err := db.Model(&sub).Updates(updates).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update subscription"})
				return
			}
		}
		if err := db.Preload("FeedSource").Preload("SubscriptionGroup").First(&sub, "id = ?", id).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reload subscription"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": sub, "message": "ok"})
	}
}
```

- [ ] **Step 5: Run test**

Run:

```bash
cd server && go test ./internal/handlers -run TestUpdateSubscriptionRenamesAndMovesOwnSubscription -count=1
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/internal/handlers/feed_handler.go server/internal/handlers/feed_handler_test.go
git commit -m "feat(feed): update subscriptions"
```

---

### Task 3: Backend Feed Star Groups

**Files:**
- Modify: `server/internal/handlers/feed_handler.go`
- Modify: `server/internal/handlers/feed_handler_test.go`

- [ ] **Step 1: Write failing tests**

Add tests:

```go
func TestFeedStarGroupsCreateMoveFilterAndDelete(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := newFeedHandlerTestDB(t)
	if err := db.AutoMigrate(&model.User{}, &model.FeedStarGroup{}, &model.FeedItemStar{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	user := model.User{Username: "alice", Email: "alice@example.com", Password: "hash", Role: "user", IsActive: true}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	source := model.FeedSource{SourceType: "external_rss", Hash: "star-source", RssURL: "https://example.com/feed.xml", Title: "Example"}
	if err := db.Create(&source).Error; err != nil {
		t.Fatalf("create source: %v", err)
	}
	item := model.FeedItem{FeedSourceID: source.ID, GUID: "star-guid", Title: "Starred", Link: "https://example.com/1", PublishedAt: time.Now(), FetchedAt: time.Now()}
	if err := db.Create(&item).Error; err != nil {
		t.Fatalf("create item: %v", err)
	}
	if err := db.Create(&model.FeedItemStar{UserID: user.UUID, FeedItemID: item.ID, StarredAt: time.Now()}).Error; err != nil {
		t.Fatalf("create star: %v", err)
	}

	r := setupFeedAuthRouter(user.UUID)
	r.POST("/api/feed/star-groups", CreateFeedStarGroup(db))
	r.PUT("/api/feed/stars/:feedItemId/group", SetFeedStarGroup(db))
	r.GET("/api/feed/stars", GetStarredItems(db))
	r.DELETE("/api/feed/star-groups/:id", DeleteFeedStarGroup(db))

	createReq := httptest.NewRequest(http.MethodPost, "/api/feed/star-groups", strings.NewReader(`{"name":"待读论文"}`))
	createReq.Header.Set("Content-Type", "application/json")
	createW := httptest.NewRecorder()
	r.ServeHTTP(createW, createReq)
	if createW.Code != http.StatusCreated {
		t.Fatalf("create status=%d body=%s", createW.Code, createW.Body.String())
	}
	var created struct {
		Data model.FeedStarGroup `json:"data"`
	}
	if err := json.Unmarshal(createW.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode create: %v", err)
	}

	moveReq := httptest.NewRequest(http.MethodPut, "/api/feed/stars/"+item.ID.String()+"/group", strings.NewReader(fmt.Sprintf(`{"group_id":"%s"}`, created.Data.ID)))
	moveReq.Header.Set("Content-Type", "application/json")
	moveW := httptest.NewRecorder()
	r.ServeHTTP(moveW, moveReq)
	if moveW.Code != http.StatusOK {
		t.Fatalf("move status=%d body=%s", moveW.Code, moveW.Body.String())
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/feed/stars?group_id="+created.Data.ID.String(), nil)
	listW := httptest.NewRecorder()
	r.ServeHTTP(listW, listReq)
	if listW.Code != http.StatusOK {
		t.Fatalf("list status=%d body=%s", listW.Code, listW.Body.String())
	}
	var listed struct {
		Items []struct {
			ID      uuid.UUID  `json:"id"`
			GroupID *uuid.UUID `json:"group_id"`
		} `json:"items"`
	}
	if err := json.Unmarshal(listW.Body.Bytes(), &listed); err != nil {
		t.Fatalf("decode list: %v", err)
	}
	if len(listed.Items) != 1 || listed.Items[0].ID != item.ID {
		t.Fatalf("expected grouped star item, got %#v", listed.Items)
	}

	deleteReq := httptest.NewRequest(http.MethodDelete, "/api/feed/star-groups/"+created.Data.ID.String(), nil)
	deleteW := httptest.NewRecorder()
	r.ServeHTTP(deleteW, deleteReq)
	if deleteW.Code != http.StatusOK {
		t.Fatalf("delete status=%d body=%s", deleteW.Code, deleteW.Body.String())
	}
	var star model.FeedItemStar
	if err := db.First(&star, "user_id = ? AND feed_item_id = ?", user.UUID, item.ID).Error; err != nil {
		t.Fatalf("load star: %v", err)
	}
	if star.GroupID != nil {
		t.Fatalf("expected deleted group to clear star group, got %s", *star.GroupID)
	}
}
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd server && go test ./internal/handlers -run TestFeedStarGroupsCreateMoveFilterAndDelete -count=1
```

Expected: FAIL with undefined handlers.

- [ ] **Step 3: Add routes**

In `SetupFeedRoutes`, add inside protected routes near star routes:

```go
protected.GET("/star-groups", GetFeedStarGroups(db))
protected.POST("/star-groups", CreateFeedStarGroup(db))
protected.PUT("/star-groups/:id", UpdateFeedStarGroup(db))
protected.DELETE("/star-groups/:id", DeleteFeedStarGroup(db))
protected.PUT("/stars/:feedItemId/group", SetFeedStarGroup(db))
```

- [ ] **Step 4: Implement star group handlers**

Add these handlers to `server/internal/handlers/feed_handler.go` near `GetStarredItems`:

```go
func GetFeedStarGroups(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDVal, _ := c.Get("user_id")
		userID := userIDVal.(uuid.UUID)
		var groups []model.FeedStarGroup
		if err := db.Where("user_id = ?", userID).Order("created_at ASC").Find(&groups).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch star groups"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": groups, "message": "ok"})
	}
}

func CreateFeedStarGroup(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDVal, _ := c.Get("user_id")
		userID := userIDVal.(uuid.UUID)
		var input struct {
			Name string `json:"name" binding:"required"`
		}
		if err := c.ShouldBindJSON(&input); err != nil || strings.TrimSpace(input.Name) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
			return
		}
		group := model.FeedStarGroup{UserID: userID, Name: strings.TrimSpace(input.Name)}
		if err := db.Create(&group).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create star group"})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"data": group, "message": "ok"})
	}
}

func UpdateFeedStarGroup(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDVal, _ := c.Get("user_id")
		userID := userIDVal.(uuid.UUID)
		id, err := uuid.Parse(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
			return
		}
		var input struct {
			Name string `json:"name" binding:"required"`
		}
		if err := c.ShouldBindJSON(&input); err != nil || strings.TrimSpace(input.Name) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
			return
		}
		var group model.FeedStarGroup
		if err := db.Where("id = ? AND user_id = ?", id, userID).First(&group).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Star group not found"})
			return
		}
		if err := db.Model(&group).Update("name", strings.TrimSpace(input.Name)).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update star group"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": group, "message": "ok"})
	}
}

func DeleteFeedStarGroup(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDVal, _ := c.Get("user_id")
		userID := userIDVal.(uuid.UUID)
		id, err := uuid.Parse(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
			return
		}
		var group model.FeedStarGroup
		if err := db.Where("id = ? AND user_id = ?", id, userID).First(&group).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Star group not found"})
			return
		}
		if err := db.Transaction(func(tx *gorm.DB) error {
			if err := tx.Model(&model.FeedItemStar{}).Where("user_id = ? AND group_id = ?", userID, id).Update("group_id", nil).Error; err != nil {
				return err
			}
			return tx.Delete(&group).Error
		}); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete star group"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "ok"})
	}
}

func SetFeedStarGroup(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDVal, _ := c.Get("user_id")
		userID := userIDVal.(uuid.UUID)
		feedItemID, err := uuid.Parse(c.Param("feedItemId"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid feed item id"})
			return
		}
		var input struct {
			GroupID *uuid.UUID `json:"group_id"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}
		if input.GroupID != nil {
			var group model.FeedStarGroup
			if err := db.Where("id = ? AND user_id = ?", *input.GroupID, userID).First(&group).Error; err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Star group not found"})
				return
			}
		}
		if err := db.Model(&model.FeedItemStar{}).
			Where("user_id = ? AND feed_item_id = ?", userID, feedItemID).
			Update("group_id", input.GroupID).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update star group"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "ok"})
	}
}
```

- [ ] **Step 5: Update `GetStarredItems` filter and output**

Inside `GetStarredItems`, parse:

```go
groupID := c.Query("group_id")
```

Change the star query to:

```go
starQuery := db.Where("user_id = ?", userID)
if groupID != "" {
	if parsed, err := uuid.Parse(groupID); err == nil {
		starQuery = starQuery.Where("group_id = ?", parsed)
	}
}
if err := starQuery.Order("starred_at DESC").Offset(offset).Limit(limit).Find(&stars).Error; err != nil {
	c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch starred items"})
	return
}
```

Extend `FeedItemWithSource`:

```go
GroupID *uuid.UUID `json:"group_id"`
```

When building result, set `GroupID` from the matching star.

- [ ] **Step 6: Run tests**

Run:

```bash
cd server && go test ./internal/handlers -run 'TestFeedStarGroups|TestGetStarredItems|TestUpdateSubscription' -count=1
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/internal/handlers/feed_handler.go server/internal/handlers/feed_handler_test.go
git commit -m "feat(feed): add star groups"
```

---

### Task 4: Frontend Types And Store Actions

**Files:**
- Modify: `web/src/types.ts`
- Modify: `web/src/stores/feed.ts`

- [ ] **Step 1: Add types**

In `web/src/types.ts`, add near Feed types:

```ts
export interface FeedStarGroup {
  id: string
  user_id: string
  name: string
  created_at: string
  updated_at: string
}

export interface StarredFeedItem {
  id: string
  title: string
  link: string
  summary: string
  author: string
  published_at: string
  image_url?: string
  enclosure_url?: string
  enclosure_type?: string
  source_title: string
  group_id?: string | null
}
```

- [ ] **Step 2: Add store state and actions**

In `web/src/stores/feed.ts`, import `FeedStarGroup` and add:

```ts
const starGroups = ref<FeedStarGroup[]>([])

const fetchStarGroups = async () => {
  const authStore = useAuthStore()
  if (!authStore.isAuthenticated) return
  const res = await fetch(`${API_URL}/feed/star-groups`, {
    headers: { Authorization: `Bearer ${authStore.token}` },
  })
  if (res.ok) {
    const data = await res.json()
    starGroups.value = data.data || []
  }
}

const createStarGroup = async (name: string) => {
  const authStore = useAuthStore()
  const res = await fetch(`${API_URL}/feed/star-groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) return false
  await fetchStarGroups()
  return true
}

const updateSubscription = async (id: string, payload: { title?: string; group_id?: string }) => {
  const authStore = useAuthStore()
  const res = await fetch(`${API_URL}/feed/subscriptions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
    body: JSON.stringify(payload),
  })
  if (!res.ok) return false
  await fetchSubscriptions()
  return true
}

const moveStarToGroup = async (feedItemId: string, groupId: string | null) => {
  const authStore = useAuthStore()
  const res = await fetch(`${API_URL}/feed/stars/${feedItemId}/group`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
    body: JSON.stringify({ group_id: groupId }),
  })
  return res.ok
}
```

Return `starGroups`, `fetchStarGroups`, `createStarGroup`, `updateSubscription`, and `moveStarToGroup`.

- [ ] **Step 3: Run type check**

Run:

```bash
cd web && bun run type-check
```

Expected: PASS or only failures from unrelated pre-existing dirty worktree changes. If unrelated failures appear, record exact files before continuing.

- [ ] **Step 4: Commit**

```bash
git add web/src/types.ts web/src/stores/feed.ts
git commit -m "feat(feed): add feed management store actions"
```

---

### Task 5: Feed Sidebar Collapse

**Files:**
- Modify: `web/src/components/shared/FeedSidebar.vue`
- Modify: `web/src/views/feed/FeedLayout.vue`

- [ ] **Step 1: Update `FeedSidebar.vue` props and template**

Add props:

```ts
defineProps<{
  collapsed?: boolean
}>()
```

For each nav item, keep the icon visible and wrap labels in `v-if="!collapsed"`. Use text icons for the first pass:

```vue
<span class="feed-sidebar-icon">⌂</span>
<span v-if="!collapsed">订阅</span>
```

Add class binding:

```vue
<aside class="a-sidebar feed-sidebar" :class="{ 'is-collapsed': collapsed }">
```

Add CSS:

```css
.feed-sidebar.is-collapsed {
  width: 4.5rem;
  min-width: 4.5rem;
}

.feed-sidebar.is-collapsed .a-sidebar-label,
.feed-sidebar.is-collapsed .a-sidebar-helper,
.feed-sidebar.is-collapsed .a-sidebar-item-num {
  display: none;
}

.feed-sidebar-icon {
  width: 1.5rem;
  text-align: center;
  font-weight: 900;
}
```

- [ ] **Step 2: Persist state in `FeedLayout.vue`**

In script:

```ts
import { onMounted, ref, watch } from 'vue'
import FeedSidebar from '@/components/shared/FeedSidebar.vue'

const sidebarCollapsed = ref(false)
const sidebarStorageKey = 'atoman.feed.sidebar.collapsed'

onMounted(() => {
  sidebarCollapsed.value = localStorage.getItem(sidebarStorageKey) === 'true'
})

watch(sidebarCollapsed, (value) => {
  localStorage.setItem(sidebarStorageKey, String(value))
})
```

Update template:

```vue
<button class="feed-sidebar-toggle" type="button" aria-label="切换 Feed 侧边栏" @click="sidebarCollapsed = !sidebarCollapsed">
  ☰
</button>
<FeedSidebar :collapsed="sidebarCollapsed" />
```

Add CSS for fixed top hamburger near the Feed content header:

```css
.feed-sidebar-toggle {
  position: fixed;
  top: 68px;
  left: 1rem;
  z-index: 900;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  font-size: 1.25rem;
  font-weight: 900;
  width: 2.75rem;
  height: 2.75rem;
  cursor: pointer;
}
```

- [ ] **Step 3: Run type check**

Run:

```bash
cd web && bun run type-check
```

Expected: PASS or documented unrelated failures only.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/shared/FeedSidebar.vue web/src/views/feed/FeedLayout.vue
git commit -m "feat(feed): collapse feed sidebar"
```

---

### Task 6: Subscription Management Sheet

**Files:**
- Create: `web/src/components/feed/SubscriptionManageSheet.vue`
- Modify: `web/src/views/feed/FeedView.vue`

- [ ] **Step 1: Create `SubscriptionManageSheet.vue`**

Create a focused component with props:

```ts
const props = defineProps<{
  show: boolean
  subscriptions: Subscription[]
  groups: SubscriptionGroup[]
}>()
```

Emit:

```ts
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'create-group', name: string): void
  (e: 'rename-subscription', id: string, title: string): void
  (e: 'move-subscription', id: string, groupId: string): void
  (e: 'delete-subscription', id: string): void
}>()
```

Template must use `PaperSheet` with title `SUBSCRIPTION_MANAGE`, a small “新建分组” inline form, grouped subscriptions, and per-subscription controls: `rename`, group select, `delete`.

- [ ] **Step 2: Wire `FeedView.vue`**

Import the component:

```ts
import SubscriptionManageSheet from '@/components/feed/SubscriptionManageSheet.vue'
```

Add state:

```ts
const showManageSheet = ref(false)
```

Add button next to existing “+ 订阅”:

```vue
<PaperPress
  v-if="authStore.isAuthenticated"
  variant="secondary"
  label="订阅源管理"
  @click="showManageSheet = true"
/>
```

Add sheet:

```vue
<SubscriptionManageSheet
  :show="showManageSheet"
  :subscriptions="subscriptions"
  :groups="groups"
  @close="showManageSheet = false"
  @create-group="createSubscriptionGroup"
  @rename-subscription="renameSubscription"
  @move-subscription="moveSubscription"
  @delete-subscription="deleteSubscription"
/>
```

Add handlers:

```ts
const createSubscriptionGroup = async (name: string) => {
  await feedStore.createGroup(name)
  await Promise.all([feedStore.fetchGroups(), feedStore.fetchSubscriptions()])
}

const renameSubscription = async (id: string, title: string) => {
  await feedStore.updateSubscription(id, { title })
}

const moveSubscription = async (id: string, groupId: string) => {
  await feedStore.updateSubscription(id, { group_id: groupId })
}

const deleteSubscription = async (id: string) => {
  await feedStore.unsubscribe(id)
  await fetchTimeline()
}
```

- [ ] **Step 3: Ensure data loads before opening**

Add watch:

```ts
watch(showManageSheet, (visible) => {
  if (visible && authStore.isAuthenticated) {
    void Promise.all([feedStore.fetchSubscriptions(), feedStore.fetchGroups()])
  }
})
```

- [ ] **Step 4: Run type check**

Run:

```bash
cd web && bun run type-check
```

Expected: PASS or documented unrelated failures only.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/feed/SubscriptionManageSheet.vue web/src/views/feed/FeedView.vue
git commit -m "feat(feed): manage subscriptions in sheet"
```

---

### Task 7: Feed Starred Page Groups

**Files:**
- Modify: `web/src/views/feed/FeedStarredView.vue`

- [ ] **Step 1: Replace local `StarredItem` with shared type**

Import:

```ts
import type { FeedStarGroup, StarredFeedItem, TimelineItem } from '@/types'
```

Use:

```ts
const items = ref<StarredFeedItem[]>([])
const activeStarGroupId = ref<string | null>(null)
const newStarGroupName = ref('')
const starGroups = computed<FeedStarGroup[]>(() => feedStore.starGroups)
```

- [ ] **Step 2: Add grouped fetch**

Update `fetchStarred` URL:

```ts
const params = new URLSearchParams({ page: String(p), limit: String(pageLimit) })
if (activeStarGroupId.value) params.set('group_id', activeStarGroupId.value)
const res = await fetch(`${API_URL}/feed/stars?${params}`, {
  headers: authHeaders(),
})
```

- [ ] **Step 3: Add group controls to template**

Below page header, add:

```vue
<div class="star-group-bar">
  <PaperPress label="全部" :variant="activeStarGroupId === null ? 'primary' : 'secondary'" @click="selectStarGroup(null)" />
  <PaperPress
    v-for="group in starGroups"
    :key="group.id"
    :label="group.name"
    :variant="activeStarGroupId === group.id ? 'primary' : 'secondary'"
    @click="selectStarGroup(group.id)"
  />
  <input v-model="newStarGroupName" class="a-input star-group-input" placeholder="新建收藏分组" />
  <PaperPress label="新建分组" @click="createStarGroup" />
</div>
```

In each card actions, add a select:

```vue
<select class="a-input star-group-select" :value="item.group_id || ''" @click.stop @change="moveStar(item.id, ($event.target as HTMLSelectElement).value || null)">
  <option value="">默认收藏</option>
  <option v-for="group in starGroups" :key="group.id" :value="group.id">{{ group.name }}</option>
</select>
```

- [ ] **Step 4: Add methods**

```ts
const selectStarGroup = async (groupId: string | null) => {
  activeStarGroupId.value = groupId
  page.value = 1
  await fetchStarred(1)
}

const createStarGroup = async () => {
  const name = newStarGroupName.value.trim()
  if (!name) return
  const ok = await feedStore.createStarGroup(name)
  if (ok) newStarGroupName.value = ''
}

const moveStar = async (feedItemId: string, groupId: string | null) => {
  const ok = await feedStore.moveStarToGroup(feedItemId, groupId)
  if (!ok) return
  const item = items.value.find((entry) => entry.id === feedItemId)
  if (item) item.group_id = groupId
  if (activeStarGroupId.value && activeStarGroupId.value !== groupId) {
    items.value = items.value.filter((entry) => entry.id !== feedItemId)
  }
}
```

In `onMounted`, add:

```ts
await feedStore.fetchStarGroups()
```

- [ ] **Step 5: Add compact CSS**

```css
.star-group-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 1rem;
}

.star-group-input {
  max-width: 12rem;
}

.star-group-select {
  max-width: 10rem;
}
```

- [ ] **Step 6: Run type check**

Run:

```bash
cd web && bun run type-check
```

Expected: PASS or documented unrelated failures only.

- [ ] **Step 7: Commit**

```bash
git add web/src/views/feed/FeedStarredView.vue
git commit -m "feat(feed): group starred items"
```

---

### Task 8: API Documentation And Full Verification

**Files:**
- Modify: `doc/api-v1.md`

- [ ] **Step 1: Update API docs**

In Feed section of `doc/api-v1.md`, document:

````markdown
#### PUT /api/feed/subscriptions/:id

Permission: `user`.

Request:

```json
{
  "title": "Renamed feed",
  "group_id": "subscription_group_uuid"
}
```

Rules:

- Only updates current user's subscription row.
- `title` changes the user's display title only.
- `group_id` must belong to current user.

#### GET /api/feed/star-groups
#### POST /api/feed/star-groups
#### PUT /api/feed/star-groups/:id
#### DELETE /api/feed/star-groups/:id
#### PUT /api/feed/stars/:feedItemId/group

Rules:

- Star groups are Feed-only and do not affect blog bookmarks.
- Deleting a star group moves stars back to default收藏.
- `GET /api/feed/stars?group_id=<uuid>` filters starred items by group.
````

- [ ] **Step 2: Run backend verification**

Run:

```bash
cd server && go test ./internal/handlers -run 'TestFeed|TestUpdateSubscription' -count=1
cd server && go build ./...
```

Expected: PASS.

- [ ] **Step 3: Run frontend verification**

Run:

```bash
cd web && bun run type-check
```

Expected: PASS or documented unrelated failures from pre-existing dirty files.

- [ ] **Step 4: Manual browser verification**

Run dev server:

```bash
cd web && bun run dev
```

Open the Feed module and verify:

- 三横杠 toggles Feed sidebar.
- Collapsed sidebar shows icon-only nav.
- Refresh preserves collapsed state.
- “+ 订阅” remains independent and default group is selected.
- “订阅源管理” opens management sheet.
- Management sheet can create group, rename subscription, move subscription, delete subscription.
- 收藏页 can create star group, filter group, move a star, and unstar.

- [ ] **Step 5: Commit**

```bash
git add doc/api-v1.md
git commit -m "docs(feed): document feed management APIs"
```

---

## Self-Review

- Spec coverage: subscription add group default is covered in Task 6 via existing `SubscriptionAddSheet` behavior; subscription management is covered in Tasks 2 and 6; star groups are covered in Tasks 1, 3, 4, and 7; Feed-only sidebar collapse is covered in Task 5; API docs and verification are covered in Task 8.
- Placeholder scan: no `TBD`, `TODO`, or open-ended “handle appropriately” steps remain.
- Type consistency: backend uses `FeedStarGroup`, `GroupID`, `group_id`; frontend uses `FeedStarGroup`, `StarredFeedItem`, `starGroups`, and `moveStarToGroup`.
