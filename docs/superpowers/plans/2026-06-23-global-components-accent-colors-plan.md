# Global Components Dual-Accent & Flat-Paper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all global UI components to Postman Green and Vermilion Orange accent colors and apply straight corners globally.

**Architecture:** Update CSS variables usage, hover styles, and focus states in shared component styles and global CSS.

**Tech Stack:** Vue 3, SFC (Single File Components), CSS, Vitest.

## Global Constraints
- None

---

### Task 1: Global style.css Update

**Files:**
- Modify: `src/style.css:862-867`

**Interfaces:**
- Consumes: CSS variables `--a-color-accent-confirm` and `--a-color-paper`
- Produces: Updated secondary hover class `.paper-action:hover`

- [ ] **Step 1: Write the implementation**
  Modify `src/style.css` `.paper-action:hover:not(.paper-action--primary):not(:disabled)` to change background and text color to green and paper respectively:
  ```css
  .paper-action:hover:not(.paper-action--primary):not(:disabled) {
    background: var(--a-color-accent-confirm) !important;
    color: var(--a-color-paper) !important;
  }
  ```

- [ ] **Step 2: Run verification**
  Run: `bun run build`
  Expected: PASS

- [ ] **Step 3: Commit**
  ```bash
  git add src/style.css
  git commit -m "style: map global secondary paper-action hover style to confirm accent"
  ```

---

### Task 2: Buttons & Tab Hover Updates

**Files:**
- Modify: `src/components/ui/PButton.vue:174-178`
- Modify: `src/components/ui/PSheetTab.vue:54-58`
- Modify: `src/components/ui/PDiscussionFAB.vue:33-37`

**Interfaces:**
- Consumes: CSS variables `--a-color-accent-confirm`, `--a-color-accent-destructive`, `--a-color-paper`
- Produces: Updated hover styles on `PButton`, `PSheetTab` (close sheet tab), and `PDiscussionFAB`.

- [ ] **Step 1: Modify PButton secondary hover**
  Update `.p-button--secondary:hover:not(.p-button--disabled)` in `src/components/ui/PButton.vue` to use `var(--a-color-accent-confirm)` background/border-bottom-color and `var(--a-color-paper)` color.
  ```css
  .p-button--secondary:hover:not(.p-button--disabled) {
    background: var(--a-color-accent-confirm);
    color: var(--a-color-paper);
    border-bottom-color: var(--a-color-accent-confirm);
  }
  ```

- [ ] **Step 2: Modify PSheetTab close hover**
  Update `.sheet-tab:hover` in `src/components/ui/PSheetTab.vue` to use `var(--a-color-accent-destructive)` background/border-color and `var(--a-color-paper)` color.
  ```css
  .sheet-tab:hover {
    background-color: var(--a-color-accent-destructive);
    color: var(--a-color-paper);
    border-color: var(--a-color-accent-destructive);
  }
  ```

- [ ] **Step 3: Modify PDiscussionFAB hover**
  Update `.discussion-fab:hover` in `src/components/ui/PDiscussionFAB.vue` to use `var(--a-color-accent-confirm)` background and border-color.
  ```css
  .discussion-fab:hover {
    transform: translate(-4px, -50%); /* Displaces left */
    background: var(--a-color-accent-confirm);
    border-color: var(--a-color-accent-confirm);
  }
  ```

- [ ] **Step 4: Run verification**
  Run: `bun run test:unit tests/unit/ui/borderless-white-ui.spec.ts`
  Expected: PASS
  Run: `bun run build`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add src/components/ui/PButton.vue src/components/ui/PSheetTab.vue src/components/ui/PDiscussionFAB.vue
  git commit -m "style: update PButton, PSheetTab, and PDiscussionFAB hover styles to accent colors"
  ```

---

### Task 3: Fields Focus & Error States

**Files:**
- Modify: `src/components/ui/PInput.vue:93-105`
- Modify: `src/components/ui/PTextarea.vue:89-101`

**Interfaces:**
- Consumes: CSS variables `--a-color-accent-confirm`, `--a-color-accent-destructive`
- Produces: Updated focus/error borders and text colors.

- [ ] **Step 1: Modify PInput focus & error styling**
  Update `.p-input:focus`, `.p-input--error`, and `.p-field-error` in `src/components/ui/PInput.vue` to use `var(--a-color-accent-confirm)` and `var(--a-color-accent-destructive)`.
  ```css
  .p-input:focus {
    outline: none;
    border-bottom-color: var(--a-color-accent-confirm);
  }

  .p-input--error {
    border-bottom-color: var(--a-color-accent-destructive);
  }

  .p-field-error {
    color: var(--a-color-accent-destructive);
    font-size: 0.75rem;
  }
  ```

- [ ] **Step 2: Modify PTextarea focus & error styling**
  Update `.p-textarea:focus`, `.p-textarea--error`, and `.p-field-error` in `src/components/ui/PTextarea.vue` to use `var(--a-color-accent-confirm)` and `var(--a-color-accent-destructive)`.
  ```css
  .p-textarea:focus {
    outline: none;
    border-bottom-color: var(--a-color-accent-confirm);
  }

  .p-textarea--error {
    border-bottom-color: var(--a-color-accent-destructive);
  }

  .p-field-error {
    color: var(--a-color-accent-destructive);
    font-size: 0.75rem;
  }
  ```

- [ ] **Step 3: Run verification**
  Run: `bun run build`
  Expected: PASS

- [ ] **Step 4: Commit**
  ```bash
  git add src/components/ui/PInput.vue src/components/ui/PTextarea.vue
  git commit -m "style: use brand accents for focus and error states in inputs and textareas"
  ```

---

### Task 4: Dropdowns and Panels Focus, Selection, & Straight Corners

**Files:**
- Modify: `src/components/ui/PSelect.vue:151-159`, `200-212`
- Modify: `src/components/ui/PChoiceField.vue:137-140`, `187-193`
- Modify: `src/components/ui/PCountryRegionField.vue:210-214`, `280-287`, `227-235`

**Interfaces:**
- Consumes: CSS variables `--a-color-accent-confirm`, `--a-color-accent-destructive`, `--a-color-line-soft`
- Produces: Updated triggers, active marker colors, and straight-edge panels.

- [ ] **Step 1: Modify PSelect styling**
  Update `.p-select-trigger:focus-visible`, `.p-select-trigger--open`, `.p-select-trigger--error`, `.p-select-marker`, and `.p-field-error` in `src/components/ui/PSelect.vue`:
  ```css
  .p-select-trigger:focus-visible,
  .p-select-trigger--open {
    outline: none;
    border-bottom-color: var(--a-color-accent-confirm);
  }

  .p-select-trigger--error {
    border-bottom-color: var(--a-color-accent-destructive);
  }
  ```
  ```css
  .p-select-marker {
    color: var(--a-color-accent-confirm);
  }
  ```
  ```css
  .p-field-error {
    color: var(--a-color-accent-destructive);
  }
  ```

- [ ] **Step 2: Modify PChoiceField styling**
  Update `.paper-choice-trigger:focus-visible`, `.paper-choice--open .paper-choice-trigger`, `.paper-choice-option--active`, and `.paper-choice-marker` in `src/components/ui/PChoiceField.vue`:
  ```css
  .paper-choice-trigger:focus-visible,
  .paper-choice--open .paper-choice-trigger {
    outline: none;
    border-bottom-color: var(--a-color-accent-confirm);
  }
  ```
  ```css
  .paper-choice-option--active {
    color: var(--a-color-accent-confirm);
  }

  .paper-choice-marker {
    color: var(--a-color-accent-confirm);
  }
  ```

- [ ] **Step 3: Modify PCountryRegionField styling**
  Update `.paper-field-trigger:hover`, `.paper-field-trigger:focus-visible`, `.paper-field--open .paper-field-trigger`, `.paper-field-option:hover`, `.paper-field-option--active`, `.paper-field-option-marker`, and `.paper-field-panel` in `src/components/ui/PCountryRegionField.vue`:
  ```css
  .paper-field-trigger:hover,
  .paper-field-trigger:focus-visible,
  .paper-field--open .paper-field-trigger {
    outline: none;
    border-bottom-color: var(--a-color-accent-confirm);
  }
  ```
  ```css
  .paper-field-panel {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    padding: 1rem 1.05rem 1.05rem;
    border-radius: 0px;
    background: #ffffff; /* pure white */
    border: 1px solid var(--a-color-line-soft);
    box-shadow: 3px 3px 0px rgba(0, 0, 0, 0.15);
  }
  ```
  ```css
  .paper-field-option:hover,
  .paper-field-option--active {
    color: var(--a-color-accent-confirm);
  }

  .paper-field-option-marker {
    color: var(--a-color-accent-confirm);
  }
  ```

- [ ] **Step 4: Run verification**
  Run: `bun run build`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add src/components/ui/PSelect.vue src/components/ui/PChoiceField.vue src/components/ui/PCountryRegionField.vue
  git commit -m "style: apply brand accents and flat paper aesthetic to select and choice fields"
  ```

---

### Task 5: PEntry Straight Corners & Active indicator

**Files:**
- Modify: `src/components/ui/PEntry.vue:67, 80-88`

**Interfaces:**
- Consumes: CSS variable `--a-color-accent-confirm`
- Produces: Straight corners and green active/focused indicators on feed entries.

- [ ] **Step 1: Modify PEntry styling**
  Update `border-radius: 8px` to `border-radius: var(--a-radius-none, 0px)` in `.p-entry`. Update `.p-entry.is-open` box-shadow to use `var(--a-color-accent-confirm)`. Update `.p-entry.is-focused` left border-color to `border-left-color: var(--a-color-accent-confirm)` in `src/components/ui/PEntry.vue`:
  ```css
  .p-entry {
    display: block;
    text-decoration: none;
    color: inherit;
    border-bottom: 1.5px dashed var(--a-color-line-soft);
    padding: 0.75rem 1.5rem;
    margin: 0 -1.5rem;
    transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
    border-radius: var(--a-radius-none, 0px);
    cursor: pointer;
    position: relative;
    overflow: hidden;
    border-left: 4px solid transparent;
    outline: none;
  }
  ```
  ```css
  .p-entry.is-open {
    background-color: var(--a-color-paper-soft);
    box-shadow: inset -4px 0 0 var(--a-color-accent-confirm);
    border-bottom-color: transparent;
  }
  .p-entry.is-focused {
    background-color: var(--a-color-paper-wash);
    border-left-color: var(--a-color-accent-confirm);
  }
  ```

- [ ] **Step 2: Run verification**
  Run: `bun run build`
  Expected: PASS

- [ ] **Step 3: Commit**
  ```bash
  git add src/components/ui/PEntry.vue
  git commit -m "style: enforce flat border-radius and confirm accent for PEntry"
  ```
