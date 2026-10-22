# 统一搜索组件 (PSearchInput) 设计规范

**日期**: 2026-10-22  
**作者**: Antigravity  
**状态**: Approved (Approved by User, Option 1A selected)

---

## 1. 目标与背景

当前 Atoman 前端在多个业务场景（图书发现大厅、私人书架、标签索引、私信聊天、论坛、抽屉等）中各自手写了搜索输入框。存在以下痛点：
1. **视觉割裂**：部分页面使用了原生 `input[type="search"]`（带有 WebKit 默认清除按钮和阴影），部分页面手写了带阴影圆角的搜索框，违背了项目“纯白底色、0 阴影、4px 圆角、发丝微边框”的设计基线；
2. **能力参差**：某些页面缺少即时清除按钮，某些页面缺少快捷键支持（如 `⌘K`），某些页面缺乏前置范围选择（Scope Select，如“搜图书 / 搜作者 / 搜书单”）；
3. **交互重复**：回车触发 vs 防抖实时检索的防抖逻辑在各业务视图里重复编写。

本规范设计一个通用的标准 UI 组件 `PSearchInput.vue`（放入 `src/components/ui/`），统一全站的“长款主搜索栏”与“短款内联检索框”。

---

## 2. 核心架构与定位

### 2.1 组件定位
- **通用纯 UI 输入层组件**：只负责输入展现、清除操作、快捷键监听、范围切换、即时防抖及回车/点击触发。
- **不侵入业务数据请求**：业务 API 调用与状态管理由外层父组件（如各 View / Drawer / Store）自行业务绑定。

### 2.2 形态体系与样式基线

| 变体 (`variant`) | 适用场景 | 默认尺寸与高度 | 关键结构与视觉特征 |
| :--- | :--- | :--- | :--- |
| **`bar`** (长款主搜索栏) | 图书发现大厅、论坛主搜索、音乐大厅、全站知识库 | `size="lg"` (44px) 或 `size="md"` (40px) | **款式 1A 一体化贴合结构**：前置 Scope 选择器、搜索输入框、微型清空按钮、后置主行动搜索按钮贴合成一条，两端 4px 圆角，内部以 1px 发丝软线分割，严格 0 阴影。 |
| **`inline`** (短款内联框) | 个人书架、标签索引、私信会话、抽屉/弹窗、移动端工具栏 | `size="sm"` (32px) 或 `size="md"` (36px) | **紧凑内嵌**：前置发丝放大镜图标，未聚焦且空值时显示 `⌘K` 微型快捷键徽章，输入或激活后平滑切换为发丝清除按钮 (×)。 |

### 2.3 设计系统严格硬性约束
- **0 外部阴影**：严格执行 `box-shadow: none !important;`。
- **4px 统一圆角**：严格执行 `border-radius: var(--a-radius-control, 4px);`。
- **纯白纸张基底与发丝边框**：面板采用 `#ffffff`，边框采用 `1px solid var(--a-color-border-soft, #e2e8f0)`。
- **焦点态**：聚焦时边框平滑过渡为 `var(--a-color-primary, #0ea5e9)`，不添加外部扩散光晕阴影。
- **WebKit 伪元素净化**：显式设置 `::-webkit-search-cancel-button { display: none; }`，彻底隐藏各系统原生混乱的取消按钮，统一使用组件定制的矢量清除按钮。

---

## 3. 组件接口定义 (API Contract)

### 3.1 Props 属性定义

```typescript
export interface SearchScopeOption {
  label: string;
  value: string;
}

export interface PSearchInputProps {
  /** 双向绑定的搜索关键字 */
  modelValue?: string;
  /** 视觉变体: 'bar' (一体化长款主搜索栏) | 'inline' (紧凑短款内联框) */
  variant?: 'bar' | 'inline';
  /** 尺寸: 'sm' (32px) | 'md' (36px/40px) | 'lg' (44px) */
  size?: 'sm' | 'md' | 'lg';
  /** 输入框占位提示文本 */
  placeholder?: string;
  /** 是否展示后置搜索按钮 (长款 bar 默认 true，短款 inline 默认 false) */
  showActionButton?: boolean;
  /** 搜索按钮文本 (默认 '搜索') */
  actionButtonText?: string;
  /** 前置范围选择选项列表 (仅在 variant="bar" 或显式开启时展示) */
  scopes?: SearchScopeOption[];
  /** 当前选中的范围值 */
  scope?: string;
  /** 是否展示前置放大镜图标 (默认 true) */
  showSearchIcon?: boolean;
  /** 是否展示一键清空按钮 (默认 true) */
  clearable?: boolean;
  /** 是否显示键盘快捷键徽章 (默认 inline 为 true，bar 为 false) */
  showShortcutBadge?: boolean;
  /** 快捷键提示文本 (默认 '⌘K') */
  shortcutKey?: string;
  /** 监听全局该快捷键自动聚焦 input (默认 false，避免多实例冲突，仅顶层组件按需开启) */
  enableGlobalShortcut?: boolean;
  /** 防抖派发 update:modelValue 的延迟毫秒数 (0 表示不防抖，默认 0) */
  debounceMs?: number;
  /** 是否处于加载/搜索中状态 */
  loading?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 原生 input 的 name / id / aria-label */
  ariaLabel?: string;
}
```

### 3.2 Emits 事件定义

```typescript
export interface PSearchInputEmits {
  (e: 'update:modelValue', value: string): void;
  (e: 'update:scope', scope: string): void;
  /** 明确触发搜索 (回车触发或点击后置搜索按钮) */
  (e: 'search', query: string, scope?: string): void;
  /** 用户点击清空按钮 */
  (e: 'clear'): void;
  /** 焦点事件 */
  (e: 'focus', ev: FocusEvent): void;
  (e: 'blur', ev: FocusEvent): void;
}
```

### 3.3 Slots 插槽定义
- `prefix`: 前置自定义插槽（若提供，可替换默认放大镜图标）
- `scopes`: 自定义范围选择区域（若提供，可替换原生 select）
- `action`: 后置操作区域（若提供，可替换默认“搜索”按钮）

---

## 4. 关键交互行为与无障碍 (A11y)

1. **输入与防抖同步**：
   - 用户在 input 中输入时，组件根据 `debounceMs` 配置节流/防抖发射 `update:modelValue`；
   - 用户敲击 `Enter` 键时，立即派发 `@search(query, scope)` 并取消未完成的 debounce 延时。
2. **清除交互**：
   - 当 `modelValue` 非空且 `clearable=true` 时，显示微型清空按钮；
   - 点击清空按钮时，清空输入框、派发 `update:modelValue('')` 与 `@clear`，并将焦点重新放回 input。
3. **全局快捷键联动**：
   - 若 `enableGlobalShortcut=true`，注册 `keydown` 监听（如 `metaKey + k` 或 `ctrlKey + k`），触发时聚焦输入框并阻止浏览器默认行为。
   - 组件 `onUnmounted` 时清理全局事件监听。
4. **无障碍**：
   - 包含 `role="search"` 与 `aria-label`；
   - 清除按钮提供 `aria-label="清空搜索"`；
   - 键盘 Tab 键可聚焦清除按钮与后置搜索按钮。

---

## 5. 迁移与接入验证计划

在组件实现并完成全量单测后，选取图书系统核心场景进行替换验证：
1. **长款场景**：`src/views/books/BooksDiscoverView.vue`（替换手写 toolbar 与 search input）；
2. **短款场景 1**：`src/views/books/BookTagsView.vue`（替换标签检索 input）；
3. **短款场景 2**：`src/views/books/BookPrivateLibraryView.vue`（替换书架检索 input）。
