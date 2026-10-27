# 桌面端全站「0 阴影」彻底清理与浮层 Token 终极收网实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 彻底清除桌面端及通用组件中残留的模糊外层投影（box-shadow），源头清零全局 Token，为浮层和模态补齐 1px 语义边框（Border Contract），收敛硬编码颜色为语义 Token。

**Architecture:** 从 `src/style.css` 全局 Token 源头清除所有立体阴影，为历史上因依赖投影而使用 `border: none;` 的模态和下拉菜单补齐 `border: 1px solid var(--a-color-border)` 语义边框；逐一清理多媒体控制栏（Audio/Video）、图片灯箱（Lightbox）、目录导航（DirectoryNav）及主题控件中的硬编码阴影与颜色。

**Tech Stack:** Vue 3.4, TypeScript 5.8, CSS Custom Properties, Vitest, Vue Test Utils.

## Global Constraints
- 严格 0 阴影：禁止任何 blur > 0 的外层模糊投影；允许 0 blur 的聚焦轮廓（outline）或 1px 实线边框。
- 严格 4px 圆角：统一切换为 `var(--a-radius-card, 4px)` 或 `var(--a-radius-control, 4px)`。
- 全语义 Token：严禁硬编码 hex 颜色（如 `#ffffff`、`#6366f1`），必须使用语义 Token（`var(--a-color-surface)`、`var(--a-color-border)` 等）。
- 杜绝假数据：严禁引入任何 Mock 数据或假状态。
- TypeScript：严格类型安全，`bun run type-check` 0 error。

---

### Task 1: 全局 Token 清零与基础浮层样式加固

**Files:**
- Modify: `src/style.css:50-65, 800-820, 1560-1575`
- Modify: `src/components/system/AppTopbarAuthControls.vue:318-328`
- Create: `tests/unit/ui/global-zero-shadow.spec.ts`

**Interfaces:**
- Consumes: CSS Custom Properties `--a-shadow-*`, `--a-color-border`, `--a-radius-card`
- Produces: 0-shadow global design tokens and clean 1px border fallback for modals and dropdown menus.

- [ ] **Step 1: Write failing unit test for global zero-shadow and modal border**
  Create `tests/unit/ui/global-zero-shadow.spec.ts` asserting:
  1. `src/style.css` defines `--a-shadow-sm/md/lg/hover/active/dropdown/modal` as `none` in both light and dark root scopes.
  2. `.p-modal, .a-modal` in `src/style.css` has `border: 1px solid var(--a-color-border);` and `box-shadow: none;`.
  3. `AppTopbarAuthControls.vue` `.dropdown` has `border: 1px solid var(--a-color-border);` and `box-shadow: none;`.

- [ ] **Step 2: Run test to verify failure**
  Run `cd Atoman-Frontend && bun run test:unit tests/unit/ui/global-zero-shadow.spec.ts` and confirm failure.

- [ ] **Step 3: Update `src/style.css` and `AppTopbarAuthControls.vue`**
  - In `src/style.css`:
    - Set `--a-shadow-sm: none;`, `--a-shadow-md: none;`, `--a-shadow-lg: none;`, `--a-shadow-hover: none;`, `--a-shadow-active: none;` in root.
    - Set dark mode `--a-shadow-*` tokens to `none`.
    - Update `.a-modal, .p-modal` to `border: 1px solid var(--a-color-border);` and `box-shadow: none;`.
  - In `src/components/system/AppTopbarAuthControls.vue`:
    - Change `.dropdown` from `border: none;` to `border: 1px solid var(--a-color-border);` and `border-radius: var(--a-radius-card, 4px);` with `box-shadow: none;`.

- [ ] **Step 4: Run test to verify passing**
  Run `cd Atoman-Frontend && bun run test:unit tests/unit/ui/global-zero-shadow.spec.ts`.

- [ ] **Step 5: Commit changes**
  Commit with message `refactor(ui): zero out global shadow tokens and enforce 1px border on modals and dropdowns`.

---

### Task 2: 音量滑块与视频控制栏 0 阴影与 Token 语义化

**Files:**
- Modify: `src/components/music/AudioPlayerVolume.vue:140-180`
- Modify: `src/components/video/VideoPlayerControls.vue:465-500, 590-605`
- Create: `tests/unit/media/player-zero-shadow.spec.ts`

**Interfaces:**
- Consumes: `var(--a-color-surface)`, `var(--a-color-border-soft)`, `var(--a-color-primary)`
- Produces: Flat zero-shadow sliders, scrubbers, video preview tooltips, and speed popovers.

- [ ] **Step 1: Write failing unit test for player zero-shadow**
  Create `tests/unit/media/player-zero-shadow.spec.ts` asserting:
  1. `AudioPlayerVolume.vue` slider thumb has `box-shadow: none;` and does not use hardcoded `#ffffff`.
  2. `VideoPlayerControls.vue` scrubber handle and preview popups do not use blur shadows.

- [ ] **Step 2: Run test to verify failure**
  Run `cd Atoman-Frontend && bun run test:unit tests/unit/media/player-zero-shadow.spec.ts`.

- [ ] **Step 3: Update `AudioPlayerVolume.vue` and `VideoPlayerControls.vue`**
  - `AudioPlayerVolume.vue`:
    - Remove `box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);` on `::-webkit-slider-thumb` and `::-moz-range-thumb`.
    - Replace `background: #ffffff;` with `background: var(--a-color-surface);`.
  - `VideoPlayerControls.vue`:
    - Remove `box-shadow: var(--a-shadow-sm, ...);` on `.vpc-scrubber-handle`.
    - Remove `box-shadow: var(--a-shadow-md);` on `.vpc-preview` and `.vpc-speed-popover`.

- [ ] **Step 4: Run test to verify passing**
  Run `cd Atoman-Frontend && bun run test:unit tests/unit/media/player-zero-shadow.spec.ts`.

- [ ] **Step 5: Commit changes**
  Commit with message `refactor(media): remove shadows and tokenize audio and video player controls`.

---

### Task 3: 图片灯箱、目录浮层与主题面板收敛

**Files:**
- Modify: `src/components/ui/PDirectoryNav.vue:245-270`
- Modify: `src/components/ui/PImageLightbox.vue:230-245`
- Modify: `src/components/theme/ThemePresetControl.vue:170-180`
- Modify: `src/components/theme/ThemeCssEditor.vue:70-80`
- Create: `tests/unit/ui/lightbox-directory-zero-shadow.spec.ts`

**Interfaces:**
- Consumes: `var(--a-radius-card)`, `var(--a-color-border-soft)`, `var(--a-color-primary-contrast)`
- Produces: Pure flat 0-shadow image lightbox, directory sheets, and theme controls.

- [ ] **Step 1: Write failing unit test**
  Create `tests/unit/ui/lightbox-directory-zero-shadow.spec.ts` checking:
  1. `PDirectoryNav.vue` `.p-directory-sheet` has no `box-shadow`.
  2. `PImageLightbox.vue` `.p-lightbox-image` has no `box-shadow` and uses 4px border radius.
  3. `ThemePresetControl.vue` `.color-check-dot` has no `box-shadow`.
  4. `ThemeCssEditor.vue` does not use glow `box-shadow`.

- [ ] **Step 2: Run test to verify failure**
  Run `cd Atoman-Frontend && bun run test:unit tests/unit/ui/lightbox-directory-zero-shadow.spec.ts`.

- [ ] **Step 3: Update target files**
  - `PDirectoryNav.vue`: Remove `box-shadow` lines 253 and 266.
  - `PImageLightbox.vue`: Remove `box-shadow` on `.p-lightbox-image`, set `border-radius: var(--a-radius-card, 4px);` and `border: 1px solid var(--a-color-border-soft);`.
  - `ThemePresetControl.vue`: Remove `box-shadow` on `.color-check-dot`, set `background-color: var(--a-color-primary-contrast);`.
  - `ThemeCssEditor.vue`: Update `.editor-textarea:focus` to `outline: 2px solid var(--a-color-primary); outline-offset: 1px; box-shadow: none;`.

- [ ] **Step 4: Run test to verify passing**
  Run `cd Atoman-Frontend && bun run test:unit tests/unit/ui/lightbox-directory-zero-shadow.spec.ts`.

- [ ] **Step 5: Commit changes**
  Commit with message `refactor(ui): clean up shadows across lightbox, directory nav, and theme controls`.

---

### Task 4: 全站回归扫描与双端生产构建验证

**Files:**
- Verify: Full codebase

- [ ] **Step 1: Run zero-shadow grep scanner**
  Run `cd Atoman-Frontend && grep -rn "box-shadow:" src/ | grep -v "box-shadow: none"` to ensure no blur shadows remain in functional components.
- [ ] **Step 2: Run TypeScript type check**
  Run `cd Atoman-Frontend && bun run type-check`.
- [ ] **Step 3: Run full Vitest suite**
  Run `cd Atoman-Frontend && bun run test:unit`.
- [ ] **Step 4: Run production builds**
  Run `cd Atoman-Frontend && bun run build` (desktop) and `cd Atoman-Frontend && bun run build:mobile` (mobile).
- [ ] **Step 5: Commit and push**
  Push all commits to `origin/main`.
