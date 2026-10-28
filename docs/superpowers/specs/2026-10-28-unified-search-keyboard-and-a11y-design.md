# 全局统一搜索（Unified Search）键盘快捷交互与无障碍（a11y）标准化设计规范

## 1. 概述与背景

统一搜索（Unified Search）是连接全站跨模块（文章、短笺、频道、订阅源、音乐单曲/专辑、图书、辩题等）的核心入口。当前系统中存在两套主要搜索交互载体：
1. **顶栏 Command Palette 沉浸式全局搜索面板 (`AppTopbarGlobalSearch.vue` + `TopbarSearchSection.vue`)**：
   - 用户通过 `⌘K` / `Ctrl+K` 或点击顶栏胶囊呼出的居中浮层；
   - 具备分类 Tab 切换和分组结果展示，但缺失严格符合 WAI-ARIA 1.2 Combobox 的属性映射（如 `role="combobox"`, `role="listbox"`, `role="option"`, `aria-activedescendant` 等）；
2. **独立搜索条 (`PUnifiedSearchBar.vue` + `PSearchInput.vue`)**：
   - 用于搜索结果页与模块内置搜索，下拉结果项未标注 `role="option"` 和 `aria-selected`，键盘焦点切换时缺乏平滑滚动吸附。

本规范确立统一的 WAI-ARIA 1.2 Combobox 规范，并标准化全站搜索的键盘快捷键导航、可视区域智能滚动与回车确认机制。

---

## 2. 设计原则与边界

1. **WAI-ARIA 1.2 组合框最佳实践**：
   - 输入框作为 `combobox` 控制关联的 `listbox`；
   - 键盘上下键切换高亮项时，通过 `aria-activedescendant` 指向当前活动条目的 DOM ID，确保屏幕阅读器即时朗读选中内容。
2. **可视区域智能吸附**：
   - 上下键切换时，高亮条目自动调用 `scrollIntoView({ block: 'nearest' })`，确保键盘导航不跳动且始终位于可视区域内。
3. **回车双态分流**：
   - 有候选项高亮时，按 Enter 键直接导航至高亮条目的目标资源；
   - 无候选项高亮时，按 Enter 键触发全量检索并跳转至 `/search?q=...`。
4. **纯白极简与 0 阴影规范**：
   - 所有下拉浮层、Command Palette 弹窗严格遵循纯白、扁平线框与 0 阴影约束（`box-shadow: none !important;`）。
5. **顶栏绝对安全保障**：
   - 用户特调的桌面端顶栏交互与视觉（`AppTopbarAuthControls.vue`）绝不修改任何 CSS/DOM。

---

## 3. 详细架构与接口规范

### 3.1 基础搜索输入框 a11y 扩展 (`PSearchInput.vue`)

扩展 Props 支持无障碍属性向下穿透至内部 `<input>`：

```ts
export interface PSearchInputProps {
  // 原有 props ...
  role?: string // 默认为 undefined，combobox 模式下传入 'combobox'
  ariaExpanded?: boolean
  ariaControls?: string
  ariaActiveDescendant?: string
  ariaAutocomplete?: 'list' | 'both' | 'inline' | 'none'
}
```

内部 `<input>` 属性映射：
```html
<input
  :id="id"
  ref="inputRef"
  type="search"
  class="p-search-input__input"
  :role="role === 'combobox' ? 'combobox' : undefined"
  :aria-expanded="ariaExpanded"
  :aria-controls="ariaControls"
  :aria-activedescendant="ariaActiveDescendant"
  :aria-autocomplete="ariaAutocomplete || (role === 'combobox' ? 'list' : undefined)"
  :aria-haspopup="role === 'combobox' ? 'listbox' : undefined"
  ...
/>
```

### 3.2 顶栏 Command Palette 全局搜索 (`AppTopbarGlobalSearch.vue` & `TopbarSearchSection.vue`)

- **输入框 Combobox 契约**：
  ```html
  <input
    ref="searchInputRef"
    v-model="searchDraft"
    class="palette-input"
    type="search"
    role="combobox"
    aria-autocomplete="list"
    aria-haspopup="listbox"
    :aria-expanded="showSearch"
    aria-controls="topbar-search-results-listbox"
    :aria-activedescendant="activeOptionId"
    aria-label="全局搜索输入"
    ...
  />
  ```
  其中 `activeOptionId = computed(() => activeItem.value ? `search-option-${activeItem.value.id}` : undefined)`。

- **结果列表与分组契约 (`TopbarSearchSection.vue`)**：
  - 外层容器声明 `id="topbar-search-results-listbox"`、`role="listbox"`、`aria-label="全局搜索建议"`；
  - 每一个分类区块声明 `role="group"`，并通过 `:aria-label="section.label"` 区分模块分类；
  - 每一个条目按钮声明：
    ```html
    <button
      :id="`search-option-${item.id}`"
      role="option"
      :aria-selected="activeId === item.id"
      type="button"
      class="topbar-search-section__item"
      :class="{ 'is-active': activeId === item.id }"
      @click="$emit('openItem', item.href)"
    >
      ...
    </button>
    ```

- **键盘导航与平滑滚动**：
  ```ts
  watch(() => globalSearch.activeIndex.value, async () => {
    await nextTick()
    searchPanelRef.value?.querySelector('.topbar-search-section__item.is-active')?.scrollIntoView?.({ block: 'nearest' })
  })
  ```

- **全局快捷键策略**：
  - `⌘K` / `Ctrl+K`：全局切换浮层开启/关闭；
  - `/`：快速唤起，在 `INPUT` / `TEXTAREA` / `[contenteditable]` 内输入时静默放行；
  - `Escape`：立即关闭并清理搜索草稿。

### 3.3 页面级统一搜索条 (`PUnifiedSearchBar.vue`)

- **`<PSearchInput>` 组合框属性**：
  - `role="combobox"`；
  - `:aria-expanded="isDropdownOpen && hasDropdownContent"`；
  - `aria-controls="unified-search-preview-listbox"`；
  - `:aria-activedescendant="activeIndex >= 0 ? `unified-search-option-${activeIndex}` : undefined"`。

- **下拉列表与选项契约**：
  ```html
  <div
    id="unified-search-preview-listbox"
    role="listbox"
    aria-label="搜索候选项"
    class="p-unified-search-dropdown__list"
  >
    <div
      v-for="(item, idx) in previewHits"
      :id="`unified-search-option-${idx}`"
      :key="item.id"
      role="option"
      :aria-selected="activeIndex === idx"
      class="p-unified-search-dropdown__item"
      :class="{ 'is-active': activeIndex === idx }"
      @mousedown.prevent="handleSelectItem(item)"
    >
      ...
    </div>
  </div>
  ```

- **可视吸附与键盘导航**：
  - 监听 `activeIndex` 变化，自动触发 `.p-unified-search-dropdown__item.is-active` 的 `scrollIntoView({ block: 'nearest' })`；
  - `ArrowDown` / `ArrowUp` 循环切换；
  - `Enter` 键智能分流（选中项直接跳转 vs 无选中时全量检索）；
  - `Escape` 键关闭下拉。

---

## 4. 质量保证与测试计划

1. **`AppTopbarGlobalSearch.spec.ts`**:
   - 验证输入框 `role="combobox"`、`aria-expanded`、`aria-controls` 与 `aria-activedescendant`；
   - 验证结果列表 `role="listbox"`、分组 `role="group"` 与结果项 `role="option"`、`aria-selected`；
   - 验证 `↑`/`↓` 按键切换循环及 `Enter` 选中跳转。
2. **`PSearchInput.spec.ts` & `PUnifiedSearchBar.spec.ts`**:
   - 验证 `PSearchInput` 对 combobox a11y 属性的透传；
   - 验证 `PUnifiedSearchBar` 下拉展开时 `role="combobox"` / `aria-expanded` / `aria-activedescendant` 的动态联动；
   - 验证键盘按键上下导航与 Enter 跳转。
3. **样式与视觉契约**:
   - 严格断言 0 阴影（`box-shadow: none !important;`）与 4px 标准圆角约束。
