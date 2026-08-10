<template>
  <section class="studio-dashboard">
    <PPageHeader title="创作工作台" mb="1.5rem">
      <template v-if="studio.dashboard" #action>
        <span data-testid="dashboard-subscriber-count" style="color:var(--a-color-muted);font-size:0.875rem">
          频道订阅 {{ formatNumber(studio.dashboard.channel_subscriber_count) }}
        </span>
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
.studio-dashboard__header { min-height: 3rem; display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding-bottom: 1rem; }
.studio-dashboard__header h1 { margin: 0; font-size: 1.5rem; }
.studio-dashboard__header p { margin: 0; color: var(--a-color-muted); font-size: 0.875rem; font-variant-numeric: tabular-nums; }
.studio-dashboard__sections { display: grid; }
.studio-dashboard__retry-error { margin: 0 0 1rem; color: var(--a-color-danger); }
.studio-dashboard__state { margin: 2rem 0; }
.studio-dashboard__state button { min-height: 2.75rem; border: 1px solid var(--a-color-fg); background: var(--a-color-bg); color: var(--a-color-fg); padding: 0 1rem; cursor: pointer; }
.studio-dashboard__state button:focus-visible { outline: 2px solid var(--a-color-fg); outline-offset: 2px; }
</style>
