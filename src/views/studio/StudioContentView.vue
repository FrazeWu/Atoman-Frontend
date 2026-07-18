<template>
  <section class="studio-content">
    <header class="studio-content__heading">
      <h2>内容</h2>
      <PButton
        data-testid="create-content"
        :to="createRoute"
        size="sm"
      >
        <Plus :size="16" aria-hidden="true" />
        {{ config.createLabel }}
      </PButton>
    </header>

    <form class="studio-content__filters" role="search" @submit.prevent="applySearch">
      <label class="studio-content__search">
        <span class="sr-only">搜索{{ config.itemLabel }}</span>
        <Search :size="16" aria-hidden="true" />
        <input v-model="searchQuery" type="search" :placeholder="`搜索${config.itemLabel}`">
      </label>

      <label>
        <span class="sr-only">状态</span>
        <select
          data-testid="status-filter"
          :value="filters.status"
          aria-label="状态"
          @change="updateFilter('status', selectValue($event))"
        >
          <option value="">全部状态</option>
          <option value="published">已发布</option>
          <option value="draft">草稿</option>
        </select>
      </label>

      <label>
        <span class="sr-only">可见范围</span>
        <select
          :value="filters.visibility"
          aria-label="可见范围"
          @change="updateFilter('visibility', selectValue($event))"
        >
          <option value="">全部范围</option>
          <option value="public">公开</option>
          <option value="subscribers">订阅者</option>
          <option value="private">私密</option>
        </select>
      </label>

      <div class="studio-content__collection-filter">
        <label>
          <span class="sr-only">合集</span>
          <select
            data-testid="collection-filter"
            :value="filters.collection_id"
            aria-label="合集"
            @change="updateFilter('collection_id', selectValue($event))"
          >
            <option value="">全部合集</option>
            <option v-for="collection in studio.collections[module]" :key="collection.id" :value="collection.id">
              {{ collection.name }}
            </option>
          </select>
        </label>
        <button
          class="studio-content__icon-button"
          type="button"
          data-testid="manage-collections"
          aria-label="管理合集"
          title="管理合集"
          @click="collectionSheetOpen = true"
        >
          <Settings2 :size="18" aria-hidden="true" />
        </button>
      </div>
    </form>

    <p v-if="loading" class="studio-content__message">加载中...</p>
    <p v-else-if="error" class="studio-content__message" role="alert">{{ error }}</p>
    <StudioContentTable
      v-else
      :items="studio.contents[module]"
      :module="module"
      :pagination="studio.contentPagination[module]"
      @page="changePage"
    />

    <StudioCollectionSheet
      :show="collectionSheetOpen"
      :module="module"
      @close="collectionSheetOpen = false"
      @changed="reloadContents"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Plus, Search, Settings2 } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'

import StudioCollectionSheet from '@/components/studio/StudioCollectionSheet.vue'
import StudioContentTable from '@/components/studio/StudioContentTable.vue'
import PButton from '@/components/ui/PButton.vue'
import { studioModules } from '@/config/studioModules'
import { useStudioStore } from '@/stores/studio'
import type { StudioContentFilters, StudioModule } from '@/types'

const route = useRoute()
const router = useRouter()
const studio = useStudioStore()
const module = computed(() => route.params.module as StudioModule)
const config = computed(() => studioModules[module.value])
const loading = ref(true)
const error = ref('')
const collectionSheetOpen = ref(false)
const searchQuery = ref('')
const ready = ref(false)

function queryString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function queryPage(value: unknown) {
  const page = Number(queryString(value))
  return Number.isInteger(page) && page > 0 ? page : 1
}

const filters = computed<StudioContentFilters>(() => ({
  q: queryString(route.query.q),
  status: queryString(route.query.status) === 'published' || queryString(route.query.status) === 'draft'
    ? queryString(route.query.status) as StudioContentFilters['status']
    : '',
  visibility: ['public', 'subscribers', 'private'].includes(queryString(route.query.visibility))
    ? queryString(route.query.visibility) as StudioContentFilters['visibility']
    : '',
  collection_id: queryString(route.query.collection_id),
  page: queryPage(route.query.page),
}))

const createRoute = computed(() => ({
  path: `/studio/${module.value}/new`,
  query: filters.value.collection_id ? { collection: filters.value.collection_id } : undefined,
}))

function selectValue(event: Event) {
  return (event.target as HTMLSelectElement).value
}

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

async function loadPage(loadCollections = false) {
  if (!studio.currentChannel) return
  loading.value = true
  error.value = ''
  try {
    const requests: Promise<void>[] = [studio.loadContents(module.value, filters.value)]
    if (loadCollections) requests.push(studio.loadCollections(module.value))
    await Promise.all(requests)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  searchQuery.value = filters.value.q
  try {
    await studio.loadState()
    await loadPage(true)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '加载失败'
    loading.value = false
  } finally {
    ready.value = true
  }
})

watch(
  () => route.fullPath,
  () => {
    searchQuery.value = filters.value.q
    if (ready.value) void loadPage()
  },
)

watch(module, () => {
  if (ready.value) void loadPage(true)
})
</script>

<style scoped>
.studio-content { display: grid; gap: 1rem; }
.studio-content__heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.studio-content h2, .studio-content__message { margin: 0; }
.studio-content h2 { font-size: 1.125rem; }
.studio-content__filters { display: grid; grid-template-columns: minmax(12rem, 1fr) repeat(3, minmax(9rem, auto)); gap: 0.625rem; align-items: center; }
.studio-content__search { min-height: 44px; display: flex; align-items: center; gap: 0.5rem; padding: 0 0.75rem; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-control); background: var(--a-color-bg); }
.studio-content__search:focus-within { outline: 2px solid color-mix(in srgb, var(--a-color-primary) 24%, transparent); outline-offset: 1px; border-color: var(--a-color-primary); }
.studio-content__search input { min-width: 0; width: 100%; border: 0; outline: 0; background: transparent; color: var(--a-color-text); font: inherit; }
.studio-content select { min-height: 44px; width: 100%; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-control); background: var(--a-color-bg); color: var(--a-color-text); padding: 0 2rem 0 0.75rem; font: inherit; }
.studio-content select:focus-visible, .studio-content__icon-button:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 2px; }
.studio-content__collection-filter { display: grid; grid-template-columns: minmax(8rem, 1fr) 44px; gap: 0.5rem; }
.studio-content__icon-button { width: 44px; height: 44px; display: inline-grid; place-items: center; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-control); background: var(--a-color-bg); color: var(--a-color-text); cursor: pointer; }
.studio-content__icon-button:hover { background: var(--a-color-surface-muted); }
.studio-content__message { color: var(--a-color-muted); padding: 2rem 0; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
@media (max-width: 900px) {
  .studio-content__filters { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .studio-content__search { grid-column: 1 / -1; }
}
@media (max-width: 560px) {
  .studio-content__heading { align-items: flex-start; }
  .studio-content__filters { grid-template-columns: 1fr; }
  .studio-content__search { grid-column: auto; }
}
</style>
