<template>
  <div class="a-page-md short-note-timeline">
    <PPageHeader title="短话" />
    <ShortNoteComposer v-if="authStore.isAuthenticated" :submitting="publishing" @submit="publish" />
    <div v-if="loading && !notes.length" class="short-note-timeline__loading">
      <div v-for="index in 4" :key="index" class="a-skeleton" style="height:9rem" />
    </div>
    <PEmpty v-else-if="!notes.length" title="还没有短话" description="写下第一条短话。" />
    <div v-else>
      <ShortNoteCard v-for="note in notes" :key="note.id" :note="note" @delete="remove" />
    </div>
    <p v-if="error" class="short-note-timeline__error" role="alert">{{ error }}</p>
    <div v-if="hasMore" class="short-note-timeline__more"><PButton outline :loading="loading" @click="loadMore">加载更多</PButton></div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
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
.short-note-timeline { padding-top:2rem; }
.short-note-timeline__loading { display:grid; gap:1rem; }
.short-note-timeline__more { display:flex; justify-content:center; margin-top:1.5rem; }
.short-note-timeline__error { color:var(--a-color-danger); }
</style>
