<template>
  <section class="studio-unified-collections">
    <PPageHeader title="合集" sub="按专题整理当前频道的内容。" mb="0" />

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
import PPageHeader from '@/components/ui/PPageHeader.vue'
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
.studio-unified-collections { display: grid; gap: 1.5rem; max-width: 60rem; }
.studio-unified-collections__message { margin: 0; padding: 2rem 0; color: var(--a-color-muted); }
.studio-unified-collections__message--error { color: var(--a-color-danger); }
</style>
