# 个人书架全景工作台 (BookLibraryView) 实施计划

> **依据规范**：`docs/superpowers/specs/2026-10-15-books-library-redesign-design.md`
> **视觉基线**：纯白微凹槽极简系统（Pure-White Double-Notch Minimal System，4px 圆角、纯白背景、柔和边框、500/600 标题字重、语义令牌色彩、无技术黑话）

---

## 任务拆解与推进路线

### Task 1: 书架卡片与在读直达卡片组件 (`BookLibraryCard.vue` & `BookLibraryContinueCard.vue`)
- **目标**：实现承载作品与本地导入记录的通用卡片组件和顶部在读直达英雄卡片。
- **文件路径**：
  - `src/components/books/BookLibraryCard.vue`
  - `src/components/books/BookLibraryContinueCard.vue`
  - `tests/unit/components/books/BookLibraryCard.spec.ts`
- **详细内容**：
  1. `BookLibraryCard.vue`：
     - Props: `item: BookShelfItem | BookImportSession`, `viewMode: 'grid' | 'list'`, `readingPercent?: number`
     - Emits: `'read': [id: string]`, `'update-status': [id: string, status: string]`, `'delete': [id: string]`, `'link-work': [id: string]`
     - 纯白背景 `var(--a-color-bg)`，4px 圆角 `var(--a-radius-card)`，边框 `1px solid var(--a-color-border-soft)`。
     - 优雅封面占位渲染（若无封面图片，使用纯净微凹槽书名首字封面）。
     - 格式角标（EPUB / PDF / TXT 等），状态标签（在读 / 想读 / 读完）。
     - 操作菜单（PButton / 下拉或内联操作），支持移出书架、重试、删除。
  2. `BookLibraryContinueCard.vue`：
     - Props: `item: BookContinueReading`
     - Emits: `'read': [assetId: string]`
     - 呈现最近在读书籍的大卡片，包含进度条（`var(--a-color-primary)`）、进度百分比、格式标签及「继续阅读」按钮。
  3. 单元测试 `BookLibraryCard.spec.ts`：
     - 测试在网格与列表两种模式下的渲染。
     - 测试公共书架项目与本地上传项目的兼容性。
     - 测试操作事件触发。

### Task 2: 电子书导入弹层组件 (`BookImportUploadModal.vue`)
- **目标**：实现干净的电子书导入浮层，支持拖拽、格式校验、上传进度与完成提示。
- **文件路径**：
  - `src/components/books/BookImportUploadModal.vue`
  - `tests/unit/components/books/BookImportUploadModal.spec.ts`
- **详细内容**：
  1. 支持 `.epub`、`.pdf`、`.txt`、`.mobi`、`.azw3`。
  2. 拖拽区域支持高亮反馈，4px 圆角，虚线边框 `var(--a-color-border)`。
  3. 上传进度条与状态展示。
  4. 触发上传完成后发出 `'success'` 事件，刷新书架数据。
  5. 编写单元测试验证文件过滤与上传流程。

### Task 3: 个人书架全景工作台主页面 (`BookLibraryView.vue`) 与路由接入
- **目标**：实现独立主页面，组织数据流、统计指标、分类筛选、搜索及多视图呈现。
- **文件路径**：
  - `src/views/books/BookLibraryView.vue`
  - `src/router/routes/modules.ts`
  - `tests/unit/views/books/BookLibraryView.spec.ts`
- **详细内容**：
  1. 顶部状态指标：统计藏书总量、在读书籍、已读完、批注条数。
  2. 在读英雄区：渲染 `BookLibraryContinueCard`。
  3. 筛选与搜索工具栏：
     - 分类切换：全部、在读、想读、读完、本地导入。
     - 搜索过滤输入框。
     - 视图切换按键（网格视图与列表视图）。
  4. 主内容流：
     - 渲染 `BookLibraryCard` 流。
     - 空状态与骨架加载态。
  5. 路由注册：在 `src/router/routes/modules.ts` 中将 `/books/library` 及 `/books/import/:importId` 映射至 `BookLibraryView.vue`。
  6. 单元测试 `BookLibraryView.spec.ts` 验证整体加载、筛选、搜索、路由联动。

### Task 4: `BooksHomeView.vue` 瘦身与全站回归验证
- **目标**：清理 `BooksHomeView.vue` 中的旧书架代码，保持公共图书发现页面的纯粹性，确保无回归风险。
- **详细内容**：
  1. 从 `BooksHomeView.vue` 中彻底移除 `isLibrary` 相关的模板、状态与方法。
  2. 运行 `bun run type-check` 保证严格类型通过。
  3. 运行全体单元测试 `bun run test:unit`。
  4. 构建验证 `bun run build`。
