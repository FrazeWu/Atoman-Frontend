<template>
  <section class="studio-unified-collections">
    <header class="studio-unified-collections__header">
      <div>
        <h1>合集管理</h1>
        <p>按内容类型管理当前频道的合集。</p>
      </div>
      <PSegmentedControl v-model="module" :options="moduleOptions" />
    </header>

    <p v-if="loading" class="studio-unified-collections__message">加载中...</p>
    <p v-else-if="error" class="studio-unified-collections__message studio-unified-collections__message--error" role="alert">
      {{ error }}
    </p>
    <StudioCollectionManager v-else :module="module" />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import StudioCollectionManager from '@/components/studio/StudioCollectionManager.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import { studioModules } from '@/config/studioModules'
import { useStudioStore } from '@/stores/studio'
import type { StudioModule } from '@/types'

const route = useRoute()
const router = useRouter()
const studio = useStudioStore()
const loading = ref(true)
const error = ref('')
const modules: StudioModule[] = ['blog', 'video', 'podcast']
const moduleOptions = modules.map((value) => ({ label: studioModules[value].label, value }))

const module = computed<StudioModule>({
  get: () => {
    const type = route.query.type
    return typeof type === 'string' && modules.includes(type as StudioModule)
      ? type as StudioModule
      : 'blog'
  },
  set: (value) => {
    void router.replace({ query: { ...route.query, type: value } })
  },
})

let latestRequest = 0

async function loadCollections() {
  const request = ++latestRequest
  loading.value = true
  error.value = ''
  try {
    await studio.loadState()
    if (studio.currentChannel) await studio.loadCollections(module.value)
  } catch (cause) {
    if (request === latestRequest) error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    if (request === latestRequest) loading.value = false
  }
}

onMounted(loadCollections)
watch(module, loadCollections)
</script>

<style scoped>
.studio-unified-collections { display: grid; gap: 1rem; max-width: 54rem; }
.studio-unified-collections__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--a-color-border-soft); }
.studio-unified-collections__header h1, .studio-unified-collections__header p { margin: 0; }
.studio-unified-collections__header h1 { font-size: 1.5rem; }
.studio-unified-collections__header p { margin-top: 0.25rem; color: var(--a-color-muted); font-size: 0.875rem; }
.studio-unified-collections__message { margin: 0; padding: 2rem 0; color: var(--a-color-muted); }
.studio-unified-collections__message--error { color: var(--a-color-danger); }
@media (max-width: 640px) {
  .studio-unified-collections__header { align-items: stretch; flex-direction: column; }
}
</style>
