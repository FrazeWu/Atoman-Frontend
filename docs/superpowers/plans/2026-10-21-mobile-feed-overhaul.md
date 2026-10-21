# Mobile Feed Space Overhaul Plan

## Tasks

- [ ] Task 1: Navigation Shell Tabs & Routes Configuration
  - Update `apps/mobile/components/system/spaceConstants.ts` for `SPACE_TABS.feed` to `['精选', '关注', '收藏', '我的']`
  - Update `tests/unit/mobile/navigation-shell.spec.ts` assertion for feed tabs
  - Register `/feed/following`, `/feed/starred`, `/feed/me` in `apps/mobile/mobileRoutes.ts`

- [ ] Task 2: Implement Unit Tests
  - Create `tests/unit/mobile/feed-space.spec.ts` testing `FeedStreamView`, `FeedFollowingView`, `FeedStarredView`, `FeedMeView`

- [ ] Task 3: Implement `FeedFollowingView.vue`
  - Timeline stream, mark-all-as-read, source reel, tap to article reader

- [ ] Task 4: Implement `FeedStarredView.vue`
  - Bookmarked articles stream, category filter chips, unstar action

- [ ] Task 5: Implement `FeedMeView.vue`
  - Reader profile, 4 stats, sources management link, clean pure-white card

- [ ] Task 6: Visual Capture & Verification
  - Run all mobile unit tests and `bun run type-check`
  - Capture screenshots for `/feed`, `/feed/following`, `/feed/starred`, `/feed/me`
  - Git commit and push to remote
