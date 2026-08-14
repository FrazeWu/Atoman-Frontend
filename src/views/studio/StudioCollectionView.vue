<template>
  <section class="studio-collection-view">
    <p v-if="loading" class="studio-collection-view__message">加载中...</p>
    <p v-else-if="error" class="studio-collection-view__message studio-collection-view__message--error" role="alert">{{ error }}</p>
    <StudioCollectionManager v-else :module="module" />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import StudioCollectionManager from '@/components/studio/StudioCollectionManager.vue'
import { useStudioStore } from '@/stores/studio'
import type { StudioModule } from '@/types'

const route = useRoute()
const studio = useStudioStore()
const module = computed(() => route.params.module as StudioModule)
const loading = ref(true)
const error = ref('')
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
.studio-collection-view { min-width: 0; max-width: 54rem; }
.studio-collection-view__message { margin: 0; padding: 2rem 0; color: var(--a-color-muted); }
.studio-collection-view__message--error { color: var(--a-color-danger); }
</style>
