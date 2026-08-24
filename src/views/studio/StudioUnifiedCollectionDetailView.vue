<template>
  <section class="studio-collection-detail">
    <PPageHeader :title="collection?.name || '合集'" :sub="collection?.description || '管理合集成员与展示顺序。'" mb="0">
      <template #action>
        <RouterLink class="studio-collection-detail__back" to="/studio/manage/collections">
          <ArrowLeft :size="16" aria-hidden="true" />
          返回合集
        </RouterLink>
      </template>
    </PPageHeader>

    <p v-if="loading" class="studio-collection-detail__message">加载中...</p>
    <p v-else-if="error" class="studio-collection-detail__message studio-collection-detail__message--error" role="alert">{{ error }}</p>
    <PEmpty v-else-if="!studio.currentChannel" kicker="" title="请先创建频道" description="合集需要归属于一个频道。">
      <template #action>
        <RouterLink class="studio-collection-detail__back" to="/studio/manage/channel">管理频道</RouterLink>
      </template>
    </PEmpty>
    <PEmpty v-else-if="!collection" kicker="" title="合集不存在" description="该合集可能已被删除，或不属于当前频道。">
      <template #action>
        <RouterLink class="studio-collection-detail__back" to="/studio/manage/collections">返回合集</RouterLink>
      </template>
    </PEmpty>
    <template v-else>
      <p v-if="actionError" class="studio-collection-detail__message studio-collection-detail__message--error" role="alert">{{ actionError }}</p>
      <p v-if="!items.length" class="studio-collection-detail__message">暂无内容</p>
      <ol v-else class="studio-collection-detail__list">
        <li v-for="(item, index) in items" :key="item.content_id">
          <span class="studio-collection-detail__position" aria-hidden="true">{{ index + 1 }}</span>
          <span class="studio-collection-detail__module" :data-module="item.module">
            <component :is="moduleIcons[item.module]" :size="16" aria-hidden="true" />
            {{ moduleLabels[item.module] }}
          </span>
          <RouterLink class="studio-collection-detail__content" :to="`/studio/${item.module}/${item.id}/edit`">
            <strong>{{ item.title || `未命名${itemLabels[item.module]}` }}</strong>
            <small>{{ statusLabel(item.status) }} · 更新于 {{ formatDate(item.updated_at) }}</small>
          </RouterLink>
          <div class="studio-collection-detail__actions">
            <PButton
              type="button"
              variant="ghost"
              size="sm"
              :disabled="reordering || index === 0"
              :aria-label="`上移${item.title || itemLabels[item.module]}`"
              :title="`上移${item.title || itemLabels[item.module]}`"
              @click="moveItem(index, -1)"
            >
              <ChevronUp :size="17" aria-hidden="true" />
            </PButton>
            <PButton
              type="button"
              variant="ghost"
              size="sm"
              :disabled="reordering || index === items.length - 1"
              :aria-label="`下移${item.title || itemLabels[item.module]}`"
              :title="`下移${item.title || itemLabels[item.module]}`"
              @click="moveItem(index, 1)"
            >
              <ChevronDown :size="17" aria-hidden="true" />
            </PButton>
          </div>
        </li>
      </ol>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowLeft, ChevronDown, ChevronUp, FileText, Mic2, Video } from 'lucide-vue-next'
import { RouterLink, useRoute } from 'vue-router'

import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import { useStudioStore } from '@/stores/studio'
import type { StudioCollectionContentItem, StudioContentStatus } from '@/types'

const route = useRoute()
const studio = useStudioStore()
const loading = ref(true)
const error = ref('')
const actionError = ref('')
const reordering = ref(false)
const collectionID = computed(() => String(route.params.id || ''))
const collection = computed(() => studio.unifiedCollections.find(item => item.id === collectionID.value))
const items = computed(() => (
  studio.unifiedCollectionContentsCollectionID === collectionID.value
    ? studio.unifiedCollectionContents
    : []
))
const moduleIcons = { blog: FileText, podcast: Mic2, video: Video }
const moduleLabels = { blog: '博客', podcast: '播客', video: '视频' } as const
const itemLabels = { blog: '文章', podcast: '单集', video: '视频' } as const

async function load() {
  loading.value = true
  error.value = ''
  actionError.value = ''
  try {
    await studio.loadState()
    if (!studio.currentChannel) return
    await Promise.all([
      studio.loadUnifiedCollections(),
      studio.loadUnifiedCollectionContents(collectionID.value),
    ])
    if (!collection.value) error.value = '合集不存在或不属于当前频道'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    loading.value = false
  }
}

async function moveItem(index: number, direction: -1 | 1) {
  const target = index + direction
  if (reordering.value || target < 0 || target >= items.value.length) return
  const ordered = [...items.value]
  ;[ordered[index], ordered[target]] = [ordered[target], ordered[index]]
  reordering.value = true
  actionError.value = ''
  try {
    await studio.reorderUnifiedCollectionContents(
      collectionID.value,
      ordered.map(item => item.content_id),
    )
  } catch (cause) {
    actionError.value = cause instanceof Error ? cause.message : '排序保存失败'
  } finally {
    reordering.value = false
  }
}

function statusLabel(status: StudioContentStatus) {
  return { published: '已发布', scheduled: '定时发布', draft: '草稿' }[status]
}

function formatDate(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? '未知时间'
    : parsed.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

onMounted(load)
watch(collectionID, () => { void load() })
watch(() => studio.currentChannel?.id, (current, previous) => {
  if (current && current !== previous) void load()
})
</script>

<style scoped>
.studio-collection-detail { display: grid; gap: 1.5rem; max-width: 60rem; }
.studio-collection-detail__back { min-height: 2.75rem; display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; padding: 0 0.875rem; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-control); color: var(--a-color-text); text-decoration: none; }
.studio-collection-detail__back:hover { border-color: var(--a-color-primary); color: var(--a-color-primary); }
.studio-collection-detail__back:focus-visible, .studio-collection-detail__content:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 2px; }
.studio-collection-detail__message { margin: 0; padding: 1.5rem 0; color: var(--a-color-muted); }
.studio-collection-detail__message--error { color: var(--a-color-danger); }
.studio-collection-detail__list { display: grid; gap: 0; margin: 0; padding: 0; border-top: 1px solid var(--a-color-border-soft); list-style: none; }
.studio-collection-detail__list li { min-width: 0; display: grid; grid-template-columns: 2rem 5rem minmax(0, 1fr) auto; align-items: center; gap: 0.75rem; min-height: 4.25rem; border-bottom: 1px solid var(--a-color-border-soft); }
.studio-collection-detail__position { color: var(--a-color-muted); font-size: 0.75rem; font-variant-numeric: tabular-nums; text-align: center; }
.studio-collection-detail__module { display: inline-flex; align-items: center; gap: 0.35rem; color: var(--a-color-muted); font-size: 0.75rem; white-space: nowrap; }
.studio-collection-detail__content { min-width: 0; display: grid; gap: 0.15rem; color: var(--a-color-text); text-decoration: none; }
.studio-collection-detail__content:hover { color: var(--a-color-primary); }
.studio-collection-detail__content strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.studio-collection-detail__content small { color: var(--a-color-muted); font-size: 0.75rem; }
.studio-collection-detail__actions { display: flex; gap: 0.25rem; }
.studio-collection-detail__actions :deep(.p-button) { min-width: 2.75rem; min-height: 2.75rem; padding: 0; }
@media (max-width: 560px) {
  .studio-collection-detail :deep(.p-page-header__action) { width: 100%; }
  .studio-collection-detail__back { width: 100%; }
  .studio-collection-detail__list li { grid-template-columns: 1.5rem minmax(0, 1fr) auto; gap: 0.5rem; min-height: 5rem; }
  .studio-collection-detail__module { grid-column: 2; }
  .studio-collection-detail__content { grid-column: 2; }
  .studio-collection-detail__actions { grid-column: 3; grid-row: 1 / span 2; }
}
</style>
