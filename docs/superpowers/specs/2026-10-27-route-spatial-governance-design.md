# 全站路由空间规范与模块前缀治理系统设计

- **日期**: 2026-10-27
- **状态**: Approved
- **范围**: 前端路由空间定义纯净性、死链清理、历史模块路径重定向与静态契约测试

---

## 1. 背景与现状

在根目录 `AGENTS.md` 规则中明确要求：
> “路由只表达空间内位置，不恢复 `/blog`、`/music` 等模块前缀”

经过系统性排查，当前前端路由体系存在以下需要收网治理的问题：
1. **死链与定位缺陷**：
   - 读书笔记（`BookNotesView.vue`）和图书阅读器（`BookReaderView.vue`）在书摘引用写作时，调用了未定义的路由 `router.push('/studio/blog/editor')`；
   - 导致其误匹配到创作者中心的 `:id/edit` 规则（以 `"editor"` 作为文章 ID 请求接口并抛出 404 错误），未能正确跳转到创作者中心的新建文章页面 `/studio/blog/new`；
2. **移动端特有路由在桌面端未设回落**：
   - 移动端目录入口 `/modules` 在桌面端点击或访问时缺乏重定向，直接沦为 NotFound 页面；
3. **历史前缀兼容性遗留**：
   - 历史版本中博客模块曾使用 `/blog`，现已整体收敛至 `/posts`，但 `buildBaseAppRoutes.ts` 中尚未配置 `/blog` -> `/posts` 的全局规范重定向；
   - 部分组件（如 `BlogSheetStack.vue`）仍保留着对旧 `/blog` 路径的历史判断字符串；
4. **缺乏自动化静态契约测试**：
   - 缺少对 `moduleRoutes` 子路由纯净度（禁止绝对路径或重复硬编码模块前缀）与全站硬编码链接 0 死链的自动化断言防护。

---

## 2. 治理目标与架构设计

### 2.1 核心原则
1. **空间相对性**：
   各模块空间（`feed`、`music`、`blog`、`books`、`forum`、`debate`、`timeline`、`podcast`、`video`）内部定义的子路由仅表达空间内的相对位置（如 `discover`、`tags`、`notes`），不得在子路由定义中包含以 `/` 开头的绝对路径或模块前缀；
2. **前缀派发单一来源**：
   各模块的对外公共前缀（如 `/posts`、`/podcasts`、`/videos`）统一由 `@atoman/module-config` 的 `publicPathSegment` 派发装配；
3. **零死链契约守护**：
   通过自动化测试扫描全站静态链接，确保每一个路由调用点在路由表中均有确切的目标匹配。

---

## 3. 详细设计与改造清单

### 3.1 死链修复与容错重定向
1. **`BookNotesView.vue` & `BookReaderView.vue`**：
   - 将 `if (payload.target === 'blog_post') { void router.push('/studio/blog/editor') }` 修正为：
     `void router.push('/studio/blog/new')`；
2. **`src/router/routes/studio.ts`**：
   - 在创作者中心子路由中添加容错重定向：
     `{ path: "editor", redirect: "/studio/blog/new" }`；
3. **`src/router/buildBaseAppRoutes.ts`**：
   - 增加桌面端目录回落：`{ path: '/modules', redirect: '/' }`；
   - 增加历史博客路径规范重定向：
     `{ path: '/blog', redirect: '/posts' }`；
     `{ path: '/blog/:pathMatch(.*)*', redirect: (to) => `/posts/${Array.isArray(to.params.pathMatch) ? to.params.pathMatch.join('/') : to.params.pathMatch}` }`。

### 3.2 遗留代码清理
- **`src/components/blog/BlogSheetStack.vue`**：
  - 清理旧的 `/blog` 前缀检查逻辑，严格统一为 `/posts`。

---

## 4. 静态契约测试设计 (`tests/unit/router/route-spatial-contract.spec.ts`)

1. **子路由纯净度断言**：
   - 提取 `moduleRoutes` 所有模块的子路由；
   - 断言每一个子路由 `path` 不以 `/` 开头；
   - 断言不包含已被废弃的硬编码模块前缀（如 `/blog/`、`/music/` 等）。
2. **全站静态链接 0 死链断言**：
   - 提取 `src/` 与 `apps/mobile/` 中所有形如 `to="/..."` 的硬编码字符串；
   - 在已安装全量路由的 router 实例中调用 `router.resolve(path)`，断言其匹配的路由名称或组件不是 NotFound 通配路由。
3. **重定向行为断言**：
   - 断言 `/blog` 正确重定向至 `/posts`；
   - 断言 `/blog/articles` 正确重定向至 `/posts/articles`；
   - 断言 `/studio/blog/editor` 正确重定向至 `/studio/blog/new`；
   - 断言 `/modules` 在桌面端正确重定向至 `/`。

---

## 5. 质量保证与回归要求

- `bun run type-check`：严格 0 错误；
- `bun run test:unit`：3,711+ 项测试保持 100% 成功；
- `bun run build` & `bun run build:mobile`：双端构建正常。
