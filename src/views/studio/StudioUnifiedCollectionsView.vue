<template>
  <section class="studio-unified-collections">
    <header class="studio-unified-collections__header">
      <div>
        <h1>合集管理</h1>
        <p>整理当前频道的内容。</p>
      </div>
    </header>

    <p v-if="loading" class="studio-unified-collections__message">加载中...</p>
    <p v-else-if="error" class="studio-unified-collections__message studio-unified-collections__message--error" role="alert">
      {{ error }}
    </p>
    <StudioCollectionManager v-else />
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import StudioCollectionManager from '@/components/studio/StudioCollectionManager.vue'
import { useStudioStore } from '@/stores/studio'

const studio = useStudioStore()
const loading = ref(true)
const error = ref('')

let latestRequest = 0

async function loadCollections() {
  const request = ++latestRequest
  loading.value = true
  error.value = ''
  try {
    await studio.loadState()
    if (studio.currentChannel) await studio.loadUnifiedCollections()
  } catch (cause) {
    if (request === latestRequest) error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    if (request === latestRequest) loading.value = false
  }
}

onMounted(loadCollections)
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
