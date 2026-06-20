# Flat Paper-Stacking UI Design Refinement (直角扁平叠纸风格细化设计规范)

## 1. 目标 (Goal)

规范与细化全站核心 UI 组件（`PButton`、`PCard`/`PSurface`、`PSelect`、`PSidebarItem`、`AppTopbar`）的视觉样式与交互表现，使其严格、一致地符合 Atoman 网站的 **无界直角叠纸风格（Borderless White / Flat Paper-Stacking UI）**。

---

## 2. 设计原则与组件细化规范 (Component Specifications)

### 2.1 PButton（按钮组件）
* **几何结构**：去除所有圆角，采用绝对直角（`border-radius: 0px`）。
* **内部修饰圆点**：将内部的 `.p-button-dot` 改为可选属性（默认不渲染，仅在有特定状态提示需求时渲染）。
* **物理拟物交互**：
  * **Hover**：背景略微变亮/泛黄（高亮纸张感），边框呈现细实线。
  * **Active**：使用 `translateY(1px)`，模拟纸张被向下一指按扁的物理感。
  * **Disabled**：文字应用中划线（`text-decoration: line-through`），模拟用黑色签字笔横向划去的效果。

### 2.2 PAvatar（头像组件）
* **不作改动**：保持用户上传的原样及目前的圆形头像样式，不应用灰度滤镜、网点滤镜或齿轮邮票裁剪。

### 2.3 PCard / PSurface（卡片与容器）
* **几何结构**：卡片圆角统一为 `8px`（与订阅条目 `PEntry` 的圆角保持一致），体现亲和力和整洁感。
* **物理拟物交互**：
  * **Hover 状态**：背景变为极淡的灰色 `var(--a-color-paper-wash)` (`#f3f4f6`)，且左侧边框高亮为 `3px` 宽的黑色墨水实线（`border-left-color: var(--a-color-ink)`），继承 `PEntry` 的聚焦特征。
  * **Link 悬浮**：当鼠标悬停在卡片内部的任一 URL 链接（如 `<a>` 或跳转元素）上时，触发明确的下划线（`text-decoration: underline`），保证导向清晰。

### 2.4 PSelect（下拉选择框）
* **几何结构**：下拉选项面板 `.p-select-panel` 舍弃原有的 `1rem` 圆角与弥散阴影，改用严格的**直角（`border-radius: 0px`）**。
* **背景与边框**：面板背景设为**纯白（`#FFFFFF`）**，使用 **`1px solid var(--a-color-line-soft)`** 实线边框，无任何阴影效果。

### 2.5 PSidebarItem（侧边栏选项）
* **几何结构**：移除当前的 `0.875rem` 圆角，改用严格的**直角（`border-radius: 0px`）**。
* **激活与悬浮态**：默认无背景无边框。激活（Active）或悬浮（Hover）时，左侧高亮展示一根 `3px` 宽的黑色墨水实线（`border-left-color: var(--a-color-ink)`），同时背景淡化为 `#f3f4f6`。

### 2.6 AppTopbar（顶部导航栏）
* **几何结构**：导航链接 `.nav-link` 和 `.nav-link-sm` 移除圆角，采用**直角（`border-radius: 0px`）**。
* **激活与悬浮态**：激活（Active）或悬浮（Hover）时呈现直角灰色块背景 `var(--a-color-paper-wash)` (`#f3f4f6`)，不添加多余边框或投影。

---

## 3. 实施路径 (Implementation Steps)

1. **更新 `PButton.vue`**：
   * 将 `border-radius` 从 `999px` 调整为 `0px`。
   * 使 `.p-button-dot` 的渲染由属性 `dot` 控制，默认不渲染。
   * 为 `disabled` 状态添加 `text-decoration: line-through`。
2. **更新 `PCard.vue` / `PSurface.vue`**：
   * 确保 `PCard` 圆角设定为 `8px`。
   * 修改 Hover 样式：背景变 `#f3f4f6`，左边框高亮为 `3px` 黑色墨水线。
   * 为卡片内的链接或子元素在 Hover 时添加 `text-decoration: underline` 联动。
3. **更新 `PSelect.vue`**：
   * 去除 `.p-select-panel` 的 `border-radius: 1rem`。
   * 背景修改为 `white`，添加边框与去除 `box-shadow`。
4. **更新 `PSidebarItem.vue`**：
   * 将 `.p-sidebar-item` 的 `border-radius` 从 `0.875rem` 改为 `0px`，并在左侧添加 `3px solid transparent` 占位。
   * 激活/Hover 状态时，使左边框显示为 `var(--a-color-ink)` 墨水色，背景设为 `var(--a-color-paper-wash)`。
5. **更新 `AppTopbar.vue`**：
   * 将 `.nav-link` 和 `.nav-link-sm` 的 `border-radius` 调整为 `0`。
   * 保持悬停与激活的直角灰块效果。

---

## 4. 验证计划 (Verification Plan)

修改完成后，必须依次运行以下命令：
1. `bun run type-check` 确认 TypeScript 类型无报错。
2. 在主流页面中检查实际视觉还原情况，重点核对：
   * 按钮在 Disabled 时是否展现中划线。
   * 卡片悬停时是否变为灰色背景、左侧显示黑边线，且内部链接呈现下划线。
   * 下拉框面板是否完全变成直角、纯白、有细边框。
   * 侧边栏和顶部导航在激活时是否正确转为直角风格。
