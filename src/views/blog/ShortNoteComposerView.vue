<template>
  <div class="a-page-md short-note-composer-view">
    <PPageHeader :title="isEdit ? '编辑短话' : '写短话'" />
    <div v-if="loading" class="a-skeleton" style="height:16rem" />
    <ShortNoteComposer
      v-else
      :initial-content="note?.content"
      :initial-media-urls="note?.media.map((item) => item.url)"
      :submitting="submitting"
      :submit-label="isEdit ? '保存' : '发布'"
      @submit="save"
    />
    <p v-if="error" class="short-note-composer-view__error" role="alert">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiRequestEnvelope } from '@/api/client'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import ShortNoteComposer from '@/components/shortnote/ShortNoteComposer.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type { ShortNote } from '@/types'

const route = useRoute()
const router = useRouter()
const api = useApi()
const authStore = useAuthStore()
const id = computed(() => String(route.params.id ?? ''))
const isEdit = computed(() => Boolean(id.value))
const note = ref<ShortNote | null>(null)
const loading = ref(isEdit.value)
const submitting = ref(false)
const error = ref('')
const headers = () => ({ 'Content-Type': 'application/json', ...(authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}) })

async function load() {
  if (!isEdit.value) return
  try {
    note.value = (await apiRequestEnvelope<ShortNote>(api.blog.shortNote(id.value))).data
    if (note.value.user_id !== authStore.user?.uuid) {
      error.value = '你无权编辑这条短话'
    }
  } catch {
    error.value = '短话不存在或暂时无法加载'
  } finally {
    loading.value = false
  }
}

async function save(payload: { content: string; media_urls: string[] }) {
  if (isEdit.value && note.value?.user_id !== authStore.user?.uuid) return
  submitting.value = true
  error.value = ''
  try {
    const response = await apiRequestEnvelope<ShortNote>(isEdit.value ? api.blog.shortNote(id.value) : api.blog.shortNotes, {
      method: isEdit.value ? 'PUT' : 'POST', headers: headers(), body: JSON.stringify(payload),
    })
    await router.replace(`/posts/notes/${response.data.id}`)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '发布失败，请稍后重试'
  } finally {
    submitting.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.short-note-composer-view { padding-top:2rem; }
.short-note-composer-view__error { margin-top:1rem; color:var(--a-color-danger); }
</style>
