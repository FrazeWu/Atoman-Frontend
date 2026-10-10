# Design Spec: Timeline Module UI Redesign (Pure-White Double-Notch Minimal System)

## 1. Context & Objectives

The Atoman web frontend is migrating its UI across all modules to the **Pure-White Double-Notch Minimal System** (`docs/specs/2026-06-05-flat-paper-ui-design.md`, `design_system.md`, `AGENTS.md`). Following the completion of Books, Shared/Portal, Forum/Debate, Feed/Video, and Music/Podcast modules, this spec targets the **Timeline** module:
- Components: `src/components/timeline/*`
- Views: `src/views/timeline/*`

### Core Goals:
1. **R1 Pure-White Surfaces**: Card, panel, modal, toolbar, map pane, and proposal backgrounds must use `#ffffff` / `var(--a-color-bg)`. Eliminate `var(--a-color-surface)` and `var(--a-color-surface-muted)` on primary surfaces.
2. **R2 Soft Dividers**: Replace hardcoded `rgba(0,0,0,0.05)` or `rgba(0,0,0,0.08)` borders with `var(--a-color-border-soft)` / `var(--a-color-border)`.
3. **R3 Minimal Shadows**: Standardize shadows to `var(--a-shadow-*)`.
4. **R4 4px Standard Radii**: Standardize cards, filter chips, mode switches, and action buttons to `var(--a-radius-card)` and `var(--a-radius-control)` (4px). Eliminate non-standard `999px` pills (`.tl-mode-switch`, `.tl-mode-btn`).
5. **R5 Typography Restraint**: Titles strictly `font-weight: 500`. Emphasis states `font-weight: 600`. Eliminate `550`, `650`, `700`, `800`, `bold` on titles and labels.
6. **R9 Component Contracts**: Standardize `PButton` usage (replace deprecated `outline` prop with `variant="secondary"`; replace raw `<button>` actions with `PButton`).
7. **R10 Semantic Color Tokens**: Eradicate hardcoded hex colors (`#991b1b`, `#d1d5db`, `#fef2f2`, `#f9fafb`, `#ef4444`, `#4b5563`, `#e5e7eb`, `#059669`), replacing them with standard tokens (`var(--a-color-danger)`, `var(--a-color-success)`, `var(--a-color-muted)`).

---

## 2. Detailed Component & View Breakdown

### 2.1 Timeline Components (`src/components/timeline/*`)

- **`TimelineToolbar.vue`**:
  - Surface: change `.tl-toolbar` background from `var(--a-color-surface-muted)` to `var(--a-color-bg)`.
  - Radii: change `.tl-mode-switch` and `.tl-mode-btn` from `var(--a-radius-pill, 999px)` to `var(--a-radius-control)` (4px).
  - Typography: change `.filter-label` and `.tl-action-btn` font-weight from `550` to `500`; remove `text-transform: uppercase`.
- **`TimelineRevisionProposal.vue`**:
  - Surface: change `.timeline-proposals__meta` background from `var(--a-color-surface)` to `var(--a-color-bg)`.
  - Typography: change `label` from `700` to `500`; change `.timeline-proposals__status` from `800` to `600`.
  - Color tokens: change error from `var(--a-color-accent-destructive)` to `var(--a-color-danger)`.
  - Component contracts: replace `outline` on `PButton` with `variant="secondary"`.
- **`TimelineEventDetailModal.vue`**:
  - Replace deprecated `outline` prop on `PButton` with `variant="secondary"`.
  - Clean up modal divider lines and token consistency.
- **`TimelineEventFormSection.vue`**:
  - Form field polish and soft divider tokenization.

### 2.2 Timeline Views (`src/views/timeline/*`)

- **`TimelineHomeView.vue`**:
  - Surfaces: `.tl-panel-empty`, `.tl-map-canvas` changed from `var(--a-color-surface)` to `var(--a-color-bg)`.
  - Typography: remove Tailwind `font-bold` from loading states; standardize titles to 500.
  - Colors: replace `#991b1b` / `#fef2f2` with semantic `var(--a-color-danger)` via `color-mix`.
  - Dividers: replace `rgba(0, 0, 0, 0.08)` border with `var(--a-color-border-soft)`.
  - Button contracts: replace `outline` on `PButton` with `variant="secondary"`.
- **`PersonListView.vue`**:
  - Dividers: replace `rgba(0,0,0,0.05)` border-bottom with `var(--a-color-border-soft)`.
  - Button contracts: replace `outline` on `PButton` with `variant="secondary"`.
- **`PersonMapView.vue`**:
  - Colors: replace hardcoded `#ef4444`, `#059669`, `#4b5563`, `#e5e7eb` with semantic tokens (`var(--a-color-danger)`, `var(--a-color-success)`, `var(--a-color-muted)`).
  - Button contracts: replace `outline` on `PButton` with `variant="secondary"`.
- **`TimelineMyView.vue`**:
  - Standardize link cards with `border-radius: var(--a-radius-card)`.
  - Replace raw link button classes with `PButton` or standard tokenized styling.
- **`TimelineSearchView.vue`**:
  - Standardize search button and result cards with `var(--a-radius-control)` / `var(--a-radius-card)` and `var(--a-color-bg)`.

---

## 3. Verification & Safety Guarantees

- All existing unit tests in `tests/unit/views/timeline/` and `tests/unit/components/timeline/` must pass.
- `bun run type-check`: 0 errors.
- `git diff --check`: 0 formatting or whitespace warnings.
