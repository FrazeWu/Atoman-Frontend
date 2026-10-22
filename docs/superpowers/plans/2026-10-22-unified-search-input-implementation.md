# 统一搜索组件 (PSearchInput) 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建全站统一搜索输入组件 `PSearchInput.vue`（支持款式 1A 一体化长款搜索栏与极简短款内联检索框），并迁移替换图书模块核心场景（发现大厅、私人书架、标签索引）。

**Architecture:** 
- 通用 UI 组件层：在 `src/components/ui/PSearchInput.vue` 中实现，导出纯净通用接口。
- 双变体支持：`variant="bar"` (款式 1A 一体化长款主搜索栏) 与 `variant="inline"` (短款内联过滤框)。
- 业务层无缝接入：在 `BooksDiscoverView.vue`、`BookTagsView.vue`、`BookPrivateLibraryView.vue` 中无缝替换原分散手写代码。

**Tech Stack:** Vue 3 (Composition API, `<script setup lang="ts">`), TypeScript 5.8, Lucide Vue Next, Vitest, Vue Test Utils.

## Global Constraints

- 严格 0 阴影：全局遵循 `box-shadow: none !important;`。
- 严格 4px 圆角：交互元素与外围统一遵循 `border-radius: var(--a-radius-control, 4px);`。
- 纯白纸张基底与微边框：面板遵循 `#FFFFFF` 纸张底色与 `1px solid var(--a-color-border-soft, #e2e8f0)` 发丝线分割。
- 清除原生系统干扰：设置 `::-webkit-search-cancel-button { display: none; }` 隐藏浏览器原生混乱清除按钮。
- 全量单测与严格类型检查：`bun run type-check` 0 错误，单元测试通过率 100%。

---

### Task 1: 创建 `PSearchInput.vue` 核心组件与独立单元测试套件

**Files:**
- Create: `src/components/ui/PSearchInput.vue`
- Create: `tests/unit/components/ui/PSearchInput.spec.ts`

**Interfaces:**
- Consumes: `lucide-vue-next` (Search, X, Loader2)
- Produces: `PSearchInput` component exported for app-wide UI usage

- [ ] **Step 1: 编写单元测试用例 `tests/unit/components/ui/PSearchInput.spec.ts`**
  - 测试 `v-model` 双向绑定与实时输入触发
  - 测试 `debounceMs` 防抖行为
  - 测试 `variant="bar"` (款式 1A) 与 `variant="inline"` 的 DOM 结构与类名
  - 测试清空按钮点击：清空输入框、发射 `update:modelValue('')` 与 `clear`
  - 测试 Enter 回车与点击“搜索”按钮派发 `@search(query, scope)`
  - 测试 `scopes` 范围选择下拉切换与 `update:scope`
  - 测试快捷键徽章与 `enableGlobalShortcut`
  - 测试 `role="search"` 等无障碍属性

- [ ] **Step 2: 运行测试验证失败**
  `cd Atoman-Frontend && bun run test:unit tests/unit/components/ui/PSearchInput.spec.ts`

- [ ] **Step 3: 实现 `src/components/ui/PSearchInput.vue`**
  - 严格根据款式 1A 规范实现一体化长款与内联短款
  - 接入 `clearable`、`scopes`、`debounceMs`、`actionButtonText`
  - 实现 0 阴影与 4px 纸质风格 CSS

- [ ] **Step 4: 运行测试验证全部通过**
  `cd Atoman-Frontend && bun run test:unit tests/unit/components/ui/PSearchInput.spec.ts`

- [ ] **Step 5: 运行类型检查并提交**
  `bun run type-check`
  `git add src/components/ui/PSearchInput.vue tests/unit/components/ui/PSearchInput.spec.ts && git commit -m "feat(ui): implement unified PSearchInput component with full unit tests"`

---

### Task 2: 接入长款场景——重构 `BooksDiscoverView.vue`

**Files:**
- Modify: `src/views/books/BooksDiscoverView.vue`
- Modify: `tests/unit/views/books/BooksDiscoverView.spec.ts` (如存在或新建测试)

**Interfaces:**
- Consumes: `PSearchInput` from `@/components/ui/PSearchInput.vue`
- Produces: Clean discover view search bar with seamless scope and action button

- [ ] **Step 1: 检查并补充 `BooksDiscoverView.vue` 现有测试基准**
  `cd Atoman-Frontend && bun run test:unit tests/unit/views/books/`

- [ ] **Step 2: 在 `BooksDiscoverView.vue` 中引入 `PSearchInput` 替换手写输入框**
  - 使用 `<PSearchInput variant="bar" size="lg" v-model="searchQuery" :scopes="searchScopes" v-model:scope="currentScope" @search="handleSearch" action-button-text="搜索" placeholder="输入书名、作者或关键词..." />`
  - 移除旧的分散 CSS 与冗余 HTML

- [ ] **Step 3: 运行相关单元测试确保行为一致**
  `cd Atoman-Frontend && bun run test:unit tests/unit/views/books/`

- [ ] **Step 4: 运行类型检查并提交**
  `bun run type-check`
  `git add src/views/books/BooksDiscoverView.vue && git commit -m "refactor(books): adopt unified PSearchInput in BooksDiscoverView"`

---

### Task 3: 接入短款场景——重构 `BookTagsView.vue` 与 `BookPrivateLibraryView.vue`

**Files:**
- Modify: `src/views/books/BookTagsView.vue`
- Modify: `src/views/books/BookPrivateLibraryView.vue`
- Test: `tests/unit/views/books/BookTagsView.spec.ts`
- Test: `tests/unit/views/books/BookPrivateLibraryView.spec.ts`

**Interfaces:**
- Consumes: `PSearchInput` from `@/components/ui/PSearchInput.vue`
- Produces: Polished inline search inputs across bookshelf and tag index

- [ ] **Step 1: 检查现有视图测试**
  `cd Atoman-Frontend && bun run test:unit tests/unit/views/books/BookTagsView.spec.ts tests/unit/views/books/BookPrivateLibraryView.spec.ts`

- [ ] **Step 2: 改造 `BookTagsView.vue`**
  - 替换原生 `<input type="search" v-model="searchQuery">` 为 `<PSearchInput variant="inline" size="sm" v-model="searchQuery" placeholder="检索标签..." clearable />`

- [ ] **Step 3: 改造 `BookPrivateLibraryView.vue`**
  - 替换原生书架搜索框为 `<PSearchInput variant="inline" size="sm" v-model="searchQuery" placeholder="检索书架藏书..." clearable show-shortcut-badge />`

- [ ] **Step 4: 运行测试验证行为完全符合预期**
  `cd Atoman-Frontend && bun run test:unit tests/unit/views/books/BookTagsView.spec.ts tests/unit/views/books/BookPrivateLibraryView.spec.ts`

- [ ] **Step 5: 运行类型检查并提交**
  `bun run type-check`
  `git add src/views/books/BookTagsView.vue src/views/books/BookPrivateLibraryView.vue && git commit -m "refactor(books): adopt unified PSearchInput in BookTagsView and BookPrivateLibraryView"`

---

### Task 4: 全局端到端构建与视觉回归验收

**Files:**
- None (Verification & E2E sanity)

- [ ] **Step 1: 运行全量单元测试套件**
  `cd Atoman-Frontend && bun run test:unit`

- [ ] **Step 2: 运行严格 TypeScript 类型检查**
  `cd Atoman-Frontend && bun run type-check`

- [ ] **Step 3: 运行完整生产构建**
  `cd Atoman-Frontend && bun run build`

- [ ] **Step 4: 对重构后的页面进行无头浏览器截屏复核**
  验证 BooksDiscoverView 与 BookPrivateLibraryView 的视觉呈现完好，边框与对齐严密贴合。
