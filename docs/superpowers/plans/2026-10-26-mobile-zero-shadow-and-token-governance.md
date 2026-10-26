# Mobile Zero-Shadow Cleanup & Token Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all remaining 18 box-shadow occurrences and convert 300+ hardcoded colors in `apps/mobile/` into semantic tokens (`--a-color-bg`, `--a-color-surface`, `--a-color-text`, `--a-color-border-soft`), strictly enforcing 0 shadow and 4px border radius.

**Architecture:** Scan and replace every direct shadow declaration with `box-shadow: none !important;` or remove it. Convert hardcoded hex colors (`#ffffff`, `#1c1c1e`, `#0f172a`, etc.) to CSS custom properties. Verify against unit tests and typecheck per task.

**Tech Stack:** Vue 3.4, TypeScript 5.8, CSS custom properties, Vitest.

## Global Constraints
- Zero shadow: `box-shadow: none !important;` across all components and utility sheets.
- 4px border radius: `var(--a-radius-control, 4px)`.
- Full tokenization: No hardcoded arbitrary colors; use semantic CSS tokens (`--a-color-bg`, `--a-color-surface`, `--a-color-text`, `--a-color-border-soft`, `--a-color-muted`).
- No fake/mock data in production code: use real store/API data.
- 0 TypeScript errors on `bun run type-check`.

---

### Task 1: 移动端系统底栏、播放器与共享样式 0 阴影与 Token 治理

**Files:**
- Modify: `Atoman-Frontend/apps/mobile/components/system/MobileBottomNav.vue`
- Modify: `Atoman-Frontend/apps/mobile/MobilePlayerView.vue`
- Modify: `Atoman-Frontend/apps/mobile/MobileAudioPlayer.vue`
- Modify: `Atoman-Frontend/apps/mobile/mobileContent.css`
- Modify: `Atoman-Frontend/apps/mobile/mobileSaved.css`
- Test: `Atoman-Frontend/tests/unit/mobile/MobilePlayerGestures.spec.ts`
- Test: `Atoman-Frontend/tests/unit/mobile/MobileMiniPlayerGestures.spec.ts`
- Test: `Atoman-Frontend/tests/unit/mobile/music-views.spec.ts`

- [ ] **Step 1: Inspect and eliminate shadows in MobileBottomNav.vue and MobilePlayerView.vue**
  - In `MobileBottomNav.vue:167`, change `box-shadow: 0 -1px 3px rgba(0, 0, 0, 0.04);` to `box-shadow: none !important;`.
  - In `MobilePlayerView.vue:928, 1210, 1341`, remove `box-shadow` or set `box-shadow: none !important;`.
  - In `MobileAudioPlayer.vue`, replace hardcoded `#ffffff` with `var(--a-color-surface, #ffffff)`.

- [ ] **Step 2: Tokenize hardcoded #ffffff and #1c1c1e in mobileContent.css and mobileSaved.css**
  - Replace `.mobile-content-card`, `.mobile-content-bar`, `.mobile-saved-item`, etc., background `#ffffff` with `var(--a-color-surface)`.
  - Replace hardcoded text colors `#1c1c1e` with `var(--a-color-text)`.

- [ ] **Step 3: Run unit tests for player and system components**
  Run `cd Atoman-Frontend && bun run test:unit tests/unit/mobile/MobilePlayerGestures.spec.ts tests/unit/mobile/MobileMiniPlayerGestures.spec.ts tests/unit/mobile/music-views.spec.ts`.

- [ ] **Step 4: Commit Task 1**
  Commit with message `refactor(mobile): eliminate shadows and tokenize system and player styles`.

---

### Task 2: 移动端书籍模块（Books Module）0 阴影与 Token 治理

**Files:**
- Modify: `Atoman-Frontend/apps/mobile/views/books/BooksNotesView.vue`
- Modify: `Atoman-Frontend/apps/mobile/views/books/BookDetailMobileView.vue`
- Modify: `Atoman-Frontend/apps/mobile/views/books/BooksMeView.vue`
- Modify: `Atoman-Frontend/apps/mobile/views/books/BooksDiscoverView.vue`
- Test: `Atoman-Frontend/tests/unit/mobile/books-space.spec.ts`
- Test: `Atoman-Frontend/tests/unit/mobile/books-real-data.spec.ts`

- [ ] **Step 1: Eliminate shadows in Books module views**
  - `BooksNotesView.vue:245`: set `box-shadow: none !important;`.
  - `BookDetailMobileView.vue:317`: set `box-shadow: none !important;`.
  - `BooksMeView.vue:305`: set `box-shadow: none !important;`.
  - `BooksDiscoverView.vue:436`: set `box-shadow: none !important;`.

- [ ] **Step 2: Tokenize hardcoded colors and normalize radii to 4px in Books module**
  - Replace `#ffffff` / `#1c1c1e` with `var(--a-color-surface)` / `var(--a-color-text)`.
  - Normalize any `border-radius: 8px/12px` to `var(--a-radius-control, 4px)`.

- [ ] **Step 3: Run Books module unit tests**
  Run `cd Atoman-Frontend && bun run test:unit tests/unit/mobile/books-space.spec.ts tests/unit/mobile/books-real-data.spec.ts`.

- [ ] **Step 4: Commit Task 2**
  Commit with message `refactor(mobile): eliminate shadows and tokenize books module`.

---

### Task 3: 移动端 Feed 与博客短笺模块 0 阴影与 Token 治理

**Files:**
- Modify: `Atoman-Frontend/apps/mobile/views/blog/BlogNotesTimelineView.vue`
- Modify: `Atoman-Frontend/apps/mobile/views/feed/FeedStarredView.vue`
- Modify: `Atoman-Frontend/apps/mobile/views/feed/FeedStatsMobileView.vue`
- Modify: `Atoman-Frontend/apps/mobile/views/feed/FeedMeView.vue`
- Modify: `Atoman-Frontend/apps/mobile/views/feed/FeedFollowingView.vue`
- Modify: `Atoman-Frontend/apps/mobile/views/feed/FeedStreamView.vue`
- Test: `Atoman-Frontend/tests/unit/mobile/feed-space.spec.ts`
- Test: `Atoman-Frontend/tests/unit/mobile/blog-space.spec.ts`

- [ ] **Step 1: Eliminate shadows in Feed & Blog views**
  - `BlogNotesTimelineView.vue:482`: remove glow `box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);`, use `border: 1px solid var(--a-color-primary);`.
  - `FeedStarredView.vue:267`: set `box-shadow: none !important;`.
  - `FeedStatsMobileView.vue:268`: set `box-shadow: none !important;`.
  - `FeedMeView.vue:254`: set `box-shadow: none !important;`.
  - `FeedFollowingView.vue:307`: set `box-shadow: none !important;`.
  - `FeedStreamView.vue:433`: set `box-shadow: none !important;`.

- [ ] **Step 2: Tokenize colors and normalize border radius**
  - Use `var(--a-color-surface)`, `var(--a-color-border-soft)`, `var(--a-radius-control, 4px)`.

- [ ] **Step 3: Run Feed and Blog unit tests**
  Run `cd Atoman-Frontend && bun run test:unit tests/unit/mobile/feed-space.spec.ts tests/unit/mobile/blog-space.spec.ts`.

- [ ] **Step 4: Commit Task 3**
  Commit with message `refactor(mobile): eliminate shadows and tokenize feed and blog views`.

---

### Task 4: 移动端私信与音乐模块 0 阴影与全站收网验证

**Files:**
- Modify: `Atoman-Frontend/apps/mobile/views/messages/MessageChatMobileView.vue`
- Modify: `Atoman-Frontend/apps/mobile/views/messages/MessagesMeView.vue`
- Modify: `Atoman-Frontend/apps/mobile/views/music/MusicArtistDetailView.vue`
- Test: `Atoman-Frontend/tests/unit/mobile/messages-space.spec.ts`

- [ ] **Step 1: Eliminate shadows in Messages and Music views**
  - `MessageChatMobileView.vue:362`: set `box-shadow: none !important;`.
  - `MessagesMeView.vue:263, 392`: set `box-shadow: none !important;`.
  - `MusicArtistDetailView.vue:468`: set `box-shadow: none !important;`.

- [ ] **Step 2: Verify zero shadows remaining in apps/mobile/**
  Run grep command to confirm 0 non-none `box-shadow` declarations in `apps/mobile/`.

- [ ] **Step 3: Run full type check and all mobile tests**
  Run `cd Atoman-Frontend && bun run type-check && bun run test:unit tests/unit/mobile/`.

- [ ] **Step 4: Run production build verification**
  Run `cd Atoman-Frontend && bun run build && bun run build:mobile`.

- [ ] **Step 5: Commit and push Task 4**
  Commit with message `refactor(mobile): finalize zero-shadow cleanup across messages and music modules`.
