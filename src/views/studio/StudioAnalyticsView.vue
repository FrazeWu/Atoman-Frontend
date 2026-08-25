<template>
  <section class="studio-analytics">
    <header class="studio-analytics__header">
      <div>
        <h2>数据概览</h2>
        <p>观察内容触达、消费与回访表现。</p>
      </div>
      <PSegmentedControl v-model="range" :options="rangeOptions" :disabled="loading" @change="changeRange" />
    </header>
    <form class="studio-analytics__filters" aria-label="数据筛选" @submit.prevent="changeFilters">
      <PSelect v-model="filters.collection_id" label="合集" :options="collectionOptions" @update:model-value="changeFilters" />
      <PSelect v-model="filters.content_id" label="内容" :options="contentOptions" @update:model-value="changeFilters" />
      <PButton type="submit" variant="secondary" aria-label="应用筛选" title="应用筛选">
        <Search :size="17" aria-hidden="true" />
      </PButton>
    </form>

    <p v-if="loading" class="studio-analytics__message">加载中...</p>
    <p v-else-if="error" class="studio-analytics__message" role="alert">{{ error }}</p>
    <template v-else-if="analytics">
      <section class="studio-analytics__funnel" aria-labelledby="analytics-funnel-title">
        <header>
          <h3 id="analytics-funnel-title">消费漏斗</h3>
          <span>各阶段转化</span>
        </header>
        <ol>
          <li v-for="(metric, index) in funnelMetrics" :key="metric">
            <span>{{ metricLabel(metric) }}</span>
            <strong>{{ formatNumber(analytics.totals[metric] || 0) }}</strong>
            <small v-if="index > 0">{{ funnelRate(metric, funnelMetrics[index - 1]) }}%</small>
          </li>
        </ol>
      </section>

      <dl class="studio-analytics__totals">
        <div v-for="metric in visibleMetrics" :key="metric">
          <dt>{{ metricLabel(metric) }}</dt>
          <dd>{{ formatNumber(analytics.totals[metric] || 0) }}</dd>
          <small>{{ comparisonLabel(metric) }}</small>
        </div>
      </dl>

      <div class="studio-analytics__grid">
        <section class="studio-analytics__section">
          <header>
            <h3>趋势</h3>
            <PSelect
              v-model="selectedMetric"
              data-testid="analytics-metric"
              label="指标"
              :options="metricOptions"
            />
          </header>
          <div v-if="analytics.trend.length" class="studio-analytics__chart">
            <canvas ref="trendCanvas" aria-label="内容数据趋势图" role="img" />
          </div>
          <PEmpty v-else kicker="" title="暂无趋势数据" />
        </section>

        <section class="studio-analytics__section">
          <header><h3>内容排行</h3></header>
          <ol v-if="analytics.top.length" class="studio-analytics__ranking">
            <li v-for="item in analytics.top" :key="item.id">
              <RouterLink :to="contentEditPath(item.id)">
                <strong>{{ item.title }}</strong>
                <span>{{ rankingSummary(item.metrics) }}</span>
              </RouterLink>
            </li>
          </ol>
          <PEmpty v-else kicker="" title="暂无排行数据" />
        </section>

        <section class="studio-analytics__section">
          <header><h3>来源</h3></header>
          <ol v-if="analytics.sources?.length" class="studio-analytics__sources">
            <li v-for="source in analytics.sources" :key="source.source">
              <span>{{ sourceLabel(source.source) }}</span>
              <strong>{{ formatNumber(source.count) }}</strong>
            </li>
          </ol>
          <PEmpty v-else kicker="" title="暂无来源数据" />
        </section>

        <section class="studio-analytics__section">
          <header><h3>回访</h3></header>
          <dl v-if="analytics.retention" class="studio-analytics__retention">
            <div><dt>消费人数</dt><dd>{{ formatNumber(analytics.retention.consumers) }}</dd></div>
            <div><dt>回访人数</dt><dd>{{ formatNumber(analytics.retention.returning_consumers) }}</dd></div>
            <div><dt>回访率</dt><dd>{{ analytics.retention.rate }}%</dd></div>
          </dl>
          <PEmpty v-else kicker="" title="暂无回访数据" />
        </section>
      </div>
    </template>
    <PEmpty v-else kicker="" title="暂无数据" />
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import Chart from 'chart.js/auto'
import { Search } from 'lucide-vue-next'
import { useRoute, RouterLink } from 'vue-router'

import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import { useStudioStore } from '@/stores/studio'
import type { StudioAnalyticsFilters, StudioModule } from '@/types'

const route = useRoute()
const studio = useStudioStore()
const module = computed(() => route.params.module as StudioModule)
const range = ref<7 | 28 | 90>(28)
const filters = reactive<StudioAnalyticsFilters>({ collection_id: '', content_id: '' })
const loading = ref(true)
const error = ref('')
const trendCanvas = ref<HTMLCanvasElement | null>(null)
const analytics = computed(() => studio.analytics[module.value])
const collectionOptions = computed(() => [
  { label: '全部合集', value: '' },
  ...studio.unifiedCollections.map(collection => ({ label: collection.name, value: collection.id })),
])
const contentOptions = computed(() => [
  { label: '全部内容', value: '' },
  ...studio.contents[module.value].map(content => ({ label: content.title || '未命名内容', value: content.id })),
])
const rangeOptions: Array<{ label: string; value: 7 | 28 | 90 }> = [
  { label: '7 天', value: 7 },
  { label: '28 天', value: 28 },
  { label: '90 天', value: 90 },
]
const moduleMetrics: Record<StudioModule, string[]> = {
  blog: ['view', 'comment', 'like', 'bookmark', 'share'],
  podcast: ['play', 'complete', 'comment', 'bookmark', 'share'],
  video: ['play', 'comment', 'like', 'bookmark', 'share'],
}
const selectedMetric = ref(moduleMetrics[module.value][0])
const selectedMetricKey = computed(() => selectedMetric.value || moduleMetrics[module.value][0])
const metricOptions = computed(() => moduleMetrics[module.value].map(value => ({
  label: metricLabels[value] || value,
  value,
})))
const metricLabels: Record<string, string> = {
  impression: '曝光', open: '打开', engaged: '有效消费', view: '阅读', play: '播放', complete: '完成', comment: '评论', like: '点赞', bookmark: '收藏', share: '分享', follow: '新增关注',
}
const funnelMetricsByModule: Record<StudioModule, string[]> = {
  blog: ['impression', 'open', 'engaged', 'view'],
  podcast: ['impression', 'open', 'engaged', 'complete'],
  video: ['impression', 'open', 'engaged', 'complete'],
}
const funnelMetrics = computed(() => funnelMetricsByModule[module.value])
const sourceLabels: Record<string, string> = { direct: '直接访问', home: '首页', recommendation: '推荐', subscription: '订阅', continue: '继续消费', notification: '通知', search: '搜索' }
const visibleMetrics = computed(() => moduleMetrics[module.value])
let chart: Chart | null = null

function metricLabel(metric: string) {
  return metricLabels[metric] || metric
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value)
}

function funnelRate(metric: string, previous: string) {
  const base = analytics.value?.totals[previous] || 0
  if (!base) return 0
  return Math.round(((analytics.value?.totals[metric] || 0) / base) * 100)
}

function sourceLabel(source: string) {
  return sourceLabels[source] || source
}

function rankingSummary(metrics: Record<string, number>) {
  return visibleMetrics.value
    .filter(metric => metrics[metric] !== undefined)
    .map(metric => `${metricLabel(metric)} ${formatNumber(metrics[metric] || 0)}`)
    .join(' · ')
}

function contentEditPath(id: string) {
  return `/studio/${module.value}/${id}/edit`
}

function comparisonLabel(metric: string) {
  const current = analytics.value?.totals[metric] || 0
  const previous = analytics.value?.previous_period.totals[metric] || 0
  if (!previous) return current ? `较上一周期新增 ${formatNumber(current)}` : '较上一周期持平'
  const change = Math.round(((current - previous) / previous) * 100)
  if (!change) return '较上一周期持平'
  return `较上一周期${change > 0 ? '增长' : '下降'} ${Math.abs(change)}%`
}

function chartColors() {
  const styles = getComputedStyle(document.documentElement)
  return {
    text: styles.getPropertyValue('--a-color-text').trim() || '#18181b',
    muted: styles.getPropertyValue('--a-color-muted').trim() || '#71717a',
    border: styles.getPropertyValue('--a-color-border-soft').trim() || '#e4e4e7',
    accent: styles.getPropertyValue('--a-color-primary').trim() || '#18181b',
  }
}

function destroyChart() {
  chart?.destroy()
  chart = null
}

function renderChart() {
  destroyChart()
  if (!trendCanvas.value || !analytics.value?.trend.length) return
  const colors = chartColors()
  const primaryMetric = selectedMetricKey.value
  chart = new Chart(trendCanvas.value, {
    type: 'line',
    data: {
      labels: analytics.value.trend.map(point => point.date.slice(5)),
      datasets: [{
        label: metricLabel(primaryMetric),
        data: analytics.value.trend.map(point => point.metrics[primaryMetric] || 0),
        borderColor: colors.accent,
        backgroundColor: colors.accent,
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.25,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: colors.muted }, border: { color: colors.border } },
        y: { beginAtZero: true, grid: { color: colors.border }, ticks: { color: colors.muted, precision: 0 }, border: { display: false } },
      },
    },
  })
}

async function loadAnalytics() {
  if (!studio.currentChannel) return
  loading.value = true
  error.value = ''
  let loaded = false
  try {
    await studio.loadAnalytics(module.value, range.value, filters)
    loaded = true
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '加载失败'
    destroyChart()
  } finally {
    loading.value = false
  }
  if (loaded) {
    await nextTick()
    renderChart()
  }
}

async function changeRange(value: 7 | 28 | 90) {
  range.value = value
  await loadAnalytics()
}

function changeFilters() {
  void loadAnalytics()
}

onMounted(async () => {
  try {
    await studio.loadState()
    await Promise.all([
      loadAnalytics(),
      studio.loadUnifiedCollections(false),
      studio.loadContents(module.value, { q: '', status: '', visibility: '', collection_id: '', page: 1 }, false),
    ])
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '加载失败'
    loading.value = false
  }
})

watch(module, () => {
  selectedMetric.value = moduleMetrics[module.value][0]
  filters.content_id = ''
  void Promise.all([
    loadAnalytics(),
    studio.loadContents(module.value, { q: '', status: '', visibility: '', collection_id: '', page: 1 }, false),
  ])
})
watch(analytics, () => nextTick(renderChart))
watch(selectedMetricKey, () => nextTick(renderChart))
onBeforeUnmount(destroyChart)
</script>

<style scoped>
.studio-analytics { display: grid; gap: 1.25rem; }
.studio-analytics__header, .studio-analytics__section > header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.studio-analytics__filters { display: grid; grid-template-columns: minmax(12rem, 1fr) minmax(12rem, 1fr) auto; gap: 0.5rem; align-items: end; max-width: 44rem; }
.studio-analytics__filters :deep(.p-button) { width: 2.75rem; min-height: 2.75rem; padding: 0; }
.studio-analytics__header > div { min-width: 0; }
.studio-analytics__header p { margin: 0.25rem 0 0; color: var(--a-color-muted); font-size: 0.8125rem; }
.studio-analytics h2, .studio-analytics h3, .studio-analytics__message { margin: 0; }
.studio-analytics h2 { font-size: 1.25rem; }
.studio-analytics h3 { font-size: 0.95rem; }
.studio-analytics__message { color: var(--a-color-muted); padding: 2rem 0; }
.studio-analytics__funnel { padding: 1rem 1.125rem; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-card); background: var(--a-color-bg); }
.studio-analytics__funnel header { margin-bottom: 0.75rem; }
.studio-analytics__funnel header span { color: var(--a-color-muted); font-size: 0.75rem; }
.studio-analytics__funnel ol { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0; margin: 0; padding: 0; list-style: none; }
.studio-analytics__funnel li { min-width: 0; display: grid; gap: 0.25rem; padding: 0.5rem 1rem; border-right: 1px solid var(--a-color-border-soft); }
.studio-analytics__funnel li:last-child { border-right: 0; }
.studio-analytics__funnel span, .studio-analytics__funnel small { color: var(--a-color-muted); font-size: 0.75rem; }
.studio-analytics__funnel strong { font-size: 1.375rem; font-variant-numeric: tabular-nums; }
.studio-analytics__totals { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); margin: 0; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-card); background: var(--a-color-bg); overflow: hidden; }
.studio-analytics__totals div { min-width: 0; padding: 1rem; border-right: 1px solid var(--a-color-border-soft); }
.studio-analytics__totals div:hover { background: var(--a-color-surface); }
.studio-analytics__totals div:last-child { border-right: 0; }
.studio-analytics__totals dt { color: var(--a-color-muted); font-size: 0.75rem; }
.studio-analytics__totals dd { margin: 0.35rem 0 0; font-size: 1.5rem; font-variant-numeric: tabular-nums; }
.studio-analytics__totals small { display: block; min-height: 1.1rem; margin-top: 0.25rem; color: var(--a-color-muted); font-size: 0.7rem; line-height: 1.35; }
.studio-analytics__grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(18rem, 1fr); gap: 1.5rem; }
.studio-analytics__section { min-width: 0; display: grid; align-content: start; gap: 1rem; padding: 1rem 1.125rem; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-card); background: var(--a-color-bg); }
.studio-analytics__section > header { min-height: 2.5rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--a-color-border-soft); }
.studio-analytics__section > header :deep(.p-select) { width: min(12rem, 52vw); }
.studio-analytics__section > header span { color: var(--a-color-muted); font-size: 0.75rem; }
.studio-analytics__chart { width: 100%; min-width: 0; height: 20rem; overflow: hidden; }
.studio-analytics__chart canvas { max-width: 100% !important; }
.studio-analytics__ranking { display: grid; margin: 0; padding: 0; list-style: none; counter-reset: ranking; }
.studio-analytics__ranking li { counter-increment: ranking; display: grid; grid-template-columns: 1.5rem minmax(0, 1fr); gap: 0.25rem 0.75rem; padding: 0.75rem 0; border-bottom: 1px solid var(--a-color-border-soft); }
.studio-analytics__ranking li::before { content: counter(ranking); grid-row: 1; color: var(--a-color-muted); font-variant-numeric: tabular-nums; }
.studio-analytics__ranking a { grid-column: 2; display: grid; gap: 0.25rem; color: var(--a-color-text); text-decoration: none; }
.studio-analytics__ranking a:hover { color: var(--a-color-primary); }
.studio-analytics__ranking a:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 2px; }
.studio-analytics__ranking span { color: var(--a-color-muted); font-size: 0.75rem; line-height: 1.4; }
.studio-analytics__sources { margin: 0; padding: 0; list-style: none; }
.studio-analytics__sources li { display: flex; justify-content: space-between; gap: 1rem; padding: 0.75rem 0; border-bottom: 1px solid var(--a-color-border-soft); }
.studio-analytics__sources strong { font-variant-numeric: tabular-nums; }
.studio-analytics__retention { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 0; }
.studio-analytics__retention div { min-width: 0; padding: 0.75rem; border-right: 1px solid var(--a-color-border-soft); }
.studio-analytics__retention div:last-child { border-right: 0; }
.studio-analytics__retention dt { color: var(--a-color-muted); font-size: 0.75rem; }
.studio-analytics__retention dd { margin: 0.25rem 0 0; font-size: 1.125rem; font-variant-numeric: tabular-nums; }
@media (max-width: 800px) {
  .studio-analytics__totals { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .studio-analytics__totals div { border-bottom: 1px solid var(--a-color-border-soft); }
  .studio-analytics__grid { grid-template-columns: 1fr; }
  .studio-analytics__funnel ol { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .studio-analytics__funnel li:nth-child(2) { border-right: 0; }
}
@media (max-width: 520px) {
  .studio-analytics__header { align-items: flex-start; flex-direction: column; }
  .studio-analytics__header > :deep(.p-segmented-control), .studio-analytics__filters { width: 100%; }
  .studio-analytics__filters { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; }
}
</style>
