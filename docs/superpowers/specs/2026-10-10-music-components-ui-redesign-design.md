# Design Spec: Music Components UI Redesign (Pure-White Double-Notch Minimal System)

## 1. Context & Objectives

The Atoman web frontend continues its migration to the **Pure-White Double-Notch Minimal System** (`docs/specs/2026-06-05-flat-paper-ui-design.md`, `design_system.md`, `AGENTS.md`). Following the completion of Music Views, this specification targets the **Music Components** (`src/components/music/*`), which power the persistent audio player, lyrics workspace, multi-step album/artist creation flow, and catalog drawers.

### Core Goals:
1. **R1 Pure-White Surfaces**: Eliminate all instances of `var(--a-color-surface)` (#f8fafc) and `#fff` on player sheets, creation steps, dropzones, and card backgrounds, standardizing to `var(--a-color-bg)` (#ffffff) and `var(--a-color-surface-muted)` for soft hover states.
2. **R2 Soft Dividers**: Replace hardcoded borders with `var(--a-color-border)` and `var(--a-color-border-soft)`.
3. **R4 4px Standard Radii**: Standardize cards, chips, buttons, badges, and drawers to `4px` (`var(--a-radius-card)` / `var(--a-radius-control)`). Eradicate non-standard `12px` and `999px` pill radii.
4. **R5 Typography Restraint**: Standardize title and header font weights to `500` (emphasis/active states `600`). Eradicate `700`, `800`, `bold` font weights across all music components.
5. **R10 Semantic Color Tokens**: Replace hardcoded hex values (`#1e1e1e`, `#e05e5e`, `#10b981`, `#ef4444`, `#eaaa08`, `#fcd34d`, `#cfb26f`, `#b89a55`, `#866b2d`) with semantic design tokens (`var(--a-color-danger)`, `var(--a-color-success)`, `var(--a-color-warning)`, `var(--a-color-primary)`).

---

## 2. Component Scope & Breakdown

### 2.1 Cluster 1: Audio Player, Queue & Lyrics
- `AudioPlayer.vue`:
  - Surfaces: Replace `var(--a-color-surface)` and hardcoded `#fff` with `var(--a-color-bg)`.
  - Typography: Replace `font-weight: bold / 800` with `500 / 600`.
  - Colors: Replace `#e05e5e` with `var(--a-color-danger)`.
- `AudioPlayerQueue.vue`:
  - Typography: Replace `font-weight: 700` with `500 / 600`.
  - Colors: Replace `#10b981` with `var(--a-color-success)`, `#ef4444` with `var(--a-color-danger)`.
- `MusicLyricsPanel.vue`:
  - Typography: Lower `font-weight: 800 / 700` to `500 / 600`.
  - Radii: Standardize `12px` border-radius to `var(--a-radius-card)` (4px).
- `MusicLyricsLine.vue` & `MusicLyricsRowEditor.vue`:
  - Typography: Lower strong font weights to `500 / 600`.

### 2.2 Cluster 2: Music Creation Flow Wizard
- `MusicCreationAlbumDetailsStep.vue`:
  - Typography: Lower all 11 `font-weight: 700 / 800` occurrences to `500 / 600`.
  - Radii: Replace `999px` pills with `var(--a-radius-control)` (4px).
  - Colors: Standardize custom gold/dark palette to semantic tokens.
- `MusicCreationAlbumUploadZone.vue`:
  - Typography: Lower 7 `font-weight: 700 / 800` occurrences to `500 / 600`.
- `MusicCreationArtistStep.vue`:
  - Surfaces: Replace `var(--a-color-surface)` with `var(--a-color-bg)`.
  - Typography: Lower `font-weight: 800` to `500 / 600`.
- `MusicCreationContributorPicker.vue`:
  - Typography: Lower 4 `font-weight: 700 / 800` occurrences to `500 / 600`.
- `MusicCreationAlbumSeedStep.vue` & `MusicCreationAlbumPreviewStep.vue`:
  - Surfaces: Replace `var(--a-color-surface)` with `var(--a-color-bg)`.
  - Typography: Lower heavy font weights to `500 / 600`.

### 2.3 Cluster 3: Drawers, Cards & Editors
- `AlbumDrawer.vue`, `ArtistDrawer.vue`, `NestedActionDrawer.vue`:
  - Surfaces: Replace `var(--a-color-surface)` with `var(--a-color-bg)`.
  - Typography: Lower `font-weight: bold / 700` to `500 / 600`.
  - Colors: Replace `#e05e5e` with `var(--a-color-danger)`.
- `MusicArtistCard.vue`, `MusicPlaylistCard.vue`, `MusicAlbumCard.vue`:
  - Surfaces: Replace `var(--a-color-surface)` with `var(--a-color-bg)`.
  - Radii: Replace `999px` pills with `var(--a-radius-control)` (4px).
  - Typography: Lower `font-weight: 700` to `500 / 600`.
  - Colors: Replace `#eaaa08`, `#fcd34d` with `var(--a-color-warning)`.
- `MusicMergeDrawer.vue`:
  - Surfaces: Replace `var(--a-color-surface)` in input/button with `var(--a-color-bg)` and 4px radius.
- `MusicLyricEditorDrawer.vue`:
  - Radii: Standardize `12px` border-radius to `var(--a-radius-card)` (4px).
- `MusicSidebarPlaylists.vue`:
  - Typography: Lower `font-weight: 700 / bold` to `500 / 600`.

---

## 3. Verification & Safety Guarantees

1. Zero test regressions: All unit test suites in `tests/unit/components/music/`, `tests/unit/views/music/`, and `tests/unit/ui/` must pass 100%.
2. Type check: `bun run type-check` with 0 errors.
3. Build check: `bun run build` succeeds cleanly.
4. Diff check: `git diff --check` with 0 whitespace or formatting issues.
