# Mobile Blog Space Overhaul Implementation Plan

**Spec**: `docs/superpowers/specs/2026-10-21-mobile-blog-overhaul-design.md`  
**Goal**: Overhaul mobile Blog space into four pure-white minimal tabs: 发现 (`/posts`), 短笺 (`/posts/notes`), 长文 (`/posts/articles`), 我的 (`/posts/me`), with detail navigation preservation and seamless mobile composition.

---

### Task 1: Navigation Shell & Route Setup
- **Files**:
  - `apps/mobile/components/system/spaceConstants.ts`
  - `apps/mobile/MobileApp.vue`
  - `apps/mobile/mobileRoutes.ts`
  - `tests/unit/mobile/navigation-shell.spec.ts`
- **Steps**:
  1. Update `SPACE_TABS.blog` with `['发现', '短笺', '长文', '我的']`.
  2. Add detail route regex to `MobileApp.vue` (`/^\/post\//`, `/^\/posts\/notes\//`) so bottom nav is preserved on reading pages.
  3. Wire route mappings in `mobileRoutes.ts`.
  4. Update `tests/unit/mobile/navigation-shell.spec.ts` to assert the 4 blog tabs and verify passes.

### Task 2: Implement `BlogDiscoverView.vue` (Tab 1: 发现)
- **Files**:
  - `apps/mobile/views/blog/BlogDiscoverView.vue`
  - `tests/unit/mobile/blog-views.spec.ts`
- **Features**:
  - Search bar (`MInput`) with instant query and clear.
  - Featured story hero card (cover, title, author, reading time, action).
  - Trending topics & channels horizontal carousel.
  - Combined stream of curated articles & notes.
- **Tests**:
  - Renders featured hero story.
  - Filters stream when typing in search.
  - Tapping story triggers navigation to reader.

### Task 3: Implement `BlogNotesTimelineView.vue` (Tab 2: 短笺) & Composer Sheet
- **Files**:
  - `apps/mobile/views/blog/BlogNotesTimelineView.vue`
  - `apps/mobile/views/blog/ShortNoteComposerSheet.vue`
  - `tests/unit/mobile/blog-views.spec.ts`
- **Features**:
  - Micro-note cards: 4px MAvatar, author name, time, text body, image grid, action bar (like heart, comment, bookmark).
  - Floating action button to open `ShortNoteComposerSheet`.
  - Composer sheet: auto-focused textarea, photo upload preview, "发布短笺" action with optimistic update.
- **Tests**:
  - Renders notes list with author and content.
  - Liking note toggles heart count.
  - Opening composer sheet and emitting submit adds note to stream.

### Task 4: Implement `BlogArticlesView.vue` (Tab 3: 长文)
- **Files**:
  - `apps/mobile/views/blog/BlogArticlesView.vue`
  - `tests/unit/mobile/blog-views.spec.ts`
- **Features**:
  - Category filter chips (全部, 技术, 思考, 随笔, 文化, 设计).
  - Deep reading article cards with title, 2-line summary, tags, author, reading time in minutes.
  - Tapping card opens `/post/:id`.
- **Tests**:
  - Filters articles when clicking category chips.
  - Tapping card navigates to `/post/:id`.

### Task 5: Implement `BlogMeView.vue` (Tab 4: 我的) & Detail View Alignment
- **Files**:
  - `apps/mobile/views/blog/BlogMeView.vue`
  - `apps/mobile/views/blog/ShortNoteDetailMobileView.vue`
  - `tests/unit/mobile/blog-views.spec.ts`
- **Features**:
  - Author identity header: avatar, name, handle, bio.
  - 4 stats: 短笺、长文、获赞、关注者.
  - 3 sub-tabs: [我的短笺, 我的长文, 我的收藏].
  - Clean empty states with quick compose triggers.
  - Short note detail view with back button and comment list.
- **Tests**:
  - Renders user author profile and metrics.
  - Switches between sub-tabs.
  - Emits delete on user's own note.

### Task 6: Verification, Type-Check, Screenshot Walkthrough & Commit
- Run `bun run type-check`.
- Run all mobile unit tests (`bun run test:unit tests/unit/mobile/`).
- Run Playwright screenshot capture on `/posts`, `/posts/notes`, `/posts/articles`, `/posts/me`, `/post/:id`.
- Verify visuals against pure-white minimal design tokens.
- Commit and push to `origin/main`.
