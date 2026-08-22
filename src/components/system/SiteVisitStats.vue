<template>
  <aside v-if="stats" class="site-visit-stats" aria-label="站点统计" aria-live="polite">
    <div class="site-visit-stats__heading">站点统计</div>
    <div class="site-visit-stats__metrics">
      <div class="site-visit-stats__metric">
        <span>用户数</span>
        <strong>{{ formatCount(stats.users) }}</strong>
      </div>
      <div class="site-visit-stats__metric">
        <span>总访问量</span>
        <strong>{{ formatCount(stats.total) }}</strong>
      </div>
      <div class="site-visit-stats__metric">
        <span>今日访问</span>
        <strong>{{ formatCount(stats.today) }}</strong>
      </div>
    </div>
  </aside>
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
  const response = await apiRequestResult(`${useApiUrl()}/site/visits`)
  if (response.ok && response.data?.data) stats.value = response.data.data
})
</script>

<style scoped>
.site-visit-stats {
  position: static;
  flex: 0 0 auto;
  width: 220px;
  padding: 12px 14px;
  border: 1px solid var(--a-color-border, #d9d9d9);
  border-radius: 8px;
  background: var(--a-color-bg, #fff);
  box-shadow: 0 8px 24px rgb(0 0 0 / 12%);
  color: var(--a-color-muted);
  font-size: var(--a-text-xs);
}

.site-visit-stats__heading {
  margin-bottom: 9px;
  color: var(--a-color-fg);
  font-size: var(--a-text-sm);
  font-weight: var(--a-font-weight-strong);
}

.site-visit-stats__metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.site-visit-stats__metric {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.site-visit-stats__metric span {
  white-space: nowrap;
}

.site-visit-stats__metric strong {
  overflow: hidden;
  color: var(--a-color-fg);
  font-size: var(--a-text-base);
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
}

@media (max-width: 767px) {
  .site-visit-stats {
    width: 200px;
  }
}
</style>
