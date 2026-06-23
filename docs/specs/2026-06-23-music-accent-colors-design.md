# Atoman 音乐模块双点睛色与高密度排版重构设计规范

本规范旨在根据 Atoman 网站的“扁平纸叠（Flat Paper-Stacking）”设计体系，对音乐模块进行精致化与高密度重构。我们引入了邮差绿与朱红橘双点睛色系统，精细化排版字号层级，收敛边框对比度，以塑造如 Cloudflare Dashboard 般的专业和高端质感。

---

## 1. 核心点睛色与 CSS 变量 (Brand Accent Colors)

我们在全局 [style.css](file:///root/Atoman/Atoman-Frontend/src/style.css) 的 `:root` 变量中定义以下语义化变量：

```css
:root {
  /* ... 原有设计变量 ... */

  /* Atoman 语义化点睛色 */
  --a-color-accent-confirm: #0d9488;           /* 邮差绿 (Postman Green) - 确认/正常/建设性动作 */
  --a-color-accent-confirm-hover: #0f766e;     /* Hover 加深 */
  --a-color-accent-destructive: #ea580c;       /* 朱红橘 (Vermilion Orange) - 删除/警告/破坏性动作 */
  --a-color-accent-destructive-hover: #c2410c; /* Hover 加深 */
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
* **确认类核心动作**（如提交编辑、创建艺术家、确认保存）：
  * `.paper-submit`：
    * 背景色：`var(--a-color-accent-confirm)`。
    * 悬浮态（`:hover`）：`var(--a-color-accent-confirm-hover)`。
    * 文字颜色：`var(--a-color-paper)`。
  * `.form-success`：文字颜色映射为 `var(--a-color-accent-confirm)`。
  * `.section-dot`（正常/审核通过态）：背景映射为 `color-mix(in srgb, var(--a-color-accent-confirm) 72%, transparent)`。
  * `PButton[variant="primary"]` / `a-btn--primary`：继承并采用这一绿色高亮体系。
* **删除与警示类动作**（如驳回、取消、移除音轨、清空）：
  * `.track-action--danger` / `PReject` (Hover 态) / `a-btn--danger`：
    * 文字或背景映射为 `var(--a-color-accent-destructive)`。
  * `.form-error` / `.error-message` / `.state-line--error`：文字颜色映射为 `var(--a-color-accent-destructive)`。
  * `.section-dot`（争议/被驳回/草稿态）：背景映射为 `color-mix(in srgb, var(--a-color-accent-destructive) 72%, transparent)`。
* **次级普通按钮 Hover 点睛**：
  * `.paper-action:hover`：背景色从原本的黑白颠倒修改为 `color-mix(in srgb, var(--a-color-paper-wash) 78%, var(--a-color-paper))` 并搭配邮差绿的微调，或根据动作属性应用对应的 `confirm`/`destructive` 高亮背景。

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
