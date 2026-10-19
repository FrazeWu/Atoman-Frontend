# 曲库抽屉向上弹出 (Bottom Sheet) 与极简设计重塑实施计划 (Phase 3.1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将曲库三套核心抽屉（`AlbumDrawer.vue`, `ArtistDrawer.vue`, `SongDrawer.vue`）从右侧滑出改造为**从底部平滑向上拉起（Bottom Sheet，88vh 视口高度）**，底部无缝避让播放条；严格对齐纯白纸张基底、0 阴影 (`box-shadow: none !important;`) 与 4px 圆角规范；接入 `@/entities/music` 的 Vue Query 缓存与模块级内存缓存，实现再次打开零延迟免闪烁，同时 100% 保持既有单测与契约。

**Tech Stack:** Vue 3.4+, Pinia 2.1+, TanStack Vue Query, TypeScript 5.8 (Strict), Vitest, Happy-DOM.

## Global Constraints

- **严格 0 阴影**：全局遵循 `box-shadow: none !important;`。
- **严格 4px 圆角**：卡片、海报封面、交互按钮与抽屉顶角统一遵循 `border-radius: var(--a-radius-card, 4px)` 与 `var(--a-radius-control, 4px)`。
- **纯白纸张基底与 1px 发丝线**：底色遵循 `#FFFFFF`，分割线采用 `1px solid var(--a-color-border-soft)`。
- **向上弹出与播放条协调**：`side="bottom"`，高度定为 `88vh`（`max-height: calc(100dvh - var(--a-topbar-height) - 1rem)`），底部贴合 `var(--a-content-bottom-offset)`，确保底层播放条常驻可用。
- **契约向后兼容**：保留所有测试依赖的 testid、类名及源码正则契约（如 `SongDrawerLayout.spec.ts` 7 项正则约束）。

---

### Task 1: FSD 领域层扩充 `@/entities/music` (Album & Artist Queries)

**Files:**
- Modify: `src/entities/music/api/musicApi.ts`
- Modify: `src/entities/music/queries/musicKeys.ts`
- Create: `src/entities/music/queries/useAlbumDetailQuery.ts`
- Create: `src/entities/music/queries/useArtistDetailQuery.ts`
- Modify: `src/entities/music/index.ts`
- Modify: `tests/unit/entities/music/musicQueries.spec.ts`

- [ ] **Step 1: 扩充 API 与 queryKeys**
  - 在 `musicApi.ts` 中导出 `fetchAlbumDetail(id)`（调用 `getMusicAlbumDetail`）和 `fetchArtistDetail(id)`（调用 `getMusicArtistDetail`）。
  - 在 `musicKeys.ts` 中新增 `albumDetail: (id) => [...musicKeys.albums(), 'detail', String(id)]` 与 `artistDetail: (id) => [...musicKeys.artists(), 'detail', String(id)]`。

- [ ] **Step 2: 封装 `useAlbumDetailQuery` 与 `useArtistDetailQuery`**
  - 使用 `useQuery` 实现响应式获取，支持 `MaybeRefOrGetter` 参数。

- [ ] **Step 3: 编写单测并验证**
  - 在 `tests/unit/entities/music/musicQueries.spec.ts` 中补充针对 `albumDetail` 和 `artistDetail` 的测试用例。
  - 运行 `bun run test:unit tests/unit/entities/music/musicQueries.spec.ts` 验证通过。

- [ ] **Step 4: 提交**
  ```bash
  git commit -am "feat(music): add albumDetail and artistDetail queries to music domain entity"
  ```

---

### Task 2: PSheet 底部拉起（Bottom Sheet）与播放条避让支撑完善

**Files:**
- Modify: `src/components/ui/PSheet.vue`
- Test: `tests/unit/ui/PSheet.spec.ts` (如存在)

- [ ] **Step 1: 检查并完善 `side="bottom"` 的桌面与移动端样式**
  - 确认 `side="bottom"` 进出场使用 `slide-up` 动画。
  - 桌面端顶角赋予 `border-radius: var(--a-radius-card, 4px) var(--a-radius-card, 4px) 0 0;`。
  - 顶部增加 1px 发丝线 `border-top: 1px solid var(--a-color-border-soft);`。
  - 强制 `box-shadow: none !important;`。
  - 确保底边贴合 `var(--a-content-bottom-offset)`，使底部 AudioPlayer 保持可见并可交互。

- [ ] **Step 2: 运行测试并提交**
  ```bash
  git commit -am "style(ui): polish PSheet bottom sheet upward animation, radius, and player offset"
  ```

---

### Task 3: `AlbumDrawer.vue` 向上弹出改造、Vue Query 接入与 UI 重塑

**Files:**
- Modify: `src/components/music/AlbumDrawer.vue`
- Test: `tests/unit/components/music/AlbumDrawer.spec.ts`

- [ ] **Step 1: 接入 `side="bottom"` 与 `height="88vh"`**
  - 将 `<PSheet ... side="bottom" height="88vh">`。

- [ ] **Step 2: 接入模块级内存缓存与 Vue Query 同步**
  - 建立 `moduleAlbumDetailCache = new Map<string, MusicAlbumDetail>()`，二次打开抽屉直接命中内存零白屏闪烁。
  - 安全接入 `useQueryClient`（容错 Vitest 纯组件环境）。

- [ ] **Step 3: 视觉设计系统对齐**
  - 封面海报设置为 160px，`border-radius: 4px`，`box-shadow: none;`。
  - 曲目表格列表轻量纯净，移除冗余卡片阴影，单行紧凑。

- [ ] **Step 4: 运行单测验证**
  - 运行 `bun run test:unit tests/unit/components/music/AlbumDrawer.spec.ts`，保证全部 43 项测试 100% 绿灯。

- [ ] **Step 5: 提交**
  ```bash
  git commit -am "refactor(music): redesign AlbumDrawer as slide-up bottom sheet with Vue Query cache"
  ```

---

### Task 4: `ArtistDrawer.vue` 向上弹出改造、Vue Query 接入与 UI 重塑

**Files:**
- Modify: `src/components/music/ArtistDrawer.vue`
- Test: `tests/unit/components/music/ArtistDrawer.spec.ts`

- [ ] **Step 1: 接入 `side="bottom"` 与 `height="88vh"`**
  - 将 `<PSheet ... side="bottom" height="88vh">`。

- [ ] **Step 2: 接入模块级内存缓存与 Vue Query 同步**
  - 建立 `moduleArtistDetailCache = new Map<string, MusicArtistDetail>()`，二次打开即开即显。

- [ ] **Step 3: 视觉设计系统对齐**
  - 头像海报微圆角 4px，纯白底色，移除外框多余阴影。
  - 精简“热门曲目”与“发行专辑”网格排版。

- [ ] **Step 4: 运行单测验证**
  - 运行 `bun run test:unit tests/unit/components/music/ArtistDrawer.spec.ts`，保证全部 23 项测试 100% 绿灯。

- [ ] **Step 5: 提交**
  ```bash
  git commit -am "refactor(music): redesign ArtistDrawer as slide-up bottom sheet with Vue Query cache"
  ```

---

### Task 5: `SongDrawer.vue` 向上弹出改造与三抽屉交互统一

**Files:**
- Modify: `src/components/music/SongDrawer.vue`
- Test: `tests/unit/components/music/SongDrawer*.spec.ts`

- [ ] **Step 1: 将 `SongDrawer.vue` 改为 `side="bottom"` 与 `height="88vh"`**
  - 保持与 `AlbumDrawer` / `ArtistDrawer` 交互行为一致。

- [ ] **Step 2: 严格锁定既有正则与 DOM 契约**
  - 完整保留 `SongDrawerLayout.spec.ts` 所检索的 7 项正则约束。

- [ ] **Step 3: 运行单测验证**
  - 运行 `bun run test:unit tests/unit/components/music/SongDrawer*.spec.ts`，验证全部 17 项测试 100% 绿灯。

- [ ] **Step 4: 提交**
  ```bash
  git commit -am "refactor(music): align SongDrawer to slide-up bottom sheet presentation"
  ```

---

### Task 6: 全量类型检查、全仓音乐测试与构建验证

- [ ] **Step 1: 运行严格 TypeScript 类型检查**
  - `bun run type-check`（要求 0 错误）。

- [ ] **Step 2: 运行全量音乐与播放器测试**
  - `bun run test:unit tests/unit/components/music/ tests/unit/stores/player.spec.ts tests/unit/entities/music/`
  - 要求全部测试 100% 绿灯。

- [ ] **Step 3: 运行 Vite 生产构建**
  - `bun run build`（要求 exit code 0）。

- [ ] **Step 4: 合并至 `main` 并推送到远程**
  ```bash
  git checkout main
  git merge feat/music-drawers-bottom-sheet-and-vue-query --no-ff -m "feat(music): redesign entity drawers as slide-up bottom sheets with Vue Query caching"
  git push origin main
  ```
