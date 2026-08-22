<template>
  <section class="studio-dashboard">
    <PPageHeader :title="title" sub="按内容模块查看创作状态与表现" mb="2rem">
      <template v-if="studio.dashboard" #action>
        <div class="studio-dashboard__subscriber" data-testid="dashboard-subscriber-count">
          <span>频道订阅</span>
          <strong>{{ formatNumber(studio.dashboard.channel_subscriber_count) }}</strong>
        </div>
      </template>
    </PPageHeader>

    <p v-if="loading" class="studio-dashboard__state">加载中...</p>
    <PEmpty v-else-if="error" title="加载失败" :description="error" />
    <PEmpty v-else-if="!studio.dashboard" title="暂无创作内容" description="在此管理你的博客文章、播客单集与视频。" />
    <div v-else class="studio-dashboard__sections">
      <p v-if="retryError" class="studio-dashboard__retry-error" role="alert">{{ retryError }}</p>
      <StudioDashboardSection
        v-for="section in orderedSections"
        :key="section.module"
        :section="section"
        :can-create="canCreate(section.module)"
        @retry="retrySection"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import StudioDashboardSection from '@/components/studio/StudioDashboardSection.vue'
import { useStudioStore } from '@/stores/studio'
import { useSiteAccessStore } from '@/stores/siteAccess'
import type { StudioDashboardSection as DashboardSection, StudioModule } from '@/types'

const props = withDefaults(defineProps<{ title?: string }>(), {
  title: '创作工作台',
})
const title = computed(() => props.title)
const studio = useStudioStore()
const siteAccess = useSiteAccessStore()
const loading = ref(true)
const error = ref('')
const retryError = ref('')
const modules: StudioModule[] = ['blog', 'podcast', 'video']
const publishingFeature = {
  blog: 'post.create',
  podcast: 'podcast.publish',
  video: 'video.publish',
} as const

function canCreate(module: StudioModule) {
  return siteAccess.isFeatureEnabled(module, publishingFeature[module])
}

const orderedSections = computed(() => modules.map((module): DashboardSection => (
  studio.dashboard?.sections.find(section => section.module === module) ?? {
    module,
    metrics: {},
    recent: [],
    issues: [],
    error: '加载失败',
  }
)))

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value)
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
.studio-dashboard { display: grid; gap: 0; }
.studio-dashboard__subscriber {
  min-width: 8.5rem;
  display: grid;
  gap: 0.25rem;
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
}
.studio-dashboard__subscriber span { color: var(--a-color-muted); font-size: 0.75rem; }
.studio-dashboard__subscriber strong { font-size: 1.125rem; font-variant-numeric: tabular-nums; }
.studio-dashboard__sections { display: grid; }
.studio-dashboard__retry-error { margin: 0 0 1rem; color: var(--a-color-danger); }
.studio-dashboard__state { margin: 2rem 0; }
.studio-dashboard__state button { min-height: 2.75rem; border: 1px solid var(--a-color-fg); background: var(--a-color-bg); color: var(--a-color-fg); padding: 0 1rem; cursor: pointer; }
.studio-dashboard__state button:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 2px; }
@media (max-width: 560px) {
  .studio-dashboard :deep(.p-page-header__action) { width: 100%; }
  .studio-dashboard__subscriber { width: 100%; }
}
</style>
