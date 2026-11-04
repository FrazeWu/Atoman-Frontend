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

    <PEmpty
      v-else-if="!isLoading && notes.length === 0"
      title="尚未记录笔记"
      description="在阅读过程中选中文本即可添加划线与想法"
      align="center"
    />

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
import PEmpty from '@/components/ui/PEmpty.vue'
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
    void router.push('/studio/blog/new')
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
@import "./bookNotesView.css";
</style>
