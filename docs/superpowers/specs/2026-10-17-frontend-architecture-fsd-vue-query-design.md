# 前端整体架构重构设计规范（FSD 领域化与 TanStack Vue Query 集成）

## 一、概述与背景

Atoman 前端（`Atoman-Frontend`）当前代码量达 17.4 万行，拥有 468 个单测文件及 660+ 视图测试用例，覆盖博客、书籍、音乐、播客、视频、论坛、辩题、私信、Studio 等 19 个业务大模块。当前工程采用 Vue 3.4 + Vite 6 + TypeScript 5.8 (Strict) + Pinia 2.1 + Tailwind CSS v4。

### 当前核心架构瓶颈
1. **平铺膨胀与伪解耦（Flat Monolith）**：`src/views/`、`src/components/`、`src/stores/`、`src/composables/` 在 `src/` 根目录下一字排开。一个业务模块（如 Blog 或 Music）的代码散落在 5~6 个顶层目录中，跨层引用错综复杂。
2. **巨石文件难以维护**：`src/types.ts` 单文件高达 34.7KB（近千行复合接口定义），`src/style.css` 达 35.9KB（混合重置、Token、z-index 与各页面补丁）。
3. **数据流与异步状态杂乱**：缺乏专业服务端状态缓存层，大量组件手写 `loading` / `error`、手动轮询与拉取，部分 Store（如 `player.ts` 42KB）过度臃肿。

### 重构愿景
保持当前经过实战检验的高性能技术底座（**Vue 3.5+ + Vite 6 + TypeScript Strict**）不变，通过**渐进式领域化重构**，引入 **Feature-Sliced Design (FSD)** 分层模型与 **`@tanstack/vue-query`** 现代异步数据流治理，优先以 **Blog（博客）模块** 打样试点，实现高内聚低耦合、强类型契约、零破坏性迁移。

---

## 二、架构原则与 FSD 分层体系

遵循 Feature-Sliced Design 严格的单向依赖规则：
**`app` ➔ `pages` ➔ `widgets` ➔ `features` ➔ `entities` ➔ `shared`**

> [!IMPORTANT]
> - **单向向下依赖**：上层可以依赖下层，下层严禁反向导入上层。
> - **同层横向隔离**：同级切片（如 `entities/post` 与 `entities/user`）之间禁止直接交叉引用，必须通过上层（`features` 或 `widgets`）组合装配。

### 目录分层职责

```text
src/
├── app/                  # [全局层] 全局 Provider、顶层路由入口、全局样式汇聚
│   ├── providers/        # QueryClientProvider, ToastProvider 等顶层挂载点
│   ├── styles/           # 汇聚各 shared/tokens 的样式入口 (index.css)
│   └── App.vue           # 顶层 App 挂载组件
├── pages/                # [路由装配层] 极薄页面容器，仅负责解析路由参数、组织页面骨架并装配 widgets
│   ├── blog/             # Blog 路由页面（BlogHomePage, PostDetailPage, PostEditorPage）
│   └── ...
├── widgets/              # [复合组件层] 业务级功能看板，由多个 entities 与 features 组合而成
│   ├── blog/             # BlogPostReader, BlogSidebarRecommendation, BlogEditorWorkspace
│   ├── player/           # GlobalAudioPlayerBar, MusicLyricsSheet
│   └── navigation/       # AppSidebar, Topbar
├── features/             # [用户交互用例层] 具体的业务操作用例与变更（Mutation）
│   ├── post-like/        # 文章点赞交互与 useLikePostMutation
│   ├── post-bookmark/    # 文章收藏交互与 useBookmarkPostMutation
│   ├── post-publish/     # 文章发布/保存交互
│   └── ...
├── entities/             # [领域实体层] 业务实体数据模型、Query 缓存 Hooks 与原子展示元原件
│   ├── post/
│   │   ├── api/          # Post 专属 API 查询定义（getPostById, listPosts）
│   │   ├── model/        # Post TypeScript 接口模型（从 35KB types.ts 抽离）
│   │   ├── queries/      # usePostQuery, usePostListQuery, postKeys 工厂
│   │   └── ui/           # PostCard.vue, PostMetaEyebrow.vue（无复杂交互的只读实体展示）
│   ├── user/
│   └── comment/
└── shared/               # [共享基建层] 完全不依赖任何业务领域的通用基础设施
    ├── ui/               # 标准 Design System 原子组件（PButton, PSheet, PModal, PPageHeader 等 50+ 组件）
    ├── api/              # HTTP 客户端配置、统一拦截器、基础通用响应泛型 (ApiResponse<T>)
    ├── tokens/           # 模块化设计 Token（variables.css, layers.css, reset.css）
    └── utils/            # 纯函数工具库（时间格式化、文本截断、防抖节流）
```

---

## 三、巨石文件拆解规划

### 1. 拆解 `src/types.ts` (34.7 KB)
- **领域下沉**：属于具体业务实体的类型直接迁入对应 `entities/<domain>/model/types.ts`（例如 `Post`、`PostSummary` 迁入 `entities/post/model/types.ts`）；
- **通用共享**：基础分页参数（`PaginationParams`）、通用分页返回结构（`PaginatedResponse<T>`）、用户信息轻量摘要（`UserRef`）迁入 `shared/api/types.ts`；
- **向下兼容过渡期**：在原 `src/types.ts` 中通过统一 re-export 桥接未重构模块，避免全局类型断裂。

### 2. 模块化 `src/style.css` (35.9 KB)
将全局样式拆分为单一职责的子模块：
- `shared/tokens/reset.css`：基础 HTML 重置与 box-sizing 规范；
- `shared/tokens/variables.css`：核心设计变量（字体、主色、纸张背景、边框颜色、双栏宽度契约 `--a-recommendation-width`、`--a-comment-sheet-width`）；
- `shared/tokens/layers.css`：严格层级 z-index 字典（从 `40 dropdown` 到 `950 global menu`）；
- `app/styles/index.css`：入口汇聚文件，按顺序导入上述模块与 Tailwind v4。

---

## 四、数据流与 TanStack Vue Query 集成设计

### 1. 职责边界划分（Server State vs Client State）

- **服务端状态（`@tanstack/vue-query`）**：
  - 负责：文章详情、文章列表、评论树、用户公开档案、各类详情数据的拉取、声明式缓存与重新验证；
  - 拥有特性：Stale-While-Revalidate（默认 5 分钟新鲜度）、窗口聚焦刷新、分页无缝拼接（`useInfiniteQuery`）、乐观更新（Optimistic Updates）。
- **客户端瞬时状态（`Pinia`）**：
  - 负责：侧边栏折叠/展开、全局音频播放器实例（Web Audio API、播放队列索引、当前进度）、模态框/抽屉未绑定 URL 时的临时状态、未读消息高亮。

### 2. Query Key 集中工厂化

所有 Query Key 必须在对应 `entities/<domain>/queries/<domain>Keys.ts` 中定义，禁止字符串拼接：
```typescript
export const postKeys = {
  all: ['posts'] as const,
  lists: () => [...postKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...postKeys.lists(), filters] as const,
  details: () => [...postKeys.all, 'detail'] as const,
  detail: (id: string | number) => [...postKeys.details(), String(id)] as const,
}
```

### 3. 标准实体查询 Hook
```typescript
export function usePostQuery(id: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => postKeys.detail(toValue(id))),
    queryFn: () => getPostById(toValue(id)),
    staleTime: 1000 * 60 * 5,
    enabled: computed(() => Boolean(toValue(id))),
  })
}
```

### 4. 交互 Mutation 与乐观更新
在 `features/` 中封装 Mutation，利用 `onMutate` 立即推入乐观值，在 `onError` 中利用回滚上下文恢复原状态，并在 `onSettled` 中执行 `queryClient.invalidateQueries` 重新验证。

---

## 五、Blog 模块试点映射方案

选择 Blog 模块作为打样试点：

```text
src/
├── entities/post/
│   ├── api/postApi.ts            # getPostById, fetchPostList, fetchRecommendations
│   ├── model/types.ts            # Post, PostDTO, PostMetadata, PostCitation
│   ├── queries/
│   │   ├── postKeys.ts           # postKeys 对象工厂
│   │   ├── usePostQuery.ts       # 文章详情 Query
│   │   └── usePostListQuery.ts   # 文章列表与分类 Query
│   └── ui/
│       ├── PostCard.vue          # 文章信息流卡片
│       └── PostMetaEyebrow.vue   # 学术纸张风格眉标（.article-eyebrow）
├── features/blog/
│   ├── post-like/                # useLikePostMutation + LikeButton.vue
│   ├── post-bookmark/            # useBookmarkPostMutation + BookmarkButton.vue
│   └── post-stage-quote/         # 从书籍暂存箱引用金句注入编辑器
├── widgets/blog/
│   ├── BlogPostReader.vue        # 统一阅读容器（眉标/标题/操作条/下沉封面/A4版心）
│   ├── BlogSidebarRecommendation.vue # 20rem 统一宽度标准推荐栏
│   └── PostEditorWorkspace.vue   # CodeMirror 6 + Marked + 暂存箱协同工作区
└── pages/blog/
    ├── BlogHomePage.vue          # 对应当前 BlogHomeView.vue
    ├── PostDetailPage.vue        # 对应当前 PostDetailRouteView.vue
    └── PostEditorPage.vue        # 对应当前 PostEditorView.vue
```

---

## 六、全量测试兼容与平滑迁移保障

### 1. 测试隔离环境（`tests/unit/helpers/queryClient.ts`）
在每个单测中，通过自定义辅助函数隔离 QueryClient 状态：
```typescript
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  })
}
```
在测试运行（happy-dom / jsdom）时，使用 `provide: { [VUE_QUERY_CLIENT]: createTestQueryClient() }`，保证用例之间无状态串扰。

### 2. 源码守卫契约兼容
- 遵守 `.claude/rules/testing.md`：
  - 保留 `tests/unit/views/blog/PostEditorView.layout.spec.ts` 所依赖的 `.a-content-frame > .editor-page` 样式契约；
  - 旧路径文件（`src/views/blog/PostDetailRouteView.vue` 等）在重构期间作为别名代理层（re-export wrapper），确保既有单测 100% 绿色通过。

---

## 七、实施阶段与推进路线图

### Phase 1：基建底座就绪（P0·非侵入式）
1. 安装并接入 `@tanstack/vue-query`，在 `src/main.ts` 注册 `VueQueryPlugin`；
2. 搭建 `src/shared/tokens/` 模块化样式体系（`reset.css`、`variables.css`、`layers.css`），将 `src/style.css` 收敛为模块化入口；
3. 将 `src/components/ui/` 中的原子组件建立标准规范导出层。
4. **验证门禁**：`bun run type-check`、`bun run test:unit` 全部通过，零构建报错。

### Phase 2：Blog 模块领域化重塑与打样（P1·高价值试点）
1. 建立 `src/entities/post/`，拆离迁移类型与基础 API；
2. 实现 `usePostQuery` 与 `usePostListQuery`，迁移 BlogPostReader 与 BlogHome 数据拉取；
3. 抽离交互用例至 `src/features/blog/`，装配 `src/widgets/blog/` 与 `src/pages/blog/`；
4. 旧路径别名重定向适配，验证 Blog 模块全部单测 100% 通过。
5. **验证门禁**：Blog 全部 20+ 个单测通过，全量 95 个视图测试套件全绿，打包产物体积无异常。

### Phase 3：全局领域化推广与架构收敛（P2·长期演进）
1. 逐一将 Books、Music、Debate、Feed 等模块按此规范逐步迁移；
2. 逐步淘汰旧有平铺目录与中间桥接层；
3. 完成巨石 `types.ts` 的最终清空下线。
