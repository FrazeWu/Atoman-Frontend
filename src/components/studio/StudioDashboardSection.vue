<template>
  <section
    class="dashboard-section"
    data-testid="studio-dashboard-section"
    :data-module="section.module"
  >
    <header class="dashboard-section__header">
      <span class="dashboard-section__icon" aria-hidden="true">
        <component :is="moduleIcon" :size="18" />
      </span>
      <div>
        <h2>{{ config.label }}</h2>
        <p>{{ config.itemLabel }}</p>
      </div>
      <RouterLink :to="`/studio/${section.module}/content`" class="dashboard-section__manage">
        <List :size="16" aria-hidden="true" />
        <span>管理</span>
      </RouterLink>
    </header>

    <div v-if="section.error" class="dashboard-section__error" role="alert">
      <p>{{ config.label }}加载失败</p>
      <button type="button" data-testid="retry-dashboard-section" @click="$emit('retry')">重试</button>
    </div>
    <template v-else>
      <dl class="dashboard-section__metrics">
        <div v-for="metric in visibleMetrics" :key="metric.key" :data-metric="metric.key">
          <dt>{{ metric.label }}</dt>
          <dd>{{ formatNumber(metric.value) }}</dd>
        </div>
      </dl>
      <RouterLink :to="`/studio/${section.module}/analytics`" class="dashboard-section__analytics">
        查看数据
      </RouterLink>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { IconFileText as FileText, IconList as List, IconMicrophone2 as Mic2, IconVideo as Video } from '@tabler/icons-vue'

import type { StudioDashboardSection, StudioModule } from '@/types'

const props = defineProps<{ section: StudioDashboardSection }>()
defineEmits<{ retry: [] }>()

const moduleConfig: Record<StudioModule, { label: string; itemLabel: string }> = {
  blog: { label: '博客', itemLabel: '文章' },
  podcast: { label: '播客', itemLabel: '单集' },
  video: { label: '视频', itemLabel: '视频' },
}
const metricLabels: Record<string, string> = {
  contents: '内容',
  published: '已发布',
  drafts: '草稿',
  view: '阅读',
  play: '播放',
}
const metricKeys: Record<StudioModule, string[]> = {
  blog: ['contents', 'published', 'drafts', 'view'],
  podcast: ['contents', 'published', 'drafts', 'play'],
  video: ['contents', 'published', 'drafts', 'play'],
}
const moduleIcons = { blog: FileText, podcast: Mic2, video: Video }
const config = computed(() => moduleConfig[props.section.module])
const moduleIcon = computed(() => moduleIcons[props.section.module])
const visibleMetrics = computed(() => metricKeys[props.section.module].map(key => ({
  key,
  label: metricLabels[key],
  value: props.section.metrics[key] ?? 0,
})))

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value)
}
</script>

<style scoped>
.dashboard-section { min-width: 0; display: grid; gap: 0.875rem; padding: 1rem; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-card); background: var(--a-color-bg); }
.dashboard-section__header { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 0.625rem; }
.dashboard-section__icon { width: 2.25rem; height: 2.25rem; display: grid; place-items: center; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-control); color: var(--a-color-primary); }
.dashboard-section h2, .dashboard-section p { margin: 0; }
.dashboard-section h2 { font-size: 1rem; }
.dashboard-section p { margin-top: 0.1rem; color: var(--a-color-muted); font-size: 0.75rem; }
.dashboard-section__manage { min-height: 2.25rem; display: inline-flex; align-items: center; gap: 0.3rem; padding: 0 0.5rem; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-control); color: var(--a-color-text); font-size: 0.75rem; text-decoration: none; }
.dashboard-section__manage:hover, .dashboard-section__analytics:hover { color: var(--a-color-primary); }
.dashboard-section__manage:focus-visible, .dashboard-section__analytics:focus-visible, .dashboard-section__error button:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 2px; }
.dashboard-section__metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.625rem; margin: 0; }
.dashboard-section__metrics div { min-width: 0; }
.dashboard-section__metrics dt { color: var(--a-color-muted); font-size: 0.7rem; }
.dashboard-section__metrics dd { margin: 0.2rem 0 0; font-size: 1rem; font-variant-numeric: tabular-nums; }
.dashboard-section__analytics { justify-self: start; color: var(--a-color-muted); font-size: 0.75rem; text-decoration: none; }
.dashboard-section__error { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; color: var(--a-color-danger); }
.dashboard-section__error button { min-height: 2.25rem; padding: 0 0.625rem; border: 1px solid currentColor; border-radius: var(--a-radius-control); background: transparent; color: inherit; cursor: pointer; }
</style>
