<template>
  <div class="a-page-xl feed-subpage">
    <PPageHeader title="阅读统计" sub="按时间和订阅源查看你的 RSS 阅读趋势">
      <template #action>
        <div style="display:flex;gap:.75rem;flex-wrap:wrap;justify-content:flex-end">
          <RouterLink to="/feed" style="text-decoration:none">
            <PPress variant="secondary" label="返回订阅" />
          </RouterLink>
        </div>
      </template>
    </PPageHeader>

    <div v-if="!authStore.isAuthenticated" class="feed-login-state">
      <p class="a-title-xl a-muted" style="margin-bottom:1rem">阅读统计</p>
      <p class="a-muted" style="max-width:28rem;margin-bottom:1.5rem">登录后即可查看你的 RSS 阅读趋势和来源分布。</p>
      <RouterLink to="/login" style="text-decoration:none">
        <PPress label="登录账户" />
      </RouterLink>
    </div>

    <template v-else>
      <div class="stats-controls">
        <div style="display:flex;gap:.5rem;flex-wrap:wrap">
          <PTab
            v-for="option in periodOptions"
            :key="option.value"
            :label="option.label"
            :active="period === option.value"
            @click="selectPeriod(option.value)"
          />
        </div>
        <PPress
          @click="fetchStats"
          :loading="loading"
          loading-text="刷新中..."
          label="刷新"
          variant="secondary"
        />
      </div>

      <div v-if="stats" class="stats-overview">
        <div class="stats-paper-card">
          <div class="a-label a-muted">阅读总量</div>
          <div class="stats-big-value">{{ stats.total_read }}</div>
        </div>
        <div class="stats-paper-card">
          <div class="a-label a-muted">活跃订阅源</div>
          <div class="stats-big-value">{{ stats.source_breakdown.length }}</div>
        </div>
        <div class="stats-paper-card">
          <div class="a-label a-muted">最常阅读</div>
          <div class="stats-small-title">{{ topSourceLabel }}</div>
          <div class="stats-small-meta">{{ topSourceReads }}</div>
        </div>
      </div>

      <div v-if="loading" class="feed-loading">
        <div v-for="i in 2" :key="i" class="a-skeleton" style="height:24rem"></div>
      </div>

      <PEmpty v-else-if="!stats || !stats.total_read" text="还没有阅读记录" sub="先去刷一会儿 RSS 再来看统计" />

      <div v-else class="stats-charts-grid">
        <section class="stats-chart-section">
          <div class="chart-header">
            <div>
              <div class="a-label a-muted">趋势</div>
              <h2 class="chart-title">{{ periodTitle }}</h2>
            </div>
            <div class="chart-unit">单位：已读文章数</div>
          </div>
          <div class="chart-wrap">
            <canvas ref="trendCanvas"></canvas>
          </div>
        </section>

        <section class="stats-chart-section">
          <div class="chart-header">
            <div>
              <div class="a-label a-muted">来源分布</div>
              <h2 class="chart-title">订阅源 Top 10</h2>
            </div>
          </div>
          <div class="chart-wrap">
            <canvas ref="sourceCanvas"></canvas>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import Chart from 'chart.js/auto'
import { RouterLink } from 'vue-router'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PPress from '@/components/ui/PPress.vue'
import PTab from '@/components/ui/PTab.vue'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'

type FeedStatsPeriod = 'day' | 'week' | 'month'

interface FeedStatsPoint {
  label: string
  count: number
}

interface FeedSourceStat {
  feed_source_id: string
  title: string
  count: number
}

interface FeedStatsData {
  period: FeedStatsPeriod
  total_read: number
  points: FeedStatsPoint[]
  source_breakdown: FeedSourceStat[]
}

const api = useApi()

const authStore = useAuthStore()

const periodOptions: Array<{ value: FeedStatsPeriod; label: string }> = [
  { value: 'day', label: '日' },
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
]

const period = ref<FeedStatsPeriod>('day')
const loading = ref(false)
const stats = ref<FeedStatsData | null>(null)
const trendCanvas = ref<HTMLCanvasElement | null>(null)
const sourceCanvas = ref<HTMLCanvasElement | null>(null)

let trendChart: Chart | null = null
let sourceChart: Chart | null = null

const authHeaders = () => ({ Authorization: `Bearer ${authStore.token}` })

const periodTitle = computed(() => {
  if (period.value === 'week') return '最近 8 周阅读趋势'
  if (period.value === 'month') return '最近 6 个月阅读趋势'
  return '最近 7 天阅读趋势'
})

const topSource = computed(() => stats.value?.source_breakdown[0] ?? null)
const topSourceLabel = computed(() => topSource.value?.title || '暂无数据')
const topSourceReads = computed(() => topSource.value ? `${topSource.value.count} 篇已读` : '没有可展示的来源')

const selectPeriod = async (value: FeedStatsPeriod) => {
  if (period.value === value) return
  period.value = value
  await fetchStats()
}

const fetchStats = async () => {
  if (!authStore.isAuthenticated) return
  loading.value = true
  try {
    const params = new URLSearchParams({ period: period.value })
    const res = await fetch(`${api.url}/feed/stats?${params}`, { headers: authHeaders() })
    if (res.ok) {
      const data = await res.json()
      stats.value = data.data || null
      await nextTick()
      renderCharts()
    }
  } catch (error) {
    console.error('Failed to fetch feed stats', error)
  } finally {
    loading.value = false
  }
}

const renderCharts = () => {
  destroyCharts()
  if (!stats.value || !trendCanvas.value || !sourceCanvas.value) return

  trendChart = new Chart(trendCanvas.value, {
    type: 'bar',
    data: {
      labels: stats.value.points.map((point) => point.label),
      datasets: [
        {
          label: '已读文章',
          data: stats.value.points.map((point) => point.count),
          backgroundColor: '#111111',
          borderColor: '#111111',
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          ticks: { color: '#6b7280', font: { weight: 700 } },
          grid: { display: false },
          border: { color: 'rgba(0,0,0,0.1)' },
        },
        y: {
          beginAtZero: true,
          ticks: { color: '#6b7280', precision: 0, font: { weight: 700 } },
          grid: { color: '#e5e7eb' },
          border: { color: 'rgba(0,0,0,0.1)' },
        },
      },
    },
  })

  sourceChart = new Chart(sourceCanvas.value, {
    type: 'bar',
    data: {
      labels: stats.value.source_breakdown.map((item) => item.title),
      datasets: [
        {
          label: '阅读量',
          data: stats.value.source_breakdown.map((item) => item.count),
          backgroundColor: ['#111111', '#3f3f46', '#71717a', '#a1a1aa', '#d4d4d8', '#18181b', '#52525b', '#a8a29e', '#94a3b8', '#d6d3d1'],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { color: '#6b7280', precision: 0, font: { weight: 700 } },
          grid: { color: '#f3f4f6' },
          border: { color: 'rgba(0,0,0,0.1)' },
        },
        y: {
          ticks: { color: '#6b7280', font: { weight: 700 } },
          grid: { display: false },
          border: { color: 'rgba(0,0,0,0.1)' },
        },
      },
    },
  })
}

const destroyCharts = () => {
  trendChart?.destroy()
  sourceChart?.destroy()
  trendChart = null
  sourceChart = null
}

onMounted(async () => {
  if (authStore.isAuthenticated) {
    await fetchStats()
  }
})

onBeforeUnmount(() => {
  destroyCharts()
})
</script>

<style scoped>
.feed-subpage {
  padding-bottom: 12rem;
}

.feed-login-state {
  min-height: 50vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.stats-controls {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 2rem;
}

.stats-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
}

.stats-paper-card {
  padding: 1.5rem;
  background: var(--a-color-paper-soft);
  border-bottom: 1px solid var(--a-color-line-soft);
  transition: all 0.2s;
}

.stats-paper-card:hover {
  background: var(--a-color-paper-wash);
  border-bottom-color: var(--a-color-ink);
}

.stats-big-value {
  font-size: 2.5rem;
  font-weight: 950;
  letter-spacing: -0.05em;
  line-height: 1;
  margin-top: 0.5rem;
}

.stats-small-title {
  font-size: 1.1rem;
  font-weight: 900;
  margin-top: 0.5rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stats-small-meta {
  font-size: 0.8rem;
  color: var(--a-color-muted);
  margin-top: 0.25rem;
}

.stats-charts-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(20rem, 1fr);
  gap: 2.5rem;
  align-items: start;
}

.stats-chart-section {
  padding: 1.5rem;
  background: white;
  border: 1px solid var(--a-color-line-soft);
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.chart-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 950;
  letter-spacing: -0.02em;
}

.chart-unit {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--a-color-muted-soft);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.chart-wrap {
  position: relative;
  height: 22rem;
}

.feed-loading {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

@media (max-width: 1024px) {
  .stats-charts-grid {
    grid-template-columns: 1fr;
  }
}
</style>
