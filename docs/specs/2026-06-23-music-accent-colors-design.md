# Atoman 音乐模块双点睛色与高密度排版重构设计规范

> 视觉优先级：本文件的 Primary 绿色和“删除/警告共用橙色”规则已由[全局 UI 规范](./2026-06-05-flat-paper-ui-design.md)取代。当前 Primary 统一使用明晰蓝；绿色只用于成功与播放进度；红色用于破坏性动作；橙色用于警告、待处理和可恢复异常。其余音乐模块的高密度排版与播放器语义继续有效，但圆角、边界、阴影、字重和图标仍以全局规范为准。

本规范旨在根据 Atoman 网站的“扁平纸叠（Flat Paper-Stacking）”设计体系，对音乐模块进行精致化与高密度重构。我们引入了邮差绿与朱红橘双点睛色系统，精细化排版字号层级，收敛边框对比度，以塑造如 Cloudflare Dashboard 般的专业和高端质感。

---

## 1. 核心点睛色与 CSS 变量 (Brand Accent Colors)

我们在全局 [style.css](../../src/style.css) 的 `:root` 变量中定义以下语义化变量：

```css
:root {
  /* ... 原有设计变量 ... */

  /* Atoman 语义化点睛色 */
  --a-color-accent-confirm: #0d9488;           /* 邮差绿 (Postman Green) - 确认/正常/建设性动作 */
  --a-color-accent-confirm-hover: #0f766e;     /* Hover 加深 */
  --a-color-warning: #ea580c;                  /* 警告、待处理和可恢复异常 */
  --a-color-danger: #dc2626;                   /* 删除、驳回等破坏性动作 */
}
```

---

## 2. 页面与卡片排版优化 (Layout & Typography)

### 2.1 高密度化与降噪
* **细边界线**：专辑和艺术家卡片的默认边框色彩从明显的深灰收缩为更纤细、透明的 `var(--a-color-line-soft)`（`#e5e7eb`）。
* **卡片 Hover 指示条**：当 Hover 音乐卡片和艺术家卡片时，左侧的 3px 高亮激活条（原本为纯黑色）替换为高亮 **`var(--a-color-accent-confirm)`（邮差绿）**。
* **信息高密度化**：紧凑卡片内边距，去除冗余的空白间隙，增强数据的视觉集中感。

### 2.2 字体层级精细化
* **等宽小标签**：所有小 Kickers 标签（如 `ALBUM`、`TRACK`、`PLAYLIST`）统一强制指定为等宽字体 `font-family: var(--a-font-meta)`，字号下调至 `0.72rem`，增加字符间距 `letter-spacing: 0.08em`。
* **降级元数据色值**：卡片内部的非关键元信息（如发行年份、流派、曲目数量）颜色降级为偏灰的 `var(--a-color-muted)` 或 `var(--a-color-muted-soft)`，烘托主标题的黑色墨水感。

---

## 3. 组件级重映射规范 (Component Refactor Mapping)

### 3.1 动作按钮与交互状态
* **成功与进度状态**：
  * `.paper-submit`：
    * 背景色：`var(--a-color-primary)`。
    * 悬浮态（`:hover`）：`var(--a-color-primary-hover)`。
    * 文字颜色：`var(--a-color-paper)`。
  * `.form-success`：文字颜色映射为 `var(--a-color-accent-confirm)`。
  * `.section-dot`（正常/审核通过态）：背景映射为 `color-mix(in srgb, var(--a-color-accent-confirm) 72%, transparent)`。
  * `PButton[variant="primary"]` / `a-btn--primary` 不继承绿色，统一使用全局 Primary 明晰蓝。
* **删除与警示类动作**：
  * `.track-action--danger` / `PReject` (Hover 态) / `a-btn--danger`：
    * 删除、驳回等破坏性动作映射为 `var(--a-color-danger)`。
  * `.form-error` / `.error-message` / `.state-line--error` 按后果映射为 Danger 或 Warning。
  * 待处理、可恢复异常映射为 `var(--a-color-warning)`；“取消”默认保持普通次级动作。
* **次级普通按钮 Hover 点睛**：
  * `.paper-action:hover`：使用全局冷灰 Hover 背景；只有明确的成功、警告或危险动作才附加对应语义色。

### 3.2 音乐播放器 (Audio Player)
* **播放进度与音量填充**：
  * 音量滑块和播放进度条的有效高亮填充色从原本的黑色统一修改为 **`var(--a-color-accent-confirm)`（邮差绿）**。
  * 播放/暂停控制项 Hover 颜色点亮为 `var(--a-color-accent-confirm)`。

---

## 4. 实施计划 (Implementation Plan)

1. **第一阶段：定义全局点睛色变量**。修改 `src/style.css`。
2. **第二阶段：重构动作和状态指示器**。修改 `NestedActionDrawer.vue`、`MusicCreationFlowDrawer.vue`、`ArtistDrawer.vue`、`AlbumDrawer.vue`。
3. **第三阶段：重构创建流程表单样式**。修改 `MusicCreationAlbumSeedStep.vue`、`MusicCreationArtistStep.vue`、`MusicCreationAlbumDetailsStep.vue`、`CorrectionProposalModal.vue`。
4. **第四阶段：卡片、播放器与排版精抛光**。修改 `HomeView.vue`、`AudioPlayer.vue`、`StarredView.vue`、`AboutView.vue`。
5. **第五阶段：打包验证与 Regression 检查**。确保 `vite build` 成功。
