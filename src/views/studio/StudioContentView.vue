<template>
  <section class="studio-content">
    <header class="studio-content__heading">
      <div>
        <h2>内容</h2>
        <p>查看、筛选并管理{{ config.itemLabel }}。</p>
      </div>
      <div class="studio-content__heading-meta">
        <span v-if="studio.contentPagination[module]?.total !== undefined">
          共 {{ studio.contentPagination[module]?.total ?? 0 }} 条
        </span>
        <PButton
          v-if="canCreate"
          data-testid="create-content"
          :to="createRoute"
          size="sm"
        >
          <Plus :size="16" aria-hidden="true" />
          {{ config.createLabel }}
        </PButton>
      </div>
    </header>

    <form class="studio-content__filters" role="search" @submit.prevent="applySearch">
      <div class="studio-content__filter-label">筛选</div>
      <div class="studio-content__search">
        <span class="sr-only">搜索{{ config.itemLabel }}</span>
        <Search :size="16" aria-hidden="true" />
        <PInput v-model="searchQuery" type="search" :aria-label="`搜索${config.itemLabel}`" :placeholder="`搜索${config.itemLabel}`" />
      </div>

      <PSelect
        class="studio-content__filter-select"
        data-testid="status-filter"
        :model-value="filters.status"
        label="状态"
        :options="[
          { label: '全部状态', value: '' },
          { label: '已发布', value: 'published' },
          { label: '定时发布', value: 'scheduled' },
          { label: '草稿', value: 'draft' },
        ]"
        @update:model-value="updateFilter('status', String($event))"
      />

      <PSelect
        class="studio-content__filter-select"
        :model-value="filters.visibility"
        label="可见范围"
        :options="[
          { label: '全部范围', value: '' },
          { label: '公开', value: 'public' },
          { label: '订阅者', value: 'subscribers' },
          { label: '私密', value: 'private' },
        ]"
        @update:model-value="updateFilter('visibility', String($event))"
      />

      <PSelect
        class="studio-content__filter-select"
        data-testid="collection-filter"
        :model-value="filters.collection_id"
        label="合集"
        :options="[
          { label: '全部合集', value: '' },
          ...studio.collections[module].map(collection => ({ label: collection.name, value: collection.id })),
        ]"
        @update:model-value="updateFilter('collection_id', String($event))"
      />
    </form>

    <p v-if="loading" class="studio-content__message">加载中...</p>
    <p v-else-if="error" class="studio-content__message" role="alert">{{ error }}</p>
    <PButton v-if="selectedConflictIDs.size" class="studio-content__conflict-action" size="sm" :disabled="mutationBusy || !canResolveSelected" @click="resolveSelectedConflicts">
      <Check :size="16" aria-hidden="true" />
      确认所选合集（{{ selectedConflictIDs.size }}）
    </PButton>
    <StudioContentTable
      :items="studio.contents[module]"
      :module="module"
      :pagination="studio.contentPagination[module]"
      :can-reorder="canReorder"
      @page="changePage"
	  @reorder="reorderContent"
	  @status="updateStatus"
	  @cancel-schedule="cancelSchedule"
	  @share="shareContent"
	  @delete="pendingDelete = $event"
	  @reupload="openReupload"
	  @reprocess="reprocessVideo"
	  @select-conflict="selectConflict"
	  @candidate="selectCandidate"
    >
      <template #empty-action v-if="canCreate">
        <RouterLink class="studio-content__empty-action" :to="createRoute">
          <Plus :size="16" aria-hidden="true" />
          {{ config.createLabel }}
        </RouterLink>
      </template>
    </StudioContentTable>

	<p v-if="actionMessage" class="studio-content__feedback" role="status" aria-live="polite">{{ actionMessage }}</p>
	<p v-if="actionError" class="studio-content__feedback studio-content__feedback--error" role="alert">{{ actionError }}</p>

	<PConfirm
	  :show="pendingDelete !== null"
	  title="删除内容"
	  :message="`确定删除《${pendingDelete?.title || ''}》吗？此操作不可恢复。`"
	  confirm-text="删除"
	  danger
	  :loading="mutationBusy"
	  @confirm="confirmDelete"
	  @cancel="pendingDelete = null"
	/>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Check, Plus, Search } from 'lucide-vue-next'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import StudioContentTable from '@/components/studio/StudioContentTable.vue'
import PButton from '@/components/ui/PButton.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PInput from '@/components/ui/PInput.vue'
import PSelect from '@/components/ui/PSelect.vue'
import { studioModules } from '@/config/studioModules'
import { useStudioStore } from '@/stores/studio'
import { useSiteAccessStore } from '@/stores/siteAccess'
import { useContentLifecycle } from '@/composables/useContentLifecycle'
import type { StudioContentFilters, StudioContentItem, StudioModule, StudioPublishStatus } from '@/types'

const route = useRoute()
const router = useRouter()
const studio = useStudioStore()
const siteAccess = useSiteAccessStore()
const lifecycle = useContentLifecycle()
const module = computed(() => route.params.module as StudioModule)
const config = computed(() => studioModules[module.value])
const publishingFeature = { blog: 'post.create', podcast: 'podcast.publish', video: 'video.publish' } as const
const canCreate = computed(() => siteAccess.isFeatureEnabled(module.value, publishingFeature[module.value]))
const loading = ref(true)
const error = ref('')
const searchQuery = ref('')
const ready = ref(false)
let latestPageRequest = 0
const mutationBusy = ref(false)
const pendingDelete = ref<StudioContentItem | null>(null)
const actionMessage = ref('')
const actionError = ref('')
const selectedConflictIDs = ref(new Set<string>())
const conflictCandidates = ref(new Map<string, string>())
const canResolveSelected = computed(() => [...selectedConflictIDs.value].every(id => conflictCandidates.value.has(id)))

function queryString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function queryPage(value: unknown) {
  const page = Number(queryString(value))
  return Number.isInteger(page) && page > 0 ? page : 1
}

const filters = computed<StudioContentFilters>(() => ({
  q: queryString(route.query.q),
  status: ['published', 'scheduled', 'draft'].includes(queryString(route.query.status))
    ? queryString(route.query.status) as StudioContentFilters['status']
    : '',
  visibility: ['public', 'subscribers', 'private'].includes(queryString(route.query.visibility))
    ? queryString(route.query.visibility) as StudioContentFilters['visibility']
    : '',
  collection_id: queryString(route.query.collection_id),
	...(queryString(route.query.issue) ? { issue: queryString(route.query.issue) } : {}),
  page: queryPage(route.query.page),
}))

const canReorder = computed(() => {
  const pagination = studio.contentPagination[module.value]
  return Boolean(filters.value.collection_id && !pagination?.has_more && (pagination?.page ?? 1) === 1)
})

const createRoute = computed(() => ({
  path: `/studio/${module.value}/new`,
  query: filters.value.collection_id ? { collection: filters.value.collection_id } : undefined,
}))

async function replaceQuery(values: Record<string, string | number>) {
  const query = { ...route.query }
  for (const [key, value] of Object.entries(values)) {
    if (value === '' || (key === 'page' && value === 1)) delete query[key]
    else query[key] = String(value)
  }
  await router.replace({ query })
}

async function updateFilter(key: 'status' | 'visibility' | 'collection_id', value: string) {
  await replaceQuery({ [key]: value, page: 1 })
}

async function applySearch() {
  await replaceQuery({ q: searchQuery.value.trim(), page: 1 })
}

async function changePage(page: number) {
  await replaceQuery({ page })
}

async function reloadContents() {
  if (!studio.currentChannel) return
  await studio.loadContents(module.value, filters.value)
}

async function runMutation(action: () => Promise<void>, success: string) {
  mutationBusy.value = true
  actionError.value = ''
  actionMessage.value = ''
  try {
    await action()
    await reloadContents()
    actionMessage.value = success
  } catch (cause) {
    actionError.value = cause instanceof Error ? cause.message : '操作失败'
  } finally {
    mutationBusy.value = false
  }
}

function selectConflict(item: StudioContentItem, selected: boolean) {
  const next = new Set(selectedConflictIDs.value)
  selected ? next.add(item.id) : next.delete(item.id)
  selectedConflictIDs.value = next
}

function selectCandidate(item: StudioContentItem, collectionID: string) {
  const next = new Map(conflictCandidates.value)
  next.set(item.id, collectionID)
  conflictCandidates.value = next
}

async function resolveSelectedConflicts() {
  const items = [...selectedConflictIDs.value].map(content_id => ({ content_id, collection_id: conflictCandidates.value.get(content_id)! }))
  await runMutation(async () => {
    await studio.resolveCollectionConflicts(module.value, items)
    selectedConflictIDs.value = new Set()
    conflictCandidates.value = new Map()
  }, '合集归属已确认')
}

async function resolveCollectionConflict(item: StudioContentItem, collectionID: string) {
  await runMutation(() => studio.resolveCollectionConflict(module.value, item.id, collectionID), '合集归属已确认')
}

async function reorderContent(item: StudioContentItem, direction: -1 | 1) {
  const index = studio.contents[module.value].findIndex(candidate => candidate.id === item.id)
  const target = index + direction
  if (!canReorder.value || index < 0 || target < 0 || target >= studio.contents[module.value].length || !filters.value.collection_id) return
  const ordered = [...studio.contents[module.value]]
  ;[ordered[index], ordered[target]] = [ordered[target], ordered[index]]
  await runMutation(() => studio.reorderCollectionContents(module.value, filters.value.collection_id, ordered.map(candidate => candidate.id)), '排序已保存')
}

async function updateStatus(item: StudioContentItem, status: StudioPublishStatus) {
  await runMutation(() => studio.updateContentStatus(module.value, item, status), status === 'published' ? '已发布' : '已转为草稿')
}

async function cancelSchedule(item: StudioContentItem) {
  await runMutation(async () => { await lifecycle.cancelSchedule(module.value, item.id) }, '已取消定时发布')
}

async function shareContent(item: StudioContentItem) {
  actionError.value = ''
  try {
    const result = await studio.shareContent(module.value, item.id)
    const url = new URL(result.path, window.location.origin).toString()
    await navigator.clipboard?.writeText(url)
    actionMessage.value = '分享地址已复制'
  } catch (cause) {
    actionError.value = cause instanceof Error ? cause.message : '分享失败'
  }
}

async function confirmDelete() {
  const item = pendingDelete.value
  if (!item) return
  await runMutation(() => studio.deleteContent(module.value, item.id), '已删除')
  pendingDelete.value = null
}

async function openReupload(item: StudioContentItem) {
  await router.push({ path: `/studio/${module.value}/${item.id}/edit`, query: { replace: module.value === 'podcast' ? 'audio' : 'video' } })
}

async function reprocessVideo(item: StudioContentItem) {
  await runMutation(() => studio.reprocessVideo(item.id), '已重新提交处理')
}

async function loadPage(loadCollections = false) {
  if (!studio.currentChannel) return
  const request = ++latestPageRequest
  loading.value = true
  error.value = ''
  try {
    const requests: Promise<void>[] = [studio.loadContents(module.value, filters.value)]
    if (loadCollections) requests.push(studio.loadCollections(module.value))
    await Promise.all(requests)
  } catch (cause) {
    if (request === latestPageRequest) {
      error.value = cause instanceof Error ? cause.message : '加载失败'
    }
  } finally {
    if (request === latestPageRequest) loading.value = false
  }
}

onMounted(async () => {
  searchQuery.value = filters.value.q
  let initialModule = module.value
  let initialPath = route.fullPath
  try {
    await studio.loadState()
    initialModule = module.value
    initialPath = route.fullPath
    await loadPage(true)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '加载失败'
    loading.value = false
  } finally {
    ready.value = true
    if (route.fullPath !== initialPath) void loadPage(module.value !== initialModule)
  }
})

watch(
  () => [module.value, route.fullPath],
  ([currentModule], [previousModule]) => {
    searchQuery.value = filters.value.q
    if (ready.value) void loadPage(currentModule !== previousModule)
  },
)
</script>

<style scoped>
.studio-content { min-width: 0; max-width: 100%; display: grid; gap: 1rem; }
.studio-content__heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; }
.studio-content__heading h2, .studio-content__heading p { margin: 0; }
.studio-content__heading h2 { font-size: 1.25rem; }
.studio-content__heading p { margin-top: 0.25rem; color: var(--a-color-muted); font-size: 0.8125rem; }
.studio-content__heading-meta { display: flex; align-items: center; gap: 0.75rem; }
.studio-content__heading-meta > span { color: var(--a-color-muted); font-size: 0.75rem; font-variant-numeric: tabular-nums; }
.studio-content__filters { position: relative; display: grid; grid-template-columns: minmax(12rem, 1fr) repeat(3, minmax(9rem, auto)); gap: 0.625rem; align-items: center; padding: 0.75rem; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-card); background: var(--a-color-bg); }
.studio-content__filter-label { grid-column: 1 / -1; color: var(--a-color-muted); font-size: 0.75rem; font-weight: 600; }
.studio-content__search { min-height: 44px; display: flex; align-items: center; gap: 0.5rem; padding: 0 0.75rem; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-control); background: var(--a-color-surface); }
.studio-content__search:focus-within { outline: 2px solid color-mix(in srgb, var(--a-color-primary) 24%, transparent); outline-offset: 1px; border-color: var(--a-color-primary); }
.studio-content__search :deep(.p-field) { flex: 1; min-width: 0; }
.studio-content__search :deep(.p-input) { min-width: 0; min-height: 0; width: 100%; border: 0; outline: 0; background: transparent; color: var(--a-color-text); font: inherit; padding: 0; }
.studio-content__search :deep(.p-input:focus) { outline: 0; border-color: transparent; }
.studio-content__filter-select { min-width: 0; }
.studio-content__filter-select :deep(.p-field-label) { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.studio-content__filter-select :deep(.p-select-trigger) { min-height: 44px; }
.studio-content__conflict-action { justify-self: start; }
.studio-content__conflict-action :deep(svg) { flex: 0 0 auto; }
.studio-content__empty-action { display: inline-flex; align-items: center; gap: 0.4rem; min-height: 2.75rem; padding: 0 0.875rem; border: 1px solid var(--a-color-primary); border-radius: var(--a-radius-control); background: var(--a-color-primary); color: var(--a-color-primary-contrast); text-decoration: none; }
.studio-content__empty-action:hover { background: var(--a-color-primary-hover); }
.studio-content__message { color: var(--a-color-muted); padding: 2rem 0; }
.studio-content__feedback { margin: 0; color: var(--a-color-muted); }
.studio-content__feedback--error { color: var(--a-color-danger); }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
@media (max-width: 900px) {
  .studio-content__filters { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .studio-content__search { grid-column: 1 / -1; }
}
@media (max-width: 560px) {
  .studio-content__heading { align-items: flex-start; }
  .studio-content__heading-meta { align-items: flex-end; flex-direction: column; gap: 0.5rem; }
  .studio-content__filters { grid-template-columns: 1fr; }
  .studio-content__filter-label { grid-column: auto; }
  .studio-content__search { grid-column: auto; }
}
</style>
