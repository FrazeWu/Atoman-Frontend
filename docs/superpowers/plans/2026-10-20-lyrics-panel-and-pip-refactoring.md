# Music Lyrics Panel & Desktop PiP Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose the 1303-line monolithic `MusicLyricsPanel.vue` into focused, highly testable subcomponents (`MusicLyricsHeader`, `MusicLyricsVersionHistory`, `MusicLyricsScroller`), extract shared styles into `musicLyrics.css`, and ensure zero regressions across all 41 existing test contracts.

**Architecture:** Split `MusicLyricsPanel.vue` by functional responsibility: header action tools, version diff & revert history, and the scrollable lyrics viewport with centering calculations. The container coordinates selection state, annotation workflows, and lyric editing with conflict arbitration.

**Tech Stack:** Vue 3.4, TypeScript (strict), Vitest, Happy-DOM, TanStack Vue Query, Lucide icons.

## Global Constraints
- **Strict 0 shadow**: `box-shadow: none !important;`
- **Strict 4px radius**: `border-radius: var(--a-radius-control, 4px);`
- **Solid white paper background**: `#FFFFFF` with `1px solid var(--a-color-border-soft)` hairline borders.
- **Contract preservation**: All 41 existing unit tests in `tests/unit/components/music/MusicLyricsPanel.spec.ts` must pass 100%.

---

### Task 1: 拆解并构建 `MusicLyricsHeader.vue` 子组件与独立单测

**Files:**
- Create: `src/components/music/lyrics/MusicLyricsHeader.vue`
- Create: `tests/unit/components/music/lyrics/MusicLyricsHeader.spec.ts`

**Interfaces:**
- Props:
  ```ts
  interface MusicLyricsHeaderProps {
    isReadOnlyAnnotations: boolean
    isAnnotationMode: boolean
    isPlayerMode: boolean
    isPiPSupported: boolean
    isPiPActive: boolean
    saving: boolean
    reverting: boolean
  }
  ```
- Emits:
  ```ts
  interface MusicLyricsHeaderEmits {
    (e: 'open-song-detail'): void
    (e: 'toggle-annotation-overview'): void
    (e: 'toggle-versions'): void
    (e: 'open-editor'): void
    (e: 'toggle-pip'): void
    (e: 'close'): void
  }
  ```

- [ ] **Step 1: 编写单元测试**
  在 `tests/unit/components/music/lyrics/MusicLyricsHeader.spec.ts` 中编写测试：
  - 测试当 `isReadOnlyAnnotations` 为真时渲染 `data-testid="lyrics-open-song-detail"` 按钮并响应点击；
  - 测试当 `!isReadOnlyAnnotations` 时渲染 `data-testid="lyrics-annotations-trigger"` 按钮并能切换注解概览；
  - 测试在非播放器模式下渲染 `data-testid="lyrics-versions-trigger"` 和 `data-testid="lyrics-edit-trigger"`；
  - 测试当 `saving` 或 `reverting` 时禁用编辑按钮；
  - 测试当 `isPlayerMode && isPiPSupported` 时渲染 `data-testid="lyrics-pip-trigger"` 并展示正确的活跃状态文案；
  - 测试点击关闭按钮触发 `close` 事件。

- [ ] **Step 2: 运行测试验证失败**
  ```bash
  bun run test:unit tests/unit/components/music/lyrics/MusicLyricsHeader.spec.ts
  ```

- [ ] **Step 3: 实现 `MusicLyricsHeader.vue`**
  实现组件 DOM 结构与按键派发逻辑，保持与 `MusicLyricsPanel.vue` 第 3~81 行的类名与 testid 一致。

- [ ] **Step 4: 运行测试验证通过**
  ```bash
  bun run test:unit tests/unit/components/music/lyrics/MusicLyricsHeader.spec.ts
  bun run type-check
  ```

- [ ] **Step 5: 提交**
  ```bash
  git commit -m "feat(lyrics): create MusicLyricsHeader subcomponent"
  ```

---

### Task 2: 拆解并构建 `MusicLyricsVersionHistory.vue` 子组件与独立单测

**Files:**
- Create: `src/components/music/lyrics/MusicLyricsVersionHistory.vue`
- Create: `tests/unit/components/music/lyrics/MusicLyricsVersionHistory.spec.ts`

**Interfaces:**
- Props:
  ```ts
  interface MusicLyricsVersionHistoryProps {
    versions: any[]
    versionsLoading: boolean
    versionsErrorMessage: string
    versionsSongId: string
    songId: string
    selectedVersionPreview: {
      version: number
      affectedActiveAnnotationCount: number
      lines: Array<{
        kind: 'unchanged' | 'added' | 'removed' | 'modified'
        currentIndex?: number
        targetIndex?: number
        current?: { text: string; translation?: string }
        target?: { text: string; translation?: string }
      }>
    } | null
    saving: boolean
    reverting: boolean
  }
  ```
- Emits:
  ```ts
  interface MusicLyricsVersionHistoryEmits {
    (e: 'select-preview', version: number): void
    (e: 'revert', version: number): void
  }
  ```

- [ ] **Step 1: 编写单元测试**
  在 `tests/unit/components/music/lyrics/MusicLyricsVersionHistory.spec.ts` 中编写测试：
  - 测试加载中状态显示 `正在加载版本`；
  - 测试错误状态显示 `versionsErrorMessage`；
  - 测试版本为空或歌曲 ID 不匹配时显示 `暂无版本`；
  - 测试版本列表正确渲染各版本的序号与摘要；
  - 测试点击 `lyrics-version-preview-${version}` 触发 `select-preview` 事件；
  - 测试预览展开时渲染受影响注释数量及 diff 行；
  - 测试点击 `lyrics-revert-version-${version}` 触发 `revert` 事件，且在 saving/reverting 时被禁用。

- [ ] **Step 2: 运行测试验证失败**
  ```bash
  bun run test:unit tests/unit/components/music/lyrics/MusicLyricsVersionHistory.spec.ts
  ```

- [ ] **Step 3: 实现 `MusicLyricsVersionHistory.vue`**
  实现组件 DOM 结构，保持与 `MusicLyricsPanel.vue` 第 87~152 行类名与 testid 一致。

- [ ] **Step 4: 运行测试验证通过**
  ```bash
  bun run test:unit tests/unit/components/music/lyrics/MusicLyricsVersionHistory.spec.ts
  bun run type-check
  ```

- [ ] **Step 5: 提交**
  ```bash
  git commit -m "feat(lyrics): create MusicLyricsVersionHistory subcomponent"
  ```

---

### Task 3: 拆解并构建 `MusicLyricsScroller.vue` 子组件与独立单测

**Files:**
- Create: `src/components/music/lyrics/MusicLyricsScroller.vue`
- Create: `tests/unit/components/music/lyrics/MusicLyricsScroller.spec.ts`

**Interfaces:**
- Props:
  ```ts
  interface MusicLyricsScrollerProps {
    songTitle: string
    creditGroups: Array<{ role: string; label: string; names: string[] }>
    activeAnnotationCount: number
    lyrics: any
    loading: boolean
    annotationsByLine: Map<string, any[]>
    currentLineId: string
    isPlayerMode: boolean
    isAnnotationMode: boolean
    isAuthenticated: boolean
    hasTranslation: boolean
    displayMode: 'original' | 'bilingual'
  }
  ```
- Emits:
  ```ts
  interface MusicLyricsScrollerEmits {
    (e: 'update:displayMode', mode: 'original' | 'bilingual'): void
    (e: 'select-text', payload: any): void
    (e: 'open-annotations', payload: any): void
    (e: 'seek', timeSeconds: number): void
  }
  ```
- Exposes:
  - `lyricsLinesElement`: `Ref<HTMLElement | null>`
  - `scrollToActiveLine`: `() => void`

- [ ] **Step 1: 编写单元测试**
  在 `tests/unit/components/music/lyrics/MusicLyricsScroller.spec.ts` 中编写测试：
  - 测试展示歌曲名、贡献者名单与注释数量；
  - 测试有翻译时渲染 `PSegmentedControl` 并支持切换显示模式；
  - 测试加载中与暂无歌词的占位文案；
  - 测试渲染 `MusicLyricsLine` 列表，正确计算 `:active`、`:bilingual`、`:can-select`；
  - 测试用户滚轮/触摸时锁定平滑滚动（2500ms 冷却后恢复）；
  - 测试转发 `select-text`、`open-annotations`、`seek` 事件。

- [ ] **Step 2: 运行测试验证失败**
  ```bash
  bun run test:unit tests/unit/components/music/lyrics/MusicLyricsScroller.spec.ts
  ```

- [ ] **Step 3: 实现 `MusicLyricsScroller.vue`**
  实现歌词视图与平滑定位算法。

- [ ] **Step 4: 运行测试验证通过**
  ```bash
  bun run test:unit tests/unit/components/music/lyrics/MusicLyricsScroller.spec.ts
  bun run type-check
  ```

- [ ] **Step 5: 提交**
  ```bash
  git commit -m "feat(lyrics): create MusicLyricsScroller subcomponent"
  ```

---

### Task 4: 抽离公共样式 `styles/musicLyrics.css` 并精简 `MusicLyricsPanel.vue` 外壳装配

**Files:**
- Create: `src/components/music/styles/musicLyrics.css`
- Modify: `src/components/music/MusicLyricsPanel.vue`
- Test: `tests/unit/components/music/MusicLyricsPanel.spec.ts`

- [ ] **Step 1: 抽离 `src/components/music/styles/musicLyrics.css`**
  抽离面板定位、网格布局、头部按键与版本列表样式。

- [ ] **Step 2: 在 `MusicLyricsPanel.vue` 中组合装配子组件**
  - 引入 `MusicLyricsHeader`、`MusicLyricsVersionHistory`、`MusicLyricsScroller`；
  - 保留容器级职责：注释创建/重绑/投票流程、歌词编辑与 409 冲突仲裁、全屏与移动端适配抽屉；
  - 保持外层类名与暴露的 `requestClose` 实例方法不变。

- [ ] **Step 3: 运行主测试验证全部通过**
  ```bash
  bun run test:unit tests/unit/components/music/MusicLyricsPanel.spec.ts
  ```
  必须 41 项测试全部 100% 绿灯通过。

- [ ] **Step 4: 运行类型检查**
  ```bash
  bun run type-check
  ```

- [ ] **Step 5: 提交**
  ```bash
  git commit -m "refactor(lyrics): compose MusicLyricsPanel using subcomponents and modular styles"
  ```

---

### Task 5: 全量类型检查、全仓音乐测试与构建验证

- [ ] **Step 1: 运行严格 TypeScript 类型检查**
  ```bash
  bun run type-check
  ```
  要求 0 错误。

- [ ] **Step 2: 运行全量音乐与播放器测试**
  ```bash
  bun run test:unit tests/unit/components/music/ tests/unit/composables/usePictureInPictureLyrics.spec.ts tests/unit/stores/player.spec.ts
  ```
  要求全部测试 100% 绿灯。

- [ ] **Step 3: 运行 Vite 生产构建**
  ```bash
  bun run build
  ```
  要求 exit code 0。

- [ ] **Step 4: 合并至 `main` 并推送到远程**
  ```bash
  git checkout main
  git merge feat/lyrics-panel-decomposition-and-pip-refactoring --no-ff -m "refactor(lyrics): decompose lyrics panel and modularize pip scroller components"
  git push origin main
  ```
