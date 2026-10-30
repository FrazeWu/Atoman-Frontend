# 音乐播放器全局 MiniBar / 抽屉歌词 键盘快捷键与进度微调标准化实施计划

> **For Agentic Pairing**: 严格执行测试驱动开发 (TDD)。每项任务遵循明确的红灯（RED）到绿灯（GREEN）循环。严禁修改 `AppTopbarAuthControls.vue`。严守纯平 0 阴影（`box-shadow: none !important;`）与 4px 标准圆角规范。

**Goal:** 全面标准化 Atoman 音乐播放器系统（常驻底栏 MiniBar、波形进度条、音量控件、歌词面板与播放列表）的键盘快捷控制与无障碍体验（Accessibility / a11y），强化全局快捷键上下文精准避让，为滑块补齐标准 WAI-ARIA 1.2 Slider 语义与键盘大步长微调，并以静态契约守护 0 阴影规范。

**Architecture:**
- `src/utils/musicKeyboardShortcuts.ts`: 核心快捷键解析与上下文防冲突判定（`isMusicShortcutGuarded`）；
- `src/components/music/AudioPlayer.vue`: 全局快捷键调度中心，接入上下文防护与 Escape 快捷收起；
- `src/components/music/AudioWaveformProgress.vue`: 波形进度条滑块，增加 `role="slider"`、WAI-ARIA 属性与键盘 5s/15s/Home/End 微调；
- `src/components/music/AudioPlayerVolume.vue`: 音量滑块，增加 `role="slider"`、WAI-ARIA 属性与键盘 ±5%/Home/End 微调；
- `tests/unit/utils/musicKeyboardShortcuts.spec.ts`: 快捷键解析与防冲突单测；
- `tests/unit/components/music/AudioWaveformProgress.spec.ts`: 进度滑块 a11y 与键盘微调单测；
- `tests/unit/components/music/AudioPlayerVolume.spec.ts`: 音量滑块 a11y 与键盘微调单测；
- `tests/unit/ui/music-player-a11y-contract.spec.ts`: 全站播放器静态契约测试。

---

### Task 1: 音乐全局快捷键上下文避让与扩展 (`musicKeyboardShortcuts.ts` & `AudioPlayer.vue`)

**Files:**
- Modify: `src/utils/musicKeyboardShortcuts.ts`
- Modify: `src/components/music/AudioPlayer.vue`
- Modify: `tests/unit/utils/musicKeyboardShortcuts.spec.ts`

**Interfaces:**
```ts
export type MusicPlayerShortcut =
  | 'lyrics'
  | 'toggle-play'
  | 'previous'
  | 'next'
  | 'skip-back'
  | 'skip-forward'
  | 'skip-back-large'
  | 'skip-forward-large'
  | 'volume-up'
  | 'volume-down'
  | 'mute'
  | 'escape-panel'

export function isMusicShortcutGuarded(target?: EventTarget | null): boolean
export function resolveMusicPlayerShortcut(event: KeyboardEvent): MusicPlayerShortcut | null
```

- [ ] **Step 1: Write/Update unit tests for shortcuts & context guard**
  - 在 `tests/unit/utils/musicKeyboardShortcuts.spec.ts` 中新增：
    - 验证 `isMusicShortcutGuarded` 对输入框、文本域、`contenteditable` 元素返回 `true`；
    - 验证 `isMusicShortcutGuarded` 对处于 `[role="dialog"]`、`[role="alertdialog"]`、`[aria-modal="true"]`、`[role="combobox"]` 或 `video` 内的元素返回 `true`；
    - 验证 `Shift + ArrowLeft` 解析为 `'skip-back-large'`，`Shift + ArrowRight` 解析为 `'skip-forward-large'`；
    - 验证 `Escape` 解析为 `'escape-panel'`；
    - 验证当按键在普通空白页面触发时 `isMusicShortcutGuarded` 返回 `false`。

- [ ] **Step 2: Run tests to observe failure (RED)**
  - 运行: `bun run test:unit tests/unit/utils/musicKeyboardShortcuts.spec.ts`
  - 预期: FAIL。

- [ ] **Step 3: Implement changes in `musicKeyboardShortcuts.ts` and `AudioPlayer.vue`**
  - 在 `musicKeyboardShortcuts.ts` 中实现 `isMusicShortcutGuarded`；
  - 扩充 `resolveMusicPlayerShortcut` 支持 `Shift + ArrowLeft/Right` 与 `Escape`；
  - 在 `AudioPlayer.vue` 的 `handleGlobalKeydown` 中：
    - 调用 `if (isMusicShortcutGuarded(e.target)) return;`；
    - 当 `shortcut === 'escape-panel'` 且处于 `player.showLyrics` 或 `player.showQueue` 时，关闭面板；
    - 当 `shortcut === 'skip-back-large'` 时执行 `player.skip(-15)`；
    - 当 `shortcut === 'skip-forward-large'` 时执行 `player.skip(15)`。

- [ ] **Step 4: Run tests to verify pass (GREEN)**
  - 运行: `bun run test:unit tests/unit/utils/musicKeyboardShortcuts.spec.ts tests/unit/components/music/AudioPlayer.spec.ts`
  - 预期: PASS。

- [ ] **Step 5: Run type-check**
  - 运行: `bun run type-check`
  - 预期: 0 errors。

- [ ] **Step 6: Commit**
  - 运行: `git commit -am "feat(music): add smart context guarding and expanded shortcuts to music player"`

---

### Task 2: 波形进度条滑块 WAI-ARIA Slider 语义与键盘步进微调 (`AudioWaveformProgress.vue`)

**Files:**
- Modify: `src/components/music/AudioWaveformProgress.vue`
- Modify: `tests/unit/components/music/AudioWaveformProgress.spec.ts`

**Interfaces:**
- `<input class="waveform-range">`:
  - `role="slider"`
  - `:aria-valuenow="Math.round(currentTime)"`
  - `:aria-valuemin="0"`
  - `:aria-valuemax="Math.round(duration || 0)"`
  - `:aria-valuetext="`${formatTime(currentTime)} / ${formatTime(duration)}`"`
  - `aria-label="播放进度"`
  - `@keydown="handleRangeKeydown"`
- `handleRangeKeydown(e: KeyboardEvent)`:
  - `ArrowLeft` / `ArrowDown`: `seek(currentTime - (e.shiftKey ? 15 : 5))`
  - `ArrowRight` / `ArrowUp`: `seek(currentTime + (e.shiftKey ? 15 : 5))`
  - `Home`: `seek(0)`
  - `End`: `seek(duration)`

- [ ] **Step 1: Write/Update unit tests in `tests/unit/components/music/AudioWaveformProgress.spec.ts`**
  - 验证 range input 具有 `role="slider"`, `aria-label="播放进度"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax`, `aria-valuetext`；
  - 验证按 `ArrowRight` 触发 `seek` 增加 5 秒；按 `Shift + ArrowRight` 增加 15 秒；
  - 验证按 `ArrowLeft` 触发 `seek` 减少 5 秒；按 `Shift + ArrowLeft` 减少 15 秒；
  - 验证按 `Home` 触发 `seek(0)`，按 `End` 触发 `seek(duration)`。

- [ ] **Step 2: Run tests to observe failure (RED)**
  - 运行: `bun run test:unit tests/unit/components/music/AudioWaveformProgress.spec.ts`
  - 预期: FAIL。

- [ ] **Step 3: Implement changes in `AudioWaveformProgress.vue`**
  - 补全 WAI-ARIA 属性；
  - 编写 `handleRangeKeydown` 并绑定到 `<input class="waveform-range">`；
  - 确保 0 阴影 `box-shadow: none !important;`。

- [ ] **Step 4: Run tests to verify pass (GREEN)**
  - 运行: `bun run test:unit tests/unit/components/music/AudioWaveformProgress.spec.ts`
  - 预期: PASS。

- [ ] **Step 5: Run type-check**
  - 运行: `bun run type-check`
  - 预期: 0 errors。

- [ ] **Step 6: Commit**
  - 运行: `git commit -am "feat(music): standardize waveform progress slider a11y and keyboard step navigation"`

---

### Task 3: 音量滑块 WAI-ARIA Slider 语义与键盘微调 (`AudioPlayerVolume.vue`)

**Files:**
- Modify: `src/components/music/AudioPlayerVolume.vue`
- Modify: `tests/unit/components/music/AudioPlayerVolume.spec.ts`

**Interfaces:**
- `<input class="vol-slider">`:
  - `role="slider"`
  - `:aria-valuenow="Math.round(volume * 100)"`
  - `:aria-valuemin="0"`
  - `:aria-valuemax="100"`
  - `:aria-valuetext="`${Math.round(volume * 100)}%`"`
  - `aria-label="音量调节"`
  - `@keydown="handleVolumeKeydown"`
- `handleVolumeKeydown(e: KeyboardEvent)`:
  - `ArrowUp` / `ArrowRight`: `change(volume + 0.05)`
  - `ArrowDown` / `ArrowLeft`: `change(volume - 0.05)`
  - `Home`: `change(0)`
  - `End`: `change(1)`

- [ ] **Step 1: Write/Update unit tests in `tests/unit/components/music/AudioPlayerVolume.spec.ts`**
  - 验证音量 input 具有 `role="slider"`, `aria-label="音量调节"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-valuetext`；
  - 验证按 `ArrowUp` 触发 `change` 增加 0.05；按 `ArrowDown` 减少 0.05；
  - 验证按 `Home` 触发 `change(0)`，按 `End` 触发 `change(1)`。

- [ ] **Step 2: Run tests to observe failure (RED)**
  - 运行: `bun run test:unit tests/unit/components/music/AudioPlayerVolume.spec.ts`
  - 预期: FAIL。

- [ ] **Step 3: Implement changes in `AudioPlayerVolume.vue`**
  - 补齐 WAI-ARIA 属性；
  - 编写 `handleVolumeKeydown` 并绑定到 `<input class="vol-slider">`；
  - 确保 0 阴影 `box-shadow: none !important;`。

- [ ] **Step 4: Run tests to verify pass (GREEN)**
  - 运行: `bun run test:unit tests/unit/components/music/AudioPlayerVolume.spec.ts`
  - 预期: PASS。

- [ ] **Step 5: Run type-check**
  - 运行: `bun run type-check`
  - 预期: 0 errors。

- [ ] **Step 6: Commit**
  - 运行: `git commit -am "feat(music): standardize volume slider a11y and keyboard volume steps"`

---

### Task 4: 自动化全站播放器无障碍契约测试守护 (`music-player-a11y-contract.spec.ts`)

**Files:**
- Create: `tests/unit/ui/music-player-a11y-contract.spec.ts`

- [ ] **Step 1: Write static contract tests**
  - 静态断言 `AudioWaveformProgress.vue`:
    - `role="slider"`
    - `:aria-valuenow=`
    - `:aria-valuemin=`
    - `:aria-valuemax=`
    - `:aria-valuetext=`
    - `aria-label="播放进度"`
    - `handleRangeKeydown`
    - `box-shadow: none !important;`
  - 静态断言 `AudioPlayerVolume.vue`:
    - `role="slider"`
    - `:aria-valuenow=`
    - `:aria-valuemin=`
    - `:aria-valuemax=`
    - `:aria-valuetext=`
    - `aria-label="音量调节"`
    - `handleVolumeKeydown`
  - 静态断言 `musicKeyboardShortcuts.ts`:
    - `isMusicShortcutGuarded`
    - `[role="dialog"]`
    - `[role="combobox"]`
  - 静态断言 `AudioPlayer.vue`:
    - `isMusicShortcutGuarded`
    - `box-shadow: none !important;`

- [ ] **Step 2: Run contract test**
  - 运行: `bun run test:unit tests/unit/ui/music-player-a11y-contract.spec.ts`
  - 预期: PASS。

- [ ] **Step 3: Commit**
  - 运行: `git commit -am "test(contract): add music player a11y slider and 0-shadow contract tests"`

---

### Task 5: 全站质量验证与双端打包交付

**Files:**
- Documentation: `docs/superpowers/plans/2026-10-29-music-player-keyboard-and-a11y.md`
- Kanban: `<appDataDir>/brain/72e9f847-045b-4790-a46f-1fe17ce2f1c1/frontend-refactor-status.md`

- [ ] **Step 1: Run TypeScript strict check**
  - 运行: `bun run type-check`
  - 预期: 0 errors。

- [ ] **Step 2: Run all full unit test suites**
  - 运行: `bun run test:unit`
  - 预期: 100% 全部通过。

- [ ] **Step 3: Run dual-bundle production build**
  - 运行: `bun run build && bun run build:mobile`
  - 预期: 双端构建成功 0 errors。

- [ ] **Step 4: Update kanban status**
  - 更新看板并记录本阶段成果。

- [ ] **Step 5: Commit and push**
  - 运行: `git push origin main`
  - 向用户汇报交付成果，并明确告知下一阶段建议处理内容。
