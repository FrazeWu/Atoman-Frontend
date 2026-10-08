# 创作中心 (Studio) 全站风格对齐与 UI 重构设计规范

- 日期：2026-10-08
- 状态：Approved
- 范围：`Atoman-Frontend` 的 Studio 模块壳层、导航、频道选择器及各子视图

---

## 1. 目标与设计原则

将现有的创作中心（Studio）全面对齐全站的 **全白双刻痕极简风（Pure-White Double-Notch Minimal System）**。消除双层顶栏带来的视觉割裂与样式特例，接入标准模块化框架与侧边栏折叠机制，使界面纯净、紧凑、高效并符合全站一致的用户体验。

### 核心原则
1. **消灭双重 Header**：移除 Studio 自定义的二级顶栏，全站顶部唯一保留 `AppTopbar`。
2. **标准 Module 架构**：采用全站统一的 `.a-module-layout` + `AppSidebar` + `.a-main-content` + `.a-content-frame` 结构。
3. **极简全白视觉**：以纯白表面（`#ffffff`）、柔和分界线（`#e2e8f0`）、`4px` 圆角（`--a-radius-control` / `--a-radius-card`）与克制字重（`500`）为基准，移除旧式彩色混色底色与大面积阴影。
4. **简洁用户态文案**：严格遵循仓库规范，标题只写动作名或内容名，副标题精简至一行硬性信息，去除任何抒情或开发者视角用语。
5. **契约完整性**：保持关键 `data-testid` 与路由覆盖，确保现有自动化测试与可访问性完全兼容。

---

## 2. 布局架构与框架重构

### 2.1 壳层统一（`StudioLayout.vue`）
- 彻底移除模板中的 `<header class="studio-header">` 及其相关的 `3.75rem` 独立高度与额外汉堡菜单。
- 采用全站标准模块布局：
  ```html
  <div class="a-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <AppSidebar module="studio" />
    <main class="a-main-content">
      <div class="a-content-frame">
        <RouterView />
      </div>
    </main>
  </div>
  ```
- 引入 `useSidebar()` 组合式函数，响应全局侧边栏折叠状态。

### 2.2 路由元信息对齐（`src/router/routes/studio.ts`）
- 在 `/studio` 根路由配置中补充 `meta: { requiresAuth: true, hasSidebar: true }`。
- 使 `App.vue` 中的 `hasSidebar` 计算属性生效，`AppTopbar` 中的汉堡折叠按钮可直接控制 Studio 侧栏展开/收起，并激活侧栏遮罩与响应式适配。

### 2.3 清理全局 Hack（`src/style.css`）
- 移除针对 `.studio-layout` 硬编码的样式特例（如 `body:has(.studio-layout) { --a-sidebar-width: 12rem; }`），统一由 `.app-shell.has-sidebar` 变量规范接管。

---

## 3. 频道切换与操作区整合

### 3.1 频道选择器重构（`StudioChannelSelector.vue`）
- 界面风格重塑：
  - 外观：纯白背景（`#ffffff`）、轻量边框（`1px solid #cbd5e1`）、`4px` 圆角。
  - 交互：Hover 边框微调至 `#94a3b8`，获得键盘焦点时使用 `2px solid #2563eb`（明晰蓝），`outline-offset: 2px`。
  - 排版：保留内敛的“频道”前缀或精炼图标，字号 `0.875rem`，高度 `2.5rem`（对齐 `PButton size="sm"`）。
- 兼容性：保留 `data-testid="studio-channel-selector"` 与内部 `<select>` 标签，确保既有逻辑与自动化测试无缝衔接。

### 3.2 页面级头部操作整合
- **概览页（`StudioDashboardView.vue`）**：
  - 在 `PPageHeader` 的 `#action` 插槽中横向排列：`[ StudioChannelSelector ]` + `[ 新建内容 ▾ (PButton Primary) ]` + `[ 频道管理 (PButton Secondary) ]`。
- **内容管理页（`StudioContentView.vue`）**：
  - 头部操作区右侧横向排列：`[ StudioChannelSelector ]` + `[ 新建内容 (PButton Primary) ]`。
- **管理页（`StudioManagementLayout.vue` / `StudioChannelView.vue`）**：
  - 类似地将频道上下文与频道创建/管理动作整合至页面级头部。
- **响应式处理**：
  - 在移动端（屏幕宽度 `< 640px`）自动折行至标题下方全宽流式排列，保障移动端触控面积（最小高度 `2.5rem`）。

---

## 4. 视图与核心组件视觉细化

### 4.1 概览看板（`StudioDashboardView.vue` & `StudioDashboardSection.vue`）
- **指标摘要栏**：
  - 纯白表面、`4px` 圆角、`1px solid #e2e8f0` 细线分割，无投影。
  - 数值使用 `tabular-nums` 等宽排布，字重 `500`。
- **模块摘要卡（`StudioDashboardSection`）**：
  - 纯白背景、`1px solid #e2e8f0` 细边，无阴影。
  - 图标背景采用冷灰弱背景 `#f1f5f9`，管理与查看数据入口统一采用轻量 Secondary/Ghost 按钮。
- **工作队列与近期列表**：
  - 列表行高统一，Hover 背景过渡为 `#f8fafc`。
  - 状态标签收敛为“标准圆点 + 简练文字”，去除大面积彩色底衬。

### 4.2 二级 Tab 导航（`StudioModuleLayout.vue` & `StudioManagementLayout.vue`）
- 移除目前使用的 `color-mix(...)` 浅蓝底衬。
- 统一为全站标准的纯净下划线 Tab：
  - 常规态：文字色 `#64748b`，透明背景。
  - Hover 态：文字色 `#0f172a`，背景 `#f8fafc`。
  - Active 态：文字色 `#0f172a`，字重 `600`，底部 `2px` 实线明晰蓝（`#2563eb`）指示线。

### 4.3 内容管理与表格（`StudioContentView.vue` & `StudioContentTable.vue`）
- **筛选工具栏**：
  - 搜索框与下拉筛选器严格采用下划线/极简边框样式的 `PInput` 与 `PSelect`，对齐全站列表风格。
- **表格与操作列**：
  - 表头浅灰背景 `#f8fafc`，表行底边 `#e2e8f0`，Hover 呈现轻盈冷灰。
  - 操作列图标按钮遵循 Slimmed 规范，尺寸 `2.25rem`，无冗余重边框，Hover 显露细边与冷灰底色。

### 4.4 编辑抽屉修复（`StudioRouteSheet.vue`）
- 视口高度修正：移除对旧 `.studio-header` 扣除 `3.75rem` 的 hack，抽屉高度修正为标准值 `calc(100dvh - var(--a-topbar-height))`，与 `AppTopbar` 底边缘完美对齐。
- 纯白实底：严格保持 `#ffffff` 实底，无 backdrop blur，遵循系统级 Overlay 契约。

### 4.5 界面文案收敛（遵循 AGENTS.md）
- 页面标题保持简练，仅说明当前操作或内容类型（如“概览”、“博客内容”、“经营目标”）。
- 副标题说明精简至完成任务所必需的指引，去除“把当前频道的目标、行动和周期复盘放在一起”等氛围抒情句。

---

## 5. 测试与验证方案

1. **契约测试保留**：
   - 保持所有关键自动化测试钩子完好：`data-testid="studio-primary-nav"`、`data-testid="studio-channel-selector"`、`data-testid="studio-dashboard-section"` 等。
2. **单元测试验证**：
   - 更新并运行 `tests/unit/views/studio/StudioLayout.spec.ts` 适配新布局。
   - 运行 Studio 相关全量单测：`bun run test:unit tests/unit/views/studio/ tests/unit/components/studio/`。
3. **设计契约与类型检查**：
   - 验证 `tests/unit/ui/design-system-contract.spec.ts` 通过。
   - 执行 `bun run type-check` 保证 TypeScript 严格类型无报错。
   - 执行 `git diff --check` 保证格式规范。
