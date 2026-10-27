# 桌面端全站「0 阴影」彻底清理与浮层 Token 终极收网设计规范

## 1. 目标与背景

在前序重构阶段中，移动端已实现了 100% 零阴影（Zero Shadow）、4px 圆角与语义 Token 规范，并且完成了软键盘视口自适应机制。
当前全站设计的核心缺口在于桌面端仍遗留多处模糊阴影（Blur > 0）与弱边框浮层：
1. `src/style.css` 全局 Token 中，`--a-shadow-sm/md/lg/hover/active` 以及暗色模式下的 `--a-shadow-dropdown/modal` 仍声明了发光立体投影。
2. 历史部分模态与下拉浮层（如 `.p-modal`、`AppTopbarAuthControls.vue` 中的 `.dropdown`）使用了 `border: none;` 并依赖阴影做层级区分；一旦单纯去除阴影，会导致浮层与背景融合。
3. 多个业务组件（`AudioPlayerVolume.vue`、`VideoPlayerControls.vue`、`PDirectoryNav.vue`、`PImageLightbox.vue`、`ThemePresetControl.vue` 等）包含局部硬编码 `box-shadow` 及 `#ffffff` 等非语义颜色。

本阶段目标：
- 全局 Token 源头彻底清零：浅色与深色模式下所有外层立体阴影全部收敛为 `none`；
- 浮层 1px 语义边框（Border Contract）加固：确保所有弹出菜单、对话框、浮层悬浮窗具有清晰纯平的边界与高对比度；
- 组件硬编码清剿：拔除所有残留的模糊阴影，收敛硬编码色至语义 Token，确保全站双端统一符合“严格 0 阴影、4px 圆角、全语义 Token、杜绝假数据”设计准则。

---

## 2. 详细技术方案

### 2.1 全局 Token 清零与样式契约 (src/style.css)

- **浅色与通用变量定义**：
  ```css
  --a-shadow-button: none;
  --a-shadow-dropdown: none;
  --a-shadow-modal: none;
  --a-shadow-pressed: none;
  --a-shadow-sm: none;
  --a-shadow-md: none;
  --a-shadow-lg: none;
  --a-shadow-hover: none;
  --a-shadow-active: none;
  ```
- **暗色模式媒体查询定义**：
  ```css
  --a-shadow-sm: none;
  --a-shadow-md: none;
  --a-shadow-lg: none;
  --a-shadow-dropdown: none;
  --a-shadow-modal: none;
  --a-shadow-hover: none;
  --a-shadow-active: none;
  ```
- **通用弹窗与浮层类边框兜底**：
  - `.a-modal, .p-modal`：将 `border: none;` 修正为 `border: 1px solid var(--a-color-border);`，`box-shadow: none;`。
  - `.a-popover-panel, .p-dropdown-panel, .p-popover-panel`：保持 `border: var(--a-border);`，`box-shadow: none;`。

### 2.2 基础浮层与控制栏加固

#### A. 用户下拉菜单 (`src/components/system/AppTopbarAuthControls.vue`)
- 修正 `.dropdown`：
  - 移除 `border: none;`，变更为 `border: 1px solid var(--a-color-border);`；
  - 规范圆角：`border-radius: var(--a-radius-card, 4px);`；
  - 明确设置 `box-shadow: none;`。

#### B. 音频播放器音量滑块 (`src/components/music/AudioPlayerVolume.vue`)
- 清除 `.vol-slider::-webkit-slider-thumb` 与 `::-moz-range-thumb` 的 `box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);`；
- 替换 Thumb 背景色 `background: #ffffff;` 为 `background: var(--a-color-surface);`；
- 移除滑块轨道硬编码 `rgba(255, 255, 255, 0.16)`，收敛为 `var(--a-color-border-soft)`。

#### C. 视频播放器控制条 (`src/components/video/VideoPlayerControls.vue`)
- `.vpc-scrubber-handle`：移除 `box-shadow: var(--a-shadow-sm, ...);`，保留纯平圆形滑块，背景使用 `var(--a-color-surface)`；
- `.vpc-preview`（视频画面预览浮窗）：移除 `box-shadow: var(--a-shadow-md);`，保留 1px 实线边框 `border: 1px solid var(--a-color-border-soft);`；
- `.vpc-speed-popover`（倍速悬浮面板）：移除 `box-shadow: var(--a-shadow-md);`，保持 1px 实线边框。

#### D. 图片灯箱与目录浮层 (`src/components/ui/PDirectoryNav.vue` & `src/components/ui/PImageLightbox.vue`)
- `PDirectoryNav.vue`：
  - 移动抽屉 `.p-directory-sheet` 移除 `box-shadow: 0 -12px 28px ...;` 与 `-12px 0 28px ...;`；
  - 依赖其已有的 `border-top` / `border-left: 1px solid var(--a-color-border);` 完成边界区分；
- `PImageLightbox.vue`：
  - `.p-lightbox-image`：移除 `box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);`；
  - 规范圆角：由 `var(--a-radius-control, 0.5rem)` 收敛为 `var(--a-radius-card, 4px)`；
  - 增加细微纯平描边 `border: 1px solid var(--a-color-border-soft);` 防止深色背景下大图融入背景。

#### E. 主题设置与调试面板 (`src/components/theme/ThemePresetControl.vue` & `ThemeCssEditor.vue`)
- `ThemePresetControl.vue`：
  - `.color-check-dot`：清除 `box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);`，背景使用 `var(--a-color-primary-contrast)`;
- `ThemeCssEditor.vue`：
  - `.editor-textarea:focus`：将模糊发光 `box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);` 替换为标准无偏移 focus outline：`outline: 2px solid var(--a-color-primary); outline-offset: 1px; box-shadow: none;`。

---

## 3. 验收与验证标准

1. **零阴影静态扫描**：
   运行 `grep -rn "box-shadow:" src/ | grep -v "box-shadow: none"`，确认不存在任何 blur > 0 的模糊外层阴影。
2. **严格类型校验**：
   `bun run type-check` 0 error。
3. **单元测试回归**：
   `bun run test:unit` 全部通过，并包含对目标组件样式规范的断言。
4. **双端构建验证**：
   `bun run build` (桌面端) 与 `bun run build:mobile` (移动端) 均 100% 成功。
