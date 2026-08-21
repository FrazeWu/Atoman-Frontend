<template>
  <div v-if="stats" class="site-visit-stats" aria-label="站点访问统计">
    <span>总访问量 {{ formatCount(stats.total) }}</span>
    <span>今日 {{ formatCount(stats.today) }}</span>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { apiRequestResult } from '@/api/client'

type SiteVisitStats = {
  total: number
  today: number
}

const stats = ref<SiteVisitStats | null>(null)

function formatCount(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value)
}

onMounted(async () => {
  const response = await apiRequestResult<{ data?: SiteVisitStats }>('/api/v1/site/visits')
  if (response.ok && response.data?.data) stats.value = response.data.data
})
</script>

<style scoped>
.site-visit-stats {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--a-space-4);
  color: var(--a-color-muted);
  font-size: var(--a-text-xs);
  font-variant-numeric: tabular-nums;
}
</style>
