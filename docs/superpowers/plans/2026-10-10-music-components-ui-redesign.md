# Music Components UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign all music components in `src/components/music/*` to strictly adhere to the Pure-White Double-Notch Minimal System specification, removing forbidden surface tokens, heavy font weights, non-standard radii, and hardcoded hex values.

**Architecture:** Refactor 3 targeted clusters: (1) Audio Player, Queue & Lyrics, (2) Multi-step Album/Artist Creation Flow, (3) Drawers, Entity Cards & Editors. Maintain all component contracts, event emits, and test assertions.

**Tech Stack:** Vue 3.5, TypeScript 5.9, Pinia 3, Vite, Tailwind CSS v4, Vitest.

## Global Constraints

- Surfaces: Solid `#ffffff` / `var(--a-color-bg)` for cards, drawers, and panels. Use `var(--a-color-surface-muted)` for hover/focus backgrounds. Forbid raw `var(--a-color-surface)`.
- Dividers: `var(--a-color-border)` and `var(--a-color-border-soft)`. No hardcoded hex borders.
- Radii: 4px (`var(--a-radius-card)` / `var(--a-radius-control)`). No `999px` pills or `12px` cards.
- Typography: Titles and headers strictly `500` (emphasis/active states `600`). Eradicate `700`, `800`, `bold`.
- Colors: Semantic design tokens (`var(--a-color-primary)`, `var(--a-color-danger)`, `var(--a-color-warning)`, `var(--a-color-success)`).

---

### Task 1: Audio Player, Queue & Lyrics Components Polish

**Files:**
- Modify: `src/components/music/AudioPlayer.vue`
- Modify: `src/components/music/AudioPlayerQueue.vue`
- Modify: `src/components/music/MusicLyricsPanel.vue`
- Modify: `src/components/music/MusicLyricsLine.vue`
- Modify: `src/components/music/MusicLyricsRowEditor.vue`

- [ ] **Step 1: Check baseline tests for player and lyrics**
  Run: `bun run test:unit tests/unit/components/music/AudioPlayer.spec.ts tests/unit/components/music/MusicLyricsPanel.spec.ts tests/unit/components/music/AudioPlayerQueue.spec.ts`
- [ ] **Step 2: Refactor `AudioPlayer.vue`**
  - Replace `var(--a-color-surface)` and `#fff` with `var(--a-color-bg)`.
  - Standardize `font-weight: bold / 800` to `500 / 600`.
  - Replace `#e05e5e` with `var(--a-color-danger)`.
- [ ] **Step 3: Refactor `AudioPlayerQueue.vue`**
  - Standardize `font-weight: 700` to `500 / 600`.
  - Replace `#10b981` with `var(--a-color-success)`, `#ef4444` with `var(--a-color-danger)`.
- [ ] **Step 4: Refactor `MusicLyricsPanel.vue`, `MusicLyricsLine.vue` & `MusicLyricsRowEditor.vue`**
  - Lower font weights from `700 / 800` to `500 / 600`.
  - Standardize `12px` border-radius to `var(--a-radius-card)` (4px).
- [ ] **Step 5: Verify Task 1 tests pass**
  Run: `bun run test:unit tests/unit/components/music/AudioPlayer.spec.ts tests/unit/components/music/MusicLyricsPanel.spec.ts tests/unit/components/music/AudioPlayerQueue.spec.ts`
- [ ] **Step 6: Commit Task 1**
  Commit: `refactor(music): standardize audio player, queue and lyrics components to pure-white minimal system`

---

### Task 2: Music Creation Flow Wizard Components Polish

**Files:**
- Modify: `src/components/music/MusicCreationAlbumDetailsStep.vue`
- Modify: `src/components/music/MusicCreationAlbumUploadZone.vue`
- Modify: `src/components/music/MusicCreationArtistStep.vue`
- Modify: `src/components/music/MusicCreationContributorPicker.vue`
- Modify: `src/components/music/MusicCreationAlbumSeedStep.vue`
- Modify: `src/components/music/MusicCreationAlbumPreviewStep.vue`
- Modify: `src/components/music/MusicCreationFlowDrawer.vue`

- [ ] **Step 1: Check baseline creation flow tests**
  Run: `bun run test:unit tests/unit/components/music/MusicCreationFlowDrawer.spec.ts tests/unit/components/music/MusicCreationAlbumDetailsStep.spec.ts tests/unit/components/music/MusicCreationArtistStep.spec.ts`
- [ ] **Step 2: Refactor `MusicCreationAlbumDetailsStep.vue`**
  - Standardize 11 heavy font weights (`700 / 800`) to `500 / 600`.
  - Replace `999px` pills with `var(--a-radius-control)` (4px).
  - Replace hardcoded hex colors (`#1e1e1e`, `#cfb26f`, `#b89a55`, `#866b2d`) with semantic tokens.
- [ ] **Step 3: Refactor `MusicCreationAlbumUploadZone.vue`**
  - Standardize 7 heavy font weights (`700 / 800`) to `500 / 600`.
- [ ] **Step 4: Refactor `MusicCreationArtistStep.vue` & `MusicCreationContributorPicker.vue`**
  - Standardize heavy font weights to `500 / 600`.
  - Replace `var(--a-color-surface)` with `var(--a-color-bg)` / `var(--a-color-surface-muted)`.
- [ ] **Step 5: Refactor `MusicCreationAlbumSeedStep.vue`, `MusicCreationAlbumPreviewStep.vue` & `MusicCreationFlowDrawer.vue`**
  - Replace `var(--a-color-surface)` with `var(--a-color-bg)`.
  - Standardize font weights to `500 / 600`.
- [ ] **Step 6: Verify Task 2 tests pass**
  Run: `bun run test:unit tests/unit/components/music/MusicCreationFlowDrawer.spec.ts tests/unit/components/music/MusicCreationAlbumDetailsStep.spec.ts tests/unit/components/music/MusicCreationArtistStep.spec.ts`
- [ ] **Step 7: Commit Task 2**
  Commit: `refactor(music): polish music creation wizard steps to pure-white minimal system`

---

### Task 3: Drawers, Cards & Editors Polish

**Files:**
- Modify: `src/components/music/AlbumDrawer.vue`
- Modify: `src/components/music/ArtistDrawer.vue`
- Modify: `src/components/music/NestedActionDrawer.vue`
- Modify: `src/components/music/MusicArtistCard.vue`
- Modify: `src/components/music/MusicPlaylistCard.vue`
- Modify: `src/components/music/MusicAlbumCard.vue`
- Modify: `src/components/music/MusicMergeDrawer.vue`
- Modify: `src/components/music/MusicLyricEditorDrawer.vue`
- Modify: `src/components/music/MusicSidebarPlaylists.vue`
- Modify: `src/components/music/MusicBrainzEditNotice.vue`
- Modify: `src/components/music/MusicAlbumCreditLinkDrawer.vue`
- Modify: `src/components/music/ArtistSelect.vue`

- [ ] **Step 1: Check baseline drawer and card tests**
  Run: `bun run test:unit tests/unit/components/music/AlbumDrawer.spec.ts tests/unit/components/music/ArtistDrawer.spec.ts tests/unit/components/music/NestedActionDrawer.spec.ts tests/unit/components/music/MusicArtistCard.spec.ts tests/unit/components/music/MusicAlbumCard.spec.ts`
- [ ] **Step 2: Refactor `AlbumDrawer.vue`, `ArtistDrawer.vue`, `NestedActionDrawer.vue`**
  - Replace `var(--a-color-surface)` with `var(--a-color-bg)`.
  - Standardize `font-weight: bold / 700` to `500 / 600`.
  - Replace `#e05e5e` with `var(--a-color-danger)`.
- [ ] **Step 3: Refactor `MusicArtistCard.vue`, `MusicPlaylistCard.vue`, `MusicAlbumCard.vue`**
  - Replace `var(--a-color-surface)` with `var(--a-color-bg)`.
  - Replace `999px` pills with `var(--a-radius-control)` (4px).
  - Replace `font-weight: 700` with `500 / 600`.
  - Standardize gold/warning badges to semantic tokens.
- [ ] **Step 4: Refactor remaining drawers (`MusicMergeDrawer.vue`, `MusicLyricEditorDrawer.vue`, `MusicSidebarPlaylists.vue`, etc.)**
  - Standardize input backgrounds to `var(--a-color-bg)`.
  - Standardize `12px` border-radius to `var(--a-radius-card)` (4px).
  - Lower bold weights to `500 / 600`.
- [ ] **Step 5: Verify Task 3 tests pass**
  Run: `bun run test:unit tests/unit/components/music/AlbumDrawer.spec.ts tests/unit/components/music/ArtistDrawer.spec.ts tests/unit/components/music/NestedActionDrawer.spec.ts tests/unit/components/music/MusicArtistCard.spec.ts tests/unit/components/music/MusicAlbumCard.spec.ts`
- [ ] **Step 6: Commit Task 3**
  Commit: `refactor(music): polish music drawers, cards, and editors to pure-white minimal system`

---

### Task 4: Whole-Module Integration & Final Verification

- [ ] **Step 1: Run all music component tests**
  Run: `bun run test:unit tests/unit/components/music/`
- [ ] **Step 2: Run design system contract tests**
  Run: `bun run test:unit tests/unit/ui/design-system-contract.spec.ts`
- [ ] **Step 3: Run TypeScript type check**
  Run: `bun run type-check`
- [ ] **Step 4: Run production build check**
  Run: `bun run build`
- [ ] **Step 5: Check git diff**
  Run: `git diff --check`
