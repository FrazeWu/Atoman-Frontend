<template>
  <div class="a-page-md short-note-detail">
    <RouterLink to="/posts/notes" class="a-link">返回短话</RouterLink>
    <div v-if="loading" class="a-skeleton" style="height:15rem;margin-top:1rem" />
    <p v-else-if="error" class="short-note-detail__error" role="alert">{{ error }}</p>
    <template v-else-if="note">
      <ShortNoteCard :note="note" @delete="remove" />
      <CommentSection :target="{ kind: 'short_note', resourceId: note.id }" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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
.short-note-detail { padding-top:2rem; }
.short-note-detail__error { margin-top:2rem; color:var(--a-color-danger); }
</style>
