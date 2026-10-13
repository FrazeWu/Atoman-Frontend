# Design Spec: UI Foundation Standardization and Blur Eradication

- **Date**: 2026-10-12
- **Scope**: `Atoman-Frontend`
- **Target Components**: `PField.vue`, `PToast.vue`, `PDirectoryNav.vue`, `PContentProgress.vue`, `PContentCard.vue`, `PInteractionActions.vue`, `PSheet.vue`, `MusicLyricsRowEditor.vue`, and all components with `backdrop-filter: blur`.

---

## 1. Problem Statement & Background

In the Pure-White Minimal Design System (`design_system.md`, `AGENTS.md`, and `style.css`):
1. **Geometric Radii Consistency (R4)**:
   - All cards, controls, panels, and badges must use `var(--a-radius-card, 4px)` or `var(--a-radius-control, 4px)`.
   - `8px` or `999px` pills are non-compliant.
   - Currently, `PToast.vue` (inline mode), `PDirectoryNav.vue`, and `MusicLyricsRowEditor.vue` use hardcoded `border-radius: 8px`.
   - `PContentCard.vue`, `PInteractionActions.vue`, and `PContentProgress.vue` retain `border-radius: 999px`.
2. **Typography & Hierarchy (R5)**:
   - Headings are strictly `500` (emphasis `600`), and non-standard weights (`650`, `700`, `bold`) are prohibited.
   - `PField.vue` error text uses `font-weight: 700`, and `PSheet.vue` mobile page header uses `font-weight: 650`.
3. **Pure White Surfaces & Tokens (R1, R2, R10)**:
   - `PToast.vue` and `PDirectoryNav.vue` use `background: var(--a-color-surface)`. They must use solid white `var(--a-color-bg)` with standard border `var(--a-color-border-soft)`.
   - `PField.vue` uses raw utility `text-red-500` instead of `var(--a-color-danger)`.
   - `PContentProgress.vue` uses `#3b82f6` fallback instead of pure design token.
4. **Blur / Glassmorphism Eradication**:
   - `design_system.md` dictates solid backgrounds without backdrop blur or translucency.
   - 8 occurrences of `backdrop-filter: blur(...)` remain in `AppTopbarGlobalSearch.vue`, `PVideoCard.vue`, `MusicAlbumCard.vue`, `VideoPlayerControls.vue`, and dev blog templates.

---

## 2. Component Design & Changes

### 2.1 UI Foundation Primitives

#### `src/components/ui/PField.vue`
- Error message: `font-weight: 500` (was `700`).
- Required asterisk: `color: var(--a-color-danger)` (was `text-red-500`).

#### `src/components/ui/PToast.vue`
- Toast background: `background: var(--a-color-bg)` (was `var(--a-color-surface)`).
- Inline toast radius: `border-radius: var(--a-radius-card, 4px)` (was `8px`).

#### `src/components/ui/PDirectoryNav.vue`
- Panel radius: `border-radius: var(--a-radius-card, 4px)` (was `8px`).
- Panel background: `background: var(--a-color-bg)` (was `var(--a-color-surface)`).
- Shadow: `box-shadow: var(--a-shadow-dropdown)` (was ad hoc `0 12px 28px ...`).
- Collapsed rail: `border-radius: var(--a-radius-card, 4px)` (was `8px`).
- Collapsed rail background: `background: var(--a-color-bg) !important` (was `var(--a-color-surface)`).

#### `src/components/ui/PContentProgress.vue`
- Track & bar radius: `border-radius: var(--a-radius-none, 0px)` (was `999px`).
- Progress bar background: `background: var(--a-color-primary)` (removed `#3b82f6` fallback).
- Text color: `color: var(--a-color-primary)` (removed `#3b82f6` fallback).

#### `src/components/ui/PContentCard.vue`
- Vertical lead strip: `border-radius: var(--a-radius-none, 0px)` (was `999px`).

#### `src/components/ui/PInteractionActions.vue`
- Ratio track & fill: `border-radius: var(--a-radius-control, 4px)` (was `999px`).

#### `src/components/ui/PSheet.vue`
- Mobile page header: `font-weight: 500` (was `650`).

#### `src/components/music/MusicLyricsRowEditor.vue`
- Row and selection radii: `border-radius: var(--a-radius-control, 4px)` (was `8px`).

---

### 2.2 Blur Removal & Overlay Clean-up

#### `src/components/system/AppTopbarGlobalSearch.vue`
- Remove `backdrop-filter: blur(4px)`.
- Use solid/token overlay: `background: var(--a-color-overlay-soft, rgba(15, 23, 42, 0.45));`.

#### `src/components/shared/PVideoCard.vue`
- `.vc-play-badge`: Remove `backdrop-filter: blur(8px)`. Use solid `background: rgba(15, 23, 42, 0.85);`.
- `.vc-watch-later`: Radius to `var(--a-radius-control, 4px)` (was `999px`).
- `.vc-play-count`: Remove `backdrop-filter: blur(4px)`. Use solid `background: rgba(15, 23, 42, 0.82);`.
- `.vc-duration`: Remove `backdrop-filter: blur(4px)`. Use solid `background: rgba(15, 23, 42, 0.82);`.

#### `src/components/music/MusicAlbumCard.vue`
- `.status-tag`: Remove `backdrop-filter: blur(4px)`. Keep solid `rgba(0, 0, 0, 0.85);`.

#### `src/components/video/VideoPlayerControls.vue`
- `.vpc-speed-menu, .vpc-volume-popover`: Remove `backdrop-filter: blur(12px)`. Keep solid `background: rgba(18, 18, 20, 0.95);`.

#### `src/views/dev/BlogExploreTemplateView.vue` & `src/views/dev/BlogTemplateView.vue`
- Remove legacy `backdrop-filter: blur(4px)` from overlay badges.

---

## 3. Automated Contract Tests

Add contract assertion in `tests/unit/ui/design-system-contract.spec.ts`:
- Assert `expect(sourceText("src")).not.toMatch(/backdrop-filter:\s*blur/);`.
- Assert `PToast`, `PDirectoryNav`, `PField`, `PContentProgress` conform to radii and font-weight contracts.

---

## 4. Verification Gate

- `bun run type-check`: 0 errors.
- `bun run test:unit tests/unit/ui/`: All unit and contract tests pass.
- `bun run build`: Production build completes cleanly.
- `git diff --check`: Clean formatting.
