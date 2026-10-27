# 全站模态 (Modal) 与抽屉 (Sheet) 架构统合设计规范

## 1. 目标与背景

在前端全站演进中，基础图层已建立了统一的层级 Token 体系（`design_system.md`）、无障碍焦点管理机制（`useDialogFocus`）以及零阴影规范。
然而，部分早期业务组件与模块仍遗留手写或不规范的弹窗/抽屉实现：
1. **手写弹窗导致焦点穿透与快捷键失效**：
   - `src/components/shared/MediaPickerModal.vue` 自制了 `<Teleport to="body">`、`<Transition>` 与 `.p-modal-backdrop`，未接入 `useDialogFocus`，缺失 ESC 键退出与 Tab 循环焦点拦截，导致按 Tab 键可直接切换到遮罩层下方的页面元素；
   - `src/components/ui/PShortcutHints.vue` 同样手写了独立 Teleport 与 Backdrop，缺乏循环焦点圈定和关闭后的焦点精准还原；
2. **手写抽屉未接入全局图层与无障碍标准**：
   - `src/components/theme/ThemeCustomizerDrawer.vue` 手写了 `.theme-customizer-root`、`.theme-customizer-backdrop` 及专用动效，脱离了标准 `PSheet` 的 Partial 抽屉契约（缺失统一关闭 Rail、Esc 事件分发与滚动锁定）；
3. **PModal 内部双重 Header 与双重关闭按钮残留**：
   - `src/views/timeline/TimelineHomeView.vue`、`src/views/timeline/PersonMapView.vue`、`src/components/timeline/TimelineEventDetailModal.vue` 在使用标准 `PModal` 时，内部重复塞入了 `.a-modal-header`、`.a-modal-title` 与独立的 `✕` 关闭按钮，造成弹窗头部出现两个并列关闭按钮和两层嵌套 padding。

本阶段目标：
- 废弃零散手写弹窗/抽屉结构，收网至标准 [`PModal.vue`](file:///Users/fafa/projects/Atoman/Atoman-Frontend/src/components/ui/PModal.vue) 与 [`PSheet.vue`](file:///Users/fafa/projects/Atoman/Atoman-Frontend/src/components/ui/PSheet.vue)；
- 全站弹窗与抽屉 100% 具备：ESC 键关闭、Tab 键焦点圈定（Focus Trap）、背景遮罩点击防护、关闭后焦点还原；
- 彻底消灭双重 Header 与双重关闭按钮。

---

## 2. 详细技术方案

### 2.1 视听资源选择器收敛 (`MediaPickerModal.vue`)
- **现状**：自建 Teleport、`.media-picker-backdrop`、`.media-picker-modal` 与自制关闭按钮。
- **重构方案**：
  - 顶层使用 `<PModal :show="open" size="md" title="选择视听资源" :above-player="abovePlayer" @close="handleClose">`；
  - 移除冗余的 `<Teleport>`、`<Transition>`、浮动关闭按钮、手动 ESC 监听与背景点击遮罩逻辑；
  - 清理 `media-picker-backdrop`、`media-picker-modal` 等重复 CSS，完全由 `PModal` 提供标准结构与动画；
  - 自动获得 `useDialogFocus` 带来的循环焦点防逃逸与无障碍属性（`role="dialog"`、`aria-modal="true"`）。

### 2.2 空间装扮抽屉收敛 (`ThemeCustomizerDrawer.vue`)
- **现状**：自建 `.theme-customizer-root`、`.theme-customizer-backdrop`、`.theme-customizer-drawer`。
- **重构方案**：
  - 使用 `<PSheet :show="open" side="right" mode="partial" partial-width="420px" title="装扮空间" close-type="header" :above-player="true" @close="cancel">`；
  - 标题旁“启用”开关迁移至 `PSheet` 的 `#header` 或置于内容顶部第一栏；
  - 底部操作按钮挂载在 `PSheet` 的 `#footer` 插槽中；
  - 删除冗余的自制过渡动画与绝对定位遮罩样式，统一复用 `PSheet` 的右侧滑入动效、ESC 拦截与外部 Rail 点击关闭。

### 2.3 快捷键提示弹窗收敛 (`PShortcutHints.vue`)
- **现状**：保留了全局按键捕获，但弹层部分手写了 Teleport 与 Backdrop。
- **重构方案**：
  - 触发按钮保留，弹层部分切换为 `<PModal :show="open" size="md" :title="title" @close="close">`；
  - 快捷键列表直接作为 `PModal` 的默认插槽内容；
  - 自动补齐 Tab 焦点圈定与无障碍对话框属性。

### 2.4 时间线模态双重 Header 与双重关闭按钮清理
- **涉及文件**：
  - `src/views/timeline/TimelineHomeView.vue`（编辑事件弹窗、新建人物弹窗、历史版本弹窗）
  - `src/views/timeline/PersonMapView.vue`（添加/编辑地点弹窗、编辑人物弹窗）
  - `src/components/timeline/TimelineEventDetailModal.vue`（事件详情弹窗）
- **重构方案**：
  - 将原本写在内部的 `.a-modal-header` 中的标题提升为 `PModal` 的 `:title` 属性；
  - 彻底删除内部手写的 `<button class="a-modal-close">✕</button>`，统一使用 `PModal` 内置的 `p-modal-close-floating`；
  - 移除内部多余的 `.a-modal-body` 包装层，使插槽内容直接渲染在 `p-modal-body` 内，消除双重内边距与布局挤压。

---

## 3. 验收与测试策略

1. **单元测试回归与断言加固**：
   - 更新并确保 `MediaPickerModal.spec.ts`、`ThemeCustomizerDrawer.spec.ts`、`PShortcutHints.spec.ts` 100% 通过；
   - 编写专门测试验证迁移后组件正确渲染 `PModal` / `PSheet` 并响应关闭事件；
   - 验证时间线各弹窗内不再包含重复的 `.a-modal-close` 按钮。
2. **TypeScript 严格类型校验**：
   - 运行 `bun run type-check` 保证 0 error。
3. **全站 Vitest 单元测试全绿**：
   - 运行 `bun run test:unit` 保证 547 个套件全部通过。
4. **双端构建验证**：
   - 运行 `bun run build` 与 `bun run build:mobile`。
