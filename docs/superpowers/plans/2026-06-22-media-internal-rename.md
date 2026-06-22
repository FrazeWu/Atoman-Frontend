# Media Internal Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the content module runtime and primary code semantics from `kanbo` to `media`, making `media` the only canonical module key.

**Architecture:** Change the frontend module key, routing table, site context resolution, URL generation, and feature modules so `media` becomes the canonical runtime key. Rename frontend directories, components, views, composables, and tests to `media` semantics, then update backend defaults, reserved handles, and site-access module keys to match. This plan explicitly removes `kanbo` as a frontend module alias.

**Tech Stack:** Vue 3, Vue Router, TypeScript, Vitest, Go, GORM

---

### Task 1: Switch Frontend Runtime Module Key to `media`

**Files:**
- Modify: `src/config/moduleRooms.ts`
- Modify: `src/config/siteAccess.ts`
- Modify: `src/router/routes/modules.ts`
- Modify: `tests/unit/system/moduleRooms.spec.ts`
- Modify: `tests/unit/system/moduleRooms.media.spec.ts`
- Modify: `tests/unit/router/routes.spec.ts`

- [ ] **Step 1: Write the failing tests**

Update the module-room and route tests so they expect `media` instead of `kanbo` as the canonical runtime key while preserving visible labels as “内容”.

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun vitest run tests/unit/system/moduleRooms.spec.ts tests/unit/system/moduleRooms.media.spec.ts tests/unit/router/routes.spec.ts`

Expected: FAIL because the runtime key and route tables still use `kanbo`.

- [ ] **Step 3: Write minimal implementation**

Update `ModuleRoomKey`, `moduleRooms`, `moduleNavOrder`, `siteAccessFeatures`, and `moduleRoutes` so the content module uses the `media` key everywhere the frontend treats it as a first-class module.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun vitest run tests/unit/system/moduleRooms.spec.ts tests/unit/system/moduleRooms.media.spec.ts tests/unit/router/routes.spec.ts`

Expected: PASS

### Task 2: Make Frontend Context and URL Generation `media`-only

**Files:**
- Modify: `src/router/siteContext.ts`
- Modify: `src/router/siteUrls.ts`
- Modify: `tests/unit/router/siteContext.spec.ts`
- Modify: `tests/unit/router/siteUrls.spec.ts`
- Modify: `tests/unit/router/media-routing.spec.ts`
- Modify: `tests/unit/components/AppTopbarAuthControls.spec.ts`

- [ ] **Step 1: Write the failing assertions**

Adjust tests so:

1. `media.atoman.org` resolves to `media`
2. `?site=media` resolves to `media`
3. generated module URLs for `media` produce `media.atoman.org`
4. `kanbo.atoman.org` and `?site=kanbo` are no longer treated as the content module

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun vitest run tests/unit/router/siteContext.spec.ts tests/unit/router/siteUrls.spec.ts tests/unit/router/media-routing.spec.ts tests/unit/components/AppTopbarAuthControls.spec.ts`

Expected: FAIL because `kanbo` is still the frontend module key and alias.

- [ ] **Step 3: Write minimal implementation**

Implement context resolution and URL generation so:

1. canonical runtime module = `media`
2. public hostname label = `media`
3. old `kanbo` parsing no longer resolves to the content module

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun vitest run tests/unit/router/siteContext.spec.ts tests/unit/router/siteUrls.spec.ts tests/unit/router/media-routing.spec.ts tests/unit/components/AppTopbarAuthControls.spec.ts`

Expected: PASS

### Task 3: Rename Frontend Views, Components, and Composables to `media`

**Files:**
- Move/rename: `src/views/media/*` -> `src/views/media/*`
- Move/rename: `src/components/media/*` -> `src/components/media/*`
- Rename: `src/composables/useMediaChannel.ts` -> `src/composables/useMediaChannel.ts`
- Rename: `src/composables/useMediaCollections.ts` -> `src/composables/useMediaCollections.ts`
- Rename: `src/composables/useMediaOverview.ts` -> `src/composables/useMediaOverview.ts`
- Update all imports under `src/` and `tests/`
- Move/rename: `tests/unit/views/kanbo/*` -> `tests/unit/views/media/*`

- [ ] **Step 1: Write the failing view/composable tests**

Update the relevant imports and suite descriptions so they expect `Media*` names and `views/media` / `components/media` paths.

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun vitest run tests/unit/views/kanbo/MediaHomeView.spec.ts tests/unit/views/kanbo/MediaContentViews.spec.ts tests/unit/views/kanbo/MediaCreateView.spec.ts tests/unit/composables/useMediaOverview.api.spec.ts tests/unit/composables/useMediaChannelReset.spec.ts`

Expected: FAIL because the renamed files and symbols do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Rename the files, exported symbols, and imports so the primary code names become:

1. `MediaHomeView`
2. `MediaArticlesView`
3. `MediaPodcastsView`
4. `MediaVideosView`
5. `MediaLayout`
6. `useMediaChannel`
7. `useMediaCollections`
8. `useMediaOverview`

Keep behavior unchanged except for the naming shift.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun vitest run tests/unit/views/media/MediaHomeView.spec.ts tests/unit/views/media/MediaContentViews.spec.ts tests/unit/views/media/MediaCreateView.spec.ts tests/unit/composables/useMediaOverview.api.spec.ts tests/unit/composables/useMediaChannelReset.spec.ts`

Expected: PASS

### Task 4: Rename Frontend Call Sites and Navigation Helpers

**Files:**
- Modify: `src/composables/useResponsiveShell.ts`
- Modify: `src/composables/useSubdomainNav.ts`
- Modify: `src/components/system/AppTopbar.vue`
- Modify: `src/components/system/MobileBottomNav.vue`
- Modify: `src/components/system/AppTopbarAuthControls.vue`
- Modify related tests under `tests/unit/system/` and `tests/unit/components/`

- [ ] **Step 1: Write the failing navigation tests**

Update topbar, responsive-shell, and mobile-nav tests so they expect `media` as the canonical module key and `media` URLs as the only content-module output.

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun vitest run tests/unit/system/MobileBottomNav.spec.ts tests/unit/system/AppTopbar.roomNames.spec.ts tests/unit/components/AppTopbarAuthControls.spec.ts`

Expected: FAIL because callers still reference `kanbo`.

- [ ] **Step 3: Write minimal implementation**

Replace primary call-site references to `kanbo` with `media`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun vitest run tests/unit/system/MobileBottomNav.spec.ts tests/unit/system/AppTopbar.roomNames.spec.ts tests/unit/components/AppTopbarAuthControls.spec.ts`

Expected: PASS

### Task 5: Rename Backend Module Key to `media`

**Files:**
- Modify: `Atoman-Backend/internal/service/site_access.go`
- Modify: `Atoman-Backend/internal/service/site_access_test.go`
- Modify: `Atoman-Backend/internal/platform/sitehandle/site_namespace.go`
- Modify: `Atoman-Backend/internal/service/site_namespace_test.go`

- [ ] **Step 1: Write the failing backend tests**

Update backend tests so they expect:

1. `media` as the canonical site-access module key
2. `media` reserved as the canonical module/hostname key
3. `kanbo` reserved only as a blocked historical handle, not as the canonical module key

- [ ] **Step 2: Run tests to verify they fail**

Run: `go test ./internal/service/... ./internal/platform/sitehandle/...`

Expected: FAIL because backend defaults still use `kanbo` as the primary module key.

- [ ] **Step 3: Write minimal implementation**

Change backend defaults and validators so:

1. canonical site-access module key = `media`
2. `media` is the canonical reserved module key
3. `kanbo` remains blocked as a historical reserved handle, but not as the canonical module identity

- [ ] **Step 4: Run tests to verify they pass**

Run: `go test ./internal/service/... ./internal/platform/sitehandle/...`

Expected: PASS

### Task 6: End-to-End Verification of the Rename Slice

**Files:**
- No new files required beyond fixes discovered during verification

- [ ] **Step 1: Run the frontend rename slice**

Run: `bun vitest run tests/unit/router/routes.spec.ts tests/unit/router/siteContext.spec.ts tests/unit/router/siteUrls.spec.ts tests/unit/router/media-routing.spec.ts tests/unit/system/moduleRooms.spec.ts tests/unit/system/moduleRooms.media.spec.ts tests/unit/system/MobileBottomNav.spec.ts tests/unit/components/AppTopbarAuthControls.spec.ts tests/unit/views/media/MediaHomeView.spec.ts tests/unit/views/media/MediaContentViews.spec.ts tests/unit/views/media/MediaCreateView.spec.ts tests/unit/composables/useMediaOverview.api.spec.ts`

Expected: PASS

- [ ] **Step 2: Run the backend rename slice**

Run: `go test ./internal/service/... ./internal/platform/sitehandle/...`

Expected: PASS

- [ ] **Step 3: Verify runtime behavior locally**

Run browser or Playwright checks against:

1. `media.atoman.org`
2. local `?site=media`

Expected:

1. both land in the media module
2. generated links use `media.atoman.org`
3. `kanbo.atoman.org` and `?site=kanbo` no longer resolve as the content module

- [ ] **Step 4: Stop before historical cleanup**

Do not start stage B in this plan. Historical doc and review cleanup is explicitly out of scope.
