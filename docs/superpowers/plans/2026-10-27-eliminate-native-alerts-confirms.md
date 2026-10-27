# 全站原生弹窗 (window.alert / window.confirm) 淘汰实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 彻底清理全站源码中仅存的 3 处阻塞式原生 `window.alert` 与 `window.confirm`，分别收敛至标准 `<PModal>` 与 `<PConfirm>`，并创建全站静态扫描防回退契约测试。

**Architecture:** 
- `FeedRecommendedView.vue`: 推荐依据展示接入 `<PModal>`；
- `BookNotesView.vue`: 笔记删除接入 `<PConfirm>` 并更新对应单测；
- `useFeedSubscriptionManager.ts` & `FeedView.vue`: 规则应用确认解耦为响应式状态并由 `FeedView.vue` 挂载 `<PConfirm>`；
- `tests/unit/system/native-dialog-contract.spec.ts`: 建立 0 原生弹窗的工程契约。

**Tech Stack:** Vue 3.4, TypeScript 5.8, Pinia, Vitest, Vue Test Utils.

## Global Constraints
- 严格 0 阴影：`box-shadow: none !important;`。
- 严格 4px 圆角：统一切换为 `var(--a-radius-card, 4px)` 或 `var(--a-radius-control, 4px)`。
- 全语义 Token：严禁硬编码 hex 颜色。
- 杜绝假数据：严禁引入 Mock 数据。
- TypeScript：严格类型安全，`bun run type-check` 0 error。

---

### Task 1: 建立全站原生弹窗 0 容忍契约测试

**Files:**
- Create: `tests/unit/system/native-dialog-contract.spec.ts`

**Interfaces:**
- Produces: Failing test verifying that `src/` and `apps/mobile/` contain 0 occurrences of `window.alert` and `window.confirm`.

- [ ] **Step 1: Write native dialog contract test**
  Create `tests/unit/system/native-dialog-contract.spec.ts` scanning `.vue` and `.ts` files in `src/` and `apps/mobile/` for `window.alert` and `window.confirm`.

- [ ] **Step 2: Run test to verify failure**
  Run `cd Atoman-Frontend && bun run test:unit tests/unit/system/native-dialog-contract.spec.ts`.
  Verify it reports exactly the 3 known violations.

- [ ] **Step 3: Commit initial test**
  Commit with message `test: add contract test against window.alert and window.confirm usages`.

---

### Task 2: 推荐流依据弹窗 `FeedRecommendedView.vue` 收网至标准 `PModal`

**Files:**
- Modify: `src/views/feed/FeedRecommendedView.vue`
- Test: `tests/unit/views/feed/FeedRecommendedView.spec.ts`

**Interfaces:**
- Consumes: `<PModal>` (`size="sm"`, `title="推荐依据"`)
- Produces: Clean accessible modal showing score reason and dismiss button.

- [ ] **Step 1: Update `FeedRecommendedView.vue`**
  - Add `activeReasonItem = ref<RecommendationItem | null>(null)`.
  - In `showRecommendationReason(item)`: set `activeReasonItem.value = item`.
  - Add `<PModal :show="Boolean(activeReasonItem)" size="sm" title="推荐依据" @close="activeReasonItem = null">` to template.
  - Remove `window.alert`.

- [ ] **Step 2: Verify tests**
  Run `cd Atoman-Frontend && bun run test:unit tests/unit/views/feed/FeedRecommendedView.spec.ts`.

- [ ] **Step 3: Commit changes**
  Commit with message `refactor(feed): replace window.alert with standard PModal for recommendation reason`.

---

### Task 3: 读书笔记删除确认 `BookNotesView.vue` 收网至标准 `PConfirm`

**Files:**
- Modify: `src/views/books/BookNotesView.vue`
- Modify: `tests/unit/views/books/BookNotesView.spec.ts`

**Interfaces:**
- Consumes: `<PConfirm>` (`title="删除读书笔记"`, `:danger="true"`, `confirm-text="删除"`)
- Produces: Asynchronous confirm dialog with full keyboard accessibility.

- [ ] **Step 1: Update `BookNotesView.vue`**
  - Import `PConfirm` from `@/components/ui/PConfirm.vue`.
  - Replace `window.confirm` with `deletingNote` ref and `executeDeleteNote` function.
  - Render `<PConfirm>` bound to `deletingNote`.

- [ ] **Step 2: Update unit tests in `BookNotesView.spec.ts`**
  - Update delete test to interact with `PConfirm` instead of stubbing `window.confirm`.

- [ ] **Step 3: Run unit tests to verify passing**
  Run `cd Atoman-Frontend && bun run test:unit tests/unit/views/books/BookNotesView.spec.ts`.

- [ ] **Step 4: Commit changes**
  Commit with message `refactor(books): replace window.confirm with standard PConfirm dialog in BookNotesView`.

---

### Task 4: 订阅规则保存后应用提示收敛至响应式 `PConfirm`

**Files:**
- Modify: `src/composables/feed/useFeedSubscriptionManager.ts`
- Modify: `src/views/feed/FeedView.vue`

**Interfaces:**
- Exposes: `pendingRuleToApply`, `executeApplySavedRule`, `cancelApplySavedRule`
- Consumes: `<PConfirm>` in `FeedView.vue`

- [ ] **Step 1: Refactor `useFeedSubscriptionManager.ts`**
  - Replace `window.confirm` with `pendingRuleToApply = ref<{ id: string } | null>(null)`.
  - Provide `executeApplySavedRule` and `cancelApplySavedRule`.
  - Export them in the returned manager object.

- [ ] **Step 2: Mount `<PConfirm>` in `FeedView.vue`**
  - Render `<PConfirm>` when `pendingRuleToApply` is present.
  - Bind `@confirm="executeApplySavedRule"` and `@cancel="cancelApplySavedRule"`.

- [ ] **Step 3: Run feed subscription unit tests**
  Run `cd Atoman-Frontend && bun run test:unit tests/unit/composables/useFeedSubscriptionManager.spec.ts tests/unit/components/feed/SubscriptionManageSheet.spec.ts`.

- [ ] **Step 4: Commit changes**
  Commit with message `refactor(feed): eliminate window.confirm in useFeedSubscriptionManager using PConfirm`.

---

### Task 5: 契约测试验证、全站回归与双端生产构建

**Files:**
- Verify: Full codebase

- [ ] **Step 1: Run native dialog contract test**
  Run `cd Atoman-Frontend && bun run test:unit tests/unit/system/native-dialog-contract.spec.ts`.
  Verify 0 violations across codebase.

- [ ] **Step 2: Run TypeScript type check**
  Run `cd Atoman-Frontend && bun run type-check`.

- [ ] **Step 3: Run full Vitest suite**
  Run `cd Atoman-Frontend && bun run test:unit`.

- [ ] **Step 4: Run production builds**
  Run `cd Atoman-Frontend && bun run build` (desktop) and `cd Atoman-Frontend && bun run build:mobile` (mobile).

- [ ] **Step 5: Commit, update board, and push**
  Push all commits to `origin/main`.
