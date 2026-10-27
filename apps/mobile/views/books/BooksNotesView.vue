<template>
  <div class="books-notes-view">
    <!-- Header -->
    <header class="books-notes-header">
      <div class="books-notes-header__top">
        <h1 class="books-notes-header__title">书摘</h1>
        <span class="books-notes-header__count">{{ notesList.length }} 条笔记</span>
      </div>
    </header>

    <div v-if="operationError" role="alert">
      <p>{{ operationError }}</p>
      <button type="button" @click="loadPrivateNotes">重新加载</button>
    </div>
    <!-- Guest State -->
    <div v-if="!props.initialNotes && authStore && !authStore.isAuthenticated" class="books-notes-guest-wrap">
      <MGuestCard
        title="登录查看书摘笔记"
        description="登录后可同步阅读划线与心得记录。"
        action-text="立即登录"
        icon="notes"
      />
    </div>

    <!-- Notes Stream -->
    <main v-else class="books-notes-content">
      <div v-if="notesList.length > 0" class="books-notes-list">
        <article
          v-for="note in notesList"
          :key="note.id"
          class="books-note-card"
          data-testid="book-note-card"
        >
          <!-- Book Badge & Chapter -->
          <div class="books-note-card__meta">
            <span class="books-note-card__book">
              <MIcon name="books" size="xs" />
              <span>{{ note.bookTitle }}</span>
            </span>
            <span v-if="note.chapter" class="books-note-card__chapter">{{ note.chapter }}</span>
          </div>

          <!-- Highlight Quote Block -->
          <blockquote class="books-note-card__quote">
            “{{ note.quote }}”
          </blockquote>

          <!-- User Reflection / Commentary -->
          <div v-if="note.comment" class="books-note-card__reflection">
            <div class="books-note-card__reflection-label">心得随笔</div>
            <p class="books-note-card__reflection-text">{{ note.comment }}</p>
          </div>

          <!-- Footer Actions -->
          <footer class="books-note-card__footer">
            <span class="books-note-card__time">{{ formatTime(note.created_at) }}</span>

            <div class="books-note-card__actions">
              <button
                type="button"
                class="books-note-card__action-btn"
                title="复制引文"
                @click="copyQuote(note)"
              >
                <MIcon name="notes" size="xs" />
                <span>复制</span>
              </button>
              <button
                type="button"
                class="books-note-card__action-btn books-note-card__action-btn--delete"
                :data-testid="`note-delete-btn-${note.id}`"
                :disabled="Boolean(deletingId)"
                title="删除书摘"
                @click="deleteNote(note.id)"
              >
                <MIcon name="xmark" size="xs" />
                <span>删除</span>
              </button>
            </div>
          </footer>
        </article>
      </div>

      <!-- Empty State -->
      <div v-else class="books-notes-empty">
        <div class="books-notes-empty__icon">
          <MIcon name="notes" size="lg" />
        </div>
        <p class="books-notes-empty__title">暂无书摘笔记</p>
        <p class="books-notes-empty__desc">在阅读过程中选中文本即可划线并添加书摘与随笔。</p>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { getActivePinia } from 'pinia'
import MIcon from '@mobile/components/ui/MIcon.vue'
import MGuestCard from '@mobile/components/ui/MGuestCard.vue'
import { useAuthStore } from '@/stores/auth'
import { deletePrivateNote, listPrivateNotes, type PrivateNote } from '@/api/bookPrivate'

export interface BookNoteItem {
  id: string
  bookTitle: string
  chapter?: string
  quote: string
  comment?: string
  created_at?: string
}

const props = withDefaults(
  defineProps<{
    initialNotes?: BookNoteItem[]
  }>(),
  {
    initialNotes: undefined,
  }
)

const authStore = getActivePinia() ? useAuthStore() : null
const operationError = ref('')
const deletingId = ref('')
const sourceNotes = new Map<string, PrivateNote>()
let loadGeneration = 0

const notesList = ref<BookNoteItem[]>(
  props.initialNotes ? [...props.initialNotes] : []
)

watch(
  () => props.initialNotes,
  (newVal) => {
    if (newVal) {
      notesList.value = [...newVal]
    }
  },
  { deep: true }
)

async function deleteNote(id: string) {
  if (deletingId.value) return
  // Explicit preview data is local-only; real notes require the server version.
  if (props.initialNotes) {
    notesList.value = notesList.value.filter(note => note.id !== id)
    return
  }
  const note = sourceNotes.get(id)
  if (!authStore?.isAuthenticated || !note) return
  const generation = loadGeneration
  deletingId.value = id
  operationError.value = ''
  try {
    await deletePrivateNote(note)
    if (generation !== loadGeneration) return
    sourceNotes.delete(id)
    notesList.value = notesList.value.filter(item => item.id !== id)
  } catch {
    if (generation === loadGeneration) operationError.value = '删除失败或笔记已更新，请重新加载后重试。'
  } finally {
    if (generation === loadGeneration) deletingId.value = ''
  }
}

function copyQuote(note: BookNoteItem) {
  const text = `“${note.quote}” ——《${note.bookTitle}》`
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {})
  }
}

function formatTime(isoString?: string): string {
  if (!isoString) return '刚刚'
  try {
    const d = new Date(isoString)
    const month = d.getMonth() + 1
    const day = d.getDate()
    return `${month}月${day}日`
  } catch {
    return '近期'
  }
}

async function loadPrivateNotes() {
  const generation = ++loadGeneration
  if (props.initialNotes) return
  notesList.value = []
  sourceNotes.clear()
  deletingId.value = ''
  operationError.value = ''
  if (!authStore?.isAuthenticated) return
  try {
    const result = await listPrivateNotes()
    if (generation !== loadGeneration) return
    for (const note of result.items) sourceNotes.set(String(note.id), note)
    notesList.value = result.items.map(note => ({
      id: String(note.id), bookTitle: note.title || '读书笔记',
      chapter: '', quote: note.body || '', comment: '',
      created_at: (note as PrivateNote & { created_at?: string }).created_at || '',
    }))
  } catch {
    if (generation === loadGeneration) operationError.value = '笔记加载失败，请重试。'
  }
}
watch(() => [authStore?.user?.uuid, authStore?.isAuthenticated], () => { void loadPrivateNotes() }, { immediate: true })
onBeforeUnmount(() => { loadGeneration += 1 })
</script>

<style scoped>
.books-notes-view {
  min-height: 100vh;
  background-color: var(--a-color-bg, #ffffff);
  padding: 16px 16px 96px;
  box-sizing: border-box;
}

.books-notes-header {
  margin-bottom: 20px;
}

.books-notes-header__top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.books-notes-header__title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
  letter-spacing: -0.01em;
}

.books-notes-header__count {
  font-size: 12px;
  color: var(--a-color-text-muted, #94a3b8);
}

.books-notes-header__subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--a-color-text-secondary, #64748b);
}

.books-notes-content {
  display: flex;
  flex-direction: column;
}

.books-notes-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.books-note-card {
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
  background-color: var(--a-color-surface, #ffffff);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: none !important;
  transition: border-color 0.15s ease;
}

.books-note-card__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.books-note-card__book {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.books-note-card__chapter {
  color: var(--a-color-text-muted, #94a3b8);
}

.books-note-card__quote {
  margin: 0;
  padding: 10px 14px;
  font-size: 14px;
  line-height: 1.65;
  color: var(--a-color-text, #1e293b);
  background-color: #fcfcfc;
  border-left: 3px solid #d97706; /* Subtle amber bookmark accent */
  border-radius: 0 4px 4px 0;
  font-style: normal;
}

.books-note-card__reflection {
  padding: 10px 12px;
  background-color: #f8fafc;
  border: 1px solid #f1f5f9;
  border-radius: 4px;
}

.books-note-card__reflection-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--a-color-text-muted, #94a3b8);
  margin-bottom: 4px;
  letter-spacing: 0.05em;
}

.books-note-card__reflection-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--a-color-text-secondary, #475569);
}

.books-note-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 6px;
  border-top: 1px solid var(--a-color-border-soft, #f1f5f9);
}

.books-note-card__time {
  font-size: 11px;
  color: var(--a-color-text-muted, #94a3b8);
}

.books-note-card__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.books-note-card__action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  color: var(--a-color-text-secondary, #64748b);
  background: none;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: 3px;
  padding: 3px 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.books-note-card__action-btn:active {
  background-color: #f8fafc;
}

.books-note-card__action-btn--delete {
  color: var(--a-color-text-muted, #94a3b8);
}

.books-note-card__action-btn--delete:active {
  color: #dc2626;
  border-color: #fecaca;
  background-color: #fef2f2;
}

.books-notes-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 64px 20px;
}

.books-notes-empty__icon {
  width: 52px;
  height: 52px;
  border-radius: 4px;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  background-color: #f8fafc;
  color: var(--a-color-text-muted, #94a3b8);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
}

.books-notes-empty__title {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.books-notes-empty__desc {
  margin: 0;
  font-size: 13px;
  color: var(--a-color-text-secondary, #64748b);
  line-height: 1.5;
}
</style>
