<template>
  <div v-if="stats" class="site-visit-stats" aria-label="站点统计">
    <span class="site-visit-stats__item">
      <span class="site-visit-stats__label">用户</span>
      <strong class="site-visit-stats__value">{{ formatCount(stats.users) }}</strong>
    </span>
    <span class="site-visit-stats__divider">·</span>
    <span class="site-visit-stats__item">
      <span class="site-visit-stats__label">总访问</span>
      <strong class="site-visit-stats__value">{{ formatCount(stats.total) }}</strong>
    </span>
    <span class="site-visit-stats__divider">·</span>
    <span class="site-visit-stats__item">
      <span class="site-visit-stats__label">今日</span>
      <strong class="site-visit-stats__value">{{ formatCount(stats.today) }}</strong>
    </span>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { apiRequestResult } from '@/api/client'
import { useApiUrl } from '@/composables/useApi'

type SiteVisitStats = {
  users: number
  total: number
  today: number
}

const stats = ref<SiteVisitStats | null>(null)

function formatCount(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value)
}

onMounted(async () => {
  try {
    const response = await apiRequestResult(`${useApiUrl()}/site/visits`)
    if (response.ok && response.data?.data) stats.value = response.data.data
  } catch {
    stats.value = null
  }
})
</script>

<style scoped>
.site-visit-stats {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
  color: var(--a-color-muted);
  font-size: var(--a-text-xs, 0.75rem);
  line-height: 1.4;
  margin-top: 0.25rem;
}

.site-visit-stats__item {
  display: inline-flex;
  align-items: baseline;
  gap: 0.2rem;
}

.site-visit-stats__label {
  color: var(--a-color-muted-soft, #a1a1aa);
}

.site-visit-stats__value {
  color: var(--a-color-fg, #18181b);
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}

.site-visit-stats__divider {
  display: none;
}
</style>
