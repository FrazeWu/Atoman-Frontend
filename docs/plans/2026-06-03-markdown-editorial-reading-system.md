# Markdown Editorial Reading System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将全站 Markdown 内容统一为中文可读性优先的学术刊物式阅读风格，并补齐脚注支持，使正文页与编辑器预览气质一致。

**Architecture:** 保留现有 `marked + DOMPurify` 渲染链，在 `useMarkdownRenderer.ts` 内补齐脚注语法与统一内容语义；新增一处共享 Markdown prose 样式来源，承接标题、段落、引用、代码、表格、脚注和嵌入块；逐步移除 `editor.css` 与 `PostDetailView.vue` 中对 `.prose-blog` 的重复定义，把页面差异收束为容器布局差异而非内容人格差异。

**Tech Stack:** Vue 3、TypeScript、Vite、Tailwind CSS v4、marked、DOMPurify、Vitest、Vue Test Utils

---

## File structure and ownership

- **Create:** `web/src/assets/markdown-prose.css`
  - 共享 Markdown prose 样式唯一来源。优先使用现有设计 token，必要时用少量共享 CSS 承接复杂 prose 规则。
- **Modify:** `web/src/main.ts`
  - 注册新的共享 prose 样式文件，保留全局入口的一致性。
- **Modify:** `web/src/composables/useMarkdownRenderer.ts`
  - 继续负责 Markdown 渲染；新增脚注预处理/后处理；统一链接与脚注区 HTML 语义；保持 sanitize 责任不变。
- **Modify:** `web/src/assets/editor.css`
  - 保留编辑器容器与 CodeMirror 布局样式，移除对 `.prose-blog` / `.md-preview-pane` 内容人格的成套定义。
- **Modify:** `web/src/views/blog/PostDetailView.vue`
  - 删除页面内重复的 `.prose-blog` 样式，只保留详情页容器与互动区样式。
- **Modify:** `web/src/components/shared/AEditorRuntime.vue`
  - 让预览区继续使用统一 prose 类名，不再依赖编辑器特有内容样式。
- **Modify:** `web/src/views/feed/FeedItemDetailView.vue`
  - 确认内容容器接入统一 prose 类名。
- **Modify:** `web/src/components/feed/FeedArticleSheet.vue`
  - 确认内容容器接入统一 prose 类名。
- **Modify:** `web/src/views/forum/ForumTopicView.vue`
  - 为主题正文接入统一 prose 类名。
- **Modify:** `web/src/components/forum/ForumReplyNode.vue`
  - 为回复正文接入统一 prose 类名。
- **Optional modify after grep verification:** 其他复用 `renderMarkdown()` 或 `.prose-blog` 的页面
  - 同步接入共享 prose 语言。
- **Create:** `web/tests/unit/composables/useMarkdownRenderer.footnotes.spec.ts`
  - 覆盖脚注渲染行为。
- **Modify:** `web/tests/unit/composables/useMarkdownRenderer.sanitize.spec.ts`
  - 确保脚注支持不破坏 sanitize 预期。
- **Create:** `web/tests/unit/composables/useMarkdownRenderer.prose.spec.ts`
  - 覆盖统一 HTML 语义，例如外链箭头、脚注区、嵌入块语义类名。
- **Modify:** `web/tests/unit/components/AEditor.spec.ts`
  - 断言分栏预览继续存在，并继承统一 prose 语义。

---

### Task 1: 建立共享 Markdown prose 样式层

**Files:**
- Create: `web/src/assets/markdown-prose.css`
- Modify: `web/src/main.ts`
- Modify: `web/src/assets/editor.css:167-233`
- Modify: `web/src/views/blog/PostDetailView.vue:358-499`

- [ ] **Step 1: 写一个失败的样式来源测试，先锁定共享 prose 文件必须存在并在入口注册**

```ts
import path from 'node:path'
import { existsSync, readFileSync } from 'node:fs'

const mainSource = readFileSync(path.resolve(process.cwd(), 'src/main.ts'), 'utf8')
const markdownProsePath = path.resolve(process.cwd(), 'src/assets/markdown-prose.css')

describe('markdown prose style source', () => {
  it('registers a shared markdown prose stylesheet in the app entry', () => {
    expect(existsSync(markdownProsePath)).toBe(true)
    expect(mainSource).toContain("import './assets/markdown-prose.css'")
  })
})
```

- [ ] **Step 2: 运行测试，确认它先失败**

Run:
```bash
npm --prefix web run test:unit -- web/tests/unit/composables/useMarkdownRenderer.prose.spec.ts
```

Expected: FAIL，提示 `src/assets/markdown-prose.css` 不存在，且 `main.ts` 尚未导入该文件。

- [ ] **Step 3: 新建共享 prose 样式文件，先写最小可用骨架和统一类名**

```css
@import "tailwindcss";

.a-prose {
  color: var(--a-color-ink);
  font-size: 1rem;
  line-height: 1.95;
}

.a-prose h1,
.a-prose h2,
.a-prose h3,
.a-prose h4 {
  color: var(--a-color-ink);
  font-weight: var(--a-font-weight-strong);
  letter-spacing: -0.02em;
}

.a-prose p,
.a-prose ul,
.a-prose ol,
.a-prose blockquote,
.a-prose pre,
.a-prose table,
.a-prose figure,
.a-prose .a-md-footnotes,
.a-prose .atoman-post-embed {
  margin-block: 1.25rem;
}
```

- [ ] **Step 4: 在全局入口注册共享 prose 样式文件**

```ts
import './style.css'
import './assets/editor.css'
import './assets/markdown-prose.css'
```

- [ ] **Step 5: 用共享 prose 骨架替换旧的黑白硬边内容规则，只保留编辑器容器布局**

`web/src/assets/editor.css` 中保留这些类型的规则：

```css
.md-editor-wrap { /* keep */ }
.md-editor-left { /* keep */ }
.md-editor-right { /* keep */ }
.sv-pane { /* keep */ }
.sv-source { /* keep */ }
.sv-preview { /* keep layout-only styles */ }
```

并删除或改写所有这种“编辑器预览 + .prose-blog 共用人格”的规则：

```css
.md-preview-pane h1, .prose-blog h1 { ... }
.md-preview-pane h2, .prose-blog h2 { ... }
.md-preview-pane pre, .prose-blog pre { ... }
.md-preview-pane blockquote, .prose-blog blockquote { ... }
.md-preview-pane table, .prose-blog table { ... }
```

替换为更克制的共享 prose 规则，例如：

```css
.a-prose h2 {
  font-size: 1.55rem;
  line-height: 1.35;
  margin-top: 2.8rem;
  margin-bottom: 1rem;
  padding-left: 0;
  border-left: 0;
}

.a-prose blockquote {
  position: relative;
  padding: 1rem 1.25rem 1rem 2rem;
  background: var(--a-color-paper-soft);
  color: var(--a-color-ink-muted);
}

.a-prose blockquote::before {
  content: '“';
  position: absolute;
  left: 0.75rem;
  top: 0.45rem;
  color: var(--a-color-muted-soft);
  font-size: 1.75rem;
  line-height: 1;
}
```

- [ ] **Step 6: 删除文章详情页中的重复 `.prose-blog` 内容人格样式，只保留页面壳层按钮与布局样式**

`web/src/views/blog/PostDetailView.vue` 中移除这类重复定义：

```vue
.prose-blog :deep(h1) { ... }
.prose-blog :deep(h2) { ... }
.prose-blog :deep(pre) { ... }
.prose-blog :deep(blockquote) { ... }
.prose-blog :deep(table) { ... }
```

保留页面上下文样式，例如：

```vue
.a-toggle-btn {
  font-size: 0.8rem;
  font-weight: 900;
  text-transform: uppercase;
}
```

- [ ] **Step 7: 重新运行样式来源测试，确认共享层已接入**

Run:
```bash
npm --prefix web run test:unit -- web/tests/unit/composables/useMarkdownRenderer.prose.spec.ts
```

Expected: PASS，测试确认共享 prose 文件存在且已在 `main.ts` 注册。

- [ ] **Step 8: 提交这一逻辑单元**

```bash
git add web/src/assets/markdown-prose.css web/src/main.ts web/src/assets/editor.css web/src/views/blog/PostDetailView.vue web/tests/unit/composables/useMarkdownRenderer.prose.spec.ts
git commit -m "refactor: centralize markdown prose styles"
```

---

### Task 2: 在渲染器中补齐脚注语法与统一 HTML 语义

**Files:**
- Modify: `web/src/composables/useMarkdownRenderer.ts`
- Create: `web/tests/unit/composables/useMarkdownRenderer.footnotes.spec.ts`
- Modify: `web/tests/unit/composables/useMarkdownRenderer.sanitize.spec.ts`
- Modify: `web/tests/unit/composables/useMarkdownRenderer.prose.spec.ts`

- [ ] **Step 1: 先写脚注失败测试，锁定最小行为**

```ts
import { useMarkdownRenderer } from '@/composables/useMarkdownRenderer'

describe('useMarkdownRenderer footnotes', () => {
  it('renders footnote references and a footnotes section', () => {
    const { renderMarkdown } = useMarkdownRenderer()

    const html = renderMarkdown('正文里的判断。[^1]\n\n[^1]: 这里是脚注。')

    expect(html).toContain('a-md-footnote-ref')
    expect(html).toContain('href="#fn-1"')
    expect(html).toContain('id="fnref-1"')
    expect(html).toContain('class="a-md-footnotes"')
    expect(html).toContain('id="fn-1"')
    expect(html).toContain('这里是脚注。')
  })
})
```

- [ ] **Step 2: 运行脚注测试，确认当前实现先失败**

Run:
```bash
npm --prefix web run test:unit -- web/tests/unit/composables/useMarkdownRenderer.footnotes.spec.ts
```

Expected: FAIL，当前渲染结果不包含脚注 ref、脚注区或脚注 id。

- [ ] **Step 3: 在渲染器里新增脚注预处理与尾部脚注区组装函数**

在 `web/src/composables/useMarkdownRenderer.ts` 内加入一个最小、无第三方依赖的脚注管线：

```ts
type FootnoteEntry = {
  id: string
  index: number
  html: string
}

type PreparedMarkdown = {
  content: string
  footnotes: FootnoteEntry[]
}

function extractFootnotes(markdown: string): PreparedMarkdown {
  const definitionPattern = /^\[\^([^\]]+)\]:\s+(.+)$/gm
  const definitions = new Map<string, string>()
  let body = markdown.replace(definitionPattern, (_match, id: string, text: string) => {
    definitions.set(id, text.trim())
    return ''
  })

  const usedIds: string[] = []
  body = body.replace(/\[\^([^\]]+)\]/g, (_match, id: string) => {
    if (!definitions.has(id)) return _match
    if (!usedIds.includes(id)) usedIds.push(id)
    const index = usedIds.indexOf(id) + 1
    return `<sup class="a-md-footnote-ref"><a href="#fn-${index}" id="fnref-${index}">${index}</a></sup>`
  })

  const footnotes = usedIds.map((id, idx) => ({
    id,
    index: idx + 1,
    html: marked.parseInline(definitions.get(id) || '') as string,
  }))

  return { content: body.trim(), footnotes }
}

function appendFootnotesSection(html: string, footnotes: FootnoteEntry[]) {
  if (!footnotes.length) return html

  const items = footnotes
    .map((footnote) => `<li id="fn-${footnote.index}">${footnote.html} <a href="#fnref-${footnote.index}" class="a-md-footnote-backref">↩</a></li>`)
    .join('')

  return `${html}<section class="a-md-footnotes"><h2>注释</h2><ol>${items}</ol></section>`
}
```

- [ ] **Step 4: 将脚注预处理接到现有渲染函数中，保持 sanitize 为最终出口**

将 `renderMarkdown()` 改成：

```ts
function renderMarkdown(content: string, options?: RenderMarkdownOptions): string {
  if (!content) return ''

  const runtimeState = markdownRuntimeState.value
  if (runtimeState !== 'ready' && shouldLoadMarkdownRuntime(content)) {
    void ensureMarkdownRuntime()
  }

  try {
    const withDirectives = preprocessDirectives(content, options)
    const prepared = extractFootnotes(withDirectives)
    const baseHtml = marked(prepared.content) as string
    const htmlWithFootnotes = appendFootnotesSection(baseHtml, prepared.footnotes)
    return DOMPurify.sanitize(htmlWithFootnotes)
  } catch {
    return `<pre>${escapeHtml(content)}</pre>`
  }
}
```

- [ ] **Step 5: 锁定统一 HTML 语义测试，确保链接和脚注类名稳定**

在 `web/tests/unit/composables/useMarkdownRenderer.prose.spec.ts` 中补充：

```ts
import { useMarkdownRenderer } from '@/composables/useMarkdownRenderer'

describe('markdown prose semantics', () => {
  it('keeps footnote markup and embed semantics stable', () => {
    const { renderMarkdown } = useMarkdownRenderer()

    const html = renderMarkdown('参考资料[^1]\n\n[^1]: 注释')

    expect(html).toContain('a-md-footnote-ref')
    expect(html).toContain('a-md-footnotes')
  })
})
```

- [ ] **Step 6: 扩充 sanitize 测试，确保脚注仍经过 sanitize**

```ts
it('sanitizes unsafe html inside footnotes', () => {
  const { renderMarkdown } = useMarkdownRenderer()

  const html = renderMarkdown('正文[^1]\n\n[^1]: <img src="x" onerror="alert(1)"><script>alert(1)</script>')

  expect(html).not.toContain('onerror=')
  expect(html).not.toContain('<script')
  expect(html).toContain('a-md-footnotes')
})
```

- [ ] **Step 7: 运行脚注与 sanitize 测试，确认通过**

Run:
```bash
npm --prefix web run test:unit -- web/tests/unit/composables/useMarkdownRenderer.footnotes.spec.ts web/tests/unit/composables/useMarkdownRenderer.sanitize.spec.ts web/tests/unit/composables/useMarkdownRenderer.prose.spec.ts
```

Expected: PASS，脚注 ref、脚注区、sanitize 行为全部通过。

- [ ] **Step 8: 提交这一逻辑单元**

```bash
git add web/src/composables/useMarkdownRenderer.ts web/tests/unit/composables/useMarkdownRenderer.footnotes.spec.ts web/tests/unit/composables/useMarkdownRenderer.sanitize.spec.ts web/tests/unit/composables/useMarkdownRenderer.prose.spec.ts
git commit -m "feat: add markdown footnotes"
```

---

### Task 3: 将文章页与编辑器预览统一接入共享 prose 语言

**Files:**
- Modify: `web/src/views/blog/PostDetailView.vue`
- Modify: `web/src/components/shared/AEditorRuntime.vue`
- Modify: `web/tests/unit/components/AEditor.spec.ts`

- [ ] **Step 1: 先写一个 AEditor 失败测试，锁定预览区必须继续存在统一 prose 类名**

```ts
it('keeps the split preview pane mounted with shared prose classes', async () => {
  const wrapper = await mountEditor({
    modelValue: '# 标题\n\n正文',
    mode: FUTURE_SPLIT_MODE,
  })

  const preview = wrapper.find(FUTURE_PREVIEW_PANE)
  expect(preview.exists()).toBe(true)
  expect(preview.classes()).toContain('a-prose')
})
```

- [ ] **Step 2: 运行编辑器测试，确认它先失败**

Run:
```bash
npm --prefix web run test:unit -- web/tests/unit/components/AEditor.spec.ts
```

Expected: FAIL，当前预览区只有 `prose-blog`，不包含 `a-prose`。

- [ ] **Step 3: 更新编辑器预览容器类名，让它显式共享 prose 语言**

将 `web/src/components/shared/AEditorRuntime.vue` 的预览容器改为：

```vue
<div
  v-if="effectiveMode === 'split'"
  ref="previewPaneRef"
  class="sv-pane sv-preview a-prose prose-blog"
  data-testid="markdown-preview"
  v-html="svPreviewHtml"
  @scroll="onPreviewScroll"
/>
```

- [ ] **Step 4: 更新文章详情页容器类名，明确它使用共享 prose 语言**

将 `web/src/views/blog/PostDetailView.vue` 改为：

```vue
<div class="a-prose prose-blog" style="margin-bottom:3rem" v-html="renderedContent" />
```

- [ ] **Step 5: 用共享 prose 语言重写核心块级规则，做到预览与正文同气质**

在 `web/src/assets/markdown-prose.css` 中补齐以下规则：

```css
.a-prose h1 {
  font-size: 2.4rem;
  line-height: 1.18;
  margin-top: 2rem;
  margin-bottom: 1.15rem;
}

.a-prose p {
  font-size: 1.02rem;
  line-height: 1.95;
  color: var(--a-color-ink);
}

.a-prose code {
  padding: 0.1em 0.35em;
  background: var(--a-color-paper-soft);
  color: var(--a-color-ink);
  border: 1px solid var(--a-color-line-soft);
}

.a-prose pre {
  padding: 1.1rem 1.25rem;
  background: var(--a-color-paper-soft);
  border: 1px solid var(--a-color-line);
  color: var(--a-color-ink);
  overflow-x: auto;
}

.a-prose pre code {
  padding: 0;
  background: transparent;
  border: 0;
}

.a-prose a {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 0.14em;
}
```

- [ ] **Step 6: 重新运行编辑器测试，确认预览区还在且带共享类名**

Run:
```bash
npm --prefix web run test:unit -- web/tests/unit/components/AEditor.spec.ts
```

Expected: PASS，`markdown-preview` 继续存在，并包含 `a-prose`。

- [ ] **Step 7: 提交这一逻辑单元**

```bash
git add web/src/components/shared/AEditorRuntime.vue web/src/views/blog/PostDetailView.vue web/src/assets/markdown-prose.css web/tests/unit/components/AEditor.spec.ts
git commit -m "refactor: unify markdown preview and article prose"
```

---

### Task 4: 将论坛、Feed 和其他 Markdown 场景接入共享层

**Files:**
- Modify: `web/src/views/feed/FeedItemDetailView.vue`
- Modify: `web/src/components/feed/FeedArticleSheet.vue`
- Modify: `web/src/views/forum/ForumTopicView.vue`
- Modify: `web/src/components/forum/ForumReplyNode.vue`
- Optional modify: 其他 grep 命中的 Markdown 内容容器

- [ ] **Step 1: 先写一个 grep 验证步骤，列出还没接入 `a-prose` 的 Markdown 容器**

Run:
```bash
rg -n "prose-blog|renderMarkdown\(|v-html=\"renderMarkdown|v-html=\"renderedContent|v-html=\"renderContent" web/src
```

Expected: 输出所有仍在使用 Markdown 的内容入口，便于逐个接入；如果某个容器没有 `a-prose`，本任务必须把它补齐。

- [ ] **Step 2: 为 Feed 详情与 Feed 侧栏正文接入 `a-prose`**

目标改法：

```vue
<div class="a-prose prose-blog article-body" v-html="renderContent(...)" />
```

和：

```vue
<div class="a-prose prose-blog article-body" v-html="article.feed_item.full_text_html || article.feed_item.summary"></div>
```

- [ ] **Step 3: 为论坛主题正文与回复正文接入 `a-prose`**

目标改法：

```vue
<div class="a-prose prose-blog" v-html="renderMarkdown(forumStore.currentTopic.content)" />
```

```vue
<div class="a-prose prose-blog" v-html="renderMarkdown(reply.content)" />
```

- [ ] **Step 4: 对 grep 输出的其他 Markdown 容器做同样处理，保持页面壳子不变、内容语言统一**

遇到以下场景时，统一按这个准则处理：

- 若页面本来有容器类，保留容器类，再追加 `a-prose prose-blog`
- 若页面使用的是通用 `prose`，替换为项目自己的 `a-prose prose-blog`
- 不顺手重做页面布局，只修内容容器接入

- [ ] **Step 5: 运行最小测试与类型检查，确认接入没有打坏现有前端单测**

Run:
```bash
npm --prefix web run test:unit -- web/tests/unit/composables/useMarkdownRenderer.footnotes.spec.ts web/tests/unit/composables/useMarkdownRenderer.sanitize.spec.ts web/tests/unit/composables/useMarkdownRenderer.prose.spec.ts web/tests/unit/components/AEditor.spec.ts
npm --prefix web run type-check
```

Expected:
- Vitest: PASS
- `vue-tsc`: PASS with no errors

- [ ] **Step 6: 提交这一逻辑单元**

```bash
git add web/src/views/feed/FeedItemDetailView.vue web/src/components/feed/FeedArticleSheet.vue web/src/views/forum/ForumTopicView.vue web/src/components/forum/ForumReplyNode.vue web/src/assets/markdown-prose.css
git commit -m "refactor: apply shared markdown prose across content surfaces"
```

---

### Task 5: 运行人工验证并记录回归检查结果

**Files:**
- Modify if needed: `docs/superpowers/plans/2026-06-03-markdown-editorial-reading-system.md`（仅勾选或补充验证备注）

- [ ] **Step 1: 启动前端开发服务**

Run:
```bash
npm --prefix web run dev -- --host 127.0.0.1 --port 5173
```

Expected: Vite dev server 启动成功，监听 `http://127.0.0.1:5173`。

- [ ] **Step 2: 手动验证文章详情页的刊物式正文气质**

访问：
```text
http://127.0.0.1:5173/post/13001f8c-6a03-406f-abfd-0093f57d15cb?site=blog
```

检查点：
- `h2` 不再带左侧粗黑条
- 引用块为灰色 + 引号感
- 代码块为浅灰教材式示例框，而不是大黑底
- 链接像参考阅读入口，不像强蓝色按钮
- 如果正文含脚注，脚注区为独立注释区

- [ ] **Step 3: 手动验证编辑器预览与正文气质一致**

访问：
```text
http://127.0.0.1:5173/post/new?site=blog
```

操作：
- 打开“专业模式”
- 输入以下 Markdown：

```md
# 法

> 引文内容

这里有一个术语 `renderMarkdown` 和一个脚注。[^1]

```ts
console.log('教材式代码块')
```

[参考资料](https://example.com)

[^1]: 注释内容。
```

检查点：
- 预览区标题、引用块、代码块、链接、脚注区的气质与文章详情页一致
- 允许容器边界不同，但不允许内容人格不同

- [ ] **Step 4: 手动验证论坛与 Feed 场景**

至少检查：
- 论坛主题正文
- 论坛回复正文
- Feed 详情正文
- Feed 侧栏文章正文

检查点：
- 都继承同一套 `a-prose prose-blog` 语言
- 没有残留黑白硬边编辑器风
- 没有容器塌陷、表格溢出、代码块滚动损坏等明显回归

- [ ] **Step 5: 做最终前端验证**

Run:
```bash
npm --prefix web run test:unit
npm --prefix web run type-check
```

Expected:
- Vitest 全部 PASS
- `vue-tsc` 全部 PASS

- [ ] **Step 6: 提交收尾验证**

```bash
git add web/src web/tests
git commit -m "test: verify editorial markdown reading system"
```

---

## Self-review checklist

### Spec coverage

- 共享 prose 样式层：Task 1
- 切断预览污染正文：Task 1、Task 3
- 脚注支持：Task 2
- 预览与正文一致：Task 3、Task 5
- Feed / 论坛 / 其他 Markdown 区域统一：Task 4
- Tailwind 优先但允许少量共享 CSS：Task 1、Task 3

### Placeholder scan

- 无 `TODO` / `TBD`
- 所有文件路径、命令、测试入口已具体写出
- 所有代码改动步骤都给了实际代码骨架

### Type consistency

- 统一 prose 类名为 `a-prose prose-blog`
- 统一脚注类名为 `a-md-footnote-ref`、`a-md-footnotes`、`a-md-footnote-backref`
- 渲染入口始终是 `useMarkdownRenderer().renderMarkdown()`

---

Plan complete and saved to `docs/superpowers/plans/2026-06-03-markdown-editorial-reading-system.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**