# Shared, System UI Components & PortalView Redesign Specification

**Date**: 2026-10-09
**Status**: Approved (Brainstorming Phase)
**Branch**: `feature/shared-system-ui-portal-refactor`
**Reference**: `docs/superpowers/audits/2026-10-09-ui-audit.md`, `design_system.md`, `AGENTS.md`

---

## 1. Executive Summary & Goals

This project resolves all systematic UI defects discovered in the **Shared Components, System Shell Components, Core UI Atoms, and the Portal View (`PortalView.vue`)** to strictly align with the **Pure-White Double-Notch Minimal System**.

### Primary Objectives:
1. **Foundation Alignment (R1, R2, R4, R5, R10)**:
   - Ensure all cards, overlays, dialogs, drawers, and panels render with `#ffffff` / `var(--a-color-bg)`.
   - Soft dividers and borders use `var(--a-color-border)` and `var(--a-color-border-soft)`.
   - Eliminate hardcoded hex values, non-token colors, and ad-hoc semi-transparent backdrops (`backdrop-filter`).
   - Standardize font-weights (titles at `500`, emphasis at `600`, no `650`/`700`/`800`/`bold`).
2. **Component Contract Strictness (R7, R9)**:
   - Deprecate and remove unauthorized `variant="warning"` in `PButton.vue`. Migrate all 4 existing music drawer call sites to `variant="primary"`.
   - Fix SFC syntax error in `PEditorRuntime.vue` (dangling CSS outside `</style>`).
   - Fix header components (`PSectionHeader`, `PPageHeader`) font-weights and eliminate forced uppercase transformations.
3. **Portal Experience & Copy Conciseness (R8)**:
   - Refactor `PortalView.vue` to pure-white surfaces, map colorful feed/debate/music/video tags to official design tokens, and streamline marketing slogans into concise user-facing copy per `AGENTS.md`.

---

## 2. Detailed Technical Scope & File Plan

### Part 1: Core UI Atoms (`src/components/ui/`)

1. **`PButton.vue`**:
   - Remove `'warning'` variant from props definition `type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'`.
   - Remove `.p-button--warning` CSS block containing hardcoded hex colors (`#eab308`, `#ca8a04`, etc.).
   - Migrate call sites in:
     - `src/components/music/NestedActionDrawer.vue` (2 places) -> `variant="primary"`
     - `src/components/music/MusicEntityEditorDrawer.vue` (1 place) -> `variant="primary"`
     - `src/components/music/ArtistDrawer.vue` (1 place) -> `variant="primary"`
2. **`PSectionHeader.vue`**:
   - Change `.p-section-header__title` font-weight from `600` to `500`.
   - Remove `text-transform: uppercase;` on kicker.
3. **`PPageHeader.vue`**:
   - Change `.p-page-header__title` font-weight from `600` to `500`.
   - Remove `text-transform: uppercase;` on kicker.
4. **`PContentCard.vue`**:
   - Change `.feed-entry-title` font-weight from `550` to `500`.
   - Replace `#10b981` badge with `var(--a-color-success)`.
   - Replace `color-mix` divider lines with `var(--a-color-border-soft)`.

---

### Part 2: System Shell & Layout Components (`src/components/system/`)

1. **`AppTopbar.vue`**:
   - Replace semi-transparent background and blur (`rgba(255, 255, 255, 0.58); backdrop-filter: blur(18px);`) with solid pure-white: `background: var(--a-color-bg); border-bottom: 1px solid var(--a-color-border);`.
   - Remove `<span class="logo-notice">beta</span>` badge.
   - Replace raw `<RouterLink class="a-btn a-btn--primary a-btn--sm">` login button with `<PButton>`.
2. **`AppTopbarGlobalSearch.vue`**:
   - Replace `.palette-modal` translucent background and blur with solid `var(--a-color-bg)` and `border: 1px solid var(--a-color-border)`.
   - Replace non-token overlay `#000 45%` with `color-mix(in srgb, var(--a-color-text) 45%, transparent)`.
   - Standardize font-weights (convert `550` / `650` to `500` / `600`).
   - Change searching state text from "正在智能检索全站内容..." to concise "正在搜索...".
3. **`MobileBottomNav.vue`**:
   - Change `.mobile-bottom-nav__bar` background from `var(--a-color-surface)` to `var(--a-color-bg)`.
4. **`NotificationToastStack.vue`**:
   - Change `.notification-toast` background from `var(--a-color-surface)` to `var(--a-color-bg)`.
   - Change `.notification-toast__title` font-weight from `600` to `500`.
5. **Footer & Footer Sheets (`src/components/system/footer/`, `SiteFooter.vue`)**:
   - Fix headings in `SiteAboutContent.vue`, `SitePolicyContent.vue`, and `SiteFooterSheet.vue` from `600` / `black` to `500`.
   - Standardize drawer title in `SiteFooterSheet.vue` from `关于-Atoman` to `Atoman · 关于`.
   - Remove developer-centric tooltip text in `SiteFooter.vue`.

---

### Part 3: Shared Application Components (`src/components/shared/`)

1. **`PEditorRuntime.vue`**:
   - Fix SFC syntax error: move `.p-editor-label {}` inside `<style scoped>`.
   - Replace `var(--a-color-surface)` with `var(--a-color-bg)` in `.p-editor-presence` and markdown preview code widgets.
   - Replace `.tb-sep` background `#d1d5db` with `var(--a-color-border-soft)`.
   - Remove raw `#000` / `#fff` and font-weight `700` fallbacks.
2. **`InteractionBar.vue`**:
   - Map active like state to `var(--a-color-danger)` (replacing `#e11d48`).
   - Map active bookmark state to `var(--a-color-warning)` (replacing `#d97706`).
3. **`RatingControl.vue`**:
   - Map star and numerical ratings to semantic tokens (`var(--a-color-warning)` and `var(--a-color-text-secondary)`).
4. **`BlogItemCard.vue` & `PVideoCard.vue`**:
   - Clean up fallback non-token hex colors (`#3b82f6`, `#18181b`, `#000`, `#fff`).

---

### Part 4: Portal View (`src/views/portal/PortalView.vue`)

1. **Surfaces & Layout**:
   - Set `.portal-hot__hero` and `.portal-hot__module-strip` backgrounds to pure-white `var(--a-color-bg)` with standard border `var(--a-color-border)`.
2. **Colors & Tag Pills**:
   - Map debate tags from `#6366f1` / `#3730a3` to `var(--a-color-primary)`.
   - Map debate Pro/Con indicators to `var(--a-color-primary)` and `var(--a-color-danger)`.
   - Map feed tags, music tags, and video tags from hardcoded purples/oranges to design tokens.
   - Replace unread bar `#10b981` with `var(--a-color-success)`.
3. **Typography & Copy**:
   - Standardize titles (`.portal-hot__debate-title`, `.portal-hot__section-head h2`) to `font-weight: 500`.
   - Refactor marketing hero text:
     - Title: "内容聚合" (or concise equivalent)
     - Subtitle: "探索全站精选与最新动态"

---

## 3. Verification & Quality Gates

1. **Type Checking**:
   - `bun run type-check` must pass with 0 errors.
2. **Unit Tests**:
   - Core UI & shared component tests:
     - `bun run test:unit tests/unit/system/PButton.spec.ts`
     - `bun run test:unit tests/unit/ui/design-system-contract.spec.ts`
     - `bun run test:unit tests/unit/views/portal/` (if any)
     - `bun run test:unit tests/unit/components/music/`
3. **Formatting & Git Quality**:
   - `git diff --check` passes cleanly without trailing whitespace.
4. **Visual & Behavioral Consistency**:
   - Preserves all interaction states, routing hooks, and ARIA labels.
