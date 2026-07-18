<template>
  <section class="studio-page">
    <header><h1>Dashboard</h1></header>
    <p v-if="loading">加载中...</p>
    <p v-else-if="error" role="alert">{{ error }}</p>
    <p v-else-if="!studio.dashboard?.sections.length">暂无内容</p>
    <section v-for="section in studio.dashboard?.sections" v-else :key="section.module" class="studio-summary">
      <h2>{{ moduleLabel(section.module) }}</h2>
      <p v-if="section.error" role="alert">{{ section.error }}</p>
      <p v-else>{{ section.recent.length }} 条最近内容</p>
    </section>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useStudioStore } from '@/stores/studio'
import type { StudioModule } from '@/types'

const studio = useStudioStore()
const loading = ref(true)
const error = ref('')
const labels: Record<StudioModule, string> = { blog: '博客', podcast: '播客', video: '视频' }
const moduleLabel = (module: StudioModule) => labels[module]

onMounted(async () => {
  try {
    await studio.loadState()
    if (studio.currentChannel) await studio.loadDashboard()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.studio-page { display: grid; gap: 1.5rem; }
.studio-page h1, .studio-page h2, .studio-page p { margin: 0; }
.studio-page h1 { font-size: 1.5rem; }
.studio-page h2 { font-size: 1rem; }
.studio-summary { display: grid; gap: 0.5rem; padding-top: 1rem; border-top: 1px solid var(--a-color-border-soft); }
</style>
