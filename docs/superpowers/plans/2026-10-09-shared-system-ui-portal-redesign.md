# Shared, System UI Components & PortalView Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the shared UI atoms, system shell components, shared application cards, and the PortalView home view to strictly align with the Pure-White Double-Notch Minimal System.

**Architecture:** Decompose into 4 focused incremental tasks (Core UI Atoms -> System Shell Components -> Shared Application Cards & Editor -> PortalView & Full Verification), ensuring test coverage and type-safety at every step.

**Tech Stack:** Vue 3.5, TypeScript 5.9, Vite, Vitest, Pinia, Pure-White Design Tokens.

## Global Constraints

- Surfaces: All cards, dialogs, drawers, and panels must use `#ffffff` / `var(--a-color-bg)`. No `var(--a-color-surface)`.
- Dividers: Outer borders use `var(--a-color-border)`, inner dividers use `var(--a-color-border-soft)`. No hardcoded hex or rgba borders.
- Shadows: Only `var(--a-shadow-*)` allowed. No hardcoded box-shadows.
- Corner Radii: 4px controls (`var(--a-radius-control)`) and 4px cards (`var(--a-radius-card)`).
- Typography: Titles `font-weight: 500`, active/emphasis `600`. No `650`, `700`, `800`, or `bold`.
- Copy Rules: Concise user phrasing. No developer jargon ("内部", "System", "beta", "审核", etc.) visible to users.
- Quality Gates: Zero TypeScript errors on `bun run type-check`, 100% unit test pass rate, clean `git diff --check`.

---

### Task 1: Core UI Atoms Refactor (`PButton`, `PSectionHeader`, `PPageHeader`, `PContentCard`) & Music Call Sites

**Files:**
- Modify: `src/components/ui/PButton.vue`
- Modify: `src/components/ui/PSectionHeader.vue`
- Modify: `src/components/ui/PPageHeader.vue`
- Modify: `src/components/ui/PContentCard.vue`
- Modify: `src/components/music/NestedActionDrawer.vue`
- Modify: `src/components/music/MusicEntityEditorDrawer.vue`
- Modify: `src/components/music/ArtistDrawer.vue`
- Test: `tests/unit/system/PButton.spec.ts`
- Test: `tests/unit/ui/design-system-contract.spec.ts`

**Interfaces:**
- `PButton` `variant`: `'primary' | 'secondary' | 'danger' | 'ghost'` (strictly removing `'warning'`)
- `PSectionHeader` & `PPageHeader`: `title` with `font-weight: 500`, kicker without uppercase transformation
- `PContentCard`: `font-weight: 500` for titles, semantic tokens for badges and borders

- [ ] **Step 1: Update PButton.vue & migrate warning call sites in Music**
  - In `src/components/ui/PButton.vue`: Remove `'warning'` from `Variant` type definition; remove `.p-button--warning` CSS rule.
  - In `src/components/music/NestedActionDrawer.vue`: Change `variant="warning"` to `variant="primary"` on lines 638 and 742.
  - In `src/components/music/MusicEntityEditorDrawer.vue`: Change `variant="warning"` to `variant="primary"` on line 581.
  - In `src/components/music/ArtistDrawer.vue`: Change `variant="warning"` to `variant="primary"` on line 630.

- [ ] **Step 2: Update PSectionHeader.vue, PPageHeader.vue & PContentCard.vue**
  - In `src/components/ui/PSectionHeader.vue`: Change `.p-section-header__title` font-weight to `500`; remove `text-transform: uppercase;` on `.p-section-header__kicker`.
  - In `src/components/ui/PPageHeader.vue`: Change `.p-page-header__title` font-weight to `500`; remove `text-transform: uppercase;` on `.p-page-header__kicker`.
  - In `src/components/ui/PContentCard.vue`: Change `.feed-entry-title` font-weight to `500`; replace `#10b981` with `var(--a-color-success)`; replace `color-mix` dividers with `var(--a-color-border-soft)`.

- [ ] **Step 3: Verify Task 1 with unit tests & type-check**
  - Run `bun run test:unit tests/unit/system/PButton.spec.ts tests/unit/ui/design-system-contract.spec.ts`.
  - Run `bun run type-check`.

- [ ] **Step 4: Commit Task 1**
  - Commit message: `refactor(ui): standardize core UI atoms and remove warning button variant`.

---

### Task 2: System Shell Components Polish (`AppTopbar`, `AppTopbarGlobalSearch`, `MobileBottomNav`, `NotificationToastStack`, `SiteFooter` suite)

**Files:**
- Modify: `src/components/system/AppTopbar.vue`
- Modify: `src/components/system/AppTopbarGlobalSearch.vue`
- Modify: `src/components/system/MobileBottomNav.vue`
- Modify: `src/components/system/NotificationToastStack.vue`
- Modify: `src/components/system/SiteFooter.vue`
- Modify: `src/components/system/footer/SiteFooterSheet.vue`
- Modify: `src/components/system/footer/SiteAboutContent.vue`
- Modify: `src/components/system/footer/SitePolicyContent.vue`
- Modify: `src/components/system/AppTopbarAuthControls.vue`
- Modify: `src/components/system/TopbarSearchSection.vue`

**Interfaces:**
- `AppTopbar`: Solid pure-white background, no `beta` label, `PButton` for action.
- `AppTopbarGlobalSearch`: Solid pure-white modal, standard font-weights, concise search state copy.
- Footer suite: Headings `font-weight: 500`, clean drawer title.

- [ ] **Step 1: Polish AppTopbar.vue and AppTopbarGlobalSearch.vue**
  - In `AppTopbar.vue`: Remove `.logo-notice` (`beta`); change header background to solid `var(--a-color-bg)` with `border-bottom: 1px solid var(--a-color-border)` (remove blur and semi-transparency); replace raw login link with `<PButton to="/login" size="sm">登录</PButton>`.
  - In `AppTopbarAuthControls.vue`: Update font-weight fallbacks to `600`.
  - In `AppTopbarGlobalSearch.vue`: Make `.palette-modal` solid `var(--a-color-bg)` with `border: 1px solid var(--a-color-border)`; update `.palette-overlay` color; adjust font-weights to 500/600; change searching text to "正在搜索...".
  - In `TopbarSearchSection.vue`: Change header `font-weight` to 500 and remove `text-transform: uppercase`.

- [ ] **Step 2: Polish MobileBottomNav.vue, NotificationToastStack.vue & SiteFooter suite**
  - In `MobileBottomNav.vue`: Change `.mobile-bottom-nav__bar` background to `var(--a-color-bg)`.
  - In `NotificationToastStack.vue`: Change `.notification-toast` background to `var(--a-color-bg)` and title font-weight to `500`.
  - In `SiteFooter.vue`: Remove `title="需要管理员权限"` tooltip.
  - In `SiteFooterSheet.vue`: Change sheet title to `Atoman · 关于`; set h3 font-weight to `500`.
  - In `SiteAboutContent.vue` & `SitePolicyContent.vue`: Change h3 / title font-weight to `500`.

- [ ] **Step 3: Verify Task 2 with unit tests & type-check**
  - Run `bun run type-check`.
  - Run `bun run test:unit tests/unit/components/system/` (or matching tests).

- [ ] **Step 4: Commit Task 2**
  - Commit message: `refactor(system): standardize system shell components to pure-white minimal system`.

---

### Task 3: Shared Application Components Polish (`PEditorRuntime`, `InteractionBar`, `RatingControl`, `BlogItemCard`, `PVideoCard`)

**Files:**
- Modify: `src/components/shared/PEditorRuntime.vue`
- Modify: `src/components/shared/InteractionBar.vue`
- Modify: `src/components/shared/RatingControl.vue`
- Modify: `src/components/shared/BlogItemCard.vue`
- Modify: `src/components/shared/PVideoCard.vue`
- Test: `tests/unit/components/shared/` (or matching tests)

**Interfaces:**
- `PEditorRuntime`: Valid SFC syntax, pure-white backgrounds for code preview/presence, soft dividers.
- `InteractionBar`: Semantic tokens for like (`var(--a-color-danger)`) and bookmark (`var(--a-color-warning)`).
- `RatingControl`: Semantic tokens for star ratings.
- Cards: Free of fallback non-token hex colors.

- [ ] **Step 1: Fix and polish PEditorRuntime.vue**
  - Move dangling `.p-editor-label {}` inside `<style scoped>`.
  - Replace `var(--a-color-surface)` with `var(--a-color-bg)` in `.p-editor-presence` and markdown preview code widgets.
  - Replace `.tb-sep` background `#d1d5db` with `var(--a-color-border-soft)`.
  - Replace raw `#000` / `#fff` and font-weight `700` fallbacks.

- [ ] **Step 2: Polish InteractionBar.vue and RatingControl.vue**
  - In `InteractionBar.vue`: Map active like state to `var(--a-color-danger)`; map active bookmark state to `var(--a-color-warning)`.
  - In `RatingControl.vue`: Map rating numbers and stars to `var(--a-color-warning)` and `var(--a-color-border)`.

- [ ] **Step 3: Polish BlogItemCard.vue and PVideoCard.vue**
  - In `BlogItemCard.vue`: Remove fallback non-token `#3b82f6`; map RSS tag to semantic token.
  - In `PVideoCard.vue`: Remove hardcoded fallback `#2563eb` and `#18181b`; use standard tokens for avatar and border.

- [ ] **Step 4: Verify Task 3 with unit tests & type-check**
  - Run `bun run type-check`.
  - Run `bun run test:unit tests/unit/components/shared/`.

- [ ] **Step 5: Commit Task 3**
  - Commit message: `refactor(shared): polish shared components and fix PEditorRuntime syntax`.

---

### Task 4: Portal View Redesign (`PortalView.vue`) & Full System Integration

**Files:**
- Modify: `src/views/portal/PortalView.vue`
- Test: `tests/unit/views/portal/` (or matching tests)
- Test: `tests/unit/ui/design-system-contract.spec.ts`

**Interfaces:**
- `PortalView`: Pure-white hero and module strips, semantic tokens for tags, font-weight 500, concise user copy.

- [ ] **Step 1: Redesign PortalView.vue**
  - Change `.portal-hot__hero` and `.portal-hot__module-strip` backgrounds to pure-white `var(--a-color-bg)` with standard border `var(--a-color-border)`.
  - Map debate tags, Pro/Con badges, music tags, video tags, and unread bar to semantic tokens (`primary`, `danger`, `success`, `warning`).
  - Standardize title font-weights to `500`.
  - Refine hero title and description to concise user guidance per `AGENTS.md`.

- [ ] **Step 2: Full quality gate verification**
  - Run `bun run type-check`.
  - Run `bun run test:unit tests/unit/ui/design-system-contract.spec.ts`.
  - Run `git diff --check`.

- [ ] **Step 3: Commit Task 4**
  - Commit message: `refactor(portal): overhaul PortalView to pure-white minimal system`.

- [ ] **Step 4: Merge to main and push to remote**
  - Switch to `main`.
  - `git merge --no-ff feature/shared-system-ui-portal-refactor`.
  - Push to `origin/main`.
  - Clean up feature branch.
