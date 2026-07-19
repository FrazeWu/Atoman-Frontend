# AudioPlayer 音乐播放器极简磨砂重构设计规范

- Date: 2026-07-19
- Status: Approved
- Scope: `src/components/music/AudioPlayer.vue` 视觉样式重构

根据用户反馈与 Atoman 全局「全白双刻痕极简风（Pure-White Double-Notch Minimal System）」规范，我们在此定义 AudioPlayer 的局部精致化样式重构方案。

---

## 1. 核心视觉设计规约 (Visual Style Specifications)

### 1.1 自适应磨砂玻璃底色 (Adaptive Glassmorphism Background)
播放器面板底色将弃用纯实色填充，改为高平滑度的高斯模糊玻璃材质，融入系统亮/暗色主题变化：
- **亮色模式下**：背景色使用 `rgba(255, 255, 255, 0.82)`，辅以 12px 模糊：
  ```css
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-top: 1px solid var(--a-color-border-soft); /* #e2e8f0 */
  ```
- **暗色模式下**：背景色使用深板岩半透 `rgba(15, 23, 42, 0.85)`：
  ```css
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-top: 1px solid var(--a-color-border-dark); /* #334155 */
  ```

### 1.2 播放按钮形状（方形 `4px` 圆角）
遵循极简风规范，彻底移除任何大圆角、圆形或胶囊型按钮：
- 歌曲封面圆角调整为 `4px`。
- **主播放按钮**收拢为标准的 `4px` 方形圆角。

### 1.3 墨水黑 / 宣纸白经典高对比色按钮 (High-Contrast Play Button)
主播放/暂停按钮（`.main-play-btn`）使用黑白极端极简高对比色：
- **在亮色模式下**：按钮为墨水黑填充 background `#0f172a`，文字为白色 `#ffffff`，圆角 `4px`。
- **在暗色模式下**：按钮为纯白填充 background `#ffffff`，文字为深色 `#0f172a`，圆角 `4px`。
- 按钮在 Hover 时轻微下移 `translateY(1px)` 进行轻互动响应，不添加多余的发光或彩色投影。

### 1.4 控制与功能项极简排版
- **切歌/快进辅助按钮**：继续保留纯中文/英文文本。字号设为 `11px`，字重限制为 `500`。常规状态下半透（`opacity: 0.5`），悬浮时变为不透明（`opacity: 1`）并显示下划线。
- **布局结构关系**：保持原版播放器的双行垂直堆叠结构，即第一行为播放控制按钮（快退、上一首、主播放、下一首、快进），第二行为进度条与时间戳，进度条在其下方自适应拉伸。
- **歌词按钮**：保持纯文本“词”键样式（`11px` 极简文本，与切歌文本的视觉风格一致）。
- **音量弹出滑块浮层**：悬浮音量按钮时弹出的竖向音量面板采用**自适应磨砂玻璃材质**（亮色下亮白半透，暗色下深岩半透），**无阴影**，四角使用 **`4px` 圆角**。滑块有效填充仍保留邮差绿（`#0d9488`）。
- **播放队列角标**：采用方形平整角标（数字放在“队列”文字右侧，使用灰色平整底框 `03`，如：`队列 03`），弃用圆形悬浮气泡。
- **歌手信息排版**：歌曲封面尺寸调整为 `44px` 配合 `4px` 圆角。歌名旁或下方的歌手名强制使用等宽字体（`var(--a-font-mono)`），英文全大写，字符间距增加 `0.08em`，并添加大写类型前缀（如 `TRACK // ANTIGRAVITY`），实现高精度版式降噪。
- **进度/音量点睛色**：滑块高亮与有效部分保留 **邮差绿（`var(--a-color-accent-confirm)`，`#0d9488`）**。

---

## 2. 实施技术规划

### 2.1 样式更新代码映射 (`AudioPlayer.vue`)
- 重构 `.player` 定位，支持 CSS 变量或亮暗属性自适应的磨砂质感背景。
- 更新 `.main-play-btn` 类，实现亮暗自适应的高对比色块填充样式与方形 4px 圆角。
- 确保封面图容器 `.cover-wrap` 与音量/进度指示点为 `4px` 圆角。
- 重新编排右侧音量悬浮浮层与队列角标 CSS 类。
