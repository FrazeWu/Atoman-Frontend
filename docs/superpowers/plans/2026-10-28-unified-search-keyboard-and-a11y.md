# 全局统一搜索（Unified Search）键盘快捷交互与无障碍（a11y）标准化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为顶栏 Command Palette 全局搜索及页面级独立搜索条（`PUnifiedSearchBar`）全面建立符合 WAI-ARIA 1.2 Combobox 标准的无障碍契约，并实现平滑的键盘快捷导航（`⌘K` / `Ctrl+K` / `/`、`↑`/`↓` 循环巡航、可视区域吸附与 `Enter` 智能跳转）。

**Architecture:** 
- 在底层组件 `PSearchInput.vue` 扩展支持 `role="combobox"` 及 `aria-controls`、`aria-expanded`、`aria-activedescendant`、`aria-autocomplete` 属性透传；
- 在顶栏搜索 `AppTopbarGlobalSearch.vue` 与 `TopbarSearchSection.vue` 中接入标准 Combobox 与 Listbox/Group/Option 属性体系，联动动态 `activeOptionId` 与平滑滚动吸附；
- 在结果页独立搜索条 `PUnifiedSearchBar.vue` 下拉列表中接入标准 Option 属性与键盘视口平滑滚动；
- 编写专门的静态契约测试 `search-a11y-contract.spec.ts` 守护各搜索入口的无障碍与 0 阴影规范。

**Tech Stack:** Vue 3.4, TypeScript 5.8, WAI-ARIA 1.2, Pinia 2, Vitest, Vue Test Utils.

## Global Constraints

- 前端设计与 UI 实现时，不要在界面里写过多解释性说明；
- 前端用户可见文案默认收敛为简洁用户态，优先服务当前动作；
- 坚守扁平化设计，严格声明 0 阴影（`box-shadow: none !important;`）与 4px 标准圆角；
- 用户特调的桌面端顶栏交互与视觉（`AppTopbarAuthControls.vue`）绝不修改任何 CSS/DOM；
- 遵循真数据原则，杜绝任何 Fake/Mock 数据；
- 任务完成前必须运行 `bun run type-check` 与 `bun run test:unit`。

---

### Task 1: 基础搜索输入框 a11y 属性扩展 (`PSearchInput.vue`)

**Files:**
- Modify: `src/components/ui/PSearchInput.vue`
- Test: `tests/unit/components/ui/PSearchInput.spec.ts`

**Interfaces:**
- Props:
  ```ts
  role?: string
  ariaExpanded?: boolean
  ariaControls?: string
  ariaActiveDescendant?: string
  ariaAutocomplete?: 'list' | 'both' | 'inline' | 'none'
  ```
- Output: Attributes properly mapped to `<input>` element inside `PSearchInput`.

- [ ] **Step 1: Write unit tests for combobox a11y props mapping**

In `tests/unit/components/ui/PSearchInput.spec.ts`:
1. Test that passing `role="combobox"` correctly sets `role="combobox"` on the input element;
2. Test that passing `ariaExpanded`, `ariaControls`, `ariaActiveDescendant`, and `ariaAutocomplete` reflects onto the `<input>` element;
3. Test that default usage maintains normal search behavior without unnecessary ARIA attributes.

- [ ] **Step 2: Run test to observe failure**

Run: `bun run test:unit tests/unit/components/ui/PSearchInput.spec.ts`
Expected: FAIL since props are not yet defined on `PSearchInput`.

- [ ] **Step 3: Update `src/components/ui/PSearchInput.vue`**

Add props to `PSearchInputProps`:
```ts
export interface PSearchInputProps {
  // ...
  role?: string
  ariaExpanded?: boolean
  ariaControls?: string
  ariaActiveDescendant?: string
  ariaAutocomplete?: 'list' | 'both' | 'inline' | 'none'
}
```
Bind to `<input>`:
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

- [ ] **Step 4: Run test to verify pass**

Run: `bun run test:unit tests/unit/components/ui/PSearchInput.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git commit -am "feat(ui): add combobox a11y attributes support to PSearchInput"`

---

### Task 2: 顶栏 Command Palette 全局搜索 a11y 与跨组键盘巡航

**Files:**
- Modify: `src/components/system/AppTopbarGlobalSearch.vue`
- Modify: `src/components/system/TopbarSearchSection.vue`
- Test: `tests/unit/components/system/AppTopbarGlobalSearch.spec.ts`

**Interfaces:**
- Input: `role="combobox"`, `aria-controls="topbar-search-results-listbox"`, `:aria-activedescendant="activeOptionId"`, `:aria-expanded="showSearch"`.
- Output: Listbox container with `id="topbar-search-results-listbox"` and `role="listbox"`, sections with `role="group"`, items with `role="option"`, `:id="search-option-${item.id}"`, `:aria-selected="activeId === item.id"`.

- [ ] **Step 1: Write unit tests for Command Palette a11y & keynav**

In `tests/unit/components/system/AppTopbarGlobalSearch.spec.ts`:
1. Assert input has `role="combobox"`, `aria-autocomplete="list"`, `aria-controls="topbar-search-results-listbox"`, and `:aria-expanded="showSearch"`;
2. Assert active descendant `:aria-activedescendant` is set when an item is selected via arrow down/up;
3. Assert results list container has `role="listbox"`, each section has `role="group"`, and items have `role="option"`;
4. Assert pressing Enter on active item invokes router navigation;
5. Assert typing `/` inside input/textarea does not trigger search open.

- [ ] **Step 2: Run test to observe failure**

Run: `bun run test:unit tests/unit/components/system/AppTopbarGlobalSearch.spec.ts`
Expected: FAIL due to missing combobox/option ARIA attributes.

- [ ] **Step 3: Update `TopbarSearchSection.vue`**

Add listbox/group/option attributes:
```html
<section class="topbar-search-section" role="group" :aria-label="section.label">
  <header class="topbar-search-section__header">
    <div class="topbar-search-section__badge">
      <component :is="sectionIcon" :size="13" class="section-icon" aria-hidden="true" />
      <h3>{{ section.label }}</h3>
    </div>
    <span class="section-count">{{ section.items.length }}</span>
  </header>

  <div class="topbar-search-section__list">
    <button
      v-for="item in section.items"
      :id="`search-option-${item.id}`"
      :key="item.id"
      type="button"
      role="option"
      :aria-selected="activeId === item.id"
      class="topbar-search-section__item"
      :class="{ 'is-active': activeId === item.id }"
      @click="$emit('openItem', item.href)"
    >
      ...
    </button>
  </div>
</section>
```

- [ ] **Step 4: Update `AppTopbarGlobalSearch.vue`**

1. Set `role="combobox"`, `aria-autocomplete="list"`, `aria-haspopup="listbox"`, `:aria-expanded="showSearch"`, `aria-controls="topbar-search-results-listbox"`, and `:aria-activedescendant="activeOptionId"` on `<input class="palette-input">`;
2. Add computed:
   ```ts
   const activeOptionId = computed(() => activeItem.value ? `search-option-${activeItem.value.id}` : undefined)
   ```
3. Set `id="topbar-search-results-listbox" role="listbox" aria-label="全局搜索建议"` on the results container `<div class="palette-results">`;
4. Smooth scroll into view when `activeIndex` changes:
   ```ts
   watch(() => globalSearch.activeIndex.value, async () => {
     await nextTick()
     searchPanelRef.value?.querySelector('.topbar-search-section__item.is-active')?.scrollIntoView?.({ block: 'nearest' })
   })
   ```

- [ ] **Step 5: Run tests to verify pass**

Run: `bun run test:unit tests/unit/components/system/AppTopbarGlobalSearch.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

Run: `git commit -am "feat(search): standardize Command Palette combobox a11y and keyboard navigation"`

---

### Task 3: 页面级统一搜索条 下拉 Combobox a11y 与可视吸附 (`PUnifiedSearchBar.vue`)

**Files:**
- Modify: `src/components/search/PUnifiedSearchBar.vue`
- Test: `tests/unit/components/search/PUnifiedSearchBar.spec.ts`

**Interfaces:**
- Input: `role="combobox"`, `aria-controls="unified-search-preview-listbox"`, `:aria-activedescendant="activeOptionId"`, `:aria-expanded="isDropdownOpen && hasDropdownContent"`.
- Output: Listbox container with `id="unified-search-preview-listbox"` and `role="listbox"`, options with `role="option"`, `:id="unified-search-option-${idx}"`, `:aria-selected="activeIndex === idx"`.

- [ ] **Step 1: Write unit tests for PUnifiedSearchBar a11y & keynav**

In `tests/unit/components/search/PUnifiedSearchBar.spec.ts`:
1. Assert `PSearchInput` receives `role="combobox"`, `aria-controls="unified-search-preview-listbox"`, `aria-expanded`, and `aria-activedescendant`;
2. Assert preview dropdown list has `id="unified-search-preview-listbox"` and `role="listbox"`;
3. Assert preview dropdown items have `role="option"`, `:id="unified-search-option-${idx}"`, and `:aria-selected="activeIndex === idx"`;
4. Assert ArrowDown/ArrowUp cycle through items and Enter selects active item.

- [ ] **Step 2: Run test to observe failure**

Run: `bun run test:unit tests/unit/components/search/PUnifiedSearchBar.spec.ts`
Expected: FAIL due to missing combobox/option ARIA attributes.

- [ ] **Step 3: Update `src/components/search/PUnifiedSearchBar.vue`**

1. Pass a11y props to `<PSearchInput>`:
   ```html
   <PSearchInput
     ...
     role="combobox"
     :aria-expanded="isDropdownOpen && hasDropdownContent"
     aria-controls="unified-search-preview-listbox"
     :aria-active-descendant="activeIndex >= 0 ? `unified-search-option-${activeIndex}` : undefined"
     ...
   />
   ```
2. Update preview list template:
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
       @mouseenter="activeIndex = idx"
       @mousedown.prevent="handleSelectItem(item)"
     >
       ...
     </div>
   </div>
   ```
3. Add watcher for `activeIndex` to scroll into view:
   ```ts
   watch(activeIndex, async (idx) => {
     if (idx < 0) return
     await nextTick()
     rootRef.value?.querySelector('.p-unified-search-dropdown__item.is-active')?.scrollIntoView?.({ block: 'nearest' })
   })
   ```

- [ ] **Step 4: Run unit tests**

Run: `bun run test:unit tests/unit/components/search/PUnifiedSearchBar.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git commit -am "feat(search): standardize PUnifiedSearchBar combobox a11y and dropdown keyboard navigation"`

---

### Task 4: 自动化无障碍契约测试守护 (`search-a11y-contract.spec.ts`)

**Files:**
- Create: `tests/unit/ui/search-a11y-contract.spec.ts`

- [ ] **Step 1: Write static contract test**

```ts
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('search-a11y-contract', () => {
  const topbarSearchPath = path.resolve(__dirname, '../../../src/components/system/AppTopbarGlobalSearch.vue')
  const sectionPath = path.resolve(__dirname, '../../../src/components/system/TopbarSearchSection.vue')
  const unifiedBarPath = path.resolve(__dirname, '../../../src/components/search/PUnifiedSearchBar.vue')
  const searchInputPath = path.resolve(__dirname, '../../../src/components/ui/PSearchInput.vue')

  it('ensures AppTopbarGlobalSearch implements full combobox contract', () => {
    const code = fs.readFileSync(topbarSearchPath, 'utf-8')
    expect(code).toContain('role="combobox"')
    expect(code).toContain('aria-autocomplete="list"')
    expect(code).toContain('aria-haspopup="listbox"')
    expect(code).toContain('aria-controls="topbar-search-results-listbox"')
    expect(code).toContain(':aria-activedescendant=')
    expect(code).toContain('id="topbar-search-results-listbox"')
    expect(code).toContain('role="listbox"')
    expect(code).toContain('box-shadow: none !important;')
  })

  it('ensures TopbarSearchSection implements group and option contract', () => {
    const code = fs.readFileSync(sectionPath, 'utf-8')
    expect(code).toContain('role="group"')
    expect(code).toContain('role="option"')
    expect(code).toContain(':aria-selected=')
    expect(code).toContain(':id="`search-option-${item.id}`"')
  })

  it('ensures PUnifiedSearchBar implements combobox and listbox contract', () => {
    const code = fs.readFileSync(unifiedBarPath, 'utf-8')
    expect(code).toContain('role="combobox"')
    expect(code).toContain('aria-controls="unified-search-preview-listbox"')
    expect(code).toContain('id="unified-search-preview-listbox"')
    expect(code).toContain('role="listbox"')
    expect(code).toContain('role="option"')
    expect(code).toContain(':aria-selected=')
    expect(code).toContain('box-shadow: none !important;')
  })

  it('ensures PSearchInput supports combobox ARIA passthrough', () => {
    const code = fs.readFileSync(searchInputPath, 'utf-8')
    expect(code).toContain(':aria-controls="ariaControls"')
    expect(code).toContain(':aria-activedescendant="ariaActiveDescendant"')
  })
})
```

- [ ] **Step 2: Run contract test**

Run: `bun run test:unit tests/unit/ui/search-a11y-contract.spec.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

Run: `git commit -am "test(contract): add search a11y combobox contract tests"`

---

### Task 5: 全站质量验证与双端打包交付

**Files:**
- Documentation: `docs/superpowers/plans/2026-10-28-unified-search-keyboard-and-a11y.md`
- Kanban: `<appDataDir>/brain/72e9f847-045b-4790-a46f-1fe17ce2f1c1/frontend-refactor-status.md`

- [ ] **Step 1: Run TypeScript strict check**

Run: `cd Atoman-Frontend && bun run type-check`
Expected: 0 errors.

- [ ] **Step 2: Run all affected and full unit test suites**

Run: `cd Atoman-Frontend && bun run test:unit`
Expected: 100% pass across all test suites.

- [ ] **Step 3: Run desktop and mobile production builds**

Run: `cd Atoman-Frontend && bun run build && bun run build:mobile`
Expected: Both builds succeed with 0 errors.

- [ ] **Step 4: Update plan and kanban status**

Mark all tasks as completed in plan and update status board.

- [ ] **Step 5: Final commit & push**

Run: `git commit -am "chore: complete unified search keyboard interaction and a11y standardization" && git push origin main`
