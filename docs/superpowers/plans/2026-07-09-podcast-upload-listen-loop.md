# Podcast Upload Listen Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete podcast loop: discovery, subscription updates, global-player playback, timestamp comments, synced progress, favorites, listen-later, and creator center.

**Architecture:** Keep the current `PodcastEpisode = Post + PodcastEpisode` model. Add small podcast-specific tables for progress and listen-later, reuse the existing comments table with `target_type = podcast_episode`, and adapt the global audio player with source metadata so podcast playback does not pollute music statistics. Frontend work is split into listener pages, player integration, and creator center pages.

**Tech Stack:** Go, Gin, GORM, PostgreSQL, Vue 3, TypeScript, Pinia, Vite, Bun.

---

## File Map

Backend:

- Modify `Atoman-Backend/internal/model/podcast.go`: add progress and listen-later models.
- Create `Atoman-Backend/internal/migrations/20260709_podcast_listen_loop.go`: create new tables and indexes.
- Modify `Atoman-Backend/cmd/migrate/main.go`: include new models in automigration.
- Modify `Atoman-Backend/internal/handlers/podcast_handler.go`: add access checks, progress, listen-later, comments, subscriptions, creator endpoints.
- Modify `Atoman-Backend/internal/handlers/podcast_handler_test.go`: add focused handler tests.
- Modify `Atoman-Backend/internal/handlers/swagger_types.go`: add response/input DTOs.
- Regenerate or update `Atoman-Backend/docs/docs.go` and `Atoman-Backend/docs/swagger.yaml` after handler annotations are added.

Frontend:

- Modify `Atoman-Frontend/src/types.ts`: add player source fields, podcast progress/listen-later/comment DTOs.
- Modify `Atoman-Frontend/src/composables/useApi.ts`: add podcast endpoint helpers.
- Modify `Atoman-Frontend/src/stores/player.ts`: add podcast source handling, queue helpers, progress sync, and music-stat guard.
- Modify `Atoman-Frontend/src/components/music/AudioPlayer.vue`: switch controls by source type and show podcast actions.
- Create `Atoman-Frontend/src/composables/usePodcastTimeline.ts`: parse shownotes timestamps.
- Create `Atoman-Frontend/src/components/podcast/PodcastShownotes.vue`: render clickable shownotes and timestamps.
- Create `Atoman-Frontend/src/components/podcast/PodcastCommentSection.vue`: timestamp comments.
- Modify `Atoman-Frontend/src/views/podcast/PodcastLayout.vue`: add sidebar entries.
- Modify `Atoman-Frontend/src/router/routes/modules.ts`: add subscriptions, favorites, creator routes.
- Modify `Atoman-Frontend/src/views/podcast/PodcastHomeView.vue`: discovery with shows and episodes.
- Modify `Atoman-Frontend/src/views/podcast/PodcastShowView.vue`: show subscription and queue playback.
- Modify `Atoman-Frontend/src/views/podcast/PodcastEpisodeView.vue`: global-player playback, shownotes, comments, favorites, listen-later.
- Create `Atoman-Frontend/src/views/podcast/PodcastSubscriptionsView.vue`: subscribed show update feed.
- Create `Atoman-Frontend/src/views/podcast/PodcastFavoritesView.vue`: episodes, shows, collections, listen-later.
- Create `Atoman-Frontend/src/views/podcast/PodcastCreatorView.vue`: creator shell with tabs.
- Create `Atoman-Frontend/src/views/podcast/creator/PodcastCreatorDashboard.vue`.
- Create `Atoman-Frontend/src/views/podcast/creator/PodcastCreatorManage.vue`.
- Create `Atoman-Frontend/src/views/podcast/creator/PodcastCreatorAnalytics.vue`.
- Create `Atoman-Frontend/src/views/podcast/creator/PodcastCreatorInteractions.vue`.
- Create `Atoman-Frontend/src/views/podcast/creator/PodcastCreatorSettings.vue`.
- Modify `Atoman-Frontend/src/views/podcast/PodcastEditorView.vue`: add visibility, settings defaults, and two-step publishing refinements.

---

## Task 1: Backend Models And Migration

**Files:**
- Modify: `Atoman-Backend/internal/model/podcast.go`
- Create: `Atoman-Backend/internal/migrations/20260709_podcast_listen_loop.go`
- Modify: `Atoman-Backend/cmd/migrate/main.go`

- [ ] **Step 1: Add models**

Add these structs to `Atoman-Backend/internal/model/podcast.go`:

```go
type PodcastEpisodeProgress struct {
	Base
	UserID       uuid.UUID       `json:"user_id" gorm:"type:uuid;not null;index;uniqueIndex:idx_podcast_progress_user_episode,priority:1,where:deleted_at IS NULL"`
	User         *User           `json:"user,omitempty" gorm:"foreignKey:UserID;references:UUID"`
	EpisodeID    uuid.UUID       `json:"episode_id" gorm:"type:uuid;not null;index;uniqueIndex:idx_podcast_progress_user_episode,priority:2,where:deleted_at IS NULL"`
	Episode      *PodcastEpisode `json:"episode,omitempty" gorm:"foreignKey:EpisodeID"`
	PositionSec  int             `json:"position_sec" gorm:"not null;default:0"`
	DurationSec  int             `json:"duration_sec" gorm:"not null;default:0"`
	Completed    bool            `json:"completed" gorm:"not null;default:false;index"`
	LastPlayedAt *time.Time      `json:"last_played_at,omitempty" gorm:"index"`
}

func (PodcastEpisodeProgress) TableName() string { return "podcast_episode_progress" }

type PodcastListenLater struct {
	Base
	UserID    uuid.UUID       `json:"user_id" gorm:"type:uuid;not null;index;uniqueIndex:idx_podcast_listen_later_user_episode,priority:1,where:deleted_at IS NULL"`
	User      *User           `json:"user,omitempty" gorm:"foreignKey:UserID;references:UUID"`
	EpisodeID uuid.UUID       `json:"episode_id" gorm:"type:uuid;not null;index;uniqueIndex:idx_podcast_listen_later_user_episode,priority:2,where:deleted_at IS NULL"`
	Episode   *PodcastEpisode `json:"episode,omitempty" gorm:"foreignKey:EpisodeID"`
	Position  int             `json:"position" gorm:"not null;default:0;index"`
}

func (PodcastListenLater) TableName() string { return "podcast_listen_later" }
```

Also add `time` to the import list:

```go
import (
	"time"

	"github.com/google/uuid"
)
```

- [ ] **Step 2: Add migration**

Create `Atoman-Backend/internal/migrations/20260709_podcast_listen_loop.go`:

```go
package migrations

import (
	"gorm.io/gorm"

	"atoman/internal/model"
)

func MigratePodcastListenLoop(db *gorm.DB) error {
	if err := db.AutoMigrate(
		&model.PodcastEpisodeProgress{},
		&model.PodcastListenLater{},
	); err != nil {
		return err
	}
	return nil
}
```

- [ ] **Step 3: Wire migration entry**

In `Atoman-Backend/cmd/migrate/main.go`, add the two new models to the existing `AutoMigrate` list near `PodcastEpisodeBookmark`:

```go
&model.PodcastEpisodeProgress{},
&model.PodcastListenLater{},
```

- [ ] **Step 4: Run backend build**

Run:

```bash
cd Atoman-Backend
go build ./...
```

Expected: command exits with code 0.

---

## Task 2: Backend Access Helpers And Visibility

**Files:**
- Modify: `Atoman-Backend/internal/handlers/podcast_handler.go`
- Test: `Atoman-Backend/internal/handlers/podcast_handler_test.go`

- [ ] **Step 1: Add access helper**

Add helper functions near the existing podcast helpers:

```go
func podcastUserID(c *gin.Context) (uuid.UUID, bool) {
	idVal, exists := c.Get("user_id")
	if !exists {
		return uuid.Nil, false
	}
	id, ok := idVal.(uuid.UUID)
	return id, ok
}

func canAccessPodcastEpisode(db *gorm.DB, ep model.PodcastEpisode, userID uuid.UUID, authenticated bool) bool {
	if ep.Post == nil {
		return false
	}
	if ep.Post.Status != "published" {
		return authenticated && ep.Post.UserID == userID
	}
	switch ep.Post.Visibility {
	case "", "public":
		return true
	case "private":
		return authenticated && ep.Post.UserID == userID
	case "followers":
		if !authenticated {
			return false
		}
		if ep.Post.UserID == userID {
			return true
		}
		var count int64
		db.Model(&model.ChannelBookmark{}).
			Where("user_id = ? AND channel_id = ?", userID, ep.ChannelID).
			Count(&count)
		return count > 0
	default:
		return false
	}
}

func loadPodcastEpisodeForAccess(db *gorm.DB, id string) (model.PodcastEpisode, error) {
	var ep model.PodcastEpisode
	err := db.Preload("Post.Collections").Preload("Channel").
		First(&ep, "podcast_episodes.id = ?", id).Error
	return ep, err
}
```

- [ ] **Step 2: Apply visibility to list queries**

Update public list queries to include published public posts unless an authenticated owner endpoint explicitly needs drafts:

```go
Joins("JOIN posts ON posts.id = podcast_episodes.post_id AND posts.status = 'published' AND posts.deleted_at IS NULL").
Where("posts.visibility = ?", "public")
```

Apply to `GetPodcastEpisodes`, `GetRecommendedPodcastEpisodes`, `GetShowEpisodes`, and `GetPodcastRSS`.

- [ ] **Step 3: Apply visibility to detail**

Update `GetPodcastEpisode` to load without the published-only join, then call `canAccessPodcastEpisode`. Return `404` when the episode does not exist and `403` when it exists but is not accessible:

```go
ep, err := loadPodcastEpisodeForAccess(db, c.Param("id"))
if err != nil {
	c.JSON(http.StatusNotFound, gin.H{"error": "episode not found"})
	return
}
userID, authenticated := podcastUserID(c)
if !canAccessPodcastEpisode(db, ep, userID, authenticated) {
	c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
	return
}
c.JSON(http.StatusOK, ep)
```

- [ ] **Step 4: Add visibility to create/update payloads**

In `CreatePodcastEpisode`, add `Visibility string json:"visibility"` to input and set `Post.Visibility`:

```go
visibility := strings.TrimSpace(input.Visibility)
if visibility == "" {
	visibility = "public"
}
post := model.Post{
	UserID:     userID,
	ChannelID: &chID,
	Title:      strings.TrimSpace(input.Title),
	Content:    input.Shownotes,
	Status:     status,
	Visibility: visibility,
}
```

In `UpdatePodcastEpisode`, add `Visibility *string json:"visibility"` and update `postUpdates["visibility"]`.

- [ ] **Step 5: Add focused tests**

Add tests in `podcast_handler_test.go`:

```go
func TestGetPodcastEpisodeRejectsPrivateForOtherUser(t *testing.T) {
	// Seed owner, viewer, channel, post visibility private, episode.
	// Request as viewer.
	// Expect 403.
}

func TestGetPodcastEpisodesOnlyReturnsPublicPublished(t *testing.T) {
	// Seed public published, private published, public draft.
	// Request list.
	// Expect only public published episode id in response.
}
```

- [ ] **Step 6: Run backend tests**

Run:

```bash
cd Atoman-Backend
go test ./internal/handlers -run Podcast -count=1
go build ./...
```

Expected: both commands pass.

---

## Task 3: Backend Progress API

**Files:**
- Modify: `Atoman-Backend/internal/handlers/podcast_handler.go`
- Test: `Atoman-Backend/internal/handlers/podcast_handler_test.go`

- [ ] **Step 1: Register routes**

Inside `SetupPodcastRoutes` authenticated group:

```go
p.GET("/progress", middleware.AuthMiddleware(), GetPodcastProgressList(db))
p.GET("/episodes/:id/progress", middleware.AuthMiddleware(), GetPodcastEpisodeProgress(db))
p.PUT("/episodes/:id/progress", middleware.AuthMiddleware(), UpsertPodcastEpisodeProgress(db))
p.DELETE("/episodes/:id/progress", middleware.AuthMiddleware(), DeletePodcastEpisodeProgress(db))
```

- [ ] **Step 2: Implement completion helper**

```go
func podcastProgressCompleted(positionSec, durationSec int) bool {
	if durationSec <= 0 || positionSec <= 0 {
		return false
	}
	if float64(positionSec)/float64(durationSec) >= 0.95 {
		return true
	}
	return durationSec-positionSec <= 60
}
```

- [ ] **Step 3: Implement upsert**

```go
func UpsertPodcastEpisodeProgress(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := podcastUserID(c)
		episodeID, err := uuid.Parse(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid episode id"})
			return
		}
		var input struct {
			PositionSec int `json:"position_sec"`
			DurationSec int `json:"duration_sec"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if input.PositionSec < 0 || input.DurationSec < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid progress"})
			return
		}
		ep, err := loadPodcastEpisodeForAccess(db, episodeID.String())
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "episode not found"})
			return
		}
		if !canAccessPodcastEpisode(db, ep, userID, true) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		now := time.Now().UTC()
		progress := model.PodcastEpisodeProgress{UserID: userID, EpisodeID: episodeID}
		updates := model.PodcastEpisodeProgress{
			PositionSec:  input.PositionSec,
			DurationSec:  input.DurationSec,
			Completed:    podcastProgressCompleted(input.PositionSec, input.DurationSec),
			LastPlayedAt: &now,
		}
		if err := db.Where("user_id = ? AND episode_id = ?", userID, episodeID).
			Assign(updates).
			FirstOrCreate(&progress).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save progress"})
			return
		}
		db.Preload("Episode").Preload("Episode.Post").Preload("Episode.Channel").First(&progress, "id = ?", progress.ID)
		c.JSON(http.StatusOK, gin.H{"data": progress, "message": "ok"})
	}
}
```

- [ ] **Step 4: Implement list/get/delete**

Implement:

```go
func GetPodcastProgressList(db *gorm.DB) gin.HandlerFunc
func GetPodcastEpisodeProgress(db *gorm.DB) gin.HandlerFunc
func DeletePodcastEpisodeProgress(db *gorm.DB) gin.HandlerFunc
```

Rules:

- List orders by `last_played_at DESC`.
- Get returns `404` if no progress row exists.
- Delete scopes by `user_id` and `episode_id`.

- [ ] **Step 5: Add tests**

Add tests:

```go
func TestUpsertPodcastEpisodeProgressMarksCompleted(t *testing.T)
func TestPodcastEpisodeProgressIsScopedToUser(t *testing.T)
func TestPodcastEpisodeProgressRequiresAccessibleEpisode(t *testing.T)
```

- [ ] **Step 6: Run backend tests**

Run:

```bash
cd Atoman-Backend
go test ./internal/handlers -run Podcast -count=1
go build ./...
```

Expected: both commands pass.

---

## Task 4: Backend Listen Later And Bookmarks API

**Files:**
- Modify: `Atoman-Backend/internal/handlers/podcast_handler.go`
- Test: `Atoman-Backend/internal/handlers/podcast_handler_test.go`

- [ ] **Step 1: Register listen-later routes**

```go
p.GET("/listen-later", middleware.AuthMiddleware(), GetPodcastListenLater(db))
p.POST("/listen-later", middleware.AuthMiddleware(), AddPodcastListenLater(db))
p.DELETE("/listen-later/:id", middleware.AuthMiddleware(), DeletePodcastListenLater(db))
```

- [ ] **Step 2: Implement list**

Rules:

- Scope by `user_id`.
- Preload `Episode.Post.Collections` and `Episode.Channel`.
- Order by `position ASC, created_at DESC`.
- Return `{ "data": rows, "message": "ok" }`.

- [ ] **Step 3: Implement add**

Input:

```go
type podcastListenLaterInput struct {
	EpisodeID uuid.UUID `json:"episode_id" binding:"required"`
}
```

Rules:

- Episode must exist and be accessible.
- `FirstOrCreate` by `user_id + episode_id`.
- Set `position` to current max position + 1 for the user.

- [ ] **Step 4: Implement delete**

Rules:

- Delete by listen-later row ID and `user_id`.
- Return `200` with `{ "message": "ok" }`.

- [ ] **Step 5: Add tests**

Add tests:

```go
func TestPodcastListenLaterAddListDelete(t *testing.T)
func TestPodcastListenLaterDoesNotDuplicateEpisode(t *testing.T)
func TestPodcastListenLaterRejectsInaccessibleEpisode(t *testing.T)
```

- [ ] **Step 6: Run backend tests**

Run:

```bash
cd Atoman-Backend
go test ./internal/handlers -run Podcast -count=1
go build ./...
```

Expected: both commands pass.

---

## Task 5: Backend Timestamp Comments

**Files:**
- Modify: `Atoman-Backend/internal/handlers/podcast_handler.go`
- Test: `Atoman-Backend/internal/handlers/podcast_handler_test.go`

- [ ] **Step 1: Register routes**

```go
p.GET("/episodes/:id/comments", GetPodcastEpisodeComments(db))
p.POST("/episodes/:id/comments", middleware.AuthMiddleware(), CreatePodcastEpisodeComment(db))
p.DELETE("/comments/:commentID", middleware.AuthMiddleware(), DeletePodcastEpisodeComment(db))
```

- [ ] **Step 2: Implement list**

Rules:

- Load episode and apply access check.
- Query comments where `target_type = podcast_episode`, `target_id = episodeID`, `status = visible`.
- Preload user.
- Order by `created_at ASC`.

- [ ] **Step 3: Implement create**

Input:

```go
var input struct {
	Content      string `json:"content" binding:"required"`
	TimestampSec *int  `json:"timestamp_sec"`
}
```

Rules:

- Reject negative timestamp.
- Require accessible episode.
- Create `model.Comment{TargetType: "podcast_episode", TargetID: episodeID, UserID: model.NewNullableUserUUID(userID), Content: strings.TrimSpace(input.Content), Status: "visible", TimestampSec: input.TimestampSec}`.

- [ ] **Step 4: Implement delete**

Rules:

- User can delete own comments.
- Episode author can delete comments under their episode.
- Soft delete the comment row.

- [ ] **Step 5: Add tests**

Add tests:

```go
func TestCreatePodcastEpisodeTimestampComment(t *testing.T)
func TestListPodcastEpisodeCommentsHidesInaccessibleEpisode(t *testing.T)
func TestPodcastEpisodeAuthorCanDeleteComment(t *testing.T)
```

- [ ] **Step 6: Run backend tests**

Run:

```bash
cd Atoman-Backend
go test ./internal/handlers -run Podcast -count=1
go build ./...
```

Expected: both commands pass.

---

## Task 6: Backend Subscription Feed And Creator APIs

**Files:**
- Modify: `Atoman-Backend/internal/handlers/podcast_handler.go`
- Test: `Atoman-Backend/internal/handlers/podcast_handler_test.go`

- [ ] **Step 1: Add subscription update route**

```go
p.GET("/subscriptions/episodes", middleware.AuthMiddleware(), GetPodcastSubscriptionEpisodes(db))
```

Rules:

- Find channel bookmarks or subscription records that represent followed channels.
- Return published podcast episodes for those channels.
- Include public and followers-only episodes.
- Order by `podcast_episodes.created_at DESC`.

- [ ] **Step 2: Add creator routes**

```go
p.GET("/creator/dashboard", middleware.AuthMiddleware(), GetPodcastCreatorDashboard(db))
p.GET("/creator/episodes", middleware.AuthMiddleware(), GetPodcastCreatorEpisodes(db))
p.GET("/creator/analytics", middleware.AuthMiddleware(), GetPodcastCreatorAnalytics(db))
p.GET("/creator/comments", middleware.AuthMiddleware(), GetPodcastCreatorComments(db))
p.GET("/creator/settings", middleware.AuthMiddleware(), GetPodcastCreatorSettings(db))
p.PUT("/creator/settings", middleware.AuthMiddleware(), UpdatePodcastCreatorSettings(db))
```

- [ ] **Step 3: Implement creator episodes**

Rules:

- Scope by `posts.user_id = current user`.
- Include drafts and private episodes.
- Support query `status`, `visibility`, `q`.
- Order by `podcast_episodes.updated_at DESC`.

- [ ] **Step 4: Implement minimal dashboard and analytics**

Return real counts from current tables:

- total episodes
- published episodes
- draft episodes
- total comments
- total bookmarks
- total listen-later adds
- recent episodes
- issues: draft, missing cover, missing collection, missing audio

Analytics first version can return daily buckets with zero-filled values when no event table exists.

- [ ] **Step 5: Implement creator comments**

Rules:

- Scope to episodes whose `Post.UserID` is current user.
- Support `timestamped=true`.
- Order newest first.

- [ ] **Step 6: Implement creator settings**

Keep first version in user settings if an existing settings table exists; otherwise return defaults and accept PUT as a no-op persisted later only if current project already has a generic settings table. Do not invent a broad settings framework in this task.

- [ ] **Step 7: Run backend verification**

Run:

```bash
cd Atoman-Backend
go test ./internal/handlers -run Podcast -count=1
go build ./...
```

Expected: both commands pass.

---

## Task 7: Frontend API Types And Shownotes Parser

**Files:**
- Modify: `Atoman-Frontend/src/types.ts`
- Modify: `Atoman-Frontend/src/composables/useApi.ts`
- Create: `Atoman-Frontend/src/composables/usePodcastTimeline.ts`
- Test: `Atoman-Frontend/tests/unit/usePodcastTimeline.test.ts`

- [ ] **Step 1: Extend player item fields**

In `Song`, add:

```ts
source_type?: 'music' | 'podcast_episode' | 'feed_podcast'
source_id?: string
```

- [ ] **Step 2: Add podcast DTOs**

Add:

```ts
export interface PodcastEpisodeProgress {
  id: string
  user_id: string
  episode_id: string
  episode?: PodcastEpisode
  position_sec: number
  duration_sec: number
  completed: boolean
  last_played_at?: string
}

export interface PodcastListenLater {
  id: string
  user_id: string
  episode_id: string
  episode?: PodcastEpisode
  position: number
  created_at: string
}
```

- [ ] **Step 3: Add API helpers**

In `useApi.ts` podcast block, add:

```ts
bookmarks: `${apiUrl}/podcast/bookmarks`,
bookmark: (id: string) => `${apiUrl}/podcast/bookmarks/${id}`,
showBookmarks: `${apiUrl}/podcast/show-bookmarks`,
showBookmark: (id: string) => `${apiUrl}/podcast/show-bookmarks/${id}`,
listenLater: `${apiUrl}/podcast/listen-later`,
listenLaterItem: (id: string) => `${apiUrl}/podcast/listen-later/${id}`,
progress: `${apiUrl}/podcast/progress`,
episodeProgress: (id: string) => `${apiUrl}/podcast/episodes/${id}/progress`,
comments: (id: string) => `${apiUrl}/podcast/episodes/${id}/comments`,
comment: (id: string) => `${apiUrl}/podcast/comments/${id}`,
subscriptionEpisodes: `${apiUrl}/podcast/subscriptions/episodes`,
creatorDashboard: `${apiUrl}/podcast/creator/dashboard`,
creatorEpisodes: `${apiUrl}/podcast/creator/episodes`,
creatorAnalytics: `${apiUrl}/podcast/creator/analytics`,
creatorComments: `${apiUrl}/podcast/creator/comments`,
creatorSettings: `${apiUrl}/podcast/creator/settings`,
```

- [ ] **Step 4: Create parser**

Create `usePodcastTimeline.ts`:

```ts
export interface PodcastTimelineLine {
  raw: string
  timeLabel?: string
  seconds?: number
}

export function parsePodcastTimestamp(label: string): number | null {
  const parts = label.split(':').map(part => Number(part))
  if (parts.length < 2 || parts.length > 3 || parts.some(part => !Number.isInteger(part) || part < 0)) return null
  if (parts.length === 2) {
    const [m, s] = parts
    if (s >= 60) return null
    return m * 60 + s
  }
  const [h, m, s] = parts
  if (m >= 60 || s >= 60) return null
  return h * 3600 + m * 60 + s
}

export function parsePodcastTimeline(text: string): PodcastTimelineLine[] {
  return text.split(/\r?\n/).map(raw => {
    const match = raw.match(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/)
    if (!match) return { raw }
    const seconds = parsePodcastTimestamp(match[1])
    if (seconds === null) return { raw }
    return { raw, timeLabel: match[1], seconds }
  })
}
```

- [ ] **Step 5: Add unit tests**

Create `tests/unit/usePodcastTimeline.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parsePodcastTimeline, parsePodcastTimestamp } from '@/composables/usePodcastTimeline'

describe('usePodcastTimeline', () => {
  it('parses mm:ss and hh:mm:ss timestamps', () => {
    expect(parsePodcastTimestamp('12:05')).toBe(725)
    expect(parsePodcastTimestamp('01:02:30')).toBe(3750)
  })

  it('rejects invalid timestamps', () => {
    expect(parsePodcastTimestamp('12:99')).toBeNull()
    expect(parsePodcastTimestamp('01:99:00')).toBeNull()
  })

  it('extracts timestamp lines from shownotes', () => {
    const lines = parsePodcastTimeline('00:32 开场\n普通文本\n01:02:30 深入讨论')
    expect(lines[0]).toMatchObject({ timeLabel: '00:32', seconds: 32 })
    expect(lines[1]).toMatchObject({ raw: '普通文本' })
    expect(lines[2]).toMatchObject({ timeLabel: '01:02:30', seconds: 3750 })
  })
})
```

- [ ] **Step 6: Run frontend tests**

Run:

```bash
cd Atoman-Frontend
bun run test:unit -- usePodcastTimeline
bun run type-check
```

Expected: both commands pass.

---

## Task 8: Frontend Player Store Podcast Adapter

**Files:**
- Modify: `Atoman-Frontend/src/stores/player.ts`
- Test: `Atoman-Frontend/tests/unit/playerPodcastAdapter.test.ts`

- [ ] **Step 1: Add podcast adapter**

Add:

```ts
const episodeCover = (episode: PodcastEpisode) =>
  episode.episode_cover_url
  || episode.post?.collections?.[0]?.cover_url
  || episode.collections?.[0]?.cover_url
  || episode.channel?.cover_url
  || ''

const createPodcastEpisodeSong = (episode: PodcastEpisode): Song => ({
  id: `podcast:${episode.id}`,
  source_type: 'podcast_episode',
  source_id: episode.id,
  title: episode.post?.title || '未命名单集',
  artist: episode.channel?.name || '播客',
  album: episode.post?.collections?.[0]?.name || episode.collections?.[0]?.name || episode.channel?.name || '播客',
  album_id: episode.post?.collections?.[0]?.id || episode.collections?.[0]?.id || episode.channel_id,
  year: new Date(episode.created_at || '').getFullYear() || 0,
  release_date: episode.created_at || '',
  lyrics: episode.post?.content || '',
  audio_url: episode.audio_url,
  cover_url: episodeCover(episode),
  track_number: episode.episode_number,
  status: 'approved',
})
```

- [ ] **Step 2: Add queue helper**

```ts
const setQueueFromPodcastEpisodes = (episodes: PodcastEpisode[]) => {
  queue.value = episodes.map(createPodcastEpisodeSong)
}
```

- [ ] **Step 3: Guard music play stat**

Update the `watch(currentSong, ...)` block:

```ts
if (song?.source_type && song.source_type !== 'music') return
```

For legacy music songs with no source type, keep existing music statistic behavior.

- [ ] **Step 4: Add progress sync shell**

Add a throttled podcast progress sync function that only runs when `currentSong.source_type === 'podcast_episode'` and `currentSong.source_id` exists. Use `PUT api.podcast.episodeProgress(currentSong.source_id)`.

The first implementation syncs:

```ts
{
  position_sec: Math.floor(currentTime.value),
  duration_sec: Math.floor(duration.value),
}
```

Use a timestamp guard so it sends at most once every 15 seconds during playback, plus once when pausing or switching tracks.

- [ ] **Step 5: Export helpers**

Return:

```ts
createPodcastEpisodeSong,
setQueueFromPodcastEpisodes,
```

- [ ] **Step 6: Add unit tests**

Test:

```ts
it('creates podcast player item with podcast source metadata')
it('does not record music play for podcast source')
```

- [ ] **Step 7: Run frontend verification**

Run:

```bash
cd Atoman-Frontend
bun run test:unit -- playerPodcastAdapter
bun run type-check
```

Expected: both commands pass.

---

## Task 9: Frontend Podcast Playback UI Components

**Files:**
- Create: `Atoman-Frontend/src/components/podcast/PodcastShownotes.vue`
- Create: `Atoman-Frontend/src/components/podcast/PodcastCommentSection.vue`
- Modify: `Atoman-Frontend/src/components/music/AudioPlayer.vue`

- [ ] **Step 1: Create shownotes component**

Props:

```ts
const props = defineProps<{
  text: string
}>()
```

Behavior:

- Use `parsePodcastTimeline`.
- Render each line.
- If line has `seconds`, render a button with the timestamp.
- Button calls `player.seek(seconds)`.

- [ ] **Step 2: Create comment section**

Props:

```ts
const props = defineProps<{
  episodeId: string
}>()
```

Behavior:

- Fetch `api.podcast.comments(episodeId)`.
- Post normal comments with `{ content }`.
- Post timestamp comments with `{ content, timestamp_sec: Math.floor(player.currentTime) }`.
- Disable timestamp button unless `player.currentSong?.source_type === 'podcast_episode' && player.currentSong.source_id === episodeId`.
- Clicking a timestamp calls `player.seek(comment.timestamp_sec)`.

- [ ] **Step 3: Adapt AudioPlayer**

Computed:

```ts
const isPodcast = computed(() => player.currentSong?.source_type === 'podcast_episode' || player.currentSong?.source_type === 'feed_podcast')
```

UI:

- Label feature button as `词` for music and `说明` for podcast.
- Hide music favorite and playlist dropdown when `isPodcast`.
- Show podcast favorite/listen-later buttons when `source_type === 'podcast_episode'`.

- [ ] **Step 4: Type-check**

Run:

```bash
cd Atoman-Frontend
bun run type-check
```

Expected: command passes.

---

## Task 10: Listener Routes And Pages

**Files:**
- Modify: `Atoman-Frontend/src/router/routes/modules.ts`
- Modify: `Atoman-Frontend/src/views/podcast/PodcastLayout.vue`
- Modify: `Atoman-Frontend/src/views/podcast/PodcastHomeView.vue`
- Modify: `Atoman-Frontend/src/views/podcast/PodcastShowView.vue`
- Modify: `Atoman-Frontend/src/views/podcast/PodcastEpisodeView.vue`
- Create: `Atoman-Frontend/src/views/podcast/PodcastSubscriptionsView.vue`
- Create: `Atoman-Frontend/src/views/podcast/PodcastFavoritesView.vue`

- [ ] **Step 1: Add routes**

Under podcast children:

```ts
{ path: 'subscriptions', component: () => import('@/views/podcast/PodcastSubscriptionsView.vue'), meta: { requiresAuth: true } },
{ path: 'favorites', component: () => import('@/views/podcast/PodcastFavoritesView.vue'), meta: { requiresAuth: true } },
{ path: 'creator', component: () => import('@/views/podcast/PodcastCreatorView.vue'), meta: { requiresAuth: true, featureGate: { module: 'podcast', feature: 'podcast.publish' } } },
```

- [ ] **Step 2: Update sidebar**

Sidebar labels:

- 探索 -> `/podcasts`
- 订阅 -> `/podcasts/subscriptions`
- 收藏 -> `/podcasts/favorites`
- 创作 -> `/podcasts/creator`

- [ ] **Step 3: Update episode detail**

Remove page-local `<audio>`. Add:

- Play button: queue current show or current episode and call `player.playQueuedSong`.
- `PodcastShownotes`.
- `PodcastCommentSection`.
- Subscribe show button.
- Favorite episode button.
- Listen later button.
- Share button hidden for private episodes.

- [ ] **Step 4: Update show page**

Add:

- Subscribe button.
- Play episode button on each row.
- On play, call `player.setQueueFromPodcastEpisodes(episodes)` then `player.playQueuedSong(player.createPodcastEpisodeSong(ep))`.

- [ ] **Step 5: Build subscriptions page**

Fetch `api.podcast.subscriptionEpisodes`.

Render feed rows with:

- show name
- title
- duration
- progress state
- play
- listen later

- [ ] **Step 6: Build favorites page**

Tabs:

- 单集: `api.podcast.bookmarks`
- 节目: `api.podcast.showBookmarks`
- 合集: first version can list favorited podcast collections when backend returns them; otherwise show empty state
- 稍后听: `api.podcast.listenLater`

Listen-later play sets queue from the full listen-later list.

- [ ] **Step 7: Run frontend verification**

Run:

```bash
cd Atoman-Frontend
bun run type-check
```

Expected: command passes.

---

## Task 11: Creator Center Pages

**Files:**
- Create: `Atoman-Frontend/src/views/podcast/PodcastCreatorView.vue`
- Create: `Atoman-Frontend/src/views/podcast/creator/PodcastCreatorDashboard.vue`
- Create: `Atoman-Frontend/src/views/podcast/creator/PodcastCreatorManage.vue`
- Create: `Atoman-Frontend/src/views/podcast/creator/PodcastCreatorAnalytics.vue`
- Create: `Atoman-Frontend/src/views/podcast/creator/PodcastCreatorInteractions.vue`
- Create: `Atoman-Frontend/src/views/podcast/creator/PodcastCreatorSettings.vue`
- Modify: `Atoman-Frontend/src/views/podcast/PodcastEditorView.vue`

- [ ] **Step 1: Creator shell**

Create tab navigation:

- Dashboard
- 单集管理
- 数据中心
- 互动管理
- 创作设置

- [ ] **Step 2: Dashboard**

Fetch `api.podcast.creatorDashboard`.

Render:

- publish button
- recent episodes
- stats cards
- issue list

- [ ] **Step 3: Manage**

Fetch `api.podcast.creatorEpisodes`.

Add filters:

- 全部
- 公开
- 仅订阅
- 私有
- 草稿

Actions:

- 编辑
- 删除
- 分享
- 重新上传音频 via editor
- 发布 / 下架

- [ ] **Step 4: Analytics**

Fetch `api.podcast.creatorAnalytics`.

Render:

- summary cards
- episode ranking
- simple trend list or existing chart component if one exists locally

- [ ] **Step 5: Interactions**

Fetch `api.podcast.creatorComments`.

Tabs:

- 全部评论
- 时间点评论

Click timestamp opens `/podcasts/episode/:id` and seeks after playback starts.

- [ ] **Step 6: Settings**

Fetch and update `api.podcast.creatorSettings`.

Fields:

- default channel
- default collection
- default status
- default visibility
- continuous playback
- parse shownotes timeline

- [ ] **Step 7: Editor upgrades**

Add:

- visibility selector
- default settings load
- save draft redirects to `/podcasts/creator?tab=manage`
- publish redirects to `/podcasts/episode/:id`

- [ ] **Step 8: Run frontend verification**

Run:

```bash
cd Atoman-Frontend
bun run type-check
```

Expected: command passes.

---

## Task 12: API Documentation And Final Verification

**Files:**
- Modify: `Atoman-Backend/docs/docs.go`
- Modify: `Atoman-Backend/docs/swagger.yaml`

- [ ] **Step 1: Add Swagger annotations**

Add annotations for new endpoints in `podcast_handler.go`:

- progress list/get/upsert/delete
- listen-later list/add/delete
- comments list/create/delete
- subscriptions feed
- creator dashboard/episodes/analytics/comments/settings

- [ ] **Step 2: Regenerate Swagger if tooling exists**

Run the repository's existing swagger generation command if configured. If no command exists, update generated docs consistently with existing format.

- [ ] **Step 3: Backend verification**

Run:

```bash
cd Atoman-Backend
go test ./internal/handlers -run Podcast -count=1
go build ./...
```

Expected: both commands pass.

- [ ] **Step 4: Frontend verification**

Run:

```bash
cd Atoman-Frontend
bun run type-check
bun run test:unit -- usePodcastTimeline
```

Expected: both commands pass.

- [ ] **Step 5: Manual smoke test**

Start dev dependencies and apps:

```bash
docker compose -f docker-compose.dev.yml up -d
cd Atoman-Backend
go run ./cmd/start_server
```

In another terminal:

```bash
~/.claude/skills/brainstorming/scripts/start-server.sh \
  --project-dir /Users/fafa/projects/Atoman/Atoman-Frontend \
  --host 0.0.0.0 \
  --url-host localhost \
  --foreground
```

Verify:

- `/podcasts` loads.
- `/podcasts/subscriptions` requires login and loads after login.
- Publishing a podcast creates a detail page.
- Detail page uses global player.
- Timestamp shownotes seek playback.
- Timestamp comment can be posted and clicked.
- Progress restores after page reload.
- Listen-later tab plays as queue.
- Creator center pages load.

---

## Self-Review

- Spec coverage: plan covers backend models, access control, progress, listen-later, comments, subscriptions, player adaptation, listener pages, creator center, and verification.
- Placeholder scan: no TBD/TODO remains. The only intentionally constrained part is creator settings persistence; the plan explicitly says not to invent a new broad settings framework if one does not exist.
- Type consistency: player source fields use `source_type` and `source_id` consistently across `Song`, `player.ts`, and UI logic.
- Scope check: the feature spans multiple subsystems. The plan keeps it as one delivery target because the user explicitly selected a full one-shot loop, but tasks are separated so each phase is independently testable.
