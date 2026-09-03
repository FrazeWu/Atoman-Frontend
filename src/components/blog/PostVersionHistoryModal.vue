<template>
  <PModal title="版本历史" size="md" :above-player="abovePlayer" @close="$emit('close')">
    <p v-if="loading" class="version-history__state">正在加载</p>
    <div v-else-if="error" class="version-history__error" role="alert">
      <p class="version-history__state">{{ error }}</p>
      <PButton type="button" size="sm" variant="secondary" @click="loadVersions">重试</PButton>
    </div>
    <PEmpty v-else-if="!versions.length" title="暂无版本" />
    <ol v-else class="version-history__list">
      <li v-for="version in versions" :key="version.version" class="version-history__item">
        <div class="version-history__content">
          <strong>版本 {{ version.version }} · {{ version.title }}</strong>
          <span>{{ formatDate(version.created_at) }}</span>
          <p v-if="version.summary">{{ version.summary }}</p>
        </div>
        <PButton
          type="button"
          size="sm"
          variant="secondary"
          :loading="restoringVersion === version.version"
          :disabled="restoringVersion !== null"
          @click="restore(version.version)"
        >
          恢复
        </PButton>
      </li>
    </ol>
  </PModal>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { apiRequestResult } from '@/api/client'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type { BlogPostVersion } from '@/types'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PModal from '@/components/ui/PModal.vue'

const props = withDefaults(defineProps<{ postId: string; abovePlayer?: boolean }>(), {
  abovePlayer: false,
})
const emit = defineEmits<{ close: []; restored: [] }>()
const api = useApi()
const authStore = useAuthStore()
const versions = ref<BlogPostVersion[]>([])
const loading = ref(true)
const error = ref('')
const restoringVersion = ref<number | null>(null)

const headers = (): Record<string, string> => {
  const value: Record<string, string> = {}
  if (authStore.token) value.Authorization = `Bearer ${authStore.token}`
  return value
}

const loadVersions = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await apiRequestResult(api.blog.postVersions(props.postId), { headers: headers() })
    if (!response.ok) throw new Error('版本加载失败')
    const payload = response.data as { data?: BlogPostVersion[] }
    versions.value = payload.data || []
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '版本加载失败'
  } finally {
    loading.value = false
  }
}

const restore = async (version: number) => {
  restoringVersion.value = version
  error.value = ''
  try {
    const response = await apiRequestResult(api.blog.postVersionRestore(props.postId, version), {
      method: 'POST',
      headers: headers(),
    })
    if (!response.ok) throw new Error('版本恢复失败')
    emit('restored')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '版本恢复失败'
  } finally {
    restoringVersion.value = null
  }
}

const formatDate = (value: string) => new Date(value).toLocaleString('zh-CN', {
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
})

onMounted(() => { void loadVersions() })
</script>

<style scoped>
.version-history__state { color: var(--a-color-muted); margin: 0; }
.version-history__error { display: grid; justify-items: start; gap: 0.75rem; }
.version-history__list { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
.version-history__item { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem 0; border-bottom: 1px solid var(--a-color-border-soft); }
.version-history__item:last-child { border-bottom: 0; }
.version-history__content { min-width: 0; display: grid; gap: 0.25rem; }
.version-history__content strong { overflow-wrap: anywhere; }
.version-history__content span, .version-history__content p { margin: 0; color: var(--a-color-muted); font-size: 0.8rem; }
</style>
