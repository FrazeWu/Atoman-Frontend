<template>
  <section
    class="dashboard-section"
    data-testid="studio-dashboard-section"
    :data-module="section.module"
  >
    <header class="dashboard-section__header">
      <div>
        <h2>{{ config.label }}</h2>
        <p>{{ config.itemLabel }}</p>
      </div>
      <div class="dashboard-section__actions">
		<RouterLink v-if="canCreate" :to="`/studio/${section.module}/new`" class="dashboard-action dashboard-action--primary">
          <Plus :size="16" aria-hidden="true" />
          <span>{{ config.createLabel }}</span>
        </RouterLink>
        <RouterLink :to="`/studio/${section.module}/content`" class="dashboard-action">
          <List :size="16" aria-hidden="true" />
          <span>管理</span>
        </RouterLink>
      </div>
    </header>

    <div v-if="section.error" class="dashboard-section__error" role="alert">
      <p>{{ section.error }}</p>
      <button type="button" data-testid="retry-dashboard-section" @click="$emit('retry')">重试</button>
    </div>
    <template v-else>
      <dl class="dashboard-metrics">
        <div v-for="metric in visibleMetrics" :key="metric.key" :data-metric="metric.key">
          <dt>{{ metric.label }}</dt>
          <dd>{{ formatNumber(metric.value) }}</dd>
        </div>
      </dl>

      <div class="dashboard-section__body">
        <section class="dashboard-recent" aria-label="最近内容">
          <h3>最近内容</h3>
          <p v-if="!recent.length" class="dashboard-empty">暂无内容</p>
          <ul v-else>
            <li v-for="item in recent" :key="item.id" data-testid="dashboard-recent-item">
              <RouterLink :to="`/studio/${section.module}/${item.id}/edit`">
                <span>{{ item.title }}</span>
                <time :datetime="item.updated_at">{{ formatDate(item.updated_at) }}</time>
              </RouterLink>
            </li>
          </ul>
        </section>

        <section class="dashboard-issues" aria-label="需要处理">
          <h3>需要处理</h3>
          <p v-if="!section.issues.length" class="dashboard-empty">暂无问题</p>
          <ul v-else>
            <li v-for="issue in section.issues" :key="issue.code">
			  <RouterLink :to="issueRoute(issue.code)">
                {{ issueText(issue.code, issue.count) }}
              </RouterLink>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { List, Plus } from 'lucide-vue-next'
import type { StudioDashboardSection, StudioModule } from '@/types'

const props = withDefaults(defineProps<{ section: StudioDashboardSection; canCreate?: boolean }>(), { canCreate: true })
defineEmits<{ retry: [] }>()

const moduleConfig: Record<StudioModule, { label: string; itemLabel: string; createLabel: string }> = {
  blog: { label: '博客', itemLabel: '文章', createLabel: '写文章' },
  podcast: { label: '播客', itemLabel: '单集', createLabel: '发布单集' },
  video: { label: '视频', itemLabel: '视频', createLabel: '上传视频' },
}

const metricLabels: Record<string, string> = {
  view: '阅读',
  play: '播放',
  complete: '完播',
  comment: '评论',
  like: '点赞',
  bookmark: '收藏',
  share: '分享',
}

const config = computed(() => moduleConfig[props.section.module])
const metricKeys: Record<StudioModule, string[]> = {
  blog: ['view', 'comment', 'like', 'bookmark', 'share'],
  podcast: ['play', 'complete', 'comment', 'bookmark', 'share'],
  video: ['play', 'comment', 'like', 'bookmark', 'share'],
}
const visibleMetrics = computed(() => metricKeys[props.section.module].map(key => ({
  key,
  label: metricLabels[key],
  value: props.section.metrics[key] ?? 0,
})))
const recent = computed(() => props.section.recent.slice(0, 3))

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value)
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

function issueText(code: string, count: number) {
  const noun = props.section.module === 'blog' ? '篇' : props.section.module === 'podcast' ? '个单集' : '个视频'
  const labels: Record<string, string> = {
    draft: `${count} ${noun}草稿`,
    missing_cover: `${count} 条缺少封面`,
    missing_collection: `${count} 条未选合集`,
    missing_audio: `${count} 个单集缺少音频`,
    processing_failed: `${count} 个视频处理失败`,
    external_unplayable: `${count} 个外链不可播放`,
    unreplied_comment: `${count} 条评论待回复`,
  }
  return labels[code] ?? `${count} 条待处理`
}

function issueRoute(code: string) {
  if (code === 'unreplied_comment') return `/studio/${props.section.module}/interactions?unreplied=true`
  return `/studio/${props.section.module}/content?issue=${code}`
}
</script>

<style scoped>
.dashboard-section {
  display: grid;
  gap: 1rem;
  padding: 1.25rem 0;
  border-top: 1px solid var(--a-color-border-soft);
}

.dashboard-section__header,
.dashboard-section__actions,
.dashboard-section__header > div:first-child {
  display: flex;
  align-items: center;
}

.dashboard-section__header { justify-content: space-between; gap: 1rem; }
.dashboard-section__header > div:first-child { gap: 0.75rem; }
.dashboard-section__header h2,
.dashboard-section__header p,
.dashboard-section h3,
.dashboard-empty { margin: 0; }
.dashboard-section__header h2 { font-size: 1.125rem; }
.dashboard-section__header p { color: var(--a-color-muted); font-size: 0.8125rem; }
.dashboard-section__actions { gap: 0.5rem; }

.dashboard-action {
  min-height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0 0.75rem;
  border: 1px solid var(--a-color-border-soft);
  color: var(--a-color-fg);
  text-decoration: none;
}
.dashboard-action--primary { color: var(--a-color-bg); background: var(--a-color-fg); border-color: var(--a-color-fg); }
.dashboard-action:hover { border-color: var(--a-color-fg); }
.dashboard-action:focus-visible { outline: 2px solid var(--a-color-fg); outline-offset: 2px; }

.dashboard-metrics {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  margin: 0;
  border-block: 1px solid var(--a-color-border-soft);
}
.dashboard-metrics > div { min-width: 0; padding: 0.875rem; border-right: 1px solid var(--a-color-border-soft); }
.dashboard-metrics > div:last-child { border-right: 0; }
.dashboard-metrics dt { color: var(--a-color-muted); font-size: 0.75rem; }
.dashboard-metrics dd { margin: 0.25rem 0 0; font-size: 1.25rem; font-variant-numeric: tabular-nums; }

.dashboard-section__body { display: grid; grid-template-columns: minmax(0, 2fr) minmax(12rem, 1fr); gap: 2rem; }
.dashboard-section__body section { min-width: 0; }
.dashboard-section h3 { margin-bottom: 0.5rem; font-size: 0.8125rem; color: var(--a-color-muted); }
.dashboard-section ul { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
.dashboard-section li { border-bottom: 1px solid var(--a-color-border-soft); }
.dashboard-section li a { min-height: 2.75rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; color: var(--a-color-fg); text-decoration: none; }
.dashboard-section li a:hover { text-decoration: underline; }
.dashboard-section time, .dashboard-empty { color: var(--a-color-muted); font-size: 0.8125rem; }
.dashboard-section__error { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem; border: 1px solid var(--a-color-danger); color: var(--a-color-danger); }
.dashboard-section__error p { margin: 0; }
.dashboard-section__error button { min-height: 2.75rem; padding: 0 0.875rem; border: 1px solid currentColor; background: transparent; color: inherit; cursor: pointer; }
.dashboard-section__error button:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }

@media (max-width: 700px) {
  .dashboard-section__header { align-items: flex-start; }
  .dashboard-section__actions { flex-wrap: wrap; justify-content: flex-end; }
  .dashboard-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dashboard-metrics > div:nth-child(2) { border-right: 0; }
  .dashboard-metrics > div:nth-child(-n + 2) { border-bottom: 1px solid var(--a-color-border-soft); }
  .dashboard-section__body { grid-template-columns: 1fr; gap: 1.25rem; }
}
</style>
