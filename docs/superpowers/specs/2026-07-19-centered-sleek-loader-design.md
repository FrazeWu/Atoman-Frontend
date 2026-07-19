# 设计规格说明书 (Spec): 内容区居中流光加载动画 (Centered Sleek Line Loader)

本规格说明书定义了在 Atoman 前端应用中，为路由异步加载组件添加/更新内容区正中间的极简流光进度条的详细技术设计。

## 1. 目标与范围 (Objectives & Scope)

*   **目标**：重构现有的 `RouteContentLoading.vue`，用更加契合 Atoman 网站 UI 风格的“内容区正中央极简流光进度条”代替原有的 Conic 环形 Loading。
*   **触发场景**：异步路由加载时（由 `asyncRouteView.ts` 管理）。
*   **退出场景**：目标路由对应的组件加载完毕后，动画自动卸载并消失。

## 2. 详细设计 (Detailed Design)

### 2.1 组件实现 (`RouteContentLoading.vue`)

我们将替换现有的 `RouteContentLoading.vue` 的实现，包括 HTML 结构与 CSS 样式。

#### HTML 结构
```html
<template>
  <div class="route-content-loading" role="status" aria-live="polite" aria-label="正在加载内容">
    <div class="loading-container">
      <div class="progress-line-track">
        <div class="progress-line-bar"></div>
      </div>
      <div class="loading-text">
        <span>正在加载</span>
        <span class="dot-flow"></span>
      </div>
    </div>
  </div>
</template>
```

#### CSS 样式系统集成
为保证与系统现有 UI 设计高度契合，使用 CSS 变量进行颜色配置：
*   **进度条背景轨道**：`var(--a-color-surface-muted, #f1f5f9)` 或 `var(--a-color-border-soft, #e2e8f0)`
*   **进度条流动色**：`var(--a-color-primary, #2563eb)` 或 `var(--a-color-fg, #0f172a)`
*   **文本颜色**：`var(--a-color-muted, #64748b)`

```css
.route-content-loading {
  display: grid;
  min-height: min(60vh, 32rem);
  place-items: center;
  background: transparent;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  width: 180px; /* 固定宽度，方便指示线居中对齐 */
}

/* 进度条轨道 */
.progress-line-track {
  width: 100%;
  height: 3px;
  background: var(--a-color-border-soft, #e2e8f0);
  border-radius: 2px;
  overflow: hidden;
  position: relative;
}

/* 进度条流动条 */
.progress-line-bar {
  height: 100%;
  width: 35%;
  background: var(--a-color-primary, #2563eb);
  position: absolute;
  left: -35%;
  border-radius: 2px;
  animation: indeterminate-center-bar 1.5s infinite ease-in-out;
}

/* 文字标签 */
.loading-text {
  font-size: var(--a-text-sm, 0.875rem);
  font-weight: 500;
  color: var(--a-color-muted, #64748b);
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
}

.dot-flow::after {
  content: '';
  display: inline-block;
  width: 12px;
  text-align: left;
  animation: dots 1.6s steps(4, end) infinite;
}

/* 动画关键帧：流畅的加减速循环移动 */
@keyframes indeterminate-center-bar {
  0% {
    left: -35%;
    width: 35%;
  }
  50% {
    left: 30%;
    width: 50%;
  }
  100% {
    left: 100%;
    width: 35%;
  }
}

@keyframes dots {
  0%, 20% { content: ''; }
  40% { content: '.'; }
  60% { content: '..'; }
  80%, 100% { content: '...'; }
}
```

## 3. 测试与验证 (Testing & Verification)

1.  **编译与类型检查**：运行 `bun run type-check` 和 `bun run build` 确保没有构建问题。
2.  **单元测试验证**：若有针对 `RouteContentLoading.vue` 的单元测试，进行对应更新。
3.  **UI 效果检查**：在前端开发环境下通过切换路由，肉眼验证加载动画是否正确居中对齐、动画是否平滑，并在组件加载完后正确消失。
