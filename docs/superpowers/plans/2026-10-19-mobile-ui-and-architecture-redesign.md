# Mobile UI & Independent Architecture Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completely rebuild the Atoman mobile web application (`apps/mobile/`) with an independent architecture, pure-white minimal UI (4px micro-radius, zero heavy borders), Apple SF Symbols style geometric stroke SVG icons, a top-bar Space Drawer navigation system with scoped bottom TabBars, and complete severance from desktop `src/views/` components.

**Architecture:** 
- Mobile UI primitives live under `apps/mobile/components/ui/` (`MIcon`, `MButton`, `MSheet`, `MInput`, `MAvatar`).
- System shell components live under `apps/mobile/components/system/` (`MobileSpaceDrawer`, `MobileTopbar`, `MobileBottomNav`).
- Mobile views live under `apps/mobile/views/{feed,music,blog,books,debate,studio,messages,me}/`, consuming `@/api` and `@/stores` directly while eliminating any imports from `src/views/`.
- Router in `apps/mobile/mobileRoutes.ts` maps all mobile paths exclusively to `apps/mobile/views/`.

**Tech Stack:** Vue 3.4 (SFC, Composition API `<script setup>`), TypeScript 5.8 (strict), Vite, Tailwind CSS v4, Pinia 2, Vitest, Vue Test Utils.

## Global Constraints

- Pure-White Minimal Design System:
  - Surface: `#ffffff` / `var(--a-color-bg)` for main cards and backgrounds; no dark heavy card borders.
  - Radius: 4px (`var(--a-radius-card)` / `var(--a-radius-control)`). Absolutely no 999px pill shapes or arbitrary large radii.
  - Dividers: `var(--a-color-border-soft)` (`#e2e8f0`) or `var(--a-color-border)` (`#cbd5e1`).
  - Typography: weights 500 (medium) / 600 (semi-bold). No 700/800 bold fonts.
  - Copy: Clean user-facing text only. Zero developer/internal jargon.
- Icon Design System:
  - Apple SF Symbols style geometric stroke aesthetic.
  - Base stroke width `1.6px` (micro `1.5px`, active tab `2.1px`), `stroke-linecap="round"`, `stroke-linejoin="round"`, `fill="none"`.
  - Pure vector SVG rendering via `MIcon.vue`. Zero emojis or coarse Unicode symbols.
- Independence:
  - `apps/mobile/` must not import anything from `src/views/`.
  - Independent build via `bun run build:mobile` outputs cleanly to `dist-mobile/`.

---

### Task 1: Mobile UI Primitives & SF Symbols Icon System

**Files:**
- Create: `apps/mobile/components/ui/MIcon.vue`
- Create: `apps/mobile/components/ui/MButton.vue`
- Create: `apps/mobile/components/ui/MSheet.vue`
- Create: `apps/mobile/components/ui/MInput.vue`
- Create: `apps/mobile/components/ui/MAvatar.vue`
- Create: `tests/unit/mobile/ui-primitives.spec.ts`

**Interfaces:**
- `MIcon`: Props `{ name: string, size?: 'xs' | 'sm' | 'md' | 'lg', strokeWidth?: number }`
  Supported icons: `feed`, `music`, `books`, `blog`, `debate`, `messages`, `studio`, `compass`, `search`, `bell`, `chevron-down`, `xmark`, `person`, `library`, `playlists`, `antenna`, `bookmark`, `heart`, `shelf`, `notes`, `player-prev`, `player-next`, `player-play`, `player-pause`, `waveform`, `battery`, `cellular`.
- `MButton`: Props `{ variant?: 'primary' | 'secondary' | 'ghost', size?: 'sm' | 'md' | 'lg', block?: boolean, disabled?: boolean }`
- `MSheet`: Props `{ modelValue: boolean, title?: string }`, Emits `{ 'update:modelValue': [boolean], 'close': [] }`
- `MInput`: Props `{ modelValue: string, placeholder?: string, clearable?: boolean }`, Emits `{ 'update:modelValue': [string] }`
- `MAvatar`: Props `{ src?: string, name?: string, size?: number }`

- [ ] **Step 1: Write the failing unit tests for UI primitives**
  Write tests in `tests/unit/mobile/ui-primitives.spec.ts` verifying:
  - `MIcon` renders the correct SVG paths and scales according to `size`.
  - `MButton` applies the correct classes and 4px radius, handles click and disabled states.
  - `MSheet` renders overlay, title, slot content, and emits update on close button or backdrop click.
  - `MInput` renders input field, handles v-model two-way binding, and clear button.
  - `MAvatar` renders image when `src` is present, or monogram fallback when absent.

- [ ] **Step 2: Run test to verify it fails**
  `bun run test:unit tests/unit/mobile/ui-primitives.spec.ts`

- [ ] **Step 3: Implement `MIcon.vue`**
  Implement SVG vector sprite definitions and rendering with SF Symbols stroke styling (`1.6px` default stroke, geometric line metaphors).

- [ ] **Step 4: Implement `MButton.vue`, `MSheet.vue`, `MInput.vue`, and `MAvatar.vue`**
  Implement all primitives adhering strictly to the Pure-White Minimal Design System tokens (4px radius, `#ffffff` surface, soft borders).

- [ ] **Step 5: Run tests and verify**
  `bun run test:unit tests/unit/mobile/ui-primitives.spec.ts`
  `bun run type-check`

- [ ] **Step 6: Commit**
  `git commit -m "feat(mobile): implement mobile UI primitives and SF Symbols icon system"`

---

### Task 2: Mobile Navigation Shell & Space Drawer

**Files:**
- Create: `apps/mobile/components/system/MobileSpaceDrawer.vue`
- Create: `apps/mobile/components/system/MobileTopbar.vue`
- Create: `apps/mobile/components/system/MobileBottomNav.vue`
- Modify: `apps/mobile/MobileApp.vue`
- Create: `tests/unit/mobile/navigation-shell.spec.ts`

**Interfaces:**
- `MobileSpaceDrawer`: Props `{ open: boolean, currentSpace: string }`, Emits `{ 'update:open': [boolean], 'select-space': [string] }`
- `MobileTopbar`: Props `{ currentSpace: string }`, Emits `{ 'open-drawer': [], 'search': [], 'notifications': [] }`
- `MobileBottomNav`: Props `{ currentSpace: string }`, routes between sub-views within the current space.
- `MobileApp.vue`: Top-level mobile layout wrapping Topbar, main scroll view, MiniPlayer, BottomNav, and SpaceDrawer.

- [ ] **Step 1: Write the failing unit tests for navigation shell**
  Write tests in `tests/unit/mobile/navigation-shell.spec.ts` verifying:
  - `MobileTopbar` displays the active space name and trigger button with chevron.
  - Clicking space trigger emits `open-drawer`.
  - `MobileSpaceDrawer` lists all 7 spaces with `MIcon` and badges. Clicking an item emits `select-space` and closes drawer.
  - `MobileBottomNav` dynamically maps tabs according to `currentSpace` (e.g. `music` -> 发现/曲库/歌单/我的; `feed` -> 推荐/订阅源/稍后读/已收藏).
  - `MobileApp` integrates all components and manages drawer state.

- [ ] **Step 2: Run test to verify it fails**
  `bun run test:unit tests/unit/mobile/navigation-shell.spec.ts`

- [ ] **Step 3: Implement `MobileSpaceDrawer.vue`**
  Left slide-in drawer with 280px width, clean header, 7 space items with icons and badges, backdrop overlay with smooth cubic-bezier transition.

- [ ] **Step 4: Implement `MobileTopbar.vue` and `MobileBottomNav.vue`**
  - Topbar with left space trigger and right search/notifications icon buttons.
  - BottomNav with 56px height, pure white surface, top soft border, dynamic tab mapping and router link switching.

- [ ] **Step 5: Modernize `MobileApp.vue`**
  Wrap the entire mobile application shell with reactive current space tracking derived from route meta or path.

- [ ] **Step 6: Run tests and verify**
  `bun run test:unit tests/unit/mobile/navigation-shell.spec.ts`
  `bun run type-check`

- [ ] **Step 7: Commit**
  `git commit -m "feat(mobile): implement MobileSpaceDrawer, MobileTopbar, and MobileBottomNav"`

---

### Task 3: Independent Music Views & Player

**Files:**
- Create: `apps/mobile/views/music/MusicDiscoverView.vue`
- Create: `apps/mobile/views/music/MusicLibraryView.vue`
- Create: `apps/mobile/views/music/MusicPlaylistsView.vue`
- Modify: `apps/mobile/MobilePlayerView.vue`
- Modify: `apps/mobile/MobileAudioPlayer.vue`
- Create: `tests/unit/mobile/music-views.spec.ts`

**Interfaces:**
- Consumes: `@/stores/player`, `@/api/music`
- `MusicDiscoverView`: Curated playlists grid, recent tracks list with playback trigger.
- `MusicLibraryView`: Songs and albums list with search & filter.
- `MusicPlaylistsView`: User & public playlists list with creation action.
- `MobileAudioPlayer`: Bottom mini player bar with 2px top progress line, play/pause and skip controls.
- `MobilePlayerView`: Full-screen touch player sheet with gesture dismiss, cover art, track info, lyrics toggle, and SF Symbols controls.

- [ ] **Step 1: Write failing unit tests for music views**
  Write tests in `tests/unit/mobile/music-views.spec.ts` verifying:
  - `MusicDiscoverView` renders playlist cards and song list items.
  - Clicking a song calls `playerStore.playSong()`.
  - `MobileAudioPlayer` displays current song, 2px progress bar, and play/pause toggle.
  - `MobilePlayerView` opens and renders full playback controls.

- [ ] **Step 2: Run test to verify it fails**
  `bun run test:unit tests/unit/mobile/music-views.spec.ts`

- [ ] **Step 3: Implement `MusicDiscoverView.vue`, `MusicLibraryView.vue`, and `MusicPlaylistsView.vue`**
  Build clean mobile-first music views using `MIcon`, `MButton`, and `MSheet`, consuming `@/stores/player`.

- [ ] **Step 4: Refactor `MobileAudioPlayer.vue` and `MobilePlayerView.vue`**
  Replace legacy icons with `MIcon`, adhere strictly to 4px radius and pure white minimal styling.

- [ ] **Step 5: Run tests and verify**
  `bun run test:unit tests/unit/mobile/music-views.spec.ts`
  `bun run type-check`

- [ ] **Step 6: Commit**
  `git commit -m "feat(mobile): implement independent mobile music views and player UI"`

---

### Task 4: Independent Feed & Blog Views

**Files:**
- Create: `apps/mobile/views/feed/FeedStreamView.vue`
- Create: `apps/mobile/views/feed/FeedSourcesView.vue`
- Create: `apps/mobile/views/feed/FeedArticleReaderView.vue`
- Create: `apps/mobile/views/blog/BlogListView.vue`
- Create: `apps/mobile/views/blog/BlogPostReaderView.vue`
- Create: `tests/unit/mobile/feed-blog-views.spec.ts`

**Interfaces:**
- Consumes: `@/api/feed`, `@/api/blog`
- `FeedStreamView`: RSS articles list with author avatar, publication time, summary, and action bar (like, comment, read later).
- `FeedSourcesView`: Feed subscriptions manager with add/remove source actions.
- `FeedArticleReaderView`: Distraction-free mobile reading view with typography controls.
- `BlogListView`: Blog articles and short notes feed with tag filters.
- `BlogPostReaderView`: Clean markdown article renderer for mobile.

- [ ] **Step 1: Write failing unit tests for feed and blog views**
  Write tests in `tests/unit/mobile/feed-blog-views.spec.ts` verifying:
  - `FeedStreamView` renders feed items, handles read later bookmarking.
  - `FeedArticleReaderView` displays article content and navigation back button.
  - `BlogListView` renders posts list and filters by tag.
  - `BlogPostReaderView` renders article markdown and metadata.

- [ ] **Step 2: Run test to verify it fails**
  `bun run test:unit tests/unit/mobile/feed-blog-views.spec.ts`

- [ ] **Step 3: Implement `FeedStreamView.vue`, `FeedSourcesView.vue`, and `FeedArticleReaderView.vue`**
  Clean touch-optimized feed components with zero desktop imports.

- [ ] **Step 4: Implement `BlogListView.vue` and `BlogPostReaderView.vue`**
  Mobile blog list and reading views with pure-white layout and minimal typography.

- [ ] **Step 5: Run tests and verify**
  `bun run test:unit tests/unit/mobile/feed-blog-views.spec.ts`
  `bun run type-check`

- [ ] **Step 6: Commit**
  `git commit -m "feat(mobile): implement independent mobile feed and blog views"`

---

### Task 5: Independent Books, Debate, Messages & Studio Views

**Files:**
- Create: `apps/mobile/views/books/BooksShelfView.vue`
- Create: `apps/mobile/views/books/BookReaderMobileView.vue`
- Create: `apps/mobile/views/debate/DebateHallView.vue`
- Create: `apps/mobile/views/messages/MessagesMobileView.vue`
- Create: `apps/mobile/views/studio/StudioMobileView.vue`
- Create: `apps/mobile/views/me/ProfileMobileView.vue`
- Create: `tests/unit/mobile/modules-views.spec.ts`

**Interfaces:**
- Consumes: `@/api/books`, `@/api/debate`, `@/stores/dm`, `@/stores/user`
- `BooksShelfView`: Current reading progress card, shelf book list, and reading jump.
- `BookReaderMobileView`: Fullscreen mobile EPUB/TXT reader with font size toggle, night mode, and chapter drawer.
- `DebateHallView`: Debate topics list, affirmative/negative stance cards, and vote action.
- `MessagesMobileView`: Direct messages conversation list and chat bubble thread.
- `StudioMobileView`: Quick creator tools (publish short note, write blog draft).
- `ProfileMobileView`: User profile card, account settings, theme toggle, and logout.

- [ ] **Step 1: Write failing unit tests for remaining module views**
  Write tests in `tests/unit/mobile/modules-views.spec.ts` verifying:
  - `BooksShelfView` displays current reading progress.
  - `DebateHallView` renders topic cards and voting options.
  - `MessagesMobileView` lists conversations and opens chat thread.
  - `StudioMobileView` provides short note composition.
  - `ProfileMobileView` renders user info and settings actions.

- [ ] **Step 2: Run test to verify it fails**
  `bun run test:unit tests/unit/mobile/modules-views.spec.ts`

- [ ] **Step 3: Implement `BooksShelfView.vue` and `BookReaderMobileView.vue`**
  Touch-optimized reading views with 4px card styling and progress lines.

- [ ] **Step 4: Implement `DebateHallView.vue`, `MessagesMobileView.vue`, `StudioMobileView.vue`, and `ProfileMobileView.vue`**
  Mobile-specific implementations designed for smartphone touch interactions.

- [ ] **Step 5: Run tests and verify**
  `bun run test:unit tests/unit/mobile/modules-views.spec.ts`
  `bun run type-check`

- [ ] **Step 6: Commit**
  `git commit -m "feat(mobile): implement independent books, debate, messages, studio, and profile views"`

---

### Task 6: Route Decoupling, Cleanup & Production Build Verification

**Files:**
- Modify: `apps/mobile/mobileRoutes.ts`
- Modify: `apps/mobile/mobileInitialRoutes.ts`
- Modify: `tests/unit/mobile/mobile-app.contract.spec.ts`
- Delete/Clean: obsolete legacy CSS or orphaned files in `apps/mobile/`

**Interfaces:**
- `mobileRoutes`: Now maps all mobile paths strictly to `apps/mobile/views/...` without importing `src/views/`.

- [ ] **Step 1: Update `mobileRoutes.ts` to map to `apps/mobile/views/`**
  Replace all `() => import('@/views/...')` with `() => import('@mobile/views/...')`.

- [ ] **Step 2: Update contract tests in `tests/unit/mobile/mobile-app.contract.spec.ts`**
  Ensure all route contracts reflect the independent architecture and pass.

- [ ] **Step 3: Run full mobile test suites**
  `bun run test:unit tests/unit/mobile/`
  `bun run test:unit tests/unit/system/Mobile*`

- [ ] **Step 4: Verify type safety across the entire repository**
  `bun run type-check`

- [ ] **Step 5: Verify production mobile build**
  `bun run build:mobile`
  Verify that `dist-mobile/` builds cleanly without bundling unnecessary desktop views.

- [ ] **Step 6: Commit**
  `git commit -m "feat(mobile): decouple mobile routes completely from desktop views and verify production build"`

---
