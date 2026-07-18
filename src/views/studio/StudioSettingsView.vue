<template>
  <section class="studio-subpage">
    <h2>设置</h2>
    <p v-if="loading">加载中...</p>
    <p v-else-if="error" role="alert">{{ error }}</p>
    <p v-else-if="!studio.settings[module]">暂无设置</p>
    <p v-else>默认发布状态：{{ studio.settings[module]?.default_publish_status }}</p>
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
    if (studio.currentChannel) await studio.loadSettings(module.value)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>.studio-subpage{display:grid;gap:1rem}.studio-subpage h2,.studio-subpage p{margin:0}.studio-subpage h2{font-size:1.125rem}</style>
