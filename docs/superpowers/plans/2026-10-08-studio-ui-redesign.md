# 创作中心 (Studio) UI 风格对齐实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将创作中心（Studio）彻底改造为与全站一致的全白双刻痕极简风，消除双层顶栏与样式 hack，接入标准模块化框架与侧栏折叠联动，统一频道选择器、看板、内容表格与子导航视觉。

**Architecture:** 移除 `StudioLayout.vue` 的 `.studio-header`，采用标准 `.a-module-layout` + `AppSidebar` + `.a-main-content` 结构，路由增加 `hasSidebar: true` 元信息。将频道选择器与新建按钮整合进页面级 `PPageHeader` 操作区，并按全白双刻痕设计系统重构组件样式与二级下划线 Tab。

**Tech Stack:** Vue 3.5, TypeScript 5.9 (strict), Pinia 3, Vue Router 4, Tailwind CSS v4, Vitest, Playwright.

## Global Constraints

- 全白表面：卡片、面板、Sheet、表格基础背景使用 `#ffffff`。
- 柔和分界：常规边线使用 `#cbd5e1`，内部分割使用 `#e2e8f0`。
- 全局阴影为 `none`，不使用硬投影或装饰性阴影。
- 小圆角：控件与卡片统一使用 `4px` 圆角（`var(--a-radius-control)` / `var(--a-radius-card)`）。
- 克制字重：标题与文字使用 `500`（强调态 `600`），不使用粗黑大字重。
- 主动作使用明晰蓝 `--a-color-primary: #2563eb`。
- 遵循 `AGENTS.md` 文案规范，标题只写动作名或内容名，副标题精简至一行硬性信息，去除任何抒情或内部用语。
- 保持 `data-testid="studio-primary-nav"`、`data-testid="studio-channel-selector"`、`data-testid="studio-dashboard-section"` 等测试契约。

---

### Task 1: 路由元信息与 StudioLayout 壳层标准化

**Files:**
- Modify: `src/router/routes/studio.ts:16-25`
- Modify: `src/views/studio/StudioLayout.vue:1-194`
- Modify: `src/style.css:168-176`
- Test: `tests/unit/views/studio/StudioLayout.spec.ts`

**Interfaces:**
- Consumes: `useSidebar()` from `@/composables/useSidebar`, `AppSidebar` from `@/components/system/AppSidebar.vue`.
- Produces: Standard `.a-module-layout` container with `hasSidebar` route integration.

- [ ] **Step 1: 编写/更新针对标准壳层的失败测试**

编辑 `tests/unit/views/studio/StudioLayout.spec.ts`，断言 `StudioLayout` 拥有 `.a-module-layout` 容器且不再含有旧 `.studio-header`：

```typescript
import { mount } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import { createMemoryHistory, createRouter } from "vue-router";
import { describe, expect, it, vi } from "vitest";

import StudioLayout from "../../../../src/views/studio/StudioLayout.vue";
import { useStudioStore } from "../../../../src/stores/studio";

describe("StudioLayout", () => {
  it("renders standard a-module-layout shell and five primary nav items", async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/studio", component: { template: "<div />" } },
        { path: "/studio/blog", component: { template: "<div />" } },
        { path: "/studio/podcast", component: { template: "<div />" } },
        { path: "/studio/video", component: { template: "<div />" } },
        { path: "/studio/channel", component: { template: "<div />" } },
      ],
    });
    await router.push("/studio");
    await router.isReady();
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true });
    const store = useStudioStore(pinia);
    store.loaded = true;
    store.currentChannel = {
      id: "channel-1",
      name: "主频道",
      slug: "main",
      description: "",
      cover_url: "",
    };
    store.channels = [store.currentChannel];

    const wrapper = mount(StudioLayout, {
      global: { plugins: [pinia, router] },
    });

    expect(store.loadState).toHaveBeenCalledOnce();
    expect(wrapper.find(".a-module-layout").exists()).toBe(true);
    expect(wrapper.find(".studio-header").exists()).toBe(false);
    expect(
      wrapper
        .findAll('[data-testid="studio-primary-nav"] a')
        .map((link) => link.text()),
    ).toEqual(["概览", "管理", "博客", "播客", "视频"]);
  });

  it("keeps channel settings reachable before the first channel exists", async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: "/studio/channel",
          component: {
            template: '<div data-testid="channel-page">频道页面</div>',
          },
        },
      ],
    });
    await router.push("/studio/channel");
    await router.isReady();
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true });
    const store = useStudioStore(pinia);
    store.loaded = true;
    store.currentChannel = null;
    store.channels = [];

    const wrapper = mount(StudioLayout, {
      global: { plugins: [pinia, router] },
    });

    expect(wrapper.find('[data-testid="channel-page"]').exists()).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

运行：`bun run test:unit tests/unit/views/studio/StudioLayout.spec.ts`
预期：FAIL（`.a-module-layout` 不存在或 `.studio-header` 存在）。

- [ ] **Step 3: 实现路由元信息与 StudioLayout 重构**

1. 修改 `src/router/routes/studio.ts`：
```typescript
	{
		path: "/studio",
		component: () => import("@/views/studio/StudioLayout.vue"),
		meta: { requiresAuth: true, hasSidebar: true },
		children: [
```

2. 重写 `src/views/studio/StudioLayout.vue`：
```vue
<template>
  <div class="a-module-layout studio-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <div id="studio-primary-navigation" data-testid="studio-primary-nav" class="studio-sidebar-wrapper">
      <AppSidebar module="studio" class="studio-sidebar" aria-label="创作中心" />
    </div>

    <main class="a-main-content studio-main-content" tabindex="-1">
      <div class="a-content-frame">
        <p v-if="studio.loading && !studio.loaded" class="studio-state">加载中...</p>
        <div v-else-if="studio.error && !studio.loaded" class="studio-state" role="alert">
          <p>{{ studio.error }}</p>
          <button type="button" @click="studio.loadState(true)">重试</button>
        </div>
        <section v-else-if="studio.loaded && !studio.currentChannel && !isManagementRoute" class="studio-empty">
          <h1>还没有频道</h1>
          <RouterLink :to="{ path: '/studio/manage/channel', query: { return_to: route.fullPath } }">创建频道</RouterLink>
        </section>
        <RouterView v-else v-slot="{ Component }">
          <component v-if="Component" :is="Component" />
        </RouterView>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'

import AppSidebar from '@/components/system/AppSidebar.vue'
import { useSidebar } from '@/composables/useSidebar'
import { useStudioStore } from '@/stores/studio'

const studio = useStudioStore()
const route = useRoute()
const { sidebarCollapsed } = useSidebar()

const isManagementRoute = computed(() => (
  route.path.startsWith('/studio/manage') || route.path.startsWith('/studio/channel')
))

onMounted(() => {
  void studio.loadState()
})
</script>

<style scoped>
.studio-layout {
  min-height: calc(100dvh - var(--a-topbar-height, 3.5rem));
}

.studio-sidebar-wrapper {
  display: contents;
}

.studio-state,
.studio-empty {
  max-width: 42rem;
  margin: 2rem auto;
  text-align: center;
}

.studio-state button {
  margin-top: 0.75rem;
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--a-color-border);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  cursor: pointer;
}

.studio-empty h1 {
  font-size: 1.25rem;
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.studio-empty a {
  display: inline-flex;
  align-items: center;
  min-height: var(--a-control-height-sm, 2.25rem);
  padding: 0 0.875rem;
  border-radius: var(--a-radius-control);
  background: var(--a-color-primary);
  color: var(--a-color-primary-contrast);
  text-decoration: none;
  font-size: 0.875rem;
}

.studio-empty a:hover {
  background: var(--a-color-primary-hover);
}
</style>
```

3. 清理 `src/style.css` 中的 `body:has(.studio-layout)` 块（第 168-176 行）。

- [ ] **Step 4: 运行测试验证通过**

运行：`bun run test:unit tests/unit/views/studio/StudioLayout.spec.ts`
预期：PASS。

- [ ] **Step 5: 提交代码**

```bash
git -C Atoman-Frontend add src/router/routes/studio.ts src/views/studio/StudioLayout.vue src/style.css tests/unit/views/studio/StudioLayout.spec.ts
git -C Atoman-Frontend commit -m "feat(studio): modernize StudioLayout with standard module layout"
```

---

### Task 2: 频道选择器重构与 RouteSheet 视口高度修正

**Files:**
- Modify: `src/components/studio/StudioChannelSelector.vue:1-64`
- Modify: `src/components/studio/StudioRouteSheet.vue:41-56`
- Test: `tests/unit/components/studio/StudioModuleLayout.overlay.spec.ts`

**Interfaces:**
- Consumes: `useStudioStore()` from `@/stores/studio`.
- Produces: `StudioChannelSelector` with `data-testid="studio-channel-selector"` adhering to minimal input styling.

- [ ] **Step 1: 检查现有 overlay 测试**

运行：`bun run test:unit tests/unit/components/studio/StudioModuleLayout.overlay.spec.ts`
预期：PASS。

- [ ] **Step 2: 改造 `StudioChannelSelector.vue`**

将其从生硬的原生选择器转变为精致的全白极简控件：

```vue
<template>
  <div class="studio-channel-selector" data-testid="studio-channel-selector">
    <label :for="selectId" class="studio-channel-selector__label">频道</label>
    <div class="studio-channel-selector__wrapper">
      <select
        :id="selectId"
        :value="studio.currentChannel?.id || ''"
        :disabled="studio.loading || studio.channels.length === 0"
        aria-label="选择频道"
        @change="selectChannel"
      >
        <option v-if="studio.channels.length === 0" value="">暂无频道</option>
        <option v-for="channel in studio.channels" :key="channel.id" :value="channel.id">
          {{ channel.name }}
        </option>
      </select>
      <span class="studio-channel-selector__arrow" aria-hidden="true">▾</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useId } from 'vue'
import { useStudioStore } from '@/stores/studio'

const studio = useStudioStore()
const selectId = useId()

function selectChannel(event: Event) {
  const channelID = (event.target as HTMLSelectElement).value
  if (channelID) void studio.selectChannel(channelID)
}
</script>

<style scoped>
.studio-channel-selector {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  font-size: 0.8125rem;
  color: var(--a-color-muted);
}

.studio-channel-selector__label {
  font-size: 0.75rem;
  color: var(--a-color-muted);
  white-space: nowrap;
}

.studio-channel-selector__wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.studio-channel-selector select {
  appearance: none;
  width: clamp(7.5rem, 16vw, 12rem);
  height: 2.25rem;
  line-height: 2.25rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  padding: 0 1.75rem 0 0.625rem;
  font: inherit;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: border-color var(--a-motion-micro, 140ms) ease;
}

.studio-channel-selector select:hover {
  border-color: var(--a-color-border);
}

.studio-channel-selector select:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 1px;
}

.studio-channel-selector select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.studio-channel-selector__arrow {
  position: absolute;
  right: 0.625rem;
  pointer-events: none;
  font-size: 0.7rem;
  color: var(--a-color-muted);
}

@media (max-width: 640px) {
  .studio-channel-selector {
    width: 100%;
  }
  .studio-channel-selector__wrapper {
    flex: 1;
  }
  .studio-channel-selector select {
    width: 100%;
  }
}
</style>
```

- [ ] **Step 3: 修正 `StudioRouteSheet.vue` 视口高度**

修改 `src/components/studio/StudioRouteSheet.vue`：

```vue
<style scoped>
:global(.studio-route-sheet.p-sheet-layer) {
  min-height: calc(100dvh - var(--a-topbar-height, 3.5rem));
  border: 0;
  box-shadow: none;
}

:global(.studio-route-sheet .sheet-content) {
  padding: 1.25rem clamp(1rem, 3vw, 2rem) 2rem;
}

:global(.studio-route-sheet .sheet-content-inner) {
  width: 100%;
  max-width: none;
}
</style>
```

- [ ] **Step 4: 运行单测验证**

运行：`bun run test:unit tests/unit/components/studio/StudioModuleLayout.overlay.spec.ts`
预期：PASS。

- [ ] **Step 5: 提交代码**

```bash
git -C Atoman-Frontend add src/components/studio/StudioChannelSelector.vue src/components/studio/StudioRouteSheet.vue
git -C Atoman-Frontend commit -m "feat(studio): refine StudioChannelSelector styling and fix RouteSheet height"
```

---

### Task 3: 二级 Tab 导航风格规范化

**Files:**
- Modify: `src/views/studio/StudioModuleLayout.vue:63-73`
- Modify: `src/views/studio/StudioManagementLayout.vue:23-33`
- Test: `tests/unit/components/studio/StudioModuleLayout.overlay.spec.ts`

**Interfaces:**
- Produces: Minimal underline Tab navs in `StudioModuleLayout` and `StudioManagementLayout`.

- [ ] **Step 1: 重构 `StudioModuleLayout.vue` 样式**

移除彩色混色背景与厚重阴影，改为全白极简下划线高亮：

```vue
<style scoped>
.studio-module {
  display: grid;
  gap: 1.5rem;
}

.studio-module__header {
  display: grid;
  gap: 0.75rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.studio-module__header h1 {
  margin: 0;
  font-size: clamp(1.25rem, 1.8vw, 1.5rem);
  font-weight: 500;
  line-height: 1.2;
}

.studio-module__header nav {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  margin-inline: -0.25rem;
  padding-inline: 0.25rem;
  scrollbar-width: none;
}

.studio-module__header nav::-webkit-scrollbar {
  display: none;
}

.studio-module__header a {
  min-height: 2.5rem;
  display: inline-flex;
  align-items: center;
  padding: 0 0.75rem;
  border-bottom: 2px solid transparent;
  color: var(--a-color-muted);
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.studio-module__header a:hover {
  color: var(--a-color-text);
}

.studio-module__header a.router-link-active {
  color: var(--a-color-text);
  font-weight: 600;
  border-bottom-color: var(--a-color-primary);
}
</style>
```

- [ ] **Step 2: 重构 `StudioManagementLayout.vue` 样式**

更新 `src/views/studio/StudioManagementLayout.vue`：

```vue
<style scoped>
.studio-management {
  display: grid;
  gap: 1.5rem;
}

.studio-management__nav {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  margin-inline: -0.25rem;
  padding-inline: 0.25rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  scrollbar-width: none;
}

.studio-management__nav::-webkit-scrollbar {
  display: none;
}

.studio-management__nav a,
.studio-management__nav-unavailable {
  min-height: 2.5rem;
  display: inline-flex;
  align-items: center;
  padding: 0 0.75rem;
  border-bottom: 2px solid transparent;
  color: var(--a-color-muted);
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.studio-management__nav-unavailable {
  cursor: not-allowed;
  opacity: 0.45;
}

.studio-management__nav a:hover {
  color: var(--a-color-text);
}

.studio-management__nav a.router-link-active {
  color: var(--a-color-text);
  font-weight: 600;
  border-bottom-color: var(--a-color-primary);
}
</style>
```

- [ ] **Step 3: 运行测试**

运行：`bun run test:unit tests/unit/views/studio/`
预期：PASS。

- [ ] **Step 4: 提交代码**

```bash
git -C Atoman-Frontend add src/views/studio/StudioModuleLayout.vue src/views/studio/StudioManagementLayout.vue
git -C Atoman-Frontend commit -m "feat(studio): unify secondary tab navigation styling"
```

---

### Task 4: 概览与内容管理视图重构及操作区整合

**Files:**
- Modify: `src/views/studio/StudioDashboardView.vue:1-347`
- Modify: `src/components/studio/StudioDashboardSection.vue:1-98`
- Modify: `src/views/studio/StudioContentView.vue:1-60`
- Modify: `src/components/studio/StudioContentTable.vue:256-308`
- Test: `tests/unit/views/studio/StudioDashboardView.spec.ts`
- Test: `tests/unit/components/studio/StudioDashboardSection.spec.ts`
- Test: `tests/unit/components/studio/StudioContentTable.spec.ts`

**Interfaces:**
- Consumes: `StudioChannelSelector.vue`
- Produces: Integrated `PPageHeader` actions, streamlined `StudioDashboardSection`, and refined `StudioContentTable`.

- [ ] **Step 1: 运行现存相关单测建立基准**

运行：`bun run test:unit tests/unit/views/studio/StudioDashboardView.spec.ts tests/unit/components/studio/StudioDashboardSection.spec.ts tests/unit/components/studio/StudioContentTable.spec.ts`
预期：PASS。

- [ ] **Step 2: 在 `StudioDashboardView.vue` 整合 `StudioChannelSelector` 并收敛文案与卡片视觉**

1. 引入 `StudioChannelSelector`：
```typescript
import StudioChannelSelector from '@/components/studio/StudioChannelSelector.vue'
```
2. 在 `PPageHeader` 的 `#action` 中插入 `StudioChannelSelector`：
```html
    <PPageHeader :title="title" sub="当前频道的创作状态与近期表现" mb="1.5rem">
      <template #action>
        <div class="studio-dashboard__header-actions">
          <StudioChannelSelector />
          <PDropdown v-if="creationActions.length" position="right">
            <template #trigger="{ open }">
              <PButton
                data-testid="dashboard-create"
                type="button"
                size="sm"
                aria-haspopup="menu"
                :aria-expanded="open"
              >
                <Plus :size="16" aria-hidden="true" />
                新建
              </PButton>
            </template>
            <template #default="{ close }">
              <div class="studio-dashboard__create-menu" role="menu" aria-label="新建内容">
                <RouterLink
                  v-for="action in creationActions"
                  :key="action.module"
                  :to="`/studio/${action.module}/new`"
                  role="menuitem"
                  @click="close"
                >
                  <component :is="moduleIcons[action.module]" :size="16" aria-hidden="true" />
                  {{ action.label }}
                </RouterLink>
              </div>
            </template>
          </PDropdown>
          <RouterLink class="studio-dashboard__manage" to="/studio/manage/channel">
            <Settings2 :size="16" aria-hidden="true" />
            管理
          </RouterLink>
        </div>
      </template>
    </PPageHeader>
```
3. 调整 summary 数字样式（去除任何 shadow，纯白底，字重 500，细线网格切分）。

- [ ] **Step 3: 优化 `StudioDashboardSection.vue` 视觉**

重塑 `StudioDashboardSection.vue` 样式：
- 图标采用弱冷灰背景 `#f8fafc`、细边框 `#e2e8f0`。
- 指标排版对齐全白极简风。
- “管理”链接采用 `PButton` secondary 风格或极简细线按钮。

- [ ] **Step 4: 在 `StudioContentView.vue` 头部整合 `StudioChannelSelector` 并优化筛选栏**

在 `StudioContentView.vue` 头部 `studio-content__heading-meta` 中增加 `StudioChannelSelector`：
```html
      <div class="studio-content__heading-meta">
        <StudioChannelSelector />
        <span v-if="studio.contentPagination[module]?.total !== undefined">
          共 {{ studio.contentPagination[module]?.total ?? 0 }} 条
        </span>
        <PButton
          v-if="canCreate"
          data-testid="create-content"
          :to="createRoute"
          size="sm"
        >
          <Plus :size="16" aria-hidden="true" />
          {{ config.createLabel }}
        </PButton>
      </div>
```

- [ ] **Step 5: 优化 `StudioContentTable.vue` 视觉**

优化表格样式：
- `th`：字重 `500`，字号 `0.75rem`，背景 `var(--a-color-surface)`。
- 行高微调，操作列按钮采用紧凑 slim 样式（`height: 2.25rem; width: 2.25rem;`），Hover 呈现细边框与冷灰底色。

- [ ] **Step 6: 运行测试验证**

运行：`bun run test:unit tests/unit/views/studio/StudioDashboardView.spec.ts tests/unit/components/studio/StudioDashboardSection.spec.ts tests/unit/components/studio/StudioContentTable.spec.ts`
预期：PASS。

- [ ] **Step 7: 提交代码**

```bash
git -C Atoman-Frontend add src/views/studio/StudioDashboardView.vue src/components/studio/StudioDashboardSection.vue src/views/studio/StudioContentView.vue src/components/studio/StudioContentTable.vue
git -C Atoman-Frontend commit -m "feat(studio): integrate ChannelSelector into page headers and polish dashboard and table"
```

---

### Task 5: 日历、目标与全站契约最终验证

**Files:**
- Modify: `src/views/studio/StudioCalendarView.vue`
- Modify: `src/views/studio/StudioGoalsView.vue`
- Modify: `src/views/studio/StudioUnifiedCollectionsView.vue`
- Test: `tests/unit/views/studio/StudioCalendarView.spec.ts`
- Test: `tests/unit/views/studio/StudioGoalsView.spec.ts`
- Test: `tests/unit/views/studio/StudioUnifiedCollectionsView.spec.ts`
- Test: `tests/unit/ui/design-system-contract.spec.ts`

**Interfaces:**
- Consumes: Design system pure-white rules & AGENTS.md concise user copy rules.
- Produces: Fully styled and passing Studio test suite.

- [ ] **Step 1: 润色 `StudioCalendarView`、`StudioGoalsView` 与 `StudioUnifiedCollectionsView`**

- `StudioGoalsView.vue`:
  - 收敛副标题文案为简明指引（如 `经营目标`、副标题 `设定与跟踪当前周期目标`），去除冗余说明。
  - 日期输入严格遵循 `YYYY/MM/DD` 序列展示规范。
- `StudioCalendarView.vue`:
  - 纯白网格，今日日期采用克制的明晰蓝指示，非本月日期采用浅灰柔和背景。
- `StudioUnifiedCollectionsView.vue`:
  - 副标题精简为 `整理当前频道的内容专题`。

- [ ] **Step 2: 执行全量 Studio 单元测试**

运行：`bun run test:unit tests/unit/views/studio/ tests/unit/components/studio/`
预期：全部 PASS。

- [ ] **Step 3: 执行设计系统契约测试**

运行：`bun run test:unit tests/unit/ui/design-system-contract.spec.ts`
预期：PASS。

- [ ] **Step 4: 执行全量类型检查**

运行：`bun run type-check`
预期：无类型报错，0 errors。

- [ ] **Step 5: 运行 git diff 检查**

运行：`git -C Atoman-Frontend diff --check`
预期：无空白或格式异常。

- [ ] **Step 6: 提交代码**

```bash
git -C Atoman-Frontend add src/views/studio/StudioCalendarView.vue src/views/studio/StudioGoalsView.vue src/views/studio/StudioUnifiedCollectionsView.vue
git -C Atoman-Frontend commit -m "feat(studio): refine calendar, goals and collections views to complete UI redesign"
```
