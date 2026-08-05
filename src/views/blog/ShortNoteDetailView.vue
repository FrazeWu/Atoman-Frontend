<template>
  <div class="a-page-md short-note-detail">
    <div class="short-note-detail__header">
      <RouterLink to="/posts/notes" class="short-note-detail__back-link">
        <ChevronLeft :size="16" />
        <span>返回短话</span>
      </RouterLink>
    </div>

    <div v-if="loading" class="a-skeleton short-note-detail__skeleton" />
    <p v-else-if="error" class="short-note-detail__error" role="alert">{{ error }}</p>
    <template v-else-if="note">
      <ShortNoteCard :note="note" @delete="remove" />
      <div class="short-note-detail__comments">
        <CommentSection id="comments" :target="{ kind: 'short_note', resourceId: note.id }" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ChevronLeft } from 'lucide-vue-next'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { apiRequestEnvelope } from '@/api/client'
import CommentSection from '@/components/comment/CommentSection.vue'
import ShortNoteCard from '@/components/shortnote/ShortNoteCard.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type { ShortNote } from '@/types'

const route = useRoute()
const router = useRouter()
const api = useApi()
const authStore = useAuthStore()
const id = computed(() => String(route.params.id ?? ''))
const note = ref<ShortNote | null>(null)
const loading = ref(true)
const error = ref('')
async function load() {
  try { note.value = (await apiRequestEnvelope<ShortNote>(api.blog.shortNote(id.value))).data }
  catch { error.value = '短话不存在或暂时无法加载' }
  finally { loading.value = false }
}
async function remove(noteToRemove: ShortNote) {
  if (!window.confirm('确定删除这条短话吗？')) return
  try {
    await apiRequestEnvelope(api.blog.shortNote(noteToRemove.id), { method: 'DELETE', headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {} })
    await router.replace('/posts/notes')
  } catch { error.value = '删除失败，请重试' }
}
onMounted(load)
</script>

<style scoped>
.short-note-detail {
  padding-top: 1.5rem;
  padding-bottom: 3rem;
}

.short-note-detail__header {
  margin-bottom: 1.25rem;
}

.short-note-detail__back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.8rem;
  color: var(--a-color-muted);
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  transition: all 0.15s ease;
}

.short-note-detail__back-link:hover {
  color: var(--a-color-fg);
  border-color: var(--a-color-border);
  background: var(--a-color-surface-muted);
}

.short-note-detail__skeleton {
  height: 14rem;
  border-radius: var(--a-radius-card);
}

.short-note-detail__comments {
  margin-top: 1.5rem;
}

.short-note-detail__error {
  margin-top: 1.5rem;
  color: var(--a-color-danger);
}
</style>

