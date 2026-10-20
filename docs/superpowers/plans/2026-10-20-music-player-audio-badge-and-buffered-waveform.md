# 播放器下一步优化实施计划（方向 1 & 2）

本计划针对播放器的 **视觉质感与信息层级（方向 1）** 及 **核心播放手感与音频引擎（方向 2）** 进行细致落地。

---

## 优化目标与范围

1. **音质与格式微标（Audio Quality & Format Badge）**
   - 在桌面端播放器的曲目信息区（`AudioPlayerTrackInfo.vue`）中，引入与 Atoman 纯白极简系统一致的微标（如 `LOSSLESS` / `FLAC` / `Hi-Res` / `320K`）。
   - 根据歌曲音频信息（扩展名、`audio_url` 或无损标识）自动识别与渲染，字号 10px、微边框、4px 圆角。

2. **波形图缓冲进度条（Waveform Buffered Range）**
   - 在 `usePlayerStore()`（`src/stores/player.ts`）中监听 `HTMLAudioElement` 的 `progress` 事件，动态计算并暴露当前播放位置的 `bufferedTime`（已缓冲结束时间点）。
   - 在 `AudioWaveformProgress.vue` 中渲染缓冲进度层（`waveform-buffer-line`），让用户直观掌握高保真音频的网络加载与缓存状态。

3. **平滑切歌淡出防爆音（Smooth Audio Transition / Fade-Out）**
   - 利用 `src/utils/audioEngine.ts` 中的 `fadeOutAudio`，在用户点击切歌或上一首/下一首时执行 200ms 微淡出，消除切歌瞬态的硬切失真。

4. **中屏响应式断点与悬浮微交互精细化**
   - 优化 768px ~ 1180px 范围下的波形图与信息栏弹性自适应，避免文本挤压或换行。

---

## 涉及文件与职责

| 文件 | 职责 |
| :--- | :--- |
| `src/stores/player.ts` | 监听 `progress` 事件，计算并导出 `bufferedTime`，切歌时支持平滑淡出 |
| `src/components/music/AudioWaveformProgress.vue` | 接收 `bufferedTime` prop，渲染浅灰半透明缓冲条，优化时间 hover 提示 |
| `src/components/music/player/AudioPlayerTrackInfo.vue` | 提取音频格式（FLAC/LOSSLESS/Hi-Res），渲染品质徽标 |
| `src/components/music/AudioPlayer.vue` | 连接 `player.bufferedTime` 至波形组件，微调中屏弹性布局 |
| `tests/unit/components/music/AudioWaveformProgress.spec.ts` | 增加波形图缓冲层渲染与计算的单元测试 |
| `tests/unit/components/music/AudioPlayerTrackInfo.spec.ts` | 增加音质徽标渲染与解析的单元测试 |

---

## 分步实施任务

### 任务 1：曲目信息区增加品质徽标（Lossless / Hi-Res Badge）
- **步骤 1**：在 `AudioPlayerTrackInfo.spec.ts` 中编写测试用例，断言当歌曲为无损/FLAC 音频时渲染 `.player-audio-badge`。
- **步骤 2**：在 `AudioPlayerTrackInfo.vue` 中实现音质识别计算属性（根据 `audio_url` 拓展名或媒体属性返回 `LOSSLESS`、`FLAC`、`Hi-Res`）。
- **步骤 3**：按照 Pure-White Minimal 规范编写样式（`10px` monospace、细边框 `var(--a-color-border-soft)`、淡雅字体颜色、`4px` 圆角）。
- **步骤 4**：运行单测并验证。

### 任务 2：播放器底层缓冲状态监听（Audio Element Buffered Tracking）
- **步骤 1**：在 `player.ts` 中增加 `bufferedTime = ref(0)`。
- **步骤 2**：在 `ensureAudio` 中为 `nextAudio` 绑定 `progress` 和 `loadstart` 事件，遍历 `audio.buffered` 计算当前播放位置所覆盖的最大缓冲时间。
- **步骤 3**：切歌时在重置音频前执行微淡出，防止切歌爆音。
- **步骤 4**：更新 `usePlayerStore` 导出属性。

### 任务 3：波形图组件渲染缓冲进度（Waveform Buffered Bar）
- **步骤 1**：在 `AudioWaveformProgress.spec.ts` 中编写测试用例，断言传入 `bufferedTime` 时正确计算并在 DOM 结构中渲染缓冲条。
- **步骤 2**：在 `AudioWaveformProgress.vue` 中新增 `bufferedTime` prop 与 `bufferedRatio` 计算属性。
- **步骤 3**：在波形图底层、未播放波形与已播放波形之间增加 `.waveform-buffer-bar` 元素，呈现微弱的半透明进度条。
- **步骤 4**：在 `AudioPlayer.vue` 中绑定 `:buffered-time="player.bufferedTime"`。

### 任务 4：中屏弹性断点与整体回归验证
- **步骤 1**：微调 `AudioPlayer.vue` 在 768px ~ 1180px 范围下的 flex 伸缩限制。
- **步骤 2**：执行全部单元测试（`bun run test:unit tests/unit/components/music/`）与 UI 契约测试（`bun run test:unit tests/unit/ui/`）。
- **步骤 3**：执行 `bun run type-check`。
- **步骤 4**：提交并推送代码。
