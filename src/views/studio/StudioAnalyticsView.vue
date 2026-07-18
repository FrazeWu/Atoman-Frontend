<template>
  <section class="studio-subpage">
    <h2>数据</h2>
    <p v-if="loading">加载中...</p>
    <p v-else-if="error" role="alert">{{ error }}</p>
    <p v-else-if="!studio.analytics[module]">暂无数据</p>
    <p v-else>最近 {{ studio.analytics[module]?.range }} 天</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useStudioStore } from '@/stores/studio'
import type { StudioModule } from '@/types'

const route = useRoute()
const studio = useStudioStore()
const module = computed(() => route.params.module as StudioModule)
const loading = ref(true)
const error = ref('')
onMounted(async () => {
  try {
    await studio.loadState()
    if (studio.currentChannel) await studio.loadAnalytics(module.value, 28)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>.studio-subpage{display:grid;gap:1rem}.studio-subpage h2,.studio-subpage p{margin:0}.studio-subpage h2{font-size:1.125rem}</style>
