# Empty States and Skeleton Screens Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul site-wide empty states (`PEmpty.vue`) and skeleton screens (`PSkeleton.vue`) to achieve pure-white geometric consistency (4px radii, subtle line-art mode), eliminate redundant default kickers, and standardize copy to strict, single-line user-actionable guidelines.

**Architecture:** Refactor foundational feedback primitives (`PEmpty.vue`, `PSkeleton.vue`) with backward-compatible prop interfaces, slot expansions, and strict token adherence. Audit and standardize consumer empty states across `src/views/` (Feed, Music, Studio) following `AGENTS.md`.

**Tech Stack:** Vue 3.5, TypeScript 5.9, CSS Design Tokens (`src/style.css`), Vitest.

## Global Constraints

- Rect radii strictly `var(--a-radius-card, 4px)` or `var(--a-radius-control, 4px)`. No 6px or 999px pills.
- Solid white backgrounds (`var(--a-color-bg)`), borders `1px solid var(--a-color-border-soft)`.
- Empty state titles must only state content name or action name; descriptions must be at most one line of high-value instruction or hard requirement; no developer jargon ("内部", "System", "后台识别", "开发").
- Kicker in `PEmpty.vue` must maintain default `kicker: '暂无内容'` for existing test contract string matching, but must only render when the caller explicitly passes a custom non-default kicker (`props.kicker && props.kicker !== '暂无内容'`).
- Respect `prefers-reduced-motion: reduce`.

---

### Task 1: Redesign `PEmpty.vue` Primitives and Unit Tests

**Files:**
- Create: `tests/unit/ui/PEmpty.spec.ts`
- Modify: `src/components/ui/PEmpty.vue`

**Interfaces:**
- Consumes: Design tokens (`--a-color-text`, `--a-color-muted`, `--a-color-border-soft`)
- Produces: `PEmpty` component with props `title`, `description`, `text`, `sub`, `message`, `kicker`, `align`, `compact`, slots `#icon`, `#action`, default slot.

- [ ] **Step 1: Write unit tests for `PEmpty.vue`**

Create `tests/unit/ui/PEmpty.spec.ts`:
```typescript
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PEmpty from '@/components/ui/PEmpty.vue'

describe('PEmpty.vue', () => {
  it('renders title and description properly', () => {
    const wrapper = mount(PEmpty, {
      props: {
        title: '暂无文章',
        description: '在订阅时间线中查看更新。',
      },
    })
    expect(wrapper.find('.p-empty__title').text()).toBe('暂无文章')
    expect(wrapper.find('.p-empty__description').text()).toBe('在订阅时间线中查看更新。')
    // Default kicker '暂无内容' should not be rendered to prevent noisy duplication
    expect(wrapper.find('.p-empty__kicker').exists()).toBe(false)
  })

  it('renders kicker only when explicitly customized with non-default value', () => {
    const wrapper = mount(PEmpty, {
      props: {
        title: '暂无推荐',
        kicker: '探索',
      },
    })
    expect(wrapper.find('.p-empty__kicker').exists()).toBe(true)
    expect(wrapper.find('.p-empty__kicker').text()).toBe('探索')
  })

  it('supports legacy text and sub aliases', () => {
    const wrapper = mount(PEmpty, {
      props: {
        text: '合集不存在',
        sub: '该合集已被删除或移至其他频道。',
      },
    })
    expect(wrapper.find('.p-empty__title').text()).toBe('合集不存在')
    expect(wrapper.find('.p-empty__description').text()).toBe('该合集已被删除或移至其他频道。')
  })

  it('renders icon and action slots and supports center alignment and compact mode', () => {
    const wrapper = mount(PEmpty, {
      props: {
        title: '暂无数据',
        align: 'center',
        compact: true,
      },
      slots: {
        icon: '<div class="test-icon">icon</div>',
        action: '<button class="test-btn">新建</button>',
      },
    })
    expect(wrapper.classes()).toContain('p-empty--center')
    expect(wrapper.classes()).toContain('p-empty--compact')
    expect(wrapper.find('.test-icon').exists()).toBe(true)
    expect(wrapper.find('.test-btn').exists()).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit tests/unit/ui/PEmpty.spec.ts`
Expected: FAIL (classes and kicker suppression not yet implemented in `PEmpty.vue`).

- [ ] **Step 3: Update `PEmpty.vue`**

Update `src/components/ui/PEmpty.vue`:
```vue
<template>
  <div
    class="p-empty"
    :class="[
      `p-empty--${align}`,
      { 'p-empty--compact': compact }
    ]"
  >
    <div v-if="$slots.icon" class="p-empty__icon">
      <slot name="icon" />
    </div>
    <p v-if="computedKicker" class="p-empty__kicker">{{ computedKicker }}</p>
    <h2 v-if="computedTitle" class="p-empty__title">{{ computedTitle }}</h2>
    <p v-if="computedDescription" class="p-empty__description">{{ computedDescription }}</p>
    <slot v-if="!computedTitle && !computedDescription" />
    <div v-if="$slots.action" class="p-empty__action">
      <slot name="action" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  title?: string
  description?: string
  text?: string
  sub?: string
  message?: string
  kicker?: string
  align?: 'start' | 'center'
  compact?: boolean
}>(), {
  title: '',
  description: '',
  text: '',
  sub: '',
  message: '',
  kicker: '暂无内容',
  align: 'start',
  compact: false,
})

const computedTitle = computed(() => props.title || props.text || props.message)
const computedDescription = computed(() => props.description || props.sub || (props.title ? props.message : ''))
const computedKicker = computed(() => {
  if (!props.kicker || props.kicker === '暂无内容') return ''
  return (computedTitle.value || computedDescription.value) ? props.kicker : ''
})
</script>

<style scoped>
.p-empty {
  display: grid;
  justify-items: start;
  gap: 8px;
  padding: 32px 0;
  width: 100%;
}

.p-empty--center {
  justify-items: center;
  text-align: center;
}

.p-empty--compact {
  padding: 16px 0;
  gap: 6px;
}

.p-empty__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-muted);
  margin-bottom: 2px;
}

.p-empty__kicker,
.p-empty__title,
.p-empty__description {
  margin: 0;
}

.p-empty__kicker {
  color: var(--a-color-muted);
  font-family: inherit;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.05em;
}

.p-empty__title {
  color: var(--a-color-text);
  font-size: 1.0625rem;
  font-weight: 500;
  line-height: 1.4;
}

.p-empty__description {
  color: var(--a-color-muted);
  line-height: 1.5;
  font-size: 0.8125rem;
  max-width: 48ch;
}

.p-empty__action {
  margin-top: 6px;
}

@media (max-width: 767px) {
  .p-empty {
    padding: 24px 0;
  }
  .p-empty--compact {
    padding: 12px 0;
  }
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit tests/unit/ui/PEmpty.spec.ts`
Expected: PASS (4 tests passing).

- [ ] **Step 5: Verify existing UI guidelines contract**

Run: `bun run test:unit tests/unit/ui/ui-guidelines.spec.ts`
Expected: PASS (checks `kicker: '暂无内容'` preserved in file).

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/PEmpty.vue tests/unit/ui/PEmpty.spec.ts
git commit -m "feat(ui): refine PEmpty layout and suppress redundant default kicker"
```

---

### Task 2: Standardize `PSkeleton.vue` Radii, Bordered Line-Art Mode, and Motion

**Files:**
- Modify: `src/components/ui/PSkeleton.vue`
- Modify: `tests/unit/ui/PSkeleton.spec.ts`

**Interfaces:**
- Consumes: `--a-radius-card`, `--a-radius-control`, `--a-color-border-soft`, `--a-color-surface-muted`, `--a-color-bg`
- Produces: `PSkeleton` with props `variant`, `width`, `height`, `animated`, `bordered`.

- [ ] **Step 1: Update unit tests for `PSkeleton.vue`**

Update `tests/unit/ui/PSkeleton.spec.ts`:
```typescript
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PSkeleton from '@/components/ui/PSkeleton.vue'

describe('PSkeleton.vue', () => {
  it('正确渲染包含 shimmer 类名与对应的样式尺寸', () => {
    const wrapper = mount(PSkeleton, {
      props: { width: '100px', height: '20px', variant: 'rect' }
    })
    const skeleton = wrapper.find('.p-skeleton')
    expect(skeleton.exists()).toBe(true)
    expect(skeleton.classes()).toContain('p-skeleton--rect')
    expect(skeleton.classes()).toContain('p-skeleton--shimmer')
    expect(skeleton.element.style.width).toBe('100px')
    expect(skeleton.element.style.height).toBe('20px')
    wrapper.unmount()
  })

  it('支持 bordered 边框线框模式', () => {
    const wrapper = mount(PSkeleton, {
      props: { bordered: true }
    })
    expect(wrapper.classes()).toContain('p-skeleton--bordered')
    wrapper.unmount()
  })

  it('支持关闭动画', () => {
    const wrapper = mount(PSkeleton, {
      props: { animated: false }
    })
    expect(wrapper.classes()).not.toContain('p-skeleton--shimmer')
    wrapper.unmount()
  })
})
```

- [ ] **Step 2: Run test to verify it fails on new features**

Run: `bun run test:unit tests/unit/ui/PSkeleton.spec.ts`
Expected: FAIL (missing `p-skeleton--bordered`).

- [ ] **Step 3: Update `PSkeleton.vue`**

Update `src/components/ui/PSkeleton.vue`:
```vue
<template>
  <div
    class="p-skeleton"
    :class="[
      `p-skeleton--${variant}`,
      {
        'p-skeleton--shimmer': animated,
        'p-skeleton--bordered': bordered,
      }
    ]"
    :style="{ width, height }"
  ></div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'text' | 'rect' | 'circle'
  width?: string
  height?: string
  animated?: boolean
  bordered?: boolean
}>(), {
  variant: 'rect',
  width: '100%',
  height: '1rem',
  animated: true,
  bordered: false,
})
</script>

<style scoped>
.p-skeleton {
  background: var(--a-color-surface-muted, #f1f5f9);
  position: relative;
  overflow: hidden;
}

.p-skeleton--text {
  border-radius: var(--a-radius-control, 4px);
  height: 0.85em;
  margin-top: 0.25em;
  margin-bottom: 0.25em;
}

.p-skeleton--rect {
  border-radius: var(--a-radius-card, 4px);
}

.p-skeleton--circle {
  border-radius: 50%;
}

.p-skeleton--bordered {
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  background: var(--a-color-bg, #ffffff);
}

.p-skeleton--shimmer::after {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  transform: translateX(-100%);
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.25) 30%,
    rgba(255, 255, 255, 0.45) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  animation: shimmer 1.6s infinite;
  content: '';
}

@keyframes shimmer {
  100% {
    transform: translateX(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .p-skeleton--shimmer::after {
    animation: none;
    display: none;
  }
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit tests/unit/ui/PSkeleton.spec.ts`
Expected: PASS (all 3 tests pass).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/PSkeleton.vue tests/unit/ui/PSkeleton.spec.ts
git commit -m "feat(ui): standardize PSkeleton 4px radius and add bordered line-art mode"
```

---

### Task 3: Standardize Empty State Copy and Visual Usage Across Modules

**Files:**
- Modify: `src/views/feed/FeedRecommendedView.vue`
- Modify: `src/views/feed/FeedStatsView.vue`
- Modify: `src/views/music/LibraryView.vue`
- Modify: `src/views/music/HistoryView.vue`
- Modify: `src/views/music/SongsView.vue`
- Modify: `src/views/forum/ForumCategoriesView.vue`

- [ ] **Step 1: Refactor Feed empty states**

In `src/views/feed/FeedRecommendedView.vue`:
Replace:
```vue
          <PEmpty
            v-if="!articles.length"
            kicker="文章"
            title="当前分类下暂无文章"
            description="尝试切换其他分类或主题查看更多精选内容。"
          />
```
with:
```vue
          <PEmpty
            v-if="!articles.length"
            title="暂无推荐文章"
            description="切换其他分类或主题查看更多精选内容。"
          />
```
And replace:
```vue
          <PEmpty
            v-if="!channels.length"
            kicker="频道"
            title="当前分类下暂无频道"
            description="尝试切换其他分类或探索更多优质订阅源。"
          />
```
with:
```vue
          <PEmpty
            v-if="!channels.length"
            title="暂无推荐频道"
            description="切换其他分类或探索更多订阅源。"
          />
```

In `src/views/feed/FeedStatsView.vue`:
Replace:
```vue
<PEmpty v-else-if="!stats || !stats.total_read" text="还没有阅读记录" sub="先去刷一会儿 RSS 再来看统计" />
```
with:
```vue
<PEmpty v-else-if="!stats || !stats.total_read" title="暂无阅读记录" description="在订阅时间线中阅读文章后将在此显示统计。" />
```

- [ ] **Step 2: Refactor Music empty states**

In `src/views/music/LibraryView.vue`:
Replace:
```vue
        title="这里还没有收藏内容"
        description="浏览发现页面，收藏你喜爱的专辑、艺术家或歌单。"
```
with:
```vue
        title="暂无收藏内容"
        description="在发现页面收藏你喜爱的专辑、艺术家或歌单。"
```

In `src/views/music/HistoryView.vue`:
Replace:
```vue
      title="还没有播放历史"
      description="去发现页播放一首歌曲，这里会记录你的收听足迹。"
```
with:
```vue
      title="暂无播放历史"
      description="在发现页面播放歌曲后将记录在这里。"
```

In `src/views/music/SongsView.vue`:
Replace:
```vue
    <PEmpty
      v-if="!query.trim() && !tagID"
      title="搜索全库音乐资源"
      description="支持输入歌曲名称、专辑名、艺术家或歌单名称进行全量检索。"
    />
```
with:
```vue
    <PEmpty
      v-if="!query.trim() && !tagID"
      title="搜索音乐"
      description="输入歌曲名、专辑名、艺术家或歌单检索。"
    />
```

- [ ] **Step 3: Refactor Forum empty state**

In `src/views/forum/ForumCategoriesView.vue`:
Replace:
```vue
<PEmpty v-else-if="!categories.length" title="暂无分类" description="论坛分类将在可用时显示在这里。" />
```
with:
```vue
<PEmpty v-else-if="!categories.length" title="暂无分类" />
```

- [ ] **Step 4: Run unit tests for affected views**

Run: `bun run test:unit tests/unit/views/feed/FeedRecommendedView.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/views/feed/FeedRecommendedView.vue src/views/feed/FeedStatsView.vue src/views/music/LibraryView.vue src/views/music/HistoryView.vue src/views/music/SongsView.vue src/views/forum/ForumCategoriesView.vue
git commit -m "style(ui): standardize empty state copy across feed, music, and forum"
```

---

### Task 4: Full Verification and Regression Gate

**Files:**
- All modified files

- [ ] **Step 1: Run type checking**

Run: `bun run type-check`
Expected: 0 errors.

- [ ] **Step 2: Run all unit tests**

Run: `bun run test:unit`
Expected: All tests pass.

- [ ] **Step 3: Run production build**

Run: `bun run build`
Expected: Build succeeds with 0 errors.

- [ ] **Step 4: Check git diff**

Run: `git diff --check`
Expected: Clean.
