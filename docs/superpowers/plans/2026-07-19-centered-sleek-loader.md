# 内容区居中流光加载动画 (Centered Sleek Line Loader) 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构现有的 `RouteContentLoading.vue` 组件，将其替换为在内容区正中央水平垂直居中显示的流光进度条与加载文本组合。

**Architecture:** 重构 HTML/CSS 结构，通过 `display: grid` 和 `place-items: center` 实现垂直与水平双重居中，并使用 CSS `animation` 驱动流光进度条在轨道上进行加速-减速的往复循环平移。

**Tech Stack:** Vue 3.5, TypeScript, Vitest, Vue Test Utils.

---

### Task 1: 创建单元测试

**Files:**
- Create: `tests/unit/system/RouteContentLoading.spec.ts`

- [ ] **Step 1: 编写单元测试，验证加载状态的渲染与无障碍属性**

```typescript
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RouteContentLoading from '@/components/system/RouteContentLoading.vue'

describe('RouteContentLoading.vue', () => {
  it('正确渲染包含无障碍 role 与 aria 属性的加载容器', () => {
    const wrapper = mount(RouteContentLoading)
    
    const root = wrapper.find('.route-content-loading')
    expect(root.exists()).toBe(true)
    expect(root.attributes('role')).toBe('status')
    expect(root.attributes('aria-live')).toBe('polite')
    
    const progressTrack = wrapper.find('.progress-line-track')
    expect(progressTrack.exists()).toBe(true)
    
    const progressBar = wrapper.find('.progress-line-bar')
    expect(progressBar.exists()).toBe(true)
    
    expect(wrapper.text()).toContain('正在加载')
    wrapper.unmount()
  })
})
```

- [ ] **Step 2: 运行测试并确保其失败（红灯）**

Run: `bun run test:unit tests/unit/system/RouteContentLoading.spec.ts`
Expected: FAIL (因为缺少 `.progress-line-track` 与 `.progress-line-bar` 元素)

- [ ] **Step 3: 提交初始测试文件**

```bash
git add tests/unit/system/RouteContentLoading.spec.ts
git commit -m "test: add unit test for RouteContentLoading"
```

---

### Task 2: 重构 RouteContentLoading 组件

**Files:**
- Modify: `src/components/system/RouteContentLoading.vue`

- [ ] **Step 1: 替换为居中流光进度条的 HTML 与 CSS 结构**

```vue
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

<style scoped>
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
  width: 180px;
}

/* 进度条背景轨道 */
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

/* 流动动画 */
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
</style>
```

- [ ] **Step 2: 重新运行单元测试并验证其通过（绿灯）**

Run: `bun run test:unit tests/unit/system/RouteContentLoading.spec.ts`
Expected: PASS

- [ ] **Step 3: 运行完整类型检查与前端编译打包**

Run: `bun run type-check && bun run build`
Expected: 编译打包成功，无任何 TypeScript / Vite 报错。

- [ ] **Step 4: 提交代码修改**

```bash
git add src/components/system/RouteContentLoading.vue
git commit -m "feat: implement centered sleek line loader in RouteContentLoading"
```
