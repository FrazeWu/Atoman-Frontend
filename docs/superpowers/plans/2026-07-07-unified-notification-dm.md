# Unified Notifications and DM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the unified site notification center with category counts, asynchronous event processing, notification preferences, content mutes, DM integration, and one-way user blocking.

**Architecture:** Backend keeps `notifications` as the visible inbox and adds a PostgreSQL-backed `notification_events` queue processed by an in-process worker. DM remains a separate conversation model, while the topbar and inbox UI show DM beside normal notification categories. User blocking is a cross-cutting service used by notification processing, DM sending, and frontend content rendering.

**Tech Stack:** Go, Gin, GORM, PostgreSQL, existing UserHub WebSocket, Vue 3, TypeScript, Pinia, Vitest.

---

## File Structure

Backend files:

- Modify: `Atoman-Backend/internal/model/notification.go`
- Modify: `Atoman-Backend/internal/model/user.go`
- Create: `Atoman-Backend/internal/model/notification_event.go`
- Create: `Atoman-Backend/internal/model/user_block.go`
- Modify: `Atoman-Backend/cmd/migrate/main.go`
- Modify: `Atoman-Backend/internal/migrations/notification_dm_indexes.go`
- Modify: `Atoman-Backend/internal/migrations/notification_dm_indexes_test.go`
- Modify: `Atoman-Backend/internal/modules/notification/dto.go`
- Modify: `Atoman-Backend/internal/modules/notification/repo.go`
- Modify: `Atoman-Backend/internal/modules/notification/service.go`
- Create: `Atoman-Backend/internal/modules/notification/events.go`
- Create: `Atoman-Backend/internal/modules/notification/worker.go`
- Create: `Atoman-Backend/internal/modules/notification/service_test.go`
- Modify: `Atoman-Backend/internal/modules/notification/http.go`
- Create: `Atoman-Backend/internal/modules/notification/http_test.go`
- Create: `Atoman-Backend/internal/modules/userblock/service.go`
- Create: `Atoman-Backend/internal/modules/userblock/http.go`
- Create: `Atoman-Backend/internal/modules/userblock/service_test.go`
- Create: `Atoman-Backend/internal/modules/userblock/http_test.go`
- Modify: `Atoman-Backend/internal/app/router.go`
- Modify: `Atoman-Backend/internal/handlers/dm_handler.go`
- Modify: `Atoman-Backend/internal/handlers/dm_handler_test.go`
- Modify: `Atoman-Backend/cmd/start_server/main.go`

Frontend files:

- Modify: `Atoman-Frontend/src/types.ts`
- Modify: `Atoman-Frontend/src/composables/useApi.ts`
- Modify: `Atoman-Frontend/src/stores/notification.ts`
- Modify: `Atoman-Frontend/src/stores/inbox.ts`
- Modify: `Atoman-Frontend/src/stores/dm.ts`
- Create: `Atoman-Frontend/src/stores/userBlocks.ts`
- Modify: `Atoman-Frontend/src/components/system/AppTopbarAuthControls.vue`
- Modify: `Atoman-Frontend/src/views/feed/InboxPage.vue`
- Modify: `Atoman-Frontend/src/views/blog/BlogSettingsView.vue`
- Test: `Atoman-Frontend/tests/unit/stores/notification.spec.ts`
- Test: `Atoman-Frontend/tests/unit/stores/dm.spec.ts`
- Test: `Atoman-Frontend/tests/unit/components/AppTopbarAuthControls.spec.ts`
- Test: `Atoman-Frontend/tests/unit/views/feed/InboxPage.notifications.spec.ts`
- Test: `Atoman-Frontend/tests/unit/views/blog/BlogSettingsView.notifications.spec.ts`

---

### Task 1: Backend Schema for Unified Notifications

**Files:**
- Modify: `Atoman-Backend/internal/model/notification.go`
- Modify: `Atoman-Backend/internal/model/user.go`
- Create: `Atoman-Backend/internal/model/notification_event.go`
- Create: `Atoman-Backend/internal/model/user_block.go`
- Modify: `Atoman-Backend/cmd/migrate/main.go`
- Modify: `Atoman-Backend/internal/migrations/notification_dm_indexes.go`
- Modify: `Atoman-Backend/internal/migrations/notification_dm_indexes_test.go`

- [ ] **Step 1: Extend migration test**

Modify `Atoman-Backend/internal/migrations/notification_dm_indexes_test.go`:

```go
func TestRunNotificationDMIndexesCreatesExpectedIndexes(t *testing.T) {
	db := testdb.Open(t)
	testdb.Migrate(t, db,
		&model.Notification{},
		&model.NotificationEvent{},
		&model.NotificationPreference{},
		&model.NotificationMute{},
		&model.UserBlock{},
		&model.DMConversation{},
		&model.DMMessage{},
	)

	if err := RunNotificationDMIndexes(db); err != nil {
		t.Fatalf("run notification/dm indexes migration: %v", err)
	}

	assertIndexExists(t, db, "notifications", "idx_notification_recipient_category_read")
	assertIndexExists(t, db, "notifications", "idx_notification_aggregate_unread")
	assertIndexExists(t, db, "notification_events", "idx_notification_events_status_available")
	assertIndexExists(t, db, "notification_preferences", "uq_notification_preference")
	assertIndexExists(t, db, "notification_mutes", "uq_notification_mute")
	assertIndexExists(t, db, "user_blocks", "uq_user_block")
	assertIndexExists(t, db, "dm_conversations", "uq_dm_conversation")
	assertIndexExists(t, db, "dm_messages", "idx_dm_message_conv_sender_read")
}
```

- [ ] **Step 2: Run migration test to verify failure**

Run:

```bash
cd Atoman-Backend
go test ./internal/migrations -run TestRunNotificationDMIndexesCreatesExpectedIndexes -count=1
```

Expected: fail because the new model types and indexes do not exist.

- [ ] **Step 3: Extend notification model**

Modify `Atoman-Backend/internal/model/notification.go`:

```go
type Notification struct {
	Base
	RecipientID   uuid.UUID        `json:"recipient_id" gorm:"type:uuid;not null;index"`
	Recipient     *User            `json:"recipient,omitempty" gorm:"foreignKey:RecipientID;references:UUID"`
	ActorID       *uuid.UUID       `json:"actor_id" gorm:"type:uuid;index"`
	Actor         *User            `json:"actor,omitempty" gorm:"foreignKey:ActorID;references:UUID"`
	LatestActorID *uuid.UUID       `json:"latest_actor_id" gorm:"type:uuid;index"`
	LatestActor   *User            `json:"latest_actor,omitempty" gorm:"foreignKey:LatestActorID;references:UUID"`
	Type          string           `json:"type" gorm:"not null;index"`
	Category      string           `json:"category" gorm:"not null;default:'reply';index"`
	Reason        string           `json:"reason" gorm:"type:text"`
	SourceType    string           `json:"source_type" gorm:"not null;index"`
	SourceID      uuid.UUID        `json:"source_id" gorm:"type:uuid;not null;index"`
	SourceURL     string           `json:"source_url" gorm:"type:text"`
	AggregateKey  string           `json:"aggregate_key" gorm:"index"`
	ActorCount    int              `json:"actor_count" gorm:"default:1;not null"`
	LatestAt      *time.Time       `json:"latest_at"`
	Meta          NotificationMeta `json:"meta" gorm:"type:jsonb;default:'{}'"`
	ReadAt        *time.Time       `json:"read_at"`
}
```

- [ ] **Step 4: Add event, preference, mute, and block models**

Create `Atoman-Backend/internal/model/notification_event.go`:

```go
package model

import (
	"time"

	"github.com/google/uuid"
)

type NotificationEvent struct {
	Base
	EventType   string           `json:"event_type" gorm:"not null;index"`
	ActorID     *uuid.UUID       `json:"actor_id" gorm:"type:uuid;index"`
	SubjectType string           `json:"subject_type" gorm:"not null;index"`
	SubjectID   uuid.UUID        `json:"subject_id" gorm:"type:uuid;not null;index"`
	Payload     NotificationMeta `json:"payload" gorm:"type:jsonb;default:'{}'"`
	Status      string           `json:"status" gorm:"not null;default:'pending';index"`
	Attempts    int              `json:"attempts" gorm:"default:0;not null"`
	LastError   string           `json:"last_error" gorm:"type:text"`
	AvailableAt time.Time        `json:"available_at" gorm:"not null;index"`
	ProcessedAt *time.Time       `json:"processed_at"`
}

func (NotificationEvent) TableName() string { return "notification_events" }

type NotificationPreference struct {
	Base
	UserID    uuid.UUID `json:"user_id" gorm:"type:uuid;not null;index;uniqueIndex:uq_notification_preference,priority:1"`
	Category  string    `json:"category" gorm:"not null;uniqueIndex:uq_notification_preference,priority:2"`
	EventType string    `json:"event_type" gorm:"not null;uniqueIndex:uq_notification_preference,priority:3"`
	Enabled   bool      `json:"enabled" gorm:"default:true;not null"`
}

func (NotificationPreference) TableName() string { return "notification_preferences" }

type NotificationMute struct {
	Base
	UserID     uuid.UUID `json:"user_id" gorm:"type:uuid;not null;index;uniqueIndex:uq_notification_mute,priority:1"`
	SourceType string    `json:"source_type" gorm:"not null;uniqueIndex:uq_notification_mute,priority:2"`
	SourceID   uuid.UUID `json:"source_id" gorm:"type:uuid;not null;uniqueIndex:uq_notification_mute,priority:3"`
	Reason     string    `json:"reason" gorm:"type:text"`
}

func (NotificationMute) TableName() string { return "notification_mutes" }
```

Create `Atoman-Backend/internal/model/user_block.go`:

```go
package model

import "github.com/google/uuid"

type UserBlock struct {
	Base
	BlockerID uuid.UUID `json:"blocker_id" gorm:"type:uuid;not null;index;uniqueIndex:uq_user_block,priority:1"`
	BlockedID uuid.UUID `json:"blocked_id" gorm:"type:uuid;not null;index;uniqueIndex:uq_user_block,priority:2"`
	Blocker *User `json:"blocker,omitempty" gorm:"foreignKey:BlockerID;references:UUID"`
	Blocked *User `json:"blocked,omitempty" gorm:"foreignKey:BlockedID;references:UUID"`
}

func (UserBlock) TableName() string { return "user_blocks" }
```

- [ ] **Step 5: Change default DM permission**

Modify `Atoman-Backend/internal/model/user.go`:

```go
type UserSettings struct {
	UserID         uuid.UUID `json:"user_id" gorm:"type:uuid;primaryKey"`
	PrivateProfile bool      `json:"private_profile" gorm:"default:false"`
	DMPermission   string    `json:"dm_permission" gorm:"default:'one_before_reply'"`
}
```

- [ ] **Step 6: Wire models into migrate command**

Modify the model list in `Atoman-Backend/cmd/migrate/main.go` to include:

```go
		&model.NotificationEvent{},
		&model.NotificationPreference{},
		&model.NotificationMute{},
		&model.UserBlock{},
```

Place them next to `&model.Notification{}`.

- [ ] **Step 7: Add indexes**

Modify `Atoman-Backend/internal/migrations/notification_dm_indexes.go`:

```go
	if err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_notification_recipient_category_read
		ON notifications (recipient_id, category, read_at)`).Error; err != nil {
		return err
	}
	if err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_notification_aggregate_unread
		ON notifications (recipient_id, aggregate_key, read_at)`).Error; err != nil {
		return err
	}
	if err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_notification_events_status_available
		ON notification_events (status, available_at)`).Error; err != nil {
		return err
	}
	if err := db.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_preference
		ON notification_preferences (user_id, category, event_type)`).Error; err != nil {
		return err
	}
	if err := db.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_mute
		ON notification_mutes (user_id, source_type, source_id)`).Error; err != nil {
		return err
	}
	if err := db.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS uq_user_block
		ON user_blocks (blocker_id, blocked_id)`).Error; err != nil {
		return err
	}
	if err := db.Exec(`UPDATE user_settings SET dm_permission = 'one_before_reply' WHERE dm_permission = '' OR dm_permission IS NULL`).Error; err != nil {
		return err
	}
```

- [ ] **Step 8: Run migration tests**

Run:

```bash
cd Atoman-Backend
go test ./internal/migrations -run TestRunNotificationDMIndexesCreatesExpectedIndexes -count=1
```

Expected: pass.

- [ ] **Step 9: Commit backend schema**

```bash
cd Atoman-Backend
git add internal/model/notification.go internal/model/user.go internal/model/notification_event.go internal/model/user_block.go cmd/migrate/main.go internal/migrations/notification_dm_indexes.go internal/migrations/notification_dm_indexes_test.go
git commit -m "feat: add unified notification schema"
```

---

### Task 2: Backend Notification Event Processor

**Files:**
- Modify: `Atoman-Backend/internal/modules/notification/dto.go`
- Modify: `Atoman-Backend/internal/modules/notification/repo.go`
- Modify: `Atoman-Backend/internal/modules/notification/service.go`
- Create: `Atoman-Backend/internal/modules/notification/events.go`
- Create: `Atoman-Backend/internal/modules/notification/worker.go`
- Create: `Atoman-Backend/internal/modules/notification/service_test.go`

- [ ] **Step 1: Write service tests**

Create `Atoman-Backend/internal/modules/notification/service_test.go`:

```go
package notification

import (
	"testing"
	"time"

	"atoman/internal/model"
	"atoman/internal/platform/authctx"
	"atoman/internal/testdb"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

func newNotificationTestService(t *testing.T) (*Service, *gorm.DB, model.User, model.User) {
	t.Helper()
	db := testdb.Open(t)
	testdb.Migrate(t, db,
		&model.User{},
		&model.Notification{},
		&model.NotificationEvent{},
		&model.NotificationPreference{},
		&model.NotificationMute{},
		&model.UserBlock{},
	)
	recipient := model.User{Username: "recipient", Email: "recipient@example.com", Password: "hash", Role: "user", IsActive: true}
	actor := model.User{Username: "actor", Email: "actor@example.com", Password: "hash", Role: "user", IsActive: true}
	if err := db.Create(&recipient).Error; err != nil {
		t.Fatalf("create recipient: %v", err)
	}
	if err := db.Create(&actor).Error; err != nil {
		t.Fatalf("create actor: %v", err)
	}
	return NewService(db), db, recipient, actor
}

func TestProcessEventCreatesCategorizedNotification(t *testing.T) {
	svc, db, recipient, actor := newNotificationTestService(t)
	sourceID := uuid.New()
	event, err := svc.EnqueueEvent(EnqueueEventInput{
		EventType: "content.liked",
		ActorID: &actor.UUID,
		SubjectType: "forum_reply",
		SubjectID: sourceID,
		Payload: model.NotificationMeta{
			"recipient_id": recipient.UUID.String(),
			"title": "有人点赞了你",
			"reason": "因为有人点赞了你的内容",
			"source_url": "/forum/topic/topic-1#reply-" + sourceID.String(),
		},
	})
	if err != nil {
		t.Fatalf("enqueue event: %v", err)
	}
	if event.Status != "pending" {
		t.Fatalf("expected pending event, got %s", event.Status)
	}

	if err := svc.ProcessPendingOnce(time.Now()); err != nil {
		t.Fatalf("process event: %v", err)
	}

	var notification model.Notification
	if err := db.First(&notification, "recipient_id = ?", recipient.UUID).Error; err != nil {
		t.Fatalf("load notification: %v", err)
	}
	if notification.Category != "like" || notification.Type != "content.liked" || notification.Reason == "" {
		t.Fatalf("unexpected notification: %#v", notification)
	}
}

func TestProcessEventSkipsMutedSource(t *testing.T) {
	svc, db, recipient, actor := newNotificationTestService(t)
	sourceID := uuid.New()
	mute := model.NotificationMute{UserID: recipient.UUID, SourceType: "forum_topic", SourceID: sourceID, Reason: "too noisy"}
	if err := db.Create(&mute).Error; err != nil {
		t.Fatalf("create mute: %v", err)
	}
	_, err := svc.EnqueueEvent(EnqueueEventInput{
		EventType: "content.replied",
		ActorID: &actor.UUID,
		SubjectType: "forum_topic",
		SubjectID: sourceID,
		Payload: model.NotificationMeta{"recipient_id": recipient.UUID.String()},
	})
	if err != nil {
		t.Fatalf("enqueue event: %v", err)
	}
	if err := svc.ProcessPendingOnce(time.Now()); err != nil {
		t.Fatalf("process event: %v", err)
	}

	var count int64
	db.Model(&model.Notification{}).Count(&count)
	if count != 0 {
		t.Fatalf("expected no notifications, got %d", count)
	}
	var event model.NotificationEvent
	if err := db.First(&event).Error; err != nil {
		t.Fatalf("load event: %v", err)
	}
	if event.Status != "skipped" {
		t.Fatalf("expected skipped event, got %s", event.Status)
	}
}

func TestProcessEventAnonymizesBlockedRequiredCollaboration(t *testing.T) {
	svc, db, recipient, actor := newNotificationTestService(t)
	if err := db.Create(&model.UserBlock{BlockerID: recipient.UUID, BlockedID: actor.UUID}).Error; err != nil {
		t.Fatalf("create block: %v", err)
	}
	sourceID := uuid.New()
	_, err := svc.EnqueueEvent(EnqueueEventInput{
		EventType: "collaboration.required",
		ActorID: &actor.UUID,
		SubjectType: "music_lyrics",
		SubjectID: sourceID,
		Payload: model.NotificationMeta{
			"recipient_id": recipient.UUID.String(),
			"title": "歌词修改影响了你的注释绑定",
			"required": true,
		},
	})
	if err != nil {
		t.Fatalf("enqueue event: %v", err)
	}
	if err := svc.ProcessPendingOnce(time.Now()); err != nil {
		t.Fatalf("process event: %v", err)
	}

	var notification model.Notification
	if err := db.First(&notification, "recipient_id = ?", recipient.UUID).Error; err != nil {
		t.Fatalf("load notification: %v", err)
	}
	if notification.ActorID != nil || notification.Category != "collaboration" {
		t.Fatalf("expected anonymous collaboration notification, got %#v", notification)
	}
}

func TestUnreadAggregationUpdatesExistingUnreadNotification(t *testing.T) {
	svc, db, recipient, actor := newNotificationTestService(t)
	sourceID := uuid.New()
	for i := 0; i < 2; i++ {
		_, err := svc.EnqueueEvent(EnqueueEventInput{
			EventType: "content.liked",
			ActorID: &actor.UUID,
			SubjectType: "forum_reply",
			SubjectID: sourceID,
			Payload: model.NotificationMeta{"recipient_id": recipient.UUID.String()},
		})
		if err != nil {
			t.Fatalf("enqueue event %d: %v", i, err)
		}
		if err := svc.ProcessPendingOnce(time.Now()); err != nil {
			t.Fatalf("process event %d: %v", i, err)
		}
	}
	var count int64
	db.Model(&model.Notification{}).Count(&count)
	if count != 1 {
		t.Fatalf("expected one aggregated notification, got %d", count)
	}
	var notification model.Notification
	if err := db.First(&notification).Error; err != nil {
		t.Fatalf("load notification: %v", err)
	}
	if notification.ActorCount != 2 {
		t.Fatalf("expected actor_count=2, got %d", notification.ActorCount)
	}
}

func TestListNotificationsFiltersByCategory(t *testing.T) {
	svc, db, recipient, _ := newNotificationTestService(t)
	like := model.Notification{RecipientID: recipient.UUID, Type: "content.liked", Category: "like", SourceType: "post", SourceID: uuid.New(), ActorCount: 1}
	reply := model.Notification{RecipientID: recipient.UUID, Type: "content.replied", Category: "reply", SourceType: "post", SourceID: uuid.New(), ActorCount: 1}
	if err := db.Create(&like).Error; err != nil {
		t.Fatalf("create like: %v", err)
	}
	if err := db.Create(&reply).Error; err != nil {
		t.Fatalf("create reply: %v", err)
	}
	items, total, err := svc.ListNotifications(authctx.CurrentUser{ID: recipient.UUID, Role: authctx.RoleUser}, ListQuery{Category: "like", Page: 1, PageSize: 20})
	if err != nil {
		t.Fatalf("list notifications: %v", err)
	}
	if total != 1 || len(items) != 1 || items[0].Category != "like" {
		t.Fatalf("unexpected filtered result: total=%d items=%#v", total, items)
	}
}
```

- [ ] **Step 2: Run service tests to verify failure**

Run:

```bash
cd Atoman-Backend
go test ./internal/modules/notification -run 'TestProcessEvent|TestUnreadAggregation|TestListNotificationsFiltersByCategory' -count=1
```

Expected: fail because event APIs and category fields are not implemented.

- [ ] **Step 3: Add DTOs**

Modify `Atoman-Backend/internal/modules/notification/dto.go`:

```go
type ListQuery struct {
	Page     int    `json:"page" form:"page"`
	PageSize int    `json:"page_size" form:"page_size"`
	Type     string `json:"type" form:"type"`
	Category string `json:"category" form:"category"`
}

type NotificationDTO struct {
	ID            string                 `json:"id"`
	Type          string                 `json:"type"`
	Category      string                 `json:"category"`
	Reason        string                 `json:"reason"`
	SourceType    string                 `json:"source_type"`
	SourceID      string                 `json:"source_id"`
	SourceURL     string                 `json:"source_url"`
	AggregateKey  string                 `json:"aggregate_key"`
	ActorCount    int                    `json:"actor_count"`
	Meta          model.NotificationMeta `json:"meta"`
	ReadAt        *time.Time             `json:"read_at,omitempty"`
	CreatedAt     time.Time              `json:"created_at"`
	LatestAt      *time.Time             `json:"latest_at,omitempty"`
	Actor         *ActorDTO              `json:"actor,omitempty"`
	LatestActor   *ActorDTO              `json:"latest_actor,omitempty"`
}

type EnqueueEventInput struct {
	EventType string
	ActorID *uuid.UUID
	SubjectType string
	SubjectID uuid.UUID
	Payload model.NotificationMeta
}

type CategoryUnreadCounts struct {
	Total int64 `json:"total"`
	Items map[string]int64 `json:"items"`
}
```

Modify the import block to include:

```go
import "github.com/google/uuid"
```

- [ ] **Step 4: Update repo filtering and counts**

Modify `Atoman-Backend/internal/modules/notification/repo.go`:

```go
func (r *Repo) ListNotifications(recipientID uuid.UUID, query ListQuery) ([]model.Notification, int64, error) {
	var notifications []model.Notification
	var total int64

	db := r.db.Model(&model.Notification{}).Where("recipient_id = ?", recipientID)
	if category := strings.TrimSpace(query.Category); category != "" {
		db = db.Where("category = ?", category)
	}
	if notifType := strings.TrimSpace(query.Type); notifType != "" {
		db = db.Where("type = ?", notifType)
	}
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	page := normalizedPage(query.Page)
	pageSize := normalizedPageSize(query.PageSize)
	if err := db.Preload("Actor").Preload("LatestActor").Order("created_at DESC").Limit(pageSize).Offset((page - 1) * pageSize).Find(&notifications).Error; err != nil {
		return nil, 0, err
	}
	return notifications, total, nil
}

func (r *Repo) CountUnreadByCategory(recipientID uuid.UUID) (map[string]int64, int64, error) {
	rows, err := r.db.Model(&model.Notification{}).
		Select("category, count(*) AS count").
		Where("recipient_id = ? AND read_at IS NULL", recipientID).
		Group("category").
		Rows()
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	result := map[string]int64{"like": 0, "interaction": 0, "mention": 0, "reply": 0, "collaboration": 0, "system": 0}
	var total int64
	for rows.Next() {
		var category string
		var count int64
		if err := rows.Scan(&category, &count); err != nil {
			return nil, 0, err
		}
		result[category] = count
		total += count
	}
	return result, total, nil
}
```

- [ ] **Step 5: Implement event processing helpers**

Create `Atoman-Backend/internal/modules/notification/events.go`:

```go
package notification

import (
	"errors"
	"strings"
	"time"

	"atoman/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var categoryByEventType = map[string]string{
	"content.liked": "like",
	"content.bookmarked": "interaction",
	"content.accepted": "interaction",
	"content.quoted": "interaction",
	"content.mentioned": "mention",
	"content.replied": "reply",
	"collaboration.changed": "collaboration",
	"collaboration.required": "collaboration",
	"system.notice": "system",
	"system.security": "system",
	"system.permission": "system",
}

func categoryForEvent(eventType string) string {
	if category, ok := categoryByEventType[eventType]; ok {
		return category
	}
	return "system"
}

func isRequiredEvent(eventType string, payload model.NotificationMeta) bool {
	if eventType == "collaboration.required" || eventType == "system.security" || eventType == "system.permission" {
		return true
	}
	required, _ := payload["required"].(bool)
	return required
}

func isAggregatable(eventType string) bool {
	switch eventType {
	case "content.liked", "content.bookmarked", "content.accepted", "content.quoted":
		return true
	default:
		return false
	}
}

func stringFromPayload(payload model.NotificationMeta, key string) string {
	value, _ := payload[key].(string)
	return strings.TrimSpace(value)
}

func uuidFromPayload(payload model.NotificationMeta, key string) uuid.UUID {
	value := stringFromPayload(payload, key)
	id, err := uuid.Parse(value)
	if err != nil {
		return uuid.Nil
	}
	return id
}

func (s *Service) EnqueueEvent(input EnqueueEventInput) (model.NotificationEvent, error) {
	event := model.NotificationEvent{
		EventType: strings.TrimSpace(input.EventType),
		ActorID: input.ActorID,
		SubjectType: strings.TrimSpace(input.SubjectType),
		SubjectID: input.SubjectID,
		Payload: input.Payload,
		Status: "pending",
		AvailableAt: time.Now(),
	}
	if err := s.db.Create(&event).Error; err != nil {
		return model.NotificationEvent{}, err
	}
	return event, nil
}

func (s *Service) ProcessPendingOnce(now time.Time) error {
	var event model.NotificationEvent
	err := s.db.Where("status = ? AND available_at <= ?", "pending", now).Order("created_at ASC").First(&event).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	return s.ProcessEvent(event.ID, now)
}

func (s *Service) ProcessEvent(eventID uuid.UUID, now time.Time) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		var event model.NotificationEvent
		if err := tx.First(&event, "id = ?", eventID).Error; err != nil {
			return err
		}
		if err := tx.Model(&event).Updates(map[string]any{"status": "processing", "attempts": event.Attempts + 1}).Error; err != nil {
			return err
		}
		status, err := s.createNotificationForEvent(tx, event, now)
		if err != nil {
			status = "failed"
			if event.Attempts+1 < 3 {
				status = "pending"
			}
			return tx.Model(&event).Updates(map[string]any{"status": status, "last_error": err.Error(), "available_at": now.Add(time.Minute)}).Error
		}
		return tx.Model(&event).Updates(map[string]any{"status": status, "processed_at": now}).Error
	})
}

func (s *Service) createNotificationForEvent(tx *gorm.DB, event model.NotificationEvent, now time.Time) (string, error) {
	recipientID := uuidFromPayload(event.Payload, "recipient_id")
	if recipientID == uuid.Nil {
		return "skipped", nil
	}
	if event.ActorID != nil && *event.ActorID == recipientID {
		return "skipped", nil
	}
	category := categoryForEvent(event.EventType)
	required := isRequiredEvent(event.EventType, event.Payload)
	blocked := false
	if event.ActorID != nil {
		var count int64
		if err := tx.Model(&model.UserBlock{}).Where("blocker_id = ? AND blocked_id = ?", recipientID, *event.ActorID).Count(&count).Error; err != nil {
			return "", err
		}
		blocked = count > 0
	}
	if blocked && !required {
		return "skipped", nil
	}
	if !required {
		var preference model.NotificationPreference
		err := tx.Where("user_id = ? AND category = ? AND event_type = ?", recipientID, category, event.EventType).First(&preference).Error
		if err == nil && !preference.Enabled {
			return "skipped", nil
		}
		var muteCount int64
		if err := tx.Model(&model.NotificationMute{}).Where("user_id = ? AND source_type = ? AND source_id = ?", recipientID, event.SubjectType, event.SubjectID).Count(&muteCount).Error; err != nil {
			return "", err
		}
		if muteCount > 0 {
			return "skipped", nil
		}
	}
	actorID := event.ActorID
	if blocked && required {
		actorID = nil
	}
	aggregateKey := recipientID.String() + ":" + event.EventType + ":" + event.SubjectType + ":" + event.SubjectID.String()
	if isAggregatable(event.EventType) {
		var existing model.Notification
		err := tx.Where("recipient_id = ? AND aggregate_key = ? AND read_at IS NULL", recipientID, aggregateKey).First(&existing).Error
		if err == nil {
			updates := map[string]any{
				"latest_actor_id": actorID,
				"actor_count": existing.ActorCount + 1,
				"latest_at": now,
				"read_at": nil,
			}
			return "done", tx.Model(&existing).Updates(updates).Error
		}
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return "", err
		}
	}
	notification := model.Notification{
		RecipientID: recipientID,
		ActorID: actorID,
		LatestActorID: actorID,
		Type: event.EventType,
		Category: category,
		Reason: stringFromPayload(event.Payload, "reason"),
		SourceType: event.SubjectType,
		SourceID: event.SubjectID,
		SourceURL: stringFromPayload(event.Payload, "source_url"),
		AggregateKey: aggregateKey,
		ActorCount: 1,
		LatestAt: &now,
		Meta: event.Payload,
	}
	return "done", tx.Create(&notification).Error
}
```

- [ ] **Step 6: Update service DTO conversion and unread counts**

Modify `Atoman-Backend/internal/modules/notification/service.go`:

```go
func (s *Service) GetUnreadCounts(user authctx.CurrentUser, dmUnread int64) (CategoryUnreadCounts, error) {
	if user.ID == uuid.Nil {
		return CategoryUnreadCounts{}, apperr.Unauthorized("Login required")
	}
	items, total, err := s.repo.CountUnreadByCategory(user.ID)
	if err != nil {
		return CategoryUnreadCounts{}, err
	}
	items["dm"] = dmUnread
	total += dmUnread
	return CategoryUnreadCounts{Total: total, Items: items}, nil
}

func toDTO(notification model.Notification) NotificationDTO {
	dto := NotificationDTO{
		ID: notification.ID.String(),
		Type: notification.Type,
		Category: notification.Category,
		Reason: notification.Reason,
		SourceType: notification.SourceType,
		SourceID: notification.SourceID.String(),
		SourceURL: notification.SourceURL,
		AggregateKey: notification.AggregateKey,
		ActorCount: notification.ActorCount,
		Meta: notification.Meta,
		ReadAt: notification.ReadAt,
		CreatedAt: notification.CreatedAt,
		LatestAt: notification.LatestAt,
	}
	if notification.Actor != nil {
		dto.Actor = toActorDTO(notification.Actor)
	}
	if notification.LatestActor != nil {
		dto.LatestActor = toActorDTO(notification.LatestActor)
	}
	return dto
}

func toActorDTO(user *model.User) *ActorDTO {
	return &ActorDTO{
		ID: user.UUID.String(),
		Username: user.Username,
		DisplayName: user.DisplayName,
		AvatarURL: user.AvatarURL,
	}
}
```

- [ ] **Step 7: Add worker loop**

Create `Atoman-Backend/internal/modules/notification/worker.go`:

```go
package notification

import (
	"context"
	"log"
	"time"
)

func (s *Service) StartWorker(ctx context.Context, interval time.Duration) {
	if interval <= 0 {
		interval = 2 * time.Second
	}
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := s.ProcessPendingOnce(time.Now()); err != nil {
					log.Printf("notification worker: %v", err)
				}
			}
		}
	}()
}
```

- [ ] **Step 8: Run service tests**

Run:

```bash
cd Atoman-Backend
go test ./internal/modules/notification -run 'TestProcessEvent|TestUnreadAggregation|TestListNotificationsFiltersByCategory' -count=1
```

Expected: pass.

- [ ] **Step 9: Commit notification event core**

```bash
cd Atoman-Backend
git add internal/modules/notification/dto.go internal/modules/notification/repo.go internal/modules/notification/service.go internal/modules/notification/events.go internal/modules/notification/worker.go internal/modules/notification/service_test.go
git commit -m "feat: add notification event processor"
```

---

### Task 3: Backend Notification HTTP API

**Files:**
- Modify: `Atoman-Backend/internal/modules/notification/http.go`
- Create: `Atoman-Backend/internal/modules/notification/http_test.go`
- Modify: `Atoman-Backend/internal/app/router.go`
- Modify: `Atoman-Backend/cmd/start_server/main.go`

- [ ] **Step 1: Write HTTP tests**

Create `Atoman-Backend/internal/modules/notification/http_test.go`:

```go
package notification

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"atoman/internal/model"
	"atoman/internal/platform/authctx"
	"atoman/internal/testdb"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func newNotificationHTTPRouter(t *testing.T, current authctx.CurrentUser) (*gin.Engine, *gorm.DB) {
	t.Helper()
	db := testdb.Open(t)
	testdb.Migrate(t, db, &model.User{}, &model.Notification{}, &model.NotificationPreference{}, &model.NotificationMute{}, &model.DMConversation{}, &model.DMMessage{})
	router := gin.New()
	router.Use(func(c *gin.Context) {
		authctx.SetCurrentUser(c, current)
		c.Next()
	})
	RegisterRoutes(router.Group("/api/v1"), NewService(db))
	return router, db
}

func TestUnreadCountsRouteReturnsCategories(t *testing.T) {
	userID := uuid.New()
	router, db := newNotificationHTTPRouter(t, authctx.CurrentUser{ID: userID, Role: authctx.RoleUser})
	notification := model.Notification{RecipientID: userID, Type: "content.liked", Category: "like", SourceType: "post", SourceID: uuid.New(), ActorCount: 1}
	if err := db.Create(&notification).Error; err != nil {
		t.Fatalf("create notification: %v", err)
	}

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/notifications/unread-counts", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"like":1`) {
		t.Fatalf("expected like count: %s", w.Body.String())
	}
}

func TestPreferenceAndMuteRoutes(t *testing.T) {
	userID := uuid.New()
	router, _ := newNotificationHTTPRouter(t, authctx.CurrentUser{ID: userID, Role: authctx.RoleUser})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPut, "/api/v1/notifications/preferences", strings.NewReader(`{"items":[{"category":"like","event_type":"content.liked","enabled":false}]}`))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/api/v1/notifications/mutes", strings.NewReader(`{"source_type":"forum_topic","source_id":"`+uuid.NewString()+`","reason":"too noisy"}`))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
}
```

Use this import block:

```go
import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"atoman/internal/model"
	"atoman/internal/platform/authctx"
	"atoman/internal/testdb"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)
```

- [ ] **Step 2: Run HTTP tests to verify failure**

Run:

```bash
cd Atoman-Backend
go test ./internal/modules/notification -run 'TestUnreadCountsRoute|TestPreferenceAndMuteRoutes' -count=1
```

Expected: fail because the new routes are missing.

- [ ] **Step 3: Add notification routes and handlers**

Modify `Atoman-Backend/internal/modules/notification/http.go`:

```go
func RegisterRoutes(group *gin.RouterGroup, service *Service) {
	h := &Handler{service: service}
	group.GET("/notifications", h.listNotifications)
	group.GET("/notifications/unread-count", h.getUnreadCount)
	group.GET("/notifications/unread-counts", h.getUnreadCounts)
	group.PUT("/notifications/:id/read", h.markRead)
	group.PUT("/notifications/:category/read-all", h.markCategoryRead)
	group.PUT("/notifications/read-all", h.markAllRead)
	group.GET("/notifications/preferences", h.listPreferences)
	group.PUT("/notifications/preferences", h.savePreferences)
	group.POST("/notifications/mutes", h.createMute)
	group.DELETE("/notifications/mutes/:id", h.deleteMute)
}

func (h *Handler) getUnreadCounts(c *gin.Context) {
	user, ok := authctx.Current(c)
	if !ok {
		httpx.Error(c, apperr.Unauthorized("Login required"))
		return
	}
	counts, err := h.service.GetUnreadCounts(user, 0)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, http.StatusOK, counts)
}

func (h *Handler) markCategoryRead(c *gin.Context) {
	user, ok := authctx.Current(c)
	if !ok {
		httpx.Error(c, apperr.Unauthorized("Login required"))
		return
	}
	if err := h.service.MarkAllRead(user, c.Param("category")); err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, http.StatusOK, gin.H{"ok": true})
}
```

Also change `listNotifications` query construction:

```go
	query := ListQuery{
		Page: normalizedPageFromQuery(c),
		PageSize: normalizedPageSizeFromQuery(c),
		Type: strings.TrimSpace(c.Query("type")),
		Category: strings.TrimSpace(c.Query("category")),
	}
```

Add request DTOs and handlers:

```go
type savePreferencesRequest struct {
	Items []struct {
		Category string `json:"category"`
		EventType string `json:"event_type"`
		Enabled bool `json:"enabled"`
	} `json:"items"`
}

type createMuteRequest struct {
	SourceType string `json:"source_type"`
	SourceID string `json:"source_id"`
	Reason string `json:"reason"`
}

func (h *Handler) listPreferences(c *gin.Context) {
	user, ok := authctx.Current(c)
	if !ok {
		httpx.Error(c, apperr.Unauthorized("Login required"))
		return
	}
	items, err := h.service.ListPreferences(user)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, http.StatusOK, items)
}

func (h *Handler) savePreferences(c *gin.Context) {
	user, ok := authctx.Current(c)
	if !ok {
		httpx.Error(c, apperr.Unauthorized("Login required"))
		return
	}
	var req savePreferencesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, apperr.BadRequest("validation.invalid_request", "Invalid request"))
		return
	}
	for _, item := range req.Items {
		if err := h.service.SavePreference(user, item.Category, item.EventType, item.Enabled); err != nil {
			httpx.Error(c, err)
			return
		}
	}
	httpx.OK(c, http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) createMute(c *gin.Context) {
	user, ok := authctx.Current(c)
	if !ok {
		httpx.Error(c, apperr.Unauthorized("Login required"))
		return
	}
	var req createMuteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, apperr.BadRequest("validation.invalid_request", "Invalid request"))
		return
	}
	sourceID, err := uuid.Parse(req.SourceID)
	if err != nil {
		httpx.Error(c, apperr.BadRequest("validation.invalid_request", "Invalid source_id"))
		return
	}
	mute, err := h.service.CreateMute(user, req.SourceType, sourceID, req.Reason)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, http.StatusCreated, mute)
}

func (h *Handler) deleteMute(c *gin.Context) {
	user, ok := authctx.Current(c)
	if !ok {
		httpx.Error(c, apperr.Unauthorized("Login required"))
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.Error(c, apperr.BadRequest("validation.invalid_request", "Invalid mute id"))
		return
	}
	if err := h.service.DeleteMute(user, id); err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, http.StatusOK, gin.H{"ok": true})
}
```

- [ ] **Step 4: Add preference and mute service methods**

Add to `Atoman-Backend/internal/modules/notification/service.go`:

```go
func (s *Service) ListPreferences(user authctx.CurrentUser) ([]model.NotificationPreference, error) {
	if user.ID == uuid.Nil {
		return nil, apperr.Unauthorized("Login required")
	}
	var items []model.NotificationPreference
	err := s.db.Where("user_id = ?", user.ID).Order("category ASC, event_type ASC").Find(&items).Error
	return items, err
}

func (s *Service) SavePreference(user authctx.CurrentUser, category string, eventType string, enabled bool) error {
	if user.ID == uuid.Nil {
		return apperr.Unauthorized("Login required")
	}
	item := model.NotificationPreference{UserID: user.ID, Category: strings.TrimSpace(category), EventType: strings.TrimSpace(eventType), Enabled: enabled}
	return s.db.Where("user_id = ? AND category = ? AND event_type = ?", item.UserID, item.Category, item.EventType).Assign(item).FirstOrCreate(&item).Error
}

func (s *Service) CreateMute(user authctx.CurrentUser, sourceType string, sourceID uuid.UUID, reason string) (model.NotificationMute, error) {
	if user.ID == uuid.Nil {
		return model.NotificationMute{}, apperr.Unauthorized("Login required")
	}
	mute := model.NotificationMute{UserID: user.ID, SourceType: strings.TrimSpace(sourceType), SourceID: sourceID, Reason: strings.TrimSpace(reason)}
	err := s.db.Where("user_id = ? AND source_type = ? AND source_id = ?", mute.UserID, mute.SourceType, mute.SourceID).Assign(mute).FirstOrCreate(&mute).Error
	return mute, err
}

func (s *Service) DeleteMute(user authctx.CurrentUser, muteID uuid.UUID) error {
	if user.ID == uuid.Nil {
		return apperr.Unauthorized("Login required")
	}
	return s.db.Where("id = ? AND user_id = ?", muteID, user.ID).Delete(&model.NotificationMute{}).Error
}
```

- [ ] **Step 5: Start worker in server**

Modify `Atoman-Backend/cmd/start_server/main.go` after `userHub := collab.NewUserHub()`:

```go
	notificationService := notificationmodule.NewService(db)
	notificationService.StartWorker(context.Background(), 2*time.Second)
```

Modify the import block to include:

```go
	"context"
	"time"
	notificationmodule "atoman/internal/modules/notification"
```

- [ ] **Step 6: Run HTTP tests**

Run:

```bash
cd Atoman-Backend
go test ./internal/modules/notification -count=1
```

Expected: pass.

- [ ] **Step 7: Commit notification HTTP API**

```bash
cd Atoman-Backend
git add internal/modules/notification/http.go internal/modules/notification/http_test.go internal/modules/notification/service.go cmd/start_server/main.go
git commit -m "feat: expose unified notification api"
```

---

### Task 4: Backend User Blocks and DM Integration

**Files:**
- Create: `Atoman-Backend/internal/modules/userblock/service.go`
- Create: `Atoman-Backend/internal/modules/userblock/http.go`
- Create: `Atoman-Backend/internal/modules/userblock/service_test.go`
- Create: `Atoman-Backend/internal/modules/userblock/http_test.go`
- Modify: `Atoman-Backend/internal/app/router.go`
- Modify: `Atoman-Backend/internal/handlers/dm_handler.go`
- Modify: `Atoman-Backend/internal/handlers/dm_handler_test.go`

- [ ] **Step 1: Write user block service tests**

Create `Atoman-Backend/internal/modules/userblock/service_test.go`:

```go
package userblock

import (
	"testing"

	"atoman/internal/model"
	"atoman/internal/platform/authctx"
	"atoman/internal/testdb"
)

func TestBlockUserCreatesOneWayBlock(t *testing.T) {
	db := testdb.Open(t)
	testdb.Migrate(t, db, &model.User{}, &model.UserBlock{})
	blocker := model.User{Username: "blocker", Email: "blocker@example.com", Password: "hash", Role: "user", IsActive: true}
	blocked := model.User{Username: "blocked", Email: "blocked@example.com", Password: "hash", Role: "user", IsActive: true}
	db.Create(&blocker)
	db.Create(&blocked)

	svc := NewService(db)
	if err := svc.Block(authctx.CurrentUser{ID: blocker.UUID, Role: authctx.RoleUser}, blocked.UUID); err != nil {
		t.Fatalf("block user: %v", err)
	}
	if !svc.IsBlocked(blocker.UUID, blocked.UUID) {
		t.Fatalf("expected block to exist")
	}
	if svc.IsBlocked(blocked.UUID, blocker.UUID) {
		t.Fatalf("expected block to be one-way")
	}
}
```

- [ ] **Step 2: Implement user block service**

Create `Atoman-Backend/internal/modules/userblock/service.go`:

```go
package userblock

import (
	"atoman/internal/model"
	"atoman/internal/platform/apperr"
	"atoman/internal/platform/authctx"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Service struct{ db *gorm.DB }

func NewService(db *gorm.DB) *Service { return &Service{db: db} }

func (s *Service) Block(user authctx.CurrentUser, blockedID uuid.UUID) error {
	if user.ID == uuid.Nil {
		return apperr.Unauthorized("Login required")
	}
	if blockedID == uuid.Nil || blockedID == user.ID {
		return apperr.BadRequest("validation.invalid_request", "invalid blocked user")
	}
	block := model.UserBlock{BlockerID: user.ID, BlockedID: blockedID}
	return s.db.Where("blocker_id = ? AND blocked_id = ?", user.ID, blockedID).FirstOrCreate(&block).Error
}

func (s *Service) Unblock(user authctx.CurrentUser, blockedID uuid.UUID) error {
	if user.ID == uuid.Nil {
		return apperr.Unauthorized("Login required")
	}
	return s.db.Where("blocker_id = ? AND blocked_id = ?", user.ID, blockedID).Delete(&model.UserBlock{}).Error
}

func (s *Service) List(user authctx.CurrentUser) ([]model.UserBlock, error) {
	if user.ID == uuid.Nil {
		return nil, apperr.Unauthorized("Login required")
	}
	var blocks []model.UserBlock
	err := s.db.Preload("Blocked").Where("blocker_id = ?", user.ID).Order("created_at DESC").Find(&blocks).Error
	return blocks, err
}

func (s *Service) IsBlocked(blockerID uuid.UUID, blockedID uuid.UUID) bool {
	var count int64
	s.db.Model(&model.UserBlock{}).Where("blocker_id = ? AND blocked_id = ?", blockerID, blockedID).Count(&count)
	return count > 0
}
```

- [ ] **Step 3: Add user block HTTP routes**

Create `Atoman-Backend/internal/modules/userblock/http.go`:

```go
package userblock

import (
	"net/http"

	"atoman/internal/platform/apperr"
	"atoman/internal/platform/authctx"
	"atoman/internal/platform/httpx"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct{ service *Service }

func RegisterRoutes(group *gin.RouterGroup, service *Service) {
	h := &Handler{service: service}
	group.GET("/blocked", h.list)
	group.POST("/:id/block", h.block)
	group.DELETE("/:id/block", h.unblock)
}

func (h *Handler) list(c *gin.Context) {
	user, ok := authctx.Current(c)
	if !ok {
		httpx.Error(c, apperr.Unauthorized("Login required"))
		return
	}
	items, err := h.service.List(user)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, http.StatusOK, items)
}

func (h *Handler) block(c *gin.Context) {
	user, ok := authctx.Current(c)
	if !ok {
		httpx.Error(c, apperr.Unauthorized("Login required"))
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.Error(c, apperr.BadRequest("validation.invalid_request", "invalid user id"))
		return
	}
	if err := h.service.Block(user, id); err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, http.StatusOK, gin.H{"blocked": true})
}

func (h *Handler) unblock(c *gin.Context) {
	user, ok := authctx.Current(c)
	if !ok {
		httpx.Error(c, apperr.Unauthorized("Login required"))
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.Error(c, apperr.BadRequest("validation.invalid_request", "invalid user id"))
		return
	}
	if err := h.service.Unblock(user, id); err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, http.StatusOK, gin.H{"blocked": false})
}
```

- [ ] **Step 4: Register user block routes**

Modify `Atoman-Backend/internal/app/router.go` imports:

```go
	"atoman/internal/modules/userblock"
```

Add after notification route registration:

```go
	userblock.RegisterRoutes(group.Group("/users"), userblock.NewService(db))
```

- [ ] **Step 5: Integrate blocks into DM send and response**

Modify `Atoman-Backend/internal/handlers/dm_handler.go`:

Add to `dmConversationItem`:

```go
	IsBlocked bool `json:"is_blocked"`
```

In `listConversations`, set:

```go
blocked := h.isBlocked(userID, otherID)
```

and include `IsBlocked: blocked`.

Before sending a message in `sendMessage`, add:

```go
	if h.isBlocked(other.UUID, senderID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "dm_blocked", "message": "对方暂时无法接收你的私信"})
		return
	}
```

Add helper:

```go
func (h *dmHandler) isBlocked(blockerID, blockedID uuid.UUID) bool {
	var count int64
	h.db.Model(&model.UserBlock{}).Where("blocker_id = ? AND blocked_id = ?", blockerID, blockedID).Count(&count)
	return count > 0
}
```

- [ ] **Step 6: Add DM block tests**

Append to `Atoman-Backend/internal/handlers/dm_handler_test.go`:

```go
func TestSendMessageRejectsBlockedSender(t *testing.T) {
	r, db, sender, recipient := newDMTestRouter(t)
	if err := db.Create(&model.UserBlock{BlockerID: recipient.UUID, BlockedID: sender.UUID}).Error; err != nil {
		t.Fatalf("create block: %v", err)
	}
	body := bytes.NewReader([]byte(`{"content":"hello"}`))
	req := httptest.NewRequest(http.MethodPost, "/api/v1/dm/conversations/"+recipient.Username, body)
	req.Header.Set("Authorization", dmAuthHeader(t, sender))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "dm_blocked") {
		t.Fatalf("expected dm_blocked response: %s", w.Body.String())
	}
}
```

Add `&model.UserBlock{}` to the test migration list in the helper.

- [ ] **Step 7: Run block and DM tests**

Run:

```bash
cd Atoman-Backend
go test ./internal/modules/userblock ./internal/handlers -run 'TestBlockUser|TestSendMessageRejectsBlockedSender|TestOneBeforeReply' -count=1
```

Expected: pass.

- [ ] **Step 8: Commit user block and DM integration**

```bash
cd Atoman-Backend
git add internal/modules/userblock internal/app/router.go internal/handlers/dm_handler.go internal/handlers/dm_handler_test.go
git commit -m "feat: add user blocking for dm"
```

---

### Task 5: Frontend Types, API Endpoints, and Stores

**Files:**
- Modify: `Atoman-Frontend/src/types.ts`
- Modify: `Atoman-Frontend/src/composables/useApi.ts`
- Modify: `Atoman-Frontend/src/stores/notification.ts`
- Modify: `Atoman-Frontend/src/stores/inbox.ts`
- Modify: `Atoman-Frontend/src/stores/dm.ts`
- Create: `Atoman-Frontend/src/stores/userBlocks.ts`
- Test: `Atoman-Frontend/tests/unit/stores/notification.spec.ts`
- Test: `Atoman-Frontend/tests/unit/stores/dm.spec.ts`

- [ ] **Step 1: Update type definitions**

Modify `Atoman-Frontend/src/types.ts`:

```ts
export type NotificationCategory = 'like' | 'interaction' | 'mention' | 'reply' | 'collaboration' | 'system'
export type InboxTab = NotificationCategory | 'dm'
export type NotificationFilterType = NotificationCategory

export interface Notification {
  id: string
  recipient_id: string
  actor_id?: string | null
  actor?: User | null
  latest_actor?: User | null
  type: string
  category: NotificationCategory
  reason: string
  source_type: string
  source_id: string
  source_url?: string
  aggregate_key?: string
  actor_count: number
  meta: {
    title?: string
    body?: string
    source_label?: string
    topic_id?: string
    topic_title?: string
    reply_excerpt?: string
    actor_count?: number
    recent_actors?: string[]
    [key: string]: any
  }
  read_at?: string | null
  created_at: string
  updated_at: string
}

export interface NotificationUnreadCounts {
  total: number
  items: Record<InboxTab, number>
}

export interface NotificationPreference {
  id?: string
  category: NotificationCategory
  event_type: string
  enabled: boolean
}

export interface NotificationMute {
  id: string
  source_type: string
  source_id: string
  reason: string
  created_at: string
}

export interface BlockedUser {
  id: string
  blocked_id: string
  blocked?: User
  created_at: string
}

export interface DMConversation {
  conversation_id: string
  other_username: string
  other_user_id: string
  last_message_at?: string | null
  preview: string
  unread_count: number
  is_blocked?: boolean
}
```

- [ ] **Step 2: Add API endpoints**

Modify `Atoman-Frontend/src/composables/useApi.ts`:

```ts
    notifications: {
      list: `${apiUrl}/notifications`,
      unreadCount: `${apiUrl}/notifications/unread-count`,
      unreadCounts: `${apiUrl}/notifications/unread-counts`,
      markRead: (id: string) => `${apiUrl}/notifications/${id}/read`,
      markCategoryRead: (category: string) => `${apiUrl}/notifications/${category}/read-all`,
      markAllRead: `${apiUrl}/notifications/read-all`,
      preferences: `${apiUrl}/notifications/preferences`,
      mutes: `${apiUrl}/notifications/mutes`,
      mute: (id: string) => `${apiUrl}/notifications/mutes/${id}`,
    },
```

Add under `users`:

```ts
      blocked: `${apiUrl}/users/blocked`,
      block: (userUuid: string) => `${apiUrl}/users/${userUuid}/block`,
```

- [ ] **Step 3: Rewrite notification store around categories**

Modify `Atoman-Frontend/src/stores/notification.ts`:

```ts
const notificationCategories: InboxTab[] = ['like', 'interaction', 'mention', 'reply', 'collaboration', 'system', 'dm']
const unreadCounts = ref<Record<InboxTab, number>>({
  like: 0,
  interaction: 0,
  mention: 0,
  reply: 0,
  collaboration: 0,
  system: 0,
  dm: 0,
})
const unreadCount = computed(() => notificationCategories.reduce((sum, key) => sum + (unreadCounts.value[key] || 0), 0))
const currentCategory = ref<InboxTab>('mention')

const fetchUnreadCounts = async () => {
  if (!authStore.token) return
  const res = await fetch(api.notifications.unreadCounts, { headers: authHeaders() })
  if (!res.ok) return
  const data = await res.json()
  const payload = data.data || data
  unreadCounts.value = { ...unreadCounts.value, ...(payload.items || {}) }
}

const fetchNotifications = async (category: NotificationCategory = currentCategory.value as NotificationCategory, nextPage = 1) => {
  if (!authStore.token) return
  loading.value = true
  try {
    currentCategory.value = category
    page.value = nextPage
    const params = new URLSearchParams({ page: String(nextPage), category })
    const res = await fetch(`${api.notifications.list}?${params.toString()}`, { headers: authHeaders() })
    if (!res.ok) throw new Error('获取通知失败')
    const data = await res.json()
    notifications.value = data.data || []
    total.value = data.total || 0
  } finally {
    loading.value = false
  }
}

const markRead = async (id: string) => {
  if (!authStore.token) return
  const res = await fetch(api.notifications.markRead(id), {
    method: 'PUT',
    headers: authHeaders(),
  })
  if (!res.ok) return
  const target = notifications.value.find((item) => item.id === id)
  if (target && !target.read_at) {
    target.read_at = new Date().toISOString()
    unreadCounts.value[target.category] = Math.max(0, (unreadCounts.value[target.category] || 0) - 1)
  }
}

const markAllRead = async (category: NotificationCategory = currentCategory.value as NotificationCategory) => {
  if (!authStore.token) return
  const res = await fetch(api.notifications.markCategoryRead(category), {
    method: 'PUT',
    headers: authHeaders(),
  })
  if (!res.ok) return
  const readAt = new Date().toISOString()
  notifications.value = notifications.value.map((item) =>
    item.category === category ? { ...item, read_at: item.read_at || readAt } : item,
  )
  unreadCounts.value[category] = 0
}

const receiveNotification = (notification: Notification) => {
  unreadCounts.value[notification.category] = (unreadCounts.value[notification.category] || 0) + 1
  if (currentCategory.value === notification.category) {
    notifications.value = [notification, ...notifications.value]
    total.value += 1
  }
}

const savePreference = async (category: NotificationCategory, eventType: string, enabled: boolean) => {
  if (!authStore.token) return
  const res = await fetch(api.notifications.preferences, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ items: [{ category, event_type: eventType, enabled }] }),
  })
  if (!res.ok) throw new Error('保存通知设置失败')
}

const savePreferences = async (items: NotificationPreference[]) => {
  if (!authStore.token) return
  const res = await fetch(api.notifications.preferences, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ items }),
  })
  if (!res.ok) throw new Error('保存通知设置失败')
}

const createMute = async (sourceType: string, sourceId: string, reason: string) => {
  if (!authStore.token) return
  const res = await fetch(api.notifications.mutes, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ source_type: sourceType, source_id: sourceId, reason }),
  })
  if (!res.ok) throw new Error('不再提醒失败')
  return await res.json()
}
```

Update the store imports:

```ts
import { computed, ref } from 'vue'
import type { InboxTab, Notification, NotificationCategory, NotificationPreference } from '@/types'
```

Return the new values and methods:

```ts
return {
  unreadCount,
  unreadCounts,
  notifications,
  loading,
  total,
  page,
  currentCategory,
  fetchUnreadCounts,
  fetchNotifications,
  markRead,
  markAllRead,
  receiveNotification,
  savePreference,
  savePreferences,
  createMute,
}
```

- [ ] **Step 4: Update inbox store**

Modify `Atoman-Frontend/src/stores/inbox.ts`:

```ts
const totalUnread = computed(() => notificationStore.unreadCount)
```

In polling and bootstrap, call:

```ts
notificationStore.fetchUnreadCounts()
```

Remove separate `dmStore.fetchUnreadCount()` from `totalUnread` calculation because `unread-counts` already includes `dm`.

- [ ] **Step 5: Update DM store for blocked state**

Modify `Atoman-Frontend/src/stores/dm.ts`:

```ts
const activeConversationBlocked = computed(() => {
  const active = activeConversation.value
  return Boolean(conversations.value.find((item) => item.other_username === active)?.is_blocked)
})
```

Return `activeConversationBlocked`.

In `sendMessage`:

```ts
if (activeConversationBlocked.value) throw new Error('已拉黑此用户')
```

- [ ] **Step 6: Add user block store**

Create `Atoman-Frontend/src/stores/userBlocks.ts`:

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type { BlockedUser } from '@/types'

export const useUserBlocksStore = defineStore('userBlocks', () => {
  const api = useApi()
  const authStore = useAuthStore()
  const blockedUsers = ref<BlockedUser[]>([])
  const loading = ref(false)

  const authHeaders = () => ({
    Authorization: `Bearer ${authStore.token}`,
    'Content-Type': 'application/json',
  })

  const fetchBlockedUsers = async () => {
    if (!authStore.token) return
    loading.value = true
    try {
      const res = await fetch(api.users.blocked, { headers: authHeaders() })
      if (!res.ok) throw new Error('获取拉黑列表失败')
      const data = await res.json()
      blockedUsers.value = data.data || []
    } finally {
      loading.value = false
    }
  }

  const blockUser = async (userUuid: string) => {
    const res = await fetch(api.users.block(userUuid), { method: 'POST', headers: authHeaders() })
    if (!res.ok) throw new Error('拉黑失败')
    await fetchBlockedUsers()
  }

  const unblockUser = async (userUuid: string) => {
    const res = await fetch(api.users.block(userUuid), { method: 'DELETE', headers: authHeaders() })
    if (!res.ok) throw new Error('取消拉黑失败')
    blockedUsers.value = blockedUsers.value.filter((item) => item.blocked_id !== userUuid)
  }

  return { blockedUsers, loading, fetchBlockedUsers, blockUser, unblockUser }
})
```

- [ ] **Step 7: Write store tests**

Append to `Atoman-Frontend/tests/unit/stores/notification.spec.ts`:

```ts
it('stores unread counts by notification category', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
    data: { total: 9, items: { like: 2, interaction: 1, mention: 1, reply: 2, collaboration: 3, system: 0, dm: 0 } },
  }), { status: 200 }))
  const store = useNotificationStore()
  await store.fetchUnreadCounts()
  expect(store.unreadCounts.like).toBe(2)
  expect(store.unreadCount).toBe(9)
})
```

Create `Atoman-Frontend/tests/unit/stores/dm.spec.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDMStore } from '@/stores/dm'

describe('dm store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('exposes blocked state for active conversation', () => {
    const store = useDMStore()
    store.conversations = [{ conversation_id: 'c1', other_username: 'alice', other_user_id: 'u1', preview: '', unread_count: 0, is_blocked: true }]
    store.activeConversation = 'alice'
    expect(store.activeConversationBlocked).toBe(true)
  })
})
```

- [ ] **Step 8: Run frontend store tests**

Run:

```bash
cd Atoman-Frontend
bun run test:unit -- tests/unit/stores/notification.spec.ts tests/unit/stores/dm.spec.ts
```

Expected: pass.

- [ ] **Step 9: Commit frontend stores**

```bash
cd Atoman-Frontend
git add src/types.ts src/composables/useApi.ts src/stores/notification.ts src/stores/inbox.ts src/stores/dm.ts src/stores/userBlocks.ts tests/unit/stores/notification.spec.ts tests/unit/stores/dm.spec.ts
git commit -m "feat: add notification category stores"
```

---

### Task 6: Frontend Topbar Notification Dropdown

**Files:**
- Modify: `Atoman-Frontend/src/components/system/AppTopbarAuthControls.vue`
- Test: `Atoman-Frontend/tests/unit/components/AppTopbarAuthControls.spec.ts`

- [ ] **Step 1: Add topbar test**

Append to `Atoman-Frontend/tests/unit/components/AppTopbarAuthControls.spec.ts`:

```ts
it('opens notification category dropdown and routes to selected inbox tab', async () => {
  const wrapper = mount(AppTopbarAuthControls, {
    global: {
      plugins: [createTestingPinia({ stubActions: false })],
      stubs: { RouterLink },
    },
  })
  const notificationStore = useNotificationStore()
  notificationStore.unreadCounts = { like: 2, interaction: 1, mention: 0, reply: 3, collaboration: 1, system: 0, dm: 4 }
  await wrapper.find('[data-testid="notification-menu-button"]').trigger('click')
  expect(wrapper.text()).toContain('点赞')
  expect(wrapper.text()).toContain('私信')
  expect(wrapper.find('[data-testid="notification-menu-dm"]').attributes('href')).toContain('tab=dm')
})
```

- [ ] **Step 2: Run topbar test to verify failure**

Run:

```bash
cd Atoman-Frontend
bun run test:unit -- tests/unit/components/AppTopbarAuthControls.spec.ts
```

Expected: fail because the dropdown does not exist.

- [ ] **Step 3: Replace notification RouterLink with dropdown**

Modify `AppTopbarAuthControls.vue` template around the current notification link:

```vue
<div class="dropdown-wrap" data-dropdown="notification">
  <button
    class="notif-btn"
    type="button"
    data-testid="notification-menu-button"
    :title="notificationRoom.helper"
    :aria-label="notificationRoom.name"
    @click="toggleDropdown('notification')"
  >
    <span class="notif-btn__icon" aria-hidden="true">◌</span>
    <span class="notif-btn__text">{{ notificationRoom.name }}</span>
    <span v-if="inboxStore.totalUnread > 0" class="notif-count">{{ inboxStore.totalUnread }}</span>
  </button>
  <div v-if="activeDropdown === 'notification'" class="dropdown notification-dropdown">
    <RouterLink
      v-for="item in notificationMenuItems"
      :key="item.key"
      class="dropdown-item notification-dropdown__item"
      :to="modulePathUrl('feed', `/inbox?tab=${item.key}`)"
      :data-testid="`notification-menu-${item.key}`"
      @click="closeDropdown"
    >
      <span>{{ item.label }}</span>
      <span v-if="notificationStore.unreadCounts[item.key] > 0" class="notif-count">{{ notificationStore.unreadCounts[item.key] }}</span>
    </RouterLink>
  </div>
</div>
```

Modify the script imports and constants:

```ts
import { useNotificationStore } from '@/stores/notification'
import type { InboxTab } from '@/types'

const notificationStore = useNotificationStore()
const notificationMenuItems: Array<{ key: InboxTab; label: string }> = [
  { key: 'like', label: '点赞' },
  { key: 'interaction', label: '互动' },
  { key: 'mention', label: '@我' },
  { key: 'reply', label: '回复我' },
  { key: 'collaboration', label: '协作' },
  { key: 'system', label: '系统' },
  { key: 'dm', label: '私信' },
]
```

- [ ] **Step 4: Add dropdown CSS**

Add scoped CSS in `AppTopbarAuthControls.vue`:

```css
.notification-dropdown {
  min-width: 12rem;
}

.notification-dropdown__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
```

- [ ] **Step 5: Run topbar tests**

Run:

```bash
cd Atoman-Frontend
bun run test:unit -- tests/unit/components/AppTopbarAuthControls.spec.ts
```

Expected: pass.

- [ ] **Step 6: Commit topbar dropdown**

```bash
cd Atoman-Frontend
git add src/components/system/AppTopbarAuthControls.vue tests/unit/components/AppTopbarAuthControls.spec.ts
git commit -m "feat: add notification category dropdown"
```

---

### Task 7: Frontend Inbox Page Refactor

**Files:**
- Modify: `Atoman-Frontend/src/views/feed/InboxPage.vue`
- Test: `Atoman-Frontend/tests/unit/views/feed/InboxPage.notifications.spec.ts`

- [ ] **Step 1: Write inbox page tests**

Create `Atoman-Frontend/tests/unit/views/feed/InboxPage.notifications.spec.ts`:

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import InboxPage from '@/views/feed/InboxPage.vue'
import { useNotificationStore } from '@/stores/notification'
import { useDMStore } from '@/stores/dm'

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: { tab: 'collaboration' }, fullPath: '/feed/inbox?tab=collaboration' }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

describe('InboxPage notifications', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('renders fixed notification categories without all tab', async () => {
    const wrapper = mount(InboxPage, { global: { stubs: ['PButton', 'PEmpty', 'PTextarea', 'PTab', 'PPress', 'PBadge'] } })
    expect(wrapper.text()).toContain('点赞')
    expect(wrapper.text()).toContain('互动')
    expect(wrapper.text()).toContain('协作')
    expect(wrapper.text()).not.toContain('全部')
  })

  it('shows notification reason in detail pane', async () => {
    const store = useNotificationStore()
    store.notifications = [{
      id: 'n1',
      recipient_id: 'u1',
      type: 'collaboration.required',
      category: 'collaboration',
      reason: '因为歌词修改影响了你的注释',
      source_type: 'music_lyrics',
      source_id: 's1',
      actor_count: 1,
      meta: { title: '歌词修改影响了你的注释绑定', body: '需要重新绑定' },
      created_at: '2026-07-07T00:00:00Z',
      updated_at: '2026-07-07T00:00:00Z',
    }]
    const wrapper = mount(InboxPage, { global: { stubs: ['PButton', 'PEmpty', 'PTextarea', 'PTab', 'PPress', 'PBadge'] } })
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('因为歌词修改影响了你的注释')
  })

  it('disables dm composer for blocked conversation', () => {
    const dm = useDMStore()
    dm.conversations = [{ conversation_id: 'c1', other_username: 'alice', other_user_id: 'u1', preview: '', unread_count: 0, is_blocked: true }]
    dm.activeConversation = 'alice'
    const wrapper = mount(InboxPage, { global: { stubs: ['PButton', 'PEmpty', 'PTextarea', 'PTab', 'PPress', 'PBadge'] } })
    expect(wrapper.text()).toContain('已拉黑此用户')
  })
})
```

- [ ] **Step 2: Run inbox tests to verify failure**

Run:

```bash
cd Atoman-Frontend
bun run test:unit -- tests/unit/views/feed/InboxPage.notifications.spec.ts
```

Expected: fail because the new categories and detail fields are not rendered.

- [ ] **Step 3: Update tabs and active tab handling**

Modify `InboxPage.vue`:

```ts
const tabs: Array<{ key: InboxTab; label: string }> = [
  { key: 'like', label: '点赞' },
  { key: 'interaction', label: '互动' },
  { key: 'mention', label: '@我' },
  { key: 'reply', label: '回复我' },
  { key: 'collaboration', label: '协作' },
  { key: 'system', label: '系统' },
  { key: 'dm', label: '私信' },
]

const activeTab = computed<InboxTab>(() => {
  const tab = route.query.tab
  if (tab === 'like' || tab === 'interaction' || tab === 'mention' || tab === 'reply' || tab === 'collaboration' || tab === 'system' || tab === 'dm') return tab
  const firstUnread = tabs.find((item) => notificationStore.unreadCounts[item.key] > 0)
  return firstUnread?.key || 'mention'
})
```

Remove `notificationTypeByTab`.

- [ ] **Step 4: Update notification loading and read all**

Modify `loadTab`:

```ts
  await notificationStore.fetchNotifications(activeTab.value as NotificationCategory, 1)
  selectedNotificationId.value = notificationStore.notifications[0]?.id || null
```

Modify `markCurrentNotificationsRead`:

```ts
await notificationStore.markAllRead(activeTab.value as NotificationCategory)
```

- [ ] **Step 5: Update notification detail**

In the detail card template, add:

```vue
<p class="detail-reason">{{ selectedNotification.reason }}</p>
<p class="detail-source">{{ selectedNotification.meta.source_label || selectedNotification.source_type }}</p>
<div class="detail-actions">
  <PButton @click="jumpToNotification(selectedNotification)">前往来源</PButton>
  <PButton variant="secondary" @click="notificationStore.markRead(selectedNotification.id)">标记已读</PButton>
  <PButton variant="secondary" @click="muteNotificationType(selectedNotification)">不再提醒此类</PButton>
  <PButton variant="secondary" @click="muteNotificationSource(selectedNotification)">不再提醒此内容</PButton>
</div>
```

Add methods:

```ts
const muteNotificationType = async (notification: Notification) => {
  await notificationStore.savePreference(notification.category, notification.type, false)
}

const muteNotificationSource = async (notification: Notification) => {
  await notificationStore.createMute(notification.source_type, notification.source_id, notification.reason)
}
```

- [ ] **Step 6: Update DM blocked UI**

In the DM composer template:

```vue
<PTextarea
  v-model="dmContent"
  label="消息内容"
  :rows="3"
  :placeholder="dmStore.activeConversationBlocked ? '已拉黑此用户' : '输入私信'"
  :disabled="dmStore.activeConversationBlocked"
  :error="dmError || undefined"
/>
<PButton type="submit" :disabled="dmStore.activeConversationBlocked" :loading="dmSending" loadingText="发送中...">发送</PButton>
```

Add a top action:

```vue
<PButton v-if="dmStore.activeConversationBlocked" variant="secondary" @click="unblockActiveConversation">取消拉黑</PButton>
<PButton v-else variant="secondary" @click="blockActiveConversation">拉黑</PButton>
```

Use `useUserBlocksStore()` to call block/unblock by `other_user_id`.

- [ ] **Step 7: Run inbox tests**

Run:

```bash
cd Atoman-Frontend
bun run test:unit -- tests/unit/views/feed/InboxPage.notifications.spec.ts
```

Expected: pass.

- [ ] **Step 8: Commit inbox refactor**

```bash
cd Atoman-Frontend
git add src/views/feed/InboxPage.vue tests/unit/views/feed/InboxPage.notifications.spec.ts
git commit -m "feat: refactor inbox notification categories"
```

---

### Task 8: Frontend Notification and Block Settings

**Files:**
- Modify: `Atoman-Frontend/src/views/blog/BlogSettingsView.vue`
- Test: `Atoman-Frontend/tests/unit/views/blog/BlogSettingsView.notifications.spec.ts`

- [ ] **Step 1: Write settings test**

Create `Atoman-Frontend/tests/unit/views/blog/BlogSettingsView.notifications.spec.ts`:

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import BlogSettingsView from '@/views/blog/BlogSettingsView.vue'

describe('BlogSettingsView notification settings', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }))
  })

  it('shows notification and blocked user settings', () => {
    const wrapper = mount(BlogSettingsView, { global: { stubs: ['PButton', 'PSelect'] } })
    expect(wrapper.text()).toContain('通知设置')
    expect(wrapper.text()).toContain('已拉黑用户')
    expect(wrapper.text()).toContain('陌生人仅可发一条')
  })
})
```

- [ ] **Step 2: Run settings test to verify failure**

Run:

```bash
cd Atoman-Frontend
bun run test:unit -- tests/unit/views/blog/BlogSettingsView.notifications.spec.ts
```

Expected: fail because notification settings are not rendered.

- [ ] **Step 3: Change default DM permission in form**

Modify `BlogSettingsView.vue`:

```ts
const form = ref({
  display_name: '',
  bio: '',
  website: '',
  location: '',
  avatar_url: '',
  dm_permission: 'one_before_reply' as DMPermission,
})
```

In `loadProfile`, change fallback:

```ts
dm_permission: 'one_before_reply',
```

and:

```ts
form.value.dm_permission = settingsData.data?.dm_permission || 'one_before_reply'
```

- [ ] **Step 4: Add notification settings UI**

Add below the private message permission field:

```vue
<section class="settings-section">
  <h2 class="a-subtitle">通知设置</h2>
  <label class="settings-toggle">
    <input v-model="notificationPrefs.like" type="checkbox" />
    <span>点赞提醒</span>
  </label>
  <label class="settings-toggle">
    <input v-model="notificationPrefs.interaction" type="checkbox" />
    <span>互动提醒</span>
  </label>
  <label class="settings-toggle">
    <input v-model="notificationPrefs.reply" type="checkbox" />
    <span>回复提醒</span>
  </label>
  <label class="settings-toggle">
    <input v-model="notificationPrefs.collaboration" type="checkbox" />
    <span>协作提醒</span>
  </label>
  <p class="a-muted">私信、@我、账号安全和关键权限变化始终提醒。</p>
</section>

<section class="settings-section">
  <h2 class="a-subtitle">已拉黑用户</h2>
  <div v-if="userBlocksStore.blockedUsers.length === 0" class="a-muted">暂无拉黑用户</div>
  <div v-for="item in userBlocksStore.blockedUsers" :key="item.id" class="blocked-user-row">
    <span>{{ item.blocked?.display_name || item.blocked?.username || item.blocked_id }}</span>
    <PButton variant="secondary" type="button" @click="userBlocksStore.unblockUser(item.blocked_id)">取消拉黑</PButton>
  </div>
</section>
```

Add script:

```ts
import { useUserBlocksStore } from '@/stores/userBlocks'
import { useNotificationStore } from '@/stores/notification'

const userBlocksStore = useUserBlocksStore()
const notificationStore = useNotificationStore()
const notificationPrefs = ref({
  like: true,
  interaction: true,
  reply: true,
  collaboration: true,
})
```

In `onMounted`, call:

```ts
await userBlocksStore.fetchBlockedUsers()
```

In `save`, before profile update, call:

```ts
await notificationStore.savePreferences([
  { category: 'like', event_type: 'content.liked', enabled: notificationPrefs.value.like },
  { category: 'interaction', event_type: 'content.bookmarked', enabled: notificationPrefs.value.interaction },
  { category: 'reply', event_type: 'content.replied', enabled: notificationPrefs.value.reply },
  { category: 'collaboration', event_type: 'collaboration.changed', enabled: notificationPrefs.value.collaboration },
])
```

- [ ] **Step 5: Add settings CSS**

Add scoped CSS:

```css
.settings-section {
  border-top: 1.5px solid var(--a-color-line-soft);
  padding-top: 1.25rem;
}

.settings-toggle,
.blocked-user-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 0;
}
```

- [ ] **Step 6: Run settings test**

Run:

```bash
cd Atoman-Frontend
bun run test:unit -- tests/unit/views/blog/BlogSettingsView.notifications.spec.ts
```

Expected: pass.

- [ ] **Step 7: Commit settings UI**

```bash
cd Atoman-Frontend
git add src/views/blog/BlogSettingsView.vue tests/unit/views/blog/BlogSettingsView.notifications.spec.ts
git commit -m "feat: add notification and block settings"
```

---

### Task 9: Final Verification

**Files:**
- All files touched by prior tasks.

- [ ] **Step 1: Run backend build**

```bash
cd Atoman-Backend
go build ./...
```

Expected: no output and exit code 0.

- [ ] **Step 2: Run backend focused tests**

```bash
cd Atoman-Backend
go test ./internal/modules/notification ./internal/modules/userblock ./internal/handlers ./internal/migrations -count=1
```

Expected: pass.

- [ ] **Step 3: Run frontend type-check**

```bash
cd Atoman-Frontend
bun run type-check
```

Expected: pass.

- [ ] **Step 4: Run frontend focused tests**

```bash
cd Atoman-Frontend
bun run test:unit -- tests/unit/stores/notification.spec.ts tests/unit/stores/dm.spec.ts tests/unit/components/AppTopbarAuthControls.spec.ts tests/unit/views/feed/InboxPage.notifications.spec.ts tests/unit/views/blog/BlogSettingsView.notifications.spec.ts
```

Expected: pass.

- [ ] **Step 5: Inspect final status**

```bash
cd Atoman-Backend
git status --short
cd ../Atoman-Frontend
git status --short
```

Expected: no unstaged files from this feature remain.

---

## Self-Review

Spec coverage:

- Unified notification categories: Tasks 2, 3, 5, 6, 7.
- No all category: Tasks 6 and 7.
- Category unread counts: Tasks 2, 3, 5, 6.
- Notification reason: Tasks 1, 2, 7.
- Preferences and content mutes: Tasks 1, 2, 3, 8.
- PostgreSQL event queue: Tasks 1 and 2.
- In-process worker: Tasks 2 and 3.
- Unread aggregation: Task 2.
- DM remains separate but unified in UI: Tasks 5 and 7.
- Default stranger one-message DM permission: Tasks 1, 4, 8.
- One-way user blocking: Tasks 1, 4, 5, 7, 8.
- Blocked content folding foundation: Task 4 provides API and Task 5 provides frontend state. Content-surface folding is a separate follow-up for each surface because forum, comments, music annotations, blog, timeline, and debate render authors in different components.

Implementation notes:

- This plan does not build email, browser push, digest, deletion, archive, or an all-notifications tab.
- The music lyrics plan is the first non-forum producer for collaboration reminders. It should create `notification_events` rows with `event_type = collaboration.required`, `subject_type = music_lyrics`, `subject_id = song_id`, and payload keys `recipient_id`, `song_id`, `annotation_id`, `title`, `body`, `reason`, `required = true`.
- Existing forum notification producers remain compatible during this plan. Producer-by-producer migration to `EnqueueEvent` is a follow-up plan because it touches forum reply, mention, solved, and like flows separately.
