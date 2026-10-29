# 全站模态框与抽屉（Modal / Drawer / Sheet / Dialog）焦点锁定（Focus Trap）与无障碍标准化设计规范

## 1. 目标与背景

为了完善 Atoman 全站弹窗与抽屉系统的无障碍体验（Accessibility / a11y）与键盘可访问性，确保屏幕阅读器用户与纯键盘用户获得符合 WAI-ARIA 1.2 对话框标准（Dialog Modal Pattern）的流畅体验。

核心目标：
1. **智能首焦落点（Smart Initial Focus）**：
   - 告别盲目聚焦右上角关闭按钮；
   - 优先查找带有 `[autofocus]` 的交互元素；
   - 其次查找弹窗正文中的可聚焦元素（表单输入项、主要动作按钮）；
   - 仅当弹窗无任何正文可交互内容时，才聚焦关闭按钮或对话框本身；
   - 针对危险确认弹窗（`PConfirm` with `danger: true`），默认聚焦“取消”按钮以防止键盘误触回车。
2. **焦点陷阱（Strict Focus Trap）**：
   - 当对话框打开时，焦点严密锁定在对话框内，`Tab` 与 `Shift+Tab` 键实现首尾平滑回绕；
   - 过滤不可见（`display: none` / `visibility: hidden`）、`disabled`、`inert` 或 `aria-hidden="true"` 的隐藏元素；
   - 拦截焦点意外逃逸到背景页面（通过顶层活动对话框全局事件防护与哨兵机制）。
3. **焦点逐级还原（Focus Restoration Stack）**：
   - 支持多层嵌套弹窗（如抽屉中弹出媒体选择器、表单中弹出二次确认）；
   - 弹窗关闭时，按历史调用栈精准还原前置聚焦元素。
4. **背景滚动锁定（Body Scroll Lock）**：
   - 模态框打开期间锁定 `document.body` 滚动，多层弹窗关闭至最后一层时统一还原，避免背景滚动穿透。
5. **绝对约束**：
   - 桌面端顶栏交互与视觉组件（`AppTopbarAuthControls.vue`）**绝不修改任何 CSS/DOM**；
   - 严守纯白扁平设计规范：0 阴影（`box-shadow: none !important;`）与 4px 标准圆角（`var(--a-radius-card, 4px)`）；
   - 保持真数据原则与纯净用户态文案。

---

## 2. 架构设计与改动范围

### 2.1 涉及文件清单
1. **核心逻辑组合式函数**:
   - `src/composables/useDialogFocus.ts` (升级重构，核心焦点陷阱引擎)
2. **基础 UI 组件**:
   - `src/components/ui/PModal.vue` (更新首焦支持、标题关联 `aria-labelledby`)
   - `src/components/ui/PConfirm.vue` (更新危险操作首焦与确认弹窗无障碍描述)
   - `src/components/ui/PSheet.vue` (接入增强型焦点捕获与还原)
3. **测试套件**:
   - `tests/unit/composables/useDialogFocus.spec.ts` (新建，覆盖首焦、回绕、还原、不可见过滤与多层栈)
   - `tests/unit/system/PModal.spec.ts` (更新已有测试断言，新增首焦与回绕用例)
   - `tests/unit/ui/modal-a11y-focus-trap-contract.spec.ts` (新建，静态守护属性与 0 阴影规范)

---

## 3. 详细设计规格

### 3.1 核心组合式函数 `useDialogFocus.ts` 升级

```ts
export interface UseDialogFocusOptions {
  preventScroll?: boolean
  initialFocus?: 'auto' | 'first-input' | 'close-button' | HTMLElement | (() => HTMLElement | null)
  lockScroll?: boolean
  isTopLayer?: boolean | Ref<boolean>
}
```

#### 3.1.1 可见性与可聚焦元素检测算法
```ts
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function isElementVisible(el: HTMLElement): boolean {
  if (el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true' || el.hasAttribute('inert')) {
    return false
  }
  // 兼顾 happy-dom / jsdom 测试环境与真实浏览器环境
  if (el.offsetParent === null && el.getClientRects().length === 0 && typeof el.checkVisibility === 'function') {
    return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
  }
  const style = window.getComputedStyle ? window.getComputedStyle(el) : null
  if (style && (style.display === 'none' || style.visibility === 'hidden')) {
    return false
  }
  return true
}

export function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return []
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter(isElementVisible)
}
```

#### 3.1.2 智能首焦寻址策略
当对话框打开时：
1. 若 `options.initialFocus` 传入具体的 `HTMLElement` 或函数返回的 `HTMLElement`，直接聚焦该元素；
2. 若 `options.initialFocus === 'close-button'`，查找容器内关闭按钮并聚焦；
3. 否则默认执行 `auto` 策略：
   - a. 优先查找带有 `[autofocus]` 且可见的元素；
   - b. 其次查找正文区域内的表单控件（`input`, `textarea`, `select`）或主要交互按钮，排除右上角关闭按钮（如带有 `.p-modal-close-floating` 或 `.sheet-close-btn-bookmark`）；
   - c. 若无正文交互元素，聚焦第一个可见的可聚焦元素（可能为关闭按钮）；
   - d. 若容器内无任何可聚焦元素，聚焦容器自身（`root.focus()`，容器需有 `tabindex="-1"`）。

#### 3.1.3 焦点陷阱回绕与全局逃逸拦截
- 监听键盘事件：
  - `Escape`: 触发 `close()`，并 `event.preventDefault()` / `event.stopPropagation()`；
  - `Tab`:
    - 若容器内无有效可聚焦项，阻止默认行为并将焦点锁在容器上；
    - `Shift + Tab`（逆向）：当当前焦点是第一个元素，或焦点在容器外时，将焦点置于最后一个元素；
    - 普通 `Tab`（正向）：当当前焦点是最后一个元素时，将焦点置于第一个元素；
- 顶层文档监听：
  - 维护活动的对话框实例栈 `dialogStack: DialogInstance[]`；
  - 只有处于栈顶的对话框（最上层活动弹窗）响应全局键盘事件与焦点逃逸拦截；
  - 若用户点击背景或外部触发 `focusin`，若焦点不在活动弹窗内部，强制拉回活动弹窗的第一个可聚焦元素。

#### 3.1.4 栈式焦点还原（Focus Restoration Stack）
- 对话框打开时，记录 `previousFocus = document.activeElement as HTMLElement`；
- 对话框关闭或卸载时，验证 `previousFocus` 是否仍挂载在 DOM 树中（`target.isConnected`），若是则调用 `target.focus()`；
- 支持多层嵌套弹窗依次弹出与逐级回退，不会相互覆盖或丢失初始触发源。

#### 3.1.5 背景滚动锁定（Body Scroll Lock）
- 模块级计数器 `activeScrollLockCount = 0`；
- 当首个模态框打开且 `options.lockScroll !== false` 时：
  - 保存原始 `document.body.style.overflow`；
  - 设置 `document.body.style.overflow = 'hidden'`；
  - `activeScrollLockCount++`；
- 当模态框关闭或卸载时：
  - `activeScrollLockCount--`；
  - 当 `activeScrollLockCount <= 0` 时，还原原始 `document.body.style.overflow`。

---

### 3.2 基础组件改造对齐

#### 3.2.1 `PModal.vue`
- Props 扩展：
  - `initialFocus?: 'auto' | 'first-input' | 'close-button' | HTMLElement` (默认 `'auto'`)
  - `lockScroll?: boolean` (默认 `true`)
- ARIA 强化：
  - 内部生成唯一 `titleId = 'modal-title-' + useId()`；
  - 标题绑定 `:id="title ? titleId : undefined"`；
  - 容器绑定 `:aria-labelledby="title ? titleId : undefined"`（当无 title 时降级使用 `:aria-label="dialogLabel"`）；
  - 保留 `:role="role"` 与 `aria-modal="true"`。

#### 3.2.2 `PConfirm.vue`
- 首焦分流：
  - 当 `danger: true`（高风险删除/破坏性操作）时，`initialFocus` 默认指定为“取消”按钮引用，避免键盘用户敲击回车误删数据；
  - 当 `danger: false`（普通确认）时，默认聚焦“确认”按钮；
- ARIA 强化：
  - 消息文本绑定 `:id="confirmMessageId"`；
  - 容器通过 `aria-describedby` 关联消息文本。

#### 3.2.3 `PSheet.vue`
- 保留现有的 `useSheetStack` 多层抽屉管理能力；
- 将增强型 `useDialogFocus` 完整接入抽屉内部面板；
- 确保在抽屉打开时正文内容可顺畅导航，关闭后正确返回呼出抽屉的触发按钮。

---

## 4. 契约与质量防护

1. **自动化单测套件**:
   - `tests/unit/composables/useDialogFocus.spec.ts`
   - `tests/unit/system/PModal.spec.ts`
   - `tests/unit/ui/modal-a11y-focus-trap-contract.spec.ts`
2. **类型检查**:
   - 保持 `bun run type-check` 0 错误。
3. **样式与视觉**:
   - `box-shadow: none !important;`
   - 4px 标准圆角 `var(--a-radius-card, 4px)`。
