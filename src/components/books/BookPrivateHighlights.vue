<template>
  <div class="book-private-highlights">
    <!-- 顶部检索与颜色筛选工具条 -->
    <div class="book-private-highlights__toolbar">
      <!-- 颜色圆点筛选 -->
      <div class="book-private-highlights__colors">
        <button
          type="button"
          class="book-private-highlights__color-all"
          :class="{ 'is-active': color === '' }"
          @click="selectColor('')"
        >
          全部颜色
        </button>
        <button
          type="button"
          class="book-private-highlights__color-dot is-yellow"
          :class="{ 'is-active': color === 'yellow' }"
          title="黄色高亮"
          @click="selectColor('yellow')"
        />
        <button
          type="button"
          class="book-private-highlights__color-dot is-green"
          :class="{ 'is-active': color === 'green' }"
          title="绿色高亮"
          @click="selectColor('green')"
        />
        <button
          type="button"
          class="book-private-highlights__color-dot is-blue"
          :class="{ 'is-active': color === 'blue' }"
          title="蓝色高亮"
          @click="selectColor('blue')"
        />
        <button
          type="button"
          class="book-private-highlights__color-dot is-pink"
          :class="{ 'is-active': color === 'pink' }"
          title="粉色高亮"
          @click="selectColor('pink')"
        />
      </div>

      <!-- 搜索输入 -->
      <div class="book-private-highlights__search">
        <input
          v-model="query"
          type="search"
          placeholder="搜索原文、批注或书名..."
          class="book-private-highlights__input"
          @keyup.enter="load()"
        />
        <PButton variant="secondary" size="sm" @click="load()">
          搜索
        </PButton>
      </div>

      <!-- 导出 -->
      <div class="book-private-highlights__export">
        <PButton
          variant="secondary"
          size="sm"
          :disabled="busy || !items.length"
          @click="exportMarks"
        >
          导出 Markdown
        </PButton>
      </div>
    </div>

    <!-- 状态反馈 -->
    <p v-if="error" role="alert" class="book-catalog__error">{{ error }}</p>
    <p v-if="loading" role="status" class="text-xs text-[var(--a-color-text-secondary)]">正在加载划线…</p>

    <!-- 划线卡片流 -->
    <div v-else-if="items.length" class="book-private-highlights__list">
      <article
        v-for="item in items"
        :key="item.id"
        class="book-private-highlights__card"
      >
        <!-- 头部元信息：书名与时间 -->
        <div class="book-private-highlights__card-header">
          <RouterLink
            :to="`/books/work/${item.work_id}`"
            class="book-private-highlights__work-title"
          >
            {{ item.work_title || '未命名书籍' }}
          </RouterLink>
          <span class="book-private-highlights__time">{{ formatTime(item.created_at) }}</span>
        </div>

        <!-- 划线原文引用 -->
        <blockquote
          class="book-private-highlights__quote"
          :class="`is-${item.color || 'yellow'}`"
        >
          “{{ item.quote }}”
        </blockquote>

        <!-- 读者想法便签（若有批注） -->
        <div v-if="item.note" class="book-private-highlights__thought">
          <div class="book-private-highlights__thought-header">💬 批注与想法</div>
          <p class="book-private-highlights__thought-body">{{ item.note }}</p>
        </div>

        <!-- 底部操作栏 -->
        <div class="book-private-highlights__card-footer">
          <div class="flex items-center gap-3">
            <RouterLink
              v-if="item.asset_id && item.revision_id"
              :to="{ path: resourceReaderPath(item.work_id, item.asset_id, item.revision_id), query: { mark: item.id } }"
              class="book-private-highlights__action-link"
            >
              在阅读器中定位 ➔
            </RouterLink>
            <button
              type="button"
              class="book-private-highlights__copy-btn"
              @click="copyText(item.quote)"
            >
              {{ copiedId === item.id ? '已复制 ✓' : '复制引文' }}
            </button>
          </div>

          <PButton variant="ghost" size="sm" @click="edit(item)">
            编辑批注
          </PButton>
        </div>
      </article>

      <!-- 加载更多 -->
      <div v-if="items.length < total" class="pt-4 flex justify-center">
        <PButton variant="secondary" :disabled="loading" @click="load(true)">
          加载更多划线 ({{ items.length }} / {{ total }})
        </PButton>
      </div>
    </div>

    <!-- 空状态 -->
    <PEmpty
      v-else
      description="暂无划线，可以在阅读器中选中文字添加划线与批注。"
    />

    <!-- 划线与批注编辑弹窗 -->
    <BookHighlightEditor
      v-if="draft"
      :key="draft.id"
      ref="editor"
      :draft="draft"
      :busy="busy"
      :frozen="false"
      :conflict="conflict"
      :error="editError"
      @close="draft = null"
      @save="save"
      @delete="remove"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, onBeforeRouteLeave } from 'vue-router'
import { ApiErrorResponseError } from '@/api/client'
import { privateBookRequest, downloadBookData } from '@/api/bookPrivate'
import { saveReadingMark, deleteReadingMark, type ReadingMark } from '@/api/bookReading'
import { resourceReaderPath } from '@/api/bookResources'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import BookHighlightEditor from './BookHighlightEditor.vue'

interface Item extends ReadingMark {
  work_id: string
  asset_id: string
  work_title: string
}

const items = ref<Item[]>([])
const total = ref(0)
const query = ref('')
const color = ref('')
const error = ref('')
const editError = ref('')
const loading = ref(false)
const busy = ref(false)
const conflict = ref(false)
const draft = ref<Item | null>(null)
const copiedId = ref('')

let sequence = 0

function selectColor(val: string) {
  color.value = val
  load()
}

function edit(item: Item) {
  conflict.value = false
  editError.value = ''
  draft.value = item
}

const editor = ref<InstanceType<typeof BookHighlightEditor>>()
onBeforeRouteLeave(() => editor.value?.requestClose() ?? true)

async function page(offset = 0) {
  const params = new URLSearchParams({
    limit: '50',
    offset: String(offset),
  })
  if (query.value.trim()) params.set('q', query.value.trim())
  if (color.value) params.set('color', color.value)

  return privateBookRequest<{ items: Item[]; total: number }>(`/me/reading-marks?${params}`)
}

async function load(append = false) {
  const current = ++sequence
  loading.value = true
  error.value = ''
  try {
    const result = await page(append ? items.value.length : 0)
    if (current !== sequence) return
    items.value = append ? [...items.value, ...result.items] : result.items
    total.value = result.total
  } catch {
    error.value = '划线加载失败，请重试。'
  } finally {
    if (current === sequence) loading.value = false
  }
}

async function save(value: { color: string; style: string; note: string }) {
  if (!draft.value || busy.value) return
  const item = draft.value
  busy.value = true
  editError.value = ''
  try {
    await saveReadingMark(item.revision_id, item.id, {
      base_version: item.version,
      kind: item.kind,
      anchor: item.anchor,
      label: item.label,
      quote: item.quote,
      ...value,
    })
    draft.value = null
    await load()
  } catch (err) {
    conflict.value = err instanceof ApiErrorResponseError && err.status === 409
    editError.value = '保存失败，输入仍保留；云端冲突时请关闭并重新搜索后编辑。'
  } finally {
    busy.value = false
  }
}

async function remove() {
  if (!draft.value || busy.value) return
  busy.value = true
  try {
    await deleteReadingMark(draft.value.revision_id, draft.value.id, draft.value.version)
    draft.value = null
    await load()
  } catch {
    editError.value = '删除失败，请重新加载后重试。'
  } finally {
    busy.value = false
  }
}

async function exportMarks() {
  busy.value = true
  try {
    const all: Item[] = []
    do {
      const result = await page(all.length)
      all.push(...result.items)
      if (all.length >= result.total || !result.items.length) break
    } while (true)

    downloadBookData(
      all
        .map(
          item =>
            `## ${item.work_title}\n\n> ${item.quote.replaceAll('\n', '\n> ')}\n\n${item.note ? `*想法*：${item.note}\n` : ''}`
        )
        .join('\n---\n\n'),
      'atoman-highlights.md'
    )
  } catch {
    error.value = '划线导出失败。'
  } finally {
    busy.value = false
  }
}

function copyText(text: string) {
  navigator.clipboard?.writeText(text)
}

function formatTime(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

onMounted(load)
</script>

<style scoped>
.book-private-highlights {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.book-private-highlights__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: var(--a-color-surface, #ffffff);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card, 4px);
  box-shadow: none !important;
}

.book-private-highlights__colors {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.book-private-highlights__color-all {
  font-size: 0.75rem;
  color: var(--a-color-text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  border-radius: var(--a-radius-control, 4px);
  transition: all 0.15s ease;
}

.book-private-highlights__color-all.is-active,
.book-private-highlights__color-all:hover {
  color: var(--a-color-text);
  background: var(--a-color-surface-muted, #f1f5f9);
}

.book-private-highlights__color-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.book-private-highlights__color-dot.is-yellow { background: #f59e0b; }
.book-private-highlights__color-dot.is-green { background: #10b981; }
.book-private-highlights__color-dot.is-blue { background: #0ea5e9; }
.book-private-highlights__color-dot.is-pink { background: #ec4899; }

.book-private-highlights__color-dot.is-active {
  transform: scale(1.25);
  border-color: var(--a-color-text, #0f172a);
}

.book-private-highlights__search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 220px;
}

.book-private-highlights__input {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 0.75rem;
  font-size: 0.8125rem;
  background: var(--a-color-bg, #ffffff);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control, 4px);
  color: var(--a-color-text);
  outline: none;
  box-shadow: none !important;
}

.book-private-highlights__input:focus {
  border-color: var(--a-color-primary);
}

.book-private-highlights__export {
  margin-left: auto;
}

.book-private-highlights__list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.book-private-highlights__card {
  background: var(--a-color-surface, #ffffff);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card, 4px);
  padding: 1.125rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  box-shadow: none !important;
}

.book-private-highlights__card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.book-private-highlights__work-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--a-color-text);
  text-decoration: none;
  transition: color 0.15s ease;
}

.book-private-highlights__work-title:hover {
  color: var(--a-color-primary);
}

.book-private-highlights__time {
  font-size: 0.75rem;
  color: var(--a-color-text-secondary);
}

.book-private-highlights__quote {
  margin: 0;
  padding: 0.625rem 0.875rem;
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--a-color-text);
  background: var(--a-color-bg, #f8fafc);
  border-left: 3px solid #f59e0b;
  border-radius: 0 var(--a-radius-card, 4px) var(--a-radius-card, 4px) 0;
}

.book-private-highlights__quote.is-yellow { border-left-color: #f59e0b; }
.book-private-highlights__quote.is-green { border-left-color: #10b981; }
.book-private-highlights__quote.is-blue { border-left-color: #0ea5e9; }
.book-private-highlights__quote.is-pink { border-left-color: #ec4899; }

.book-private-highlights__thought {
  background: #fefce8;
  border: 1px solid #fef08a;
  border-radius: var(--a-radius-card, 4px);
  padding: 0.625rem 0.875rem;
  font-size: 0.8125rem;
  color: #713f12;
}

.book-private-highlights__thought-header {
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.book-private-highlights__thought-body {
  margin: 0;
  line-height: 1.5;
}

.book-private-highlights__card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--a-color-border-soft);
}

.book-private-highlights__action-link {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--a-color-primary);
  text-decoration: none;
}

.book-private-highlights__action-link:hover {
  text-decoration: underline;
}

.book-private-highlights__copy-btn {
  font-size: 0.75rem;
  color: var(--a-color-text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
}

.book-private-highlights__copy-btn:hover {
  color: var(--a-color-text);
}
</style>
