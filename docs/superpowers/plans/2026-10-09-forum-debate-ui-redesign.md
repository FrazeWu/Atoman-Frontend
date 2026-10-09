# Forum & Debate UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Forum and Debate module views and components in Atoman-Frontend to strictly conform to the Pure-White Double-Notch Minimal System specification.

**Architecture:** Refactor styles, radii, font weights, semantic color tokens, and element surfaces across `src/views/debate/*`, `src/components/debate/*`, `src/views/forum/*`, and `src/components/forum/*` while preserving all existing interaction behaviors, routes, and testing contracts.

**Tech Stack:** Vue 3.4+, TypeScript 5.9, Pinia, Vitest, Happy-DOM, Pure-White Minimal Design System CSS tokens.

## Global Constraints

- R1 纯白表面：卡片、面板、Sheet、表格、节点画布基础背景必须为 `#ffffff` / `var(--a-color-bg)`，严禁 `var(--a-color-surface)` 作为表面，卡片 hover 保持纯白。
- R2 柔和分界：外层边框 `var(--a-color-border)` (`#cbd5e1`)，内部分割 `var(--a-color-border-soft)` (`#e2e8f0`)，禁止 `rgba(0,0,0,x)` 或硬编码 hex。
- R3 阴影收敛：全局阴影严格令牌化或 `none`。
- R4 4px 紧凑圆角：卡片、控件、状态徽章、stamp 与持仓条统一使用 `4px` (`var(--a-radius-card)` / `var(--a-radius-control)`)，禁止 `999px` / `pill` 圆角。
- R5 克制字重：标题 `font-weight: 500`，强调态 `600`，严禁 `var(--a-font-weight-black)` (700-900) 或 `var(--a-font-weight-strong)` (700) 出现在标题与徽章中；数值统一使用 `font-variant-numeric: tabular-nums`。
- R6 & R10 令牌色值：禁止硬编码颜色；错误色统一为 `var(--a-color-danger)`，禁止已废弃的 `var(--a-color-accent-destructive)`。
- R8 用户视角文案：去除任何开发/系统视角词汇；移除徽章与踢脚强制大写 (`text-transform: uppercase`)。
- 严禁任何破坏现有组件测试断言与路由的行为。

---

### Task 1: Debate Module Views & Stance Visuals Polish (`src/views/debate/*`)

**Files:**
- Modify: `src/views/debate/DebateHomeView.vue`
- Modify: `src/views/debate/DebateTopicView.vue`
- Test: `tests/unit/views/debate/DebateHomeView.nodes.spec.ts`
- Test: `tests/unit/views/debate/DebateTopicView.relations.spec.ts`
- Test: `tests/unit/views/debate/DebateRulesView.spec.ts`
- Test: `tests/unit/views/debate/DebateLayout.spec.ts`

- [ ] **Step 1: Inspect and update DebateHomeView.vue**
  - Update `.debate-card:hover` to keep background `var(--a-color-bg)` (border hover `var(--a-color-border)`).
  - Update `.stance-bar`, `.stance-bar__pro`, `.stance-bar__con` border radius from `var(--a-radius-pill, 999px)` to `var(--a-radius-control)` (4px).
  - Update `.stance-action` font-weight to 500.
  - Ensure status badges and conclusion stamps use `var(--a-radius-control)`.

- [ ] **Step 2: Inspect and verify DebateTopicView.vue and DebateRulesView.vue**
  - Verify headings are 500 and emphasis elements are 600.
  - Verify inline references use pure-white backgrounds and semantic tokens.

- [ ] **Step 3: Run Debate views unit tests**
  ```bash
  bun run test:unit tests/unit/views/debate/DebateHomeView.nodes.spec.ts tests/unit/views/debate/DebateTopicView.relations.spec.ts tests/unit/views/debate/DebateRulesView.spec.ts tests/unit/views/debate/DebateLayout.spec.ts
  ```

- [ ] **Step 4: Commit changes**
  ```bash
  git commit -m "refactor(debate): polish debate views and standardize stance visuals"
  ```

---

### Task 2: Debate Components, Graph & Editor Refactor (`src/components/debate/*`)

**Files:**
- Modify: `src/components/debate/DebateGraphNode.vue`
- Modify: `src/components/debate/DebateRevisionSheet.vue`
- Modify: `src/components/debate/DebateWikiEditor.vue`
- Test: `tests/unit/components/debate/DebateGraphNode.spec.ts`
- Test: `tests/unit/components/debate/DebateRevisionSheet.spec.ts`
- Test: `tests/unit/components/debate/DebateRelationGraph.spec.ts`
- Test: `tests/unit/components/debate/DebateVotePanel.spec.ts`

- [ ] **Step 1: Polish DebateGraphNode.vue**
  - Change `.debate-node__stamp` border radius from `999px` to `var(--a-radius-control)`.
  - Change `.debate-node__kind::before` pip indicator border radius to `var(--a-radius-control)` or 2px.

- [ ] **Step 2: Update DebateRevisionSheet.vue and DebateWikiEditor.vue**
  - In `DebateRevisionSheet.vue`: replace `var(--a-color-accent-destructive)` with `var(--a-color-danger)`.
  - In `DebateWikiEditor.vue`: replace `var(--a-color-accent-destructive)` with `var(--a-color-danger)`, change `.wiki-editor__label` font-weight from `600` to `500`.

- [ ] **Step 3: Run Debate components unit tests**
  ```bash
  bun run test:unit tests/unit/components/debate/
  ```

- [ ] **Step 4: Commit changes**
  ```bash
  git commit -m "refactor(debate): align graph nodes, revision sheet, and wiki editor with design tokens"
  ```

---

### Task 3: Forum Module Views & Typography Polish (`src/views/forum/*`)

**Files:**
- Modify: `src/views/forum/ForumHomeView.vue`
- Modify: `src/views/forum/ForumTopicView.vue`
- Modify: `src/views/forum/ForumNewTopicView.vue`
- Test: `tests/unit/views/forum/ForumHomePagination.spec.ts`
- Test: `tests/unit/views/forum/ForumTopicView.interactions.spec.ts`
- Test: `tests/unit/views/forum/forum-routing-prefix.spec.ts`

- [ ] **Step 1: Polish ForumHomeView.vue typography and badges**
  - Change `.forum-category-select :deep(.p-select-trigger)` font-weight from `var(--a-font-weight-black)` to `500`.
  - Change `.tr-badge` font-weight from `var(--a-font-weight-black)` to `500` / `600`.
  - Remove `text-transform: uppercase` on `.tr-badge-pin` and `.tr-badge-closed`.
  - Change `.forum-topic-author` font-weight from `var(--a-font-weight-strong)` to `500`.

- [ ] **Step 2: Polish ForumTopicView.vue and ForumNewTopicView.vue**
  - In `ForumTopicView.vue`:
    - `.topic-status-badge`: change font-weight to `500` and remove `text-transform: uppercase`.
    - `.topic-stat-num`: change font-weight to `500` and add `font-variant-numeric: tabular-nums;`.
    - Replace `var(--a-font-weight-strong)` on titles/usernames with `600` / `500`.
    - Change `th` background from `var(--a-color-disabled-bg)` to `var(--a-color-bg)`.
    - Change `.draft-restored` background from `var(--a-color-surface)` to `var(--a-color-bg)`.
  - In `ForumNewTopicView.vue`:
    - In `.empty-category-note`, replace `font-weight: var(--a-font-weight-strong)` with `font-weight: 500`.

- [ ] **Step 3: Run Forum unit tests**
  ```bash
  bun run test:unit tests/unit/views/forum/
  ```

- [ ] **Step 4: Commit changes**
  ```bash
  git commit -m "refactor(forum): eradicate heavy font weights and align surfaces to design system"
  ```

---

### Task 4: Whole-Module Integration, Full Test Suite & Branch Review

**Files:**
- All modified files in Tasks 1-3
- Contract test suites: `tests/unit/ui/design-system-contract.spec.ts`

- [ ] **Step 1: Run full type check**
  ```bash
  bun run type-check
  ```

- [ ] **Step 2: Run all Forum & Debate test suites**
  ```bash
  bun run test:unit tests/unit/views/debate tests/unit/views/forum tests/unit/components/debate tests/unit/ui/design-system-contract.spec.ts
  ```

- [ ] **Step 3: Run git diff format check**
  ```bash
  git diff --check
  ```

- [ ] **Step 4: Dispatch whole-branch code review subagent**
