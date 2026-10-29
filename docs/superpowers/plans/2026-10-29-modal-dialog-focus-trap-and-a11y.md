# 全站模态框与抽屉 Focus Trap 与 a11y 标准化实施计划

> **For Agentic Pairing**: 严格执行测试驱动开发 (TDD)。每项任务遵循明确的红灯（RED）到绿灯（GREEN）循环。严禁修改 `AppTopbarAuthControls.vue`。严守纯平 0 阴影（`box-shadow: none !important;`）与 4px 标准圆角规范。

**Goal:** 全面标准化 Atoman 全站模态框与抽屉的键盘交互、智能首焦落点、Tab 闭环焦点陷阱、多层嵌套焦点逐级还原与无障碍属性体系。

**Architecture:**
- `src/composables/useDialogFocus.ts`: 核心焦点陷阱组合式函数，管理可见性过滤、智能首焦、活动弹窗栈、回绕与 body 滚动锁定；
- `src/components/ui/PModal.vue`: 基础模态框，接入增强型首焦控制与 `aria-labelledby` 关联；
- `src/components/ui/PConfirm.vue`: 二次确认弹窗，针对危险操作实施“取消”优先首焦防护与 `aria-describedby`；
- `tests/unit/composables/useDialogFocus.spec.ts`: 组合式函数单元测试；
- `tests/unit/system/PModal.spec.ts`: PModal 组件级交互测试；
- `tests/unit/components/ui/PConfirm.spec.ts`: PConfirm 组件级交互测试；
- `tests/unit/ui/modal-a11y-focus-trap-contract.spec.ts`: 静态契约测试，守护全站弹窗 a11y 与 0 阴影规范。

---

### Task 1: 核心焦点陷阱组合式函数重构与增强 (`useDialogFocus.ts`)

**Files:**
- Create/Modify: `src/composables/useDialogFocus.ts`
- Create: `tests/unit/composables/useDialogFocus.spec.ts`

**Interfaces:**
```ts
export interface UseDialogFocusOptions {
  preventScroll?: boolean
  initialFocus?: 'auto' | 'first-input' | 'close-button' | HTMLElement | (() => HTMLElement | null)
  lockScroll?: boolean
}

export function useDialogFocus(
  open: Readonly<Ref<boolean>>,
  root: Ref<HTMLElement | null>,
  close: () => void,
  options?: UseDialogFocusOptions,
): {
  handleKeydown: (event: KeyboardEvent) => void
}
```

- [x] **Step 1: Write unit tests in `tests/unit/composables/useDialogFocus.spec.ts`**
  - 测试打开时记录 `previousFocus`，关闭时还原焦点；
  - 测试 `options.initialFocus` 优先级：指定元素 > `[autofocus]` > 正文首个交互输入项/按钮 > 首个可聚焦元素；
  - 测试过滤 `display: none` / `visibility: hidden` / `disabled` / `aria-hidden="true"` 的隐藏元素；
  - 测试 Tab 在首尾元素之间正向与逆向（Shift+Tab）闭环回绕；
  - 测试 Escape 触发 `close()` 并阻止默认事件；
  - 测试多层弹窗嵌套时的前置焦点恢复栈；
  - 测试 `lockScroll` 开启时设置 `document.body.style.overflow = 'hidden'`，全部关闭后还原。

- [x] **Step 2: Run test to observe failure (RED)**
  - 运行: `bun run test:unit tests/unit/composables/useDialogFocus.spec.ts`
  - 预期: FAIL。

- [x] **Step 3: Implement enhanced `useDialogFocus.ts`**
  - 实现可见性检测 `isElementVisible`；
  - 实现首焦策略 `resolveInitialFocus`；
  - 实现键盘事件拦截与回绕 `handleKeydown`；
  - 引入活动弹窗栈拦截外部逃逸 `handleDocumentFocusIn`；
  - 引入滚动锁定全局计数器 `activeScrollLockCount`。

- [x] **Step 4: Run unit tests to verify pass (GREEN)**
  - 运行: `bun run test:unit tests/unit/composables/useDialogFocus.spec.ts`
  - 预期: PASS。

- [x] **Step 5: Run type-check**
  - 运行: `bun run type-check`
  - 预期: 0 errors。

- [x] **Step 6: Commit**
  - 运行: `git commit -am "feat(a11y): enhance useDialogFocus with smart initial focus, visibility filtering, and focus trap"`

---

### Task 2: 基础模态框标准化改造 (`PModal.vue`)

**Files:**
- Modify: `src/components/ui/PModal.vue`
- Modify: `tests/unit/system/PModal.spec.ts`

**Interfaces:**
- Props:
  - `initialFocus?: 'auto' | 'first-input' | 'close-button' | HTMLElement` (default `'auto'`)
  - `lockScroll?: boolean` (default `true`)
- Template:
  - `:aria-labelledby="title ? titleId : undefined"`
  - `:aria-label="title ? undefined : dialogLabel"`
  - `<h2 v-if="title" :id="titleId" class="p-modal-title-inline">{{ title }}</h2>`

- [x] **Step 1: Write/Update tests in `tests/unit/system/PModal.spec.ts`**
  - 验证当有表单输入项时，默认首焦落于正文表单项而非右上角关闭按钮；
  - 验证当存在带有 `autofocus` 的按钮或输入框时优先聚焦；
  - 验证 `aria-labelledby` 正确关联标题 `h2#modal-title-xxx`；
  - 验证关闭时还原前置触发焦点；
  - 验证 Tab 键在模态框内封闭循环。

- [x] **Step 2: Run test to observe failure (RED)**
  - 运行: `bun run test:unit tests/unit/system/PModal.spec.ts`
  - 预期: FAIL。

- [x] **Step 3: Implement changes in `src/components/ui/PModal.vue`**
  - 引入 `useId` 生成 `titleId`；
  - 绑定 `initialFocus` 与 `lockScroll` 传参给 `useDialogFocus`；
  - 确保 0 阴影 `box-shadow: none !important;` 规范。

- [x] **Step 4: Run test to verify pass (GREEN)**
  - 运行: `bun run test:unit tests/unit/system/PModal.spec.ts`
  - 预期: PASS。

- [x] **Step 5: Run type-check**
  - 运行: `bun run type-check`
  - 预期: 0 errors。

- [x] **Step 6: Commit**
  - 运行: `git commit -am "feat(modal): standardize PModal focus trap, initial focus, and a11y labeling"`

---

### Task 3: 危险操作与二次确认弹窗首焦与无障碍对齐 (`PConfirm.vue`)

**Files:**
- Modify: `src/components/ui/PConfirm.vue`
- Create/Modify: `tests/unit/components/ui/PConfirm.spec.ts`

**Interfaces:**
- Template:
  - `danger: true` 场景下首焦落于“取消”按钮引用，避免误触回车；
  - `danger: false` 场景下首焦落于“确认”按钮引用；
  - 消息文本添加 `:id="confirmMessageId"`，容器绑定 `:aria-describedby="confirmMessageId"`。

- [x] **Step 1: Write unit tests in `tests/unit/components/ui/PConfirm.spec.ts`**
  - 验证 `danger: true` 时焦点自动定位在“取消”按钮；
  - 验证 `danger: false` 时焦点自动定位在“确认”按钮；
  - 验证消息文本通过 `aria-describedby` 关联。

- [x] **Step 2: Run test to observe failure (RED)**
  - 运行: `bun run test:unit tests/unit/components/ui/PConfirm.spec.ts`
  - 预期: FAIL。

- [x] **Step 3: Implement changes in `src/components/ui/PConfirm.vue`**
  - 添加按钮 `ref` 引用；
  - 依据 `danger` 状态计算 `initialFocus`；
  - 绑定 `confirmMessageId` 与 `aria-describedby`。

- [x] **Step 4: Run test to verify pass (GREEN)**
  - 运行: `bun run test:unit tests/unit/components/ui/PConfirm.spec.ts`
  - 预期: PASS。

- [x] **Step 5: Run type-check**
  - 运行: `bun run type-check`
  - 预期: 0 errors。

- [x] **Step 6: Commit**
  - 运行: `git commit -am "feat(confirm): add danger-safe initial focus and aria-describedby to PConfirm"`

---

### Task 4: 自动化全站模态框与弹窗无障碍契约守护 (`modal-a11y-focus-trap-contract.spec.ts`)

**Files:**
- Create: `tests/unit/ui/modal-a11y-focus-trap-contract.spec.ts`

- [x] **Step 1: Write static contract tests**
  - 验证 `PModal.vue` 具有 `role="dialog"` 或 `role="alertdialog"`、`aria-modal="true"`、`useDialogFocus` 接入与 `box-shadow: none !important;`；
  - 验证 `PConfirm.vue` 正确使用 `role="alertdialog"` 与 `aria-describedby`；
  - 验证 `useDialogFocus.ts` 导出并包含可见性过滤与 Escape 拦截。

- [x] **Step 2: Run contract test**
  - 运行: `bun run test:unit tests/unit/ui/modal-a11y-focus-trap-contract.spec.ts`
  - 预期: PASS。

- [x] **Step 3: Commit**
  - 运行: `git commit -am "test(contract): add modal dialog focus trap and a11y contract tests"`

---

### Task 5: 全站质量验证与双端打包交付

**Files:**
- Documentation: `docs/superpowers/plans/2026-10-29-modal-dialog-focus-trap-and-a11y.md`
- Kanban: `<appDataDir>/brain/72e9f847-045b-4790-a46f-1fe17ce2f1c1/frontend-refactor-status.md`

- [x] **Step 1: Run TypeScript strict check**
  - 运行: `bun run type-check`
  - 预期: 0 errors。

- [x] **Step 2: Run all full unit test suites**
  - 运行: `bun run test:unit`
  - 预期: 100% 全部通过。

- [x] **Step 3: Run dual-bundle production build**
  - 运行: `bun run build && bun run build:mobile`
  - 预期: 双端构建成功 0 errors。

- [x] **Step 4: Update kanban status**
  - 更新看板并记录本阶段成果。

- [x] **Step 5: Commit and push**
  - 运行: `git push origin main`
  - 向用户汇报交付成果，并明确告知下一阶段建议处理内容。
