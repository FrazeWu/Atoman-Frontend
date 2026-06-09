# Topbar Dropdown & Controls Refactoring Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the top bar's dropdown menu, user profile button, channel selector, login button, and notification badge to align with Atoman's Paper & Ink design system (sharp edges, 2px borders, hard shadows, solid hover inversion, no rounded corners).

**Architecture:** Update component-level CSS in `AppTopbar.vue` and `AppTopbarAuthControls.vue` to replace custom modern rounded shapes and soft shadows with the global design token patterns.

**Tech Stack:** Vue 3, CSS (scoped styles), Tailwind v4 configuration variables.

---

### Task 1: Refactor Login Button in AppTopbar
Modify the Login link to use the standard global `a-btn` classes, ensuring it has sharp corners, 2px black border, and 4px block shadow.

**Files:**
- Modify: `web/src/components/AppTopbar.vue`

- [ ] **Step 1: Replace login button markup and clean up CSS**
  Update `<RouterLink>` on line 33 to use standard global buttons classes:
  ```html
  <RouterLink v-else to="/login" class="a-btn a-btn--primary a-btn--sm">登录</RouterLink>
  ```
  Remove the `.login-btn` CSS block from `<style scoped>` (lines 167-180).

- [ ] **Step 2: Commit changes**
  ```bash
  git add web/src/components/AppTopbar.vue
  git commit -m "style: refactor login button to standard paper button"
  ```

---

### Task 2: Refactor Topbar Auth Controls (User Profile & Dropdown)
Update the user button, notification count, channel select, and dropdown panel styles in `AppTopbarAuthControls.vue` to use paper-and-ink styling.

**Files:**
- Modify: `web/src/components/AppTopbarAuthControls.vue`

- [ ] **Step 1: Apply paper-and-ink style rules to the components**
  Modify CSS in `<style scoped>`:
  - `.channel-select`: Set `border: var(--a-border);`, `border-radius: var(--a-radius-none);`, and change font-weight to 900.
  - `.notif-count`: Set `border-radius: 0;`, add `border: 1px solid var(--a-color-ink);`, update background to `var(--a-color-ink)` and color to `var(--a-color-paper)`.
  - `.user-btn`: Set `border: var(--a-border);`, `border-radius: var(--a-radius-none);`, and change background to `var(--a-color-bg)`.
  - `.dropdown`: Set `border: var(--a-border);`, `border-radius: var(--a-radius-none);`, and replace soft box-shadow with `var(--a-shadow-dropdown);`.
  - `.dropdown-item`: Set hover to invert text and background color:
    ```css
    .dropdown-item:hover {
      background: var(--a-color-fg);
      color: var(--a-color-bg);
      text-decoration: none;
    }
    .dropdown-item-danger:hover {
      background: var(--a-color-danger);
      color: var(--a-color-bg);
      text-decoration: none;
    }
    ```
  - Ensure all borders use `var(--a-border)` (or `2px solid var(--a-color-ink)`) and dividers use `1px solid var(--a-color-line-soft)` (or `#e5e7eb`).

- [ ] **Step 2: Commit changes**
  ```bash
  git add web/src/components/AppTopbarAuthControls.vue
  git commit -m "style: unify topbar dropdown and controls style to paper design system"
  ```

---

### Task 3: Build and Validate Front-End Compilation
Verify the codebase compile health and styling integration.

- [ ] **Step 1: Run type check and lint**
  Run: `bun run type-check` in `web/` directory.
  Expected: Success without TypeScript compilation errors.

- [ ] **Step 2: Validate production build**
  Run: `bun run build` in `web/` directory.
  Expected: Success with built bundles.
