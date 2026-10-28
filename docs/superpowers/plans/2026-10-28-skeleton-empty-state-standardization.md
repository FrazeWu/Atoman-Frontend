# 全站骨架屏与空状态标准化收网实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 依据 `AGENTS.md` 规则与设计规范，提炼标准骨架卡片 `PSkeletonCard` 并规范 `PEmpty`，全面改造五大重点业务流（书籍、通知/私信、搜索、博客/动态、音乐）中散落的手写文本、原始 loading 与内部开发视角词汇，建立自动化静态契约测试守护全站空状态与骨架规范。

**Architecture:** 
1. 在 `src/components/ui/` 增强基础骨架并新增 `PSkeletonCard.vue`，清理 `PEmpty.vue` 隐式 kicker 残留；
2. 逐一重构五大重点消费流中使用的空状态与骨架占位，统一为用户态自然语言与清晰行动引导；
3. 建立 `tests/unit/ui/skeleton-empty-contract.spec.ts` 静态扫描契约，防止回潮出现“暂无数据/System/加载中...”等粗糙词汇；
4. 运行全站严格类型检查、全量单元测试与双端生产构建。

**Tech Stack:** Vue 3.4, Vite, TypeScript 5.8, Vitest, Tailwind CSS v4.

## Global Constraints

- 严守 0 阴影规范（`box-shadow: none !important;`）与 4px 标准圆角（`border-radius: var(--a-radius-card, 4px)`）；
- 用户特调的桌面端顶栏交互与视觉（`AppTopbarAuthControls.vue`）绝对不作任何修改；
- 遵循真数据原则，杜绝任何假数据或 Mock；
- 前端用户可见文案严格收敛为简洁用户态：标题只写动作名或内容名，副标题只保留完成当前任务必需信息，禁止暴露开发者视角词汇（“内部”“System”“暂无数据”等）；
- 修改完成前必须运行 `bun run type-check` 与 `bun run test:unit` 验证。

---

### Task 1: 基础组件规范化与预置骨架卡片 (`PSkeletonCard` & `PEmpty`)

**Files:**
- Create: `src/components/ui/PSkeletonCard.vue`
- Create: `tests/unit/components/PSkeletonCard.spec.ts`
- Modify: `src/components/ui/PEmpty.vue`
- Modify: `tests/unit/components/PEmpty.spec.ts`

**Interfaces:**
- `PSkeletonCard` Props:
  - `aspect?: '3/4' | '1/1' | '16/9' | 'auto'` (default: `'3/4'`)
  - `lines?: number` (default: 2)
  - `bordered?: boolean` (default: false)
- `PEmpty` Props:
  - `kicker?: string` (default: `""`, eliminate implicit `'暂无内容'`)

- [ ] **Step 1: Write failing test for `PSkeletonCard`**

```ts
// tests/unit/components/PSkeletonCard.spec.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PSkeletonCard from '@/components/ui/PSkeletonCard.vue'

describe('PSkeletonCard', () => {
  it('renders aspect ratio wrapper and default text lines', () => {
    const wrapper = mount(PSkeletonCard, {
      props: { aspect: '3/4', lines: 2 },
    })

    expect(wrapper.classes()).toContain('p-skeleton-card')
    const media = wrapper.find('.p-skeleton-card__media')
    expect(media.exists()).toBe(true)
    expect(media.classes()).toContain('p-skeleton-card__media--3-4')

    const textLines = wrapper.findAll('.p-skeleton-card__text')
    expect(textLines.length).toBe(2)
  })

  it('renders bordered variant when specified', () => {
    const wrapper = mount(PSkeletonCard, {
      props: { bordered: true },
    })
    expect(wrapper.classes()).toContain('p-skeleton-card--bordered')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit tests/unit/components/PSkeletonCard.spec.ts`
Expected: FAIL with component not found.

- [ ] **Step 3: Implement `PSkeletonCard.vue` and update `PEmpty.vue`**

```vue
<!-- src/components/ui/PSkeletonCard.vue -->
<template>
  <div
    class="p-skeleton-card"
    :class="{ 'p-skeleton-card--bordered': bordered }"
  >
    <div
      class="p-skeleton-card__media"
      :class="`p-skeleton-card__media--${aspectClass}`"
    >
      <PSkeleton variant="rect" width="100%" height="100%" :bordered="false" />
    </div>
    <div v-if="lines > 0" class="p-skeleton-card__body">
      <div
        v-for="i in lines"
        :key="i"
        class="p-skeleton-card__text"
      >
        <PSkeleton
          variant="text"
          :width="i === 1 ? '75%' : (i === lines && lines > 1) ? '45%' : '90%'"
          height="0.85rem"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PSkeleton from './PSkeleton.vue'

const props = withDefaults(defineProps<{
  aspect?: '3/4' | '1/1' | '16/9' | 'auto'
  lines?: number
  bordered?: boolean
}>(), {
  aspect: '3/4',
  lines: 2,
  bordered: false,
})

const aspectClass = computed(() => {
  if (props.aspect === '3/4') return '3-4'
  if (props.aspect === '1/1') return '1-1'
  if (props.aspect === '16/9') return '16-9'
  return 'auto'
})
</script>

<style scoped>
.p-skeleton-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  border-radius: var(--a-radius-card, 4px);
  overflow: hidden;
}

.p-skeleton-card--bordered {
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
}

.p-skeleton-card__media {
  width: 100%;
  position: relative;
  overflow: hidden;
  border-radius: var(--a-radius-card, 4px);
}

.p-skeleton-card__media--3-4 {
  aspect-ratio: 3 / 4;
}

.p-skeleton-card__media--1-1 {
  aspect-ratio: 1 / 1;
}

.p-skeleton-card__media--16-9 {
  aspect-ratio: 16 / 9;
}

.p-skeleton-card__media--auto {
  min-height: 8rem;
}

.p-skeleton-card__body {
  padding-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.p-skeleton-card__text {
  width: 100%;
}
</style>
```

In `src/components/ui/PEmpty.vue`:
Change default `kicker: '暂无内容'` to `kicker: ''`, and update `computedKicker`:
```ts
const computedKicker = computed(() => {
  if (!props.kicker) return ''
  return (computedTitle.value || computedDescription.value) ? props.kicker : ''
})
```

- [ ] **Step 4: Update `tests/unit/components/PEmpty.spec.ts` and run tests**

Run: `bun run test:unit tests/unit/components/PSkeletonCard.spec.ts tests/unit/components/PEmpty.spec.ts`
Expected: PASS (all tests pass).

- [ ] **Step 5: Commit**

Run: `git add src/components/ui/PSkeletonCard.vue tests/unit/components/PSkeletonCard.spec.ts src/components/ui/PEmpty.vue tests/unit/components/PEmpty.spec.ts && git commit -m "feat(ui): add PSkeletonCard component and clean PEmpty implicit kicker default"`

---

### Task 2: 书籍模块 (Books) 骨架屏与空状态规范收网

**Files:**
- Modify: `src/views/books/BooksDiscoverView.vue`
- Modify: `src/views/books/BookListsView.vue`
- Modify: `src/views/books/BookNotesView.vue`
- Modify: `tests/unit/views/books/BooksDiscoverView.spec.ts` (if exists) or create

- [ ] **Step 1: Inspect and update `BooksDiscoverView.vue`**

1. Replace loading indicators for rankings and catalog with grid of `<PSkeletonCard aspect="3/4" />`;
2. Replace `<p class="book-catalog__empty-hint">暂无满足门槛的图书。</p>` with `<PEmpty title="未找到相关书籍" description="尝试更换分类或调整筛选条件" />`;
3. Replace `<p class="book-catalog__empty-hint">没有找到作者，试试其他姓名。</p>` with `<PEmpty title="未找到作者" description="试试输入其他姓名或关键词" />`.

- [ ] **Step 2: Inspect and update `BookListsView.vue`**

Replace `<p v-else-if="!cards.length" class="booklists__empty">...` with `<PEmpty>`:
```vue
<PEmpty
  v-else-if="!cards.length"
  :title="activeTab === 'mine' ? '还没有书单' : activeTab === 'saved' ? '没有收藏的书单' : '没有找到公开书单'"
  :description="activeTab === 'mine' ? '创建一份书单开始整理藏书。' : activeTab === 'saved' ? '浏览公开书单收藏感兴趣的专题。' : '试试其他关键词或创建一份。'"
  align="center"
/>
```

- [ ] **Step 3: Inspect and update `BookNotesView.vue`**

Replace `<p v-else-if="!isLoading && notes.length === 0" class="books-notes-empty">` with `<PEmpty>`:
```vue
<PEmpty
  v-else-if="!isLoading && notes.length === 0"
  title="尚未记录笔记"
  description="在阅读过程中选中文本即可添加划线与想法"
  align="center"
/>
```

- [ ] **Step 4: Run unit tests**

Run: `bun run test:unit tests/unit/views/books/`
Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add src/views/books/BooksDiscoverView.vue src/views/books/BookListsView.vue src/views/books/BookNotesView.vue && git commit -m "refactor(books): standardize loading skeletons and empty states"`

---

### Task 3: 通知/私信、搜索、博客与音乐模块空状态与骨架收网

**Files:**
- Modify: `src/views/feed/InboxPage.vue`
- Modify: `src/views/messages/MessagesWorkspaceView.vue`
- Modify: `src/views/search/SearchResultsView.vue`
- Modify: `src/views/timeline/TimelineHomeView.vue`
- Modify: `src/components/music/AlbumDrawer.vue`
- Modify: `src/components/music/PlaylistDrawer.vue`

- [ ] **Step 1: Update `InboxPage.vue` & `MessagesWorkspaceView.vue`**

1. In `InboxPage.vue`: Replace `.inbox-empty-state` with `<PEmpty title="收件箱暂无通知" description="新收到的互动与动态将显示在这里" align="center" />`;
2. In `MessagesWorkspaceView.vue`: Replace `.dm-empty-placeholder` with `<PEmpty title="未选择会话" description="从左侧列表中选择联系人开始交流" align="center" />`.

- [ ] **Step 2: Update `SearchResultsView.vue`**

Replace `.search-state-message.is-empty` with `<PEmpty title="未找到匹配结果" description="请检查关键词拼写或尝试其他搜索词" align="center" />`.

- [ ] **Step 3: Update `TimelineHomeView.vue`**

Replace `.tl-panel-empty` and `.tl-stage-empty` raw text blocks with semantic `<PEmpty title="对比池为空" description="从时间线添加事件以开始对比" align="center" />` and `<PEmpty title="还没有动态" description="关注创作者或去发现广场探索精彩内容" align="center" />`.

- [ ] **Step 4: Update `AlbumDrawer.vue` & `PlaylistDrawer.vue`**

In `AlbumDrawer.vue` and `PlaylistDrawer.vue`: Replace `.track-empty` with `<PEmpty compact title="曲目库为空" description="尚未添加音频曲目" />`.

- [ ] **Step 5: Run unit tests**

Run: `bun run test:unit tests/unit/views/feed/InboxPage.spec.ts tests/unit/components/music/AlbumDrawer.spec.ts` (and related test suites)
Expected: PASS.

- [ ] **Step 6: Commit**

Run: `git add src/views/feed/InboxPage.vue src/views/messages/MessagesWorkspaceView.vue src/views/search/SearchResultsView.vue src/views/timeline/TimelineHomeView.vue src/components/music/AlbumDrawer.vue src/components/music/PlaylistDrawer.vue && git commit -m "refactor(ui): standardize empty states across inbox, messages, search, timeline and music drawers"`

---

### Task 4: 自动化空态文案与骨架屏契约测试 (`skeleton-empty-contract.spec.ts`)

**Files:**
- Create: `tests/unit/ui/skeleton-empty-contract.spec.ts`

- [ ] **Step 1: Write static contract test**

```ts
// tests/unit/ui/skeleton-empty-contract.spec.ts
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

describe('skeleton-empty-contract', () => {
  const targetViews = [
    'src/views/books/BooksDiscoverView.vue',
    'src/views/books/BookListsView.vue',
    'src/views/books/BookNotesView.vue',
    'src/views/feed/InboxPage.vue',
    'src/views/messages/MessagesWorkspaceView.vue',
    'src/views/search/SearchResultsView.vue',
    'src/views/timeline/TimelineHomeView.vue',
  ]

  it('ensures core views import and use PEmpty or PSkeleton instead of raw empty classes', () => {
    for (const viewPath of targetViews) {
      const fullPath = resolve(process.cwd(), viewPath)
      expect(existsSync(fullPath)).toBe(true)
      const content = readFileSync(fullPath, 'utf-8')

      // Must import PEmpty or PSkeleton or use them in template
      const usesPEmpty = content.includes('PEmpty')
      const usesPSkeleton = content.includes('PSkeleton')
      expect(usesPEmpty || usesPSkeleton).toBe(true)

      // Must not contain developer-facing crude text
      expect(content).not.toContain('暂无数据')
      expect(content).not.toContain('暂无满足门槛的图书')
    }
  })

  it('validates PSkeletonCard export and component structure', async () => {
    const PSkeletonCard = (await import('@/components/ui/PSkeletonCard.vue')).default
    expect(PSkeletonCard).toBeDefined()
  })
})
```

- [ ] **Step 2: Run contract test**

Run: `bun run test:unit tests/unit/ui/skeleton-empty-contract.spec.ts`
Expected: PASS (all contract rules pass).

- [ ] **Step 3: Commit**

Run: `git add tests/unit/ui/skeleton-empty-contract.spec.ts && git commit -m "test(contract): add skeleton and empty state contract tests"`

---

### Task 5: 全站质量验证与双端打包交付

**Files:**
- Documentation: `docs/superpowers/plans/2026-10-28-skeleton-empty-state-standardization.md`
- Kanban: `<appDataDir>/brain/72e9f847-045b-4790-a46f-1fe17ce2f1c1/frontend-refactor-status.md`

- [ ] **Step 1: Run TypeScript strict check**

Run: `cd Atoman-Frontend && bun run type-check`
Expected: 0 errors.

- [ ] **Step 2: Run full unit test suite**

Run: `cd Atoman-Frontend && bun run test:unit`
Expected: 100% pass across all 554+ test suites.

- [ ] **Step 3: Run desktop and mobile production builds**

Run: `cd Atoman-Frontend && bun run build && bun run build:mobile`
Expected: Both builds succeed with 0 errors.

- [ ] **Step 4: Update plan and kanban status**

Mark all tasks as completed in plan and update status board.

- [ ] **Step 5: Final commit & push**

Run: `git commit -am "chore: complete skeleton and empty state standardization" && git push origin main`
