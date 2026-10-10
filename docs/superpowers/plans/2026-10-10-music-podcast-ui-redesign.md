# Implementation Plan: Music & Podcast UI Redesign (Pure-White Double-Notch Minimal System)

## Proposed Changes

Migrate views in `src/views/music/` and `src/views/podcast/` to the Pure-White Double-Notch Minimal System specification.

---

### Task 1: Music Views Surfaces & Cards Polish (`DiscoverView.vue`, `PlaylistsView.vue`, `LibraryView.vue`, `SongsView.vue`, `MusicTagsView.vue`, `MusicTagView.vue`)

**Files:**
- Modify: `src/views/music/DiscoverView.vue`
- Modify: `src/views/music/PlaylistsView.vue`
- Modify: `src/views/music/LibraryView.vue`
- Modify: `src/views/music/SongsView.vue`
- Modify: `src/views/music/MusicTagsView.vue`
- Modify: `src/views/music/MusicTagView.vue`
- Test: `tests/unit/views/music/`

- [ ] **Step 1: Polish DiscoverView.vue**
  - Change 18px card radius to `var(--a-radius-card)`.
  - Standardize section header h2 font-weights from 600 to 500.
  - Tokenize hardcoded hex colors (`#8a2f2f`) to semantic tokens.
- [ ] **Step 2: Polish PlaylistsView.vue**
  - Replace 8px radius with `var(--a-radius-card)` / `var(--a-radius-control)`.
  - Replace hardcoded `#ff3b30` with `var(--a-color-danger)`.
  - Enforce pure-white surfaces on modal and card styles.
  - Standardize section title h2 font-weight from 650 to 500.
- [ ] **Step 3: Polish LibraryView.vue & SongsView.vue**
  - In `LibraryView.vue`: pure-white surfaces, replace 50% circular button with standard 4px radius.
  - In `SongsView.vue`: section title h2 and song title font-weights from 600 to 500; ensure pure-white surfaces.
- [ ] **Step 4: Polish MusicTagsView.vue & MusicTagView.vue**
  - Standardize section header h2 font-weights from 600 to 500.
- [ ] **Step 5: Run unit tests for Task 1**
  ```bash
  bun run test:unit tests/unit/views/music/MusicDiscoverView.spec.ts tests/unit/views/music/MusicPlaylistsView.spec.ts tests/unit/views/music/LibraryView.spec.ts tests/unit/views/music/SongsView.spec.ts tests/unit/views/music/MusicTagView.spec.ts tests/unit/views/music/MusicTagsView.spec.ts
  ```
- [ ] **Step 6: Commit changes**
  ```bash
  git commit -m "refactor(music): standardize music views surfaces, card radii, and title typography"
  ```

---

### Task 2: Music Management & History Views Polish (`ImportsView.vue`, `MusicHistoryView.vue`, `MusicProfileView.vue`, `ArtistsView.vue`)

**Files:**
- Modify: `src/views/music/ImportsView.vue`
- Modify: `src/views/music/MusicHistoryView.vue`
- Modify: `src/views/music/MusicProfileView.vue`
- Modify: `src/views/music/ArtistsView.vue`
- Test: `tests/unit/views/music/`

- [ ] **Step 1: Polish ImportsView.vue**
  - Standardize `6px` radius to `var(--a-radius-card)` (4px).
  - Panel title h2 from 600 to 500; active filter weight to 600.
  - Replace undefined `var(--a-color-accent)` with `var(--a-color-primary)`.
  - Replace hardcoded hex colors (`#22c55e`, `#16a34a`, `#ef4444`, `#dc2626`, `#3b82f6`, `#2563eb`) with semantic design tokens.
  - Enforce pure-white surface on panels.
- [ ] **Step 2: Polish MusicHistoryView.vue & MusicProfileView.vue**
  - In `MusicHistoryView.vue`: replace undefined `var(--a-color-accent)` with `var(--a-color-primary)`.
  - In `MusicProfileView.vue`: refresh button radius 8px to 4px (`var(--a-radius-control)`); section title h2 from 650 to 500; stat cards explicit `background: var(--a-color-bg)`.
- [ ] **Step 3: Polish ArtistsView.vue**
  - Tokenize divider borders to `var(--a-color-border-soft)`.
- [ ] **Step 4: Run unit tests for Task 2**
  ```bash
  bun run test:unit tests/unit/views/music/MusicImportsView.spec.ts tests/unit/views/music/MusicHistoryView.spec.ts tests/unit/views/music/MusicProfileView.spec.ts tests/unit/views/music/MusicArtistsView.spec.ts
  ```
- [ ] **Step 5: Commit changes**
  ```bash
  git commit -m "refactor(music): standardize imports, profile, and history views surfaces and tokens"
  ```

---

### Task 3: Podcast Module Views Polish (`src/views/podcast/*`)

**Files:**
- Modify: `src/views/podcast/PodcastEpisodeView.vue`
- Modify: `src/views/podcast/PodcastHomeView.vue`
- Modify: `src/views/podcast/PodcastShowView.vue`
- Modify: `src/views/podcast/PodcastEditorView.vue`
- Modify: `src/views/podcast/PodcastFavoritesView.vue`
- Modify: `src/views/podcast/PodcastSubscriptionsView.vue`
- Modify: `src/views/podcast/PodcastProfileView.vue`
- Test: `tests/unit/views/podcast/`

- [ ] **Step 1: Polish PodcastEpisodeView.vue**
  - Replace hardcoded hex colors (`#9ca3af`, `#ef4444`, `#6b7280`) with `var(--a-color-muted)` / `var(--a-color-danger)`.
  - Lower shownotes h2 font-weight from 600 to 500.
- [ ] **Step 2: Polish PodcastHomeView.vue & PodcastShowView.vue**
  - In `PodcastHomeView.vue`: section title h2, recommendation h3, and episode title font-weights from 600 to 500.
  - In `PodcastShowView.vue`: podcast show title h1 and episode link font-weights from 600 to 500.
- [ ] **Step 3: Polish PodcastEditorView.vue, PodcastFavoritesView.vue, PodcastSubscriptionsView.vue & PodcastProfileView.vue**
  - In `PodcastEditorView.vue`: simplify placeholder `"上传音频后自动填充，可手动修改"` to `"单集标题"`; drop zone surface updated to pure-white / muted tokens (remove `var(--a-color-surface)`); section title h2 from 600 to 500.
  - In `PodcastFavoritesView.vue` & `PodcastSubscriptionsView.vue`: episode title links font-weights from 600 to 500.
  - In `PodcastProfileView.vue`: stat cards explicit `background: var(--a-color-bg)`.
- [ ] **Step 4: Run podcast unit tests**
  ```bash
  bun run test:unit tests/unit/views/podcast/
  ```
- [ ] **Step 5: Commit changes**
  ```bash
  git commit -m "refactor(podcast): standardize podcast views typography, surfaces, and semantic colors"
  ```

---

### Task 4: Whole-Module Integration, Full Test Suite & Branch Review

**Files:**
- All modified files
- Contract test suites: `tests/unit/ui/design-system-contract.spec.ts`

- [ ] **Step 1: Run full type check**
  ```bash
  bun run type-check
  ```
- [ ] **Step 2: Run all Music & Podcast test suites**
  ```bash
  bun run test:unit tests/unit/views/music tests/unit/views/podcast tests/unit/components/music tests/unit/ui/design-system-contract.spec.ts
  ```
- [ ] **Step 3: Run git diff format check**
  ```bash
  git diff --check
  ```
- [ ] **Step 4: Dispatch whole-branch code review subagent**
- [ ] **Step 5: Merge into main and push to origin**
