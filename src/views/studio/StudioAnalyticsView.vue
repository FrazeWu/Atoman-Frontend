<template>
  <section class="studio-analytics">
    <header class="studio-analytics__header">
      <h2>数据</h2>
      <PSegmentedControl v-model="range" :options="rangeOptions" :disabled="loading" @change="changeRange" />
    </header>

    <p v-if="loading" class="studio-analytics__message">加载中...</p>
    <p v-else-if="error" class="studio-analytics__message" role="alert">{{ error }}</p>
    <template v-else-if="analytics">
      <dl class="studio-analytics__totals">
        <div v-for="metric in visibleMetrics" :key="metric">
          <dt>{{ metricLabel(metric) }}</dt>
          <dd>{{ formatNumber(analytics.totals[metric] || 0) }}</dd>
        </div>
      </dl>

      <div class="studio-analytics__grid">
        <section class="studio-analytics__section">
          <header>
            <h3>趋势</h3>
            <span>最近 {{ analytics.range }} 天</span>
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
              <strong>{{ item.title }}</strong>
              <span>{{ rankingSummary(item.metrics) }}</span>
            </li>
          </ol>
          <PEmpty v-else kicker="" title="暂无排行数据" />
        </section>
      </div>
    </template>
    <PEmpty v-else kicker="" title="暂无数据" />
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Chart from 'chart.js/auto'
import { useRoute } from 'vue-router'

import PEmpty from '@/components/ui/PEmpty.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import { useStudioStore } from '@/stores/studio'
import type { StudioModule } from '@/types'

const route = useRoute()
const studio = useStudioStore()
const module = computed(() => route.params.module as StudioModule)
const range = ref<7 | 28 | 90>(28)
const loading = ref(true)
const error = ref('')
const trendCanvas = ref<HTMLCanvasElement | null>(null)
const analytics = computed(() => studio.analytics[module.value])
const rangeOptions = [
  { label: '7 天', value: 7 },
  { label: '28 天', value: 28 },
  { label: '90 天', value: 90 },
]
const moduleMetrics: Record<StudioModule, string[]> = {
  blog: ['view', 'comment', 'like', 'bookmark', 'share'],
  podcast: ['play', 'complete', 'comment', 'bookmark', 'share'],
  video: ['play', 'comment', 'like', 'bookmark', 'share'],
}
const metricLabels: Record<string, string> = {
  view: '阅读', play: '播放', complete: '完播', comment: '评论', like: '点赞', bookmark: '收藏', share: '分享',
}
const visibleMetrics = computed(() => moduleMetrics[module.value])
let chart: Chart | null = null

function metricLabel(metric: string) {
  return metricLabels[metric] || metric
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value)
}

function rankingSummary(metrics: Record<string, number>) {
  return visibleMetrics.value
    .filter(metric => metrics[metric] !== undefined)
    .map(metric => `${metricLabel(metric)} ${formatNumber(metrics[metric] || 0)}`)
    .join(' · ')
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
  const primaryMetric = visibleMetrics.value[0]
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
    await studio.loadAnalytics(module.value, range.value)
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

onMounted(async () => {
  try {
    await studio.loadState()
    await loadAnalytics()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '加载失败'
    loading.value = false
  }
})

watch(module, () => void loadAnalytics())
watch(analytics, () => nextTick(renderChart))
onBeforeUnmount(destroyChart)
</script>

<style scoped>
.studio-analytics { display: grid; gap: 1rem; }
.studio-analytics__header, .studio-analytics__section > header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.studio-analytics h2, .studio-analytics h3, .studio-analytics__message { margin: 0; }
.studio-analytics h2 { font-size: 1.125rem; }
.studio-analytics h3 { font-size: 0.95rem; }
.studio-analytics__message { color: var(--a-color-muted); padding: 2rem 0; }
.studio-analytics__totals { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); margin: 0; border-block: 1px solid var(--a-color-border-soft); }
.studio-analytics__totals div { min-width: 0; padding: 1rem; border-right: 1px solid var(--a-color-border-soft); }
.studio-analytics__totals div:last-child { border-right: 0; }
.studio-analytics__totals dt { color: var(--a-color-muted); font-size: 0.75rem; }
.studio-analytics__totals dd { margin: 0.35rem 0 0; font-size: 1.5rem; font-variant-numeric: tabular-nums; }
.studio-analytics__grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(18rem, 1fr); gap: 1.5rem; }
.studio-analytics__section { min-width: 0; display: grid; align-content: start; gap: 1rem; }
.studio-analytics__section > header { min-height: 2.5rem; border-bottom: 1px solid var(--a-color-border-soft); }
.studio-analytics__section > header span { color: var(--a-color-muted); font-size: 0.75rem; }
.studio-analytics__chart { height: 20rem; }
.studio-analytics__ranking { display: grid; margin: 0; padding: 0; list-style: none; counter-reset: ranking; }
.studio-analytics__ranking li { counter-increment: ranking; display: grid; grid-template-columns: 1.5rem minmax(0, 1fr); gap: 0.25rem 0.75rem; padding: 0.75rem 0; border-bottom: 1px solid var(--a-color-border-soft); }
.studio-analytics__ranking li::before { content: counter(ranking); grid-row: 1 / 3; color: var(--a-color-muted); font-variant-numeric: tabular-nums; }
.studio-analytics__ranking span { color: var(--a-color-muted); font-size: 0.75rem; line-height: 1.4; }
@media (max-width: 800px) {
  .studio-analytics__totals { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .studio-analytics__totals div { border-bottom: 1px solid var(--a-color-border-soft); }
  .studio-analytics__grid { grid-template-columns: 1fr; }
}
@media (max-width: 520px) {
  .studio-analytics__header { align-items: flex-start; flex-direction: column; }
}
</style>
