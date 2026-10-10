# Design Spec: Music & Podcast UI Redesign (Pure-White Double-Notch Minimal System)

## 1. Context & Objectives

The Atoman web frontend is migrating its UI across all modules to the **Pure-White Double-Notch Minimal System** (`docs/specs/2026-06-05-flat-paper-ui-design.md`, `design_system.md`, `AGENTS.md`). Following the completion and merge of Books, Shared/Portal, Forum/Debate, and Feed/Video modules, this spec targets the **Music** (`src/views/music/*`) and **Podcast** (`src/views/podcast/*`) consumption and management modules.

### Core Goals:
1. **R1 Pure-White Surfaces**: Card, panel, sheet, stat card, and drop zone surfaces must use solid `#ffffff` / `var(--a-color-bg)`. Forbid `var(--a-color-surface)` (`#f8fafc`) on surfaces.
2. **R2 Soft Dividers**: Outer borders use `var(--a-color-border)`, inner dividers use `var(--a-color-border-soft)`. No hardcoded hex borders.
3. **R3 Minimal Shadows**: Only standard `var(--a-shadow-*)` tokens.
4. **R4 4px Standard Radii**: Standardize cards and controls to `4px` (`var(--a-radius-card)` / `var(--a-radius-control)`). Eradicate legacy non-standard radii (6px, 8px, 18px, and 50% circle buttons).
5. **R5 Typography Restraint**: Title font-weights strictly `500` (emphasis/active states `600`). Eradicate `650`, `700`, `800`, `bold` on titles.
6. **R8 User-Facing Copy**: Remove technical explanations from placeholders (e.g. rewrite "上传音频后自动填充，可手动修改" to clean input guidance "单集标题").
7. **R10 Semantic Color Tokens**: Eradicate hardcoded hex colors (`#9ca3af`, `#ef4444`, `#6b7280`, `#22c55e`, `#16a34a`, `#3b82f6`, `#8a2f2f`) and undefined variables (`--a-color-accent`), replacing them with standard semantic tokens (`var(--a-color-danger)`, `var(--a-color-warning)`, `var(--a-color-success)`, `var(--a-color-primary)`, `var(--a-color-muted)`).

---

## 2. Detailed Module Breakdown

### 2.1 Music Views (`src/views/music/*`)

- **`DiscoverView.vue`**:
  - Replace non-standard `18px` card radius on banner/card elements with `var(--a-radius-card)` (4px).
  - Standardize section header h2 font-weights from 600 to 500.
  - Replace hardcoded hex colors (`#8a2f2f`) with semantic tokens (`var(--a-color-danger)` / `var(--a-color-primary)`).
- **`PlaylistsView.vue`**:
  - Standardize 8px card & modal border-radius to `var(--a-radius-card)` / `var(--a-radius-control)`.
  - Standardize section header h2 font-weight from 650 to 500.
  - Standardize raw inputs/buttons to design tokens and component contracts; replace hardcoded `#ff3b30` with `var(--a-color-danger)`.
  - Enforce pure-white surfaces on playlist forms and card backgrounds.
- **`LibraryView.vue`**:
  - Pure-white surfaces for library collections.
  - Replace non-standard 50% round floating action button with standard `var(--a-radius-control)`.
- **`SongsView.vue`**:
  - Standardize section title h2 and song title links from font-weight 600 to 500.
  - Explicit `background: var(--a-color-bg)` on entity rows.
- **`MusicTagsView.vue` & `MusicTagView.vue`**:
  - Section header h2 font-weights lowered from 600 to 500.
- **`ImportsView.vue`**:
  - Standardize `6px` radius on import items and detail panels to `var(--a-radius-card)` (4px).
  - Panel title h2 from 600 to 500; active filter weight to 600.
  - Eradicate undefined variable `var(--a-color-accent)` -> `var(--a-color-primary)`.
  - Replace hardcoded hex badges (`#22c55e`, `#16a34a`, `#ef4444`, `#dc2626`, `#3b82f6`, `#2563eb`) with semantic tokens (`var(--a-color-success)`, `var(--a-color-danger)`, `var(--a-color-primary)`).
  - Pure-white background for panels and detail drawers.
- **`MusicHistoryView.vue`**:
  - Eradicate undefined `var(--a-color-accent)` -> `var(--a-color-primary)`.
- **`MusicProfileView.vue`**:
  - Refresh button radius from 8px to 4px (`var(--a-radius-control)`).
  - Section title h2 from 650 to 500.
  - Stat cards explicit pure-white `background: var(--a-color-bg)`.
- **`ArtistsView.vue`**:
  - Standardize divider borders to `var(--a-color-border-soft)`.

### 2.2 Podcast Views (`src/views/podcast/*`)

- **`PodcastEpisodeView.vue`**:
  - Eradicate hardcoded hex colors (`#9ca3af`, `#ef4444`, `#6b7280`), replacing with `var(--a-color-muted)` and `var(--a-color-danger)`.
  - Shownotes title h2 font-weight from 600 to 500.
- **`PodcastHomeView.vue`**:
  - Standardize section title h2, recommendation card h3, and episode title font-weights from 600 to 500.
- **`PodcastShowView.vue`**:
  - Podcast show title h1 and episode link font-weights from 600 to 500.
- **`PodcastEditorView.vue`**:
  - Simplify placeholder `"上传音频后自动填充，可手动修改"` to concise `"单集标题"`.
  - Drop zone and uploading box backgrounds: eliminate forbidden `var(--a-color-surface)`; use pure-white or `var(--a-color-surface-muted)`.
  - Section title h2 font-weight from 600 to 500.
- **`PodcastFavoritesView.vue` & `PodcastSubscriptionsView.vue`**:
  - Title links font-weights from 600 to 500.
- **`PodcastProfileView.vue`**:
  - Stat cards explicit `background: var(--a-color-bg)`.

---

## 3. Verification & Safety Guarantees

- Zero regressions: all 22 test files (130 unit tests) in `tests/unit/views/music` and `tests/unit/views/podcast` must remain 100% green.
- Type check: `bun run type-check` with 0 errors.
- Diff check: `git diff --check` with 0 warnings.
