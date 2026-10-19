# 书籍阅读模块（Books）FSD 领域切片与 TanStack Vue Query 重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 `src/entities/book/` 标准 FSD 实体切片（类型模型、纯净 API、Query Keys 与 Vue Query Hooks），拆解 820 行巨石 `api/books.ts` 并保持 100% 向后兼容，消除 `catalogRevision` 响应式黑客变量，并在 `BookCatalogWorkView.vue` 与 `BookLibraryView.vue` 落地毫秒级缓存与自动失效。

**Architecture:** 按照 FSD 分层规则与 `@tanstack/vue-query` 最佳实践，将图书编目、电子书文件、书架在读、批注想法的数据模型抽离至 `entities/book/model/types.ts`；建立 `bookKeys` 工厂与标准 Query Hooks；在旧路径 `src/api/books.ts` 与 `src/api/bookCatalog.ts` 保留 re-export 桥接层确保外部 103+ 处引用零破坏；视图层接入 Vue Query 替换手写 `Promise.all` 与手动脏状态刷新。

**Tech Stack:** Vue 3.4+, TypeScript 5.8 Strict, Vite 6, `@tanstack/vue-query`, Pinia 2.1, Vitest.

## Global Constraints

- 严格 0 阴影：全局遵循 `box-shadow: none !important;`
- 严格 4px 圆角：交互元素与卡片统一遵循 `border-radius: 4px;`
- 纯白纸张基底：遵循 `#FFFFFF` 纸张底色与 `1px solid var(--a-color-border-soft)` 发丝线分割；
- 向下兼容红线：`src/api/books.ts` 与 `src/api/bookCatalog.ts` 必须通过 re-export 保持所有现有契约，既有 18 个测试套件（105 个用例）零修改 100% 通过；
- 测试验证红线：每次改动后必须运行 `bun run type-check`（0 报错）与目标测试套件。

---

### Task 1: 建立 `src/entities/book/model/types.ts` 领域实体类型与 `src/api/books.ts` 向下兼容桥接

**Files:**
- Create: `src/entities/book/model/types.ts`
- Modify: `src/api/books.ts`
- Test: `tests/unit/entities/book/bookTypes.spec.ts`

**Interfaces:**
- Consumes: None (independent domain models).
- Produces: `BookPublicWork`, `BookPublicEdition`, `BookShelfItem`, `BookContinueReading`, `BookAnnotation`, `BookImportSession`, `BookReadingState`, `CatalogWork`, `CatalogResource`, `CatalogPage`, `BookHighlightColor`, `BookHighlightStyle`, `BookEdit`, `BookPublicationRequest`, etc.

- [ ] **Step 1: 编写失败测试**

创建 `tests/unit/entities/book/bookTypes.spec.ts`，断言 `src/entities/book/model/types.ts` 导出完整的图书核心领域接口，且 `src/api/books.ts` 正确向后兼容 re-export。

```typescript
import { describe, it, expect } from 'vitest'
import type {
  BookPublicWork,
  BookPublicEdition,
  BookShelfItem,
  BookContinueReading,
  BookAnnotation,
  BookReadingState,
  CatalogWork,
  CatalogResource,
} from '@/entities/book/model/types'
import type {
  BookPublicWork as LegacyWork,
  BookShelfItem as LegacyShelf,
} from '@/api/books'

describe('Book domain model types', () => {
  it('exports valid and type-compatible book domain models', () => {
    const mockWork: BookPublicWork = {
      id: 'work-1',
      title: '百年孤独',
      authors: [{ id: 'author-1', name: '加西亚·马尔克斯', role: 'author' }],
      editions: [],
      rating: { average: 9.3, count: 1200 },
    }
    const legacyWork: LegacyWork = mockWork
    expect(legacyWork.title).toBe('百年孤独')

    const mockShelf: BookShelfItem = {
      id: 'shelf-1',
      user_id: 'user-1',
      work_id: 'work-1',
      status: 'reading',
      updated_at: '2026-10-19T00:00:00Z',
    }
    const legacyShelf: LegacyShelf = mockShelf
    expect(legacyShelf.status).toBe('reading')
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

运行：`bun run test:unit tests/unit/entities/book/bookTypes.spec.ts`
预期：FAIL，找不到模块 `@/entities/book/model/types`。

- [ ] **Step 3: 提取并创建 `src/entities/book/model/types.ts`**

将原 `src/api/books.ts`（第 6 行至第 455 行）以及 `src/api/bookCatalog.ts`、`src/api/bookReading.ts` 中的所有领域接口与类型统一下沉至 `src/entities/book/model/types.ts`。

- [ ] **Step 4: 在 `src/api/books.ts` 中建立 re-export**

在 `src/api/books.ts` 顶部替换内联声明为：
```typescript
export type {
  BookImportStatus,
  BookAssetProcessingStatus,
  BookUploadPart,
  BookImportSession,
  BookPublicPerson,
  BookPublicPublisher,
  BookPublicProducer,
  BookPublicSource,
  BookPublicEdition,
  BookPublicWork,
  CreatePublicBookInput,
  BookPublicEditionDetail,
  BookRatingSummary,
  BookReview,
  SaveBookReviewInput,
  BookReviewListResult,
  BookShelfItem,
  BookShelfListResult,
  BookContinueReading,
  BookEditSource,
  BookEdit,
  BookEditListResult,
  SubmitBookEditInput,
  BookPublicationRequest,
  BookPublicationRequestListResult,
  BookPublicationAppeal,
  BookPublicationAppealListResult,
  SubmitPublicationInput,
  BookPublishedAsset,
  BookPublishedAssetListResult,
  BookPublicationReport,
  BookPublicationReportListResult,
  BookPublicPost,
  BookPostListResult,
  BookCatalogSearchResult,
  BookPrivateAsset,
  BookReadingState,
  SaveBookReadingStateInput,
  CreateBookImportInput,
  BookUploadPartURL,
  BookHighlightColor,
  BookHighlightStyle,
  BookAnnotation,
  BookAnnotationListResult,
  CreateBookAnnotationInput,
  UpdateBookAnnotationInput,
  ListBookNotesQuery,
} from '@/entities/book/model/types'
```

- [ ] **Step 5: 运行测试并验证类型检查**

运行：`bun run test:unit tests/unit/entities/book/bookTypes.spec.ts`
运行：`bun run type-check`
预期：PASS，0 errors。

- [ ] **Step 6: 提交 Git 变更**

```bash
git add src/entities/book/model/types.ts src/api/books.ts tests/unit/entities/book/bookTypes.spec.ts
git commit -m "feat(books): extract book domain models to entities/book slice with zero breaking changes"
```

---

### Task 2: 建立 `src/entities/book/api/bookApi.ts` 与统一层级 Query Key 工厂 `bookKeys.ts`

**Files:**
- Create: `src/entities/book/api/bookApi.ts`
- Create: `src/entities/book/queries/bookKeys.ts`
- Test: `tests/unit/entities/book/bookApiAndKeys.spec.ts`

**Interfaces:**
- Consumes: Models from `src/entities/book/model/types.ts`.
- Produces: `bookKeys` 工厂对象，纯函数 API（`fetchCatalogWork`, `fetchCatalogResources`, `fetchBookShelf`, `fetchContinueReading`, `fetchBookNotes` 等）。

- [ ] **Step 1: 编写失败测试**

创建 `tests/unit/entities/book/bookApiAndKeys.spec.ts`：

```typescript
import { describe, it, expect } from 'vitest'
import { bookKeys } from '@/entities/book/queries/bookKeys'

describe('bookKeys factory', () => {
  it('generates consistent hierarchical query keys', () => {
    expect(bookKeys.all).toEqual(['books'])
    expect(bookKeys.catalog()).toEqual(['books', 'catalog'])
    expect(bookKeys.catalogWork('w-123')).toEqual(['books', 'catalog', 'works', 'w-123'])
    expect(bookKeys.catalogResources('w-123')).toEqual(['books', 'catalog', 'resources', 'w-123'])
    expect(bookKeys.shelf()).toEqual(['books', 'shelf'])
    expect(bookKeys.shelfList('reading')).toEqual(['books', 'shelf', 'list', 'reading'])
    expect(bookKeys.continueReading()).toEqual(['books', 'continue-reading'])
    expect(bookKeys.notesList({ limit: 10 })).toEqual(['books', 'notes', 'list', { limit: 10 }])
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

运行：`bun run test:unit tests/unit/entities/book/bookApiAndKeys.spec.ts`
预期：FAIL，找不到模块 `@/entities/book/queries/bookKeys`。

- [ ] **Step 3: 实现 `src/entities/book/queries/bookKeys.ts`**

```typescript
export const bookKeys = {
  all: ['books'] as const,
  catalog: () => [...bookKeys.all, 'catalog'] as const,
  catalogWorks: () => [...bookKeys.catalog(), 'works'] as const,
  catalogWork: (workId: string | number) => [...bookKeys.catalogWorks(), String(workId)] as const,
  catalogResources: (workId: string | number) => [...bookKeys.catalog(), 'resources', String(workId)] as const,
  shelf: () => [...bookKeys.all, 'shelf'] as const,
  shelfList: (status = '') => [...bookKeys.shelf(), 'list', status] as const,
  continueReading: () => [...bookKeys.all, 'continue-reading'] as const,
  readingState: (revisionId: string) => [...bookKeys.all, 'reading-state', revisionId] as const,
  readingMarks: (revisionId: string) => [...bookKeys.all, 'reading-marks', revisionId] as const,
  notes: () => [...bookKeys.all, 'notes'] as const,
  notesList: (query?: Record<string, unknown>) => [...bookKeys.notes(), 'list', query || {}] as const,
  reviews: (workId: string | number) => [...bookKeys.all, 'reviews', String(workId)] as const,
}
```

- [ ] **Step 4: 实现 `src/entities/book/api/bookApi.ts`**

将核心查询 API 封装至纯净 API 模块，委托至底层客户端或 `src/api/books` / `src/api/bookCatalog`。

- [ ] **Step 5: 运行测试并验证通过**

运行：`bun run test:unit tests/unit/entities/book/bookApiAndKeys.spec.ts`
预期：PASS。

- [ ] **Step 6: 提交 Git 变更**

```bash
git add src/entities/book/api/bookApi.ts src/entities/book/queries/bookKeys.ts tests/unit/entities/book/bookApiAndKeys.spec.ts
git commit -m "feat(books): create bookKeys query factory and bookApi module"
```

---

### Task 3: 建立 Vue Query Hooks 及 `src/entities/book/index.ts` 导出桶

**Files:**
- Create: `src/entities/book/queries/useCatalogWorkQuery.ts`
- Create: `src/entities/book/queries/useCatalogResourcesQuery.ts`
- Create: `src/entities/book/queries/useBookShelfQuery.ts`
- Create: `src/entities/book/queries/useContinueReadingQuery.ts`
- Create: `src/entities/book/queries/useBookNotesQuery.ts`
- Create: `src/entities/book/index.ts`
- Test: `tests/unit/entities/book/bookQueries.spec.ts`

**Interfaces:**
- Consumes: `bookKeys`, `bookApi`, `model/types`.
- Produces: `useCatalogWorkQuery`, `useCatalogResourcesQuery`, `useBookShelfQuery`, `useContinueReadingQuery`, `useBookNotesQuery` 统一从 `@/entities/book` 导出。

- [ ] **Step 1: 编写失败测试**

创建 `tests/unit/entities/book/bookQueries.spec.ts`，借助 `createTestQueryClient()` 验证 Query Hooks 的基本运作、staleTime 及 enabled 条件：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computed, ref } from 'vue'
import { createTestQueryClient } from '../../helpers/queryClient'
import { VUE_QUERY_CLIENT } from '@tanstack/vue-query'
import * as bookApi from '@/entities/book/api/bookApi'
import {
  useCatalogWorkQuery,
  useCatalogResourcesQuery,
  useBookShelfQuery,
  useContinueReadingQuery,
} from '@/entities/book'

describe('Book Vue Query hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('useCatalogWorkQuery fetches work when id is present', async () => {
    const queryClient = createTestQueryClient()
    const mockWork = { id: 'w-1', title: '百年孤独', authors: [] } as any
    vi.spyOn(bookApi, 'fetchCatalogWork').mockResolvedValue(mockWork)

    const workId = ref('w-1')
    const query = useCatalogWorkQuery(workId, { queryClient })

    await query.suspense?.() || new Promise(resolve => setTimeout(resolve, 50))
    expect(bookApi.fetchCatalogWork).toHaveBeenCalledWith('w-1')
    expect(query.data.value).toEqual(mockWork)
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

运行：`bun run test:unit tests/unit/entities/book/bookQueries.spec.ts`
预期：FAIL，找不到 Hooks 模块。

- [ ] **Step 3: 实现 Query Hooks**

实现：
- `useCatalogWorkQuery(workId, options?)`（`staleTime: 5 * 60 * 1000`）
- `useCatalogResourcesQuery(workId, options?)`（`staleTime: 5 * 60 * 1000`）
- `useBookShelfQuery(status?, options?)`（`staleTime: 2 * 60 * 1000`）
- `useContinueReadingQuery(limit?, options?)`（`staleTime: 1 * 60 * 1000`）
- `useBookNotesQuery(query?, options?)`（`staleTime: 2 * 60 * 1000`）

- [ ] **Step 4: 编写 `src/entities/book/index.ts` 汇聚导出**

```typescript
export * from './model/types'
export * from './api/bookApi'
export * from './queries/bookKeys'
export * from './queries/useCatalogWorkQuery'
export * from './queries/useCatalogResourcesQuery'
export * from './queries/useBookShelfQuery'
export * from './queries/useContinueReadingQuery'
export * from './queries/useBookNotesQuery'
```

- [ ] **Step 5: 运行测试并验证通过**

运行：`bun run test:unit tests/unit/entities/book/bookQueries.spec.ts`
运行：`bun run type-check`
预期：PASS，0 errors。

- [ ] **Step 6: 提交 Git 变更**

```bash
git add src/entities/book/ queries/ tests/unit/entities/book/
git commit -m "feat(books): implement Vue Query hooks and barrel export in entities/book"
```

---

### Task 4: 重构 `BookCatalogWorkView.vue`（接入 Vue Query，消灭 `catalogRevision` 脏变量）

**Files:**
- Modify: `src/views/books/BookCatalogWorkView.vue`
- Modify: `src/api/bookCatalog.ts`
- Test: `tests/unit/views/books/BookCatalog.spec.ts`

**Interfaces:**
- Consumes: `useCatalogWorkQuery`, `useCatalogResourcesQuery`, `bookKeys` from `@/entities/book`.
- Produces: 声明式、零脏变量的图书详情视图。

- [ ] **Step 1: 验证已有基线测试通过**

运行：`bun run test:unit tests/unit/views/books/BookCatalog.spec.ts`
预期：PASS（基线安全）。

- [ ] **Step 2: 重构 `BookCatalogWorkView.vue`**

1. 将原手写 `const loading = ref(true)`、`const work = ref(...)` 替换为 `const { data: work, isLoading: loading, error: workError, refetch: refreshWork } = useCatalogWorkQuery(...)`；
2. 将文件加载状态替换为 `const { data: resourcesData, isLoading: resourcesLoading, error: resError } = useCatalogResourcesQuery(...)`；
3. 将 `@saved="refreshWork"` / `@changed="refreshWork"` 升级为 `queryClient.invalidateQueries({ queryKey: bookKeys.catalogWork(workId) })`；
4. 移除 `alive = true / false` 及 `catalogRevision` 强耦合。

- [ ] **Step 3: 优化 `src/api/bookCatalog.ts`**

保留 `catalogRevision` 作为废弃兼容导出（`export const catalogRevision = readonly(ref(0))`），并在 `createCatalogWork` / `createCatalogEdition` 中执行无害同步，同时推荐通过 query invalidation 驱动。

- [ ] **Step 4: 运行视图测试验证**

运行：`bun run test:unit tests/unit/views/books/BookCatalog.spec.ts`
预期：PASS。

- [ ] **Step 5: 提交 Git 变更**

```bash
git add src/views/books/BookCatalogWorkView.vue src/api/bookCatalog.ts
git commit -m "refactor(books): migrate BookCatalogWorkView to Vue Query and remove catalogRevision hack"
```

---

### Task 5: 重构 `BookLibraryView.vue`（接入书架与在读进度 Query，优化状态失效流）

**Files:**
- Modify: `src/views/books/BookLibraryView.vue`
- Test: `tests/unit/views/books/BookLibraryView.spec.ts`
- Test: `tests/unit/components/books/BookLibraryCard.spec.ts`
- Test: `tests/unit/components/books/BookLibraryContinueCard.spec.ts`

**Interfaces:**
- Consumes: `useBookShelfQuery`, `useContinueReadingQuery`, `useBookNotesQuery`, `bookKeys` from `@/entities/book`.
- Produces: 具有毫秒级本地缓存和精准变更失效的书架页面。

- [ ] **Step 1: 验证书架基线单测**

运行：`bun run test:unit tests/unit/views/books/BookLibraryView.spec.ts tests/unit/components/books/BookLibraryCard.spec.ts tests/unit/components/books/BookLibraryContinueCard.spec.ts`
预期：PASS。

- [ ] **Step 2: 重构 `BookLibraryView.vue` 数据层**

1. 接入 `useBookShelfQuery('', { limit: 100 })` 与 `useContinueReadingQuery(20)` 及 `useBookNotesQuery({ limit: 1 })`；
2. 在 `handleUpdateStatus` 中调用 `saveBookShelf(workId, status)` 后，通过 `queryClient.invalidateQueries({ queryKey: bookKeys.shelf() })` 与 `invalidateQueries({ queryKey: bookKeys.continueReading() })` 实现自动精准重刷，并支持乐观更新；
3. 保留对 Vitest 测试中无 QueryClient 挂载时的安全降级（try/catch 包裹 `useQueryClient()`），确保既有浅挂载单测 100% 保持通过。

- [ ] **Step 3: 运行书架全套单测**

运行：`bun run test:unit tests/unit/views/books/BookLibraryView.spec.ts tests/unit/components/books/BookLibraryCard.spec.ts tests/unit/components/books/BookLibraryContinueCard.spec.ts`
预期：PASS。

- [ ] **Step 4: 提交 Git 变更**

```bash
git add src/views/books/BookLibraryView.vue
git commit -m "refactor(books): integrate BookLibraryView with useBookShelfQuery and declarative cache sync"
```

---

### Task 6: 全量类型检查、全仓书籍与全局回归验证与构建

**Files:**
- All touched files

- [ ] **Step 1: 全量 TypeScript 严格类型检查**

运行：`bun run type-check`
预期：0 errors。

- [ ] **Step 2: 全量书籍相关单测回归**

运行：`bun run test:unit tests/unit/entities/book/ tests/unit/components/books/ tests/unit/views/books/`
预期：所有 18+ 个测试文件、110+ 个用例全部通过，0 failed。

- [ ] **Step 3: 生产构建验证**

运行：`bun run build`
预期：`vite build` 成功退出，退出码 0。

- [ ] **Step 4: 最终整理提交**

```bash
git commit --allow-empty -m "chore(books): complete books module fsd domain slice and vue-query refactoring verification"
```
