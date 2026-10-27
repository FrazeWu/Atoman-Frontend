# 全站路由空间规范与模块前缀治理实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落实 `AGENTS.md` 规则“路由只表达空间内位置，不恢复 `/blog`、`/music` 等模块前缀”，修复 `BookNotesView` 与 `BookReaderView` 跳转至未定义路径 `/studio/blog/editor` 的死链缺陷，建立 `/blog` -> `/posts`、`/studio/blog/editor` -> `/studio/blog/new` 以及 `/modules` 桌面端回落重定向，并通过自动化静态契约测试确保全站 0 空间违规与 0 死链。

**Architecture:** 
1. 依据空间相对性原则，在 `src/router/routes/modules.ts` 与 `src/router/routes/studio.ts` 保持子路由仅表达相对位置；
2. 在 `src/router/buildBaseAppRoutes.ts` 配置历史路径与多端目录回落重定向；
3. 修正业务代码中硬编码的跳转目标至标准空间路由；
4. 建立 `tests/unit/router/route-spatial-contract.spec.ts` 自动化静态契约测试守护全站路由规范。

**Tech Stack:** Vue 3.4, Vue Router 4, TypeScript, Vitest.

## Global Constraints

- 严格遵循 0 阴影（`box-shadow: none !important;`）与 4px 圆角规范；
- 遵循真数据原则，杜绝任何 Mock 数据或假状态；
- 用户精心设计的桌面端顶栏交互与视觉（`AppTopbarAuthControls.vue`）绝对不作任何改动；
- 修改完成前必须运行 `bun run type-check` 与 `bun run test:unit` 验证。

---

### Task 1: 全站路由空间静态契约测试与重定向规范验证 (`route-spatial-contract.spec.ts`)

**Files:**
- Create: `tests/unit/router/route-spatial-contract.spec.ts`
- Modify: `src/router/buildBaseAppRoutes.ts`
- Modify: `src/router/routes/studio.ts`

**Interfaces:**
- Consumes: `buildBaseAppRoutes()`, `moduleRoutes`
- Produces: `route-spatial-contract.spec.ts` 契约套件

- [x] **Step 1: Write the failing test for spatial route contract & redirects**

```ts
// tests/unit/router/route-spatial-contract.spec.ts
import { describe, it, expect } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { buildBaseAppRoutes } from '@/router/buildBaseAppRoutes'
import { moduleRoutes } from '@/router/routes/modules'

describe('route-spatial-contract', () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: buildBaseAppRoutes(),
  })

  it('enforces relative paths for all module children routes without redundant module prefixes', () => {
    for (const [moduleKey, routes] of Object.entries(moduleRoutes)) {
      for (const route of routes) {
        if (!route.children) continue
        for (const child of route.children) {
          expect(child.path.startsWith('/')).toBe(false)
          expect(child.path).not.toMatch(new RegExp(`^${moduleKey}(/|$)`))
          expect(child.path).not.toMatch(/^blog(\/|$)/)
        }
      }
    }
  })

  it('redirects /blog and its subroutes to /posts', async () => {
    const resolvedRoot = router.resolve('/blog')
    expect(resolvedRoot.path).toBe('/posts')

    const resolvedSub = router.resolve('/blog/articles')
    expect(resolvedSub.path).toBe('/posts/articles')
  })

  it('redirects /studio/blog/editor to /studio/blog/new', async () => {
    const resolved = router.resolve('/studio/blog/editor')
    expect(resolved.path).toBe('/studio/blog/new')
  })

  it('redirects /modules to / on desktop', async () => {
    const resolved = router.resolve('/modules')
    expect(resolved.path).toBe('/')
  })
})
```

- [x] **Step 2: Run test to confirm failure on missing redirects**

Run: `bun run test:unit tests/unit/router/route-spatial-contract.spec.ts`
Expected: Failures on `/blog` (resolves to 404), `/studio/blog/editor` (resolves to `:id/edit`), `/modules` (resolves to 404).

- [x] **Step 3: Implement missing redirects in `buildBaseAppRoutes.ts` and `studio.ts`**

1. In `src/router/routes/studio.ts`: Add `{ path: "editor", redirect: "/studio/blog/new" }` before `:id/edit`.
2. In `src/router/buildBaseAppRoutes.ts`:
   - Add `{ path: '/blog', redirect: '/posts' }`
   - Add `{ path: '/blog/:pathMatch(.*)*', redirect: (to) => `/posts/${Array.isArray(to.params.pathMatch) ? to.params.pathMatch.join('/') : to.params.pathMatch}` }`
   - Add `{ path: '/modules', redirect: '/' }`

- [x] **Step 4: Run test to confirm pass**

Run: `bun run test:unit tests/unit/router/route-spatial-contract.spec.ts`
Expected: 4/4 tests pass.

- [x] **Step 5: Commit**

Run: `git add tests/unit/router/route-spatial-contract.spec.ts src/router/buildBaseAppRoutes.ts src/router/routes/studio.ts && git commit -m "feat(router): add route spatial contract tests and legacy/fallback redirects"`

---

### Task 2: 修复业务组件内部的死链与历史路径清理

**Files:**
- Modify: `src/views/books/BookNotesView.vue:340-345`
- Modify: `src/views/books/BookReaderView.vue:1070-1076`
- Modify: `src/components/blog/BlogSheetStack.vue:14-16`
- Modify: `tests/unit/views/books/BookNotesView.spec.ts`
- Modify: `tests/unit/views/books/BookReaderView.spec.ts` (if applicable)

- [x] **Step 1: Update unit tests to assert `/studio/blog/new`**

In `BookNotesView.spec.ts`, check quote action modal navigation goes to `/studio/blog/new` instead of `/studio/blog/editor`.

- [x] **Step 2: Update `BookNotesView.vue` and `BookReaderView.vue`**

Change `void router.push('/studio/blog/editor')` to `void router.push('/studio/blog/new')`.

- [x] **Step 3: Clean legacy `/blog` reference in `BlogSheetStack.vue`**

Update `isBlogRoute` and `isBlogHomePath` to align with `/posts` only.

- [x] **Step 4: Run unit tests**

Run: `bun run test:unit tests/unit/views/books/BookNotesView.spec.ts tests/unit/components/blog/BlogSheetStack.spec.ts`
Expected: All tests pass.

- [x] **Step 5: Commit**

Run: `git add src/views/books/BookNotesView.vue src/views/books/BookReaderView.vue src/components/blog/BlogSheetStack.vue tests/unit/views/books/BookNotesView.spec.ts && git commit -m "fix(books): correct blog editor route to /studio/blog/new and clean legacy /blog references"`

---

### Task 3: 全站完整质量保证与构建验证

**Files:**
- Documentation: `docs/superpowers/plans/2026-10-27-route-spatial-governance.md`
- Kanban: `<appDataDir>/brain/72e9f847-045b-4790-a46f-1fe17ce2f1c1/frontend-refactor-status.md`

- [x] **Step 1: Run TypeScript strict check**

Run: `cd Atoman-Frontend && bun run type-check`
Expected: 0 errors.

- [x] **Step 2: Run full unit test suite**

Run: `cd Atoman-Frontend && bun run test:unit`
Expected: 100% pass across all 552+ suites.

- [x] **Step 3: Run desktop and mobile production builds**

Run: `cd Atoman-Frontend && bun run build && bun run build:mobile`
Expected: Both builds succeed with 0 errors.

- [x] **Step 4: Update plan and kanban status**

Mark all tasks as completed in plan and update status board.

- [x] **Step 5: Final commit & push**

Run: `git commit -am "chore: complete route spatial governance and verification" && git push origin main`
