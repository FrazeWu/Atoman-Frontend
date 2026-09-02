<template>
  <div class="a-page short-note-timeline">
    <PPageHeader title="短笺" />
    <div class="short-note-timeline__layout">
      <main class="short-note-timeline__stream">
        <ShortNoteComposer v-if="authStore.isAuthenticated" :key="composerKey" compact :submitting="publishing" @submit="publish" />
        <div v-if="loading && !notes.length" class="short-note-timeline__loading">
          <div v-for="index in 3" :key="index" class="a-skeleton short-note-timeline__skeleton" />
        </div>
        <PEmpty v-else-if="!notes.length" title="还没有短笺" description="写下第一条短笺。" />
        <div v-else class="short-note-timeline__feed">
          <ShortNoteCard v-for="note in notes" :key="note.id" :note="note" @delete="remove" />
        </div>
        <p v-if="error" class="short-note-timeline__error" role="alert">{{ error }}</p>
        <div v-if="hasMore" ref="loadMoreSentinel" class="short-note-timeline__more">
          <PButton outline :loading="loading" @click="loadMore">加载更多</PButton>
        </div>
      </main>

      <aside class="short-note-timeline__rail" aria-label="短笺推荐">
        <section class="short-note-timeline__rail-section">
          <div class="short-note-timeline__rail-header">
            <Flame :size="16" class="short-note-timeline__rail-icon is-hot" />
            <h2>热门短笺</h2>
          </div>
          <div class="short-note-timeline__rail-list">
          <button
            v-for="note in hotNotes"
            :key="note.id"
            type="button"
            class="short-note-timeline__rail-note"
            @click="openNoteSheet(note)"
          >
              <strong class="short-note-timeline__rail-title">{{ noteTitle(note) }}</strong>
              <div class="short-note-timeline__rail-stats">
                <span><Heart :size="12" /> {{ note.likes_count }}</span>
                <span><MessageSquare :size="12" /> {{ note.comments_count }}</span>
              </div>
            </button>
          </div>
        </section>

        <section class="short-note-timeline__rail-section">
          <div class="short-note-timeline__rail-header">
            <Sparkles :size="16" class="short-note-timeline__rail-icon is-latest" />
            <h2>最新动态</h2>
          </div>
          <div class="short-note-timeline__rail-list">
            <button
              v-for="note in latestNotes"
              :key="note.id"
              type="button"
              class="short-note-timeline__rail-note"
              @click="openNoteSheet(note)"
            >
              <strong class="short-note-timeline__rail-author">{{ note.user?.display_name || note.user?.username || '匿名用户' }}</strong>
              <span class="short-note-timeline__rail-preview">{{ noteTitle(note) }}</span>
            </button>
          </div>
        </section>
      </aside>
    </div>
  </div>
  <PConfirm
    :show="deletePending !== null"
    title="删除短笺"
    message="确定删除这条短笺吗？"
    confirm-text="删除"
    danger
    :loading="deleting"
    @confirm="confirmRemove"
    @cancel="deletePending = null"
  />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { IconFlame as Flame, IconHeart as Heart, IconMessage as MessageSquare, IconSparkles as Sparkles } from '@tabler/icons-vue'
import { apiRequestEnvelope } from '@/api/client'
import PButton from '@/components/ui/PButton.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import ShortNoteCard from '@/components/shortnote/ShortNoteCard.vue'
import ShortNoteComposer from '@/components/shortnote/ShortNoteComposer.vue'
import { useApi } from '@/composables/useApi'
import { useBlogSheets } from '@/composables/useBlogSheets'
import { useAuthStore } from '@/stores/auth'
import type { ShortNote } from '@/types'

type ListMeta = { has_more?: boolean }
const api = useApi()
const authStore = useAuthStore()
const blogSheets = useBlogSheets()
const notes = ref<ShortNote[]>([])
const loading = ref(false)
const error = ref('')
const page = ref(1)
const hasMore = ref(false)
const publishing = ref(false)
const composerKey = ref(0)
const deletePending = ref<ShortNote | null>(null)
const deleting = ref(false)
const loadMoreSentinel = ref<HTMLElement | null>(null)
let loadMoreObserver: IntersectionObserver | null = null
const hotNotes = computed(() => [...notes.value]
  .sort((left, right) => (right.likes_count + right.comments_count) - (left.likes_count + left.comments_count))
  .slice(0, 4))
const latestNotes = computed(() => notes.value.slice(0, 4))

function noteTitle(note: ShortNote) {
  return note.content.length > 42 ? `${note.content.slice(0, 42)}...` : note.content
}

function openNoteSheet(note: ShortNote) {
  blogSheets.openShortNote(note.id, noteTitle(note))
}

async function load(reset = false, requestedPage?: number) {
  if (loading.value) return false
  const targetPage = requestedPage ?? (reset ? 1 : page.value)
  loading.value = true
  error.value = ''
  try {
    const suffix = new URLSearchParams({ page: String(targetPage), page_size: '20' })
    const response = await apiRequestEnvelope<ShortNote[], ListMeta>(`${api.blog.shortNotes}?${suffix}`)
    notes.value = reset ? response.data : [...notes.value, ...response.data]
    page.value = targetPage
    hasMore.value = Boolean(response.meta?.has_more)
    return true
  } catch {
    error.value = '短笺加载失败，请重试'
    return false
  } finally {
    loading.value = false
  }
}
function loadMore() {
  if (loading.value || !hasMore.value) return
  void load(false, page.value + 1)
}

function observeLoadMoreSentinel(target: HTMLElement | null) {
  loadMoreObserver?.disconnect()
  if (!target || typeof IntersectionObserver === 'undefined') return
  loadMoreObserver = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) loadMore()
  }, { rootMargin: '320px 0px' })
  loadMoreObserver.observe(target)
}
async function publish(payload: { content: string; media_urls: string[] }) {
  if (publishing.value) return
  publishing.value = true
  error.value = ''
  try {
    const response = await apiRequestEnvelope<ShortNote>(api.blog.shortNotes, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
      body: JSON.stringify(payload),
    })
    notes.value.unshift(response.data)
    composerKey.value += 1
  } catch {
    error.value = '发布失败，请重试'
  } finally {
    publishing.value = false
  }
}
async function remove(note: ShortNote) {
  if (deleting.value) return
  deletePending.value = note
}

async function confirmRemove() {
  const note = deletePending.value
  if (!note || deleting.value) return
  deleting.value = true
  try {
    await apiRequestEnvelope(api.blog.shortNote(note.id), { method: 'DELETE', headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {} })
    notes.value = notes.value.filter(item => item.id !== note.id)
  } catch { error.value = '删除失败，请重试' }
  finally {
    deleting.value = false
    deletePending.value = null
  }
}
onMounted(() => void load())
watch(loadMoreSentinel, observeLoadMoreSentinel)
onBeforeUnmount(() => loadMoreObserver?.disconnect())
</script>

<style scoped>
.short-note-timeline {
  max-width: 75rem;
  padding-top: 1.5rem;
  padding-bottom: 3rem;
}

.short-note-timeline__layout {
  display: grid;
  grid-template-columns: minmax(0, 42rem) minmax(16rem, 20rem);
  gap: 2rem;
  align-items: start;
  margin-top: 1rem;
}

.short-note-timeline__stream {
  min-width: 0;
}

.short-note-timeline__feed {
  display: flex;
  flex-direction: column;
}

.short-note-timeline__skeleton {
  height: 10rem;
  border-radius: var(--a-radius-card);
  margin-bottom: 1rem;
}

.short-note-timeline__rail {
  position: sticky;
  top: 1.5rem;
  display: grid;
  gap: 1.25rem;
}

.short-note-timeline__rail-section {
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  overflow: hidden;
  box-shadow: var(--a-shadow-sm);
}

.short-note-timeline__rail-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface-muted);
}

.short-note-timeline__rail-header h2 {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 650;
  color: var(--a-color-fg);
}

.short-note-timeline__rail-icon.is-hot {
  color: var(--a-color-warning);
}

.short-note-timeline__rail-icon.is-latest {
  color: var(--a-color-primary);
}

.short-note-timeline__rail-list {
  display: flex;
  flex-direction: column;
}

.short-note-timeline__rail-note {
  position: relative;
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.85rem 1rem;
  border: 0;
  color: inherit;
  text-align: left;
  text-decoration: none;
  border-bottom: 1px solid var(--a-color-border-soft);
  background: transparent;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.15s ease;
}

.short-note-timeline__rail-note::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--a-color-text);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.short-note-timeline__rail-note:last-child {
  border-bottom: 0;
}

.short-note-timeline__rail-note:hover,
.short-note-timeline__rail-note:focus-visible {
  background: var(--a-color-surface-muted);
  outline: none;
}

.short-note-timeline__rail-note:focus-visible {
  box-shadow: inset 0 0 0 2px var(--a-color-primary);
}

.short-note-timeline__rail-note:hover::before {
  opacity: 1;
}

.short-note-timeline__rail-title {
  font-size: 0.85rem;
  line-height: 1.45;
  font-weight: 550;
  color: var(--a-color-fg);
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.short-note-timeline__rail-stats {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--a-color-muted);
  font-size: 0.75rem;
}

.short-note-timeline__rail-stats span {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.short-note-timeline__rail-author {
  font-size: 0.85rem;
  font-weight: 650;
  color: var(--a-color-fg);
}

.short-note-timeline__rail-preview {
  color: var(--a-color-muted);
  font-size: 0.8rem;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.short-note-timeline__loading {
  display: grid;
  gap: 1rem;
}

.short-note-timeline__more {
  display: flex;
  justify-content: center;
  margin-top: 1.5rem;
}

.short-note-timeline__error {
  color: var(--a-color-danger);
  font-size: 0.875rem;
}

@media (max-width: 1024px) {
  .short-note-timeline {
    max-width: 42rem;
  }
  .short-note-timeline__layout {
    display: block;
  }
  .short-note-timeline__rail {
    display: none;
  }
}
</style>
