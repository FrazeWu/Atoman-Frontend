# 音乐播放器全局 MiniBar / 抽屉歌词 键盘快捷键与进度微调标准化设计规范

## 1. 目标与背景

为了完善 Atoman 音乐播放器系统（常驻底栏 MiniBar、波形进度条、音量控件、歌词面板与播放列表）的键盘快捷控制与无障碍体验（Accessibility / a11y），确保媒体播放控制符合 WAI-ARIA 1.2 Slider 与 Media Player 标准规范。

核心目标：
1. **全局快捷键精准上下文避让（Smart Shortcut Context Guard）**：
   - 彻底解决按键冲突：当焦点处于输入表单项（`input`、`textarea`、`select`、`[contenteditable="true"]`）、打开的模态对话框（`[role="dialog"]`、`[role="alertdialog"]`、`[aria-modal="true"]`、`PModal`、`PSheet`）、活动搜索浮层（`[role="combobox"]`、`[role="listbox"]`）或视频播放器内时，绝对不拦截或劫持键盘事件；
   - 快捷键体系补全与强化：
     - `Space` / `k`: 播放/暂停；
     - `ArrowLeft` / `j`: 短后退 5 秒；`Alt + ArrowLeft` / `[`: 上一首；`Shift + ArrowLeft`: 长后退 15 秒；
     - `ArrowRight` / `l`: 短前进 5 秒；`Alt + ArrowRight` / `]`: 下一首；`Shift + ArrowRight`: 长前进 15 秒；
     - `ArrowUp` / `ArrowDown`: 音量 ±5%；
     - `m`: 静音/解除静音；
     - `Escape`: 当歌词面板（`showLyrics`）或播放列表（`showQueue`）开启时，按 `Escape` 优先收起面板。
2. **进度条滑块 WAI-ARIA 1.2 Slider 语义与键盘步进微调**：
   - 在 `AudioWaveformProgress.vue` 中的进度条滑块上配置明确的无障碍属性：
     - `role="slider"`
     - `:aria-valuenow="Math.round(currentTime)"`
     - `:aria-valuemin="0"`
     - `:aria-valuemax="Math.round(duration || 0)"`
     - `:aria-valuetext="`${formatTime(currentTime)} / ${formatTime(duration)}`"`
     - `aria-label="播放进度"`
   - 键盘交互增强：
     - `ArrowLeft` / `ArrowDown`: 步进后退 5 秒；
     - `ArrowRight` / `ArrowUp`: 步进前进 5 秒；
     - `Shift + ArrowLeft`: 步进后退 15 秒；
     - `Shift + ArrowRight`: 步进前进 15 秒；
     - `Home`: 快速跳至音频开头（0 秒）；
     - `End`: 快速跳至音频结尾。
3. **音量滑块 WAI-ARIA 1.2 Slider 语义与键盘微调**：
   - 在 `AudioPlayerVolume.vue` 中的音量滑块配置：
     - `role="slider"`
     - `:aria-valuenow="Math.round(volume * 100)"`
     - `:aria-valuemin="0"`
     - `:aria-valuemax="100"`
     - `:aria-valuetext="`${Math.round(volume * 100)}%`"`
     - `aria-label="音量调节"`
   - 键盘方向键步进 ±5%，`Home` 0% 静音，`End` 100% 满音量。
4. **纯平视觉与 0 阴影规范**：
   - 确保 `AudioPlayer.vue`、`AudioPlayerMini.vue`、`AudioPlayerControlsHub.vue`、`AudioPlayerVolume.vue` 无论在收起为仅封面态（cover）、完整 MiniBar 态、悬浮态均强制 `box-shadow: none !important;`，圆角保持 `var(--a-radius-control, 4px)`。
5. **绝对约束守则**：
   - 桌面端顶栏交互与视觉组件（`AppTopbarAuthControls.vue`）**绝不修改任何 CSS/DOM**。

---

## 2. 架构设计与改动范围

### 2.1 涉及文件清单
1. **快捷键与事件分流核心**:
   - `src/utils/musicKeyboardShortcuts.ts` (升级上下文检查 `isMusicShortcutGuarded`，扩充快捷键映射)
   - `src/components/music/AudioPlayer.vue` (接入增强型上下文防护，优化全局监听与 Escape 面板收起)
2. **进度条滑块组件**:
   - `src/components/music/AudioWaveformProgress.vue` (接入 Slider 语义与键盘 5s/15s/Home/End 步进支持)
3. **音量控制组件**:
   - `src/components/music/AudioPlayerVolume.vue` (接入 Slider 语义与键盘 5%/Home/End 步进支持)
4. **测试套件**:
   - `tests/unit/utils/musicKeyboardShortcuts.spec.ts` (升级快捷键解析与上下文防冲突单测)
   - `tests/unit/components/music/AudioWaveformProgress.spec.ts` (进度滑块键盘步进与 Slider 属性单测)
   - `tests/unit/components/music/AudioPlayerVolume.spec.ts` (音量滑块键盘步进与 Slider 属性单测)
   - `tests/unit/ui/music-player-a11y-contract.spec.ts` (新建，静态契约守护 Slider 属性与 0 阴影规范)

---

## 3. 详细设计规格

### 3.1 上下文防护与快捷键体系 (`musicKeyboardShortcuts.ts`)

```ts
export function isMusicShortcutGuarded(target?: EventTarget | null): boolean {
  if (typeof document === 'undefined') return false
  const active = (target as HTMLElement) || document.activeElement
  if (!active || !(active instanceof HTMLElement)) return false

  const tagName = active.tagName.toLowerCase()
  if (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    active.isContentEditable ||
    active.hasAttribute('contenteditable')
  ) {
    return true
  }

  // 检查是否处于模态对话框、抽屉、搜索下拉或编辑器中
  const inGuardedContainer = Boolean(
    active.closest?.(
      '[role="dialog"], [role="alertdialog"], [aria-modal="true"], .p-modal-backdrop, .p-modal, .p-sheet, [role="combobox"], [role="listbox"], .p-editor, .dm-composer, .cm-editor, video, .video-player'
    )
  )

  return inGuardedContainer
}
```

快捷键映射：
- `Space` / `k`: `'toggle-play'`
- `ArrowLeft` / `j`: 短后退 5 秒 (`'skip-back'`)
- `ArrowRight` / `l`: 短前进 5 秒 (`'skip-forward'`)
- `Shift + ArrowLeft`: 长后退 15 秒 (`'skip-back-large'`)
- `Shift + ArrowRight`: 长前进 15 秒 (`'skip-forward-large'`)
- `Alt + ArrowLeft` / `[`: 上一首 (`'previous'`)
- `Alt + ArrowRight` / `]`: 下一首 (`'next'`)
- `ArrowUp`: 音量增加 5% (`'volume-up'`)
- `ArrowDown`: 音量减少 5% (`'volume-down'`)
- `m`: 静音 (`'mute'`)
- `Shift + f`: 打开/关闭歌词 (`'lyrics'`)
- `Escape`: 关闭歌词/播放列表 (`'escape-panel'`)

### 3.2 进度滑块增强 (`AudioWaveformProgress.vue`)

- 属性绑定：
  ```html
  <input
    class="waveform-range"
    type="range"
    role="slider"
    min="0"
    :max="duration || 0"
    step="0.1"
    :value="currentTime"
    :disabled="!duration"
    aria-label="播放进度"
    :aria-valuenow="Math.round(currentTime)"
    :aria-valuemin="0"
    :aria-valuemax="Math.round(duration || 0)"
    :aria-valuetext="`${formatTime(currentTime)} / ${formatTime(duration)}`"
    @input="handleRangeInput"
    @keydown="handleRangeKeydown"
  />
  ```
- 键盘事件 `handleRangeKeydown(e: KeyboardEvent)`:
  - `ArrowLeft` / `ArrowDown`: `e.preventDefault(); emit('seek', Math.max(0, props.currentTime - (e.shiftKey ? 15 : 5)))`
  - `ArrowRight` / `ArrowUp`: `e.preventDefault(); emit('seek', Math.min(props.duration, props.currentTime + (e.shiftKey ? 15 : 5)))`
  - `Home`: `e.preventDefault(); emit('seek', 0)`
  - `End`: `e.preventDefault(); emit('seek', props.duration)`

### 3.3 音量滑块增强 (`AudioPlayerVolume.vue`)

- 属性绑定：
  ```html
  <input
    type="range"
    role="slider"
    min="0"
    max="1"
    step="0.01"
    :value="volume"
    class="vol-slider"
    aria-label="音量调节"
    :aria-valuenow="Math.round(volume * 100)"
    :aria-valuemin="0"
    :aria-valuemax="100"
    :aria-valuetext="`${Math.round(volume * 100)}%`"
    @input="$emit('change', parseFloat(($event.target as HTMLInputElement).value))"
    @keydown="handleVolumeKeydown"
  />
  ```
- 键盘事件 `handleVolumeKeydown(e: KeyboardEvent)`:
  - `ArrowUp` / `ArrowRight`: `e.preventDefault(); emit('change', Math.min(1, Math.round((props.volume + 0.05) * 100) / 100))`
  - `ArrowDown` / `ArrowLeft`: `e.preventDefault(); emit('change', Math.max(0, Math.round((props.volume - 0.05) * 100) / 100))`
  - `Home`: `e.preventDefault(); emit('change', 0)`
  - `End`: `e.preventDefault(); emit('change', 1)`

---

## 4. 自动化契约守护

在 `tests/unit/ui/music-player-a11y-contract.spec.ts` 中针对播放器组件进行静态守护：
- `AudioWaveformProgress.vue`: 守护 `role="slider"`、`:aria-valuenow=`、`:aria-valuemin=`、`:aria-valuemax=`、`:aria-valuetext=` 与 `box-shadow: none !important;`；
- `AudioPlayerVolume.vue`: 守护 `role="slider"`、`:aria-valuenow=`、`:aria-valuemin=`、`:aria-valuemax=`、`:aria-valuetext=`；
- `musicKeyboardShortcuts.ts`: 守护 `isMusicShortcutGuarded` 对 `dialog`、`combobox`、`contenteditable` 的上下文过滤逻辑；
- `AudioPlayer.vue`: 守护 0 阴影规范。
