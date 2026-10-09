# Forum & Debate UI Redesign Design Spec

- **Date:** 2026-10-09
- **Scope:** Atoman-Frontend Forum (`src/views/forum/*`, `src/components/forum/*`) and Debate (`src/views/debate/*`, `src/components/debate/*`) modules
- **Design System Benchmark:** Pure-White Double-Notch Minimal System (`style.css`, `design_system.md`, `AGENTS.md`)

---

## 1. Context & Objectives

Following the completed redesigns of Books, Studio, Core Atoms, System Shell, and the Portal facade, this specification targets the **Forum (论坛)** and **Debate (辩题)** modules.

### Design Principles & Contract Rules

1. **R1 纯白表面 (Pure-White Surfaces):**
   - Cards, dialogs, drawers, node canvases, and tables must use solid pure-white (`#ffffff` / `var(--a-color-bg)`).
   - Card hovers must NOT change background to gray (`var(--a-color-surface-muted)` or `var(--a-color-surface)`); card surface remains pure white, highlighting via border transition.
   - Table headers (`th`), restored draft alerts, and debate node expanders use `var(--a-color-bg)`.

2. **R2 柔和分界 (Soft Dividers):**
   - Outer card and panel borders use `var(--a-color-border)` (`#cbd5e1`).
   - Internal dividing lines and separators use `var(--a-color-border-soft)` (`#e2e8f0`).
   - Strictly eradicate `rgba(0,0,0,x)` or hardcoded hex for dividers.

3. **R3 阴影收敛 (Minimal Shadows):**
   - Global shadows strictly tokenized (`var(--a-shadow-*)` or `none`).
   - VueFlow controls and node blocks use crisp 1px borders with `box-shadow: none`.

4. **R4 4px 紧凑圆角 (4px Controlled Radius):**
   - All controls, cards, badges, stamps, and debate stance bars standardized to `var(--a-radius-card)` / `var(--a-radius-control)` (4px).
   - Eradicate `999px` pill radii on stamps and stance progress bars (`.debate-node__stamp`, `.stance-bar`, `.stance-bar__pro`, `.stance-bar__con`).

5. **R5 克制字重 (Restrained Typography):**
   - Standard headings, card titles, and section titles strictly `font-weight: 500`.
   - Emphasis states, active tabs, and badges `font-weight: 500` or `600`.
   - Eradicate `var(--a-font-weight-black)` (700–900), `var(--a-font-weight-strong)` (700) from triggers, badges, and numbers.
   - Numbers and counters use `font-variant-numeric: tabular-nums`.

6. **R6 & R10 语义色彩令牌 (Semantic Color Tokens):**
   - Pro stances, primary tags, active tabs use `var(--a-color-primary)` (`#2563eb`).
   - Con stances, negative errors, warnings use `var(--a-color-danger)` (`#dc2626`) and `var(--a-color-warning)` (`#d97706`).
   - Eradicate `var(--a-color-accent-destructive)` in favor of `var(--a-color-danger)`.

7. **R7 & R9 组件契约与表单升级 (Component Contracts):**
   - Primary actions strictly use `PButton`.
   - Inputs and filters use `PInput`, `PSelect`, `PTab`, `PEditor`.

8. **R8 用户视角文案规范 (User-Facing Copy):**
   - Eradicate developer/system jargon.
   - Remove forced uppercase styling (`text-transform: uppercase`) on badges and kickers.

---

## 2. Module Component Breakdown

### 2.1 Debate Module
- `DebateHomeView.vue`:
  - Hover state on `.debate-card` retains solid `var(--a-color-bg)` (border transitions to `var(--a-color-border)`).
  - Stance bar progress (`.stance-bar`, `.stance-bar__pro`, `.stance-bar__con`) standardizes to 4px border radius.
  - Stamp and status badges use `var(--a-radius-control)` and `font-weight: 500`/`600`.
- `DebateTopicView.vue`:
  - Verified clean; ensure any inline reference styles and tabs strictly adhere to 500 title weights.
- `DebateGraphNode.vue`:
  - Standardize `.debate-node__stamp` and indicator pip to `var(--a-radius-control)` (4px).
- `DebateRelationGraph.vue`:
  - Verified clean; controls and canvas background tokenized.
- `DebateRevisionSheet.vue` & `DebateWikiEditor.vue`:
  - Replace `var(--a-color-accent-destructive)` with `var(--a-color-danger)`.
  - Standardize label font-weights to 500.

### 2.2 Forum Module
- `ForumHomeView.vue`:
  - Category trigger `.p-select-trigger` font-weight changed from `var(--a-font-weight-black)` to `500`.
  - Badges `.tr-badge` font-weight changed from `var(--a-font-weight-black)` to `500`; remove `text-transform: uppercase` on pinned/closed badges.
  - Author and meta text font-weight updated from `var(--a-font-weight-strong)` to `500`.
- `ForumTopicView.vue`:
  - `.topic-status-badge`: change font-weight to `500`, remove `text-transform: uppercase`.
  - `.topic-stat-num`: change font-weight from `var(--a-font-weight-black)` to `500` with `font-variant-numeric: tabular-nums`.
  - Change `font-weight: var(--a-font-weight-strong)` to `600`.
  - Table headers `th` background changed from `var(--a-color-disabled-bg)` to `var(--a-color-bg)`.
  - Restored draft notice `.draft-restored` background changed from `var(--a-color-surface)` to `var(--a-color-bg)`.
- `ForumNewTopicView.vue`:
  - Remove `var(--a-font-weight-strong)` in empty category note, set to `500`.
  - Standardize tag inputs and action buttons.

---

## 3. Verification & Acceptance Criteria

1. **Type Checking:** `bun run type-check` passes with 0 errors.
2. **Unit & Contract Testing:**
   - `bun run test:unit tests/unit/views/debate tests/unit/views/forum tests/unit/components/debate` all pass (77+ tests).
   - Design system contracts in `tests/unit/ui/design-system-contract.spec.ts` pass.
3. **Format Integrity:** `git diff --check` passes with 0 trailing whitespace or format issues.
