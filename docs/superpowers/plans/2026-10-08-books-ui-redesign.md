# 书籍模块 (Books) UI 风格对齐实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将书籍模块（Books）彻底改造为与全站一致的全白双刻痕极简风，全面替换原生表单控件为标准组件，极净化阅读器顶栏与分页工具条，细化书目卡片与上传列表，对齐克制文案规范。

**Architecture:** 替换 `BookWorkView`、`BooksHomeView`、`BooksGovernanceView` 中的原生 `<select>`、`<input>`、`<textarea>` 为 `PSelect`、`PInput`、`PTextarea`；移除 `BookReaderView` 和 `BookPublicReaderView` 中的 `kicker="READER"` 内部用语并换用标准 `PPageHeader`；优化 `BookCard` 封面几何与等宽评分排版；保持所有既有测试契约与 API 数据联动。

**Tech Stack:** Vue 3.4/3.5, TypeScript 5.9, Pinia 3, Vue Router 4, Tailwind CSS v4, Vitest, Playwright.

## Global Constraints

- 全白表面：卡片、抽屉面板、阅读器背景使用 `#ffffff`。
- 柔和分界：常规边线使用 `#cbd5e1`，内部分割使用 `#e2e8f0`。
- 全局阴影为 `none`，不使用硬投影或装饰性阴影。
- 小圆角：控件与卡片统一使用 `4px` 圆角（`var(--a-radius-control)` / `var(--a-radius-card)`）。
- 克制字重：标题与文字使用 500（强调态 600），不使用粗黑大字重。
- 主动作使用明晰蓝 `--a-color-primary: #2563eb`。
- 遵循 `AGENTS.md` 文案规范，标题只写动作名或内容名，副标题精简至一行硬性信息，去除任何内部词汇或抒情用语。
- 保持现有的功能与测试契约（书架加入、阅读器翻页、上传列表、作品详情等）。

---

### Task 1: BookCard, BookCover & BooksHomeView 页面与卡片重构

**Files:**
- Modify: `src/components/books/BookCard.vue:1-37`
- Modify: `src/components/books/BookCover.vue:1-22`
- Modify: `src/views/books/BooksHomeView.vue:1-220`
- Test: `tests/unit/views/books-home.spec.ts`

**Interfaces:**
- Consumes: `PSelect`, `PButton`, `PPageHeader`, `PaginationBar`
- Produces: Polished book discovery grid, shelf status selector, and upload queue rows.

- [ ] **Step 1: 运行现存单测确认基准**

运行：`bun run test:unit tests/unit/views/books-home.spec.ts`
预期：PASS。

- [ ] **Step 2: 重构 `BookCard.vue` 与 `BookCover.vue`**

1. 在 `BookCover.vue` 中确保封面保持 `4px` 圆角（`var(--a-radius-card)`），微弱内边框，无硬阴影。
2. 在 `BookCard.vue` 中调整排版：
   - 标题字重设为 `500`（Hover 过渡为明晰蓝 `#2563eb`，动效 `0.15s`）。
   - 评分使用 `font-variant-numeric: tabular-nums`，星标紧凑。
   - 移除多余的重阴影。

- [ ] **Step 3: 重构 `BooksHomeView.vue` 头部与书库筛选**

1. 页面标题：根据路由状态简洁呈现（`发现`、`搜索`、`我的书库`），副标题收敛为单行简明说明。
2. 书架状态筛选：将操作区的原生筛选或下拉统一使用 `PSelect`，导入电子书按钮使用 `PButton` secondary 风格。
3. 继续阅读进度条：保持 `3px` 极细高亮指示条，accent 色为 `var(--a-color-primary)`。
4. 上传记录行：重构列表项状态指示为圆点 + 简练文字，操作按钮采用 Slimmed 图标按钮（`2.25rem`，无多余边框）。

- [ ] **Step 4: 运行单测验证**

运行：`bun run test:unit tests/unit/views/books-home.spec.ts`
预期：PASS。

- [ ] **Step 5: 提交代码**

```bash
git add src/components/books/BookCard.vue src/components/books/BookCover.vue src/views/books/BooksHomeView.vue
git commit -m "feat(books): polish BookCard and BooksHomeView with pure-white minimal layout"
```

---

### Task 2: BookWorkView & BookEditionView 详情抽屉表单规范化

**Files:**
- Modify: `src/views/books/BookWorkView.vue:1-70`
- Modify: `src/views/books/BookEditionView.vue:1-60`
- Test: `tests/unit/views/book-work.spec.ts`

**Interfaces:**
- Consumes: `PSelect`, `PTextarea`, `PButton`, `RatingControl`, `BookCover`
- Produces: Standardized book work detail drawer without raw HTML inputs.

- [ ] **Step 1: 运行现有详情单测**

运行：`bun run test:unit tests/unit/views/book-work.spec.ts`
预期：PASS。

- [ ] **Step 2: 替换 `BookWorkView.vue` 中的原生表单控件**

1. 替换原生 `<select id="shelf-status">` 为 `PSelect`：
   - 选项：想读、在读、读过、搁置、弃读。
   - 保留与既有事件、测试的绑定兼容。
2. 替换短书评输入 `<textarea id="book-review">` 为标准的 `PTextarea`：
   - 支持多行稿纸横线暗示，聚焦使用明晰蓝。
3. 替换书评可见性 `<select>` 为 `PSelect`（公开、私密）。
4. 整理书架操作区按钮：加入书架采用 Secondary 按钮，开始阅读采用 Primary 按钮。

- [ ] **Step 3: 优化 `BookEditionView.vue` 视觉**

1. 事实清单（`dl/dt/dd`）排版对齐全白双刻痕风格，字重克制。
2. 外部来源链接使用 `PLink`，统一外链交互。

- [ ] **Step 4: 运行单测验证**

运行：`bun run test:unit tests/unit/views/book-work.spec.ts`
预期：PASS。

- [ ] **Step 5: 提交代码**

```bash
git add src/views/books/BookWorkView.vue src/views/books/BookEditionView.vue
git commit -m "feat(books): standardize inputs and actions in BookWorkView and BookEditionView"
```

---

### Task 3: BookReaderView & BookPublicReaderView 阅读器顶栏与工具条极净化

**Files:**
- Modify: `src/views/books/BookReaderView.vue:1-80`
- Modify: `src/views/books/BookPublicReaderView.vue:1-50`
- Test: `tests/unit/views/book-reader.spec.ts`
- Test: `tests/unit/views/book-public-reader.spec.ts`

**Interfaces:**
- Consumes: `PPageHeader`, `PButton`
- Produces: Clean reader views without developer kicker labels.

- [ ] **Step 1: 运行现有阅读器单测**

运行：`bun run test:unit tests/unit/views/book-reader.spec.ts tests/unit/views/book-public-reader.spec.ts`
预期：PASS。

- [ ] **Step 2: 改造 `BookReaderView.vue` 顶栏与控制条**

1. 移除 `PSectionHeader kicker="READER"`，使用标准的 `PPageHeader title="阅读"`。
2. 优化工具栏：
   - 阅读进度、页码指示采用等宽排版（`tabular-nums`）。
   - 翻页按钮（上一页、下一页）统一使用 Slimmed 图标按钮，禁用态降低透明度，无多余边框。
   - 保证 PDF、EPUB、TXT 阅读器画布/容器背景纯白、边框细致。

- [ ] **Step 3: 改造 `BookPublicReaderView.vue` 顶栏与控制条**

1. 移除 `kicker="READER"`，改用标准 `PPageHeader title="公共阅读"`。
2. 工具栏与 EPUB 目录展开层统一为纯白实底面板，细线分割，提升专注阅读感。

- [ ] **Step 4: 运行单测验证**

运行：`bun run test:unit tests/unit/views/book-reader.spec.ts tests/unit/views/book-public-reader.spec.ts`
预期：PASS。

- [ ] **Step 5: 提交代码**

```bash
git add src/views/books/BookReaderView.vue src/views/books/BookPublicReaderView.vue
git commit -m "feat(books): modernize reader headers and controls without kicker labels"
```

---

### Task 4: BooksGovernanceView 贡献与审核页面表单重构

**Files:**
- Modify: `src/views/books/BooksGovernanceView.vue:1-120`
- Test: `tests/unit/config/books-module.spec.ts`

**Interfaces:**
- Consumes: `PInput`, `PTextarea`, `PButton`, `PPageHeader`
- Produces: Clean governance forms and submission lists.

- [ ] **Step 1: 重构 `BooksGovernanceView.vue` 提交表单**

1. 替换原生 `<input id="edit-title">` 为 `PInput label="标题"`。
2. 替换原生 `<textarea id="edit-description">` 为 `PTextarea label="简介"`。
3. 替换原生 `<input id="edit-source">` 为 `PInput label="资料来源 URL"`。
4. 替换原生 `<input id="edit-reason">` 为 `PInput label="提交理由"`。
5. 提报按钮采用标准的 Secondary / Primary `PButton`。

- [ ] **Step 2: 优化申请列表与审核卡片**

1. 列表项使用纯白背景与 `#e2e8f0` 细线分割。
2. 撤回和申诉按钮采用极简 Ghost / Secondary 风格。

- [ ] **Step 3: 运行单测验证**

运行：`bun run test:unit tests/unit/config/books-module.spec.ts`
预期：PASS。

- [ ] **Step 4: 提交代码**

```bash
git add src/views/books/BooksGovernanceView.vue
git commit -m "feat(books): modernize BooksGovernanceView with standard form inputs"
```

---

### Task 5: 全量书籍测试、类型检查与全站契约最终验证

**Files:**
- Test: All books test suites
- Test: Design system contract tests

- [ ] **Step 1: 运行全量书籍单元测试**

运行：`bun run test:unit tests/unit/views/books-home.spec.ts tests/unit/views/book-work.spec.ts tests/unit/views/book-reader.spec.ts tests/unit/views/book-public-reader.spec.ts tests/unit/config/books-module.spec.ts tests/unit/api/books.spec.ts`
预期：全部 PASS。

- [ ] **Step 2: 运行设计系统契约测试**

运行：`bun run test:unit tests/unit/ui/design-system-contract.spec.ts`
预期：PASS。

- [ ] **Step 3: 运行全量 TypeScript 类型检查**

运行：`bun run type-check`
预期：0 errors。

- [ ] **Step 4: 检查 git diff 格式**

运行：`git diff --check`
预期：无格式或空白问题。
