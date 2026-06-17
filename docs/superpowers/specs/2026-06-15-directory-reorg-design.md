# Directory Reorganization Design

## Goal

Reorganize the project with the lowest practical risk while making root-level source and unit-test files easier to navigate. The reorganization keeps the existing Vue/Vite technical layering and does not introduce a `features/` architecture.

## Scope

This design covers:

- Moving root-level global Vue components into clearer component subdirectories.
- Moving root-level global/system views into clearer view subdirectories.
- Organizing root-level `tests/unit/*.spec.ts` files into existing or new unit-test categories.
- Updating imports, router lazy imports, and test references affected by file moves.

This design does not cover:

- Moving business modules into `src/features/<domain>/`.
- Changing runtime behavior, route paths, store names, API contracts, or visual design.
- Rewriting tests beyond import/path updates required by moved files.

## Directory Principles

Use a low-risk mapping approach:

1. Keep existing technical layers: `api`, `assets`, `components`, `composables`, `config`, `router`, `stores`, `utils`, and `views`.
2. Keep existing business module folders such as `blog`, `debate`, `feed`, `forum`, `kanbo`, `music`, `podcast`, `setting`, `timeline`, and `video`.
3. Any file that is not clearly owned by one business module goes under `system/`.
4. `HomeView.vue` belongs to `portal/`.
5. `AudioPlayer.vue` belongs to `music/`.
6. Do not add narrow folders such as `legal/`, `app/`, or `player/` for this pass.

## Source Target Layout

### Components

Move global shell components into `src/components/system/`:

```text
src/components/system/
  AppTopbar.vue
  AppTopbarAuthControls.vue
  SiteFooter.vue
```

Move the global audio player into the existing music component area:

```text
src/components/music/
  AudioPlayer.vue
```

Existing business-specific and UI component folders stay in place:

```text
src/components/auth/
src/components/blog/
src/components/debate/
src/components/feed/
src/components/forum/
src/components/kanbo/
src/components/music/
src/components/onboarding/
src/components/podcast/
src/components/setting/
src/components/shared/
src/components/timeline/
src/components/ui/
src/components/video/
```

### Views

Move portal entry views into `src/views/portal/`:

```text
src/views/portal/
  HomeView.vue
  PortalView.vue
```

Move auth view into the existing auth view area:

```text
src/views/auth/
  LoginView.vue
```

Move non-module static, fallback, and system pages into `src/views/system/`:

```text
src/views/system/
  AboutView.vue
  PrivacyView.vue
  TermsView.vue
  NotFoundView.vue
  UnknownSiteView.vue
  ModuleUnavailableView.vue
```

Existing module view folders stay in place:

```text
src/views/blog/
src/views/debate/
src/views/feed/
src/views/forum/
src/views/kanbo/
src/views/music/
src/views/orbit/
src/views/podcast/
src/views/setting/
src/views/timeline/
src/views/video/
```

## Unit Test Target Layout

Use existing test categories where ownership is clear. Use `tests/unit/system/` for cross-module, shell, room-name, layering, and global-contract tests.

```text
tests/unit/api/
tests/unit/app/
tests/unit/components/
tests/unit/composables/
tests/unit/config/
tests/unit/router/
tests/unit/stores/
tests/unit/system/
tests/unit/utils/
tests/unit/views/
```

Suggested root-level test moves:

```text
tests/unit/AppTopbar.kanbo.spec.ts              -> tests/unit/system/AppTopbar.kanbo.spec.ts
tests/unit/AppTopbar.roomNames.spec.ts          -> tests/unit/system/AppTopbar.roomNames.spec.ts
tests/unit/FirstLoginOnboarding.kanbo.spec.ts   -> tests/unit/system/FirstLoginOnboarding.kanbo.spec.ts
tests/unit/MusicHomeRoomName.spec.ts            -> tests/unit/system/MusicHomeRoomName.spec.ts
tests/unit/SidebarRoomNames.spec.ts             -> tests/unit/system/SidebarRoomNames.spec.ts
tests/unit/blog-layering.spec.ts                -> tests/unit/system/blog-layering.spec.ts
tests/unit/feed-layering.spec.ts                -> tests/unit/system/feed-layering.spec.ts
tests/unit/layering-contract.spec.ts            -> tests/unit/system/layering-contract.spec.ts
tests/unit/layering-imports.spec.ts             -> tests/unit/system/layering-imports.spec.ts
tests/unit/moduleRooms.kanbo.spec.ts            -> tests/unit/system/moduleRooms.kanbo.spec.ts
tests/unit/moduleRooms.spec.ts                  -> tests/unit/system/moduleRooms.spec.ts
tests/unit/NestedActionDrawer.spec.ts           -> tests/unit/system/NestedActionDrawer.spec.ts
tests/unit/PaperSheet.spec.ts                   -> tests/unit/system/PaperSheet.spec.ts
tests/unit/SiteFooter.spec.ts                   -> tests/unit/system/SiteFooter.spec.ts
```

Suggested business/component test moves should follow the actual imported subject in each spec:

- Music drawer, music layout, and music home tests move under `tests/unit/views/music/` or `tests/unit/components/music/` depending on the imported file.
- Kanbo view/component tests move under `tests/unit/views/kanbo/` or `tests/unit/components/kanbo/` depending on the imported file.
- `useKanbo*` tests move under `tests/unit/composables/`.
- Store, router, config, API, utility, and composable tests already under matching directories remain there.

## Migration Rules

- Move files with `mkdir -p` and `mv`, not by rewriting contents.
- Update all imports affected by the moves.
- Update router lazy-import paths for moved views.
- Update tests that import moved components or views.
- Preserve existing route URLs and route names.
- Preserve existing component names and exported APIs.
- Do not touch `.claude/`, `.superpowers/`, `.codegraph/`, `playwright-report/`, or `test-results/` as part of this reorganization.
- Treat `public/icon_comparison.html` as a separate cleanup decision, not part of this directory reorganization.

## Verification

After migration, run:

```bash
bun run type-check
bun run test:unit
```

If the source moves affect browser-visible shell or routing behavior, also run a quick local app check of the portal, auth, and a representative module page before reporting completion.

## Expected Outcome

The source tree keeps its current architecture, but root-level source and unit-test clutter is reduced. Non-module files have a predictable `system/` home, while clearly module-owned files remain inside their existing module folders.
