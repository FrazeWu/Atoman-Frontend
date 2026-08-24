<template>
  <section class="studio-dashboard">
    <PPageHeader :title="title" sub="查看当前频道的创作状态与近期表现" mb="2rem">
      <template #action>
        <div class="studio-dashboard__header-actions">
          <PDropdown v-if="creationActions.length" position="right">
            <template #trigger="{ open }">
              <PButton
                data-testid="dashboard-create"
                type="button"
                size="sm"
                aria-haspopup="menu"
                :aria-expanded="open"
              >
                <Plus :size="16" aria-hidden="true" />
                新建
              </PButton>
            </template>
            <template #default="{ close }">
              <div class="studio-dashboard__create-menu" role="menu" aria-label="新建内容">
                <RouterLink
                  v-for="action in creationActions"
                  :key="action.module"
                  :to="`/studio/${action.module}/new`"
                  role="menuitem"
                  @click="close"
                >
                  <component :is="moduleIcons[action.module]" :size="16" aria-hidden="true" />
                  {{ action.label }}
                </RouterLink>
              </div>
            </template>
          </PDropdown>
          <RouterLink class="studio-dashboard__manage" to="/studio/manage/channel">
            <Settings2 :size="16" aria-hidden="true" />
            管理
          </RouterLink>
        </div>
      </template>
    </PPageHeader>

    <p v-if="loading" class="studio-dashboard__state">加载中...</p>
    <PEmpty v-else-if="error" title="加载失败" :description="error" />
    <PEmpty v-else-if="!studio.dashboard" title="暂无创作内容" description="在此管理你的博客文章、播客单集与视频。" />
    <template v-else>
      <p v-if="retryError" class="studio-dashboard__retry-error" role="alert">{{ retryError }}</p>

      <dl class="studio-dashboard__summary" aria-label="创作状态">
        <div data-testid="dashboard-subscriber-count">
          <dt>频道订阅</dt>
          <dd>{{ formatNumber(studio.dashboard.channel_subscriber_count) }}</dd>
        </div>
        <div>
          <dt>内容总数</dt>
          <dd>{{ formatNumber(summary.contents) }}</dd>
        </div>
        <div>
          <dt>已发布</dt>
          <dd>{{ formatNumber(summary.published) }}</dd>
        </div>
        <div>
          <dt>草稿</dt>
          <dd>{{ formatNumber(summary.drafts) }}</dd>
        </div>
        <div>
          <dt>定时发布</dt>
          <dd>{{ formatNumber(summary.scheduled) }}</dd>
        </div>
      </dl>

      <section class="studio-dashboard__actions" aria-labelledby="studio-action-title">
        <header class="studio-dashboard__section-heading">
          <div>
            <h2 id="studio-action-title">待处理</h2>
            <p>优先处理会影响发布和互动的事项。</p>
          </div>
        </header>
        <p v-if="!actionItems.length" class="studio-dashboard__empty">暂无待处理事项</p>
        <ul v-else>
          <li v-for="item in actionItems" :key="`${item.module}-${item.code}`">
            <RouterLink :to="actionRoute(item)">
              <component :is="moduleIcons[item.module]" :size="18" aria-hidden="true" />
              <span>
                <strong>{{ actionText(item) }}</strong>
                <small>{{ moduleLabels[item.module] }}</small>
              </span>
              <em :class="`studio-dashboard__priority studio-dashboard__priority--${item.priority}`">{{ priorityLabel(item.priority) }}</em>
            </RouterLink>
          </li>
        </ul>
      </section>

      <div class="studio-dashboard__activity-grid">
        <section class="studio-dashboard__recent" aria-labelledby="studio-recent-title">
          <header class="studio-dashboard__section-heading">
            <div>
              <h2 id="studio-recent-title">最近创作</h2>
              <p>按最后更新时间排序。</p>
            </div>
          </header>
          <p v-if="!recentItems.length" class="studio-dashboard__empty">暂无内容</p>
          <ul v-else>
            <li v-for="item in recentItems" :key="`${item.module}-${item.id}`">
              <RouterLink :to="`/studio/${item.module}/${item.id}/edit`">
                <component :is="moduleIcons[item.module]" :size="18" aria-hidden="true" />
                <span>
                  <strong>{{ item.title || `未命名${moduleItemLabels[item.module]}` }}</strong>
                  <small>{{ moduleLabels[item.module] }} · {{ statusLabel(item.status) }}</small>
                </span>
                <time :datetime="item.updated_at">{{ formatDate(item.updated_at) }}</time>
              </RouterLink>
            </li>
          </ul>
        </section>

        <section class="studio-dashboard__modules" aria-labelledby="studio-module-title">
          <header class="studio-dashboard__section-heading">
            <div>
              <h2 id="studio-module-title">按类型创作</h2>
              <p>进入内容、数据和互动管理。</p>
            </div>
          </header>
          <div class="studio-dashboard__module-grid">
            <StudioDashboardSection
              v-for="section in orderedSections"
              :key="section.module"
              :section="section"
              @retry="retrySection"
            />
          </div>
        </section>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { FileText, Mic2, Plus, Settings2, Video } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'

import PButton from '@/components/ui/PButton.vue'
import PDropdown from '@/components/ui/PDropdown.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import StudioDashboardSection from '@/components/studio/StudioDashboardSection.vue'
import { useStudioStore } from '@/stores/studio'
import { useAuthStore } from '@/stores/auth'
import { useSiteAccessStore } from '@/stores/siteAccess'
import type { StudioContentIssue, StudioContentItem, StudioDashboardSection as DashboardSection, StudioModule } from '@/types'

interface DashboardAction extends StudioContentIssue {
  module: StudioModule
  priority: 'critical' | 'attention' | 'routine'
}

const props = withDefaults(defineProps<{ title?: string }>(), {
  title: '概览',
})
const title = computed(() => props.title)
const studio = useStudioStore()
const auth = useAuthStore()
const siteAccess = useSiteAccessStore()
const loading = ref(true)
const error = ref('')
const retryError = ref('')
const modules: StudioModule[] = ['blog', 'podcast', 'video']
const moduleLabels = { blog: '博客', podcast: '播客', video: '视频' } as const
const moduleItemLabels = { blog: '文章', podcast: '单集', video: '视频' } as const
const moduleIcons = { blog: FileText, podcast: Mic2, video: Video }
const publishingFeature = { blog: 'post.create', podcast: 'podcast.publish', video: 'video.publish' } as const
const creationLabels = { blog: '写文章', podcast: '发布单集', video: '上传视频' } as const
const creationActions = computed(() => modules
  .filter(module => auth.isAuthenticated && siteAccess.isFeatureEnabled(module, publishingFeature[module]))
  .map(module => ({ module, label: creationLabels[module] })))

const orderedSections = computed(() => modules.map((module): DashboardSection => (
  studio.dashboard?.sections.find(section => section.module === module) ?? {
    module,
    metrics: {},
    recent: [],
    issues: [],
    error: '加载失败',
  }
)))

const summary = computed(() => orderedSections.value.reduce((result, section) => ({
  contents: result.contents + (section.metrics.contents ?? 0),
  published: result.published + (section.metrics.published ?? 0),
  drafts: result.drafts + (section.metrics.drafts ?? 0),
  scheduled: result.scheduled + (section.metrics.scheduled ?? 0),
}), { contents: 0, published: 0, drafts: 0, scheduled: 0 }))

const actionItems = computed<DashboardAction[]>(() => orderedSections.value
  .flatMap(section => section.issues.map(issue => ({
    ...issue,
    module: section.module,
    priority: issuePriority(issue.code),
  })))
  .sort((left, right) => (
    priorityOrder[left.priority] - priorityOrder[right.priority]
    || modules.indexOf(left.module) - modules.indexOf(right.module)
    || left.code.localeCompare(right.code)
  )))

const recentItems = computed(() => orderedSections.value
  .flatMap(section => section.recent)
  .sort((left, right) => dateValue(right.updated_at) - dateValue(left.updated_at))
  .slice(0, 5))

const priorityOrder = { critical: 0, attention: 1, routine: 2 } as const

function issuePriority(code: string): DashboardAction['priority'] {
  if (['processing_failed', 'external_unplayable', 'missing_audio'].includes(code)) return 'critical'
  if (code === 'unreplied_comment') return 'attention'
  return 'routine'
}

function actionRoute(item: DashboardAction) {
  if (item.code === 'unreplied_comment') return `/studio/${item.module}/interactions?unreplied=true`
  return `/studio/${item.module}/content?issue=${item.code}`
}

function actionText(item: DashboardAction) {
  const nouns = { blog: '篇', podcast: '个单集', video: '个视频' } as const
  const labels: Record<string, string> = {
    draft: `${item.count} ${nouns[item.module]}草稿待完善`,
    missing_cover: `${item.count} 条内容缺少封面`,
    missing_collection: `${item.count} 条内容未加入合集`,
    missing_audio: `${item.count} 个单集缺少音频`,
    processing_failed: `${item.count} 个视频处理失败`,
    external_unplayable: `${item.count} 个外链不可播放`,
    unreplied_comment: `${item.count} 条评论待回复`,
  }
  return labels[item.code] ?? `${item.count} 条内容需要处理`
}

function priorityLabel(priority: DashboardAction['priority']) {
  return { critical: '优先处理', attention: '待回复', routine: '待完善' }[priority]
}

function statusLabel(status: StudioContentItem['status']) {
  return { published: '已发布', scheduled: '定时发布', draft: '草稿' }[status]
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value)
}

function formatDate(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? '未知时间'
    : parsed.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

function dateValue(value: string) {
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    await studio.loadState()
    if (studio.currentChannel) await studio.loadDashboard()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    loading.value = false
  }
}

async function retrySection() {
  retryError.value = ''
  try {
    await studio.loadDashboard()
  } catch (cause) {
    retryError.value = cause instanceof Error ? cause.message : '重试失败'
  }
}

onMounted(load)
</script>

<style scoped>
.studio-dashboard { display: grid; gap: 1.5rem; }
.studio-dashboard__header-actions { display: flex; align-items: center; gap: 0.5rem; }
.studio-dashboard__manage { min-height: 2.75rem; display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; padding: 0 0.875rem; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-control); color: var(--a-color-text); text-decoration: none; }
.studio-dashboard__create-menu { display: grid; min-width: 10rem; padding: 0.25rem; }
.studio-dashboard__create-menu a { min-height: 2.75rem; display: flex; align-items: center; gap: 0.5rem; padding: 0 0.625rem; color: var(--a-color-text); text-decoration: none; }
.studio-dashboard__create-menu a:hover { background: var(--a-color-surface-muted); color: var(--a-color-primary); }
.studio-dashboard__manage:hover { border-color: var(--a-color-primary); color: var(--a-color-primary); }
.studio-dashboard__manage:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 2px; }
.studio-dashboard__summary { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); margin: 0; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-card); background: var(--a-color-bg); overflow: hidden; }
.studio-dashboard__summary > div { min-width: 0; padding: 1rem; border-right: 1px solid var(--a-color-border-soft); }
.studio-dashboard__summary > div:last-child { border-right: 0; }
.studio-dashboard__summary dt { color: var(--a-color-muted); font-size: 0.75rem; }
.studio-dashboard__summary dd { margin: 0.35rem 0 0; font-size: 1.5rem; font-variant-numeric: tabular-nums; }
.studio-dashboard__actions, .studio-dashboard__recent, .studio-dashboard__modules { min-width: 0; display: grid; gap: 0.875rem; }
.studio-dashboard__section-heading h2, .studio-dashboard__section-heading p, .studio-dashboard__empty, .studio-dashboard__retry-error, .studio-dashboard__state { margin: 0; }
.studio-dashboard__section-heading h2 { font-size: 1.125rem; }
.studio-dashboard__section-heading p { margin-top: 0.25rem; color: var(--a-color-muted); font-size: 0.8125rem; }
.studio-dashboard__actions ul, .studio-dashboard__recent ul { display: grid; gap: 0; margin: 0; padding: 0; border-top: 1px solid var(--a-color-border-soft); list-style: none; }
.studio-dashboard__actions li, .studio-dashboard__recent li { border-bottom: 1px solid var(--a-color-border-soft); }
.studio-dashboard__actions a, .studio-dashboard__recent a { min-height: 3.5rem; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 0.75rem; color: var(--a-color-text); text-decoration: none; }
.studio-dashboard__actions a:hover, .studio-dashboard__recent a:hover { color: var(--a-color-primary); }
.studio-dashboard__actions a:focus-visible, .studio-dashboard__recent a:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: -2px; }
.studio-dashboard__actions span, .studio-dashboard__recent span { min-width: 0; display: grid; gap: 0.15rem; }
.studio-dashboard__actions strong, .studio-dashboard__recent strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.studio-dashboard__actions small, .studio-dashboard__recent small, .studio-dashboard__recent time { color: var(--a-color-muted); font-size: 0.75rem; }
.studio-dashboard__recent time { font-variant-numeric: tabular-nums; }
.studio-dashboard__priority { font-style: normal; font-size: 0.75rem; white-space: nowrap; }
.studio-dashboard__priority--critical { color: var(--a-color-danger); }
.studio-dashboard__priority--attention { color: var(--a-color-primary); }
.studio-dashboard__priority--routine { color: var(--a-color-muted); }
.studio-dashboard__empty, .studio-dashboard__state { padding: 1.5rem 0; color: var(--a-color-muted); }
.studio-dashboard__retry-error { color: var(--a-color-danger); }
.studio-dashboard__activity-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 2rem; }
.studio-dashboard__module-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; }
@media (max-width: 900px) {
  .studio-dashboard__activity-grid { grid-template-columns: 1fr; }
  .studio-dashboard__module-grid { grid-template-columns: 1fr; }
}
@media (max-width: 560px) {
  .studio-dashboard :deep(.p-page-header__action) { width: 100%; }
  .studio-dashboard__header-actions { width: 100%; }
  .studio-dashboard__header-actions > * { flex: 1; }
  .studio-dashboard__header-actions :deep(.p-button),
  .studio-dashboard__manage { width: 100%; }
  .studio-dashboard__summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .studio-dashboard__summary > div:nth-child(2) { border-right: 0; }
  .studio-dashboard__summary > div:nth-child(4) { border-right: 0; }
  .studio-dashboard__summary > div:nth-child(-n + 4) { border-bottom: 1px solid var(--a-color-border-soft); }
  .studio-dashboard__summary > div:last-child { grid-column: 1 / -1; border-right: 0; }
  .studio-dashboard__actions a, .studio-dashboard__recent a { min-height: 4rem; }
}
</style>
