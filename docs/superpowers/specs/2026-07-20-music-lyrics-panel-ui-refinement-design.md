# MusicLyricsPanel 歌词与注解面板极简磨砂重构设计规范

- Date: 2026-07-20
- Status: Approved
- Scope: `src/components/music/MusicLyricsPanel.vue`, `src/components/music/MusicLyricsLine.vue`, `src/components/music/MusicAnnotationPanel.vue`, `src/components/music/MusicAnnotationEditor.vue`

根据用户反馈与 Atoman 全局「全白双刻痕极简风」规范，我们在此定义 MusicLyricsPanel 组件极其侧边栏注解系统的局部精致化样式重构方案。

---

## 1. 核心视觉设计规约 (Visual Style Specifications)

### 1.1 自适应磨砂玻璃滑出大浮层 (Adaptive Glassmorphism Bottom Sheet)
歌词面板作为滑出大浮层，底色放弃纯实色填充，使用高平滑度的高斯模糊玻璃材质，融入系统亮/暗色主题变化：
- **亮色模式下**：背景色使用 `rgba(255, 255, 255, 0.85)`，辅以 20px 模糊：
  ```css
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid var(--a-color-border-soft); /* #e2e8f0 */
  box-shadow: none; /* 彻底移除投影 */
  ```
- **暗色模式下**：背景色使用深岩半透 `rgba(15, 23, 42, 0.88)`：
  ```css
  background: rgba(15, 23, 42, 0.88);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid var(--a-color-border-dark); /* #334155 */
  box-shadow: none;
  ```

### 1.2 精密左对齐与等宽时间线 (Left Aligned Timeline)
歌词行列表（`MusicLyricsLine.vue`）摒弃经典居中，改用严谨的左对齐网格结构：
- **时间指示器**：左侧时间标记强制使用等宽字体 `var(--a-font-mono)`、颜色设为次级灰 `var(--a-color-muted)`、字号设为 `11px`，并与右侧歌词文本保持固定间距的网格对齐。
- **活动高亮行**：活动歌词行文字颜色使用 `var(--a-color-text)`，字重设为 `500`。
- **非活动行**：非活动行歌词文本半透明度降为 `0.3` (`opacity: 0.3`)，以增强视觉对比与专注感。

### 1.3 侧边栏注解与编辑器纸片化 (Flat Paper Annotation)
右侧的注解卡片面板与注解编辑器重构为干净的纸片质感，彻底消除阴影：
- 注解卡片使用单像素实线边框 `1px solid var(--a-color-border-soft)`，圆角大小收拢为统一的 `4px`。
- 活动编辑器去除阴影，使用扁平边框，按钮与表单元素均严格合规（不使用胶囊大圆角）。

---

## 2. 实施技术规划

### 2.1 样式更新代码映射
- 重构 `.music-lyrics-panel` 定位，支持自适应的磨砂质感背景及 20px 模糊。
- 更新 `.music-lyrics-panel__lines` 内部歌词行对齐方式。
- 重构 `MusicLyricsLine.vue` 以支持左对齐、等宽时间线，并在未激活状态下降低不透明度至 `0.3`。
- 重置 `.music-annotation-panel` 与 `.music-annotation-editor` 边框、阴影与圆角参数。
