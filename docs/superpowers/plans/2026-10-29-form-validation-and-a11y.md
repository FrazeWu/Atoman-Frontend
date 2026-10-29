# 全站表单输入验证与错误反馈 a11y 标准化实施计划

> **For Agentic Pairing**: 严格执行测试驱动开发 (TDD)。每项任务遵循明确的红灯（RED）到绿灯（GREEN）循环。严禁修改 `AppTopbarAuthControls.vue`。严守纯平 0 阴影（`box-shadow: none !important;`）与 4px 标准圆角规范。

**Goal:** 全面标准化 Atoman 全站表单输入控件（`PInput`、`PTextarea`、`PSelect`、`PField`）的输入验证与错误反馈无障碍（WAI-ARIA 1.2 Form Controls），引入表单首错平滑视口居中吸附与自动聚焦工具 `useFormFocusError`，并通过静态契约测试守护全站表单体验。

**Architecture:**
- `src/components/ui/PInput.vue`: 单行文本输入控件，接入 `useId()`、`:aria-invalid`、`:aria-describedby`、`role="alert"` 与 0 阴影全边框危险色；
- `src/components/ui/PTextarea.vue`: 多行文本输入控件，接入相同的 a11y 属性与 0 阴影规范；
- `src/components/ui/PSelect.vue`: 下拉选择控件，触发器接入 `:aria-invalid`、`:aria-describedby` 与错误通知；
- `src/components/ui/PField.vue`: 通用表单项包装器，错误信息声明 `role="alert"` 与 `aria-live="polite"`；
- `src/composables/useFormFocusError.ts`: 通用表单错误检索与平滑视口滚动聚焦工具；
- `tests/unit/components/PInput.spec.ts`: PInput 组件单测；
- `tests/unit/components/PTextarea.spec.ts`: PTextarea 组件单测；
- `tests/unit/components/PSelect.spec.ts`: PSelect 组件单测；
- `tests/unit/composables/useFormFocusError.spec.ts`: 表单首错滚动聚焦单测；
- `tests/unit/ui/form-a11y-contract.spec.ts`: 全站表单静态契约测试。

---

### Task 1: 单行文本输入框 `PInput.vue` 与多行文本框 `PTextarea.vue` 的 a11y 标准化

**Files:**
- Modify: `src/components/ui/PInput.vue`
- Modify: `src/components/ui/PTextarea.vue`
- Modify: `tests/unit/components/PInput.spec.ts`
- Modify: `tests/unit/components/PTextarea.spec.ts`

**Interfaces:**
- `PInput.vue` & `PTextarea.vue`:
  - `useId()` 生成唯一 ID；
  - `errorId = computed(() => props.error ? `${inputId.value}-error` : undefined)`；
  - `hintId = computed(() => props.hint && !props.error ? `${inputId.value}-hint` : undefined)`；
  - `describedBy = computed(() => errorId.value || hintId.value || undefined)`；
  - 控件绑定：`:aria-invalid="error ? 'true' : undefined"`、`:aria-describedby="describedBy"`、`:aria-errormessage="errorId"`；
  - 错误提示：`<div v-if="error" :id="errorId" class="p-field-error" role="alert" aria-live="polite">{{ error }}</div>`；
  - 样式：`box-shadow: none !important;`，错误时 `border-color: var(--a-color-danger) !important;`。

- [ ] **Step 1: Write/Update unit tests for PInput & PTextarea a11y**
  - 在 `tests/unit/components/PInput.spec.ts` 中新增：
    - 验证当有 `error` 时，`<input>` 拥有 `aria-invalid="true"`、`aria-describedby="[inputId]-error"`、`aria-errormessage="[inputId]-error"`；
    - 验证错误信息具有 `id="[inputId]-error"`、`role="alert"`、`aria-live="polite"`；
    - 验证当无 `error` 且有 `hint` 时，`<input>` 拥有 `aria-describedby="[inputId]-hint"` 且无 `aria-invalid`。
  - 在 `tests/unit/components/PTextarea.spec.ts` 中补充相同断言。

- [ ] **Step 2: Run tests to observe failure (RED)**
  - 运行: `bun run test:unit tests/unit/components/PInput.spec.ts tests/unit/components/PTextarea.spec.ts`
  - 预期: FAIL。

- [ ] **Step 3: Implement changes in `PInput.vue` and `PTextarea.vue`**
  - 采用 Vue 原生 `useId()`；
  - 计算 `errorId`、`hintId`、`describedBy`；
  - 模板中绑定 `aria-invalid`、`aria-describedby`、`aria-errormessage`、`role="alert"`、`aria-live="polite"`；
  - 纯平 0 阴影与全边框错误样式。

- [ ] **Step 4: Run tests to verify pass (GREEN)**
  - 运行: `bun run test:unit tests/unit/components/PInput.spec.ts tests/unit/components/PTextarea.spec.ts`
  - 预期: PASS。

- [ ] **Step 5: Run type-check**
  - 运行: `bun run type-check`
  - 预期: 0 errors。

- [ ] **Step 6: Commit**
  - 运行: `git commit -am "feat(ui): standardize PInput and PTextarea a11y error validation and 0-shadow styling"`

---

### Task 2: 下拉选择框 `PSelect.vue` 与通用表单项 `PField.vue` a11y 标准化

**Files:**
- Modify: `src/components/ui/PSelect.vue`
- Modify: `src/components/ui/PField.vue`
- Modify: `tests/unit/components/PSelect.spec.ts`

**Interfaces:**
- `PSelect.vue`:
  - `useId()` 生成唯一 ID；
  - 触发器 `<button class="p-select-trigger">`: `:aria-invalid="error ? 'true' : undefined"`, `:aria-describedby="describedBy"`, `:aria-errormessage="errorId"`；
  - 错误提示：`<div v-if="error" :id="errorId" class="p-field-error" role="alert" aria-live="polite">{{ error }}</div>`；
  - 样式：`box-shadow: none !important;`，`.p-select-trigger--error` 声明全边框危险色。
- `PField.vue`:
  - `useId()` 生成唯一 ID；
  - 错误提示：`<div v-if="error" :id="errorId" class="p-field-error-msg" role="alert" aria-live="polite">{{ error }}</div>`。

- [ ] **Step 1: Write/Update unit tests for PSelect a11y**
  - 在 `tests/unit/components/PSelect.spec.ts` 中新增：
    - 验证当有 `error` 时，触发按钮拥有 `aria-invalid="true"`、`aria-describedby` 关联错误信息；
    - 验证错误信息具有 `id`、`role="alert"`、`aria-live="polite"`；
    - 验证当无 `error` 且有 `hint` 时正确关联 `hintId`。

- [ ] **Step 2: Run tests to observe failure (RED)**
  - 运行: `bun run test:unit tests/unit/components/PSelect.spec.ts`
  - 预期: FAIL。

- [ ] **Step 3: Implement changes in `PSelect.vue` and `PField.vue`**
  - 采用 `useId()`；
  - 绑定 `aria-invalid`、`aria-describedby`、`aria-errormessage`、`role="alert"`、`aria-live="polite"`；
  - 0 阴影与全边框错误高亮样式。

- [ ] **Step 4: Run tests to verify pass (GREEN)**
  - 运行: `bun run test:unit tests/unit/components/PSelect.spec.ts`
  - 预期: PASS。

- [ ] **Step 5: Run type-check**
  - 运行: `bun run type-check`
  - 预期: 0 errors。

- [ ] **Step 6: Commit**
  - 运行: `git commit -am "feat(ui): standardize PSelect and PField a11y error validation and styling"`

---

### Task 3: 表单首错平滑滚动与自动聚焦工具 (`useFormFocusError.ts`)

**Files:**
- Create: `src/composables/useFormFocusError.ts`
- Create: `tests/unit/composables/useFormFocusError.spec.ts`

**Interfaces:**
```ts
export function focusFirstInvalidField(
  container?: HTMLElement | Ref<HTMLElement | null> | null,
  options?: { smooth?: boolean; focus?: boolean },
): boolean

export function useFormFocusError(): {
  focusFirstInvalidField: typeof focusFirstInvalidField
  focusError: (
    container?: HTMLElement | Ref<HTMLElement | null> | null,
    options?: { smooth?: boolean; focus?: boolean },
  ) => Promise<boolean>
}
```

- [ ] **Step 1: Write unit tests in `tests/unit/composables/useFormFocusError.spec.ts`**
  - 测试在包含多个 `aria-invalid="true"` 输入框的容器中，成功定位并聚焦首个错误控件；
  - 测试调用 `scrollIntoView` 居中平滑吸附；
  - 测试跳过处于 `disabled` 状态的错误字段；
  - 测试容器无错误时返回 `false`，不抛出异常；
  - 测试异步 `focusError` 等待 Vue `nextTick()` 后正确聚焦刚出现的报错字段。

- [ ] **Step 2: Run test to observe failure (RED)**
  - 运行: `bun run test:unit tests/unit/composables/useFormFocusError.spec.ts`
  - 预期: FAIL。

- [ ] **Step 3: Implement `src/composables/useFormFocusError.ts`**
  - 编写 `focusFirstInvalidField` 与 `useFormFocusError` 逻辑。

- [ ] **Step 4: Run test to verify pass (GREEN)**
  - 运行: `bun run test:unit tests/unit/composables/useFormFocusError.spec.ts`
  - 预期: PASS。

- [ ] **Step 5: Run type-check**
  - 运行: `bun run type-check`
  - 预期: 0 errors。

- [ ] **Step 6: Commit**
  - 运行: `git commit -am "feat(composables): add useFormFocusError for smooth scrolling and autofocusing invalid fields"`

---

### Task 4: 自动化全站表单输入与验证无障碍契约测试守护 (`form-a11y-contract.spec.ts`)

**Files:**
- Create: `tests/unit/ui/form-a11y-contract.spec.ts`

- [ ] **Step 1: Write static contract tests**
  - 静态断言 `PInput.vue`:
    - `useId()`
    - `:aria-invalid=`
    - `:aria-describedby=`
    - `role="alert"`
    - `aria-live="polite"`
    - `box-shadow: none !important;`
  - 静态断言 `PTextarea.vue`:
    - `useId()`
    - `:aria-invalid=`
    - `:aria-describedby=`
    - `role="alert"`
    - `aria-live="polite"`
    - `box-shadow: none !important;`
  - 静态断言 `PSelect.vue`:
    - `useId()`
    - `:aria-invalid=`
    - `:aria-describedby=`
    - `role="alert"`
    - `aria-live="polite"`
    - `box-shadow: none !important;`
  - 静态断言 `PField.vue`:
    - `role="alert"`
    - `aria-live="polite"`
  - 静态断言 `useFormFocusError.ts`:
    - `[aria-invalid="true"]`
    - `scrollIntoView`

- [ ] **Step 2: Run contract test**
  - 运行: `bun run test:unit tests/unit/ui/form-a11y-contract.spec.ts`
  - 预期: PASS。

- [ ] **Step 3: Commit**
  - 运行: `git commit -am "test(contract): add form validation a11y and 0-shadow contract tests"`

---

### Task 5: 全站质量验证与双端打包交付

**Files:**
- Documentation: `docs/superpowers/plans/2026-10-29-form-validation-and-a11y.md`
- Kanban: `<appDataDir>/brain/72e9f847-045b-4790-a46f-1fe17ce2f1c1/frontend-refactor-status.md`

- [ ] **Step 1: Run TypeScript strict check**
  - 运行: `bun run type-check`
  - 预期: 0 errors。

- [ ] **Step 2: Run all full unit test suites**
  - 运行: `bun run test:unit`
  - 预期: 100% 全部通过。

- [ ] **Step 3: Run dual-bundle production build**
  - 运行: `bun run build && bun run build:mobile`
  - 预期: 双端构建成功 0 errors。

- [ ] **Step 4: Update kanban status**
  - 更新看板并记录本阶段成果。

- [ ] **Step 5: Commit and push**
  - 运行: `git push origin main`
  - 向用户汇报交付成果，并明确告知下一阶段建议处理内容。
