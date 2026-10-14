# 图书模块深化设计规范：阅读器划线批注与跨书笔记中心

## 1. 概述与设计原则

本设计规范针对 Atoman 图书（Books）模块的进一步深化，确立**阅读器划线批注系统（Reader Annotations & Highlights）**与**跨书统一随手笔记中心（Book Notes Center）**的端到端技术架构与 UI/UX 规范。

### 核心设计原则
1. **纯白与双凹槽极简体系 (Pure-White Double-Notch Minimal System)**：
   - 所有的划线卡片、笔记面板、浮动气泡、抽屉与工作台严格使用纯白底色（`var(--a-color-bg)` / `#ffffff`）。
   - 边线使用 `var(--a-color-border-soft)` 与 `var(--a-color-border)`，投影使用令牌阴影（如 `var(--a-shadow-dropdown)`）。
   - 统一 4px 控制与卡片圆角（`var(--a-radius-card)` / `var(--a-radius-control)`），严禁使用胶囊大圆角或圆形。
2. **克制色彩与语义色彩映射**：
   - 高亮色彩映射至系统语义色彩，并保持柔和度（`color-mix` 与透明度）：
     - `yellow` (醒目/重点): `var(--a-color-warning)` 柔和背景色（如 `rgba(245, 158, 11, 0.18)`）
     - `green` (观点/论据): `var(--a-color-success)` 柔和背景色（如 `rgba(16, 185, 129, 0.18)`）
     - `blue` (事实/资料): `var(--a-color-primary)` 柔和背景色（如 `rgba(37, 99, 235, 0.15)`）
     - `pink` (疑问/灵感): `var(--a-color-danger)` 柔和背景色（如 `rgba(239, 68, 68, 0.16)`）
3. **原生桌面级沉浸体验**：
   - 划线操作即选即呈，毫秒级无感响应；
   - 支持 EPUB、TXT、PDF 三种主流电子书格式的双向定位与跳转；
   - 跨书笔记聚合秒级加载，提供结构化 Markdown 导出与原书定位回跳。

---

## 2. 后端数据模型与 API 规范 (`Atoman-Backend`)

### 2.1 数据模型 (`internal/model/book.go`)

新增 `UserBookAnnotation` 模型：

```go
type UserBookAnnotation struct {
	Base
	UserID         uuid.UUID  `json:"user_id" gorm:"type:uuid;not null;index"`
	AssetID        uuid.UUID  `json:"asset_id" gorm:"type:uuid;not null;index"`
	WorkID         *uuid.UUID `json:"work_id,omitempty" gorm:"type:uuid;index"`
	Format         string     `json:"format" gorm:"not null;check:chk_user_book_annotations_format,format IN ('epub','pdf','txt')"`
	EPUBCFI        string     `json:"epub_cfi,omitempty" gorm:"type:text;not null;default:''"`
	PDFPage        int        `json:"pdf_page,omitempty" gorm:"not null;default:0"`
	PDFRects       string     `json:"pdf_rects,omitempty" gorm:"type:jsonb;not null;default:'[]'"`
	TXTOffsetStart int64      `json:"txt_offset_start,omitempty" gorm:"not null;default:0"`
	TXTOffsetEnd   int64      `json:"txt_offset_end,omitempty" gorm:"not null;default:0"`
	Text           string     `json:"text" gorm:"type:text;not null"`
	Color          string     `json:"color" gorm:"not null;default:'yellow';check:chk_user_book_annotations_color,color IN ('yellow','green','blue','pink')"`
	Style          string     `json:"style" gorm:"not null;default:'highlight';check:chk_user_book_annotations_style,style IN ('highlight','underline')"`
	Note           string     `json:"note" gorm:"type:text;not null;default:''"`
	ChapterTitle   string     `json:"chapter_title,omitempty" gorm:"type:varchar(255);not null;default:''"`
}

func (UserBookAnnotation) TableName() string { return "user_book_annotations" }
```

### 2.2 数据库迁移 (`internal/migrations/`)
- 建立 `user_book_annotations` 数据表；
- 创建复合索引 `idx_user_book_annotations_user_asset` (`user_id`, `asset_id`, `created_at DESC`)；
- 创建索引 `idx_user_book_annotations_user_created` (`user_id`, `created_at DESC`)。

### 2.3 HTTP 路由与端点 (`internal/modules/books/`)

1. **`GET /api/v1/books/notes`**
   - 查询当前用户跨书所有笔记与划线；
   - Query 参数：
     - `q`: 搜索正文或笔记文本；
     - `asset_id`: 过滤单本电子书；
     - `has_note`: 布尔值，是否只看带随手想法的划线；
     - `color`: 过滤高亮色彩；
     - `limit`: 分页大小（默认 20，最大 100）；
     - `offset`: 偏移量。
   - 返回：`{ items: BookAnnotationDTO[], total: number }`，其中每项附带所属图书标题 `book_title` 与作者 `book_author`。

2. **`GET /api/v1/books/assets/:assetId/annotations`**
   - 获取指定电子书资源的所有划线批注；
   - 返回按正文阅读顺序（页码或偏移量）排列的划线列表。

3. **`POST /api/v1/books/assets/:assetId/annotations`**
   - 新建一条划线或添加想法；
   - 请求体包含定位信息（CFI / Page / Offset）、高亮文本、色彩、样式及笔记内容。

4. **`PUT /api/v1/books/annotations/:annotationId`**
   - 更新指定划线批注（修改 note 内容、调整 color 色彩、切换 highlight / underline 样式）。

5. **`DELETE /api/v1/books/annotations/:annotationId`**
   - 删除指定划线批注。

---

## 3. 前端交互与组件规范 (`Atoman-Frontend`)

### 3.1 选中文本浮动操作条 (`BookSelectionToolbar.vue`)

- **触发条件**：在阅读器内容视口选中文字并松开鼠标/手指时，若选中文本有效且长度大于 0，定位在选区矩形边缘上方/下方；
- **视觉规格**：
  - 背景：`var(--a-color-bg)` 纯白；
  - 边框：`1px solid var(--a-color-border-soft)`；
  - 圆角：`var(--a-radius-card)` (4px)；
  - 阴影：`var(--a-shadow-dropdown)`；
  - 排版与操作项（横向一排）：
    1. **四色高亮圆角方块**：黄色、绿色、蓝色、粉色（尺寸 18x18px，4px 圆角，活动态外层有 1px 强调边线）；
    2. **下划线切换按键**：`Underline` 图标，点击后切换为下划线样式；
    3. **添加想法按键**：`MessageSquarePlus` 图标与“想法”文案，展开内嵌微型输入气泡（包含简洁多行输入区与保存/取消按钮）；
    4. **复制引用按键**：`Copy` 图标，格式化复制为标准引用文本；
    5. **删除按键**（编辑已有划线态下出现）：`Trash2` 图标，移除当前划线。

### 3.2 多格式阅读器渲染与定位 (`BookReaderView.vue`)

1. **EPUB 格式**：
   - 监听 `epubRendition.on('selected', (cfiRange, contents) => { ... })`；
   - 划线生效后调用 `epubRendition.annotations.add('highlight', cfiRange, {}, (e) => { ... }, 'book-highlight book-highlight--' + color)`；
   - 页面加载时自动重放所有已有 annotations。
2. **TXT 格式**：
   - 监听 `selectionchange` 与 `mouseup`，计算纯文本字符 offset；
   - 在对应页面 DOM 范围内渲染 `<mark class="book-highlight book-highlight--{color}">` 并在点击 mark 时弹出划线编辑气泡。
3. **PDF 格式**：
   - 监听 PDF.js 文本选择层事件，记录页码及文字；
   - 页面渲染完毕时在 TextLayer 上叠加高亮标记。

### 3.3 阅读器侧栏第 4 标签页 (`BookReaderSidebar.vue`)

- 新增 `annotations` 标签页（与缩略图、大纲、书签并列，显示数量徽标）；
- 列表渲染当前书目全部划线卡片：
  - 顶部搜索过滤条与色彩过滤单选点；
  - 每条划线显示摘录文字（最多 3 行省略）、附加想法气泡、定位章节/页码及时间；
  - 点击卡片跳转至原书位置并闪烁正文；
  - 快捷修改笔记或删除划线；
  - 底部“导出本书划线为 Markdown”按钮。

### 3.4 专有笔记中心页面 (`/books/notes` -> `BookNotesView.vue`)

- 路由由 `BooksHomeView.vue` 独立为专用组件 `BookNotesView.vue`；
- 界面布局：
  - **头部工具栏**：
    - 全文搜索框（实时模糊检索划线摘录与想法）；
    - 图书筛选下拉框（选择全部图书或特定藏书）；
    - 仅看有想法开关；
    - “批量导出 Markdown”按钮。
  - **笔记卡片流**：
    - 纯白双凹槽卡片（`var(--a-color-bg)`，`1px solid var(--a-color-border-soft)`）；
    - 左侧色彩指示条（标识划线属性）；
    - 正文引文字段（引用格式排版）；
    - 随手想法字段（淡色底块，`var(--a-color-surface-muted)`，4px 圆角）；
    - 底部元信息行：所属图书封面缩略图、书名、章节/页码、创建日期；
    - 动作按钮：`阅读原文`（跳转到 `/books/read/:assetId?annotationId=...`）、`复制引用`、`编辑`、`删除`。

---

## 4. 验收与质量标准

1. **样式与规范校验**：
   - 0 design system violations：禁止裸写 RGB/HEX 色彩、禁止使用 `var(--a-color-surface)` 替代纯白背景、禁止 999px 胶囊圆角、字重严格保持在 500（正文/标题）与 600（高亮/强调）。
2. **测试覆盖**：
   - 后端：Go 单元测试与端点集成测试通过（`go test ./...`）；
   - 前端：新增 `BookSelectionToolbar.spec.ts`、`BookNotesView.spec.ts` 单元测试，所有单元测试与类型检查 100% 通过（`bun run type-check && bun run test:unit`）。
