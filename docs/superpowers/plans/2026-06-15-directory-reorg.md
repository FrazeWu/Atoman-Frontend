# Directory Reorganization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move root-level source and unit-test files into clearer low-risk directories while preserving runtime behavior, route URLs, and public APIs.

**Architecture:** Keep the existing Vue/Vite technical-layer structure. Move only files with clear ownership: module-owned files stay in their module folders, and non-module files move to `system/`; update imports and lazy routes after each move batch.

**Tech Stack:** Vue 3, Vite, TypeScript, Pinia, Vue Router, Vitest, Playwright, Bun.

---

## File Structure

### Create Directories

- `src/components/system/` — app shell components that are not owned by a business module.
- `src/views/portal/` — portal entry views.
- `src/views/system/` — non-module static, fallback, and system views.
- `tests/unit/system/` — cross-module shell, room-name, layering, and contract tests.
- `tests/unit/components/music/` — music component unit tests currently flat at `tests/unit`.
- `tests/unit/views/kanbo/` — Media view unit tests currently flat at `tests/unit`.
- `tests/unit/views/music/` — music view unit tests currently flat at `tests/unit`.

### Move Source Files

- `src/components/AppTopbar.vue` -> `src/components/system/AppTopbar.vue`
- `src/components/AppTopbarAuthControls.vue` -> `src/components/system/AppTopbarAuthControls.vue`
- `src/components/SiteFooter.vue` -> `src/components/system/SiteFooter.vue`
- `src/components/AudioPlayer.vue` -> `src/components/music/AudioPlayer.vue`
- `src/views/HomeView.vue` -> `src/views/portal/HomeView.vue`
- `src/views/PortalView.vue` -> `src/views/portal/PortalView.vue`
- `src/views/LoginView.vue` -> `src/views/auth/LoginView.vue` if the source file still exists; if only `src/views/auth/LoginView.vue` exists, leave it unchanged.
- `src/views/AboutView.vue` -> `src/views/system/AboutView.vue`
- `src/views/PrivacyView.vue` -> `src/views/system/PrivacyView.vue`
- `src/views/TermsView.vue` -> `src/views/system/TermsView.vue`
- `src/views/NotFoundView.vue` -> `src/views/system/NotFoundView.vue`
- `src/views/UnknownSiteView.vue` -> `src/views/system/UnknownSiteView.vue`
- `src/views/ModuleUnavailableView.vue` -> `src/views/system/ModuleUnavailableView.vue`

### Move Root-Level Unit Tests

- `tests/unit/AppTopbar.kanbo.spec.ts` -> `tests/unit/system/AppTopbar.kanbo.spec.ts`
- `tests/unit/AppTopbar.roomNames.spec.ts` -> `tests/unit/system/AppTopbar.roomNames.spec.ts`
- `tests/unit/FirstLoginOnboarding.media.spec.ts` -> `tests/unit/system/FirstLoginOnboarding.media.spec.ts`
- `tests/unit/MusicHomeRoomName.spec.ts` -> `tests/unit/system/MusicHomeRoomName.spec.ts`
- `tests/unit/SidebarRoomNames.spec.ts` -> `tests/unit/system/SidebarRoomNames.spec.ts`
- `tests/unit/blog-layering.spec.ts` -> `tests/unit/system/blog-layering.spec.ts`
- `tests/unit/feed-layering.spec.ts` -> `tests/unit/system/feed-layering.spec.ts`
- `tests/unit/layering-contract.spec.ts` -> `tests/unit/system/layering-contract.spec.ts`
- `tests/unit/layering-imports.spec.ts` -> `tests/unit/system/layering-imports.spec.ts`
- `tests/unit/moduleRooms.media.spec.ts` -> `tests/unit/system/moduleRooms.media.spec.ts`
- `tests/unit/moduleRooms.spec.ts` -> `tests/unit/system/moduleRooms.spec.ts`
- `tests/unit/NestedActionDrawer.spec.ts` -> `tests/unit/components/music/NestedActionDrawer.spec.ts`
- `tests/unit/PaperSheet.spec.ts` -> `tests/unit/system/PaperSheet.spec.ts`
- `tests/unit/SiteFooter.spec.ts` -> `tests/unit/system/SiteFooter.spec.ts`
- `tests/unit/AlbumDrawer.spec.ts` -> `tests/unit/components/music/AlbumDrawer.spec.ts`
- `tests/unit/ArtistDrawer.spec.ts` -> `tests/unit/components/music/ArtistDrawer.spec.ts`
- `tests/unit/MediaCollectionWorkspace.spec.ts` -> `tests/unit/views/kanbo/MediaCollectionWorkspace.spec.ts`
- `tests/unit/MediaContentViews.spec.ts` -> `tests/unit/views/kanbo/MediaContentViews.spec.ts`
- `tests/unit/MediaCreateView.spec.ts` -> `tests/unit/views/kanbo/MediaCreateView.spec.ts`
- `tests/unit/MediaGlobalViews.spec.ts` -> `tests/unit/views/kanbo/MediaGlobalViews.spec.ts`
- `tests/unit/MediaLayout.spec.ts` -> `tests/unit/views/kanbo/MediaLayout.spec.ts`
- `tests/unit/MediaOverviewSections.spec.ts` -> `tests/unit/views/kanbo/MediaOverviewSections.spec.ts`
- `tests/unit/MusicHomeView.spec.ts` -> `tests/unit/views/music/MusicHomeView.spec.ts`
- `tests/unit/MusicLayout.spec.ts` -> `tests/unit/views/music/MusicLayout.spec.ts`
- `tests/unit/useMediaChannelReset.spec.ts` -> `tests/unit/composables/useMediaChannelReset.spec.ts`
- `tests/unit/useMediaCollections.spec.ts` -> `tests/unit/composables/useMediaCollections.spec.ts`
- `tests/unit/useMediaOverview.api.spec.ts` -> `tests/unit/composables/useMediaOverview.api.spec.ts`
- `tests/unit/media-routing.spec.ts` -> `tests/unit/router/media-routing.spec.ts`
- `tests/unit/musicRoutes.spec.ts` -> `tests/unit/router/musicRoutes.spec.ts`

## Task 1: Capture Baseline and Protect Existing Work

**Files:**
- Inspect only: repository status and relevant file list.

- [ ] **Step 1: Record current git state**

Run:

```bash
git status --short
```

Expected: shows the pre-existing modified files plus the new spec/plan files. Do not discard, restore, reset, or clean anything.

- [ ] **Step 2: Confirm all source move inputs exist or note existing destination**

Run:

```bash
for file in \
  src/components/AppTopbar.vue \
  src/components/AppTopbarAuthControls.vue \
  src/components/SiteFooter.vue \
  src/components/AudioPlayer.vue \
  src/views/HomeView.vue \
  src/views/PortalView.vue \
  src/views/AboutView.vue \
  src/views/PrivacyView.vue \
  src/views/TermsView.vue \
  src/views/NotFoundView.vue \
  src/views/UnknownSiteView.vue \
  src/views/ModuleUnavailableView.vue; do \
  test -f "$file" && printf 'OK %s\n' "$file" || printf 'MISSING %s\n' "$file"; \
done
```

Expected: each listed file is `OK` except files already moved in the current working tree. If `src/views/LoginView.vue` is missing but `src/views/auth/LoginView.vue` exists, that is expected and no move is needed for login.

- [ ] **Step 3: Confirm all root-level test move inputs exist**

Run:

```bash
for file in \
  tests/unit/AlbumDrawer.spec.ts \
  tests/unit/AppTopbar.kanbo.spec.ts \
  tests/unit/AppTopbar.roomNames.spec.ts \
  tests/unit/ArtistDrawer.spec.ts \
  tests/unit/FirstLoginOnboarding.media.spec.ts \
  tests/unit/MediaCollectionWorkspace.spec.ts \
  tests/unit/MediaContentViews.spec.ts \
  tests/unit/MediaCreateView.spec.ts \
  tests/unit/MediaGlobalViews.spec.ts \
  tests/unit/MediaLayout.spec.ts \
  tests/unit/MediaOverviewSections.spec.ts \
  tests/unit/MusicHomeRoomName.spec.ts \
  tests/unit/MusicHomeView.spec.ts \
  tests/unit/MusicLayout.spec.ts \
  tests/unit/NestedActionDrawer.spec.ts \
  tests/unit/PaperSheet.spec.ts \
  tests/unit/SidebarRoomNames.spec.ts \
  tests/unit/SiteFooter.spec.ts \
  tests/unit/blog-layering.spec.ts \
  tests/unit/feed-layering.spec.ts \
  tests/unit/media-routing.spec.ts \
  tests/unit/layering-contract.spec.ts \
  tests/unit/layering-imports.spec.ts \
  tests/unit/moduleRooms.media.spec.ts \
  tests/unit/moduleRooms.spec.ts \
  tests/unit/useMediaChannelReset.spec.ts \
  tests/unit/useMediaCollections.spec.ts \
  tests/unit/useMediaOverview.api.spec.ts; do \
  test -f "$file" && printf 'OK %s\n' "$file" || printf 'MISSING %s\n' "$file"; \
done
```

Expected: each listed test is `OK` before migration. Stop and inspect if any expected file is missing.

## Task 2: Move Source Files

**Files:**
- Create directories: `src/components/system/`, `src/views/portal/`, `src/views/system/`
- Move source files listed in the File Structure section.

- [ ] **Step 1: Create destination directories**

Run:

```bash
mkdir -p src/components/system src/views/portal src/views/system src/components/music src/views/auth
```

Expected: command exits with status 0.

- [ ] **Step 2: Move global components**

Run:

```bash
mv src/components/AppTopbar.vue src/components/system/AppTopbar.vue
mv src/components/AppTopbarAuthControls.vue src/components/system/AppTopbarAuthControls.vue
mv src/components/SiteFooter.vue src/components/system/SiteFooter.vue
mv src/components/AudioPlayer.vue src/components/music/AudioPlayer.vue
```

Expected: files no longer exist at the root of `src/components/`, and exist at the destination paths.

- [ ] **Step 3: Move portal and system views**

Run:

```bash
mv src/views/HomeView.vue src/views/portal/HomeView.vue
mv src/views/PortalView.vue src/views/portal/PortalView.vue
mv src/views/AboutView.vue src/views/system/AboutView.vue
mv src/views/PrivacyView.vue src/views/system/PrivacyView.vue
mv src/views/TermsView.vue src/views/system/TermsView.vue
mv src/views/NotFoundView.vue src/views/system/NotFoundView.vue
mv src/views/UnknownSiteView.vue src/views/system/UnknownSiteView.vue
mv src/views/ModuleUnavailableView.vue src/views/system/ModuleUnavailableView.vue
```

Expected: moved files exist under `src/views/portal/` or `src/views/system/`.

- [ ] **Step 4: Move root login view only if needed**

Run:

```bash
if test -f src/views/LoginView.vue; then mv src/views/LoginView.vue src/views/auth/LoginView.vue; fi
```

Expected: `src/views/auth/LoginView.vue` exists.

## Task 3: Update Source Imports and Router Paths

**Files:**
- Modify: `src/App.vue`
- Modify: `src/router/routes/*.ts`
- Modify: any component/view importing moved files

- [ ] **Step 1: Find stale source imports**

Run:

```bash
grep -R "@/components/\(AppTopbar\|AppTopbarAuthControls\|SiteFooter\|AudioPlayer\)\|@/views/\(HomeView\|PortalView\|AboutView\|PrivacyView\|TermsView\|NotFoundView\|UnknownSiteView\|ModuleUnavailableView\|LoginView\)" src tests -n
```

Expected: prints every stale import or lazy import that still points to an old root-level path.

- [ ] **Step 2: Update component imports with exact replacements**

Apply these replacements wherever found:

```text
@/components/AppTopbar.vue -> @/components/system/AppTopbar.vue
@/components/AppTopbarAuthControls.vue -> @/components/system/AppTopbarAuthControls.vue
@/components/SiteFooter.vue -> @/components/system/SiteFooter.vue
@/components/AudioPlayer.vue -> @/components/music/AudioPlayer.vue
@/components/AppTopbar -> @/components/system/AppTopbar
@/components/AppTopbarAuthControls -> @/components/system/AppTopbarAuthControls
@/components/SiteFooter -> @/components/system/SiteFooter
@/components/AudioPlayer -> @/components/music/AudioPlayer
```

Expected: no imports in `src` or `tests` reference the old component root paths.

- [ ] **Step 3: Update view imports with exact replacements**

Apply these replacements wherever found:

```text
@/views/HomeView.vue -> @/views/portal/HomeView.vue
@/views/PortalView.vue -> @/views/portal/PortalView.vue
@/views/LoginView.vue -> @/views/auth/LoginView.vue
@/views/AboutView.vue -> @/views/system/AboutView.vue
@/views/PrivacyView.vue -> @/views/system/PrivacyView.vue
@/views/TermsView.vue -> @/views/system/TermsView.vue
@/views/NotFoundView.vue -> @/views/system/NotFoundView.vue
@/views/UnknownSiteView.vue -> @/views/system/UnknownSiteView.vue
@/views/ModuleUnavailableView.vue -> @/views/system/ModuleUnavailableView.vue
@/views/HomeView -> @/views/portal/HomeView
@/views/PortalView -> @/views/portal/PortalView
@/views/LoginView -> @/views/auth/LoginView
@/views/AboutView -> @/views/system/AboutView
@/views/PrivacyView -> @/views/system/PrivacyView
@/views/TermsView -> @/views/system/TermsView
@/views/NotFoundView -> @/views/system/NotFoundView
@/views/UnknownSiteView -> @/views/system/UnknownSiteView
@/views/ModuleUnavailableView -> @/views/system/ModuleUnavailableView
```

Expected: route URLs and route names remain unchanged; only import paths change.

- [ ] **Step 4: Re-run stale source import search**

Run:

```bash
grep -R "@/components/\(AppTopbar\|AppTopbarAuthControls\|SiteFooter\|AudioPlayer\)\|@/views/\(HomeView\|PortalView\|AboutView\|PrivacyView\|TermsView\|NotFoundView\|UnknownSiteView\|ModuleUnavailableView\|LoginView\)" src tests -n || true
```

Expected: no output for moved root-level paths. Matches under the new destination paths are acceptable only if they include `/system/`, `/music/`, `/portal/`, or `/auth/`.

## Task 4: Move Root-Level Unit Tests

**Files:**
- Create directories: `tests/unit/system/`, `tests/unit/components/music/`, `tests/unit/views/kanbo/`, `tests/unit/views/music/`
- Move root-level test files listed in the File Structure section.

- [ ] **Step 1: Create destination directories**

Run:

```bash
mkdir -p tests/unit/system tests/unit/components/music tests/unit/views/kanbo tests/unit/views/music tests/unit/composables tests/unit/router
```

Expected: command exits with status 0.

- [ ] **Step 2: Move system tests**

Run:

```bash
mv tests/unit/AppTopbar.kanbo.spec.ts tests/unit/system/AppTopbar.kanbo.spec.ts
mv tests/unit/AppTopbar.roomNames.spec.ts tests/unit/system/AppTopbar.roomNames.spec.ts
mv tests/unit/FirstLoginOnboarding.media.spec.ts tests/unit/system/FirstLoginOnboarding.media.spec.ts
mv tests/unit/MusicHomeRoomName.spec.ts tests/unit/system/MusicHomeRoomName.spec.ts
mv tests/unit/SidebarRoomNames.spec.ts tests/unit/system/SidebarRoomNames.spec.ts
mv tests/unit/blog-layering.spec.ts tests/unit/system/blog-layering.spec.ts
mv tests/unit/feed-layering.spec.ts tests/unit/system/feed-layering.spec.ts
mv tests/unit/layering-contract.spec.ts tests/unit/system/layering-contract.spec.ts
mv tests/unit/layering-imports.spec.ts tests/unit/system/layering-imports.spec.ts
mv tests/unit/moduleRooms.media.spec.ts tests/unit/system/moduleRooms.media.spec.ts
mv tests/unit/moduleRooms.spec.ts tests/unit/system/moduleRooms.spec.ts
mv tests/unit/PaperSheet.spec.ts tests/unit/system/PaperSheet.spec.ts
mv tests/unit/SiteFooter.spec.ts tests/unit/system/SiteFooter.spec.ts
```

Expected: these tests no longer exist at `tests/unit/` root and exist under `tests/unit/system/`.

- [ ] **Step 3: Move music component tests**

Run:

```bash
mv tests/unit/AlbumDrawer.spec.ts tests/unit/components/music/AlbumDrawer.spec.ts
mv tests/unit/ArtistDrawer.spec.ts tests/unit/components/music/ArtistDrawer.spec.ts
mv tests/unit/NestedActionDrawer.spec.ts tests/unit/components/music/NestedActionDrawer.spec.ts
```

Expected: these tests exist under `tests/unit/components/music/`.

- [ ] **Step 4: Move Media view tests**

Run:

```bash
mv tests/unit/MediaCollectionWorkspace.spec.ts tests/unit/views/kanbo/MediaCollectionWorkspace.spec.ts
mv tests/unit/MediaContentViews.spec.ts tests/unit/views/kanbo/MediaContentViews.spec.ts
mv tests/unit/MediaCreateView.spec.ts tests/unit/views/kanbo/MediaCreateView.spec.ts
mv tests/unit/MediaGlobalViews.spec.ts tests/unit/views/kanbo/MediaGlobalViews.spec.ts
mv tests/unit/MediaLayout.spec.ts tests/unit/views/kanbo/MediaLayout.spec.ts
mv tests/unit/MediaOverviewSections.spec.ts tests/unit/views/kanbo/MediaOverviewSections.spec.ts
```

Expected: these tests exist under `tests/unit/views/kanbo/`.

- [ ] **Step 5: Move music view tests**

Run:

```bash
mv tests/unit/MusicHomeView.spec.ts tests/unit/views/music/MusicHomeView.spec.ts
mv tests/unit/MusicLayout.spec.ts tests/unit/views/music/MusicLayout.spec.ts
```

Expected: these tests exist under `tests/unit/views/music/`.

- [ ] **Step 6: Move composable and router tests**

Run:

```bash
mv tests/unit/useMediaChannelReset.spec.ts tests/unit/composables/useMediaChannelReset.spec.ts
mv tests/unit/useMediaCollections.spec.ts tests/unit/composables/useMediaCollections.spec.ts
mv tests/unit/useMediaOverview.api.spec.ts tests/unit/composables/useMediaOverview.api.spec.ts
mv tests/unit/media-routing.spec.ts tests/unit/router/media-routing.spec.ts
```

Expected: these tests exist in their target directories.

## Task 5: Update Relative Paths Inside Moved Tests

**Files:**
- Modify moved tests that use `__dirname`, `../../src`, fixtures, or relative imports.

- [ ] **Step 1: Find moved tests with relative filesystem paths**

Run:

```bash
grep -R "\.\./\.\./src\|\.\./\.\./\.\./src\|__dirname\|from '\.\.|from \"\." tests/unit/system tests/unit/components/music tests/unit/views/kanbo tests/unit/views/music tests/unit/composables tests/unit/router -n
```

Expected: prints tests that need path-depth review.

- [ ] **Step 2: Update `readFileSync(resolve(__dirname, ...))` paths after moving tests**

Use these path-depth rules:

```text
From tests/unit/system/*.spec.ts to src/...            use ../../../src/...
From tests/unit/components/music/*.spec.ts to src/...  use ../../../../src/...
From tests/unit/views/kanbo/*.spec.ts to src/...       use ../../../../src/...
From tests/unit/views/music/*.spec.ts to src/...       use ../../../../src/...
From tests/unit/composables/*.spec.ts to src/...       use ../../../src/...
From tests/unit/router/*.spec.ts to src/...            use ../../../src/...
```

Example before moving `tests/unit/MediaLayout.spec.ts`:

```ts
const layoutSource = readFileSync(resolve(__dirname, '../../src/views/media/MediaLayout.vue'), 'utf8')
```

After moving to `tests/unit/views/kanbo/MediaLayout.spec.ts`:

```ts
const layoutSource = readFileSync(resolve(__dirname, '../../../../src/views/media/MediaLayout.vue'), 'utf8')
```

Expected: every filesystem path from a moved test points to the same source file as before the move.

- [ ] **Step 3: Keep alias imports unchanged unless the imported file moved**

Alias imports such as this should remain unchanged when the target file did not move:

```ts
import AlbumDrawer from '@/components/music/AlbumDrawer.vue'
import HomeView from '@/views/music/HomeView.vue'
import { useMediaOverview } from '@/composables/useMediaOverview'
```

Alias imports to moved files must use the new paths from Task 3.

- [ ] **Step 4: Re-run path-depth search**

Run:

```bash
grep -R "\.\./\.\./src\|\.\./\.\./\.\./src\|__dirname" tests/unit/system tests/unit/components/music tests/unit/views/kanbo tests/unit/views/music tests/unit/composables tests/unit/router -n
```

Expected: any remaining matches are intentional and point to valid files at the correct relative depth.

## Task 6: Verify Static Imports and TypeScript

**Files:**
- Modify any file reported by TypeScript or import searches.

- [ ] **Step 1: Search for old moved file paths**

Run:

```bash
grep -R "src/components/AppTopbar.vue\|src/components/AppTopbarAuthControls.vue\|src/components/SiteFooter.vue\|src/components/AudioPlayer.vue\|src/views/HomeView.vue\|src/views/PortalView.vue\|src/views/AboutView.vue\|src/views/PrivacyView.vue\|src/views/TermsView.vue\|src/views/NotFoundView.vue\|src/views/UnknownSiteView.vue\|src/views/ModuleUnavailableView.vue" src tests -n || true
```

Expected: no output.

- [ ] **Step 2: Run type check**

Run:

```bash
bun run type-check
```

Expected: exits 0. If it fails with a missing module, update that import to the new path and rerun.

## Task 7: Run Unit Tests and Fix Path Fallout

**Files:**
- Modify only import/path fallout reported by Vitest.

- [ ] **Step 1: Run unit tests**

Run:

```bash
bun run test:unit
```

Expected: exits 0. If it fails because a moved test cannot find a source file, fix only that path and rerun.

- [ ] **Step 2: Confirm root-level unit test cleanup**

Run:

```bash
find tests/unit -maxdepth 1 -type f -name '*.spec.ts' | sort
```

Expected: no output, or only intentionally retained root-level tests if a file was explicitly exempted during implementation.

## Task 8: Browser Smoke Check for Moved Shell and Routes

**Files:**
- No intended edits unless browser smoke check reveals import/runtime fallout.

- [ ] **Step 1: Start the dev server**

Run:

```bash
bun run dev
```

Expected: Vite starts on the configured port, usually `http://localhost:5173`.

- [ ] **Step 2: Open the app in a browser and check shell render**

Use the project browser QA tooling to open the local app.

Expected:

```text
- Portal or home page renders.
- Topbar renders.
- Footer renders where expected.
- No console error mentions missing AppTopbar, SiteFooter, HomeView, PortalView, or system views.
```

- [ ] **Step 3: Check representative routes**

Open these route categories using whatever local host routing is already configured:

```text
- Portal/home route
- Auth/login route
- One module route, such as music or feed
- A not-found/fallback route
```

Expected: pages render with the same behavior as before the move.

## Task 9: Final Review and Optional Commit

**Files:**
- Inspect: all changed files.
- Commit: only if the user explicitly asks to create a commit.

- [ ] **Step 1: Review changed files**

Run:

```bash
git status --short
```

Expected: moved files appear as deletes/adds or renames; no unrelated generated files were added by the reorganization.

- [ ] **Step 2: Review diff for accidental behavior changes**

Run:

```bash
git diff -- src tests docs/superpowers/specs/2026-06-15-directory-reorg-design.md docs/superpowers/plans/2026-06-15-directory-reorg.md
```

Expected: source and test diffs are path/import changes only. No route URLs, component APIs, store logic, or visual behavior changed.

- [ ] **Step 3: Commit only after explicit user approval**

If and only if the user explicitly asks to commit, use a new commit and include only relevant files:

```bash
git add docs/superpowers/specs/2026-06-15-directory-reorg-design.md docs/superpowers/plans/2026-06-15-directory-reorg.md src tests
git commit -m "$(cat <<'EOF'
Reorganize source and unit test directories.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds. Do not push unless the user explicitly asks.

## Self-Review

- Spec coverage: covered source component moves, view moves, unit test moves, import/router updates, and verification commands from the design spec.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation steps remain.
- Scope check: the plan preserves the existing technical-layer architecture and does not introduce `features/`.
- Safety check: commit is included only as an explicit-approval step because the current session has not requested a commit.
