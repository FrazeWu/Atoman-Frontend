# 全站表单输入验证与错误反馈无障碍（a11y）标准化设计规范

## 1. 目标与背景

为了完善 Atoman 全站表单交互的无障碍体验（Accessibility / a11y）与键盘可访问性，确保屏幕阅读器用户与纯键盘用户获得符合 WAI-ARIA 1.2 Form Controls 标准（Form Validation & Error Notification Pattern）的流畅体验。

核心目标：
1. **统一输入无障碍语义（WAI-ARIA 1.2 Form Controls）**：
   - 基础表单输入控件（`PInput.vue`、`PTextarea.vue`、`PSelect.vue`、`PField.vue`）在校验失败（`error` 存在）时，必须明确声明 `:aria-invalid="error ? 'true' : undefined"`；
   - 错误提示文本必须拥有唯一 ID，并通过输入控件的 `:aria-describedby` 建立关联；
   - 错误提示文本容器必须标注 `role="alert"` 与 `aria-live="polite"`，便于辅助设备实时播报错误内容；
   - 当无错误且存在提示说明（`hint`）时，通过 `:aria-describedby` 关联 `hintId`。
2. **标识符标准化（Vue 3 原生 `useId()`）**：
   - 全面淘汰 `Math.random()`、自增计数器与私有 `uid`；
   - 统一采用 Vue 3.5 原生 `useId()` 生成 SSR/CSR 强一致、无水合冲突的唯一 ID 体系。
3. **表单首错自动聚焦与平滑滚动引导（Scroll & Focus to First Error）**：
   - 封装轻量级通用表单错误导流工具 `useFormFocusError.ts`；
   - 当表单校验未通过时，自动检索首个 `[aria-invalid="true"]` 的输入控件，执行平滑视口居中吸附并赋予焦点，免除用户在长表单中搜寻错误。
4. **纯平视觉与 0 阴影规范**：
   - 错误状态控件统一使用实线边框颜色 `var(--a-color-danger)`；
   - 强制声明 `box-shadow: none !important;` 与 4px 标准圆角（`var(--a-radius-control, 4px)`），彻底清除任何残存阴影。
5. **绝对约束**：
   - 桌面端顶栏交互与视觉组件（`AppTopbarAuthControls.vue`）**绝不修改任何 CSS/DOM**；
   - 保持纯净用户态文案，杜绝内部/开发者视角词汇。

---

## 2. 架构设计与改动范围

### 2.1 涉及文件清单
1. **基础表单 UI 组件**:
   - `src/components/ui/PInput.vue` (升级 `useId`、`aria-invalid`、`aria-describedby`、`role="alert"`、0 阴影规范)
   - `src/components/ui/PTextarea.vue` (升级 `useId`、`aria-invalid`、`aria-describedby`、`role="alert"`、0 阴影规范)
   - `src/components/ui/PSelect.vue` (升级 `useId`、`aria-invalid`、`aria-describedby`、`role="alert"`、0 阴影规范)
   - `src/components/ui/PField.vue` (升级 `useId`、`role="alert"` 与辅助属性)
2. **通用组合式逻辑**:
   - `src/composables/useFormFocusError.ts` (新建，用于表单校验失败时查找首个 `[aria-invalid="true"]` 并平滑滚动聚焦)
3. **测试套件**:
   - `tests/unit/components/PInput.spec.ts` (扩充 a11y 验证测试)
   - `tests/unit/components/PTextarea.spec.ts` (扩充 a11y 验证测试)
   - `tests/unit/components/PSelect.spec.ts` (扩充 a11y 验证测试)
   - `tests/unit/composables/useFormFocusError.spec.ts` (新建，验证首错检索、滚动吸附与聚焦)
   - `tests/unit/ui/form-a11y-contract.spec.ts` (新建，全站表单 a11y 契约守护)

---

## 3. 详细设计规格

### 3.1 基础表单输入控件升级

#### 3.1.1 `PInput.vue`
```ts
const defaultId = useId()
const inputId = computed(() => (typeof attrs.id === 'string' && attrs.id.length > 0 ? attrs.id : defaultId))
const errorId = computed(() => (props.error ? `${inputId.value}-error` : undefined))
const hintId = computed(() => (props.hint && !props.error ? `${inputId.value}-hint` : undefined))
const describedBy = computed(() => errorId.value || hintId.value || undefined)
```

模板绑定：
```html
<input
  :id="inputId"
  class="p-input"
  :class="{ 'p-input--error': Boolean(error) }"
  :aria-invalid="error ? 'true' : undefined"
  :aria-describedby="describedBy"
  :aria-errormessage="errorId"
  v-bind="$attrs"
  :value="modelValue"
  :disabled="disabled"
  @input="handleInput"
/>
...
<div
  v-if="error"
  :id="errorId"
  class="p-field-error"
  role="alert"
  aria-live="polite"
>
  {{ error }}
</div>
<div v-else-if="hint" :id="hintId" class="p-field-hint">{{ hint }}</div>
```

样式规范：
```css
.p-input {
  box-shadow: none !important;
  /* 基础控制台高度与圆角规范 */
}
.p-input--error {
  border-color: var(--a-color-danger) !important;
  box-shadow: none !important;
}
.p-input--error:focus {
  outline: 2px solid color-mix(in srgb, var(--a-color-danger) 24%, transparent) !important;
  outline-offset: 1px;
  border-color: var(--a-color-danger) !important;
}
```

#### 3.1.2 `PTextarea.vue`
与 `PInput.vue` 对齐：
- `const defaultId = useId()`
- 计算 `textareaId`、`errorId`、`hintId` 与 `describedBy`；
- `<textarea>` 绑定 `:aria-invalid="error ? 'true' : undefined"`、`:aria-describedby="describedBy"`、`:aria-errormessage="errorId"`；
- 错误提示文本声明 `:id="errorId"`、`role="alert"`、`aria-live="polite"`；
- 纯色 0 阴影 `.p-textarea--error` 样式。

#### 3.1.3 `PSelect.vue`
与 `PInput.vue` 对齐：
- `const instanceId = useId()`，`triggerId = `${instanceId}-trigger``，`listboxId = `${instanceId}-listbox``；
- 计算 `errorId`、`hintId` 与 `describedBy`；
- 触发按钮 `<button class="p-select-trigger">` 绑定：
  - `:aria-invalid="error ? 'true' : undefined"`
  - `:aria-describedby="describedBy"`
  - `:aria-errormessage="errorId"`
- 错误提示文本声明 `:id="errorId"`、`role="alert"`、`aria-live="polite"`；
- 纯色 0 阴影 `.p-select-trigger--error` 样式。

#### 3.1.4 `PField.vue`
- `const fieldId = useId()`；
- `const errorId = computed(() => (props.error ? `${fieldId}-error` : undefined))`；
- `const hintId = computed(() => (props.hint && !props.error ? `${fieldId}-hint` : undefined))`；
- `<div v-if="error" :id="errorId" class="p-field-error-msg" role="alert" aria-live="polite">{{ error }}</div>`；
- `<div v-if="hint" :id="hintId" class="p-field-hint">{{ hint }}</div>`。

---

### 3.2 表单错误导流工具 `useFormFocusError.ts`

```ts
import { nextTick, type Ref, unref } from 'vue'

export function focusFirstInvalidField(
  container?: HTMLElement | Ref<HTMLElement | null> | null,
  options: { smooth?: boolean; focus?: boolean } = {},
): boolean {
  const root = unref(container) ?? document
  const invalidElement = root.querySelector<HTMLElement>('[aria-invalid="true"]:not([disabled])')
  if (!invalidElement) return false

  if (options.smooth !== false && typeof invalidElement.scrollIntoView === 'function') {
    invalidElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  if (options.focus !== false) {
    invalidElement.focus({ preventScroll: true })
  }

  return true
}

export function useFormFocusError() {
  const focusError = async (
    container?: HTMLElement | Ref<HTMLElement | null> | null,
    options?: { smooth?: boolean; focus?: boolean },
  ) => {
    await nextTick()
    return focusFirstInvalidField(container, options)
  }

  return {
    focusFirstInvalidField,
    focusError,
  }
}
```

---

### 3.3 自动化契约守护

在 `tests/unit/ui/form-a11y-contract.spec.ts` 中针对表单全系组件进行静态契约守护：
- `PInput.vue`: 断言 `:aria-invalid=`、`:aria-describedby=`、`role="alert"`、`aria-live="polite"`、`box-shadow: none !important;`；
- `PTextarea.vue`: 断言 `:aria-invalid=`、`:aria-describedby=`、`role="alert"`、`aria-live="polite"`、`box-shadow: none !important;`；
- `PSelect.vue`: 断言 `:aria-invalid=`、`:aria-describedby=`、`role="alert"`、`aria-live="polite"`、`box-shadow: none !important;`；
- `PField.vue`: 断言 `role="alert"`、`aria-live="polite"`；
- `useFormFocusError.ts`: 断言 `[aria-invalid="true"]` 选择器查询与 `scrollIntoView`。
