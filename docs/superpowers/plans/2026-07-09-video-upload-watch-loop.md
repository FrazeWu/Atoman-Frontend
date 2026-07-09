# Video Upload Watch Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete video flow from upload to creator management, watch page, subscriptions, bookmarks, share tracking, analytics, and interaction management.

**Architecture:** Extend the existing Go video APIs and Vue video module instead of creating parallel systems. Backend changes establish access control, status metadata, bookmarks, subscriptions, share stats, and creator aggregation; frontend changes then consume those APIs through focused stores/composables and existing page components.

**Tech Stack:** Go, Gin, GORM, PostgreSQL, S3-compatible storage, Swagger, Vue 3, TypeScript, Pinia, Vue Router, Vitest, Playwright.

---

## Scope Notes

This is one product loop, but it is large. Implement in the order below. Each task should be committed separately and should leave the app buildable.

The design spec is `docs/superpowers/specs/2026-07-09-video-upload-watch-loop-design.md`.

## File Structure

Backend files:

- `Atoman-Backend/internal/model/video.go`: extend video metrics and add video-specific bookmark/watch-later/collection bookmark models.
- `Atoman-Backend/internal/model/user.go`: add video creator settings fields.
- `Atoman-Backend/internal/migrations/20260709_video_creator_loop.go`: add indexes and backfill/normalize visibility values.
- `Atoman-Backend/internal/handlers/video_handler.go`: extend video CRUD, access control, bookmarks, subscriptions, share tracking, analytics, interaction lists, and retry processing routes.
- `Atoman-Backend/internal/service/video_processing_service.go`: expose retry-safe job creation for local videos.
- `Atoman-Backend/internal/service/video_preview_ffmpeg.go`: fix local thumbnail/frame extraction.
- `Atoman-Backend/internal/handlers/user_handler.go`: persist video creator settings in existing user settings payload.
- `Atoman-Backend/docs/swagger.yaml`, `Atoman-Backend/docs/swagger.json`, `Atoman-Backend/docs/docs.go`: sync API docs after route changes.
- Backend tests: `Atoman-Backend/internal/handlers/video_handler_test.go`, `Atoman-Backend/internal/handlers/user_handler_test.go`, `Atoman-Backend/cmd/video_worker/main_test.go`.

Frontend files:

- `Atoman-Frontend/src/types.ts`: add video visibility, creator settings, status, bookmark, subscription, analytics, and detail payload types.
- `Atoman-Frontend/src/composables/useApi.ts`: add typed endpoint paths for new video APIs.
- `Atoman-Frontend/src/stores/video.ts`: new Pinia store for video creator settings, bookmarks, subscriptions, watch-later, and share state.
- `Atoman-Frontend/src/views/video/VideoEditorView.vue`: replace current upload editor with two-step local/external flow.
- `Atoman-Frontend/src/views/video/VideoManageView.vue`: become creator center shell with Dashboard, content, analytics, interactions, and settings tabs.
- `Atoman-Frontend/src/views/video/VideoDetailView.vue`: add collection panel, subscription/bookmark/share actions, permissions, and responsive comments.
- `Atoman-Frontend/src/views/video/VideoSubscriptionsView.vue`: implement video update feed with subscription side filters.
- `Atoman-Frontend/src/views/video/VideoStarredView.vue`: new bookmarks page with video/channel/collection/watch-later tabs.
- `Atoman-Frontend/src/views/video/VideoChannelView.vue`: new channel detail page.
- `Atoman-Frontend/src/views/video/VideoCollectionView.vue`: new collection detail page.
- `Atoman-Frontend/src/views/video/VideoHomeView.vue`: remove recommendation section and use 热度/精选/探索 modes.
- `Atoman-Frontend/src/views/video/VideoLayout.vue`: add 收藏 entry; render subscribed channel and bookmarked collection side sections on the 订阅 route.
- `Atoman-Frontend/src/router/routes/modules.ts`: add video routes for bookmarks, channel, and collection detail.
- Frontend tests under `Atoman-Frontend/tests/unit/views/video/`, `Atoman-Frontend/tests/unit/stores/`, and `Atoman-Frontend/tests/unit/router/`.

---

### Task 1: Backend Data Contract And Visibility Rules

**Files:**
- Modify: `Atoman-Backend/internal/model/video.go`
- Modify: `Atoman-Backend/internal/model/user.go`
- Create: `Atoman-Backend/internal/migrations/20260709_video_creator_loop.go`
- Modify: `Atoman-Backend/cmd/migrate/main.go`
- Test: `Atoman-Backend/internal/handlers/video_handler_test.go`
- Test: `Atoman-Backend/internal/handlers/user_handler_test.go`

- [ ] **Step 1: Add failing backend tests for required channel/collection and access rules**

Add tests that create videos through `CreateVideo` and assert:

```go
// names to add in video_handler_test.go
func TestCreateVideoRequiresVideoChannelAndCollection(t *testing.T)
func TestGetVideoAllowsSubscribersOnlyVisibilityForChannelSubscriber(t *testing.T)
func TestGetVideoRejectsSubscribersOnlyVisibilityForGuest(t *testing.T)
func TestGetVideoAllowsPrivateVisibilityForOwnerAndAdmin(t *testing.T)
func TestPrivateVideoHidesShareEligibleState(t *testing.T)
```

Expected assertions:

- Missing `channel_id` returns `400`.
- Missing `collection_ids` returns `400`.
- Non-video channel returns `400`.
- `visibility=subscribers` is readable by channel subscribers and owner.
- `visibility=subscribers` returns `403` for guests/non-subscribers.
- `visibility=private` returns `403` for non-owner, `200` for owner/admin.

- [ ] **Step 2: Run failing tests**

Run:

```bash
cd /Users/fafa/projects/Atoman/Atoman-Backend
go test ./internal/handlers -run 'Test(CreateVideoRequiresVideoChannelAndCollection|GetVideoAllowsSubscribersOnlyVisibilityForChannelSubscriber|GetVideoRejectsSubscribersOnlyVisibilityForGuest|GetVideoAllowsPrivateVisibilityForOwnerAndAdmin|PrivateVideoHidesShareEligibleState)' -count=1
```

Expected: fail because the required validations and access helper do not exist yet.

- [ ] **Step 3: Extend models**

In `internal/model/video.go`:

- Add `ShareCount int`.
- Add `VideoWatchLater` with `UserID`, `VideoID`, unique user/video index, `Video` preload.
- Add `VideoCollectionBookmark` with `UserID`, `CollectionID`, unique user/collection index, `Collection` preload.

In `internal/model/user.go`, extend `UserSettings`:

- `VideoDefaultVisibility string`
- `VideoDefaultPublishStatus string`
- `VideoAutoplayEnabled bool`
- `VideoDefaultCollectionID *uuid.UUID`

Use default values: `public`, `published`, `false`, `nil`.

- [ ] **Step 4: Add migration**

Create `internal/migrations/20260709_video_creator_loop.go` to:

- Auto-migrate `Video`, `VideoWatchLater`, `VideoCollectionBookmark`, `UserSettings`.
- Convert existing `videos.visibility = 'followers'` to `subscribers`.
- Create indexes for `videos(status, visibility)`, `videos(channel_id, updated_at)`, and `video_collections(collection_id, video_id)` if missing.

Register it in `cmd/migrate/main.go` after current video model migration.

- [ ] **Step 5: Implement access helper**

In `internal/handlers/video_handler.go`, add helpers:

- `normalizeVideoVisibility(value string) string`
- `normalizeVideoStatus(value string) string`
- `canViewVideo(db *gorm.DB, video model.Video, viewer *model.User) bool`
- `isSubscribedToVideoChannel(db *gorm.DB, userID uuid.UUID, channelID uuid.UUID) bool`
- `isAdminOrModerator(user *model.User) bool`

Keep accepted visibility values exactly: `public`, `subscribers`, `private`.

- [ ] **Step 6: Update create/update/get/list handlers**

Update `CreateVideo` and `UpdateVideo`:

- Require `channel_id`.
- Require at least one `collection_ids`.
- Validate all collections belong to the chosen channel.
- Normalize `visibility`.
- Normalize `status`.
- Create preview job only for local videos.

Update `GetVideo`, `GetVideos`, and recommendations:

- Apply `canViewVideo`.
- Keep public homepage results public unless authenticated access should include subscriber-visible videos.
- Include `share_count`, `liked`, bookmark/watch-later state, channel subscription state, and collection bookmark state in detail response.

- [ ] **Step 7: Run tests**

Run:

```bash
cd /Users/fafa/projects/Atoman/Atoman-Backend
go test ./internal/handlers -run 'Test(CreateVideoRequiresVideoChannelAndCollection|GetVideoAllowsSubscribersOnlyVisibilityForChannelSubscriber|GetVideoRejectsSubscribersOnlyVisibilityForGuest|GetVideoAllowsPrivateVisibilityForOwnerAndAdmin|PrivateVideoHidesShareEligibleState)' -count=1
go test ./internal/migrations -run Video -count=1
```

Expected: pass.

- [ ] **Step 8: Commit**

```bash
git add internal/model/video.go internal/model/user.go internal/migrations/20260709_video_creator_loop.go cmd/migrate/main.go internal/handlers/video_handler.go internal/handlers/video_handler_test.go internal/handlers/user_handler_test.go
git commit -m "feat: add video visibility and creator data contract"
```

---

### Task 2: Backend Creator APIs, Bookmarks, Share, Analytics, And Processing Retry

**Files:**
- Modify: `Atoman-Backend/internal/handlers/video_handler.go`
- Modify: `Atoman-Backend/internal/service/video_processing_service.go`
- Modify: `Atoman-Backend/internal/service/video_preview_ffmpeg.go`
- Modify: `Atoman-Backend/docs/swagger.yaml`
- Modify: `Atoman-Backend/docs/swagger.json`
- Modify: `Atoman-Backend/docs/docs.go`
- Test: `Atoman-Backend/internal/handlers/video_handler_test.go`
- Test: `Atoman-Backend/cmd/video_worker/main_test.go`

- [ ] **Step 1: Add failing tests for creator endpoints**

Add tests:

```go
func TestVideoShareIncrementsShareCount(t *testing.T)
func TestVideoBookmarksIncludeVideoChannelCollectionAndWatchLater(t *testing.T)
func TestVideoSubscriptionTimelineIncludesChannelAndCollectionUpdates(t *testing.T)
func TestRetryVideoProcessingCreatesPendingJob(t *testing.T)
func TestVideoCreatorDashboardAggregatesCounts(t *testing.T)
func TestVideoInteractionManagementFiltersTimestampComments(t *testing.T)
```

Expected behavior:

- `POST /api/v1/videos/:id/share` increments `share_count`.
- Bookmark APIs cover videos, channels, collections, and watch-later.
- Subscription feed includes channel subscribed videos and collection bookmarked videos.
- Retry processing changes failed local video back to pending and creates a pending job.
- Dashboard returns play/comment/like/bookmark/share/subscription counts.
- Interaction management can filter timestamp comments.

- [ ] **Step 2: Run failing tests**

```bash
cd /Users/fafa/projects/Atoman/Atoman-Backend
go test ./internal/handlers -run 'Test(VideoShareIncrementsShareCount|VideoBookmarksIncludeVideoChannelCollectionAndWatchLater|VideoSubscriptionTimelineIncludesChannelAndCollectionUpdates|RetryVideoProcessingCreatesPendingJob|VideoCreatorDashboardAggregatesCounts|VideoInteractionManagementFiltersTimestampComments)' -count=1
```

Expected: fail because endpoints are absent.

- [ ] **Step 3: Add routes**

In `SetupVideoRoutes` add authenticated routes:

- `GET /creator/dashboard`
- `GET /creator/videos`
- `GET /creator/analytics`
- `GET /creator/interactions`
- `POST /:id/share`
- `POST /:id/retry-processing`
- `GET /subscriptions/feed`
- `GET /bookmarks/videos`
- `GET /bookmarks/channels`
- `GET /bookmarks/collections`
- `GET /watch-later`
- `POST /watch-later`
- `DELETE /watch-later/:id`
- `POST /collections/bookmarks`
- `DELETE /collections/bookmarks/:id`

Use existing `GET /bookmarks` video bookmark behavior as the implementation base.

- [ ] **Step 4: Implement creator list and dashboard**

Creator list supports query params:

- `status`
- `visibility`
- `processing_status`
- `q`
- `channel_id`
- `collection_id`
- `sort=updated`

Dashboard returns:

```json
{
  "data": {
    "metrics": {
      "views": 0,
      "comments": 0,
      "likes": 0,
      "bookmarks": 0,
      "shares": 0,
      "subscriptions": 0
    },
    "recent_videos": [],
    "issues": [],
    "revenue": null
  }
}
```

Issues include failed processing, draft videos, missing cover, and external URL empty/unreachable if already known from stored data.

- [ ] **Step 5: Implement collection bookmarks and watch-later**

Use `VideoCollectionBookmark` for collection收藏 and `VideoWatchLater` for稍后看.

Rules:

- Collection bookmark creates a feed update source for video subscription page.
- Watch-later is a video-specific saved list, not a feed reading-list item.
- Duplicate POST is idempotent through `FirstOrCreate`.

- [ ] **Step 6: Implement processing retry and ffmpeg fix**

In `video_processing_service.go`, expose:

```go
func RetryVideoPreviewJob(db *gorm.DB, video *model.Video) error
```

It clears `processing_error`, sets `processing_status=pending`, deletes or ignores terminal failed jobs, and creates a new `pending` `thumbnail_preview` job.

In `video_preview_ffmpeg.go`, verify local S3/MinIO URL handling and ensure generated thumbnail URLs are persisted as accessible object URLs. Keep failures in `processing_error`.

- [ ] **Step 7: Sync Swagger**

Update Swagger annotations in `video_handler.go`, then regenerate or directly sync:

```bash
cd /Users/fafa/projects/Atoman/Atoman-Backend
swag init -g cmd/start_server/main.go -o docs
```

If `swag` is unavailable, update `docs/swagger.yaml`, `docs/swagger.json`, and `docs/docs.go` consistently by following existing generated structures.

- [ ] **Step 8: Run backend verification**

```bash
cd /Users/fafa/projects/Atoman/Atoman-Backend
go test ./internal/handlers ./cmd/video_worker -run 'Video|Interaction|UserSettings' -count=1
go build ./...
```

Expected: pass.

- [ ] **Step 9: Commit**

```bash
git add internal/handlers/video_handler.go internal/service/video_processing_service.go internal/service/video_preview_ffmpeg.go internal/handlers/video_handler_test.go cmd/video_worker/main_test.go docs/swagger.yaml docs/swagger.json docs/docs.go
git commit -m "feat: add video creator APIs and processing retry"
```

---

### Task 3: Frontend API Types And Video Store

**Files:**
- Modify: `Atoman-Frontend/src/types.ts`
- Modify: `Atoman-Frontend/src/composables/useApi.ts`
- Create: `Atoman-Frontend/src/stores/video.ts`
- Test: `Atoman-Frontend/tests/unit/stores/video.spec.ts`
- Test: `Atoman-Frontend/tests/unit/composables/useApi.video.spec.ts`

- [ ] **Step 1: Write failing store tests**

Create tests for:

- Loading creator dashboard.
- Toggling video bookmark.
- Toggling watch-later.
- Toggling channel subscription.
- Toggling collection bookmark.
- Sharing a video only increments after successful API call path.
- Loading creator settings defaults.

Use mocked `fetch` and assert endpoint URLs from `useApi()`.

- [ ] **Step 2: Run failing tests**

```bash
cd /Users/fafa/projects/Atoman/Atoman-Frontend
bun run test:unit -- tests/unit/stores/video.spec.ts tests/unit/composables/useApi.video.spec.ts
```

Expected: fail because store/endpoints are missing.

- [ ] **Step 3: Add shared types**

In `src/types.ts`, add:

- `VideoVisibility = 'public' | 'subscribers' | 'private'`
- `VideoPublishStatus = 'draft' | 'published'`
- `VideoProcessingStatus = 'none' | 'pending' | 'processing' | 'ready' | 'failed'`
- `VideoCreatorSettings`
- `VideoCreatorDashboard`
- `VideoCreatorIssue`
- `VideoBookmark`
- `VideoWatchLaterItem`
- `VideoCollectionBookmark`
- `VideoSubscriptionFeedItem`
- Extend `Video` with `share_count`, `liked`, `bookmarked`, `watch_later`, `channel_subscribed`, `collection_bookmarked`.

- [ ] **Step 4: Add API endpoints**

In `useApi().videos`, add creator, bookmark, subscription, share, retry, analytics, and interactions endpoints.

Keep names explicit:

- `creatorDashboard`
- `creatorVideos`
- `creatorAnalytics`
- `creatorInteractions`
- `share(id)`
- `retryProcessing(id)`
- `subscriptionFeed`
- `videoBookmarks`
- `channelBookmarks`
- `collectionBookmarks`
- `watchLater`

- [ ] **Step 5: Implement store**

`src/stores/video.ts` owns:

- creator dashboard state.
- creator settings state.
- bookmark id sets.
- channel subscription id set.
- collection bookmark id set.
- watch-later id set.
- actions for fetch/toggle/share/retry.

On unauthenticated state, return empty collections and do not throw for public pages.

- [ ] **Step 6: Run tests**

```bash
cd /Users/fafa/projects/Atoman/Atoman-Frontend
bun run test:unit -- tests/unit/stores/video.spec.ts tests/unit/composables/useApi.video.spec.ts
bun run type-check
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/composables/useApi.ts src/stores/video.ts tests/unit/stores/video.spec.ts tests/unit/composables/useApi.video.spec.ts
git commit -m "feat: add video frontend API store"
```

---

### Task 4: Upload Editor Two-Step Flow

**Files:**
- Modify: `Atoman-Frontend/src/views/video/VideoEditorView.vue`
- Modify: `Atoman-Frontend/src/views/video/VideoManageView.vue`
- Test: `Atoman-Frontend/tests/unit/views/video/VideoEditorView.spec.ts`

- [ ] **Step 1: Add failing editor tests**

Cover:

- Default source mode is local.
- External mode accepts YouTube/Bilibili/other link.
- Local file upload shows upload progress during source step.
- Second step requires channel and collection.
- Defaults come from default video channel/collection and video creator settings.
- Publish success navigates to `/videos/watch/:id`.
- Draft success navigates to `/videos/manage`.
- Extract-frame failure shows retry and manual cover options.

- [ ] **Step 2: Run failing tests**

```bash
cd /Users/fafa/projects/Atoman/Atoman-Frontend
bun run test:unit -- tests/unit/views/video/VideoEditorView.spec.ts
```

Expected: fail because current editor does not implement these states.

- [ ] **Step 3: Implement two-step UI**

In `VideoEditorView.vue`:

- Step 1 segmented mode: 本地上传 / 外链视频.
- Local upload uses existing `api.videos.uploadVideo`.
- External mode stores original link and inferred platform.
- Step 2 fields: title, description, channel, collection, cover, visibility, publish status, tags.
- Reuse channel/collection loading patterns from `PodcastEditorView.vue`.
- Use concise user-facing copy only.

- [ ] **Step 4: Implement validation**

Frontend validation:

- Video format and size check before upload.
- Channel required.
- Collection required.
- Title required.
- Local source requires uploaded video URL.
- External source requires valid URL string.

- [ ] **Step 5: Implement cover extraction state**

Display:

- 抽帧中
- 抽帧失败
- 重试抽帧
- 手动上传封面

Retry calls `api.videos.retryProcessing(videoId)` for an existing video or re-runs local extraction when still in draft creation state.

- [ ] **Step 6: Run tests and type-check**

```bash
cd /Users/fafa/projects/Atoman/Atoman-Frontend
bun run test:unit -- tests/unit/views/video/VideoEditorView.spec.ts
bun run type-check
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add src/views/video/VideoEditorView.vue tests/unit/views/video/VideoEditorView.spec.ts
git commit -m "feat: rebuild video upload editor flow"
```

---

### Task 5: Creator Center Dashboard, Content, Analytics, Interactions, Settings

**Files:**
- Modify: `Atoman-Frontend/src/views/video/VideoManageView.vue`
- Create: `Atoman-Frontend/src/components/video/VideoCreatorDashboard.vue`
- Create: `Atoman-Frontend/src/components/video/VideoCreatorContentTable.vue`
- Create: `Atoman-Frontend/src/components/video/VideoCreatorAnalytics.vue`
- Create: `Atoman-Frontend/src/components/video/VideoCreatorInteractions.vue`
- Create: `Atoman-Frontend/src/components/video/VideoCreatorSettings.vue`
- Test: `Atoman-Frontend/tests/unit/views/video/VideoManageView.spec.ts`
- Test: `Atoman-Frontend/tests/unit/components/video/VideoCreatorContentTable.spec.ts`

- [ ] **Step 1: Add failing tests**

Assert:

- Creator tabs render: Dashboard、内容管理、数据中心、互动管理、创作设置.
- Dashboard shows upload button, metrics, recent videos, issues, and revenue empty state.
- Content table filters by status and visibility.
- Search covers title/description/channel/collection through query param.
- Failed item shows edit, re-upload, retry, delete actions.
- Analytics has 7/28/90 day range and defaults to 28.
- Interactions have 全部评论 and 时间戳评论 tabs.
- Settings save default channel, default collection, default visibility, default status, autoplay.

- [ ] **Step 2: Run failing tests**

```bash
cd /Users/fafa/projects/Atoman/Atoman-Frontend
bun run test:unit -- tests/unit/views/video/VideoManageView.spec.ts tests/unit/components/video/VideoCreatorContentTable.spec.ts
```

Expected: fail until components exist.

- [ ] **Step 3: Split creator center components**

Keep `VideoManageView.vue` as the shell. Move each tab to a focused component listed above. Use existing UI primitives: `PPageHeader`, `PPress`, `PSegmentedControl`, `PEmpty`, `PInput`, and simple table/list markup.

- [ ] **Step 4: Implement content table behavior**

Fields:

- cover/title
- status
- channel
- collection
- view/comment/like/bookmark/share counts
- published_at or updated_at
- actions

Actions:

- edit routes to `/videos/edit/:id`
- delete uses confirm
- share hidden for private videos
- retry calls store retry action
- re-upload routes to editor with video id

- [ ] **Step 5: Implement settings**

Read/write existing user settings endpoint through video store. Values:

- default channel
- default collection
- default publish status
- default visibility
- autoplay enabled

Also expose autoplay in the existing global settings page if its current settings surface has a suitable section.

- [ ] **Step 6: Run verification**

```bash
cd /Users/fafa/projects/Atoman/Atoman-Frontend
bun run test:unit -- tests/unit/views/video/VideoManageView.spec.ts tests/unit/components/video/VideoCreatorContentTable.spec.ts
bun run type-check
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add src/views/video/VideoManageView.vue src/components/video/VideoCreatorDashboard.vue src/components/video/VideoCreatorContentTable.vue src/components/video/VideoCreatorAnalytics.vue src/components/video/VideoCreatorInteractions.vue src/components/video/VideoCreatorSettings.vue tests/unit/views/video/VideoManageView.spec.ts tests/unit/components/video/VideoCreatorContentTable.spec.ts
git commit -m "feat: add video creator center"
```

---

### Task 6: Watch Page Detail Loop

**Files:**
- Modify: `Atoman-Frontend/src/views/video/VideoDetailView.vue`
- Create: `Atoman-Frontend/src/components/video/VideoCollectionQueue.vue`
- Create: `Atoman-Frontend/src/components/video/VideoShareButton.vue`
- Modify: `Atoman-Frontend/src/components/video/VideoCommentSection.vue`
- Test: `Atoman-Frontend/tests/unit/views/video/VideoDetailView.spec.ts`
- Test: `Atoman-Frontend/tests/unit/components/video/VideoShareButton.spec.ts`

- [ ] **Step 1: Add failing tests**

Assert:

- Right collection queue renders before recommendations.
- Collection queue height is tied to player shell height on desktop.
- Current video is highlighted.
- Channel subscribe button is near channel.
- Collection bookmark button is in collection area.
- Action order is like, bookmark/watch-later, share, more.
- Private video hides share.
- Subscriber-only denied response shows subscribe prompt.
- Desktop comments default open; mobile comments default collapsed.

- [ ] **Step 2: Run failing tests**

```bash
cd /Users/fafa/projects/Atoman/Atoman-Frontend
bun run test:unit -- tests/unit/views/video/VideoDetailView.spec.ts tests/unit/components/video/VideoShareButton.spec.ts
```

Expected: fail.

- [ ] **Step 3: Implement collection queue**

`VideoCollectionQueue.vue` props:

- `collection`
- `videos`
- `currentVideoId`
- `autoplay`

Emits:

- `toggle-autoplay`
- `toggle-bookmark`
- `select-video`

Use internal scroll, fixed desktop max height tied through CSS variable set by parent.

- [ ] **Step 4: Implement share**

`VideoShareButton.vue`:

- Uses `navigator.share` when available.
- Falls back to `navigator.clipboard.writeText`.
- Calls store share action only after share/copy success.
- Emits a compact success/failure state for the parent.

- [ ] **Step 5: Update detail page**

Use detail payload states:

- `video.channel_subscribed`
- `video.collection_bookmarked`
- `video.bookmarked`
- `video.watch_later`

Autoplay:

- Default false.
- If enabled, after ended play next collection item; after collection end use recommendations.

- [ ] **Step 6: Run verification**

```bash
cd /Users/fafa/projects/Atoman/Atoman-Frontend
bun run test:unit -- tests/unit/views/video/VideoDetailView.spec.ts tests/unit/components/video/VideoShareButton.spec.ts
bun run type-check
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add src/views/video/VideoDetailView.vue src/components/video/VideoCollectionQueue.vue src/components/video/VideoShareButton.vue src/components/video/VideoCommentSection.vue tests/unit/views/video/VideoDetailView.spec.ts tests/unit/components/video/VideoShareButton.spec.ts
git commit -m "feat: complete video watch page loop"
```

---

### Task 7: Subscriptions, Bookmarks, Channel Detail, Collection Detail, Home Modes

**Files:**
- Modify: `Atoman-Frontend/src/views/video/VideoLayout.vue`
- Modify: `Atoman-Frontend/src/views/video/VideoSubscriptionsView.vue`
- Create: `Atoman-Frontend/src/views/video/VideoStarredView.vue`
- Create: `Atoman-Frontend/src/views/video/VideoChannelView.vue`
- Create: `Atoman-Frontend/src/views/video/VideoCollectionView.vue`
- Modify: `Atoman-Frontend/src/views/video/VideoHomeView.vue`
- Modify: `Atoman-Frontend/src/router/routes/modules.ts`
- Test: `Atoman-Frontend/tests/unit/views/video/VideoLayout.spec.ts`
- Test: `Atoman-Frontend/tests/unit/views/video/VideoSubscriptionsView.spec.ts`
- Test: `Atoman-Frontend/tests/unit/views/video/VideoStarredView.spec.ts`
- Test: `Atoman-Frontend/tests/unit/router/routes.spec.ts`

- [ ] **Step 1: Add failing tests**

Assert:

- Video sidebar order is 探索、订阅、收藏、创作.
- Subscriptions page renders feed-style video update rows.
- Subscriptions sidebar filters by subscribed channels and bookmarked collections.
- Bookmarks page tabs are 视频、频道、合集、稍后看 and default tab is 视频.
- Channel detail shows channel info, subscribe, video list, owner manage button.
- Collection detail shows collection info, bookmark, video list, autoplay toggle, owner manage button.
- Home page no longer renders a recommendation section and uses 热度/精选/探索 modes.

- [ ] **Step 2: Run failing tests**

```bash
cd /Users/fafa/projects/Atoman/Atoman-Frontend
bun run test:unit -- tests/unit/views/video/VideoLayout.spec.ts tests/unit/views/video/VideoSubscriptionsView.spec.ts tests/unit/views/video/VideoStarredView.spec.ts tests/unit/router/routes.spec.ts
```

Expected: fail.

- [ ] **Step 3: Update routes**

Add child routes under video module:

- `starred`
- `channel/:id`
- `collection/:id`

Keep existing watch route compatibility.

- [ ] **Step 4: Implement layout**

`VideoLayout.vue`:

- Uses `moduleUrl`/`modulePathUrl` like music layout where possible.
- Adds 收藏 sidebar item.
- Shows subscription/channel/collection side sections only when authenticated and relevant to current route.

- [ ] **Step 5: Implement subscriptions and bookmarks**

Subscriptions:

- Fetch video update feed.
- Default mixed timeline.
- Filter by channel or collection from sidebar.

Bookmarks:

- Four tabs.
- Video tab displays bookmarked videos.
- Channel tab displays saved channels.
- Collection tab displays saved collections.
- Watch-later tab displays video watch-later list.

- [ ] **Step 6: Implement detail pages**

Channel page:

- Info, subscribe button, video list.
- Owner manage button routes to `/videos/manage?channel_id=<id>`.

Collection page:

- Info, bookmark button, video list, autoplay toggle.
- Owner manage button routes to `/videos/manage?collection_id=<id>`.

- [ ] **Step 7: Update home**

Remove top recommendation section. Use segmented modes:

- 热度
- 精选
- 探索

Map to backend query modes from spec. Keep only published accessible videos.

- [ ] **Step 8: Run verification**

```bash
cd /Users/fafa/projects/Atoman/Atoman-Frontend
bun run test:unit -- tests/unit/views/video/VideoLayout.spec.ts tests/unit/views/video/VideoSubscriptionsView.spec.ts tests/unit/views/video/VideoStarredView.spec.ts tests/unit/router/routes.spec.ts
bun run type-check
```

Expected: pass.

- [ ] **Step 9: Commit**

```bash
git add src/views/video/VideoLayout.vue src/views/video/VideoSubscriptionsView.vue src/views/video/VideoStarredView.vue src/views/video/VideoChannelView.vue src/views/video/VideoCollectionView.vue src/views/video/VideoHomeView.vue src/router/routes/modules.ts tests/unit/views/video/VideoLayout.spec.ts tests/unit/views/video/VideoSubscriptionsView.spec.ts tests/unit/views/video/VideoStarredView.spec.ts tests/unit/router/routes.spec.ts
git commit -m "feat: add video subscriptions and bookmarks"
```

---

### Task 8: End-To-End Verification And Polish

**Files:**
- Modify: `Atoman-Frontend/tests/e2e/specs/video.spec.ts`
- Modify: `Atoman-Frontend/tests/unit/views/video/VideoEditorView.spec.ts`
- Modify: `Atoman-Frontend/tests/unit/views/video/VideoManageView.spec.ts`
- Modify: `Atoman-Frontend/tests/unit/views/video/VideoDetailView.spec.ts`
- Modify: `Atoman-Frontend/tests/unit/views/video/VideoSubscriptionsView.spec.ts`
- Modify: `Atoman-Frontend/tests/unit/views/video/VideoStarredView.spec.ts`
- Modify: `Atoman-Backend/internal/handlers/video_handler_test.go`

- [ ] **Step 1: Add e2e coverage**

Cover these user flows:

- Authenticated creator uploads local video, fills metadata, publishes, lands on watch page.
- Creator saves draft, lands on creator content management.
- Viewer subscribes to channel and sees subscribers-only video in subscriptions.
- Viewer bookmarks collection and sees collection updates in subscriptions.
- Viewer adds video to watch-later and sees it in bookmarks.
- Viewer shares public video and share count increments.

- [ ] **Step 2: Run backend verification**

```bash
cd /Users/fafa/projects/Atoman/Atoman-Backend
go test ./...
go build ./...
```

Expected: pass.

- [ ] **Step 3: Run frontend verification**

```bash
cd /Users/fafa/projects/Atoman/Atoman-Frontend
bun run type-check
bun run test:unit
```

Expected: pass.

- [ ] **Step 4: Run targeted e2e**

Start the frontend with the project-approved command:

```bash
~/.claude/skills/brainstorming/scripts/start-server.sh \
  --project-dir /Users/fafa/projects/Atoman/Atoman-Frontend \
  --host 0.0.0.0 \
  --url-host localhost \
  --foreground
```

Then run:

```bash
cd /Users/fafa/projects/Atoman/Atoman-Frontend
bun run test:e2e -- tests/e2e/specs/video.spec.ts
```

Expected: pass.

- [ ] **Step 5: Visual QA**

Check desktop and mobile:

- Video detail page right collection queue aligns with player height.
- Comments are open on desktop and collapsed on mobile.
- Creator table text does not overflow.
- Upload two-step form works on mobile.
- Subscription feed list is readable and not card-heavy.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/specs/video.spec.ts tests/unit/views/video Atoman-Backend/internal/handlers/video_handler_test.go
git commit -m "test: cover video upload watch loop"
```

---

## Final Verification

Run from backend:

```bash
cd /Users/fafa/projects/Atoman/Atoman-Backend
go test ./...
go build ./...
```

Run from frontend:

```bash
cd /Users/fafa/projects/Atoman/Atoman-Frontend
bun run type-check
bun run test:unit
```

If a dev server is needed for visual verification, use the approved foreground server command from Task 8.

## Self-Review

Spec coverage:

- Upload, visibility, creator center, watch page, subscriptions, bookmarks, channel/collection detail, sharing, analytics, interactions, processing retry, and tests are covered by Tasks 1-8.

Incomplete-item scan:

- This plan contains concrete task steps, exact paths, and verification commands.

Type consistency:

- Visibility uses `public | subscribers | private`.
- Publish status uses `draft | published`.
- Processing status uses existing `none | pending | processing | ready | failed`.
- Channel action is subscription; collection action is bookmark.
