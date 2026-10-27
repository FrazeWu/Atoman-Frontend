# 全站模态 (Modal) 与抽屉 (Sheet) 架构统合实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 彻底淘汰散落手写的弹窗/抽屉实现，统合收网至标准 `PModal.vue` 与 `PSheet.vue`，实现全站统一的 ESC 关闭、Tab 焦点圈定与无障碍契约，并清理时间线等页面的双重 Header 和重复关闭按钮。

**Architecture:** 将 `MediaPickerModal.vue`、`PShortcutHints.vue` 迁移至 `PModal`；将 `ThemeCustomizerDrawer.vue` 迁移至 `PSheet`；规范时间线页面内的 `PModal` 用法，统一采用 `:title` 属性并消除手写 `.a-modal-header`。

**Tech Stack:** Vue 3.4, TypeScript 5.8, Pinia, Vitest, Vue Test Utils.

## Global Constraints
- 严格 0 阴影：`box-shadow: none !important;`。
- 严格 4px 圆角：统一切换为 `var(--a-radius-card, 4px)` 或 `var(--a-radius-control, 4px)`。
- 全语义 Token：严禁硬编码 hex 颜色。
- 杜绝假数据：严禁引入 Mock 数据。
- TypeScript：严格类型安全，`bun run type-check` 0 error。

---

### Task 1: 视听资源选择器 `MediaPickerModal.vue` 收敛至标准 `PModal`

**Files:**
- Modify: `src/components/shared/MediaPickerModal.vue`
- Test: `tests/unit/components/shared/MediaPickerModal.spec.ts`

**Interfaces:**
- Consumes: `<PModal>` (`size="md"`, `title="选择视听资源"`, `:above-player="abovePlayer"`)
- Produces: Focus-trapped, ESC-closable media picker with clean unified modal structure.

- [x] **Step 1: Check existing unit tests for MediaPickerModal**
  Run `cd Atoman-Frontend && bun run test:unit tests/unit/components/shared/MediaPickerModal.spec.ts`.

- [x] **Step 2: Refactor `MediaPickerModal.vue` to use `<PModal>`**
  - Import `PModal` from `@/components/ui/PModal.vue`.
  - Replace `<Teleport to="body">`, `<Transition name="modal-fade">`, `.media-picker-backdrop`, `.p-modal.media-picker-modal`, and floating close button with `<PModal :show="open" size="md" title="选择视听资源" :above-player="abovePlayer" @close="handleClose">`.
  - Remove duplicate backdrop/overlay CSS from `<style scoped>`.

- [x] **Step 3: Run unit tests to verify passing**
  Run `cd Atoman-Frontend && bun run test:unit tests/unit/components/shared/MediaPickerModal.spec.ts`.

- [x] **Step 4: Commit changes**
  Commit with message `refactor(media): migrate MediaPickerModal to standard PModal component`.

---

### Task 2: 空间装扮抽屉 `ThemeCustomizerDrawer.vue` 收敛至标准 `PSheet`

**Files:**
- Modify: `src/components/theme/ThemeCustomizerDrawer.vue`
- Test: `tests/unit/components/theme/ThemeCustomizerDrawer.spec.ts`

**Interfaces:**
- Consumes: `<PSheet>` (`side="right"`, `mode="partial"`, `partial-width="420px"`, `title="装扮空间"`, `:above-player="true"`)
- Produces: Standardized partial right sheet with unified backdrop, ESC key handling, and action footer.

- [x] **Step 1: Run existing tests for ThemeCustomizerDrawer**
  Run `cd Atoman-Frontend && bun run test:unit tests/unit/components/theme/ThemeCustomizerDrawer.spec.ts`.

- [x] **Step 2: Refactor `ThemeCustomizerDrawer.vue` to use `<PSheet>`**
  - Import `PSheet` from `@/components/ui/PSheet.vue`.
  - Replace `.theme-customizer-root`, `.theme-customizer-backdrop`, and custom transitions with `<PSheet :show="open" side="right" mode="partial" partial-width="420px" title="装扮空间" close-type="header" :above-player="true" @close="cancel">`.
  - Move footer action buttons (`恢复默认`, `取消`, `保存主题`) to `<template #footer>`.
  - Move the enable toggle switch into `<template #header>` or top of content.
  - Remove hand-rolled backdrop/slide animation and z-index CSS.

- [x] **Step 3: Run tests to verify passing**
  Run `cd Atoman-Frontend && bun run test:unit tests/unit/components/theme/ThemeCustomizerDrawer.spec.ts`.

- [x] **Step 4: Commit changes**
  Commit with message `refactor(theme): migrate ThemeCustomizerDrawer to standard PSheet component`.

---

### Task 3: 快捷键提示弹窗 `PShortcutHints.vue` 收敛至标准 `PModal`

**Files:**
- Modify: `src/components/ui/PShortcutHints.vue`
- Test: `tests/unit/components/ui/PShortcutHints.spec.ts`

**Interfaces:**
- Consumes: `<PModal>` (`size="md"`, `:title="title"`, `@close="close"`)
- Produces: Standardized shortcut hints dialog with complete focus trapping and focus restore.

- [x] **Step 1: Run existing tests for PShortcutHints**
  Run `cd Atoman-Frontend && bun run test:unit tests/unit/components/ui/PShortcutHints.spec.ts`.

- [x] **Step 2: Refactor `PShortcutHints.vue` to use `<PModal>`**
  - Replace hand-rolled `<Teleport>`, `<div class="shortcut-hints__backdrop">`, and `<div class="shortcut-hints__panel">` with `<PModal :show="open" size="md" :title="title" @close="close">`.
  - Retain shortcut hints list in default slot.
  - Remove duplicate backdrop/panel CSS and manual escape listener.

- [x] **Step 3: Run tests to verify passing**
  Run `cd Atoman-Frontend && bun run test:unit tests/unit/components/ui/PShortcutHints.spec.ts`.

- [x] **Step 4: Commit changes**
  Commit with message `refactor(ui): migrate PShortcutHints to standard PModal dialog`.

---

### Task 4: 时间线模态双重 Header 与双重关闭按钮清理

**Files:**
- Modify: `src/views/timeline/TimelineHomeView.vue:250-335`
- Modify: `src/views/timeline/PersonMapView.vue:85-180`
- Modify: `src/components/timeline/TimelineEventDetailModal.vue:1-35`
- Create: `tests/unit/timeline/timeline-modal-contract.spec.ts`

**Interfaces:**
- Consumes: `<PModal :title="...">`
- Produces: Clean modal views without duplicate header elements or second close buttons.

- [x] **Step 1: Write contract test for timeline modal headers**
  Create `tests/unit/timeline/timeline-modal-contract.spec.ts` asserting:
  1. `TimelineHomeView.vue` does not contain nested `.a-modal-header` or duplicate `.a-modal-close` buttons inside `PModal`.
  2. `PersonMapView.vue` does not contain nested `.a-modal-header` or duplicate `.a-modal-close` buttons inside `PModal`.
  3. `TimelineEventDetailModal.vue` does not contain nested `.a-modal-header` or duplicate `.a-modal-close` buttons.

- [x] **Step 2: Run test to verify failure**
  Run `cd Atoman-Frontend && bun run test:unit tests/unit/timeline/timeline-modal-contract.spec.ts`.

- [x] **Step 3: Update timeline views and component**
  - In `TimelineHomeView.vue`:
    - Move title to `:title="editingEvent ? '编辑事件' : '新建事件'"` on `PModal`, remove `.a-modal-header` and `.a-modal-close`.
    - Move title to `title="新建人物"` on `PModal`, remove `.a-modal-header` and `.a-modal-close`.
    - Move title to `:title="`历史版本 — ${historyEvent.title}`"` on `PModal`, remove `.a-modal-header` and `.a-modal-close`.
  - In `PersonMapView.vue`:
    - Move title to `:title="editingLocation ? '编辑地点' : '添加地点'"` on `PModal`, remove duplicate header.
    - Move title to `title="编辑人物"` on `PModal`, remove duplicate header.
  - In `TimelineEventDetailModal.vue`:
    - Move title to `:title="event.title"` on `PModal`, remove duplicate header and close button.

- [x] **Step 4: Run test to verify passing**
  Run `cd Atoman-Frontend && bun run test:unit tests/unit/timeline/timeline-modal-contract.spec.ts`.

- [x] **Step 5: Commit changes**
  Commit with message `refactor(timeline): eliminate redundant modal headers and duplicate close buttons`.

---

### Task 5: 全站回归扫描与双端生产构建验证

**Files:**
- Verify: Full codebase

- [x] **Step 1: Run TypeScript type check**
  Run `cd Atoman-Frontend && bun run type-check`.
- [x] **Step 2: Run full Vitest suite**
  Run `cd Atoman-Frontend && bun run test:unit`.
- [x] **Step 3: Run production builds**
  Run `cd Atoman-Frontend && bun run build` (desktop) and `cd Atoman-Frontend && bun run build:mobile` (mobile).
- [x] **Step 4: Commit and push**
  Push all commits to `origin/main`.
