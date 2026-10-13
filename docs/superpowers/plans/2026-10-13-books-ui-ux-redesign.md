# 书籍模块全面重构实施计划 (Books Module Overhaul Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全面重构 Atoman 书籍模块，实现统一的公共图书创建向导、两字子导航体系、一屏直达聚合抽屉、常驻在读底栏以及参考 PDF Expert 专业排版的沉浸阅读器。

**Architecture:** 前端基于 Vue 3 + TypeScript + Pinia，严格遵守纯白表面（`var(--a-color-bg)`）、4px 圆角（`var(--a-radius-card)` / `var(--a-radius-control)`）、500/600 克制字重的设计系统规范。通过 `BookCreationFlowDrawer` 整合公共电子书解析与直接入库；通过 `useBookReaderStore` / `BookMiniReaderBar` 实现全局常驻阅读态；阅读器重构为支持缩略图瀑布流、目录大纲、高亮全文检索与专业工具栏的桌面级体验。

**Tech Stack:** Vue 3.5, TypeScript 5.9 (strict), Pinia 3, PDF.js, Epub.js, Tabler Icons, Tailwind CSS v4 tokens, Vitest.

## Global Constraints

- **R1 纯白表面**：卡片、面板、抽屉面板、底栏背景使用 `#ffffff` / `var(--a-color-bg)`，严禁 `var(--a-color-surface)` 作为容器背景。
- **R2 柔和分界**：边框使用 `var(--a-color-border)`，内部分割线使用 `var(--a-color-border-soft)`。
- **R3 小圆角**：封面、按钮、输入框、卡片统一使用 4px 圆角（`var(--a-radius-card)` / `var(--a-radius-control)`），严禁 999px 药丸圆角或 8px/12px。
- **R4 克制字重**：标题统一字重 500，强调态字重 600，严禁 700/800/bold。
- **R5 用户态文案**：禁止出现“治理”、“内部审核”、“UUID”、“凭证设置”等开发视角词汇。
- **R6 创建流对齐音乐模块**：在探索页顶部搜索框右侧放置“添加图书”主操作按钮，点击拉出向导抽屉。
- **R7 导航两字化**：探索 · 书架 · 书单 · 作者 · 笔记。
- **R8 验证红线**：每个任务完成后必须通过 `bun run type-check` 与相关单元测试，`git diff --check` 无格式告警。

---

## Task Map & File Structure

```
Atoman-Frontend/
├── src/
│   ├── stores/
│   │   └── bookReader.ts                 # [Task 1] 全局在读状态管理 (当前书籍、进度、缩略图、浮层展开)
│   ├── components/
│   │   ├── system/
│   │   │   └── AppSidebar.vue            # [Task 2] 侧边栏子导航更新为两字体系
│   │   └── books/
│   │       ├── BookCreationFlowDrawer.vue # [Task 3] 统一公共图书创建向导抽屉 (3步)
│   │       ├── BookWorkDrawer.vue        # [Task 4] 作品一屏直达聚合抽屉 (版本、大纲、短评)
│   │       ├── BookMiniReaderBar.vue     # [Task 5] 常驻在读底栏 (48-52px，进度，快捷书签)
│   │       ├── BookReaderShell.vue       # [Task 6] PDF Expert 架构阅读器外壳 (缩略图瀑布流、工具栏、精准检索侧栏)
│   │       └── BookReaderThumbnailStrip.vue # [Task 6] 页面缩略图瀑布流组件
│   └── views/
│       └── books/
│           ├── BooksLayout.vue           # [Task 2/5] 整合 Mini Reader Bar 与 Reader Overlay 挂载
│           ├── BooksHomeView.vue         # [Task 2/3] 探索视图与顶部搜索栏+添加图书按钮改造
│           ├── BookReaderView.vue        # [Task 6] 专业级 PDF/EPUB/TXT 阅读器重构
│           └── BookPublicReaderView.vue  # [Task 6] 公共阅读器同步重构
└── tests/unit/books/
    ├── bookReaderStore.spec.ts           # Task 1 测试
    ├── BookCreationFlowDrawer.spec.ts    # Task 3 测试
    ├── BookWorkDrawer.spec.ts            # Task 4 测试
    ├── BookMiniReaderBar.spec.ts         # Task 5 测试
    └── BookReaderShell.spec.ts           # Task 6 测试
```

---

### Task 1: 建立全局在读与阅读器状态存储 (`bookReader.ts`)

**Files:**
- Create: `src/stores/bookReader.ts`
- Test: `tests/unit/books/bookReaderStore.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface ActiveReadingBook {
    assetId: string
    workId?: string
    title: string
    author?: string
    coverUrl?: string
    format: string
    currentPage: number
    totalPages: number
    percent: number
    chapterTitle?: string
  }
  export const useBookReaderStore: () => {
    activeBook: Ref<ActiveReadingBook | null>
    isOverlayOpen: Ref<boolean>
    zoomLevel: Ref<number>
    sidebarMode: Ref<'thumbnails' | 'outline' | 'bookmarks' | 'none'>
    searchQuery: Ref<string>
    isSearchOpen: Ref<boolean>
    openBook: (book: ActiveReadingBook) => void
    updateProgress: (page: number, total: number, chapter?: string) => void
    toggleOverlay: (open?: boolean) => void
    setZoom: (zoom: number) => void
  }
  ```

- [ ] **Step 1: 编写 `bookReaderStore.spec.ts` 单元测试**
  - 测试打开书籍、进度计算、抽屉浮层开闭以及持久化恢复。
- [ ] **Step 2: 运行测试并验证失败**
  - 运行 `bun run test:unit tests/unit/books/bookReaderStore.spec.ts`
- [ ] **Step 3: 实现 `src/stores/bookReader.ts`**
  - 定义响应式状态，支持 `localStorage` 缓存当前最后在读书目，提供进度更新与浮层控制方法。
- [ ] **Step 4: 运行测试并验证通过**
  - 运行 `bun run test:unit tests/unit/books/bookReaderStore.spec.ts`
- [ ] **Step 5: 提交更改**
  - `git commit -m "feat(books): add bookReader pinia store for active reading state and reader controls"`

---

### Task 2: 侧边栏子导航两字化与探索顶部操作布局

**Files:**
- Modify: `src/components/system/AppSidebar.vue:398-406`
- Modify: `src/views/books/BooksHomeView.vue:1-60`
- Modify: `src/router/routes/modules.ts:200-245`

**Interfaces:**
- Consumes: `AppSidebar.vue`, `BooksHomeView.vue`
- Produces: 探索（`/books`）、书架（`/books/library`）、书单（`/books/lists`）、作者（`/books/authors`）、笔记（`/books/notes`）路由配置。

- [ ] **Step 1: 修改 `src/components/system/AppSidebar.vue`**
  - 将 `booksNavItems` 规范化为：
    - `探索` (`/books`)
    - `书架` (`/books/library`)
    - `书单` (`/books/lists`)
    - `作者` (`/books/authors`)
    - `笔记` (`/books/notes`)
- [ ] **Step 2: 修改 `src/router/routes/modules.ts`**
  - 补充 `lists`、`authors`、`notes` 路由定义并映射到标准视图组件。
- [ ] **Step 3: 改造 `BooksHomeView.vue` 顶部搜索与操作栏**
  - 将搜索栏与创建按钮并列放置：左侧 `SearchSurface`，右侧紧邻 `PButton variant="primary"`（文案“添加图书”），严格对齐音乐发现页设计。
- [ ] **Step 4: 验证类型与测试**
  - 运行 `bun run type-check`
  - 运行 `bun run test:unit tests/unit/ui/design-system-contract.spec.ts`
- [ ] **Step 5: 提交更改**
  - `git commit -m "refactor(books): standardize two-character sidebar navigation and top explore toolbar"`

---

### Task 3: 统一公共图书创建向导抽屉 (`BookCreationFlowDrawer.vue`)

**Files:**
- Create: `src/components/books/BookCreationFlowDrawer.vue`
- Modify: `src/views/books/BooksHomeView.vue`
- Test: `tests/unit/books/BookCreationFlowDrawer.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  // BookCreationFlowDrawer
  // Props: show: boolean
  // Emits: 'close', 'created': (workId: string, assetId: string) => void
  ```

- [ ] **Step 1: 编写 `BookCreationFlowDrawer.spec.ts` 单元测试**
  - 测试 3 步向导流程（文件选择与解析提取 -> 作者与版本信息回填 -> 确认发布与入库）。
- [ ] **Step 2: 运行测试并验证失败**
  - 运行 `bun run test:unit tests/unit/books/BookCreationFlowDrawer.spec.ts`
- [ ] **Step 3: 实现 `BookCreationFlowDrawer.vue`**
  - 采用 `PSheet` 抽屉基座（纯白表面 `var(--a-color-bg)`，4px 圆角）。
  - **步骤 1**：拖拽上传区，支持 EPUB/PDF/TXT。选取文件后提取元数据（书名、作者、封面图片预览）。
  - **步骤 2**：确认作者与版本详情（出版社、出版年、ISBN）。
  - **步骤 3**：卡片预览与公开入库提交。提交直接将电子书资产关联为公共作品并加入当前用户书架，消除私有/公共隔阂。
- [ ] **Step 4: 在 `BooksHomeView.vue` 中挂载该抽屉**
  - 点击顶部“添加图书”按钮打开该抽屉，创建成功后自动刷新公共书库列表并定位到新书。
- [ ] **Step 5: 运行测试与类型检查**
  - 运行 `bun run test:unit tests/unit/books/BookCreationFlowDrawer.spec.ts`
  - 运行 `bun run type-check`
- [ ] **Step 6: 提交更改**
  - `git commit -m "feat(books): implement unified public BookCreationFlowDrawer"`

---

### Task 4: 一屏直达作品聚合抽屉 (`BookWorkDrawer.vue`)

**Files:**
- Create: `src/components/books/BookWorkDrawer.vue`
- Modify: `src/components/books/BookCard.vue`
- Modify: `src/views/books/BooksLayout.vue`
- Test: `tests/unit/books/BookWorkDrawer.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  // BookWorkDrawer.vue
  // Props: workId: string, show: boolean
  // Emits: 'close', 'start-reading': (assetId: string) => void
  ```

- [ ] **Step 1: 编写 `BookWorkDrawer.spec.ts` 单元测试**
  - 测试展示作品标题、作者、封面、可用格式版本列表、章节大纲及短评卡片。
- [ ] **Step 2: 运行测试并验证失败**
  - 运行 `bun run test:unit tests/unit/books/BookWorkDrawer.spec.ts`
- [ ] **Step 3: 实现 `BookWorkDrawer.vue`**
  - 采用纯白右侧 `PSheet`（宽 480px~540px，移动端自适应为底部抽屉）。
  - 头部展示高清封面（4px 圆角）与标题评分；中间包含“开始阅读”高亮按钮及“加入书架”控制；下半部分清晰列出格式列表与大纲树，点击章节即可直达。
- [ ] **Step 4: 改造 `BookCard.vue`**
  - 点击卡片不再跳往孤立的大页面，而是触发打开 `BookWorkDrawer`。
- [ ] **Step 5: 验证与提交**
  - 运行 `bun run test:unit tests/unit/books/BookWorkDrawer.spec.ts`
  - 运行 `bun run type-check`
  - `git commit -m "feat(books): implement compact BookWorkDrawer for instant work exploration"`

---

### Task 5: 常驻在读底栏 (`BookMiniReaderBar.vue`)

**Files:**
- Create: `src/components/books/BookMiniReaderBar.vue`
- Modify: `src/views/books/BooksLayout.vue`
- Test: `tests/unit/books/BookMiniReaderBar.spec.ts`

**Interfaces:**
- Consumes: `useBookReaderStore`
- Produces: 屏幕底部常驻 48px ~ 52px 迷你阅读条，支持收起/展开阅读浮层。

- [ ] **Step 1: 编写 `BookMiniReaderBar.spec.ts` 单元测试**
  - 测试有在读图书时渲染迷你封面、书名、百分比进度条与继续阅读按钮；无在读图书时不渲染。
- [ ] **Step 2: 运行测试并验证失败**
  - 运行 `bun run test:unit tests/unit/books/BookMiniReaderBar.spec.ts`
- [ ] **Step 3: 实现 `BookMiniReaderBar.vue`**
  - 纯白背景 `var(--a-color-bg)`，顶边线 `1px solid var(--a-color-border-soft)`，4px 控件圆角。
  - 左侧：缩略封面 + 书名/章节；中：已读百分比进度；右：继续阅读/上滑展开按钮。
- [ ] **Step 4: 在 `BooksLayout.vue` 中挂载**
  - 常驻渲染于书籍模块底部，并预留主内容区的底部 padding（避免遮挡列表）。
- [ ] **Step 5: 验证与提交**
  - 运行 `bun run test:unit tests/unit/books/BookMiniReaderBar.spec.ts`
  - 运行 `bun run type-check`
  - `git commit -m "feat(books): implement sticky BookMiniReaderBar at viewport bottom"`

---

### Task 6: PDF Expert 架构专业级阅读器重构 (`BookReaderShell.vue` & `BookReaderView.vue`)

**Files:**
- Create: `src/components/books/BookReaderThumbnailStrip.vue`
- Modify: `src/components/books/BookReaderShell.vue`
- Modify: `src/views/books/BookReaderView.vue`
- Modify: `src/views/books/BookPublicReaderView.vue`
- Test: `tests/unit/books/BookReaderShell.spec.ts`

**Interfaces:**
- Produces:
  - 顶部专业级工具栏（缩放比下拉选择、单双页/连续滚动切换、高亮批注笔、搜索按钮、收起回底栏）。
  - 左侧边栏（缩略图瀑布流 `Thumbnails`、大纲目录 `Outline`、书签 `Bookmarks`）。
  - 右侧精准检索侧栏（关键词高亮匹配流、上下文摘录、点击平滑滚动定位）。
  - 中间纸张级视口（米黄护眼/纯白/夜间色，微阴影）。

- [ ] **Step 1: 编写 `BookReaderShell.spec.ts` 单元测试**
  - 测试 PDF Expert 布局模式切换（缩略图、目录、右侧检索展开/折叠、缩放控制）。
- [ ] **Step 2: 运行测试并验证失败**
  - 运行 `bun run test:unit tests/unit/books/BookReaderShell.spec.ts`
- [ ] **Step 3: 实现 `BookReaderThumbnailStrip.vue`**
  - 为 PDF/EPUB 文档渲染左侧纵向页面缩略图瀑布流，高亮指示当前页与页码尺寸。
- [ ] **Step 4: 重构 `BookReaderShell.vue`**
  - 依照 PDF Expert 架构重组为顶部专业工具栏 + 左侧导览栏 + 右侧检索栏 + 核心纸张画布。
  - 样式严格对齐纯白极简系统与纸张质感。
- [ ] **Step 5: 重构 `BookReaderView.vue` 与 `BookPublicReaderView.vue`**
  - 接入 `useBookReaderStore`，支持与常驻底栏无缝折叠收起/全屏展开。
- [ ] **Step 6: 验证与提交**
  - 运行 `bun run test:unit tests/unit/books/BookReaderShell.spec.ts`
  - 运行 `bun run type-check`
  - `git commit -m "refactor(books): overhaul BookReaderShell with PDF Expert layout and thumbnail strip"`

---

### Task 7: 全模块端到端集成、设计系统规范审查与测试

**Files:**
- Modify: 全模块涉及改动的书籍文件
- Test: 全量单元测试与合约测试

- [ ] **Step 1: 运行全量单元测试**
  - `bun run test:unit`
- [ ] **Step 2: 运行类型检查与代码风格检查**
  - `bun run type-check`
  - `git diff --check`
- [ ] **Step 3: 严格校验设计系统红线**
  - 检查无未授权 hex 颜色、无 `var(--a-color-surface)` 作为容器背景、所有圆角为 4px、字重为 500/600。
- [ ] **Step 4: 提交集成改动**
  - `git commit -m "chore(books): complete books module UI/UX integration and design contract validation"`

---

## Plan Verification Checkpoints

1. **Task 1 验证**：Pinia `useBookReaderStore` 单元测试 100% 通过。
2. **Task 2 验证**：侧边栏子导航显示“探索·书架·书单·作者·笔记”，顶部出现“添加图书”按钮。
3. **Task 3 验证**：点击“添加图书”弹出向导抽屉，拖入电子书自动解析元数据并一键公开入库。
4. **Task 4 验证**：点击书籍卡片弹出聚合抽屉，直接呈现版本格式、章节大纲与短评。
5. **Task 5 验证**：阅读过程中底栏常驻显示在读进度；点击可向上展开沉浸阅读。
6. **Task 6 验证**：阅读器具备 PDF Expert 式三栏排版（缩略图、目录、顶部专业工具栏、右侧全文检索面板）。
7. **Task 7 验证**：`bun run type-check` 0 错误，全量单元测试通过。
