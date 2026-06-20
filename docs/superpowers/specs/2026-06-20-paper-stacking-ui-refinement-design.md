# Flat Paper-Stacking UI Design Refinement (直角扁平叠纸风格细化设计规范)

## 1. 目标 (Goal)

规范与细化全站核心 UI 与 Shared 组件的视觉样式与交互表现，使其严格、一致地符合 Atoman 网站的 **无界直角叠纸风格（Borderless White / Flat Paper-Stacking UI）**。

设计核心基于以下高级方针：
* **减少封闭四边框**：凡是可用“底边线（对齐线）”或“左边线（标记线）”代替的组件，一律移除上方和右侧的硬方框。
* **低度色彩情绪**：高亮均采用温润的原生纸张色彩，次要悬浮统一使用 **环保牛皮纸色（#f4ece1）** 和咖啡褐（#6b4f3a）字线。

---

## 2. 组件细化规范 (Component Specifications)

### 2.1 PButton（按钮组件）
* **几何结构**：去除圆角，采用绝对直角（`border-radius: 0px`）。`.p-button-dot` 改为可选属性（默认不渲染）。
* **次要与幽灵按钮（弱边框化）**：移除四周包围框，**仅在底部保留粗划线**（`border-bottom: 2px solid var(--a-color-line)`）。
* **悬浮（Hover）**：底色变为 **环保牛皮纸色（#f4ece1）**，文字及底边线转化为咖啡褐（`#6b4f3a`）。
* **激活（Active）**：应用微小位移 `translateY(1px)`，底线变黑。
* **禁用（Disabled）**：应用签字笔划线划去效果（`text-decoration: line-through`）。

### 2.2 PAvatar（头像组件）
* **维持原状**：保持圆圈头像（`border-radius: 50%`）及原始的图片渲染形式，不应用任何滤镜或不规则裁剪。

### 2.3 PCard / PSurface（卡片与容器）
* **几何结构**：卡片圆角设为 `8px`（与订阅条目 `PEntry` 的圆角对齐）。
* **弱边框化**：**完全移除四周包围边框**，卡片之间仅在底部以 `1px dashed var(--a-color-line-soft)` 虚线分隔。
* **Hover 聚焦**：背景变淡灰 `#f3f4f6`，且左侧浮现 `3px` 宽的黑色墨水线（`border-left: 3px solid var(--a-color-ink)`）。
* **链接下划线**：鼠标悬停在卡片内的 URL/链接文本上时，触发明确的下划线。

### 2.4 PInput / PTextarea / PField（输入字段）
* **维持原状**：保留底线稿纸式输入框风格（本身仅有 `border-bottom`，天然符合弱边框规范）。

### 2.5 PSelect / PDropdown / PPopover（下拉选择与气泡浮层）
* **几何结构**：下拉选择面板（`.p-select-panel`）与气泡菜单面板（`.p-dropdown-panel`/`.p-popover-panel`）去除圆角，采用严格**直角（`0px`）**。
* **背景与边框**：设为**纯白（`#FFFFFF`）**，使用 `1px solid var(--a-color-line-soft)` 细实线包覆。
* **叠纸阴影**：移除弥散阴影，改用 **`3px` 硬偏角投影**（`box-shadow: 3px 3px 0px rgba(0, 0, 0, 0.15)`），表现纸片重叠的硬光影。

### 2.6 PModal / PConfirm（模态弹窗与确认框）
* **几何结构**：直角（`0px` 圆角），纯白底色。
* **叠纸阴影**：改用 **`4px` 硬偏角投影**（`box-shadow: 4px 4px 0px rgba(0, 0, 0, 0.15)`），表现悬浮的高层级感。

### 2.7 PToast（轻提示消息通知）
* **几何结构**：直角（`0px` 圆角），伴有 `2px 2px 0px rgba(0, 0, 0, 0.12)` 硬投影。
* **状态色**：
  * 成功：极淡竹纸绿背景（`#f0fdf4`），配合深绿色实线边框（`#166534`），深绿色文字。
  * 失败：极淡朱砂红背景（`#fef2f2`），配合深红色实线边框（`#991b1b`），深红色文字。

### 2.8 PTab / PBookmarkTab（页签与书签）
* **PTab（弱边框化）**：去除原有的四周封闭小框，改用整排的 `border-bottom: 1px solid var(--a-color-line-soft)`，激活的 Tab 拥有黑色粗底线（`border-bottom-color: var(--a-color-ink)`）。
* **PBookmarkTab**：保持直角细框，激活时边框高亮变黑。

### 2.9 PBadge / PClip / PEmpty（徽章、标记与占位）
* **PBadge**：保持直角与中性黑白灰度，仅以实线、虚线（external）边框区分模块类型，不进行彩色化。
* **PClip**：保持直角。激活（Active）时使用经典反色块（背景变纯黑 `#050505`，文字变白）。
* **PEmpty**：保持纯文本排版（无插画占位）， inherits `PSurface` 的 `8px` 圆角。

### 2.10 PPageHeader / PSectionHeader（排版头部）
* **维持原状**：保持纯文本 clamp 流式字号排版（无框线，无背景）。

### 2.11 PDiscussionFAB（讨论悬浮标）
* **结构优化**：去除圆角为直角，使用 `-2px 2px 0px rgba(0, 0, 0, 0.15)` 硬叠纸投影。
* **悬停反馈**：**保持 Hover 向左平移 4px 的物理位移效果**，Hover 时背景转为品牌咖啡褐（`#6b4f3a`）。

### 2.12 PSheet / PSheetTab（滑动多层叠纸面板）
* **层叠与推移**：多层展开时进行**级联推移**。底层面板在左侧仅露出 `32px` 宽的细缝（其余部分被上层遮挡并向右挤压）。
* **书签把手错落**：书签把手（`PSheetTab`）在纵向垂直错开排列（Sheet 01 把手位于 `top: 32px`，Sheet 02 把手位于 `top: 88px`，依此类推），点击相应把手直接抽走上层面板。
* **把手 Hover**：把手 Hover 时显示环保牛皮纸色高亮（`#f4ece1` 背景 + `#6b4f3a` 字线）。

### 2.13 PVideoCard / PVideoPlayerShell（视频相关组件）
* **PVideoCard**：
  * 视频封面图圆角微调为 **`8px`**（与 `PCard` 对齐）。
  * 封面上的时长、播放量等 overlay 数据小标签去除圆角，改为**严格直角（`0px`）**。
  * 卡片 Hover 时，标题浮现下划线。
* **PVideoPlayerShell**：
  * 播放器黑色容器保持 **`8px` 圆角**。无外包围边框。内部动作按钮遵循统一的 PButton 规范。

### 2.14 PShortcutHints（快捷键提示）
* **几何结构**：浮层提示框及键盘键位 `kbd` 标签改为直角（`0px`）。
* **浮层阴影**：改用 `3px 3px 0px rgba(0,0,0,0.15)` 硬阴影，与 `PDropdown` 对齐。

---

## 3. 实施路径 (Migration Path)
1. **重构全局样式与 CSS 变量**（更新 `src/style.css` 中的 `shadow` 变量与圆角设定）。
2. **重构 UI 核心组件**：依次重写 `PButton.vue`、`PCard.vue`、`PSelect.vue`、`PSidebarItem.vue`、`PTab.vue`、`PDiscussionFAB.vue`、`PDropdown.vue`、`PToast.vue`。
3. **重构 Shared/级联组件**：重写 `PSheet.vue` / `PSheetTab.vue` 的级联挤压及纵向把手排列逻辑，更新 `PVideoCard.vue` 与 `PShortcutHints.vue`。
4. **编译与类型验证**：运行 `bun run type-check` 校验。
