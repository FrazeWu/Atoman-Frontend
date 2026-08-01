<template>
  <div class="a-page short-note-timeline">
    <PPageHeader title="短话" />
    <div class="short-note-timeline__layout">
      <main class="short-note-timeline__stream">
        <ShortNoteComposer v-if="authStore.isAuthenticated" :key="composerKey" compact :submitting="publishing" @submit="publish" />
        <div v-if="loading && !notes.length" class="short-note-timeline__loading">
          <div v-for="index in 4" :key="index" class="a-skeleton" style="height:9rem" />
        </div>
        <PEmpty v-else-if="!notes.length" title="还没有短话" description="写下第一条短话。" />
        <div v-else>
          <ShortNoteCard v-for="note in notes" :key="note.id" :note="note" @delete="remove" />
        </div>
        <p v-if="error" class="short-note-timeline__error" role="alert">{{ error }}</p>
        <div v-if="hasMore" class="short-note-timeline__more"><PButton outline :loading="loading" @click="loadMore">加载更多</PButton></div>
      </main>

      <aside class="short-note-timeline__rail" aria-label="短话推荐">
        <section class="short-note-timeline__rail-section">
          <h2>热门短话</h2>
          <RouterLink v-for="note in hotNotes" :key="note.id" :to="`/posts/notes/${note.id}`" class="short-note-timeline__rail-note">
            <strong>{{ noteTitle(note) }}</strong>
            <span>{{ note.likes_count }} 喜欢 · {{ note.comments_count }} 评论</span>
          </RouterLink>
        </section>
        <section class="short-note-timeline__rail-section">
          <h2>最新动态</h2>
          <RouterLink v-for="note in latestNotes" :key="note.id" :to="`/posts/notes/${note.id}`" class="short-note-timeline__rail-note">
            <strong>{{ note.user?.display_name || note.user?.username || '匿名用户' }}</strong>
            <span>{{ noteTitle(note) }}</span>
          </RouterLink>
        </section>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { apiRequestEnvelope } from '@/api/client'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import ShortNoteCard from '@/components/shortnote/ShortNoteCard.vue'
import ShortNoteComposer from '@/components/shortnote/ShortNoteComposer.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type { ShortNote } from '@/types'

type ListMeta = { has_more?: boolean }
const api = useApi()
const authStore = useAuthStore()
const notes = ref<ShortNote[]>([])
const loading = ref(false)
const error = ref('')
const page = ref(1)
const hasMore = ref(false)
const publishing = ref(false)
const composerKey = ref(0)
const hotNotes = computed(() => [...notes.value]
  .sort((left, right) => (right.likes_count + right.comments_count) - (left.likes_count + left.comments_count))
  .slice(0, 4))
const latestNotes = computed(() => notes.value.slice(0, 4))

function noteTitle(note: ShortNote) {
  return note.content.length > 42 ? `${note.content.slice(0, 42)}...` : note.content
}

async function load(reset = false) {
  if (loading.value) return
  if (reset) { page.value = 1; notes.value = [] }
  loading.value = true
  error.value = ''
  try {
    const suffix = new URLSearchParams({ page: String(page.value), page_size: '20' })
    const response = await apiRequestEnvelope<ShortNote[], ListMeta>(`${api.blog.shortNotes}?${suffix}`)
    notes.value.push(...response.data)
    hasMore.value = Boolean(response.meta?.has_more)
  } catch {
    error.value = '短话加载失败，请重试'
  } finally {
    loading.value = false
  }
}
function loadMore() { page.value += 1; void load() }
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
  if (!window.confirm('确定删除这条短话吗？')) return
  try {
    await apiRequestEnvelope(api.blog.shortNote(note.id), { method: 'DELETE', headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {} })
    notes.value = notes.value.filter(item => item.id !== note.id)
  } catch { error.value = '删除失败，请重试' }
}
onMounted(() => void load())
</script>

<style scoped>
.short-note-timeline { max-width:75rem; padding-top:2rem; }
.short-note-timeline__layout { display:grid; grid-template-columns:minmax(0, 40rem) minmax(16rem, 20rem); gap:2rem; align-items:start; }
.short-note-timeline__stream { min-width:0; border-top:1px solid var(--a-color-border-soft); }
.short-note-timeline__rail { position:sticky; top:1.5rem; display:grid; gap:1rem; }
.short-note-timeline__rail-section { border:1px solid var(--a-color-border-soft); border-radius:var(--a-radius-control); overflow:hidden; }
.short-note-timeline__rail-section h2 { margin:0; padding:.85rem 1rem; border-bottom:1px solid var(--a-color-border-soft); font-size:.95rem; }
.short-note-timeline__rail-note { display:grid; gap:.3rem; padding:.8rem 1rem; color:inherit; text-decoration:none; border-bottom:1px solid var(--a-color-border-soft); }
.short-note-timeline__rail-note:last-child { border-bottom:0; }
.short-note-timeline__rail-note:hover { background:var(--a-color-bg-subtle); }
.short-note-timeline__rail-note strong { font-size:.85rem; line-height:1.4; font-weight:600; }
.short-note-timeline__rail-note span { color:var(--a-color-muted); font-size:.75rem; line-height:1.4; }
.short-note-timeline__loading { display:grid; gap:1rem; }
.short-note-timeline__more { display:flex; justify-content:center; margin-top:1.5rem; }
.short-note-timeline__error { color:var(--a-color-danger); }
@media (max-width: 1024px) {
  .short-note-timeline { max-width:42rem; }
  .short-note-timeline__layout { display:block; }
  .short-note-timeline__rail { display:none; }
}
</style>
