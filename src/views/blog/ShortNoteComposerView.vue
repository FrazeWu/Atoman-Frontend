<template>
  <div class="a-page-md short-note-composer-view">
    <div class="short-note-composer-view__header">
      <RouterLink to="/posts/notes" class="short-note-composer-view__back-link">
        <ChevronLeft :size="16" />
        <span>返回短笺</span>
      </RouterLink>
      <PPageHeader :title="isEdit ? '编辑短笺' : '写短笺'" class="short-note-composer-view__title" />
    </div>

    <div v-if="loading" class="a-skeleton short-note-composer-view__skeleton" />
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
import { computed, onMounted, ref, watch } from 'vue'
import { IconChevronLeft as ChevronLeft } from '@tabler/icons-vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
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
let loadSequence = 0

async function load() {
  const sequence = ++loadSequence
  loading.value = true
  error.value = ''
  note.value = null
  if (!isEdit.value) {
    loading.value = false
    return
  }
  try {
    const loaded = (await apiRequestEnvelope<ShortNote>(api.blog.shortNote(id.value))).data
    if (sequence !== loadSequence) return
    note.value = loaded
    if (note.value.user_id !== authStore.user?.uuid) {
      error.value = '你无权编辑这条短笺'
    }
  } catch {
    if (sequence === loadSequence) error.value = '短笺不存在或暂时无法加载'
  } finally {
    if (sequence === loadSequence) loading.value = false
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

watch(id, () => { void load() })
onMounted(() => void load())
</script>

<style scoped>
.short-note-composer-view {
  padding-top: 1.5rem;
  padding-bottom: 3rem;
}

.short-note-composer-view__header {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.short-note-composer-view__back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  width: fit-content;
  padding: 0.4rem 0.8rem;
  color: var(--a-color-muted);
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease, opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}

.short-note-composer-view__back-link:hover {
  color: var(--a-color-fg);
  border-color: var(--a-color-border);
  background: var(--a-color-surface-muted);
}

.short-note-composer-view__title {
  margin-top: 0.25rem;
}

.short-note-composer-view__skeleton {
  height: 16rem;
  border-radius: var(--a-radius-card);
}

.short-note-composer-view__error {
  margin-top: 1rem;
  color: var(--a-color-danger);
  font-size: 0.875rem;
}
</style>

