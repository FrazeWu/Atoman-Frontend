# 个人书架全景工作台 (BookLibraryView) 设计规范

> **目标**：将 `/books/library` 从混合多功能的 `BooksHomeView.vue` 中彻底解耦，构建独立的、功能完备且符合「纯白微凹槽极简系统（Pure-White Double-Notch Minimal System）」的个人书架全景工作台。

---

## 1. 背景与现状

当前 Atoman 前端图书模块的个人书架位于 `src/views/books/BooksHomeView.vue` 中，通过 `v-if="isLibrary"` 条件渲染。存在以下核心痛点：
1. **代码膨胀与职责混杂**：`BooksHomeView.vue` 达 1000 行，同时承载了公共图书发现（发现/分类/搜索）、个人书架（在读/收藏/导入/上传）、书单（lists）、作者（authors）等多重逻辑，状态相互交织，难以维护与扩展。
2. **交互体验简陋**：
   - 「继续阅读」仅为一个简单的 `<ul>` 列表，缺少醒目的进度指引与沉浸感；
   - 书架书籍与本地上传记录彼此割裂为两段独立的列表，缺少统合检索与视图切换；
   - 缺少书架数据总览（藏书量、在读数、读完数、批注累计数等元数据指标）；
   - 交互按键存在裸写 `<button>` 与非标准危险样式，未完全对齐纯白设计系统规范。

---

## 2. 视觉规范与设计原则 (Pure-White Double-Notch Minimal System)

严格遵循 `AGENTS.md`、`design_system.md` 与 `frontend-ui.md` 规则：
- **R1 纯白表面**：卡片、工作台、下拉面板基础背景统一使用 `#ffffff` / `var(--a-color-bg)`，严禁使用 `var(--a-color-surface)` 作为卡片底色。
- **R2 柔和分界**：外框使用 `var(--a-color-border)`，内部分割使用 `var(--a-color-border-soft)`。
- **R3 令牌阴影**：卡片悬浮使用 `var(--a-shadow-card)` 或 `var(--a-shadow-sm)`，下拉弹层使用 `var(--a-shadow-dropdown)`，禁止硬编码 rgb 阴影。
- **R4 小圆角**：卡片使用 `var(--a-radius-card)` (4px)，按钮与输入框使用 `var(--a-radius-control)` (4px)，严禁 999px 胶囊、50% 或大圆角。
- **R5 克制字重**：标题使用 500（极少数强强调使用 600），正文 400，严禁 700/800/bold。
- **R6 主色与语义色**：主操作使用 `var(--a-color-primary)`，危险操作使用 `var(--a-color-danger)`，弱提示使用 `var(--a-color-text-muted)`。
- **R8 纯净用户文案**：禁止出现技术黑话（如“内部”、“System”、“凭证设置”等），动作文案符合自然中文语境。

---

## 3. 功能架构与页面布局

### 3.1 总体布局结构

```
+--------------------------------------------------------------------------+
|  顶部状态条与工具栏 (Header & Stats & Actions)                           |
|  - 页面标题: "我的书架"                                                  |
|  - 统计指标条: 藏书总量 · 在读中 · 已读完 · 批注想法                      |
|  - 操作组: 导入电子书 (PButton Primary) · 视图切换 (网格/列表)           |
+--------------------------------------------------------------------------+
|  在读直达区 (Continue Reading Hero Grid)                                  |
|  - 最近在读的 1~3 本书籍卡片                                             |
|  - 包含封面、格式标签、阅读进度条 (xx%)、最近阅读时间、一键「继续阅读」   |
+--------------------------------------------------------------------------+
|  书架主体分类与检索栏 (Filter & Search Toolbar)                          |
|  - 分类 Tabs: [全部] · [在读] · [想读] · [读完] · [本地上传]             |
|  - 搜索框: 快速在书架内检索书名/作者/文件名                              |
+--------------------------------------------------------------------------+
|  书籍列表/网格流 (Book Stream)                                           |
|  - 网格视图 (Grid View): 封面居前，进度条，状态胶囊，悬浮快捷操作        |
|  - 列表视图 (List View): 紧凑行模式，适合大量藏书管理                    |
|  - 快捷操作: 切换阅读状态、进入阅读器、关联公共作品、删除/移出书架        |
+--------------------------------------------------------------------------+
|  上传进度浮层 / 弹框 (Upload & Processing Drawer/Banner)                  |
|  - 支持分片上传进度、格式检验 (.epub/.pdf/.txt/.mobi/.azw3)              |
|  - 处理中状态（转码/提取元数据/就绪）与失败重试                          |
+--------------------------------------------------------------------------+
```

### 3.2 核心组件划分

1. **`BookLibraryView.vue`** (页面主视图，位于 `src/views/books/`)：
   - 组织顶部统计、在读 Hero 卡片、分类切换、搜索栏、主展示流、上传触发。
   - 响应路由 `/books/library` 与 `/books/import/:importId`。
2. **`BookLibraryCard.vue`** (书架卡片组件，位于 `src/components/books/`)：
   - 统一渲染公共书架收藏（`BookShelfItem`）与本地导入书籍（`BookImportSession`）。
   - 支持网格卡片（Grid）与紧凑行（List）两种展示模式。
   - 展示书籍封面（或根据书名自动生成的纯净质感封面占位符）、格式角标（EPUB/PDF/TXT）、阅读百分比、操作菜单。
3. **`BookLibraryContinueCard.vue`** (在读书籍英雄卡片，位于 `src/components/books/`)：
   - 强化在读书籍的呼出体验，呈现进度条与一键进入阅读器的跳点。
4. **`BookImportUploadModal.vue`** (电子书导入对话框，位于 `src/components/books/`)：
   - 拖拽上传与文件选择器，支持批量或单本上传。
   - 接入现有 `runMultipartUpload` 与 `listBookImports` 处理流程。

---

## 4. API 与状态数据流

本工作台完全复用现有稳定的后端 API，无需后端做破坏性重构：
- `listBookShelf(status, limit, offset)`: 获取书架作品列表
- `listContinueReading(limit)`: 获取当前在读书籍与阅读百分比
- `listBookImports()`: 获取本地电子书上传记录与解析状态
- `saveBookShelf(workId, status, note)`: 更新书籍收藏状态（want_to_read / reading / read / dropped）
- `deleteBookShelf(workId)`: 移出书架
- `deleteBookImport(importId)`: 删除上传记录
- `retryBookImport(importId)`: 重试解析
- `listBookNotes({ has_note: true })`: 获取用户的批注总数（用于统计面板）

---

## 5. 解耦与重构迁移规范

1. **路由迁移**：
   - 修改 `src/router/routes/modules.ts`，将 `/books/library` 和 `/books/import/:importId` 映射至新建的 `BookLibraryView.vue`。
2. **瘦身 `BooksHomeView.vue`**：
   - 移除 `BooksHomeView.vue` 中的 `isLibrary` 模板分支及相关的在读、书架、上传处理逻辑。
   - `BooksHomeView.vue` 专注于公共图书索引、搜索与分类发现，代码量削减约 400 行。
3. **测试覆盖**：
   - 新增 `tests/unit/views/books/BookLibraryView.spec.ts` 验证书架渲染、分类筛选、在读卡片、视图切换、删除/移除逻辑。
   - 新增 `tests/unit/components/books/BookLibraryCard.spec.ts` 验证网格与列表模式渲染。
   - 同步更新已有的 `BooksHomeView.spec.ts`。
