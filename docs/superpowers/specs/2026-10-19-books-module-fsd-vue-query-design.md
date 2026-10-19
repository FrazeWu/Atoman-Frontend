# 书籍阅读模块（Books）FSD 领域切片与 TanStack Vue Query 架构重构设计规范

## 一、概述与重构背景

书籍阅读模块（Books）是 Atoman 前端中体量最大、业务链路最长、用户交互最频繁的核心业务模块之一，拥有 24 个视图文件、29 个组件、18 个单元测试文件及 105 个测试用例，覆盖“公开作品书目编目”、“多版本出版社信息与 Wiki 协作”、“电子书文件多格式上传与分片传输”、“私有/云端书架管理与在读进度同步”、“阅读器划线与想法批注系统”等全流程。

### 当前核心技术痛点与架构瓶颈

1. **820 行巨石 API 文件（`src/api/books.ts`）与类型紧耦合**：
   - 超过 35 个关键领域数据模型（包括 `BookPublicWork`、`BookPublicEdition`、`BookShelfItem`、`BookAnnotation`、`BookImportSession`、`BookReadingState` 等）直接混杂在 `api/books.ts` 源码前部；
   - 外部多达 43 处引用直接与该巨石文件耦合；周边同时散落着 `bookCatalog.ts`、`bookReading.ts`、`bookPrivate.ts`、`bookResources.ts`、`bookCommunity.ts`、`bookLists.ts`、`bookWiki.ts` 等 7 个孤立 API 文件，缺乏统一的领域导出与归属。
2. **脏标记局部刷新黑客手段（`catalogRevision = ref(0)`）**：
   - 在 `src/api/bookCatalog.ts` 中，由于缺乏现代服务端状态管理机制，开发者声明了模块全局变量 `const revision = ref(0)`，在每次创建作品或版本后执行 `revision.value++` 试图通知页面重新加载，不仅违背了单向数据流原则，也导致 SSR/测试隔离时极易发生状态串扰。
3. **视图层频繁手写 `Promise.all` 与缺失缓存**：
   - 例如 `BookLibraryView.vue`（我的书架），每次组件进入时均通过硬并发 `Promise.all([listBookShelf, listContinueReading, listBookImports, listBookNotes])` 重新请求全部接口，造成不必要的网络消耗与加载闪烁；
   - 改变在读状态（`handleUpdateStatus`）时，只能通过在内存数组上手动 `target.status = status` 假更新，其他关联页面（如详情页或搜索流）无法感知变更。
4. **缺乏统一 Query Key 工厂与自动化缓存生命周期管理**：
   - 缺少声明式的数据缓存、新鲜度控制（`staleTime`）以及操作后的精准失效（`invalidateQueries`），无法实现数据跨视图即时共享。

---

## 二、架构目标与 FSD 领域化分层设计

遵循 Feature-Sliced Design (FSD) 标准规范及全仓架构重构原则：
**`app` ➔ `pages` ➔ `widgets` ➔ `features` ➔ `entities` ➔ `shared`**

### 1. 建立 `src/entities/book/` 切片

```text
src/entities/book/
├── model/
│   └── types.ts            # 汇聚规范所有 Book 领域数据模型，完全解耦自 API 实现
├── api/
│   └── bookApi.ts          # 统一汇聚 Catalog、Shelf、Reading、Notes、Resources 纯净 API
├── queries/
│   ├── bookKeys.ts         # 层级化 Query Key 工厂
│   ├── useCatalogWorkQuery.ts    # 书目作品详情 Query
│   ├── useCatalogResourcesQuery.ts # 书目关联电子书文件 Query
│   ├── useBookShelfQuery.ts      # 用户个人书架 Query
│   ├── useContinueReadingQuery.ts# 在读进度直达 Query
│   └── useBookNotesQuery.ts      # 划线与批注列表 Query
└── index.ts                # Public API 统一桶导出
```

### 2. 100% 向后兼容桥接层设计

- 现有 103+ 处导入代码保持平滑不被破坏；
- 在 `src/api/books.ts` 中通过：
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
    BookShelfItem,
    BookContinueReading,
    BookAnnotation,
    BookReadingState,
    // ...其余所有 Book 实体类型
  } from '@/entities/book/model/types'
  ```
  完成代理转发，并由 `src/entities/book/index.ts` 对外提供现代 FSD 引用。

### 3. 彻底淘汰 `catalogRevision = ref(0)`

- 废除 `bookCatalog.ts` 中的 `catalogRevision` 响应式黑客变量；
- 所有作品创建、版本添加操作转化为 TanStack Query 的自动失效触发：
  ```typescript
  queryClient.invalidateQueries({ queryKey: bookKeys.catalog() })
  ```
  页面自动实现精细化静默更新，杜绝全局响应式污染。

---

## 三、Query Key 工厂体系设计

在 `src/entities/book/queries/bookKeys.ts` 中定义标准化层级结构：

```typescript
export const bookKeys = {
  all: ['books'] as const,
  // 书目公开目录
  catalog: () => [...bookKeys.all, 'catalog'] as const,
  catalogWorks: () => [...bookKeys.catalog(), 'works'] as const,
  catalogWork: (workId: string | number) => [...bookKeys.catalogWorks(), String(workId)] as const,
  catalogResources: (workId: string | number) => [...bookKeys.catalog(), 'resources', String(workId)] as const,
  // 个人书架
  shelf: () => [...bookKeys.all, 'shelf'] as const,
  shelfList: (status = '') => [...bookKeys.shelf(), 'list', status] as const,
  continueReading: () => [...bookKeys.all, 'continue-reading'] as const,
  // 阅读状态与云同步
  readingState: (revisionId: string) => [...bookKeys.all, 'reading-state', revisionId] as const,
  readingMarks: (revisionId: string) => [...bookKeys.all, 'reading-marks', revisionId] as const,
  // 批注与想法
  notes: () => [...bookKeys.all, 'notes'] as const,
  notesList: (query?: Record<string, unknown>) => [...bookKeys.notes(), 'list', query || {}] as const,
}
```

---

## 四、核心视图打样接入设计

### 1. `BookCatalogWorkView.vue`（图书详情）
- **现状**：拥有手动 `alive` 变量防卸载赋值、手动 `refreshWork()`、手写 `loading` / `error`。
- **重构接入**：
  - 接入 `useCatalogWorkQuery(workId)`：配置 `staleTime: 5 * 60 * 1000`，支持即时缓存命中与后台更新；
  - 接入 `useCatalogResourcesQuery(workId)`：拆分图书信息与文件可用性状态；
  - 监听作品保存和版本新增事件，直接调用 `queryClient.invalidateQueries` 重新验证，彻底消除 `catalogRevision`。

### 2. `BookLibraryView.vue`（我的书架）
- **现状**：挂载时硬性 `Promise.all` 4 个接口，Tab 切换无记忆与缓存，更新状态后内存硬塞。
- **重构接入**：
  - 接入 `useBookShelfQuery()` 与 `useContinueReadingQuery()` 及 `useBookNotesQuery({ limit: 1 })`；
  - 缓存保持有效时长（书架 `staleTime: 2 * 60 * 1000`），用户在阅读器与书架之间切换时**零等待即时开屏**；
  - 状态修改（在读/读完/想读）通过统一 API 更新并使 `bookKeys.shelf()` 与 `bookKeys.continueReading()` 自动失效，确保跨页面数据绝对一致。

---

## 五、验证门禁与回归安全线

1. **测试隔离保障**：
   - 遵循此前建立的 `createTestQueryClient()` 规范，单测环境隔离 QueryClient 状态；
   - 保持所有既有 18 个测试文件（105 个测试用例）100% 绿色通过，零破坏现有行为。
2. **静态类型安全**：
   - 确保 `bun run type-check` 0 报错；
3. **生产构建验证**：
   - `bun run build` 验证构建成功与产物无异常；
4. **UI 设计规范红线**：
   - 严格遵循 0 阴影（`box-shadow: none !important`）、4px 圆角（`border-radius: 4px`）、纯白纸张基底与微弱发丝线分隔设计规范。
