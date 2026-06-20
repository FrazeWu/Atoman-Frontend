# Flat Paper-Stacking UI Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor and refine all UI and Shared components in the Atoman Frontend project to achieve a highly consistent "Borderless White / Flat Paper-Stacking UI" aesthetic. This means removing boxed four-sided borders in favor of bottom/left borders, replacing diffuse shadows with hard offset shadows, updating select buttons and dropdown panels, and implementing a cascading stacking logic for sliding sheets.

**Architecture:** Update global styling variables in `src/style.css` to govern border-radius, shadows, and transition helpers, then individually refactor Vue components to apply direct local inline styling overrides or new CSS rules matching the spec.

**Tech Stack:** Vue 3.5, Vite, TypeScript 5.9, Tailwind CSS v4.

## Global Constraints
* No four-sided borders for layout elements — replace with left/bottom borders.
* Absolute straight corners (`border-radius: 0px`) for buttons, textareas, inputs, and dropdown panels.
* Card/surface items use `border-radius: 8px` with bottom dashed border line and hover left ink highlight.
* All overlay shadows replaced by hard paper shadows (e.g. `3px 3px 0px rgba(0, 0, 0, 0.15)`).
* Secondary button hover uses Morandi Kraft Paper wash (`#f4ece1`) and coffee-brown text/border (`#6b4f3a`).
* Success toast uses light green (`#f0fdf4` / `#166534`), failure toast uses light red (`#fef2f2` / `#991b1b`).
* Verify type safety with `bun run type-check` at the end of each task.

---

### Task 1: Global Style Settings
Update the global style rules in `src/style.css` to define the unified border-radius, hard shadows, and highlight colors.

**Files:**
* Modify: `src/style.css:1-60`

**Interfaces:**
* Consumes: Existing CSS variables in `src/style.css`
* Produces: Updated global CSS variables for UI-wide usage

- [ ] **Step 1: Modify CSS variables in `src/style.css`**
  Modify lines 27 to 43 to replace soft shadows with hard shadows and adjust standard radius variables:
  ```css
    --a-border-width: 1px;
    --a-border-style: solid;
    --a-border-color: var(--a-color-border);
    --a-border: var(--a-border-width) var(--a-border-style) var(--a-border-color);

    --a-radius-none: 0px;

    /* Hard paper stack shadows */
    --a-shadow-button: none;
    --a-shadow-dropdown: 3px 3px 0px rgba(0, 0, 0, 0.15);
    --a-shadow-modal: 4px 4px 0px rgba(0, 0, 0, 0.15);
    --a-shadow-pressed: none;
    --a-shadow-paper-sm: none;
    --a-shadow-paper-md: none;
    --a-shadow-paper-lg: none;
    --a-shadow-hover: none;
    --a-shadow-active: none;
  ```

- [ ] **Step 2: Run type check**
  Run: `bun run type-check`
  Expected: Success, no compilation errors.

- [ ] **Step 3: Commit**
  ```bash
  git add src/style.css
  git commit -m "style: update global variables to define flat paper hard shadows"
  ```

---

### Task 2: Refactor Buttons, Badges, and Clips
Modify the button, badge, clip, and discussion floating action button (FAB) to follow straight-corner designs and bottom-border highlights.

**Files:**
* Modify: `src/components/ui/PButton.vue`
* Modify: `src/components/ui/PBadge.vue`
* Modify: `src/components/ui/PClip.vue`
* Modify: `src/components/ui/PDiscussionFAB.vue`

**Interfaces:**
* Consumes: `src/style.css` variables
* Produces: Updated button, badge, clip, and FAB components

- [ ] **Step 1: Rewrite `src/components/ui/PButton.vue`**
  1. Add optional `dot` prop to defineProps.
  2. Change `.p-button` from `border-radius: 999px` to `border-radius: 0px`.
  3. Under `.p-button--secondary`, change from 4-sided borders to bottom border only:
     ```css
     .p-button--secondary {
       background: transparent;
       color: var(--a-color-ink-soft);
       border-bottom: 2px solid var(--a-color-line);
     }
     .p-button--secondary:hover:not(.p-button--disabled) {
       background: #f4ece1; /* Kraft paper wash */
       color: #6b4f3a; /* Walnut brown */
       border-bottom-color: #6b4f3a;
     }
     ```
  4. Under `.p-button--disabled`, add `text-decoration: line-through`.
  5. Check `.p-button-dot` to render only if `props.dot` is true:
     ```html
     <span v-if="dot" class="p-button-dot" aria-hidden="true" />
     ```

- [ ] **Step 2: Review `src/components/ui/PBadge.vue`**
  Ensure it uses `border-radius: 0` (which it does) and remains monochrome/neutral without Morandi colors. No change is needed since B was chosen, but double check.

- [ ] **Step 3: Review `src/components/ui/PClip.vue`**
  Ensure active state remains Option B (Classic Inverted Black Block). No change is needed since B was chosen.

- [ ] **Step 4: Rewrite `src/components/ui/PDiscussionFAB.vue`**
  Change rounded corners to straight-corners, replace shadow with hard shadow, keep hover displacement, and change background to brand walnut brown on hover:
  ```css
  .discussion-fab {
    position: fixed;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 36px;
    padding: 1.5rem 0;
    background: var(--a-color-ink);
    border: 1px solid var(--a-color-ink);
    border-right: none;
    border-radius: 0px; /* Straight corner */
    box-shadow: -2px 2px 0px rgba(0, 0, 0, 0.15); /* Hard shadow */
    z-index: 1005;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
  }
  .discussion-fab:hover {
    transform: translate(-4px, -50%); /* Displaces left */
    background: #6b4f3a; /* Walnut brown hover */
    border-color: #6b4f3a;
  }
  ```

- [ ] **Step 5: Run type check**
  Run: `bun run type-check`
  Expected: Success.

- [ ] **Step 6: Commit**
  ```bash
  git add src/components/ui/PButton.vue src/components/ui/PDiscussionFAB.vue
  git commit -m "feat: refactor buttons and FAB to straight-corner bottom-border styles"
  ```

---

### Task 3: Refactor Cards, Surfaces, and Empty States
Update cards, surfaces, empty state, and video card to use `8px` roundness, bottom dashed borders, left border ink highlights on hover, and link underlines.

**Files:**
* Modify: `src/components/ui/PCard.vue`
* Modify: `src/components/ui/PSurface.vue`
* Modify: `src/components/ui/PEmpty.vue`
* Modify: `src/components/shared/PVideoCard.vue`
* Modify: `src/components/shared/PVideoPlayerShell.vue`

**Interfaces:**
* Consumes: `PCard`, `PSurface`, `PEmpty`, `PVideoCard`, `PVideoPlayerShell`
* Produces: Updated card and surface wrapper layouts

- [ ] **Step 1: Rewrite `src/components/ui/PCard.vue`**
  Change to 8px roundness, no top/left/right borders, bottom dashed line, and left black line on hover. Any links inside show underlines on card hover:
  ```css
  .p-card {
    border: none;
    border-bottom: 1.5px dashed var(--a-color-line-soft);
    border-left: 3px solid transparent; /* Reserve left border */
    background: var(--a-color-paper);
    padding: 24px;
    border-radius: 8px; /* 8px roundness */
    transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
  }

  .p-card--interactive {
    cursor: pointer;
  }

  .p-card--interactive:hover {
    background-color: var(--a-color-paper-wash); /* #f3f4f6 */
    border-left-color: var(--a-color-ink); /* Left ink line */
  }

  /* Link underline hover linkage */
  .p-card--interactive:hover :deep(a),
  .p-card--interactive:hover :deep(.p-link-label) {
    text-decoration: underline !important;
    text-decoration-thickness: 1px;
  }
  ```

- [ ] **Step 2: Rewrite `src/components/ui/PSurface.vue`**
  Ensure it follows the 8px rounded corners to match `PCard` and `PEntry.vue`:
  ```css
  .p-surface {
    border: 1px solid var(--a-color-line-soft);
    background: var(--a-color-paper);
    border-radius: 8px; /* 8px roundness */
  }
  ```

- [ ] **Step 3: Verify `src/components/ui/PEmpty.vue`**
  Since `PEmpty` uses `PSurface`, it will automatically inherit the `8px` rounded corners. Keep typography as Pure Typography.

- [ ] **Step 4: Rewrite `src/components/shared/PVideoCard.vue`**
  Adjust `.vc-thumb` border-radius to `8px`, and change duration and views overlay labels to straight corners (`border-radius: 0px`):
  ```css
  .vc-thumb {
    position: relative;
    aspect-ratio: 16/9;
    background: var(--a-color-surface);
    border-radius: 8px; /* 8px rounded thumbnail */
    overflow: hidden;
  }
  .vc-play-count {
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 0px; /* Straight corner */
  }
  .vc-duration {
    position: absolute;
    bottom: 8px;
    right: 8px;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 0px; /* Straight corner */
    z-index: 1;
  }
  ```

- [ ] **Step 5: Verify `src/components/shared/PVideoPlayerShell.vue`**
  Ensure it uses `border-radius: 0.5rem` (8px) and has no container border. This is already correct in the source code.

- [ ] **Step 6: Run type check**
  Run: `bun run type-check`
  Expected: Success.

- [ ] **Step 7: Commit**
  ```bash
  git add src/components/ui/PCard.vue src/components/ui/PSurface.vue src/components/shared/PVideoCard.vue
  git commit -m "feat: update cards and thumbnails to 8px roundness with left ink line highlights"
  ```

---

### Task 4: Refactor Overlays, Modals, and Toasts
Convert dropdown panels, dialogs, confirmation popups, and shortcut panels to straight-corners, hard shadows, and apply green/red colors for Toasts.

**Files:**
* Modify: `src/components/ui/PSelect.vue`
* Modify: `src/components/ui/PModal.vue`
* Modify: `src/components/ui/PToast.vue`
* Modify: `src/components/ui/PShortcutHints.vue`
* Modify: `src/style.css:506-517` (governs Popover and Dropdown panels)

**Interfaces:**
* Consumes: CSS variables in `src/style.css`
* Produces: Refactored overlay panels and styled toast alerts

- [ ] **Step 1: Rewrite `.p-select-panel` in `src/components/ui/PSelect.vue`**
  Change border-radius to `0`, background to pure `white`, border to `1px solid var(--a-color-line-soft)`, and remove shadows:
  ```css
  .p-select-panel {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(100% + 0.4rem);
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 0.65rem 1rem;
    border-radius: 0px; /* Straight corner */
    background: #ffffff; /* Pure white */
    border: 1px solid var(--a-color-line-soft); /* 1px border */
    box-shadow: none; /* No shadow */
  }
  ```

- [ ] **Step 2: Update Dropdown and Popover panels in `src/style.css`**
  Modify lines 506-517 to specify `border-radius: 0px` and use the updated hard shadow variable:
  ```css
  .a-dropdown-panel,
  .a-popover-panel,
  .p-dropdown-panel,
  .p-popover-panel {
    position: absolute;
    top: calc(100% + 4px);
    min-width: 12rem;
    background: var(--a-color-bg);
    border: var(--a-border);
    box-shadow: var(--a-shadow-dropdown); /* Hard shadow */
    z-index: var(--a-z-dropdown);
    border-radius: 0px; /* Straight corner */
  }
  ```

- [ ] **Step 3: Update `src/components/ui/PModal.vue` (and styles in `src/style.css`)**
  Ensure it uses `border-radius: 0px` and the `var(--a-shadow-modal)` which we updated to `4px 4px 0px rgba(0, 0, 0, 0.15)` in Task 1.

- [ ] **Step 4: Rewrite `src/components/ui/PToast.vue`**
  Add status-specific classes for Success, Failure, and Info. Set border-radius to `0px` and apply `2px 2px 0px rgba(0, 0, 0, 0.12)` hard shadow:
  ```html
  <!-- HTML template -->
  <div
    v-if="visible"
    class="p-toast"
    :class="type ? `p-toast--${type}` : 'p-toast--info'"
    :style="{ top: `${resolvedTop}px` }"
    role="status"
    @mouseenter="clearTimer"
    @mouseleave="startTimer"
  >
  ```
  ```css
  /* Scoped CSS */
  .p-toast {
    position: fixed;
    left: 50%;
    z-index: var(--a-z-toast);
    display: grid;
    gap: 4px;
    min-width: 120px;
    max-width: 80vw;
    transform: translateX(-50%);
    border-radius: 0px; /* Straight corner */
    padding: 10px 18px;
    text-align: center;
    box-shadow: 2px 2px 0px rgba(0, 0, 0, 0.12); /* Hard shadow */
  }
  .p-toast--info {
    background: #ffffff;
    color: var(--a-color-ink);
    border: 1px solid var(--a-color-line);
  }
  .p-toast--success {
    background: #f0fdf4; /* Morandi pale green */
    color: #166534; /* Dark green */
    border: 1px solid #166534;
  }
  .p-toast--danger,
  .p-toast--error {
    background: #fef2f2; /* Morandi pale red */
    color: #991b1b; /* Dark red */
    border: 1px solid #991b1b;
  }
  ```
  Note: Make sure to define the optional `type?: 'success' | 'danger' | 'error' | 'info'` prop inside the script tag of `PToast.vue`.

- [ ] **Step 5: Rewrite `src/components/ui/PShortcutHints.vue`**
  Change trigger, content panel, and key `kbd` tags to straight corners, and use hard shadow:
  ```css
  .shortcut-trigger {
    width: 2.5rem;
    height: 2.5rem;
    background: var(--a-color-paper);
    border: 1px solid var(--a-color-line);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: help;
    border-radius: 0px; /* Straight corner */
    transition: all 0.2s ease;
  }
  .shortcut-content {
    position: absolute;
    bottom: 100%;
    right: 0;
    margin-bottom: 1rem;
    background: var(--a-color-paper);
    border: 1px solid var(--a-color-line);
    padding: 1.25rem;
    width: 14rem;
    box-shadow: 3px 3px 0px rgba(0, 0, 0, 0.15); /* Hard shadow */
    border-radius: 0px; /* Straight corner */
    opacity: 0;
    visibility: hidden;
    transform: translateY(10px);
    transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
  }
  .shortcut-item kbd {
    font-family: var(--a-font-meta);
    background: var(--a-color-paper-wash);
    padding: 0.1rem 0.35rem;
    border-radius: 0px; /* Straight corner */
    border: 1px solid var(--a-color-line-soft);
    min-width: 1.2rem;
    text-align: center;
    color: var(--a-color-fg);
  }
  ```

- [ ] **Step 6: Run type check**
  Run: `bun run type-check`
  Expected: Success.

- [ ] **Step 7: Commit**
  ```bash
  git add src/components/ui/PSelect.vue src/components/ui/PToast.vue src/components/ui/PShortcutHints.vue src/style.css
  git commit -m "feat: apply straight-corner and hard shadow style updates to select panel, popover, modal and status toasts"
  ```

---

### Task 5: Refactor Navigation, Sidebar, and Tabs
Remove 4-sided borders from tabs and sidebar items. Apply bottom-borders only for tabs, left ink line and wash highlight for sidebars, and straight block wash for topbar links.

**Files:**
* Modify: `src/components/ui/PTab.vue`
* Modify: `src/components/ui/PSidebarItem.vue`
* Modify: `src/components/ui/PSidebar.vue`
* Modify: `src/components/system/AppTopbar.vue`

**Interfaces:**
* Consumes: Subdomain configurations and active states
* Produces: Clean borderless navigation bars and sidebars

- [ ] **Step 1: Rewrite `src/components/ui/PTab.vue`**
  Modify PTab scoped styles to remove vertical borders, leaving only a bottom border line:
  ```css
  .p-tab {
    position: relative;
    display: inline-flex;
    min-height: 34px;
    align-items: center;
    justify-content: center;
    padding: 0 16px;
    border: none;
    border-bottom: 2px solid transparent; /* Only bottom border line */
    background: transparent;
    color: var(--a-color-ink-soft);
    font-family: inherit;
    font-size: 11px;
    font-weight: var(--a-font-weight-strong, 700);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    transition: all 0.12s ease;
  }
  .p-tab:hover {
    color: var(--a-color-ink);
  }
  .p-tab--active {
    border-bottom-color: var(--a-color-ink); /* Black bottom highlight */
    background: transparent;
    color: var(--a-color-ink);
  }
  /* Remove old active before block */
  .p-tab--active::before {
    display: none;
  }
  ```

- [ ] **Step 2: Rewrite `src/components/ui/PSidebarItem.vue`**
  Remove `0.875rem` rounded corners, add transparent left border, and make active state draw a 3px ink line with a grey wash background:
  ```css
  .p-sidebar-item {
    outline: none;
    border-radius: 0px; /* Straight corner */
    border-left: 3px solid transparent; /* Pre-reserve left border space */
    background: transparent;
    transition: all 0.2s ease;
  }
  .p-sidebar-item:hover,
  .p-sidebar-item.is-focused {
    background: var(--a-color-paper-wash); /* #f3f4f6 */
    border-left-color: var(--a-color-line);
  }
  .p-sidebar-item.active {
    background: var(--a-color-paper-wash);
    color: var(--a-color-ink);
    border-left-color: var(--a-color-ink); /* Left ink line highlight */
  }
  ```

- [ ] **Step 3: Update `src/components/ui/PSidebar.vue`**
  Ensure the collapse button `.p-sidebar-collapse-btn` has its roundness removed:
  ```css
  .p-sidebar-collapse-btn {
    position: absolute;
    top: 1.25rem;
    left: 1.25rem;
    width: 2.5rem;
    height: 2.5rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--a-color-fg);
    cursor: pointer;
    border-radius: 0px; /* Straight corner */
    transition: background-color 0.2s ease;
    z-index: 10;
  }
  ```

- [ ] **Step 4: Rewrite `src/components/system/AppTopbar.vue`**
  Modify navigation links (`.nav-link` and `.nav-link-sm`) to remove rounded corners:
  ```css
  .nav-link {
    display: flex;
    align-items: center;
    min-height: 2.25rem;
    padding: 0 0.75rem;
    border-radius: 0px; /* Straight corner block */
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--a-color-muted);
    text-decoration: none;
    background: transparent;
    transition: color 0.2s ease, background-color 0.2s ease;
  }
  .nav-link:hover,
  .nav-link.active {
    color: var(--a-color-fg);
    background: var(--a-color-paper-wash); /* Flat wash block */
  }
  .nav-link-sm {
    min-height: 2rem;
    display: inline-flex;
    align-items: center;
    padding: 0 0.625rem;
    border-radius: 0px; /* Straight corner */
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--a-color-muted-soft);
    text-decoration: none;
    transition: color 0.2s ease, background-color 0.2s ease;
  }
  .nav-link-sm:hover {
    color: var(--a-color-fg);
    background: var(--a-color-paper-wash);
  }
  ```

- [ ] **Step 5: Run type check**
  Run: `bun run type-check`
  Expected: Success.

- [ ] **Step 6: Commit**
  ```bash
  git add src/components/ui/PTab.vue src/components/ui/PSidebarItem.vue src/components/ui/PSidebar.vue src/components/system/AppTopbar.vue
  git commit -m "feat: adjust sidebar items, tabs, and topbar nav links to use straight corners and bottom/left border highlights"
  ```

---

### Task 6: Cascade Stacking sliding Sheets
Update the sheet and sheet handle components to use the cascading vertical错开 stacking layout, pushing later sheets to the right and lining handles up down the left gap.

**Files:**
* Modify: `src/components/ui/PSheet.vue`
* Modify: `src/components/ui/PSheetTab.vue`
* Modify: `src/stores/sheet.ts` (if required to track stacking indices)

**Interfaces:**
* Consumes: Sheet open/close states and active stack indices
* Produces: Multi-sheet cascading overlay layout with staggered vertical handles

- [ ] **Step 1: Inspect `src/stores/sheet.ts` or create index logic**
  Let's look at `/root/Atoman/Atoman-Frontend/src/stores/sheet.ts` to see how sheets are added.
  Run: View `src/stores/sheet.ts` if needed.

- [ ] **Step 2: Rewrite `src/components/ui/PSheet.vue` layout positioning**
  Calculate left indent offset based on stack depth index:
  1. Calculate the offset based on `props.isShifted` or pass a computed `index` from the sheets list.
  2. If Sheet 0 is at index 0 (occupies full screen except 32px left gap): `left: 32px`.
  3. If Sheet 1 is at index 1 (squeezed rightwards): `left: 64px`.
  4. Formulate the dynamic style positioning for `.p-sheet-panel`:
     ```typescript
     // Inside PSheet.vue script
     const sheetIndex = computed(() => {
       // Search the sheet store or active DOM context to get current index,
       // or accept it as a prop `index` (default: 0).
       return props.index ?? 0
     })
     const computedLeft = computed(() => {
       return `${32 + (sheetIndex.value * 32)}px`
     })
     const computedWidth = computed(() => {
       return `calc(100% - ${computedLeft.value})`
     })
     const computedHandleTop = computed(() => {
       return `${32 + (sheetIndex.value * 56)}px`
     })
     ```
  5. Position `.sheet-tab-position` (the handle container) dynamically at `top: computedHandleTop`.

- [ ] **Step 3: Update `src/components/ui/PSheetTab.vue` Hover style**
  Use the Morandi Kraft Paper wash color (`#f4ece1`) on hover:
  ```css
  .sheet-tab {
    background-color: white;
    color: var(--a-color-fg);
    padding-left: 12px;
    padding-right: 18px;
    padding-top: 8px;
    padding-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
    position: relative;
    cursor: pointer;
    border: 1px solid var(--a-color-line-soft);
    border-radius: 0;
    border-right: none;
    transition: background-color 0.2s, border-color 0.2s;
    outline: none;
    font-family: inherit;
    white-space: nowrap;
  }
  .sheet-tab:hover {
    background-color: #f4ece1; /* Kraft paper wash */
    color: #6b4f3a; /* Walnut brown */
    border-color: #6b4f3a;
  }
  ```

- [ ] **Step 4: Run type check and verify build**
  Run: `bun run type-check`
  Expected: Success.

- [ ] **Step 5: Commit**
  ```bash
  git add src/components/ui/PSheet.vue src/components/ui/PSheetTab.vue
  git commit -m "feat: implement cascading sheet layout with vertically staggered bookmark handles"
  ```
