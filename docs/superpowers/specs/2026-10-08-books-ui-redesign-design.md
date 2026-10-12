# 书籍模块 (Books) 全站风格对齐与 UI 极简重构设计规范

- 日期：2026-10-12
- 状态：Approved (User selected Plan A: staged execution)
- 范围：`Atoman-Frontend` 的书籍模块（首页/书库、作品详情抽屉、版本详情、阅读器、贡献与审核、相关书籍组件）

---

## 1. 目标与设计原则

将现有的书籍模块（Books）全面对齐全站的 **纯白双刻痕极简体系（Pure-White Double-Notch Minimal System）**（`AGENTS.md`、`design_system.md`、`frontend-ui.md`）。彻底根除散落在各子页面中的原生 `<select>`、`<input>` 和 `<textarea>`，规范化表单输入与按钮体系；移除阅读器中的开发者视角词汇（如 `kicker="READER"`）；消除硬编码色值与大圆角胶囊；细化书目卡片、封面排版与列表徽标，提升阅读与管理体验。

### 核心原则
1. **标准组件化**：所有表单输入一律使用 `PSelect`、`PInput`、`PTextarea` 与 `PButton`，消除原生表单控件粗糙感。`PButton` 变体仅限 `primary`、`secondary`、`danger`、`ghost`。
2. **极简纯白表面**：页面、卡片、抽屉面板、阅读器背景统一采用纯白表面（`var(--a-color-bg)` / `#ffffff`），柔和分界线（`var(--a-color-border)` / `var(--a-color-border-soft)`），`4px` 小圆角（`var(--a-radius-card)` / `var(--a-radius-control)`），无硬投影，仅使用 `var(--a-shadow-*)` 令牌。
3. **克制文字与排版**：标题字重统一为 `500`（强调态 `600`），数字采用 `tabular-nums` 等宽排布；严格遵循 `AGENTS.md` 语言规范，标题仅写动作名或内容名，副标题精简至单行硬性指引，禁止开发者视角术语。
4. **消除大圆角胶囊**：消除 `border-radius: 999px`，进度条、标签、状态指示器均统一使用 `4px` 小圆角或纯平几何槽。
5. **分阶段有序推进**：
   - **Phase 1（书目目录与治理）**：`BooksHomeView`、`BookWorkView`、`BookEditionView`、`BooksGovernanceView`、`BookCard`、`BookCover`、`BookPrivateUpload`。
   - **Phase 2（阅读器双栏核心与控制栏）**：`BookReaderView`、`BookPublicReaderView`、`BooksLayout`。
6. **契约与功能完整**：保留现有书架状态同步、阅读进度记录、文件上传与公共书目关联等既有业务逻辑与测试契约。

---

## 2. 页面与组件设计细节

### 2.1 书库首页与发现流（`BooksHomeView.vue` & `BookCard.vue` & `BookCover.vue`）
- **页面标题与筛选栏**：
  - 页面标题：发现页为“发现”，搜索页为“搜索”，书库页为“我的书库”；副标题根据场景精简展示。
  - 书架操作栏：书架状态筛选使用 `PSelect`（白底、4px 圆角、细边框），导入按钮使用 `PButton variant="secondary"`。
  - 搜索栏采用与全站列表一致的轻量检索框。
  - 移除继续阅读进度条上的 `border-radius: 999px`，统一使用 `var(--a-radius-control)`（4px）。
- **书目卡片与封面（`BookCard.vue` & `BookCover.vue`）**：
  - 封面保持 `4px`（`var(--a-radius-card)`）小圆角，移除多余硬阴影。
  - 标题字重 `500`，字号 `0.9375rem`，两行截断；作者与出版信息为次级灰色 `var(--a-color-muted)`。
  - 评分使用 `tabular-nums` 等宽排版，星标紧凑。
  - 悬停平滑过渡标题颜色为 `var(--a-color-primary)`，动效时长 `0.15s`。
- **上传记录与继续阅读**：
  - 列表项底边采用 `var(--a-color-border-soft)`，状态徽标收敛为“标准圆点 + 简练文字”（上传中、解析完成、失败）。
  - 操作列图标按钮使用规范的 `PButton`（`variant="ghost"`，`size="sm"`）。

### 2.2 作品详情与版本详情抽屉（`BookWorkView.vue` & `BookEditionView.vue` & `BookPrivateUpload.vue`）
- **书架状态与动作区**：
  - 替换原生 `<select id="shelf-status">` 为 `PSelect`，与“加入书架”（Secondary）和“开始阅读”（Primary）形成协调的按钮组。
- **短书评编辑区**：
  - 替换原生 `<textarea id="book-review">` 为标准的 `PTextarea`，聚焦使用 `var(--a-color-primary)`。
  - 替换可见性原生 `<select>` 为 `PSelect`，提交按钮使用 `PButton`。
- **版本详情（`BookEditionView.vue`）**：
  - 事实元数据采用整洁对齐的定义列表（`dl/dt/dd`），边线使用 `var(--a-color-border-soft)`。
- **私密电子书上传（`BookPrivateUpload.vue`）**：
  - 上传区域背景使用 `var(--a-color-bg)`，边框使用 `var(--a-color-border-soft)`，状态提示语义化（成功使用 `var(--a-color-success)`，失败使用 `var(--a-color-danger)`）。

### 2.3 阅读器极净化（`BookReaderView.vue` & `BookPublicReaderView.vue`）
- **头部与标题**：
  - 彻底移除 `PSectionHeader kicker="READER"` 等内部开发者词汇，改用简明纯净的 `PPageHeader`。
- **控制栏与分页**：
  - 分页指示器（“第 X / Y 页”）、上一页/下一页按钮采用标准的 `PButton`（`variant="ghost"` / `variant="secondary"`，`size="sm"`）。
  - 进度指示条采用极细 `3px` `var(--a-color-primary)` 高亮指示。
  - 消除所有硬编码 `#ffffff` 和 `#e2e8f0`，统一使用 `var(--a-color-bg)`、`var(--a-color-border)`、`var(--a-color-border-soft)`。
- **EPUB / TXT 目录与排版抽屉**：
  - 纯白背景、柔和细分界线，目录项悬停使用 `var(--a-color-surface-muted)` 微灰反馈。

### 2.4 贡献与审核治理（`BooksGovernanceView.vue`）
- **提交作品表单**：
  - 彻底替换原生 `<input>` 和 `<textarea>` 为 `PInput` 与 `PTextarea`，字段标签与输入底线对齐全站表单规范。
- **申请记录与审核列表**：
  - 列表项采用纯白表面与柔和细分界，撤回/申诉操作使用规范的 Ghost / Secondary 按钮。

---

## 3. 测试与验证方案

1. **单元测试验证**：
   - 运行全部书籍测试套件：
     - `tests/unit/views/books-home.spec.ts`
     - `tests/unit/views/book-work.spec.ts`
     - `tests/unit/views/book-reader.spec.ts`
     - `tests/unit/views/book-public-reader.spec.ts`
     - `tests/unit/views/books-governance.spec.ts`
     - `tests/unit/components/BookCover.spec.ts`
     - `tests/unit/config/books-module.spec.ts`
2. **设计契约与类型检查**：
   - 运行设计系统契约测试：`bun run test:unit tests/unit/ui/design-system-contract.spec.ts`。
   - 运行全量 TypeScript 类型检查：`bun run type-check`。
   - 运行 `git diff --check` 保证格式规范。
   - 运行生产构建：`bun run build`。
