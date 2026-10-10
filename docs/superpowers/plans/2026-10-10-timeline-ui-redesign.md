# Implementation Plan: Timeline Module UI Redesign (Pure-White Double-Notch Minimal System)

## Proposed Changes

Migrate views and components in `src/components/timeline/` and `src/views/timeline/` to the Pure-White Double-Notch Minimal System specification.

---

### Task 1: Timeline Components Refactor (`src/components/timeline/*`)

**Files:**
- Modify: `src/components/timeline/TimelineToolbar.vue`
- Modify: `src/components/timeline/TimelineRevisionProposal.vue`
- Modify: `src/components/timeline/TimelineEventDetailModal.vue`
- Test: `tests/unit/components/timeline/`

- [ ] **Step 1: Polish TimelineToolbar.vue**
  - Change `.tl-toolbar` background from `var(--a-color-surface-muted)` to `var(--a-color-bg)`.
  - Change `.tl-mode-switch` and `.tl-mode-btn` border-radius from `var(--a-radius-pill, 999px)` to `var(--a-radius-control)`.
  - Standardize `.filter-label` and `.tl-action-btn` font-weight from `550` to `500`; remove `text-transform: uppercase`.
- [ ] **Step 2: Polish TimelineRevisionProposal.vue**
  - Change `.timeline-proposals__meta` background from `var(--a-color-surface)` to `var(--a-color-bg)`.
  - Lower `label` font-weight from `700` to `500`.
  - Lower `.timeline-proposals__status` from `800` to `600`.
  - Replace `var(--a-color-accent-destructive)` with `var(--a-color-danger)`.
  - Replace `outline` prop on `PButton` with `variant="secondary"`.
- [ ] **Step 3: Polish TimelineEventDetailModal.vue**
  - Replace deprecated `outline` prop on `PButton` with `variant="secondary"`.
  - Standardize divider lines and badge tokens.
- [ ] **Step 4: Run component tests**
  ```bash
  bun run test:unit tests/unit/components/timeline/
  ```
- [ ] **Step 5: Commit changes**
  ```bash
  git commit -m "refactor(timeline): standardize timeline toolbar, revision proposals, and modal components"
  ```

---

### Task 2: Timeline Views Refactor (`src/views/timeline/*`)

**Files:**
- Modify: `src/views/timeline/TimelineHomeView.vue`
- Modify: `src/views/timeline/PersonListView.vue`
- Modify: `src/views/timeline/PersonMapView.vue`
- Modify: `src/views/timeline/TimelineMyView.vue`
- Modify: `src/views/timeline/TimelineSearchView.vue`
- Test: `tests/unit/views/timeline/`

- [ ] **Step 1: Polish TimelineHomeView.vue**
  - Change panel surfaces (`.tl-panel-empty`, `.tl-map-canvas`) to `var(--a-color-bg)`.
  - Replace raw hex colors (`#991b1b`, `#fef2f2`, `#d1d5db`) with semantic tokens (`var(--a-color-danger)` via `color-mix`, `var(--a-color-border-soft)`).
  - Replace `outline` prop on `PButton` with `variant="secondary"`.
  - Replace `rgba(0, 0, 0, 0.08)` border with `var(--a-color-border-soft)`.
- [ ] **Step 2: Polish PersonListView.vue & PersonMapView.vue**
  - In `PersonListView.vue`: replace `rgba(0,0,0,0.05)` border with `var(--a-color-border-soft)`; replace `outline` with `variant="secondary"`.
  - In `PersonMapView.vue`: replace hardcoded hex colors (`#ef4444`, `#059669`, `#4b5563`, `#e5e7eb`, `#f9fafb`, `#f0f0f0`) with semantic tokens; replace `outline` with `variant="secondary"`.
- [ ] **Step 3: Polish TimelineMyView.vue & TimelineSearchView.vue**
  - In `TimelineMyView.vue`: add `border-radius: var(--a-radius-card)` on link rows; standardize action links.
  - In `TimelineSearchView.vue`: standardize search form and card surfaces to `var(--a-color-bg)` and 4px radius.
- [ ] **Step 4: Run view tests**
  ```bash
  bun run test:unit tests/unit/views/timeline/
  ```
- [ ] **Step 5: Commit changes**
  ```bash
  git commit -m "refactor(timeline): standardize timeline views surfaces, tokens, and button contracts"
  ```

---

### Task 3: Whole-Module Integration, Full Test Suite & Branch Review

**Files:**
- All modified files
- Contract test suites: `tests/unit/ui/design-system-contract.spec.ts`

- [ ] **Step 1: Run full type check**
  ```bash
  bun run type-check
  ```
- [ ] **Step 2: Run all Timeline test suites**
  ```bash
  bun run test:unit tests/unit/views/timeline tests/unit/components/timeline tests/unit/ui/design-system-contract.spec.ts
  ```
- [ ] **Step 3: Run git diff format check**
  ```bash
  git diff --check
  ```
- [ ] **Step 4: Dispatch whole-branch code review subagent**
- [ ] **Step 5: Merge into main and push to origin**
