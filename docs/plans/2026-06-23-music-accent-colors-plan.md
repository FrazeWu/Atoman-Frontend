# Atoman 音乐模块点睛色与排版优化设计实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Atoman 音乐模块实现双点睛色（邮差绿与朱红橘）映射及高密度排版精细化重构。

**Architecture:** 全局 CSS 变量驱动，重映射组件动作按钮的 Hover 色、状态圆点色，音量/进度条高亮色，以及卡片细边框与 Hover 邮差绿指示条，调整标签字号与行距层级。

**Tech Stack:** Vue 3, Vite, TypeScript, CSS Variables

## Global Constraints

- 全站直角风格必须保留（所有卡片、按钮的 `border-radius` 保持为 0，小圆点等除外）。
- 确认/正常/建设性动作使用 `--a-color-accent-confirm: #0d9488`。
- 删除/警告/破坏性动作使用 `--a-color-accent-destructive: #ea580c`。
- 严禁任何硬编码颜色（除混色外一律使用 CSS 变量）。
- 每次修改后均使用 `bun run test:unit` 和 `bun run build` 进行验证，确保打包正常通过。

---

### Task 1: 全局 CSS 变量定义

**Files:**
- Modify: `src/style.css:1-35`

- [ ] **Step 1: 在全局样式中增加点睛色 CSS 变量**
  修改 `src/style.css`，在 `:root` 内加入核心点睛色及其 Hover 加深色阶：
  ```css
  --a-color-accent-confirm: #0d9488;
  --a-color-accent-confirm-hover: #0f766e;
  --a-color-accent-destructive: #ea580c;
  --a-color-accent-destructive-hover: #c2410c;
  ```
- [ ] **Step 2: 验证编译成功**
  运行：`bun run build`
  Expected: 打包成功，无错误。
- [ ] **Step 3: 提交 Git**
  ```bash
  git add src/style.css
  git commit -m "style: define global semantic accent color variables"
  ```

---

### Task 2: 抽屉与正面/反面动作组件映射

**Files:**
- Modify: `src/components/music/NestedActionDrawer.vue`
- Modify: `src/components/music/MusicCreationFlowDrawer.vue`
- Modify: `src/components/music/ArtistDrawer.vue`
- Modify: `src/components/music/AlbumDrawer.vue`

- [ ] **Step 1: 修改 NestedActionDrawer.vue 中的操作按钮与状态色**
  修改 `src/components/music/NestedActionDrawer.vue`，将 `.form-success` 颜色映射为 `var(--a-color-accent-confirm)`，`.form-error` 映射为 `var(--a-color-accent-destructive)`，将 `.paper-submit` 的背景颜色替换为 `var(--a-color-accent-confirm)`，Hover 背景色替换为 `var(--a-color-accent-confirm-hover)`：
  ```css
  .form-error { margin: 0; color: var(--a-color-accent-destructive); font-weight: 800; font-size: 0.9rem; }
  .form-success { margin: 0; color: var(--a-color-accent-confirm); font-weight: 800; font-size: 0.9rem; }
  .paper-submit {
    /* ... 其他属性不变 ... */
    background: var(--a-color-accent-confirm);
    color: var(--a-color-paper);
    transition: background-color 0.15s ease;
  }
  .paper-submit:hover {
    background: var(--a-color-accent-confirm-hover);
  }
  ```
- [ ] **Step 2: 修改 MusicCreationFlowDrawer.vue 错误提示与动作按钮**
  修改 `src/components/music/MusicCreationFlowDrawer.vue`，将 `.error-message` 色彩改为 `var(--a-color-accent-destructive)`，将 `.paper-submit` 背景改为 `var(--a-color-accent-confirm)`，Hover 改为 `var(--a-color-accent-confirm-hover)`：
  ```css
  .error-message {
    margin: 0;
    color: var(--a-color-accent-destructive);
    font-family: var(--a-font-meta);
    font-size: 0.82rem;
    font-weight: 800;
  }
  .paper-submit {
    background: var(--a-color-accent-confirm);
    color: var(--a-color-paper);
    transition: background-color 0.15s ease;
  }
  .paper-submit:hover {
    background: var(--a-color-accent-confirm-hover);
  }
  ```
- [ ] **Step 3: 修改 ArtistDrawer.vue 和 AlbumDrawer.vue 错误态色值**
  修改 `src/components/music/ArtistDrawer.vue` 和 `src/components/music/AlbumDrawer.vue` 中 `.state-line--error` 色彩：
  ```css
  .state-line--error { color: var(--a-color-accent-destructive); }
  ```
- [ ] **Step 4: 运行单元测试与构建**
  运行：`bun run test:unit tests/unit/components/music/`
  运行：`bun run build`
  Expected: 测试与打包全部成功。
- [ ] **Step 5: 提交 Git**
  ```bash
  git add src/components/music/NestedActionDrawer.vue src/components/music/MusicCreationFlowDrawer.vue src/components/music/ArtistDrawer.vue src/components/music/AlbumDrawer.vue
  git commit -m "style: map drawer submit and error classes to accent color variables"
  ```

---

### Task 3: 专辑创建步骤表单与删除按钮

**Files:**
- Modify: `src/components/music/MusicCreationAlbumSeedStep.vue`
- Modify: `src/components/music/MusicCreationArtistStep.vue`
- Modify: `src/components/music/MusicCreationAlbumDetailsStep.vue`
- Modify: `src/components/music/CorrectionProposalModal.vue`
- Modify: `src/components/music/MusicSourcesSection.vue`

- [ ] **Step 1: 修改 MusicCreationAlbumSeedStep.vue 的输入框聚焦与报错**
  修改 `src/components/music/MusicCreationAlbumSeedStep.vue`：
  - 输入框聚焦下边框颜色改为 `var(--a-color-accent-confirm)`。
  - 报错行 `.state-line--error` 属性改为 `color: var(--a-color-accent-destructive)`。
  - 创建确认按钮 `.paper-submit` 映射为 `var(--a-color-accent-confirm)`，Hover 为 `var(--a-color-accent-confirm-hover)`。
- [ ] **Step 2: 修改 MusicCreationArtistStep.vue 输入框聚焦与报错**
  修改 `src/components/music/MusicCreationArtistStep.vue`：
  - 输入框聚焦下边框颜色改为 `var(--a-color-accent-confirm)`。
  - `.state-line--error` 属性改为 `color: var(--a-color-accent-destructive)`。
- [ ] **Step 3: 修改 MusicCreationAlbumDetailsStep.vue 与 CorrectionProposalModal.vue 聚焦、报错与删除动作**
  修改 `src/components/music/MusicCreationAlbumDetailsStep.vue`：
  - 输入框聚焦下边框改为 `var(--a-color-accent-confirm)`。
  - 移除音轨动作 `.track-action--danger` 属性改为 `color: var(--a-color-accent-destructive)`。
  - 确认按钮 `.paper-submit` 映射为 `var(--a-color-accent-confirm)`，Hover 为 `var(--a-color-accent-confirm-hover)`。
  修改 `src/components/music/CorrectionProposalModal.vue`：
  - 将报错文字样式 `color: var(--a-color-danger)` 属性改为 `color: var(--a-color-accent-destructive)`。
- [ ] **Step 4: 运行单元测试与构建**
  运行：`bun run test:unit tests/unit/components/music/`
  运行：`bun run build`
  Expected: 测试与打包全部成功。
- [ ] **Step 5: 提交 Git**
  ```bash
  git add src/components/music/MusicCreationAlbumSeedStep.vue src/components/music/MusicCreationArtistStep.vue src/components/music/MusicCreationAlbumDetailsStep.vue src/components/music/CorrectionProposalModal.vue src/components/music/MusicSourcesSection.vue
  git commit -m "style: update form inputs and action step styles with brand accents"
  ```

---

### Task 4: 主页网格、播放器、收藏及关于页面优化

**Files:**
- Modify: `src/views/music/HomeView.vue`
- Modify: `src/components/music/AudioPlayer.vue`
- Modify: `src/views/music/StarredView.vue`
- Modify: `src/views/music/AboutView.vue`

- [ ] **Step 1: 修改 HomeView.vue 卡片边框与 Hover 点睛**
  修改 `src/views/music/HomeView.vue`：
  - 将 `.card` 和 `.artist-card` 的默认边框改为 `1px solid var(--a-color-line-soft)`。
  - 将卡片 Hover 时的左激活条颜色改为 `border-left-color: var(--a-color-accent-confirm)`。
  - 将 `.paper-action:hover` 背景色改为 `var(--a-color-accent-confirm)`，文字改为 `var(--a-color-paper)`，阴影改为 `var(--a-shadow-dropdown)`。
  - 报错 `.state-line--error` 属性改为 `color: var(--a-color-accent-destructive)`。
- [ ] **Step 2: 修改 AudioPlayer.vue 播放进度条与音量条高亮**
  修改 `src/components/music/AudioPlayer.vue`：
  - 将播放进度条及音量条填充色改为 `var(--a-color-accent-confirm)`。
- [ ] **Step 3: 修改 StarredView.vue 和 AboutView.vue 阴影与动作**
  修改 `src/views/music/StarredView.vue`：
  - 将卡片阴影改为 `var(--a-shadow-modal)`。
  修改 `src/views/music/AboutView.vue`：
  - 将特性卡片 Hover 阴影改为 `var(--a-shadow-modal)`。
- [ ] **Step 4: 运行单元测试与构建**
  运行：`bun run test:unit tests/unit/components/music/`
  运行：`bun run build`
  Expected: 测试与打包全部成功。
- [ ] **Step 5: 提交 Git**
  ```bash
  git add src/views/music/HomeView.vue src/components/music/AudioPlayer.vue src/views/music/StarredView.vue src/views/music/AboutView.vue
  git commit -m "style: apply cards borders, player fill, and views shadows updates"
  ```
