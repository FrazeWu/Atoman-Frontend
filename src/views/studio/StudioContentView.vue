<template>
  <section class="studio-subpage">
    <header><h2>内容</h2></header>
    <p v-if="loading">加载中...</p>
    <p v-else-if="error" role="alert">{{ error }}</p>
    <p v-else-if="!studio.contents[module].length">暂无内容</p>
    <ul v-else>
      <li v-for="item in studio.contents[module]" :key="item.id">{{ item.title }}</li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useStudioStore } from '@/stores/studio'
import type { StudioContentFilters, StudioModule } from '@/types'

const route = useRoute()
const studio = useStudioStore()
const module = computed(() => route.params.module as StudioModule)
const loading = ref(true)
const error = ref('')
const filters: StudioContentFilters = { q: '', status: '', visibility: '', collection_id: '', page: 1 }

onMounted(async () => {
  try {
    await studio.loadState()
    if (studio.currentChannel) await Promise.all([studio.loadCollections(module.value), studio.loadContents(module.value, filters)])
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.studio-subpage { display: grid; gap: 1rem; }
.studio-subpage h2, .studio-subpage p, .studio-subpage ul { margin: 0; }
.studio-subpage h2 { font-size: 1.125rem; }
</style>
