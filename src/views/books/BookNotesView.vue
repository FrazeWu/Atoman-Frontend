<template>
  <section class="books-notes-page a-content-frame">
    <PPageHeader title="笔记" sub="全书划线摘录与随手阅读笔记" mb="0" />

    <!-- 顶部工具栏 -->
    <div class="books-notes-toolbar">
      <div class="books-notes-toolbar__left">
        <div class="books-notes-search-wrapper">
          <Search :size="15" class="books-notes-search-icon" aria-hidden="true" />
          <input
            v-model="searchQuery"
            class="search-input books-notes-search-input"
            type="text"
            placeholder="搜索划线摘录或想法..."
            data-testid="notes-search-input"
            @input="onSearchInput"
            @keydown.enter="onSearchEnter"
          />
        </div>

        <div v-if="bookOptions.length > 1" class="books-notes-select-wrapper">
          <PSelect
            v-model="selectedAssetId"
            :options="bookOptions"
            placeholder="全部书籍"
            @update:model-value="loadNotes"
          />
        </div>

        <button
          type="button"
          class="books-notes-toggle"
          :class="{ 'is-active': hasNoteOnly }"
          data-testid="notes-has-note-toggle"
          role="switch"
          :aria-checked="hasNoteOnly"
          @click="toggleHasNoteOnly"
        >
          <span class="books-notes-toggle__indicator" aria-hidden="true" />
          <span>仅看有想法</span>
        </button>

        <div class="books-notes-colors" role="radiogroup" aria-label="按划线颜色筛选">
          <button
            type="button"
            class="books-notes-color-chip"
            :class="{ 'is-active': selectedColor === '' }"
            aria-label="全部色彩"
            @click="setColorFilter('')"
          >
            全部
          </button>
          <button
            v-for="c in colorOptions"
            :key="c.value"
            type="button"
            role="radio"
            :aria-checked="selectedColor === c.value"
            class="books-notes-color-dot"
            :class="{ 'is-active': selectedColor === c.value }"
            :data-color="c.value"
            :title="c.label"
            :aria-label="c.label"
            @click="setColorFilter(c.value)"
          />
        </div>
      </div>

      <div class="books-notes-toolbar__right">
        <PButton
          variant="secondary"
          size="sm"
          data-testid="notes-batch-export"
          :disabled="isLoading || notes.length === 0"
          @click="exportNotesToMarkdown"
        >
          <Download :size="15" aria-hidden="true" />
          <span>批量导出</span>
        </PButton>
      </div>
    </div>

    <!-- 错误反馈横幅 -->
    <div v-if="errorMessage" class="books-feedback books-feedback--error" role="alert">
      {{ errorMessage }}
    </div>

    <!-- 列表或加载状态 -->
    <div v-if="isLoading && notes.length === 0" class="books-notes-stream" aria-busy="true" aria-label="正在加载笔记">
      <PSkeleton v-for="index in 4" :key="index" height="8rem" />
    </div>

    <p v-else-if="!isLoading && notes.length === 0" class="books-notes-empty">
      暂无读书笔记，<RouterLink to="/books">前往书架或阅读器开始划线 →</RouterLink>
    </p>

    <div v-else class="books-notes-stream" role="feed" aria-label="读书笔记流">
      <article
        v-for="item in notes"
        :key="item.id"
        class="book-note-card"
        :data-note-id="item.id"
      >
        <span
          class="book-note-card__stripe"
          :data-color="item.color"
          aria-hidden="true"
        />

        <div class="book-note-card__body">
          <header class="book-note-card__header">
            <div class="book-note-card__book-info">
              <span class="book-note-card__title">《{{ item.book_title || '未命名书籍' }}》</span>
              <span v-if="item.book_author" class="book-note-card__author">{{ item.book_author }}</span>
            </div>
            <span v-if="item.chapter_title || item.pdf_page" class="book-note-card__location">
              {{ item.chapter_title || `第 ${item.pdf_page} 页` }}
            </span>
          </header>

          <blockquote
            class="book-note-card__quote"
            :class="{ 'is-underline': item.style === 'underline' }"
          >
            {{ item.text }}
          </blockquote>

          <!-- 个人想法区 -->
          <div v-if="editingNoteId === item.id" class="book-note-card__edit-note">
            <textarea
              v-model="editingNoteText"
              class="book-note-card__textarea"
              rows="2"
              placeholder="记录你的阅读想法..."
              data-testid="edit-note-textarea"
            />
            <div class="book-note-card__edit-actions">
              <PButton
                variant="primary"
                size="sm"
                :loading="isSavingNote"
                @click="saveEditNote(item)"
              >
                保存
              </PButton>
              <PButton
                variant="ghost"
                size="sm"
                :disabled="isSavingNote"
                @click="cancelEditNote"
              >
                取消
              </PButton>
            </div>
          </div>
          <div
            v-else-if="item.note"
            class="book-note-card__note"
            title="点击修改想法"
            @click="startEditNote(item)"
          >
            <Notes :size="13" class="book-note-card__note-icon" aria-hidden="true" />
            <span class="book-note-card__note-text">{{ item.note }}</span>
            <button
              type="button"
              class="book-note-card__note-edit-trigger"
              aria-label="编辑想法"
              title="编辑想法"
              @click.stop="startEditNote(item)"
            >
              <Edit2 :size="12" aria-hidden="true" />
            </button>
          </div>
          <div v-else class="book-note-card__add-note-action">
            <button
              type="button"
              class="book-note-card__add-note-btn"
              @click="startEditNote(item)"
            >
              <MessageSquarePlus :size="12" aria-hidden="true" />
              <span>添加想法</span>
            </button>
          </div>

          <footer class="book-note-card__footer">
            <time v-if="item.created_at" class="book-note-card__time" :datetime="item.created_at">
              {{ formatRelativeTime(item.created_at) }}
            </time>
            <div class="book-note-card__actions">
              <RouterLink
                :to="`/books/read/${item.asset_id}?annotationId=${item.id}`"
                class="book-note-card__action-link"
                :data-testid="'read-original-' + item.id"
              >
                <ArrowUpRight :size="13" aria-hidden="true" />
                <span>阅读原文</span>
              </RouterLink>

              <PButton
                variant="ghost"
                size="sm"
                :data-testid="'quote-action-' + item.id"
                @click="openQuoteModal(item)"
              >
                <PenTool :size="13" aria-hidden="true" />
                <span>引用写作</span>
              </PButton>

              <PButton
                variant="ghost"
                size="sm"
                :data-testid="'copy-citation-' + item.id"
                @click="copyCitation(item)"
              >
                <Copy :size="13" aria-hidden="true" />
                <span>复制引用</span>
              </PButton>

              <PButton
                variant="ghost"
                size="sm"
                class="book-note-card__delete-btn"
                :data-testid="'delete-note-' + item.id"
                @click="handleDeleteNote(item)"
              >
                <Trash :size="13" aria-hidden="true" />
                <span>删除</span>
              </PButton>
            </div>
          </footer>
        </div>
      </article>
    </div>

    <BookQuoteActionModal
      :open="quoteModalOpen"
      :item="activeQuoteItem"
      :book-title="activeQuoteItem?.book_title || '书籍摘录'"
      :book-author="activeQuoteItem?.book_author"
      @close="quoteModalOpen = false"
      @select="handleQuoteSelect"
    />

    <PConfirm
      :show="Boolean(deletingNote)"
      title="删除读书笔记"
      message="确定要删除该读书笔记吗？此操作不可撤销。"
      :danger="true"
      confirm-text="删除"
      cancel-text="取消"
      :loading="isDeletingNote"
      @confirm="executeDeleteNote"
      @cancel="deletingNote = null"
    />
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  Search,
  Download,
  Copy,
  Trash,
  StickyNote as Notes,
  ArrowUpRight,
  Edit2,
  MessageSquarePlus,
  PenTool,
} from 'lucide-vue-next'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PButton from '@/components/ui/PButton.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PSkeleton from '@/components/ui/PSkeleton.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import BookQuoteActionModal from '@/components/books/BookQuoteActionModal.vue'
import { useDraftStagingStore } from '@/stores/draftStaging'
import { useToast } from '@/composables/useToast'
import {
  listBookNotes,
  deleteBookAnnotation,
  updateBookAnnotation,
  type BookAnnotation,
  type BookHighlightColor,
} from '@/api/books'

interface BookOption {
  label: string
  value: string
}

const colorOptions = [
  { label: '黄色', value: 'yellow' as BookHighlightColor },
  { label: '绿色', value: 'green' as BookHighlightColor },
  { label: '蓝色', value: 'blue' as BookHighlightColor },
  { label: '粉色', value: 'pink' as BookHighlightColor },
]

const notes = ref<BookAnnotation[]>([])
const totalNotes = ref(0)
const isLoading = ref(true)
const errorMessage = ref('')

const searchQuery = ref('')
const selectedAssetId = ref('')
const hasNoteOnly = ref(false)
const selectedColor = ref<'' | BookHighlightColor>('')
const bookOptions = ref<BookOption[]>([{ label: '全部书籍', value: '' }])

const editingNoteId = ref<string | null>(null)
const editingNoteText = ref('')
const isSavingNote = ref(false)

const router = useRouter()
const toast = useToast()
const draftStagingStore = useDraftStagingStore()
const quoteModalOpen = ref(false)
const activeQuoteItem = ref<BookAnnotation | null>(null)

function openQuoteModal(item: BookAnnotation) {
  activeQuoteItem.value = item
  quoteModalOpen.value = true
}

function handleQuoteSelect(payload: { target: 'blog_post' | 'short_note'; mode: 'append' | 'replace' }) {
  if (!activeQuoteItem.value) return
  draftStagingStore.setPendingQuote({
    sourceType: 'book_annotation',
    annotationId: activeQuoteItem.value.id,
    assetId: activeQuoteItem.value.asset_id,
    bookTitle: activeQuoteItem.value.book_title || '书籍摘录',
    bookAuthor: activeQuoteItem.value.book_author,
    quoteText: activeQuoteItem.value.text,
    personalNote: activeQuoteItem.value.note || undefined,
    target: payload.target,
    mode: payload.mode,
  })
  quoteModalOpen.value = false
  if (payload.target === 'blog_post') {
    void router.push('/studio/blog/editor')
  } else {
    void router.push('/posts/notes/new')
  }
}

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const diff = Math.max(0, Date.now() - d.getTime())
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return d.toLocaleDateString('zh-CN')
}

const knownBooks = new Map<string, string>()

async function loadNotes() {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const res = await listBookNotes({
      q: searchQuery.value.trim() || undefined,
      asset_id: selectedAssetId.value || undefined,
      has_note: hasNoteOnly.value ? true : undefined,
      color: selectedColor.value || undefined,
      limit: 100,
    })
    notes.value = res.items || []
    totalNotes.value = res.total || 0

    // Accumulate seen books across fetches so selecting a book doesn't wipe others from dropdown
    for (const n of notes.value) {
      if (n.asset_id && n.book_title) {
        knownBooks.set(n.asset_id, n.book_title)
      }
    }
    const dynamicOptions = Array.from(knownBooks.entries()).map(([assetId, title]) => ({
      label: `《${title}》`,
      value: assetId,
    }))
    bookOptions.value = [{ label: '全部书籍', value: '' }, ...dynamicOptions]
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : '加载读书笔记失败'
  } finally {
    isLoading.value = false
  }
}

function onSearchInput() {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    loadNotes()
  }, 250)
}

function onSearchEnter() {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  loadNotes()
}

function toggleHasNoteOnly() {
  hasNoteOnly.value = !hasNoteOnly.value
  loadNotes()
}

function setColorFilter(color: '' | BookHighlightColor) {
  selectedColor.value = color
  loadNotes()
}

async function copyCitation(item: BookAnnotation) {
  const bookName = item.book_title ? `《${item.book_title}》` : ''
  const citation = `“${item.text}”${bookName ? ` —— ${bookName}` : ''}`
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
    await navigator.clipboard.writeText(citation)
    toast.success('引用已复制')
  } catch {
    toast.error('复制失败，请手动选中复制')
  }
}

function exportNotesToMarkdown() {
  if (!notes.value.length) return
  const dateStr = new Date().toLocaleDateString('zh-CN')

  let md = `# 读书笔记摘录\n\n`
  md += `导出时间：${dateStr}\n\n`
  md += `共 ${notes.value.length} 条划线与批注\n\n---\n\n`

  for (const ann of notes.value) {
    const bookTitle = ann.book_title ? `《${ann.book_title}》` : '未命名书籍'
    const author = ann.book_author ? ` · ${ann.book_author}` : ''
    const loc = ann.chapter_title || (ann.pdf_page ? `第 ${ann.pdf_page} 页` : (ann.format === 'txt' ? '正文' : ''))
    const locStr = loc ? ` (${loc})` : ''

    md += `### ${bookTitle}${author}${locStr}\n\n`
    md += `> ${ann.text}\n\n`
    if (ann.note) {
      md += `**想法**：${ann.note}\n\n`
    }
    const timeStr = ann.created_at ? new Date(ann.created_at).toLocaleString('zh-CN') : ''
    if (timeStr) {
      md += `*标注于 ${timeStr}*\n\n`
    }
    md += `---\n\n`
  }

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `读书笔记导出-${dateStr.replace(/[\/\\]/g, '-')}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function startEditNote(item: BookAnnotation) {
  editingNoteId.value = item.id
  editingNoteText.value = item.note || ''
}

function cancelEditNote() {
  editingNoteId.value = null
  editingNoteText.value = ''
}

async function saveEditNote(item: BookAnnotation) {
  if (isSavingNote.value) return
  isSavingNote.value = true
  try {
    const updated = await updateBookAnnotation(item.id, { note: editingNoteText.value.trim() })
    item.note = updated?.note ?? editingNoteText.value.trim()
    editingNoteId.value = null
  } catch {
    // Retain edit state on failure
  } finally {
    isSavingNote.value = false
  }
}

const deletingNote = ref<BookAnnotation | null>(null)
const isDeletingNote = ref(false)

function handleDeleteNote(item: BookAnnotation) {
  deletingNote.value = item
}

async function executeDeleteNote() {
  if (!deletingNote.value || isDeletingNote.value) return
  const noteId = deletingNote.value.id
  isDeletingNote.value = true
  try {
    await deleteBookAnnotation(noteId)
    notes.value = notes.value.filter((n) => n.id !== noteId)
    totalNotes.value = Math.max(0, totalNotes.value - 1)
    deletingNote.value = null
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : '删除笔记失败'
  } finally {
    isDeletingNote.value = false
  }
}

onMounted(() => {
  loadNotes()
})

onBeforeUnmount(() => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
})
</script>

<style scoped>
.books-notes-page {
  padding: 1.5rem 1rem 3rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.books-notes-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding: 0.75rem 1rem;
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
}

.books-notes-toolbar__left {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  flex: 1;
}

.books-notes-toolbar__right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.books-notes-search-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-width: 14rem;
  flex: 1;
  max-width: 22rem;
}

.books-notes-search-icon {
  position: absolute;
  left: 0.65rem;
  color: var(--a-color-muted);
  pointer-events: none;
}

.books-notes-search-input {
  width: 100%;
  height: 2rem;
  padding: 0.25rem 0.6rem 0.25rem 2rem;
  font-size: 0.8125rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  outline: none;
  transition: border-color var(--a-motion-micro);
}

.books-notes-search-input:focus {
  border-color: var(--a-color-primary);
}

.books-notes-select-wrapper {
  min-width: 8rem;
}

.books-notes-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  height: 2rem;
  padding: 0.25rem 0.65rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--a-color-muted);
  cursor: pointer;
  transition: color var(--a-motion-micro), border-color var(--a-motion-micro), background-color var(--a-motion-micro);
}

.books-notes-toggle:hover {
  color: var(--a-color-fg);
  border-color: var(--a-color-fg);
}

.books-notes-toggle.is-active {
  border-color: var(--a-color-primary);
  color: var(--a-color-primary);
  background: color-mix(in srgb, var(--a-color-primary) 8%, var(--a-color-bg));
}

.books-notes-toggle__indicator {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 1px;
  background-color: var(--a-color-border-soft);
  transition: background-color var(--a-motion-micro);
}

.books-notes-toggle.is-active .books-notes-toggle__indicator {
  background-color: var(--a-color-primary);
}

.books-notes-colors {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding-left: 0.25rem;
}

.books-notes-color-chip {
  height: 2rem;
  padding: 0 0.55rem;
  font-size: 0.75rem;
  font-weight: 500;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-muted);
  cursor: pointer;
  transition: color var(--a-motion-micro), border-color var(--a-motion-micro), background-color var(--a-motion-micro);
}

.books-notes-color-chip.is-active {
  border-color: var(--a-color-primary);
  color: var(--a-color-primary);
  background: color-mix(in srgb, var(--a-color-primary) 8%, var(--a-color-bg));
}

.books-notes-color-dot {
  width: 1.15rem;
  height: 1.15rem;
  border-radius: var(--a-radius-control);
  border: 1px solid transparent;
  cursor: pointer;
  padding: 0;
  transition: transform var(--a-motion-micro), border-color var(--a-motion-micro);
}

.books-notes-color-dot[data-color="yellow"] {
  background-color: color-mix(in srgb, var(--a-color-warning) 75%, transparent);
}

.books-notes-color-dot[data-color="green"] {
  background-color: color-mix(in srgb, var(--a-color-success) 75%, transparent);
}

.books-notes-color-dot[data-color="blue"] {
  background-color: color-mix(in srgb, var(--a-color-primary) 75%, transparent);
}

.books-notes-color-dot[data-color="pink"] {
  background-color: color-mix(in srgb, var(--a-color-danger) 75%, transparent);
}

.books-notes-color-dot.is-active {
  border-color: var(--a-color-fg);
  transform: scale(1.15);
}

.books-feedback {
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  border-radius: var(--a-radius-card);
}

.books-feedback--error {
  background: color-mix(in srgb, var(--a-color-danger) 10%, var(--a-color-bg));
  color: var(--a-color-danger);
  border: 1px solid color-mix(in srgb, var(--a-color-danger) 25%, transparent);
}

.books-notes-empty {
  margin: 2rem 0;
  padding: 3rem 1.5rem;
  text-align: center;
  font-size: 0.875rem;
  color: var(--a-color-muted);
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
}

.books-notes-empty a {
  color: var(--a-color-primary);
  text-decoration: none;
  font-weight: 500;
  transition: color var(--a-motion-micro);
}

.books-notes-empty a:hover {
  text-decoration: underline;
}

.books-notes-stream {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.book-note-card {
  display: flex;
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  overflow: hidden;
  transition: border-color var(--a-motion-micro);
}

.book-note-card:hover {
  border-color: color-mix(in srgb, var(--a-color-border-soft) 60%, var(--a-color-fg));
}

.book-note-card__stripe {
  width: 4px;
  align-self: stretch;
  flex-shrink: 0;
  background-color: var(--a-color-border-soft);
}

.book-note-card__stripe[data-color="yellow"] {
  background-color: color-mix(in srgb, var(--a-color-warning) 75%, transparent);
}

.book-note-card__stripe[data-color="green"] {
  background-color: color-mix(in srgb, var(--a-color-success) 75%, transparent);
}

.book-note-card__stripe[data-color="blue"] {
  background-color: color-mix(in srgb, var(--a-color-primary) 75%, transparent);
}

.book-note-card__stripe[data-color="pink"] {
  background-color: color-mix(in srgb, var(--a-color-danger) 75%, transparent);
}

.book-note-card__body {
  flex: 1;
  min-width: 0;
  padding: 0.875rem 1.125rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.book-note-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.book-note-card__book-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-note-card__title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--a-color-fg);
}

.book-note-card__author {
  font-size: 0.78rem;
  color: var(--a-color-muted);
}

.book-note-card__location {
  font-size: 0.75rem;
  color: var(--a-color-muted);
  white-space: nowrap;
}

.book-note-card__quote {
  margin: 0;
  padding: 0.4rem 0.75rem;
  font-size: 0.875rem;
  font-style: italic;
  font-weight: 500;
  line-height: 1.6;
  color: var(--a-color-fg);
  background: color-mix(in srgb, var(--a-color-surface-muted) 50%, var(--a-color-bg));
  border-left: 2px solid var(--a-color-border-soft);
  border-radius: 0 var(--a-radius-control) var(--a-radius-control) 0;
  word-break: break-word;
}

.book-note-card__quote.is-underline {
  text-decoration: underline;
  text-decoration-color: var(--a-color-primary);
  text-underline-offset: 3px;
}

.book-note-card__note {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  padding: 0.5rem 0.75rem;
  background: var(--a-color-surface-muted);
  border-radius: var(--a-radius-control);
  font-size: 0.8125rem;
  color: var(--a-color-fg);
  line-height: 1.45;
  cursor: pointer;
  transition: background-color var(--a-motion-micro);
}

.book-note-card__note:hover {
  background: color-mix(in srgb, var(--a-color-surface-muted) 80%, var(--a-color-fg));
}

.book-note-card__note-icon {
  color: var(--a-color-muted);
  flex-shrink: 0;
  margin-top: 0.15rem;
}

.book-note-card__note-text {
  flex: 1;
  word-break: break-word;
}

.book-note-card__note-edit-trigger {
  border: 0;
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
  padding: 0.1rem;
  border-radius: var(--a-radius-control);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color var(--a-motion-micro);
}

.book-note-card__note-edit-trigger:hover {
  color: var(--a-color-fg);
}

.book-note-card__add-note-action {
  display: flex;
  align-items: center;
}

.book-note-card__add-note-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: 0;
  background: transparent;
  padding: 0.15rem 0.35rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--a-color-muted);
  cursor: pointer;
  border-radius: var(--a-radius-control);
  transition: color var(--a-motion-micro), background-color var(--a-motion-micro);
}

.book-note-card__add-note-btn:hover {
  color: var(--a-color-primary);
  background: var(--a-color-surface-muted);
}

.book-note-card__edit-note {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.book-note-card__textarea {
  width: 100%;
  padding: 0.4rem 0.6rem;
  font-size: 0.8125rem;
  line-height: 1.45;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  resize: vertical;
  outline: none;
  transition: border-color var(--a-motion-micro);
}

.book-note-card__textarea:focus {
  border-color: var(--a-color-primary);
}

.book-note-card__edit-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  justify-content: flex-end;
}

.book-note-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.2rem;
  padding-top: 0.4rem;
  border-top: 1px solid var(--a-color-border-soft);
}

.book-note-card__time {
  font-size: 0.75rem;
  color: var(--a-color-muted);
}

.book-note-card__actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.book-note-card__action-link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--a-color-muted);
  text-decoration: none;
  padding: 0.25rem 0.5rem;
  border-radius: var(--a-radius-control);
  transition: color var(--a-motion-micro), background-color var(--a-motion-micro);
}

.book-note-card__action-link:hover {
  color: var(--a-color-primary);
  background: var(--a-color-surface-muted);
}

.book-note-card__delete-btn:hover {
  color: var(--a-color-danger);
}
</style>
