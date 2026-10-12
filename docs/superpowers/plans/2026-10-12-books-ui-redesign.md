# Books UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the Books module (catalog, work details, governance, reader views, and components) in `Atoman-Frontend` to strictly adhere to the Pure-White Double-Notch Minimal System.

**Architecture:** Standardize components and views by replacing hardcoded colors (`#ffffff`, `#e2e8f0`, `#2563eb`), removing 999px pills on progress indicators and badges, replacing raw forms with `PSelect`/`PInput`/`PTextarea`/`PButton`, and lowering typography weights to 500/600 while preserving existing test contracts and routing behaviors.

**Tech Stack:** Vue 3.5, TypeScript 5.9, Vite, Pinia 3, Tabler Icons, Vitest.

## Global Constraints

- Surfaces: Solid pure-white surfaces use `var(--a-color-bg)` or `#ffffff`. Muted surfaces use `var(--a-color-surface-muted)`. Never use `var(--a-color-surface)` as card or panel backgrounds.
- Dividers: Boundaries use `var(--a-color-border)`, inner separators use `var(--a-color-border-soft)`. Never use hardcoded hex values like `#e2e8f0`.
- Shadows: Only `var(--a-shadow-*)` tokens or `none`. No raw rgba box-shadows.
- Radius: Standard controls and cards use `var(--a-radius-card)` and `var(--a-radius-control)` (4px). Never use `border-radius: 999px` or non-standard radii.
- Typography: Headings and titles use `font-weight: 500`. Strong/active states use `font-weight: 600`. Never use `700`, `800`, or `bold`.
- Buttons & Controls: Only `PButton` (variants: `primary`, `secondary`, `danger`, `ghost`). Use `PInput`, `PSelect`, `PTextarea`.
- Copy: Concise, user-natural language. No developer-facing jargon or uppercase kickers.

---

### Task 1: Books Components Polish (`BookCard.vue`, `BookCover.vue`, `BookPrivateUpload.vue`)

**Files:**
- Modify: `src/components/books/BookCard.vue`
- Modify: `src/components/books/BookCover.vue`
- Modify: `src/components/books/BookPrivateUpload.vue`
- Test: `tests/unit/components/BookCover.spec.ts`

**Interfaces:**
- Consumes: Design system CSS variables in `style.css`, `PButton.vue`
- Produces: Standardized book card, book cover, and private upload components

- [ ] **Step 1: Audit and update `BookCard.vue` styles**
  - Verify border-radius is `var(--a-radius-card)`.
  - Ensure outline on `:focus-visible` uses `var(--a-color-primary)`.
  - Verify heading and authors font-weight is 500 and secondary text uses `var(--a-color-muted)`.

- [ ] **Step 2: Audit and update `BookCover.vue` styles**
  - Verify fallback container uses `var(--a-radius-card)`, `var(--a-color-surface-muted)`, and `var(--a-color-border-soft)`.
  - Ensure text line clamp and typography font-weight align with standard 500.

- [ ] **Step 3: Update `BookPrivateUpload.vue` styles and semantics**
  - In `src/components/books/BookPrivateUpload.vue`, update list dividers to `var(--a-color-border-soft)`.
  - Standardize error message to `var(--a-color-danger)` and feedback to `var(--a-color-muted)`.
  - Ensure header button uses `PButton variant="secondary"`.
  - Standardize strong text to `font-weight: 500`.

- [ ] **Step 4: Verify component unit tests**
  - Run `bun run test:unit tests/unit/components/BookCover.spec.ts`.
  - Confirm tests pass cleanly.

- [ ] **Step 5: Commit changes**
  - Commit: `refactor(books): standardize book card, cover, and private upload components`

---

### Task 2: Books Home, Work Detail & Edition Views Polish (`BooksHomeView.vue`, `BookWorkView.vue`, `BookEditionView.vue`, `BooksLayout.vue`)

**Files:**
- Modify: `src/views/books/BooksHomeView.vue`
- Modify: `src/views/books/BookWorkView.vue`
- Modify: `src/views/books/BookEditionView.vue`
- Modify: `src/views/books/BooksLayout.vue`
- Test: `tests/unit/views/books-home.spec.ts`
- Test: `tests/unit/views/book-work.spec.ts`

**Interfaces:**
- Consumes: `BookCard.vue`, `BookCover.vue`, `BookPrivateUpload.vue`, `PSelect`, `PButton`, `PInput`, `PTextarea`, `PLink`
- Produces: Polished book discovery catalog, work details drawer, edition view, and layout wrapper

- [ ] **Step 1: Polish `BooksHomeView.vue`**
  - In `src/views/books/BooksHomeView.vue`:
    - Remove all `border-radius: 999px` on `.books-continue-list progress`, replacing with `border-radius: var(--a-radius-control)` (4px).
    - Standardize shelf and catalog dividers to `var(--a-color-border-soft)`.
    - Standardize font-weights on header `h2`, tags, and statistics to 500.
    - Standardize focus outline to `var(--a-color-primary)`.
    - Ensure filter inputs and buttons use `PSelect` and `PButton`.

- [ ] **Step 2: Polish `BookWorkView.vue`**
  - In `src/views/books/BookWorkView.vue`:
    - Verify shelf selector uses `PSelect` with `PButton variant="secondary"`.
    - Standardize review form with `PTextarea` and `PSelect`.
    - Lower section title `h2` and item headers to `font-weight: 500`.
    - Standardize list borders to `var(--a-color-border-soft)` and error feedback to `var(--a-color-danger)`.

- [ ] **Step 3: Polish `BookEditionView.vue` and `BooksLayout.vue`**
  - In `src/views/books/BookEditionView.vue`:
    - Standardize facts definition list (`dl.books-edition-facts`) borders to `var(--a-color-border-soft)`.
    - Ensure title font-weight is 500 and back link uses `var(--a-color-muted)` hovering to `var(--a-color-fg)`.
  - In `src/views/books/BooksLayout.vue`:
    - Verify `PSheet` title and content frame integration.

- [ ] **Step 4: Run unit tests for home and work views**
  - Run `bun run test:unit tests/unit/views/books-home.spec.ts tests/unit/views/book-work.spec.ts`.
  - Confirm all tests pass.

- [ ] **Step 5: Commit changes**
  - Commit: `refactor(books): polish books home, work detail, and edition views`

---

### Task 3: Books Governance & Moderation Polish (`BooksGovernanceView.vue`)

**Files:**
- Modify: `src/views/books/BooksGovernanceView.vue`
- Test: `tests/unit/views/books-governance.spec.ts`

**Interfaces:**
- Consumes: `PPageHeader`, `PInput`, `PTextarea`, `PButton`
- Produces: Polished book submission and moderation review view

- [ ] **Step 1: Inspect and tokenize `BooksGovernanceView.vue`**
  - Replace hardcoded hex background at line 513 `color-mix(in srgb, var(--a-color-danger) 8%, #ffffff)` with `color-mix(in srgb, var(--a-color-danger) 8%, var(--a-color-bg))`.
  - Standardize cards and lists: replace hardcoded borders with `var(--a-color-border-soft)` and background with `var(--a-color-bg)`.
  - Ensure title and card headers use `font-weight: 500` (emphasis `600`).
  - Standardize error feedback to `var(--a-color-danger)`.

- [ ] **Step 2: Verify governance unit tests**
  - Run `bun run test:unit tests/unit/views/books-governance.spec.ts`.
  - Confirm all 4 tests pass.

- [ ] **Step 3: Commit changes**
  - Commit: `refactor(books): modernize books governance view to pure-white minimal system`

---

### Task 4: Books Reader Views Polish (`BookReaderView.vue`, `BookPublicReaderView.vue`)

**Files:**
- Modify: `src/views/books/BookReaderView.vue`
- Modify: `src/views/books/BookPublicReaderView.vue`
- Test: `tests/unit/views/book-reader.spec.ts`
- Test: `tests/unit/views/book-public-reader.spec.ts`

**Interfaces:**
- Consumes: `PPageHeader`, `PButton`, `epubjs`, `pdfjs-dist`
- Produces: Polished reader views for private and public books

- [ ] **Step 1: Polish `BookPublicReaderView.vue`**
  - In `src/views/books/BookPublicReaderView.vue`:
    - Replace all hardcoded `#ffffff` backgrounds with `var(--a-color-bg)`.
    - Replace all `var(--a-color-border-soft, #e2e8f0)` with `var(--a-color-border-soft)`.
    - Standardize toolbar buttons and pagination controls: use `PButton` or slimmed 4px radius controls (`var(--a-radius-control)`).
    - Lower heading and toolbar font-weights to 500.
    - Replace raw outline focus with standard design system focus rings.

- [ ] **Step 2: Polish `BookReaderView.vue`**
  - In `src/views/books/BookReaderView.vue`:
    - Replace all hardcoded `#ffffff` backgrounds (lines 506-722) with `var(--a-color-bg)`.
    - Replace all `var(--a-color-border-soft, #e2e8f0)` with `var(--a-color-border-soft)`.
    - Standardize column-rule and text reading area with design system tokens.
    - Standardize TOC, formatting controls, and progress indicators to `var(--a-radius-control)`.
    - Ensure heading font-weight is 500.

- [ ] **Step 3: Run reader unit tests**
  - Run `bun run test:unit tests/unit/views/book-reader.spec.ts tests/unit/views/book-public-reader.spec.ts`.
  - Confirm all tests pass.

- [ ] **Step 4: Commit changes**
  - Commit: `refactor(books): overhaul book reader views with semantic tokens and pure-white styling`

---

### Task 5: End-to-End Books Verification & Contract Synchronization

**Files:**
- Test: `tests/unit/views/books*.spec.ts`
- Test: `tests/unit/views/book*.spec.ts`
- Test: `tests/unit/config/books-module.spec.ts`
- Test: `tests/unit/ui/design-system-contract.spec.ts`

- [ ] **Step 1: Run full books unit test suite**
  - Run `bun run test:unit tests/unit/views/book* tests/unit/views/books* tests/unit/components/BookCover.spec.ts tests/unit/config/books-module.spec.ts tests/unit/api/books.spec.ts`.
  - Confirm 100% pass (35+ tests).

- [ ] **Step 2: Run design system contract tests**
  - Run `bun run test:unit tests/unit/ui/design-system-contract.spec.ts`.
  - Confirm 0 contract violations.

- [ ] **Step 3: Run TypeScript type-check**
  - Run `bun run type-check`.
  - Confirm 0 type errors.

- [ ] **Step 4: Run production build**
  - Run `bun run build`.
  - Confirm build succeeds.

- [ ] **Step 5: Check git status and whitespace**
  - Run `git diff --check`.
