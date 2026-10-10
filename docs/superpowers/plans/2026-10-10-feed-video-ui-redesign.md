# Feed & Video UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Feed and Video module views and components in Atoman-Frontend to strictly conform to the Pure-White Double-Notch Minimal System specification.

**Architecture:** Polish styling, radii, font weights, semantic color tokens, and element surfaces across `src/components/video/*`, `src/views/video/*`, and `src/views/feed/*` while preserving all existing interaction behaviors, routes, and testing contracts.

**Tech Stack:** Vue 3.4+, TypeScript 5.9, Pinia, Vitest, JSDOM/Happy-DOM, Pure-White Minimal Design System CSS tokens.

## Global Constraints

- R1 纯白表面：卡片、面板、Sheet、表格、详情描述与统计卡片基础背景必须为 `#ffffff` / `var(--a-color-bg)`，严禁 `var(--a-color-surface)` 作为表面，卡片 hover 保持纯白。
- R2 柔和分界：外层边框 `var(--a-color-border)` (`#cbd5e1`)，内部分割 `var(--a-color-border-soft)` (`#e2e8f0`)，禁止 `rgba(0,0,0,x)` 或硬编码 hex。
- R3 阴影收敛：全局阴影严格令牌化或 `none`，禁止硬编码黑投影。
- R4 4px 紧凑圆角：卡片、控件、状态徽章、筛选 chip、播放器菜单统一使用 `4px` (`var(--a-radius-card)` / `var(--a-radius-control)`)，禁止 `999px` / `pill` 圆角。
- R5 克制字重：标题与列表项 `font-weight: 500`，强调态 `600`，严禁 `650`、`700` 出现在标题中；数值统一使用 `font-variant-numeric: tabular-nums`。
- R6 & R10 令牌色值：禁止硬编码颜色；错误与静音图标统一为 `var(--a-color-danger)`；警告与热点统一为 `var(--a-color-warning)`。
- R8 用户视角文案：去除技术词（“复制 UUID” 改为 “复制视频 ID”）；动作用语遵循自然语言。
- 保证所有现有测试契约与组件功能不被破坏。

---

### Task 1: Video Components Refactor (`src/components/video/*`)

**Files:**
- Modify: `src/components/video/VideoPlayerControls.vue`
- Modify: `src/components/video/VideoCollectionPlaylist.vue`
- Modify: `src/components/video/VideoRecommendationRow.vue`
- Test: `tests/unit/components/video/VideoRecommendationRow.spec.ts`
- Test: `tests/unit/components/video-detail-supporting-components.spec.ts`

- [ ] **Step 1: Refactor VideoPlayerControls.vue**
  - Standardize `.vpc-preview` border-radius to `var(--a-radius-control)` (4px), replace hardcoded shadow with `var(--a-shadow-md)`.
  - Standardize `.vpc-speed-menu` border-radius to `var(--a-radius-control)` (4px), replace hardcoded shadow with `var(--a-shadow-md)`.
  - Lower `.vpc-speed-option--active` font-weight from 700 to 600.
  - Standardize `.vpc-vol-icon--muted` color to `var(--a-color-danger)`.
  - Replace fallback `#3b82f6` in `var(--a-color-primary)`.

- [ ] **Step 2: Polish VideoCollectionPlaylist.vue and VideoRecommendationRow.vue**
  - In `VideoCollectionPlaylist.vue`: change `.vcp__title` font-weight from 650 to 500, change `.vcp__item-title` font-weight from 550 to 500.
  - In `VideoRecommendationRow.vue`: change `.vrr__header h2` font-weight from 650 to 500.

- [ ] **Step 3: Run Video components unit tests**
  ```bash
  bun run test:unit tests/unit/components/video/ tests/unit/components/video-detail-supporting-components.spec.ts
  ```

- [ ] **Step 4: Commit changes**
  ```bash
  git commit -m "refactor(video): standardize player controls, playlist and recommendation row styles"
  ```

---

### Task 2: Video Views Refactor (`src/views/video/*`)

**Files:**
- Modify: `src/views/video/VideoHomeView.vue`
- Modify: `src/views/video/VideoDetailView.vue`
- Modify: `src/views/video/VideoEditorView.vue`
- Modify: `src/views/video/VideoFavoritesView.vue`
- Modify: `src/views/video/VideoSubscriptionsView.vue`
- Modify: `tests/unit/views/video/VideoDetailView.spec.ts`
- Test: `tests/unit/views/video/`

- [ ] **Step 1: Polish VideoHomeView.vue**
  - Change `.vh-chip` border-radius from `var(--a-radius-pill, 999px)` to `var(--a-radius-control)` (4px).
  - Change `.vh-chip` inactive font-weight from 600 to 500.
  - Change `.vh-recommendation-menu` background from `var(--a-color-surface)` to `var(--a-color-bg)` with 4px radius.

- [ ] **Step 2: Polish VideoDetailView.vue and sync test**
  - Change `.vd-title` font-weight from 600 to 500.
  - Change `.vd-author-avatar` font-weight from 650 to 600.
  - Change `.vd-subscribe` and `.vd-comment-action` border-radius from 3px to `var(--a-radius-control)` (4px).
  - Change `.vd-description` and `.vd-timestamp-hint` background from `var(--a-color-surface)` to `var(--a-color-bg)` with border.
  - Replace "复制 UUID" / "UUID 已复制" with "复制视频 ID" / "视频 ID 已复制".
  - Sync `tests/unit/views/video/VideoDetailView.spec.ts` lines 765 and 777 to assert "视频 ID 已复制".

- [ ] **Step 3: Polish VideoEditorView.vue, VideoFavoritesView.vue, VideoSubscriptionsView.vue**
  - In `VideoEditorView.vue`: change `.ve-section-title` and `.ve-field-label` font-weights from 600 to 500.
  - In `VideoFavoritesView.vue`: change select and select-box background to `var(--a-color-bg)` and add 4px radius.
  - In `VideoSubscriptionsView.vue`: upgrade retry button to `PButton`.

- [ ] **Step 4: Run Video views unit tests**
  ```bash
  bun run test:unit tests/unit/views/video/
  ```

- [ ] **Step 5: Commit changes**
  ```bash
  git commit -m "refactor(video): polish video views, surfaces, chips and remove developer jargon"
  ```

---

### Task 3: Feed Views Typography & Surfaces Refactor (`src/views/feed/*`)

**Files:**
- Modify: `src/views/feed/FeedRecommendedView.vue`
- Modify: `src/views/feed/FeedStarredView.vue`
- Modify: `src/views/feed/FeedStatsView.vue`
- Modify: `src/views/feed/InboxPage.vue`
- Test: `tests/unit/views/feed/`

- [ ] **Step 1: Polish FeedRecommendedView.vue**
  - Change `.stream-column__title-group h2` font-weight from 650 to 500.
  - Change `.topic-pill` font-weight from 550 to 500.
  - Change `.section-badge` font-weight from 650 to 500.
  - Change `.section-badge--hot` to use `var(--a-color-warning)`.

- [ ] **Step 2: Polish FeedStarredView.vue**
  - Change `.star-group-button.active` font-weight from 650 to 600.
  - Standardize `.star-group-select` border-radius to `var(--a-radius-control)` and background to `var(--a-color-bg)`.

- [ ] **Step 3: Polish FeedStatsView.vue and InboxPage.vue**
  - In `FeedStatsView.vue`: change `.stats-card` background from `var(--a-color-surface)` to `var(--a-color-bg)`, remove hover gray background, change Chart.js tick weights from 700 to 500.
  - In `InboxPage.vue`: change `.inbox-category-pane` background from `var(--a-color-surface)` to `var(--a-color-bg)`.

- [ ] **Step 4: Run Feed unit tests**
  ```bash
  bun run test:unit tests/unit/views/feed/
  ```

- [ ] **Step 5: Commit changes**
  ```bash
  git commit -m "refactor(feed): standardize feed typography, stats cards, and inbox pane surfaces"
  ```

---

### Task 4: Whole-Module Integration, Full Test Suite & Branch Review

**Files:**
- All modified files in Tasks 1-3
- Contract test suites: `tests/unit/ui/design-system-contract.spec.ts`

- [ ] **Step 1: Run full type check**
  ```bash
  bun run type-check
  ```

- [ ] **Step 2: Run all Feed & Video test suites**
  ```bash
  bun run test:unit tests/unit/views/feed tests/unit/views/video tests/unit/components/video tests/unit/components/feed tests/unit/ui/design-system-contract.spec.ts
  ```

- [ ] **Step 3: Run git diff format check**
  ```bash
  git diff --check
  ```

- [ ] **Step 4: Dispatch whole-branch code review subagent**
