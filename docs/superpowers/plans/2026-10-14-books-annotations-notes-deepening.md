# 图书模块划线批注与跨书笔记中心实现计划 (Books Annotations & Notes Deepening Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建端到端的图书阅读划线批注、随手笔记与跨书统一笔记中心系统，支持 EPUB/TXT/PDF 原文定位高亮、4色语义标注、选中文本浮动工具栏、侧栏划线管理与 `/books/notes` 独立工作台。

**Architecture:** 
- 后端在 Go Gin 中新增 `user_book_annotations` 数据表与 `/api/v1/books/notes` 及 `/api/v1/books/assets/:assetId/annotations` 系列接口，实现毫秒级持久化与多端同步；
- 前端新增 `BookSelectionToolbar.vue` 浮动选区交互条，扩展 `BookReaderSidebar.vue` 批注导览面板，在 `BookReaderView.vue` 接入 EPUB.js / TXT 划线渲染与坐标回放；
- 在 `/books/notes` 路由独立实现纯白双凹槽卡片流工作台 `BookNotesView.vue`，支持全文模糊检索、单书过滤与 Markdown 批量导出。

**Tech Stack:** Go, Gin, GORM, PostgreSQL, Vue 3.5, TypeScript, Pinia, ePub.js, Lucide Icons, Vitest.

## Global Constraints

- R1 纯白表面：卡片、面板、浮层基础背景严格使用 `#ffffff` / `var(--a-color-bg)`，严禁 `var(--a-color-surface)` 作为表面底色。
- R2 柔和分界：常规外边线使用 `var(--a-color-border)`，内部分割使用 `var(--a-color-border-soft)`。
- R3 令牌阴影：浮动工具栏与下拉使用 `var(--a-shadow-dropdown)` / `var(--a-shadow-md)`，禁止裸写 RGB 阴影。
- R4 小圆角：所有按钮、输入框、标签、卡片统一 4px (`var(--a-radius-card)` / `var(--a-radius-control)`)，禁止 999px 胶囊或圆形。
- R5 克制字重：标题与文字使用 500（强调态 600），严禁 700/800/bold。
- R8 纯净用户文案：杜绝技术黑话与开发视角词汇，文案简练克制。
- R10 语义色彩映射：高亮色彩 yellow -> `var(--a-color-warning)`，green -> `var(--a-color-success)`，blue -> `var(--a-color-primary)`，pink -> `var(--a-color-danger)`。

---

### Task 1: Backend Migration, Model & Annotations Service/HTTP API

**Files:**
- Modify: `Atoman-Backend/internal/model/book.go`
- Create: `Atoman-Backend/internal/migrations/20261014_user_book_annotations.go`
- Create: `Atoman-Backend/internal/modules/books/annotations.go`
- Create: `Atoman-Backend/internal/modules/books/annotations_http.go`
- Modify: `Atoman-Backend/internal/modules/books/http.go`
- Create: `Atoman-Backend/internal/modules/books/annotations_http_test.go`

**Interfaces:**
- Produces:
  - `GET /api/v1/books/notes`: returns `{ items: BookAnnotationDTO[], total: int }`
  - `GET /api/v1/books/assets/:assetId/annotations`: returns `BookAnnotationDTO[]`
  - `POST /api/v1/books/assets/:assetId/annotations`: returns `BookAnnotationDTO`
  - `PUT /api/v1/books/annotations/:annotationId`: returns `BookAnnotationDTO`
  - `DELETE /api/v1/books/annotations/:annotationId`: returns `{ deleted: bool }`

- [ ] **Step 1: Write the failing backend test**
  - Create `Atoman-Backend/internal/modules/books/annotations_http_test.go` testing CRUD flow:
    - Create an annotation for asset;
    - Query annotations for that asset;
    - Query global `/api/v1/books/notes` with search keyword;
    - Update note text & color;
    - Delete annotation.

- [ ] **Step 2: Run test to confirm it fails**
  - Run: `cd Atoman-Backend && go test -v ./internal/modules/books -run TestBookAnnotations`

- [ ] **Step 3: Implement data model and migration**
  - In `internal/model/book.go`: Add `UserBookAnnotation` struct and TableName `user_book_annotations`.
  - In `internal/migrations/`: Add migration function `MigrateUserBookAnnotations(db *gorm.DB) error` creating table and indexes.

- [ ] **Step 4: Implement service & HTTP handlers**
  - In `internal/modules/books/annotations.go`: Implement `CreateAnnotation`, `ListAssetAnnotations`, `ListGlobalNotes`, `UpdateAnnotation`, `DeleteAnnotation`.
  - In `internal/modules/books/annotations_http.go`: Implement Gin HTTP handlers and input binding validations.
  - In `internal/modules/books/http.go`: Register routes under `protected` group.

- [ ] **Step 5: Run tests and verify**
  - Run: `cd Atoman-Backend && go test -v ./internal/modules/books -run TestBookAnnotations`
  - Run: `cd Atoman-Backend && go build ./...`

- [ ] **Step 6: Commit backend changes**
  - Commit: `feat(books): implement user book annotations data model, service, and API`

---

### Task 2: Frontend API Client & BookSelectionToolbar Component

**Files:**
- Modify: `Atoman-Frontend/src/api/books.ts`
- Create: `Atoman-Frontend/src/components/books/BookSelectionToolbar.vue`
- Create: `Atoman-Frontend/tests/unit/components/books/BookSelectionToolbar.spec.ts`

**Interfaces:**
- Produces:
  - `listBookNotes(params)`: `Promise<BookAnnotationListResult>`
  - `listAssetAnnotations(assetId)`: `Promise<BookAnnotation[]>`
  - `createBookAnnotation(assetId, input)`: `Promise<BookAnnotation>`
  - `updateBookAnnotation(annotationId, input)`: `Promise<BookAnnotation>`
  - `deleteBookAnnotation(annotationId)`: `Promise<{ deleted: boolean }>`
  - `<BookSelectionToolbar :position="pos" :selected-text="text" :existing="annotation" @highlight="onHighlight" @add-note="onAddNote" @delete="onDelete" @copy="onCopy" @close="onClose" />`

- [ ] **Step 1: Write the failing unit test for BookSelectionToolbar**
  - Create `Atoman-Frontend/tests/unit/components/books/BookSelectionToolbar.spec.ts`:
    - Test renders 4 color options (yellow, green, blue, pink);
    - Test clicking color emits `'highlight'` with selected color;
    - Test toggling underline emits with style='underline';
    - Test note input expansion and emitting `'save-note'`;
    - Test copy quote button;
    - Test delete button when editing an existing annotation.

- [ ] **Step 2: Run test to confirm it fails**
  - Run: `cd Atoman-Frontend && bun test tests/unit/components/books/BookSelectionToolbar.spec.ts`

- [ ] **Step 3: Implement API endpoints in src/api/books.ts**
  - Add TypeScript interfaces: `BookAnnotation`, `BookHighlightColor`, `BookHighlightStyle`, `CreateBookAnnotationInput`, `UpdateBookAnnotationInput`, `BookAnnotationListResult`.
  - Implement API client functions using `apiRequestEnvelope` / `apiGet`.

- [ ] **Step 4: Implement BookSelectionToolbar.vue**
  - Pure-white surface `var(--a-color-bg)`, 4px radius (`var(--a-radius-card)`), `var(--a-shadow-dropdown)`.
  - 4 color blocks using semantic color tokens.
  - Inline collapsible thought/note input box.
  - Copy and delete actions.

- [ ] **Step 5: Run tests and verify**
  - Run: `cd Atoman-Frontend && bun test tests/unit/components/books/BookSelectionToolbar.spec.ts`
  - Run: `cd Atoman-Frontend && bun run type-check`

- [ ] **Step 6: Commit frontend API and toolbar**
  - Commit: `feat(books): add annotations API client and BookSelectionToolbar component`

---

### Task 3: Reader View & Sidebar Integration

**Files:**
- Modify: `Atoman-Frontend/src/components/books/BookReaderSidebar.vue`
- Modify: `Atoman-Frontend/src/views/books/BookReaderView.vue`
- Create: `Atoman-Frontend/tests/unit/components/books/BookReaderSidebar.annotations.spec.ts`

**Interfaces:**
- Consumes:
  - `listAssetAnnotations`, `createBookAnnotation`, `updateBookAnnotation`, `deleteBookAnnotation` from Task 2.
  - `BookSelectionToolbar.vue` from Task 2.
- Produces:
  - `BookReaderSidebar.vue` with 4th tab `annotations`:
    - Prop: `annotations: BookAnnotation[]`
    - Emits: `'annotation-jump'`, `'annotation-edit'`, `'annotation-delete'`, `'annotation-export'`
  - `BookReaderView.vue` with interactive text selection, highlight replay, and jump support.

- [ ] **Step 1: Write the failing test for BookReaderSidebar annotations**
  - Create `Atoman-Frontend/tests/unit/components/books/BookReaderSidebar.annotations.spec.ts`:
    - Test 4th tab "批注" renders with annotation count badge;
    - Test clicking tab switches to annotations list;
    - Test clicking an annotation item emits `'annotation-jump'` with annotation data;
    - Test inline edit and delete emits;
    - Test empty state when no annotations.

- [ ] **Step 2: Run test to confirm it fails**
  - Run: `cd Atoman-Frontend && bun test tests/unit/components/books/BookReaderSidebar.annotations.spec.ts`

- [ ] **Step 3: Implement annotations tab in BookReaderSidebar.vue**
  - Add `BookSidebarMode = 'thumbnails' | 'outline' | 'bookmarks' | 'annotations'`.
  - Add Tab button with `Highlighter` or `MessageSquare` icon and count badge.
  - Render annotation cards with color indicator border, quoted text, user note, and actions.
  - Add "导出本书划线" action button.

- [ ] **Step 4: Integrate selection and highlights in BookReaderView.vue**
  - Load annotations on book open via `listAssetAnnotations(assetId)`.
  - On TXT: handle text selection mouseup, display `BookSelectionToolbar`, render `<mark>` elements on text pages.
  - On EPUB: handle `epubRendition.on('selected')`, render EPUB marks via `rendition.annotations.add`.
  - Handle jump to annotation location (scroll/display CFI or page) and transient pulse highlight.
  - Support query parameter `?annotationId=...` on mount to jump straight to note position.

- [ ] **Step 5: Run tests and verify**
  - Run: `cd Atoman-Frontend && bun test tests/unit/components/books/BookReaderSidebar.annotations.spec.ts`
  - Run: `cd Atoman-Frontend && bun run type-check`

- [ ] **Step 6: Commit reader and sidebar integration**
  - Commit: `feat(books): integrate annotations into BookReaderSidebar and BookReaderView`

---

### Task 4: Dedicated Note Center View (`BookNotesView.vue`) & Module Route

**Files:**
- Create: `Atoman-Frontend/src/views/books/BookNotesView.vue`
- Modify: `Atoman-Frontend/src/router/routes/modules.ts`
- Create: `Atoman-Frontend/tests/unit/views/books/BookNotesView.spec.ts`

**Interfaces:**
- Consumes:
  - `listBookNotes`, `deleteBookAnnotation`, `updateBookAnnotation` from Task 2.
- Produces:
  - Dedicated `/books/notes` view component with search, filter, card stream, jump to reader, and markdown exporter.

- [ ] **Step 1: Write the failing test for BookNotesView**
  - Create `Atoman-Frontend/tests/unit/views/books/BookNotesView.spec.ts`:
    - Test renders note items with quote text, attached note, book title, and color badge;
    - Test search input triggers debounced fetch with `q`;
    - Test book filter dropdown updates list;
    - Test "仅看有想法" toggle filters out quote-only highlights;
    - Test "导出 Markdown" downloads structured markdown file;
    - Test "阅读原文" link navigates to `/books/read/:assetId?annotationId=...`.

- [ ] **Step 2: Run test to confirm it fails**
  - Run: `cd Atoman-Frontend && bun test tests/unit/views/books/BookNotesView.spec.ts`

- [ ] **Step 3: Implement BookNotesView.vue**
  - Pure-white double-notch minimal cards layout.
  - Search toolbar with `SearchSurface`, book selector, has-note switch, and export button.
  - Card list with color indicator strip, quoted text, note block, book title, page/chapter metadata, and actions.
  - Responsive design and empty state.

- [ ] **Step 4: Update route in src/router/routes/modules.ts**
  - Change `/books/notes` component from placeholder `BooksHomeView.vue` to `() => import("@/views/books/BookNotesView.vue")`.

- [ ] **Step 5: Run tests and verify full frontend integration**
  - Run: `cd Atoman-Frontend && bun test tests/unit/views/books/BookNotesView.spec.ts`
  - Run: `cd Atoman-Frontend && bun run test:unit tests/unit/components/books/BookSelectionToolbar.spec.ts tests/unit/components/books/BookReaderSidebar.annotations.spec.ts`
  - Run: `cd Atoman-Frontend && bun run type-check`
  - Run: `cd Atoman-Frontend && bun run build`

- [ ] **Step 6: Commit BookNotesView and route update**
  - Commit: `feat(books): implement BookNotesView for dedicated notes center`

---

### Task 5: End-to-End Contract Verification & UI Polish

**Files:**
- Modify: `Atoman-Frontend/tests/unit/ui/design-system-contract.spec.ts` (if needed)

- [ ] **Step 1: Run design system contract and full unit tests**
  - Run: `cd Atoman-Frontend && bun run test:unit tests/unit/ui/design-system-contract.spec.ts`
  - Run: `cd Atoman-Backend && go test ./...`
  - Run: `cd Atoman-Frontend && bun run type-check`

- [ ] **Step 2: Run git diff --check for any whitespace or lint flaws**
  - Run: `git diff --check`

- [ ] **Step 3: Final commit and summary report**
  - Commit: `chore(books): complete end-to-end verification of annotations and note center`
