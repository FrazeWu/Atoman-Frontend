<template>
  <div class="a-page-md short-note-detail">
    <div class="short-note-detail__header">
      <RouterLink to="/posts/notes" class="short-note-detail__back-link">
        <ChevronLeft :size="16" />
        <span>返回短笺</span>
      </RouterLink>
    </div>

    <div v-if="loading" class="a-skeleton short-note-detail__skeleton" />
    <div v-else-if="error" class="short-note-detail__error" role="alert">
      <p>{{ error }}</p>
      <PButton variant="secondary" size="sm" @click="load">重试</PButton>
    </div>
    <template v-else-if="note">
      <ShortNoteCard :note="note" @delete="remove" />
    </template>
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
import { computed, onMounted, ref, watch } from 'vue'
import { IconChevronLeft as ChevronLeft } from '@tabler/icons-vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { apiRequestEnvelope } from '@/api/client'
import ShortNoteCard from '@/components/shortnote/ShortNoteCard.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PButton from '@/components/ui/PButton.vue'
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
const deletePending = ref<ShortNote | null>(null)
const deleting = ref(false)
let loadSequence = 0
async function load() {
  const sequence = ++loadSequence
  loading.value = true
  error.value = ''
  note.value = null
  try {
    const loaded = (await apiRequestEnvelope<ShortNote>(api.blog.shortNote(id.value))).data
    if (sequence === loadSequence) note.value = loaded
  }
  catch {
    if (sequence === loadSequence) error.value = '短笺不存在或暂时无法加载'
  }
  finally {
    if (sequence === loadSequence) loading.value = false
  }
}
function remove(noteToRemove: ShortNote) {
  if (deleting.value) return
  deletePending.value = noteToRemove
}

async function confirmRemove() {
  const noteToRemove = deletePending.value
  if (!noteToRemove || deleting.value) return
  deleting.value = true
  try {
    await apiRequestEnvelope(api.blog.shortNote(noteToRemove.id), { method: 'DELETE', headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {} })
    await router.replace('/posts/notes')
  } catch { error.value = '删除失败，请重试' }
  finally {
    deleting.value = false
    deletePending.value = null
  }
}
watch(id, () => { void load() })
onMounted(() => void load())
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


.short-note-detail__error {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.5rem;
  color: var(--a-color-danger);
}

.short-note-detail__error p {
  margin: 0;
}
</style>
