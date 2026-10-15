# Feed 首访到首读闭环实施计划 (Feed First Visit to Read Loop Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建从未登录访客探索到登录回跳、订阅来源与文章阅读动作的平滑无状态闭环，使 Feed 成为安全可信的日常信息入口。

**Architecture:** 
1. 路由守卫与重定向：认证用户访问 `/` 自动跳转至 `/feed`，`LoginView` 默认登录目标对齐为 `/feed`；
2. 意图编码与参数契约：将来源订阅与文章操作意图安全编码在 URL Query 中，安全校验站内相对路径后跳转登录；
3. 状态机恢复与显式确认：登录后自动弹出来源/文章抽屉并聚焦操作按钮，清理 URL 一次性参数，绝对不自动发起写请求，等待用户显式确认后完成订阅/收藏并给出极简反馈。

**Tech Stack:** Vue 3.5, TypeScript 5.8+, Vite, Vue Router 4, Pinia 2.1, Vitest.

## Global Constraints

- **设计规范基准**：严格遵循 `Atoman-Frontend/docs/superpowers/specs/2026-10-15-feed-first-visit-to-read-loop-design.md` 与《全白双刻痕极简风设计系统规范》。
- **无阴影与圆角**：所有新增或调整组件严格无阴影（`none`），圆角除状态指示点外严格 `4px`。
- **文案规范**：成功反馈固定为 `已订阅，可继续阅读`，失败提示为 `订阅失败，请重试`，处理中为 `处理中...`，严禁开发者视角词汇。
- **副作用防御**：回跳后**绝对不自动发起**网络写请求，必须由用户显式点击确认。
- **质量门禁**：每个任务执行后必须通过 `bun run type-check` 与指定单元测试。

---

## File Structure

- **Modified**: `Atoman-Frontend/src/router/guards.ts` (增加认证用户访问 `/` 自动跳转至 `/feed`)
- **Modified**: `Atoman-Frontend/src/views/auth/LoginView.vue` (校验默认重定向路径)
- **Modified**: `Atoman-Frontend/src/views/feed/FeedRecommendedView.vue` (来源与文章意图编码、解析、抽屉恢复与状态同步)
- **Modified**: `Atoman-Frontend/src/components/feed/FeedArticleSheet.vue` (解除访客动作硬置灰，支持点击触发登录意图)
- **Tests**:
  - `Atoman-Frontend/tests/unit/router/router.root-entry.spec.ts`
  - `Atoman-Frontend/tests/unit/views/auth/LoginView.spec.ts`
  - `Atoman-Frontend/tests/unit/views/feed/FeedRecommendedView.spec.ts`
  - `Atoman-Frontend/tests/unit/components/feed/FeedArticleSheet.spec.ts`

---

## Task Breakdown

### Task 1: 路由守卫与登录回跳目标规范化 (Routing Guards & Login Safe Redirect)

**Files:**
- Modify: `Atoman-Frontend/src/router/guards.ts:70-105`
- Modify: `Atoman-Frontend/src/views/auth/LoginView.vue:285-300`
- Test: `Atoman-Frontend/tests/unit/router/router.root-entry.spec.ts`
- Test: `Atoman-Frontend/tests/unit/views/auth/LoginView.spec.ts`

- [ ] **Step 1: 编写认证用户访问 `/` 重定向至 `/feed` 的失败测试**
  在 `tests/unit/router/router.root-entry.spec.ts` 补充用例：
  ```ts
  it('redirects authenticated portal root traffic to the feed home path', async () => {
    localStorage.setItem('token', makeToken(3600))
    localStorage.setItem('user', JSON.stringify({ username: 'demo', role: 'user' }))

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' }, meta: { portalHome: true } },
        { path: '/feed', component: { template: '<div />' } },
      ],
    })
    installRouteGuards(router)

    await router.replace('/')
    expect(router.currentRoute.value.path).toBe('/feed')
  })
  ```
- [ ] **Step 2: 运行测试验证失败**
  `bun run test:unit tests/unit/router/router.root-entry.spec.ts`
- [ ] **Step 3: 修改 `src/router/guards.ts` 实现守卫重定向**
  在 `installRouteGuards` 中增加：
  ```ts
  if (isPortalHome && hasValidSession) {
    return "/feed";
  }
  ```
- [ ] **Step 4: 运行测试验证通过**
  `bun run test:unit tests/unit/router/router.root-entry.spec.ts tests/unit/views/auth/LoginView.spec.ts`
- [ ] **Step 5: 提交**
  `git commit -m "feat(router): redirect authenticated root traffic to feed and keep safe feed redirect default"`

---

### Task 2: 来源订阅意图编码与访客登录重定向 (Source Subscription Intent & Guest Redirect)

**Files:**
- Modify: `Atoman-Frontend/src/views/feed/FeedRecommendedView.vue:855-885`
- Test: `Atoman-Frontend/tests/unit/views/feed/FeedRecommendedView.spec.ts`

- [x] **Step 1: 编写访客点击推荐来源订阅按钮时保留筛选参数并重定向登录的测试**
  在 `FeedRecommendedView.spec.ts` 添加：
  ```ts
  it('redirects unauthenticated visitors to login with source intent and preserved filters', async () => {
    // 验证访客点击订阅按钮时，router.push 的目标包含 subscribe_source_id, subscribe_source_title, category, theme 等
  })
  ```
- [x] **Step 2: 运行测试验证失败**
  `bun run test:unit tests/unit/views/feed/FeedRecommendedView.spec.ts`
- [x] **Step 3: 优化 `requireLoginForSubscription` 逻辑**
  确保无论从卡片、抽屉还是推荐流触发，均完整收集 `context.id`、`context.type`、`context.title`、`context.rssUrl` 以及当前的过滤 Query（`category`、`theme`、`mode`、`scope`），生成合法站内 relative URL。
- [x] **Step 4: 运行测试验证通过**
  `bun run test:unit tests/unit/views/feed/FeedRecommendedView.spec.ts`
- [x] **Step 5: 提交**
  `git commit -m "feat(feed): preserve filters and source intent when redirecting unauthenticated visitors to login"`

---

### Task 3: 登录回跳后来源抽屉恢复与显式确认订阅 (Source Drawer Restoration & Explicit Confirmation)

**Files:**
- Modify: `Atoman-Frontend/src/views/feed/FeedRecommendedView.vue:935-968`
- Test: `Atoman-Frontend/tests/unit/views/feed/FeedRecommendedView.spec.ts`

- [x] **Step 1: 编写登录回跳后来源抽屉恢复与显式点击测试**
  在 `FeedRecommendedView.spec.ts` 添加用例：
  1. 带有 `subscribe_source_id` 且已认证访问时，自动打开来源文章抽屉；
  2. 自动调用 `router.replace` 移除 `subscribe_source_*` 参数，但保留 `category` 等过滤参数；
  3. 初始状态不自动请求订阅 API；用户点击抽屉内【订阅】后，才调用订阅接口，成功后 Toast 显示“已订阅，可继续阅读”；
  4. 当来源未在首屏 channels 中时，依据 URL 参数构造轻量来源并展示。
- [x] **Step 2: 运行测试验证失败**
  `bun run test:unit tests/unit/views/feed/FeedRecommendedView.spec.ts`
- [x] **Step 3: 完善 `restorePendingSubscriptionSource` 与来源抽屉逻辑**
  - 检查幂等标志位 `pendingSubscriptionRestored`；
  - 找不到本地 channel 时根据 URL 中的 title, type, url 构造轻量对象；
  - 聚焦抽屉订阅按钮；
  - 通过 `router.replace` 清理意图 Query 参数。
- [x] **Step 4: 运行测试验证通过**
  `bun run test:unit tests/unit/views/feed/FeedRecommendedView.spec.ts`
- [x] **Step 5: 提交**
  `git commit -m "feat(feed): restore pending subscription drawer on login return with explicit confirmation"`

---

### Task 4: 文章抽屉未登录动作拦截与意图回跳恢复 (Article Reading Actions & Intent Restoration)

**Files:**
- Modify: `Atoman-Frontend/src/components/feed/FeedArticleSheet.vue:50-70,120-135`
- Modify: `Atoman-Frontend/src/views/feed/FeedRecommendedView.vue:315-325,970-1000`
- Test: `Atoman-Frontend/tests/unit/components/feed/FeedArticleSheet.spec.ts`
- Test: `Atoman-Frontend/tests/unit/views/feed/FeedRecommendedView.spec.ts`

- [x] **Step 1: 编写文章抽屉未登录点击收藏/稍后读的交互测试**
  在 `FeedArticleSheet.spec.ts` 验证：未登录用户点击“收藏”或“稍后阅读”不再被禁用，而是触发 `@require-auth` 事件，携带文章信息与操作动作。
- [x] **Step 2: 编写 `FeedRecommendedView` 处理文章意图与回跳恢复测试**
  验证回跳时若存在 `read_article_id`，自动拉取并展开该文章抽屉。
- [x] **Step 3: 修改 `FeedArticleSheet.vue`**
  - 移除 `:disabled="!authStore.isAuthenticated"` 硬禁用；
  - 当未认证用户点击收藏或稍后阅读时，向父组件触发 `require-auth` 或内部安全跳转至 `/login?redirect=...&read_article_id=<id>&article_action=<action>`。
- [x] **Step 4: 在 `FeedRecommendedView.vue` 增加文章抽屉回跳恢复逻辑**
  在 `restorePendingSubscriptionSource` 或新增 `restorePendingArticle` 中识别 `read_article_id`，打开对应文章抽屉，并清理 Query。
- [x] **Step 5: 运行测试验证通过**
  `bun run test:unit tests/unit/components/feed/FeedArticleSheet.spec.ts tests/unit/views/feed/FeedRecommendedView.spec.ts`
- [x] **Step 6: 提交**
  `git commit -m "feat(feed): enable unauthenticated bookmark actions with safe login intent restoration"`

---

### Task 5: 全量类型检查、测试与生产构建验收 (Verification & Build Check)

**Files:**
- Test All: 全局构建与契约测试

- [x] **Step 1: 运行 TypeScript 严格类型检查**
  `bun run type-check`（必须 0 错误）
- [x] **Step 2: 运行 Feed 与 Auth 关联单元测试套件**
  `bun run test:unit tests/unit/views/feed/FeedRecommendedView.spec.ts tests/unit/views/auth/LoginView.spec.ts tests/unit/components/feed/FeedArticleSheet.spec.ts tests/unit/router/router.root-entry.spec.ts`
- [x] **Step 3: 运行生产构建**
  `bun run build`（必须无打包异常）
- [x] **Step 4: 提交**
  `git commit -m "test(feed): verify complete feed first-visit-to-read loop with clean build"`

---

## Verification Plan

### Automated Tests
```bash
cd Atoman-Frontend
bun run type-check
bun run test:unit tests/unit/router/router.root-entry.spec.ts
bun run test:unit tests/unit/views/auth/LoginView.spec.ts
bun run test:unit tests/unit/views/feed/FeedRecommendedView.spec.ts
bun run test:unit tests/unit/components/feed/FeedArticleSheet.spec.ts
bun run build
```

### Manual Verification Flow
1. 退出登录（保持访客状态）。
2. 打开 `http://localhost:5173/`，验证呈现公开 Portal；访问 `http://localhost:5173/feed`，浏览推荐文章与来源。
3. 点击某个未订阅来源卡片的“+ 订阅”：
   - 验证浏览器安全跳转至 `/login?redirect=...`，URL 携带 `subscribe_source_id` 等信息。
4. 输入有效账号完成登录：
   - 验证页面回跳到 `/feed`，URL 中的一次性意图参数自动清理；
   - 验证目标来源的文章抽屉自动展开，且【订阅】按钮获得焦点；
   - 验证没有自动发出订阅网络请求。
5. 点击抽屉内的【订阅】：
   - 验证按钮变为“已订阅”，Toast 显示“已订阅，可继续阅读”，订阅列表即刻同步。
6. 打开文章详情并测试未登录点击“收藏”，验证登录后重新展开该文章抽屉。
