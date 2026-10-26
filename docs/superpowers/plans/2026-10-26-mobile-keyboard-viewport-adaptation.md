# Mobile Keyboard & Viewport Adaptation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide smooth, unclipped, and jitter-free mobile input interactions across bottom sheets and fixed bottom bars when the virtual keyboard expands/collapses on iOS Safari and mobile browsers.

**Architecture:** A lightweight composable `useMobileKeyboard` observes `window.visualViewport` changes, calculates keyboard state and pixel height, and injects CSS variables (`--mobile-keyboard-height`, `--mobile-viewport-height`) into `:root` or active container. `MSheet.vue` dynamically adjusts max-height and bottom padding, and fixed reply bars elevate smoothly with zero layout jitter. 16px base font size prevents iOS Safari viewport auto-zooming.

**Tech Stack:** Vue 3.4, TypeScript 5.8, Vitest, Happy-DOM, Vue Test Utils.

## Global Constraints
- Zero shadow: `box-shadow: none !important;` across all sheets, inputs, and bars.
- 4px border radius: `var(--a-radius-control, 4px)`.
- Full tokenization: Use semantic CSS tokens (`--a-color-bg`, `--a-color-border-soft`, `--a-color-primary`, etc.).
- Concise user-facing copy: Keep placeholder and action labels user-focused without internal/developer jargon.
- TypeScript: Maintain strict typing, 0 errors in `bun run type-check`.

---

### Task 1: 封装 `useMobileKeyboard` 组合式函数与单元测试

**Files:**
- Create: `apps/mobile/composables/useMobileKeyboard.ts`
- Create: `tests/unit/mobile/MobileKeyboard.spec.ts`

**Interfaces:**
- Consumes: `window.visualViewport` (`resize`, `scroll`), `window.innerHeight`.
- Produces: `isKeyboardOpen: Ref<boolean>`, `keyboardHeight: Ref<number>`, `visualViewportHeight: Ref<number>`, `scrollFocusedElementIntoView(el: HTMLElement): void`, CSS variable injection.

- [ ] **Step 1: Write failing unit tests for `useMobileKeyboard`**
  Create `tests/unit/mobile/MobileKeyboard.spec.ts` testing:
  1. Default state when keyboard is hidden (`isKeyboardOpen === false`, `keyboardHeight === 0`).
  2. When `visualViewport.height` decreases (e.g., from 800px to 500px), updates `keyboardHeight` to 300px and `isKeyboardOpen` to `true`.
  3. Small viewport adjustments (<60px) do not trigger `isKeyboardOpen = true` (avoids false positives from address bar collapses).
  4. Injects `--mobile-keyboard-height` and `--mobile-viewport-height` onto document element or target.
  5. Cleans up event listeners and resets CSS variables on component unmount / scope dispose.

- [ ] **Step 2: Run tests to verify failure**
  Run `cd Atoman-Frontend && bun test tests/unit/mobile/MobileKeyboard.spec.ts` and confirm failure.

- [ ] **Step 3: Implement `useMobileKeyboard.ts`**
  Create `apps/mobile/composables/useMobileKeyboard.ts`:
  - Provide reactive refs: `keyboardHeight`, `isKeyboardOpen`, `visualViewportHeight`.
  - Add listeners to `window.visualViewport` on mount, compute difference between `window.innerHeight` and `visualViewport.height`.
  - Set CSS variables `--mobile-keyboard-height` and `--mobile-viewport-height`.
  - Implement `scrollFocusedElementIntoView` helper.
  - Automatically remove listeners and clean up variables in `onScopeDispose` / `onUnmounted`.

- [ ] **Step 4: Run tests to verify passing**
  Run `cd Atoman-Frontend && bun test tests/unit/mobile/MobileKeyboard.spec.ts` and ensure all tests pass.

- [ ] **Step 5: Commit changes**
  Commit Task 1 changes with git commit message `feat(mobile): add useMobileKeyboard composable with visualViewport observation`.

---

### Task 2: 通用弹层 `MSheet.vue` 键盘自适应与高度防截断

**Files:**
- Modify: `apps/mobile/components/ui/MSheet.vue`
- Create/Modify: `tests/unit/mobile/MSheetKeyboard.spec.ts`

**Interfaces:**
- Consumes: `useMobileKeyboard()`
- Produces: Dynamic sheet panel max-height and bottom padding that cleanly accommodates the software keyboard.

- [ ] **Step 1: Write failing unit test for MSheet keyboard adaptation**
  Create `tests/unit/mobile/MSheetKeyboard.spec.ts` testing:
  1. When rendered with open keyboard, `.m-sheet__panel` applies bottom padding reflecting keyboard height.
  2. Max-height of `.m-sheet__panel` scales with `--mobile-viewport-height`.
  3. Internal content has `overflow-y: auto` to allow full scrolling while keyboard is active.

- [ ] **Step 2: Run tests to verify failure**
  Run `cd Atoman-Frontend && bun test tests/unit/mobile/MSheetKeyboard.spec.ts` and confirm failure.

- [ ] **Step 3: Implement keyboard adaptation in `MSheet.vue`**
  - Integrate `useMobileKeyboard` in `MSheet.vue`.
  - Update styles on `.m-sheet__panel`:
    - `max-height: calc(var(--mobile-viewport-height, 100dvh) * 0.88);`
    - `padding-bottom: calc(var(--mobile-keyboard-height, 0px) + env(safe-area-inset-bottom, 16px));`
    - `transition: padding-bottom 150ms cubic-bezier(0.2, 0.8, 0.2, 1);`
  - Ensure `.m-sheet__content` has `-webkit-overflow-scrolling: touch; overflow-y: auto; flex: 1;`.

- [ ] **Step 4: Run tests to verify passing**
  Run `cd Atoman-Frontend && bun test tests/unit/mobile/MSheetKeyboard.spec.ts`.

- [ ] **Step 5: Commit changes**
  Commit Task 2 with git commit message `feat(mobile): adapt MSheet panel height and padding to mobile keyboard`.

---

### Task 3: 博客短笺发布抽屉 `ShortNoteComposerSheet.vue` 键盘锚定与字号规范

**Files:**
- Modify: `apps/mobile/views/blog/ShortNoteComposerSheet.vue`
- Create/Modify: `tests/unit/mobile/ShortNoteComposerSheet.spec.ts`

**Interfaces:**
- Consumes: `MSheet.vue`, `useMobileKeyboard()`
- Produces: Unobscured composer textarea, 16px input font size, permanently accessible toolbar and submit button.

- [ ] **Step 1: Write unit tests verifying input font size and action placement**
  Add test in `tests/unit/mobile/ShortNoteComposerSheet.spec.ts` checking:
  1. Textarea has 16px font-size to prevent iOS Safari auto-zoom.
  2. Action buttons (`发布短笺`, `取消`) and toolbar stay mounted and visible.

- [ ] **Step 2: Run tests to verify failure or style absence**
  Run `cd Atoman-Frontend && bun test tests/unit/mobile/ShortNoteComposerSheet.spec.ts`.

- [ ] **Step 3: Update `ShortNoteComposerSheet.vue` styling and behavior**
  - Set `.short-note-composer__textarea` font-size to `16px; font-size: max(16px, 1rem);` so iOS Safari never zooms.
  - Ensure sticky footer or flex column layout keeps `.short-note-composer__actions` visible without vertical overflow.

- [ ] **Step 4: Run tests to verify passing**
  Run `cd Atoman-Frontend && bun test tests/unit/mobile/ShortNoteComposerSheet.spec.ts`.

- [ ] **Step 5: Commit changes**
  Commit Task 3 with git commit message `fix(mobile): ensure 16px font-size and sticky action visibility in short note composer`.

---

### Task 4: 详情页吸底回复栏 `ShortNoteDetailMobileView.vue` 抬升与全流程回归

**Files:**
- Modify: `apps/mobile/views/blog/ShortNoteDetailMobileView.vue`
- Modify: `tests/unit/mobile/ShortNoteDetailMobileView.spec.ts`

**Interfaces:**
- Consumes: `--mobile-keyboard-height`, `useMobileKeyboard()`
- Produces: Smoothly elevated reply input and send button, 16px input font size.

- [ ] **Step 1: Add test for elevated reply bar in `ShortNoteDetailMobileView.spec.ts`**
  Verify `.detail-reply-bar` uses dynamic bottom offset and `.reply-input` has 16px font size.

- [ ] **Step 2: Run tests to verify failure**
  Run `cd Atoman-Frontend && bun test tests/unit/mobile/ShortNoteDetailMobileView.spec.ts`.

- [ ] **Step 3: Update `ShortNoteDetailMobileView.vue`**
  - Bind `bottom: var(--mobile-keyboard-height, 0px)` on `.detail-reply-bar`.
  - Add `transition: bottom 150ms cubic-bezier(0.2, 0.8, 0.2, 1);`.
  - Set `.reply-input` `font-size: 16px;`.
  - Call `scrollIntoView` on focus to guarantee visibility.

- [ ] **Step 4: Run tests to verify passing**
  Run `cd Atoman-Frontend && bun test tests/unit/mobile/ShortNoteDetailMobileView.spec.ts`.

- [ ] **Step 5: Full verification suite**
  - Run `cd Atoman-Frontend && bun run type-check`.
  - Run `cd Atoman-Frontend && bun test tests/unit/mobile/`.
  - Run `cd Atoman-Frontend && bun run build:mobile`.

- [ ] **Step 6: Commit changes**
  Commit Task 4 with git commit message `feat(mobile): elevate detail reply bar above virtual keyboard and enforce 16px input font`.
