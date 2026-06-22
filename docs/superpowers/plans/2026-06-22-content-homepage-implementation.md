# Content Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reader-first content homepage for the content module root that shows a featured hero band and latest article, podcast, and video sections.

**Architecture:** Add a new dedicated `MediaHomeView` at the content module root instead of redirecting to `/articles`. Keep the existing article, podcast, video, and create pages intact, and fetch homepage data from the existing public split APIs so the homepage is a composition layer rather than a new backend contract.

**Tech Stack:** Vue 3, Vue Router, Vitest, existing Atoman frontend UI components and composables

---

### Task 1: Lock the Root Route Behavior

**Files:**
- Modify: `tests/unit/router/routes.spec.ts`
- Modify: `src/router/routes/modules.ts`

- [ ] Add a failing route-table assertion that the content root child route renders a homepage component instead of redirecting to `/articles`.
- [ ] Run `bun vitest run tests/unit/router/routes.spec.ts` and verify it fails on the old redirect.
- [ ] Replace the content root redirect with a dedicated homepage component route.
- [ ] Re-run `bun vitest run tests/unit/router/routes.spec.ts` and verify it passes.

### Task 2: Build the Homepage View

**Files:**
- Create: `src/views/media/MediaHomeView.vue`
- Create: `tests/unit/views/kanbo/MediaHomeView.spec.ts`

- [ ] Add a failing homepage view test that expects:
  - a featured area with one primary and two secondary cards
  - article, podcast, and video sections
  - secondary create action without making create the default page
- [ ] Run `bun vitest run tests/unit/views/kanbo/MediaHomeView.spec.ts` and verify it fails because the view does not exist yet.
- [ ] Implement `MediaHomeView.vue` using existing public APIs:
  - article data from `api.blog.explore`
  - podcast data from `api.podcast.episodes`
  - video data from `api.videos.list`
  - featured cards derived from the freshest combined items
  - article cards opening the existing right sheet pattern
  - podcast and video cards linking to their existing detail routes
- [ ] Re-run `bun vitest run tests/unit/views/kanbo/MediaHomeView.spec.ts` and verify it passes.

### Task 3: Protect Existing Content Module Pages

**Files:**
- Modify: `tests/unit/views/kanbo/MediaContentViews.spec.ts`

- [ ] Add or adjust a focused test proving the article, podcast, and video subpages still behave as “view all” destinations while the root now serves the new homepage.
- [ ] Run `bun vitest run tests/unit/views/kanbo/MediaContentViews.spec.ts` and verify it fails only if the new root behavior is not reflected.
- [ ] Apply the minimal test fixture updates needed for the new homepage-aware structure.
- [ ] Re-run `bun vitest run tests/unit/views/kanbo/MediaContentViews.spec.ts` and verify it passes.

### Task 4: Verify the Full Homepage Slice

**Files:**
- Modify: `docs/superpowers/specs/2026-06-22-content-homepage-design.md` only if implementation reveals a necessary naming or scope clarification

- [ ] Run `bun vitest run tests/unit/router/routes.spec.ts tests/unit/views/kanbo/MediaHomeView.spec.ts tests/unit/views/kanbo/MediaContentViews.spec.ts tests/unit/router/media-routing.spec.ts`
- [ ] If a design naming mismatch appears during implementation, make the smallest doc clarification needed.
- [ ] Stop without deploying production changes in this task unless explicitly requested.
