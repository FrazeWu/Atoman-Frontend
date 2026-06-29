# Media Content Route Prefix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure content module pages generate and resolve `/media/...` URLs for content section and detail navigation.

**Architecture:** Keep `media` as the content module root. Update media page links to use `modulePathUrl('media', ...)`, and add media-scoped detail child routes that reuse the existing podcast episode and video detail views. Do not migrate or remove the standalone podcast/video module routes.

**Tech Stack:** Vue 3, Vue Router 4, TypeScript, Vitest, Bun.

---

### Task 1: Add Failing Route and Link Coverage

**Files:**
- Modify: `Atoman-Frontend/tests/unit/router/routes.spec.ts`
- Modify: `Atoman-Frontend/tests/unit/views/media/MediaHomeView.spec.ts`
- Modify: `Atoman-Frontend/tests/unit/views/media/MediaContentViews.spec.ts`

- [ ] Update media homepage tests to expect `/media/articles`, `/media/podcasts`, and `/media/videos`.
- [ ] Update media list tests to expect `/media/videos/watch/:id` and `/media/podcasts/episode/:id`.
- [ ] Add a router test that media module children include `podcasts/episode/:id` and `videos/watch/:id`.
- [ ] Run `bun vitest run tests/unit/router/routes.spec.ts tests/unit/views/media/MediaHomeView.spec.ts tests/unit/views/media/MediaContentViews.spec.ts` and confirm failures show the missing `/media` behavior.

### Task 2: Implement Scoped Media URLs

**Files:**
- Modify: `Atoman-Frontend/src/router/routes/modules.ts`
- Modify: `Atoman-Frontend/src/views/media/MediaHomeView.vue`
- Modify: `Atoman-Frontend/src/views/media/MediaPodcastsView.vue`
- Modify: `Atoman-Frontend/src/views/media/MediaVideosView.vue`

- [ ] Add media child routes for `podcasts/episode/:id` and `videos/watch/:id`.
- [ ] Change media homepage video detail links to `modulePathUrl('media', ...)`.
- [ ] Change media podcast and video list detail links to `modulePathUrl('media', ...)`.
- [ ] Change media list "返回创作" links to `modulePathUrl('media', '/create')`.
- [ ] Re-run focused Vitest command.
- [ ] Run `bun run type-check`.
