<template>
  <div v-if="currentSourceTitle" data-test="feed-current-source" class="feed-current-source">
    <div class="feed-current-source__main">
      <span class="a-font-meta">当前来源</span>
      <strong>{{ currentSourceTitle }}</strong>
      <span v-if="currentSourceUnreadCount > 0" class="feed-current-source__count a-font-meta">{{ currentSourceUnreadCount }} 未读</span>
    </div>
    <button type="button" data-test="feed-clear-source" class="feed-current-source__clear a-font-meta" @click="emit('clear-source')">返回全部</button>
  </div>

  <div class="feed-actions">
    <form class="feed-search" data-test="feed-search-form" @submit.prevent="emit('search')">
      <input v-model="searchValue" data-test="feed-search-input" class="feed-search__input" type="search" placeholder="搜索标题、来源、摘要" aria-label="搜索订阅内容" />
      <PButton type="submit" label="搜索" />
      <PButton v-if="activeSearchLabel" variant="secondary" data-test="feed-search-clear" label="清空" @click="emit('clear-search')" />
    </form>
    <div class="source-type-filters" aria-label="来源类型筛选"><PSegmentedControl v-model="sourceTypeValue" :options="sourceTypeFilterOptions" /></div>
    <div v-if="authenticated" class="timeline-mode" aria-label="订阅时间线模式"><PSegmentedControl v-model="timelineModeValue" :options="timelineModeOptions" /></div>
    <label v-if="!querySourceId" class="feed-merge-duplicates">
      <input v-model="mergeDuplicatesValue" data-test="feed-merge-duplicates" type="checkbox" @change="emit('update-merge-duplicates')" />
      <span>合并同题</span>
    </label>
    <div v-if="themeFilters.length" class="theme-filters" aria-label="主题筛选">
      <button v-for="theme in themeFilters" :key="theme" type="button" class="theme-filter-btn" :class="{ active: activeTheme === theme }" :data-test="`theme-filter-${theme.toLowerCase()}`" @click="emit('update:activeTheme', activeTheme === theme ? '' : theme)">{{ theme }}</button>
    </div>
    <button v-if="authenticated && timelineMode === 'chronological'" class="filter-toggle-btn" :class="{ active: unreadOnly }" :title="unreadOnly ? '显示全部' : '只看未读'" @click="emit('toggle-unread')"><Filter :size="20" aria-hidden="true" /></button>
    <div v-if="authenticated && timelineMode === 'chronological'" style="width: 2rem" />
    <PButton v-if="authenticated && timelineMode === 'chronological'" variant="secondary" :loading="markingAllRead" loading-text="处理中..." :label="bulkReadLabel" @click="emit('toggle-all-read')" />
  </div>

  <div v-if="hasNewTimelineContent" class="feed-new-content-region" aria-live="polite">
    <button type="button" class="feed-new-content" data-test="feed-new-content" @click="emit('refresh-new-content')"><RefreshCw :size="16" aria-hidden="true" /><span>有新内容，点击刷新</span></button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { IconFilter as Filter, IconRefresh as RefreshCw } from '@tabler/icons-vue'
import PButton from '@/components/ui/PButton.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import type { FeedSourceTypeFilter } from '@/composables/feed/useFeedTimelinePresentation'

const props = defineProps<{
  currentSourceTitle: string
  currentSourceUnreadCount: number
  searchInput: string
  activeSearchLabel: string
  sourceTypeFilter: FeedSourceTypeFilter
  sourceTypeFilterOptions: Array<{ label: string; value: FeedSourceTypeFilter; test: string }>
  querySourceId: string | undefined
  mergeDuplicates: boolean
  themeFilters: string[]
  activeTheme: string
  authenticated: boolean
  timelineMode: 'chronological' | 'priority'
  unreadOnly: boolean
  markingAllRead: boolean
  bulkReadLabel: string
  hasNewTimelineContent: boolean
}>()

const emit = defineEmits<{
  'update:searchInput': [value: string]
  'update:sourceTypeFilter': [value: FeedSourceTypeFilter]
  'update:mergeDuplicates': [value: boolean]
  'update:activeTheme': [value: string]
  'update:timelineMode': [value: 'chronological' | 'priority']
  search: []
  'clear-search': []
  'clear-source': []
  'update-merge-duplicates': []
  'toggle-unread': []
  'toggle-all-read': []
  'refresh-new-content': []
}>()

const searchValue = computed({ get: () => props.searchInput, set: value => emit('update:searchInput', value) })
const sourceTypeValue = computed({ get: () => props.sourceTypeFilter, set: value => emit('update:sourceTypeFilter', value) })
const timelineModeOptions: Array<{
  label: string
  value: 'chronological' | 'priority'
  test: string
}> = [
  { label: '时间线', value: 'chronological', test: 'timeline-mode-chronological' },
  { label: '今日精选', value: 'priority', test: 'timeline-mode-priority' },
]
const timelineModeValue = computed({ get: () => props.timelineMode, set: value => emit('update:timelineMode', value) })
const mergeDuplicatesValue = computed({ get: () => props.mergeDuplicates, set: value => emit('update:mergeDuplicates', value) })
</script>

<style scoped>
.source-type-filters, .timeline-mode, .theme-filters { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.theme-filter-btn { border: 1px solid var(--a-color-border-soft); background: transparent; color: var(--a-color-text); padding: 0.45rem 0.7rem; font-size: 0.72rem; font-weight: 500; cursor: pointer; }
.theme-filter-btn.active { border-style: solid; background: var(--a-color-surface-muted); }
.feed-current-source { display: flex; align-items: center; justify-content: space-between; gap: 1rem; border: 1px solid var(--a-color-border-soft); padding: 0.7rem 0.85rem; margin-bottom: 1rem; background: var(--a-color-surface-muted); }
.feed-current-source__main { display: flex; min-width: 0; align-items: center; gap: 0.65rem; }
.feed-current-source__main strong { min-width: 0; overflow: hidden; font-size: 0.95rem; text-overflow: ellipsis; white-space: nowrap; }
.feed-current-source__count { flex-shrink: 0; color: var(--a-color-muted); }
.feed-current-source__clear { flex-shrink: 0; border: 0; padding: 0; background: transparent; color: var(--a-color-text); cursor: pointer; }
.feed-current-source__clear:hover { text-decoration: underline; text-underline-offset: 0.18em; }
.feed-actions { display: flex; justify-content: flex-end; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
.feed-search { display: grid; grid-template-columns: minmax(12rem, 22rem) auto auto; align-items: center; gap: 0.5rem; margin-right: auto; }
.feed-search__input { min-width: 0; height: 40px; border: 0; border-bottom: 2px solid var(--a-color-text); border-radius: 0; background: var(--a-color-surface); color: var(--a-color-text); font: inherit; padding: 0 0.75rem; outline: none; box-sizing: border-box; }
.feed-search__input:focus { border-bottom-color: var(--a-color-accent-confirm); }
.feed-merge-duplicates { display: inline-flex; align-items: center; gap: 0.45rem; min-height: 2.5rem; color: var(--a-color-muted); font-size: 0.8rem; white-space: nowrap; }
.feed-merge-duplicates input { width: 1rem; height: 1rem; accent-color: var(--a-color-text); }
.filter-toggle-btn { display: flex; align-items: center; justify-content: center; width: 2.5rem; height: 2.5rem; border: none; background: transparent; color: var(--a-color-muted); cursor: pointer; border-radius: var(--a-radius-none, 4px); transition: all 0.2s; }
.filter-toggle-btn:hover, .filter-toggle-btn.active { background: var(--a-color-surface-muted); color: var(--a-color-text); }
.filter-toggle-btn.active { font-weight: bold; }
.feed-new-content-region { margin-bottom: 0.75rem; }
.feed-new-content { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; width: 100%; min-height: 2.75rem; padding: 0.5rem 0.875rem; border: 1px solid var(--a-color-border); border-radius: var(--a-radius-none, 4px); background: var(--a-color-surface-muted); color: var(--a-color-fg); cursor: pointer; font: inherit; font-size: 0.875rem; font-weight: 600; transition: background-color 0.15s ease, color 0.15s ease; }
.feed-new-content:hover { background: var(--a-color-text); color: var(--a-color-bg); }
.feed-new-content:focus-visible { outline: 2px solid var(--a-color-text); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .feed-new-content { transition: none; } }
</style>
