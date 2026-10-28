# 全站骨架屏与空状态标准化收网设计规范

## 1. 目标与背景

在经历了对话框（Modal）、轻提示（Toast）、路由空间契约（Route Spatial Governance）与通知系统的系统化治理后，全站已确立了严格的现代扁平线框与 0 阴影视觉体系。
然而，在数据加载（Loading）与空列表（Empty）场景中，部分核心消费流（书籍、通知/私信、搜索、博客动态、音乐抽屉）仍散落着手写的原始纯文本提示、粗糙的 CSS spinner 或内部调试视角词汇（如“暂无数据”、“System”、“正在加载中...”等，违反了 `AGENTS.md` 的简洁用户态文案规范）。

本规范的目标是：
1. 完善与提炼标准骨架组件 `PSkeleton` / `PSkeletonCard`，统一全站加载占位视觉节奏；
2. 规范核心业务消费流的空状态组件 `PEmpty`，消除开发者视角词汇，建立清晰的用户态行动引导；
3. 严格遵循 0 阴影（`box-shadow: none !important;`）与 4px 圆角规范，绝不改动用户精心特调的桌面端顶栏交互（`AppTopbarAuthControls.vue`）；
4. 建立自动化契约测试，守护全站空状态文案与骨架屏规范。

---

## 2. 基础组件规范设计

### 2.1 `PSkeleton` 与 `PSkeletonCard` 规范

- **`PSkeleton.vue`**（基础几何骨架）：
  - 保留现有 API 100% 向后兼容：`variant` (`rect` | `text` | `circle`)、`width`、`height`、`animated`、`bordered`；
  - 样式使用 `var(--a-color-surface-muted)` 柔和背景配合 linear-gradient shimmer 微光流动；
  - 遵循 0 阴影与 `var(--a-radius-card, 4px)`。
- **`PSkeletonCard.vue`**（预置卡片骨架）：
  - 专为书籍封面、音乐专辑、博文卡片、榜单卡片设计；
  - Props:
    - `aspect?: '3/4' | '1/1' | '16/9' | 'auto'`（默认 `'3/4'`，适配书籍封面）；
    - `lines?: number`（文本行骨架数量，默认 2 行）；
    - `bordered?: boolean`（默认 `false`）；
  - 结构：顶部封面矩形骨架 + 底部标题与副标题文本骨架。

### 2.2 `PEmpty` 规范与文案净化

- **`PEmpty.vue`**：
  - 支持 `title`、`description`、`icon`（插槽）、`action`（插槽）、`align` (`start` | `center`)、`compact`；
  - 清理默认隐式 kicker 残留（默认设为空字符串 `""`，仅在显式传入非空字符串时展示）；
  - 样式严格维持扁平无外边框设计，由父级容器自然包裹，文字颜色采用 `var(--a-color-text)`（标题）与 `var(--a-color-text-secondary)`（说明）。
- **文案规范（严格对齐 `AGENTS.md`）**：
  - ❌ 禁止词汇：“暂无数据”、“System”、“加载中...”、“无记录”、“网络异常请重试”；
  - ✅ 规范用词：
    - 书籍榜单：“未找到相关书籍”，“尝试调整分类或关键词”；
    - 书单列表：“还没有书单”，“创建一份书单开始整理藏书”；
    - 读书笔记：“尚未记录笔记”，“在阅读过程中选中文本即可添加笔记与想法”；
    - 收件箱通知：“收件箱暂无通知”，“新收到的互动与系统更新将显示在这里”；
    - 私信未选择会话：“未选择会话”，“从左侧列表中选择联系人开始交流”；
    - 搜索无结果：“未找到匹配结果”，“请检查关键词拼写或尝试其他搜索词”；
    - 音乐曲目：“曲目库为空”，“尚未添加音频曲目”。

---

## 3. 五大核心消费流落地改造明细

### 3.1 书籍流 (Books)
- **`src/views/books/BooksDiscoverView.vue`**:
  - 榜单与分类在加载时使用 `<div class="grid grid-cols-..."><PSkeletonCard v-for="i in 8" :key="i" aspect="3/4" /></div>`；
  - 替换原有的 `<p class="book-catalog__empty-hint">暂无满足门槛的图书。</p>` 为 `<PEmpty title="未找到相关书籍" description="尝试更换分类或调整筛选条件" />`。
- **`src/views/books/BookListsView.vue`**:
  - 替换 `<p class="booklists__empty">` 为 `<PEmpty :title="activeTab === 'mine' ? '还没有书单' : '没有找到公开书单'" :description="activeTab === 'mine' ? '创建一份书单开始整理藏书。' : '试试其他关键词或创建一份。'" />` 并提供创建书单行动按钮插槽。
- **`src/views/books/BookNotesView.vue`**:
  - 替换 `<p class="books-notes-empty">` 为 `<PEmpty title="尚未记录笔记" description="在阅读过程中选中文本即可添加笔记与想法" />`。

### 3.2 收件箱与私信 (Inbox & Messages)
- **`src/views/feed/InboxPage.vue`**:
  - 加载时呈现卡片骨架列表；
  - 替换 `.inbox-empty-state`，使用 `<PEmpty title="收件箱暂无通知" description="新收到的互动与系统更新将显示在这里" />`。
- **`src/views/messages/MessagesWorkspaceView.vue`**:
  - 替换右侧原始占位 `.dm-empty-placeholder`，使用语义化 `<PEmpty title="未选择会话" description="从左侧列表中选择联系人开始交流" />`。

### 3.3 全局搜索 (Search)
- **`src/views/search/SearchResultsView.vue`**:
  - 搜索进行时，渲染对应 Tab 的骨架占位流；
  - 替换 `.search-state-message.is-empty`，使用 `<PEmpty title="未找到匹配结果" description="请检查关键词拼写或尝试其他搜索词" />`。

### 3.4 博客动态 (Blog & Feed)
- **`src/views/timeline/TimelineHomeView.vue`**:
  - 替换 `.tl-panel-empty` 与粗糙文字，使用统一的 `<PEmpty title="还没有动态" description="关注创作者或去发现广场探索精彩内容" />`。

### 3.5 音乐档案库 (Music)
- **`src/components/music/AlbumDrawer.vue` & `PlaylistDrawer.vue`**:
  - 替换 `.track-empty` 为 `<PEmpty compact title="曲目库为空" description="尚未添加音频曲目" />`。

---

## 4. 自动化契约测试与质量守护

1. **`tests/unit/components/PSkeletonCard.spec.ts`**:
   - 验证 `PSkeletonCard` 渲染与纵横比属性（`3/4`、`1/1`、`16/9`）；
   - 验证文本行骨架数量控制（`lines` prop）。
2. **`tests/unit/ui/skeleton-empty-contract.spec.ts`**:
   - 扫描上述 5 大重点模块的 Vue 文件，断言不再含有“暂无数据”、“System”等开发视角词汇；
   - 断言相关视图均已规范导入并使用 `PEmpty` 或 `PSkeleton`。
3. **回归验证**:
   - `bun run type-check` (0 Errors)
   - `bun run test:unit` (100% Pass)
   - `bun run build && bun run build:mobile` (0 Errors)
