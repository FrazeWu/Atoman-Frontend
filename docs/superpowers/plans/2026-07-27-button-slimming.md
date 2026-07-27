# Button Slimming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adjust the height, padding, and font-size of buttons across desktop and mobile viewports in Atoman-Frontend to make them sleeker.

**Architecture:** Modify the scoped CSS classes in the shared `PButton.vue` component and the global utility classes in `style.css` to match the agreed visual specifications.

**Tech Stack:** Vue 3, Tailwind CSS v4, Vanilla CSS.

---

### Task 1: Update PButton.vue Styles

**Files:**
- Modify: [PButton.vue](file:///root/Atoman/Atoman-Frontend/src/components/ui/PButton.vue) (lines 147-164 and 226-235)

- [ ] **Step 1: Replace desktop sizes in scoped style**
  Update `.p-button--sm`, `.p-button--md`, and `.p-button--lg` in the `<style scoped>` section:
  ```css
  .p-button--sm {
    min-height: 28px;
    padding: 0 12px;
    font-size: 11px;
  }

  .p-button--md {
    min-height: 36px;
    padding: 0 16px;
    font-size: 13px;
  }

  .p-button--lg {
    min-height: 44px;
    padding: 0 20px;
    font-size: 15px;
  }
  ```

- [ ] **Step 2: Replace mobile media query overrides**
  Update the media query section `@media (max-width: 767px)`:
  ```css
  @media (max-width: 767px) {
    .p-button--sm {
      min-height: 36px;
      font-size: 12px;
    }

    .p-button--md {
      min-height: 40px;
    }
  }
  ```

- [ ] **Step 3: Commit component changes**
  ```bash
  git add src/components/ui/PButton.vue
  git commit -m "style: adjust PButton sizes and font-sizes for desktop/mobile"
  ```

---

### Task 2: Update style.css Button Utility Styles

**Files:**
- Modify: [style.css](file:///root/Atoman/Atoman-Frontend/src/style.css) (lines 226-240)

- [ ] **Step 1: Replace global `.a-btn--sm`, `.a-btn--md`, `.a-btn--lg` sizes**
  Update the styles in the Buttons section of `style.css`:
  ```css
  .a-btn--sm {
    min-height: 1.75rem;
    padding: 0.25rem 0.75rem;
    font-size: 0.6875rem;
  }
  .a-btn--md {
    min-height: 2.25rem;
    padding: 0.5rem 1rem;
    font-size: 0.8125rem;
  }
  .a-btn--lg {
    min-height: 2.75rem;
    padding: 0.75rem 1.25rem;
    font-size: 0.9375rem;
  }
  ```

- [ ] **Step 2: Add mobile media query for `.a-btn` classes**
  Add mobile scale rules for global buttons just after `.a-btn-block` definition:
  ```css
  @media (max-width: 767px) {
    .a-btn--sm {
      min-height: 2.25rem;
      font-size: 0.75rem;
    }
    .a-btn--md {
      min-height: 2.5rem;
    }
  }
  ```

- [ ] **Step 3: Commit global utility changes**
  ```bash
  git add src/style.css
  git commit -m "style: adjust global .a-btn styles for sleek look"
  ```

---

### Task 3: Build Verification & Testing

- [ ] **Step 1: Run type checking**
  Run: `bun run type-check`
  Expected: PASS

- [ ] **Step 2: Run frontend build check**
  Run: `bun run build`
  Expected: Success without errors.
