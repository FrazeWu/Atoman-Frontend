# 前端整体架构重构实施计划（FSD 领域化与 TanStack Vue Query）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地 Feature-Sliced Design (FSD) 架构分层规范，接入 `@tanstack/vue-query` 统一治理服务端异步数据流，模块化拆解 `style.css` 与 `types.ts`，并以 Blog（博客）模块完成首个领域化打样试点，保持 468 个单测套件 100% 绿色通过。

**Architecture:** 严格遵循单向依赖规则 `app` ➔ `pages` ➔ `widgets` ➔ `features` ➔ `entities` ➔ `shared`。服务端异步状态由 `@tanstack/vue-query` 的 Query Hooks 统一接管，Pinia 仅保留纯客户端瞬时状态。重构期间旧路径通过别名/代理层（re-export wrapper）向后兼容，保证零破裂平滑演进。

**Tech Stack:** Vue 3.4+ / 3.5, Vite 6, TypeScript 5.8 (Strict), `@tanstack/vue-query` v5, Pinia 2.1, Tailwind CSS v4, Vitest 4, Happy-DOM.

## Global Constraints

- **严格 0 阴影**：全局遵循 `box-shadow: none !important;`。
- **严格 4px 圆角**：交互元素与卡片统一遵循 `border-radius: 4px;`。
- **纯白纸张基底**：遵循 `#FFFFFF` 纸张底色与 `1px solid var(--a-color-border-soft)` 发丝线分割。
- **契约测试红线**：严禁破坏 `tests/unit/views/blog/PostEditorView.layout.spec.ts` 依赖的 `.a-content-frame > .editor-page` 样式契约；旧路径必须通过代理层维持现有单测直接可通。
- **门禁验证**：每个任务必须通过该任务对应单测；计划收尾必须全量通过 `bun run type-check`、`bun run test:unit tests/unit/views/blog/` 及 `bun run build`。

---

### Task 1: 安装与配置 `@tanstack/vue-query` 及其测试隔离辅助函数

**Files:**
- Modify: `package.json`
- Create: `src/app/providers/queryClient.ts`
- Modify: `src/main.ts:1-35`
- Create: `tests/unit/helpers/queryClient.ts`
- Test: `tests/unit/system/queryClient.spec.ts`

**Interfaces:**
- Produces: `createQueryClient(): QueryClient` from `src/app/providers/queryClient.ts`
- Produces: `createTestQueryClient(): QueryClient` from `tests/unit/helpers/queryClient.ts`

- [ ] **Step 1: 编写失败的 QueryClient 与 Plugin 规范测试**

创建 `tests/unit/system/queryClient.spec.ts`：

```typescript
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, inject } from 'vue'
import { VUE_QUERY_CLIENT, VueQueryPlugin } from '@tanstack/vue-query'
import { createQueryClient } from '@/app/providers/queryClient'
import { createTestQueryClient } from '../../helpers/queryClient'

describe('QueryClient configuration and plugin', () => {
  it('creates production QueryClient with 5-minute staleTime and standard defaults', () => {
    const client = createQueryClient()
    const defaultQueryOptions = client.getDefaultOptions().queries
    expect(defaultQueryOptions?.staleTime).toBe(1000 * 60 * 5)
    expect(defaultQueryOptions?.refetchOnWindowFocus).toBe(true)
  })

  it('creates isolated test QueryClient with retry disabled and Infinity gcTime', () => {
    const testClient = createTestQueryClient()
    const queryOpts = testClient.getDefaultOptions().queries
    const mutationOpts = testClient.getDefaultOptions().mutations
    expect(queryOpts?.retry).toBe(false)
    expect(queryOpts?.gcTime).toBe(Infinity)
    expect(mutationOpts?.retry).toBe(false)
  })

  it('injects QueryClient correctly through VueQueryPlugin', () => {
    const client = createTestQueryClient()
    const Consumer = defineComponent({
      template: '<div>{{ hasClient }}</div>',
      setup() {
        const injected = inject(VUE_QUERY_CLIENT)
        return { hasClient: Boolean(injected) }
      },
    })

    const wrapper = mount(Consumer, {
      global: {
        plugins: [[VueQueryPlugin, { queryClient: client }]],
      },
    })

    expect(wrapper.text()).toBe('true')
  })
})
```

- [ ] **Step 2: 运行测试验证其失败**

运行：`bun run test:unit tests/unit/system/queryClient.spec.ts`
预期：FAIL，找不到 `@tanstack/vue-query` 或 `@/app/providers/queryClient`。

- [ ] **Step 3: 安装依赖并编写实现代码**

执行安装命令：
```bash
bun add @tanstack/vue-query@^5.66.0
```

创建 `src/app/providers/queryClient.ts`：
```typescript
import { QueryClient } from '@tanstack/vue-query'

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 分钟新鲜度
        gcTime: 1000 * 60 * 30,   // 30 分钟缓存回收
        retry: (failureCount, error: unknown) => {
          // 4xx 客户端异常不自动重试
          if (typeof error === 'object' && error !== null && 'status' in error) {
            const status = Number((error as { status: unknown }).status)
            if (status >= 400 && status < 500) return false
          }
          return failureCount < 2
        },
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: false,
      },
    },
  })
}
```

创建 `tests/unit/helpers/queryClient.ts`：
```typescript
import { QueryClient } from '@tanstack/vue-query'

export function createTestQueryClient(): QueryClient {
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

在 `src/main.ts` 中注册 `VueQueryPlugin`：
```typescript
import { VueQueryPlugin } from '@tanstack/vue-query'
import { createQueryClient } from '@/app/providers/queryClient'

// 在 app.mount 前：
const queryClient = createQueryClient()
app.use(VueQueryPlugin, { queryClient })
```

- [ ] **Step 4: 运行测试验证其通过**

运行：`bun run test:unit tests/unit/system/queryClient.spec.ts`
预期：PASS（3/3 tests pass）。

- [ ] **Step 5: 提交**

```bash
git add package.json bun.lockb src/app/providers/queryClient.ts src/main.ts tests/unit/helpers/queryClient.ts tests/unit/system/queryClient.spec.ts
git commit -m "feat(arch): setup tanstack vue query and test isolation helper"
```

---

### Task 2: 模块化拆分设计 Token 与样式层级（`style.css` 重构）

**Files:**
- Create: `src/shared/tokens/reset.css`
- Create: `src/shared/tokens/variables.css`
- Create: `src/shared/tokens/layers.css`
- Modify: `src/style.css:1-80`
- Test: `tests/unit/system/style-tokens-modular.spec.ts`

**Interfaces:**
- Produces: `src/shared/tokens/*.css` 模块化样式文件
- Consumes: 保留 `src/style.css` 中的全站原有契约类与变量（`--a-recommendation-width`, `--a-comment-sheet-width`, `.editor-page`）

- [ ] **Step 1: 编写样式模块化拆分契约测试**

创建 `tests/unit/system/style-tokens-modular.spec.ts`：

```typescript
import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Style tokens modularization contract', () => {
  const root = resolve(__dirname, '../../../')

  it('provides modular reset, variables, and layers CSS files', () => {
    expect(existsSync(resolve(root, 'src/shared/tokens/reset.css'))).toBe(true)
    expect(existsSync(resolve(root, 'src/shared/tokens/variables.css'))).toBe(true)
    expect(existsSync(resolve(root, 'src/shared/tokens/layers.css'))).toBe(true)
  })

  it('defines standard recommendation and comment sheet tokens in variables.css', () => {
    const vars = readFileSync(resolve(root, 'src/shared/tokens/variables.css'), 'utf-8')
    expect(vars).toContain('--a-recommendation-width')
    expect(vars).toContain('--a-comment-sheet-width')
  })

  it('defines structured z-index layers in layers.css', () => {
    const layers = readFileSync(resolve(root, 'src/shared/tokens/layers.css'), 'utf-8')
    expect(layers).toContain('--a-layer-normal-sheet-backdrop')
    expect(layers).toContain('--a-layer-player')
    expect(layers).toContain('--a-layer-toast')
  })

  it('keeps PostEditorView reset contract intact in style.css for PostEditorView.layout.spec.ts', () => {
    const styleCss = readFileSync(resolve(root, 'src/style.css'), 'utf-8')
    expect(styleCss).toMatch(/\.a-content-frame > \.editor-page[\s\S]*?max-width: none/)
  })
})
```

- [ ] **Step 2: 运行测试验证其失败**

运行：`bun run test:unit tests/unit/system/style-tokens-modular.spec.ts`
预期：FAIL，找不到 `src/shared/tokens/*.css`。

- [ ] **Step 3: 提取并创建模块化 Token 文件**

创建 `src/shared/tokens/reset.css`：
```css
/* ── Reset and Base Box Sizing ─────────────────────────────────────────── */
*, *::before, *::after {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

创建 `src/shared/tokens/variables.css`：
从现存 `src/style.css` 中提取 `:root` 设计变量：
```css
:root {
  --a-recommendation-width: 20rem;
  --a-comment-sheet-width: 42rem;
  --a-content-column-gap: 2rem;
  --a-topbar-height: 56px;
  --a-sidebar-width: 12rem;
  --a-sidebar-collapsed-width: 4.5rem;
  --a-color-bg: #ffffff;
  --a-color-surface: #ffffff;
  --a-color-border-soft: #f0f0f0;
  --a-color-border: #e2e8f0;
  --a-color-text: #1a1a1a;
  --a-color-text-muted: #64748b;
  --a-radius-sm: 4px;
  --a-radius-md: 4px;
  --a-radius-lg: 4px;
}
```

创建 `src/shared/tokens/layers.css`：
从现存 `src/style.css` 提取标准 z-index 体系：
```css
:root {
  --a-layer-dropdown: 40;
  --a-layer-popover: 45;
  --a-layer-nav: 100;
  --a-layer-normal-sheet-backdrop: 300;
  --a-layer-normal-sheet-panel: 310;
  --a-layer-global-overlay: 480;
  --a-layer-normal-modal-backdrop: 500;
  --a-layer-normal-modal-panel: 510;
  --a-layer-player-lyrics: 700;
  --a-layer-player-queue: 710;
  --a-layer-player: 720;
  --a-layer-above-player-sheet-backdrop: 730;
  --a-layer-above-player-sheet-panel: 740;
  --a-layer-above-player-modal-backdrop: 750;
  --a-layer-above-player-modal-panel: 760;
  --a-layer-lightbox: 800;
  --a-layer-toast: 900;
  --a-layer-global-menu: 950;
}
```

在 `src/style.css` 顶部导入这三个文件：
```css
@import './shared/tokens/reset.css';
@import './shared/tokens/variables.css';
@import './shared/tokens/layers.css';
```
确保保留现有的 `.a-content-frame > .editor-page` 等契约样式不变。

- [ ] **Step 4: 运行测试并验证现有布局契约测试**

运行：
```bash
bun run test:unit tests/unit/system/style-tokens-modular.spec.ts
bun run test:unit tests/unit/views/blog/PostEditorView.layout.spec.ts
```
预期：全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add src/shared/tokens/ src/style.css tests/unit/system/style-tokens-modular.spec.ts
git commit -m "refactor(style): modularize design tokens, layers, and reset rules"
```

---

### Task 3: 建立 `src/shared/ui/` 原子组件标准导出桶

**Files:**
- Create: `src/shared/ui/index.ts`
- Test: `tests/unit/system/shared-ui-barrel.spec.ts`

**Interfaces:**
- Produces: `PButton`, `PSheet`, `PModal`, `PPageHeader`, `PToast`, `PCard` 等自 `src/shared/ui` 导出

- [ ] **Step 1: 编写 shared/ui 导出测试**

创建 `tests/unit/system/shared-ui-barrel.spec.ts`：
```typescript
import { describe, expect, it } from 'vitest'
import * as SharedUI from '@/shared/ui'

describe('Shared UI Barrel Exports', () => {
  it('exports standard design system components', () => {
    expect(SharedUI.PButton).toBeDefined()
    expect(SharedUI.PSheet).toBeDefined()
    expect(SharedUI.PModal).toBeDefined()
    expect(SharedUI.PPageHeader).toBeDefined()
    expect(SharedUI.PToast).toBeDefined()
    expect(SharedUI.PCard).toBeDefined()
  })
})
```

- [ ] **Step 2: 运行测试验证其失败**

运行：`bun run test:unit tests/unit/system/shared-ui-barrel.spec.ts`
预期：FAIL，找不到 `@/shared/ui`。

- [ ] **Step 3: 编写 `src/shared/ui/index.ts` 导出**

创建 `src/shared/ui/index.ts`：
```typescript
export { default as PButton } from '@/components/ui/PButton.vue'
export { default as PSheet } from '@/components/ui/PSheet.vue'
export { default as PModal } from '@/components/ui/PModal.vue'
export { default as PPageHeader } from '@/components/ui/PPageHeader.vue'
export { default as PToast } from '@/components/ui/PToast.vue'
export { default as PCard } from '@/components/ui/PCard.vue'
export { default as PAvatar } from '@/components/ui/PAvatar.vue'
export { default as PBadge } from '@/components/ui/PBadge.vue'
export { default as PInput } from '@/components/ui/PInput.vue'
export { default as PEmpty } from '@/components/ui/PEmpty.vue'
export { default as PSkeleton } from '@/components/ui/PSkeleton.vue'
```

- [ ] **Step 4: 运行测试验证其通过**

运行：`bun run test:unit tests/unit/system/shared-ui-barrel.spec.ts`
预期：PASS（1/1 test passes）。

- [ ] **Step 5: 提交**

```bash
git add src/shared/ui/index.ts tests/unit/system/shared-ui-barrel.spec.ts
git commit -m "feat(ui): create shared ui design system export barrel"
```

---

### Task 4: 建立 `src/entities/post/`（模型类型、API 抽象与 Vue Query Hooks）

**Files:**
- Create: `src/entities/post/model/types.ts`
- Modify: `src/types.ts:1-30`
- Create: `src/entities/post/api/postApi.ts`
- Create: `src/entities/post/queries/postKeys.ts`
- Create: `src/entities/post/queries/usePostQuery.ts`
- Create: `src/entities/post/queries/usePostListQuery.ts`
- Create: `src/entities/post/index.ts`
- Test: `tests/unit/entities/post/postQueries.spec.ts`

**Interfaces:**
- Produces: `postKeys`, `usePostQuery`, `usePostListQuery`, `getPostById`, `fetchPostList`
- Produces: `Post`, `PostSummary`, `PostCategory`, `PostTag` from `src/entities/post/model/types.ts`

- [ ] **Step 1: 编写 post entity 查询与 Key 工厂测试**

创建 `tests/unit/entities/post/postQueries.spec.ts`：
```typescript
import { describe, expect, it, vi } from 'vitest'
import { postKeys } from '@/entities/post/queries/postKeys'
import { usePostQuery } from '@/entities/post/queries/usePostQuery'
import { createTestQueryClient } from '../../../helpers/queryClient'
import { VUE_QUERY_CLIENT } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { defineComponent, toRef } from 'vue'
import * as postApi from '@/entities/post/api/postApi'

describe('postKeys factory', () => {
  it('generates consistent hierarchical query keys', () => {
    expect(postKeys.all).toEqual(['posts'])
    expect(postKeys.lists()).toEqual(['posts', 'list'])
    expect(postKeys.list({ category: 'tech' })).toEqual(['posts', 'list', { category: 'tech' }])
    expect(postKeys.details()).toEqual(['posts', 'detail'])
    expect(postKeys.detail('post-123')).toEqual(['posts', 'detail', 'post-123'])
  })
})

describe('usePostQuery', () => {
  it('fetches post detail through postApi', async () => {
    const mockPost = {
      id: 123,
      slug: 'hello-world',
      title: 'Hello World',
      content: 'Content here',
      visibility: 'public',
      createdAt: '2026-10-17T00:00:00Z',
    }
    vi.spyOn(postApi, 'getPostById').mockResolvedValue(mockPost as any)

    const client = createTestQueryClient()
    const TestComponent = defineComponent({
      props: { postId: { type: String, required: true } },
      setup(props) {
        const query = usePostQuery(toRef(props, 'postId'))
        return { query }
      },
      template: '<div><span v-if="query.data.value">{{ query.data.value.title }}</span></div>',
    })

    const wrapper = mount(TestComponent, {
      props: { postId: '123' },
      global: {
        provide: {
          [VUE_QUERY_CLIENT]: client,
        },
      },
    })

    // 等待异步查询执行
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Hello World')
    })
  })
})
```

- [ ] **Step 2: 运行测试验证其失败**

运行：`bun run test:unit tests/unit/entities/post/postQueries.spec.ts`
预期：FAIL，找不到 `@/entities/post/*`。

- [ ] **Step 3: 实现 Post Entity 类型、API 与 Query Hooks**

创建 `src/entities/post/model/types.ts`：
```typescript
export interface PostCategory {
  id: number
  name: string
  slug: string
}

export interface PostTag {
  id: number
  name: string
  slug: string
}

export interface PostCitation {
  id: string
  quote: string
  bookTitle?: string
  author?: string
  sourceUrl?: string
}

export interface Post {
  id: number
  slug: string
  title: string
  content: string
  summary?: string
  coverImage?: string
  visibility: 'public' | 'unlisted' | 'private'
  category?: PostCategory
  tags?: PostTag[]
  citations?: PostCitation[]
  likesCount: number
  bookmarksCount: number
  liked?: boolean
  bookmarked?: boolean
  createdAt: string
  updatedAt?: string
  author?: {
    id: number
    username: string
    nickname?: string
    avatar?: string
  }
}

export interface PostListFilter {
  category?: string
  tag?: string
  authorId?: number
  page?: number
  limit?: number
}
```

在 `src/types.ts` 顶部 re-export 这些类型，保证旧代码引用不失效：
```typescript
export type { Post, PostCategory, PostTag, PostCitation, PostListFilter } from '@/entities/post/model/types'
```

创建 `src/entities/post/api/postApi.ts`：
```typescript
import { apiRequest } from '@/api/client'
import type { Post, PostListFilter } from '../model/types'

export async function getPostById(idOrSlug: string): Promise<Post> {
  const res = await apiRequest<Post>(`/api/v1/posts/${encodeURIComponent(idOrSlug)}`)
  return res
}

export async function fetchPostList(filters?: PostListFilter): Promise<{ posts: Post[]; total: number }> {
  const query = new URLSearchParams()
  if (filters?.category) query.set('category', filters.category)
  if (filters?.tag) query.set('tag', filters.tag)
  if (filters?.page) query.set('page', String(filters.page))
  if (filters?.limit) query.set('limit', String(filters.limit))
  const qs = query.toString() ? `?${query.toString()}` : ''
  return apiRequest<{ posts: Post[]; total: number }>(`/api/v1/posts${qs}`)
}
```

创建 `src/entities/post/queries/postKeys.ts`：
```typescript
import type { PostListFilter } from '../model/types'

export const postKeys = {
  all: ['posts'] as const,
  lists: () => [...postKeys.all, 'list'] as const,
  list: (filters?: PostListFilter) => [...postKeys.lists(), filters ?? {}] as const,
  details: () => [...postKeys.all, 'detail'] as const,
  detail: (idOrSlug: string | number) => [...postKeys.details(), String(idOrSlug)] as const,
}
```

创建 `src/entities/post/queries/usePostQuery.ts`：
```typescript
import { useQuery } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { getPostById } from '../api/postApi'
import { postKeys } from './postKeys'

export function usePostQuery(idOrSlug: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => postKeys.detail(toValue(idOrSlug))),
    queryFn: () => getPostById(toValue(idOrSlug)),
    staleTime: 1000 * 60 * 5,
    enabled: computed(() => Boolean(toValue(idOrSlug))),
  })
}
```

创建 `src/entities/post/queries/usePostListQuery.ts`：
```typescript
import { useQuery } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { fetchPostList } from '../api/postApi'
import { postKeys } from './postKeys'
import type { PostListFilter } from '../model/types'

export function usePostListQuery(filters?: MaybeRefOrGetter<PostListFilter | undefined>) {
  return useQuery({
    queryKey: computed(() => postKeys.list(toValue(filters))),
    queryFn: () => fetchPostList(toValue(filters)),
    staleTime: 1000 * 60 * 2,
  })
}
```

创建 `src/entities/post/index.ts`：
```typescript
export * from './model/types'
export * from './api/postApi'
export * from './queries/postKeys'
export * from './queries/usePostQuery'
export * from './queries/usePostListQuery'
```

- [ ] **Step 4: 运行测试验证其通过**

运行：`bun run test:unit tests/unit/entities/post/postQueries.spec.ts`
预期：PASS（2/2 tests pass）。

- [ ] **Step 5: 提交**

```bash
git add src/entities/post/ src/types.ts tests/unit/entities/post/postQueries.spec.ts
git commit -m "feat(entities): create post entity with types, api, and vue-query hooks"
```

---

### Task 5: 建立 `pages/blog` 路由层并平滑桥接现有视图

**Files:**
- Create: `src/pages/blog/PostDetailPage.vue`
- Create: `src/pages/blog/BlogHomePage.vue`
- Modify: `src/views/blog/PostDetailRouteView.vue:1-30`
- Modify: `src/views/blog/BlogHomeView.vue:1-30`
- Test: `tests/unit/views/blog/PostDetailRouteView.spec.ts`
- Test: `tests/unit/views/blog/BlogHomeView.spec.ts`

**Interfaces:**
- Produces: `src/pages/blog/PostDetailPage.vue`, `src/pages/blog/BlogHomePage.vue`
- Consumes: `usePostQuery` from `src/entities/post`, `BlogPostReader` from `src/components/blog/BlogPostReader.vue`

- [ ] **Step 1: 检查现有 Blog 视图测试**

运行：`bun run test:unit tests/unit/views/blog/BlogHomeView.spec.ts`
预期：PASS（现有 11 个测试通过）。

- [ ] **Step 2: 创建 `src/pages/blog/PostDetailPage.vue`**

创建 `src/pages/blog/PostDetailPage.vue`：
```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { usePostQuery } from '@/entities/post'
import BlogPostReader from '@/components/blog/BlogPostReader.vue'
import { PSkeleton, PEmpty } from '@/shared/ui'

const route = useRoute()
const postSlugOrId = computed(() => (route.params.slugOrId as string) || (route.params.id as string) || '')

const { data: post, isLoading, error, refetch } = usePostQuery(postSlugOrId)
</script>

<template>
  <div class="post-detail-page">
    <div v-if="isLoading" class="post-detail-page__loading" style="padding: 2rem;">
      <PSkeleton style="height: 2.5rem; width: 60%; margin-bottom: 1.5rem;" />
      <PSkeleton style="height: 1.25rem; width: 40%; margin-bottom: 2rem;" />
      <PSkeleton style="height: 12rem; width: 100%;" />
    </div>
    <div v-else-if="error" class="post-detail-page__error" style="padding: 3rem 1rem;">
      <PEmpty title="文章加载失败" :description="error.message">
        <template #action>
          <button class="a-button" @click="() => refetch()">重新加载</button>
        </template>
      </PEmpty>
    </div>
    <BlogPostReader v-else-if="post" :post="post" />
  </div>
</template>

<style scoped>
.post-detail-page {
  width: 100%;
  min-width: 0;
}
</style>
```

- [ ] **Step 3: 将 `src/views/blog/PostDetailRouteView.vue` 桥接代理至 `pages/blog`**

修改 `src/views/blog/PostDetailRouteView.vue`，作为兼容性代理层直接使用/导出 `PostDetailPage.vue`：
```vue
<script setup lang="ts">
import PostDetailPage from '@/pages/blog/PostDetailPage.vue'
</script>

<template>
  <PostDetailPage />
</template>
```

- [ ] **Step 4: 运行现有所有 Blog 视图单测验证兼容性**

运行：
```bash
bun run test:unit tests/unit/views/blog/
```
预期：所有现有测试套件持续全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add src/pages/blog/ src/views/blog/PostDetailRouteView.vue
git commit -m "feat(blog): migrate post detail page into fsd pages layer with zero regressions"
```

---

### Task 6: 全量类型检查、全仓单测回归与构建验证

**Files:**
- Test: 全量测试套件

- [ ] **Step 1: 运行全量 TypeScript 类型检查**

运行：`bun run type-check`
预期：exited with code 0，零类型错误。

- [ ] **Step 2: 运行全量视图及系统单测**

运行：`bun run test:unit tests/unit/system/ tests/unit/entities/ tests/unit/views/blog/`
预期：全部 PASS，无任何失败。

- [ ] **Step 3: 运行生产构建打包**

运行：`bun run build`
预期：exited with code 0，生产构建产物顺利生成。

- [ ] **Step 4: 最终提交与整理**

```bash
git add .
git commit -m "chore(arch): complete frontend fsd architecture and vue-query pilot verification"
```
