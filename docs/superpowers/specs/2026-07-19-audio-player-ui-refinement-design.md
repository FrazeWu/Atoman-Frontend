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

### 1.2 方形 `4px` 控件与圆角控制
遵循极简风规范，彻底移除任何大圆角、圆形或胶囊型按钮：
- 歌曲封面圆角调整为 `4px`。
- **主播放按钮**、进度滑块轨道端点等，全部收拢为标准的 `4px` 方形圆角。

### 1.3 墨水黑 / 宣纸白经典高对比色按钮 (High-Contrast Play Button)
主播放/暂停按钮（`.main-play-btn`）摒弃亮色填充，回归黑白极端极简高对比色：
- **在亮色模式下**：按钮为墨水黑填充 background `#0f172a`，文字为白色 `#ffffff`，圆角 `4px`。
- **在暗色模式下**：按钮为纯白填充 background `#ffffff`，文字为深色 `#0f172a`，圆角 `4px`。
- 按钮在 Hover 时轻微下移 `translateY(1px)` 进行轻互动响应，不添加多余的发光或彩色投影。

### 1.4 其他控件降噪与高密度排版
- **切歌/快进按钮**：维持文字/无边框 Ghost 按钮形式，悬停时使用 `var(--a-color-text)`。
- **点睛色使用**：播放进度滑块高亮部分与音量条高亮填充，严格保留符合音乐模块规范的 **邮差绿（`var(--a-color-accent-confirm)`，`#0d9488`）**。
- **字重与排版**：标题字重调整为 `500`。时间戳文字使用等宽字体（`var(--a-font-mono)`）。

---

## 2. 实施技术规划

### 2.1 样式更新代码映射 (`AudioPlayer.vue`)
- 重构 `.player` 定位，支持 CSS 变量或亮暗属性自适应的磨砂质感背景。
- 更新 `.main-play-btn` 类，实现亮暗自适应的高对比色块填充样式与方形 4px 圆角。
- 确保封面图容器 `.cover-wrap` 与音量/进度指示点为 `4px` 圆角。
