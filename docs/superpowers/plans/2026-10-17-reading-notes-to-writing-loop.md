# Reading Notes to Writing Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 打通图书划线与全书笔记到 Studio 长文博文及随手短笺的写作流转闭环，实现一键引用入草稿与冲突管理。

**Architecture:** 引入会话级内存暂存 Store (`useDraftStagingStore`) 承载格式化引用与意图；在 `BookNotesView` 与 `BookReaderSidebar` 提供微交互入口及冲突决策弹窗；在 `PostEditorView` 和 `ShortNoteComposerView` 挂载就绪后自动消费并注入正文。

**Tech Stack:** Vue 3.5, TypeScript 5.8+, Pinia 2, Vue Router 4, Lucide Vue Next, Vitest.

## Global Constraints

- **设计规范**：严格遵循《纯白双刻痕极简风设计系统规范》与 `Atoman-Frontend/docs/superpowers/specs/2026-10-17-reading-notes-to-writing-loop-design.md`。
- **表面与阴影**：卡片底色 `#ffffff` / `var(--a-color-bg)`，阴影仅使用 `var(--a-shadow-dropdown)`，常规边线使用 `var(--a-color-border-soft)`。
- **圆角与字重**：控制圆角统一为 `4px` (`var(--a-radius-control)`)，字重限 500 / 600，杜绝 999px 药丸与 700+ 粗体。
- **纯净文案**：杜绝开发者视角词汇（如系统、内部、hook 等），提示简洁准确。
- **质量门禁**：每个任务完成后必须通过 `bun run test:unit <test_files>` 及 `bun run type-check`。

---

## File Structure

```
Atoman-Frontend/
├── src/
│   ├── stores/
│   │   └── draftStaging.ts                               # 新增：引用暂存 Store 与格式化函数
│   ├── components/
│   │   └── books/
│   │       ├── BookQuoteActionModal.vue                  # 新增：目标选择与草稿冲突决策弹窗
│   │       └── BookReaderSidebar.vue                     # 修改：侧边栏批注卡片增加「引用写作」
│   └── views/
│       ├── books/
│       │   └── BookNotesView.vue                         # 修改：笔记卡片增加「引用写作」
│       └── blog/
│           ├── PostEditorView.vue                        # 修改：消费长文引用并注入正文
│           └── ShortNoteComposerView.vue                 # 修改：消费短笺引用并预填内容
└── tests/unit/
    ├── stores/
    │   └── draftStaging.spec.ts                          # 单元测试：Store 与格式化逻辑
    ├── components/
    │   └── books/
    │       └── BookQuoteActionModal.spec.ts              # 单元测试：决策弹窗交互
    ├── views/
    │   ├── books/
    │   │   └── BookNotesView.spec.ts                     # 修改测试：笔记中心触发写作
    │   └── blog/
    │       ├── PostEditorView.quote.spec.ts              # 单元测试：长文编辑器消费引用
    │       └── ShortNoteComposerView.spec.ts             # 修改测试：短笺编辑器消费引用
```

---

## Tasks

### Task 1: 引用暂存 Store 与格式化工具 (`src/stores/draftStaging.ts`)

**Files:**
- Create: `src/stores/draftStaging.ts`
- Test: `tests/unit/stores/draftStaging.spec.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface BookQuotePayload {
    sourceType: 'book_annotation'
    annotationId: string
    assetId: string
    bookTitle: string
    bookAuthor?: string
    quoteText: string
    personalNote?: string
    target: 'blog_post' | 'short_note'
    mode: 'append' | 'replace'
  }

  export function formatBookQuoteCitation(
    payload: Pick<BookQuotePayload, 'quoteText' | 'bookTitle' | 'bookAuthor' | 'personalNote' | 'target'>
  ): string

  export const useDraftStagingStore: () => {
    pendingQuote: Ref<BookQuotePayload | null>
    setPendingQuote: (payload: BookQuotePayload) => void
    consumePendingQuote: (target: 'blog_post' | 'short_note') => BookQuotePayload | null
    clearPendingQuote: () => void
  }
  ```

- [ ] **Step 1: 编写失败的单元测试**

创建 `tests/unit/stores/draftStaging.spec.ts`：
```typescript
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { formatBookQuoteCitation, useDraftStagingStore } from '@/stores/draftStaging'

describe('draftStaging store and formatters', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('formats markdown blockquote for blog post correctly with note and author', () => {
    const formatted = formatBookQuoteCitation({
      target: 'blog_post',
      quoteText: '生命是一袭华美的袍，爬满了蚤子。',
      bookTitle: '天才梦',
      bookAuthor: '张爱玲',
      personalNote: '经典譬喻，意味深长。',
    })
    expect(formatted).toContain('> 生命是一袭华美的袍，爬满了蚤子。')
    expect(formatted).toContain('> ——《天才梦》 · 张爱玲')
    expect(formatted).toContain('经典譬喻，意味深长。')
  })

  it('formats plain citation for short note correctly', () => {
    const formatted = formatBookQuoteCitation({
      target: 'short_note',
      quoteText: '人类的悲欢并不相通。',
      bookTitle: '而已集',
      personalNote: '夜深忽梦少年事。',
    })
    expect(formatted).toContain('夜深忽梦少年事。')
    expect(formatted).toContain('「人类的悲欢并不相通。」——《而已集》')
  })

  it('stores and consumes pending quote', () => {
    const store = useDraftStagingStore()
    expect(store.pendingQuote).toBeNull()

    store.setPendingQuote({
      sourceType: 'book_annotation',
      annotationId: 'anno-1',
      assetId: 'asset-1',
      bookTitle: '测试书籍',
      quoteText: '精彩语句',
      target: 'blog_post',
      mode: 'append',
    })

    expect(store.pendingQuote?.quoteText).toBe('精彩语句')

    // 目标不匹配时不能消费
    const consumedMismatch = store.consumePendingQuote('short_note')
    expect(consumedMismatch).toBeNull()
    expect(store.pendingQuote).not.toBeNull()

    // 匹配时消费并清空
    const consumed = store.consumePendingQuote('blog_post')
    expect(consumed?.quoteText).toBe('精彩语句')
    expect(store.pendingQuote).toBeNull()
  })
})
```

- [ ] **Step 2: 运行测试验证失败**
```bash
cd Atoman-Frontend && bun run test:unit tests/unit/stores/draftStaging.spec.ts
```

- [ ] **Step 3: 实现 `src/stores/draftStaging.ts`**
编写格式化函数与 Pinia store，满足所有接口契约与测试。

- [ ] **Step 4: 运行测试验证通过**
```bash
cd Atoman-Frontend && bun run test:unit tests/unit/stores/draftStaging.spec.ts && bun run type-check
```

- [ ] **Step 5: 提交代码**
```bash
git add src/stores/draftStaging.ts tests/unit/stores/draftStaging.spec.ts
git commit -m "feat(books): add draftStaging store and citation formatters"
```

---

### Task 2: 目标选择与冲突弹窗组件及卡片入口集成

**Files:**
- Create: `src/components/books/BookQuoteActionModal.vue`
- Modify: `src/views/books/BookNotesView.vue`
- Modify: `src/components/books/BookReaderSidebar.vue`
- Test: `tests/unit/components/books/BookQuoteActionModal.spec.ts`
- Modify: `tests/unit/views/books/BookNotesView.spec.ts`
- Modify: `tests/unit/components/books/BookReaderSidebar.annotations.spec.ts`

**Interfaces:**
- `BookQuoteActionModal.vue`:
  - Props: `open: boolean`, `item: BookAnnotation | null`, `bookTitle: string`, `bookAuthor?: string`
  - Emits: `'close': []`, `'select': [payload: { target: 'blog_post' | 'short_note', mode: 'append' | 'replace' }]`
- Consumes: `useDraftStagingStore`

- [ ] **Step 1: 编写弹窗组件的失败测试**

创建 `tests/unit/components/books/BookQuoteActionModal.spec.ts`：
```typescript
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import BookQuoteActionModal from '@/components/books/BookQuoteActionModal.vue'

describe('BookQuoteActionModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders target options for blog post and short note', () => {
    const wrapper = mount(BookQuoteActionModal, {
      props: {
        open: true,
        item: { id: 'a1', text: '引用文本', note: '想法' } as any,
        bookTitle: '百年孤独',
        bookAuthor: '马尔克斯',
      },
    })

    expect(wrapper.text()).toContain('转为长文博文')
    expect(wrapper.text()).toContain('转为随手短笺')
  })

  it('emits select with target blog_post and mode append when clicking append option', async () => {
    const wrapper = mount(BookQuoteActionModal, {
      props: {
        open: true,
        item: { id: 'a1', text: '引用文本' } as any,
        bookTitle: '百年孤独',
        hasExistingDraft: true,
      },
    })

    const appendBtn = wrapper.find('[data-testid="quote-target-blog-append"]')
    expect(appendBtn.exists()).toBe(true)
    await appendBtn.trigger('click')

    expect(wrapper.emitted('select')?.[0]).toEqual([{ target: 'blog_post', mode: 'append' }])
  })
})
```

- [ ] **Step 2: 运行测试验证失败**
```bash
cd Atoman-Frontend && bun run test:unit tests/unit/components/books/BookQuoteActionModal.spec.ts
```

- [ ] **Step 3: 实现 `BookQuoteActionModal.vue`**
- 遵循 4px 圆角、纯白背景、无阴影/仅下拉阴影、极简排版。
- 支持检测本地已有草稿并展示「追加到末尾」或「新建草稿」分支。

- [ ] **Step 4: 集成到 `BookNotesView.vue` 与 `BookReaderSidebar.vue`**
- 在卡片操作栏添加「引用写作」按钮（`PenTool` 图标）。
- 点击打开 `BookQuoteActionModal`，在选择后写入 `draftStagingStore` 并使用 `router.push('/studio/blog/editor')` 或 `router.push('/posts/notes/new')` 跳转。

- [ ] **Step 5: 运行并更新测试集**
```bash
cd Atoman-Frontend && bun run test:unit tests/unit/components/books/BookQuoteActionModal.spec.ts tests/unit/views/books/BookNotesView.spec.ts tests/unit/components/books/BookReaderSidebar.annotations.spec.ts && bun run type-check
```

- [ ] **Step 6: 提交代码**
```bash
git add src/components/books/BookQuoteActionModal.vue src/views/books/BookNotesView.vue src/components/books/BookReaderSidebar.vue tests/unit/components/books/BookQuoteActionModal.spec.ts tests/unit/views/books/BookNotesView.spec.ts tests/unit/components/books/BookReaderSidebar.annotations.spec.ts
git commit -m "feat(books): add BookQuoteActionModal and integrate citation writing trigger"
```

---

### Task 3: 编辑器承接与注入消费 (`PostEditorView.vue` & `ShortNoteComposerView.vue`)

**Files:**
- Modify: `src/views/blog/PostEditorView.vue`
- Modify: `src/views/blog/ShortNoteComposerView.vue`
- Test: `tests/unit/views/blog/PostEditorView.quote.spec.ts`
- Modify: `tests/unit/views/blog/ShortNoteComposerView.spec.ts`

**Interfaces:**
- Consumes: `draftStagingStore.consumePendingQuote('blog_post' | 'short_note')`, `formatBookQuoteCitation`

- [ ] **Step 1: 编写 PostEditorView 消费引用的单元测试**

创建 `tests/unit/views/blog/PostEditorView.quote.spec.ts`，模拟挂载与 Staging 注入逻辑测试。

- [ ] **Step 2: 运行测试验证失败**
```bash
cd Atoman-Frontend && bun run test:unit tests/unit/views/blog/PostEditorView.quote.spec.ts
```

- [ ] **Step 3: 修改 `PostEditorView.vue`**
- 在 `initializeEditor()` 或 `contentReady` 监听中：
  - 调用 `stagingStore.consumePendingQuote('blog_post')`。
  - 若存在且 `mode === 'append'`：`editorBody.value = editorBody.value ? `${editorBody.value.trim()}\n\n${formatted}` : formatted`。
  - 若存在且 `mode === 'replace'`：设置正文并建议默认标题（若原标题为空）。
  - 触发本地草稿同步保存。

- [ ] **Step 4: 修改 `ShortNoteComposerView.vue`**
- 在组件挂载时调用 `stagingStore.consumePendingQuote('short_note')`。
- 将格式化后的内容赋给 `initial-content`。

- [ ] **Step 5: 运行全量测试验证**
```bash
cd Atoman-Frontend && bun run test:unit tests/unit/views/blog/PostEditorView.quote.spec.ts tests/unit/views/blog/ShortNoteComposerView.spec.ts tests/unit/stores/draftStaging.spec.ts tests/unit/components/books/BookQuoteActionModal.spec.ts && bun run type-check && bun run build
```

- [ ] **Step 6: 提交代码**
```bash
git add src/views/blog/PostEditorView.vue src/views/blog/ShortNoteComposerView.vue tests/unit/views/blog/PostEditorView.quote.spec.ts tests/unit/views/blog/ShortNoteComposerView.spec.ts
git commit -m "feat(blog): ingest staged book quotes in PostEditorView and ShortNoteComposerView"
```

---

## Verification Suite

执行全量相关测试与工程验证：
```bash
cd Atoman-Frontend
bun run test:unit tests/unit/stores/draftStaging.spec.ts tests/unit/components/books/BookQuoteActionModal.spec.ts tests/unit/views/books/BookNotesView.spec.ts tests/unit/components/books/BookReaderSidebar.annotations.spec.ts tests/unit/views/blog/PostEditorView.quote.spec.ts tests/unit/views/blog/ShortNoteComposerView.spec.ts
bun run type-check
bun run build
```
