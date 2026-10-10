# Implementation Plan: Studio, Blog, Comment, ShortNote & DM UI Redesign (Pure-White Double-Notch Minimal System)

## Proposed Changes

Migrate all remaining components and views across Blog, Studio, Comment, Content/ShortNote, and Search/DM modules to the Pure-White Double-Notch Minimal System.

---

### Task 1: Comment, Content, Search, DM & ShortNote Components Refactor

**Files:**
- Modify: `src/components/comment/CommentComposer.vue`
- Modify: `src/components/comment/CommentItem.vue`
- Modify: `src/components/comment/CommentReportDialog.vue`
- Modify: `src/components/comment/CommentSection.vue`
- Modify: `src/components/comment/CommentThread.vue`
- Modify: `src/components/content/ContentContinueSection.vue`
- Modify: `src/components/content/MyHubPreviewSection.vue`
- Modify: `src/components/search/SearchSurface.vue`
- Modify: `src/components/search/ModuleSearch.vue`
- Modify: `src/components/dm/DMComposer.vue`
- Modify: `src/components/dm/DMSettingsPanel.vue`
- Modify: `src/components/shortnote/ShortNoteCard.vue`
- Modify: `src/components/shortnote/ShortNoteComposer.vue`

- [ ] **Step 1: Polish Comment components**
  - Replace `var(--a-color-accent-destructive)` with `var(--a-color-danger)`.
  - Replace deprecated `outline` with `variant="secondary"` in `CommentReportDialog.vue` and `CommentSection.vue`.
  - Standardize surfaces to `var(--a-color-bg)` in `CommentComposer.vue`, `CommentItem.vue`, `CommentSection.vue`.
  - Standardize typography weights (`500`/`600`).
- [ ] **Step 2: Polish Content, Search & DM components**
  - In `ContentContinueSection.vue` & `MyHubPreviewSection.vue`: set surfaces to `var(--a-color-bg)`, header titles to `font-weight: 500`.
  - In `SearchSurface.vue`: set `.search-frame` and dropdown to `var(--a-color-bg)`, remove `text-transform: uppercase`, clamp weights to 500/600.
  - In `ModuleSearch.vue`: set item title font-weight to 500.
  - In `DMComposer.vue`: set image button surface to `var(--a-color-bg)`.
  - In `DMSettingsPanel.vue`: replace `var(--a-color-accent-destructive)` with `var(--a-color-danger)`.
- [ ] **Step 3: Polish ShortNote components**
  - In `ShortNoteCard.vue`: standardize badges and pill buttons from `999px` to `var(--a-radius-control)` (4px); replace hardcoded hex colors (`#10b981`, `#f59e0b`, `#d97706`, `#ef4444`) with design tokens; clamp font-weights to 600.
  - In `ShortNoteComposer.vue`: remove `backdrop-filter: blur(4px)`; standardize drag and remove buttons from `50%` to `var(--a-radius-control)` (4px).
- [ ] **Step 4: Verify & Commit**
  - Run `bun run type-check`.
  - Commit: `refactor(core): standardize comment, content, search, dm, and shortnote components`

---

### Task 2: Blog Components & Views Refactor

**Files:**
- Modify: `src/components/blog/BlogChannelSheet.vue`
- Modify: `src/components/blog/BlogCollectionSheet.vue`
- Modify: `src/components/blog/BlogEntityCard.vue`
- Modify: `src/components/blog/BlogPostReader.vue`
- Modify: `src/components/blog/BlogRelatedPosts.vue`
- Modify: `src/components/blog/PostCoverField.vue`
- Modify: `src/components/blog/PostEditorFormattingToolbar.vue`
- Modify: `src/components/blog/PostEditorSidebar.vue`
- Modify: `src/components/blog/PostEditorTopbar.vue`
- Modify: `src/components/blog/PostHeader.vue`
- Modify: `src/components/blog/PostPublicationSheet.vue`
- Modify: `src/components/blog/ShortNoteSheet.vue`
- Modify: `src/views/blog/BlogArticlesView.vue`
- Modify: `src/views/blog/BlogHomeView.vue`
- Modify: `src/views/blog/BlogSubscriptionsView.vue`
- Modify: `src/views/blog/BookmarkView.vue`
- Modify: `src/views/blog/ChannelView.vue`
- Modify: `src/views/blog/PostEditorView.vue`
- Modify: `src/views/blog/ProfileView.vue`
- Modify: `src/views/blog/ShortNoteTimelineView.vue`

- [ ] **Step 1: Polish Blog components**
  - Replace `var(--a-color-fg-muted)` with `var(--a-color-muted)` in `BlogPostReader.vue`; remove `#3b82f6` and `#bdbdbd` fallbacks; normalize academic paper styles to tokens.
  - Remove warm paper `#fffdf0` in `PostEditorView.vue` CodeMirror lines, set backgrounds to `var(--a-color-bg)`.
  - Standardize `PostHeader.vue`: remove `box-shadow`s, normalize `12px` and `9999px` to 4px (`var(--a-radius-card)` / `var(--a-radius-control)`), clamp avatar weight to 600.
  - In `ShortNoteSheet.vue`: standardize action button from `50%` to 4px, replace `#fef2f2` with `color-mix(in srgb, var(--a-color-danger) 8%, var(--a-color-bg))`.
  - In `PostCoverField.vue`, `PostEditorSidebar.vue`, `PostEditorTopbar.vue`, `PostPublicationSheet.vue`: set surfaces to `var(--a-color-bg)` and titles to `font-weight: 500`.
- [ ] **Step 2: Polish Blog views**
  - Replace all deprecated `<PButton outline>` with `<PButton variant="secondary">` across `BlogArticlesView.vue`, `BlogHomeView.vue`, `BlogSubscriptionsView.vue`, `BookmarkView.vue`, `ShortNoteTimelineView.vue`.
  - In `ProfileView.vue`: set `.profile-header`, `.profile-channel-card`, `.profile-content-card` backgrounds to `var(--a-color-bg)`; clamp headings to `500`; localize `CHANNELS` -> `频道`, `CONTENT` -> `内容`; replace `var(--a-color-accent-destructive)` with `var(--a-color-danger)`.
  - In `BookmarkView.vue`: replace inline hex `#9ca3af` and `#ef4444` with tokens `var(--a-color-muted)` and `var(--a-color-danger)`.
  - In `ChannelView.vue`: set cover font-weight to 500.
  - In `BlogHomeView.vue` & `ShortNoteTimelineView.vue`: standardize rail headers to `var(--a-color-bg)` and titles to 500.
- [ ] **Step 3: Verify & Commit**
  - Run `bun run type-check`.
  - Commit: `refactor(blog): standardize blog components, views, buttons, surfaces, and typography`

---

### Task 3: Studio Components & Views Refactor

**Files:**
- Modify: `src/components/studio/StudioCollectionManager.vue`
- Modify: `src/components/studio/StudioContentTable.vue`
- Modify: `src/components/studio/StudioDashboardSection.vue`
- Modify: `src/views/studio/StudioAnalyticsView.vue`
- Modify: `src/views/studio/StudioCalendarView.vue`
- Modify: `src/views/studio/StudioChannelView.vue`
- Modify: `src/views/studio/StudioDashboardView.vue`
- Modify: `src/views/studio/StudioGoalsView.vue`
- Modify: `src/views/studio/StudioInteractionsView.vue`

- [ ] **Step 1: Polish Studio components**
  - In `StudioCollectionManager.vue`: remove raw hover shadow; standardize link font-weight to 500.
  - In `StudioContentTable.vue`: change `th` and hover backgrounds from `var(--a-color-surface)` to `var(--a-color-bg)`.
  - In `StudioDashboardSection.vue`: change icon background and hover states to `var(--a-color-bg)`; title font-weight to 500.
- [ ] **Step 2: Polish Studio views**
  - In `StudioChannelView.vue`: remove raw hover shadow; standardize identity badge radius from 999px to 4px.
  - In `StudioGoalsView.vue`: change review prompt and note surfaces to `var(--a-color-bg)`; replace `var(--a-color-accent-destructive)` with `var(--a-color-danger)`.
  - In `StudioInteractionsView.vue`: remove raw hover shadow; standardize pinned badge radius from 999px to 4px.
  - In `StudioAnalyticsView.vue`, `StudioCalendarView.vue`, `StudioDashboardView.vue`: replace `var(--a-color-surface)` hover backgrounds with `var(--a-color-bg)`.
- [ ] **Step 3: Verify & Commit**
  - Run `bun run type-check`.
  - Commit: `refactor(studio): standardize studio components, views, surfaces, badges, and tokens`

---

### Task 4: Whole-Module Integration, Full Test Suite & Branch Review

**Files:**
- All modified files
- Unit & contract test suites

- [ ] **Step 1: Run full type check**
  ```bash
  bun run type-check
  ```
- [ ] **Step 2: Run all unit and contract tests**
  ```bash
  bun run test:unit
  ```
- [ ] **Step 3: Run git diff format check**
  ```bash
  git diff --check
  ```
- [ ] **Step 4: Dispatch whole-branch code review subagent**
- [ ] **Step 5: Merge into main and push to origin**
