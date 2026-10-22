<template>
  <section class="unified-search a-content-frame" aria-labelledby="search-title">
    <h1 id="search-title">全站搜索</h1>
    <form class="search-form" role="search" @submit.prevent="update({ q: draft.trim() })">
      <label class="search-input">关键词<input v-model="draft" type="search" maxlength="256" placeholder="搜索图书、文章、音乐等内容"></label>
      <button type="submit">搜索</button>
    </form>
    <nav class="search-tabs" aria-label="搜索范围">
      <button v-for="scope in scopes" :key="scope.key" :aria-pressed="state.scope === scope.key" @click="update({ scope: scope.key, module: '', types: [] }, true)">{{ scope.label }}</button>
    </nav>
    <nav class="search-tabs" aria-label="搜索模块">
      <button :aria-pressed="!state.module" @click="update({ module: '', types: [] }, true)">全部</button>
      <button v-for="module in search.capabilities.value?.modules" :key="module.module" :aria-pressed="state.module === module.module" @click="update({ module: module.module, types: [] }, true)">{{ module.label }}</button>
    </nav>
    <nav v-if="search.selectedModule.value" class="search-tabs" aria-label="结果类型">
      <button :aria-pressed="!state.types.length" @click="update({ types: [] }, true)">全部类型</button>
      <button v-for="type in search.selectedModule.value.types" :key="type.key" :aria-pressed="state.types.includes(type.key)" @click="update({ types: [type.key] }, true)">{{ type.label }}</button>
    </nav>
    <details v-if="search.capability.value" class="search-filters">
      <summary>筛选与排序</summary>
      <form class="filter-fields" @submit.prevent="applyFilters">
        <label>排序<select v-model="sortDraft" aria-label="排序"><option value="">默认排序</option><option v-for="sort in search.capability.value.sorts" :key="sort.key" :value="sort.key">{{ sort.label }}</option></select></label>
        <label v-for="filter in search.capability.value.filters" :key="filter.key">{{ filter.label }}
          <select v-if="filter.kind === 'enum' || filter.kind === 'boolean'" :aria-label="filter.label" :value="filter.multiple ? (filterDraft[filter.key] || []) : (filterDraft[filter.key]?.[0] || '')" :multiple="filter.multiple" @change="setFilter(filter.key, $event)">
            <option v-if="!filter.multiple" value="">不限</option>
            <template v-if="filter.kind === 'boolean'"><option value="true">是</option><option value="false">否</option></template>
            <option v-for="option in filter.options" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
          <input v-else :value="filterInput(filter.key, filter.kind === 'date')" :type="filter.kind === 'number' ? 'number' : 'text'" :inputmode="filter.kind === 'date' ? 'numeric' : undefined" :pattern="filter.kind === 'date' ? '[0-9]{4}/[0-9]{2}/[0-9]{2}' : undefined" :placeholder="filter.kind === 'date' ? 'YYYY/MM/DD' : filter.multiple ? '多个值用逗号分隔' : filter.kind === 'entity' ? '对象 ID' : ''" :min="filter.min" :max="filter.max" :step="filter.integer ? 1 : 'any'" @input="setTextFilter(filter.key, $event)">
        </label>
        <button type="submit">应用筛选</button><button type="button" @click="update({}, true)">清空筛选</button>
      </form>
    </details>
    <div aria-live="polite" :aria-busy="search.loading.value">
      <p v-if="search.loading.value" class="search-message">正在搜索…</p>
      <p v-else-if="search.error.value" role="alert">{{ search.error.value }} <button @click="search.reload">重试</button></p>
      <template v-else-if="search.result.value">
        <p v-if="search.result.value.partial" role="status">部分结果暂不可用，已显示其余结果。<button @click="search.reload">重试</button></p>
        <template v-if="search.result.value.view === 'list'">
          <p>共 {{ search.result.value.pagination?.total ?? 0 }} 条结果</p>
          <SearchResultList :items="search.result.value.items || []" />
          <nav v-if="search.result.value.pagination" class="search-tabs" aria-label="结果分页">
            <button :disabled="state.page <= 1" @click="update({ page: state.page - 1 })">上一页</button>
            <span>第 {{ state.page }} 页</span>
            <button :disabled="!search.result.value.pagination.has_more" @click="update({ page: state.page + 1 })">下一页</button>
          </nav>
        </template>
        <section v-for="module in groupedModules" :key="module.key" class="search-module">
          <h2>{{ module.label }}</h2>
          <section v-for="group in module.groups" :key="group.type" class="search-group">
            <header><h3>{{ group.label }}</h3><RouterLink v-if="group.has_more" :to="{ path: '/search', query: writeSearchQuery({ ...state, module: group.module, types: [group.type], page: 1 }) }">查看全部{{ group.total === null ? '' : `（${group.total}）` }}</RouterLink></header>
            <p v-if="group.error">此类结果暂不可用。<button @click="search.reload">重试</button></p>
            <SearchResultList v-else :items="group.items || []" />
          </section>
        </section>
        <p v-if="!hasResults && !search.result.value.partial" class="search-message">没有匹配的结果，请更换关键词或清空筛选。</p>
      </template>
      <p v-else class="search-message">输入关键词开始搜索，或选择模块和类型浏览内容。</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { SearchScope, SearchState } from '@/api/search'
import { useUnifiedSearch } from '@/composables/useUnifiedSearch'
import { readSearchQuery, writeSearchQuery } from '@/utils/searchUrl'
import SearchResultList from '@/components/search/SearchResultList.vue'

const route = useRoute()
const router = useRouter()
const state = computed(() => readSearchQuery(route.query))
const search = useUnifiedSearch(state)
const draft = ref('')
const sortDraft = ref('')
const filterDraft = ref<Record<string, string[]>>({})
const filterTextDraft = ref<Record<string, string>>({})
const scopes: { key: SearchScope; label: string }[] = [{ key: 'public', label: '公开内容' }, { key: 'mine', label: '我的内容' }]
watch(state, value => {
  draft.value = value.q
  sortDraft.value = value.sort
  filterDraft.value = { ...value.filters }
  filterTextDraft.value = Object.fromEntries(Object.entries(value.filters).map(([key, values]) => [key, values.join(', ')]))
}, { immediate: true })
function update(patch: Partial<SearchState>, clearFilters = false) {
  void router.push({ path: '/search', query: writeSearchQuery({ ...state.value, page: 1, ...(clearFilters ? { sort: '', filters: {} } : {}), ...patch }) })
}
function filterInput(key: string, date: boolean) {
  const value = filterTextDraft.value[key] || ''
  return date ? value.replaceAll('-', '/') : value
}
function setTextFilter(key: string, event: Event) {
  filterTextDraft.value[key] = (event.target as HTMLInputElement).value
}
function setFilter(key: string, event: Event) {
  const target = event.target as HTMLInputElement | HTMLSelectElement
  filterDraft.value[key] = target instanceof HTMLSelectElement && target.multiple
    ? Array.from(target.selectedOptions, option => option.value)
    : target.value ? [target.value] : []
}
function applyFilters() {
  const filters = { ...filterDraft.value }
  for (const filter of search.capability.value?.filters || []) {
    if (filter.kind === 'enum' || filter.kind === 'boolean') continue
    const value = (filterTextDraft.value[filter.key] || '').trim()
    filters[filter.key] = !value ? [] : filter.multiple
      ? value.split(/[,，]/).map(value => value.trim()).filter(Boolean)
      : [filter.kind === 'date' ? value.replaceAll('/', '-') : value]
  }
  update({ sort: sortDraft.value, filters })
}
const groupedModules = computed(() => {
  const groups = search.result.value?.groups || []
  return [...new Set(groups.map(group => group.module))].map(key => ({
    key, label: search.capabilities.value?.modules.find(module => module.module === key)?.label || key,
    groups: groups.filter(group => group.module === key),
  }))
})
const hasResults = computed(() => !!search.result.value?.items?.length || !!search.result.value?.groups?.some(group => group.items?.length))
</script>

<style scoped>
.unified-search { width: 100%; max-width: 72rem; padding: 2rem; margin-inline: auto; color: var(--a-color-fg); }
h1 { font-size: 1.75rem; margin: 0 0 1.5rem; } h2 { font-size: 1.25rem; } h3 { font-size: 1rem; margin: 0; }
.search-form { display: flex; align-items: end; gap: .75rem; margin-bottom: 1rem; }
label { display: grid; gap: .5rem; font-size: .875rem; } .search-input { flex: 1; min-width: 0; }
input, select, button { font: inherit; color: inherit; background: var(--a-color-surface); border: 1px solid var(--a-color-border); border-radius: var(--a-radius-control); min-height: 44px; padding: .5rem .75rem; min-width: 0; }
button { cursor: pointer; } button:disabled { cursor: default; opacity: .5; }
button[aria-pressed='true'] { background: var(--a-color-surface-muted); border-color: currentColor; }
:is(input, select, button, summary, a):focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 3px; }
.search-tabs { display: flex; gap: .5rem; flex-wrap: wrap; align-items: center; margin-bottom: 1rem; }
.search-filters { margin-block: 1rem 2rem; } summary { cursor: pointer; padding-block: .75rem; }
.filter-fields { display: flex; flex-wrap: wrap; align-items: end; gap: 1rem; padding-block: 1rem; }
.filter-fields label { flex: 1 1 12rem; } .search-module { margin-top: 2rem; }
.search-group { margin-bottom: 1.5rem; } .search-group header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding-bottom: .75rem; border-bottom: 1px solid var(--a-color-border); }
.search-message { padding-block: 2rem; color: var(--a-color-muted); }
@media (max-width: 640px) { .unified-search { padding: 1rem; } .filter-fields label { flex-basis: 100%; } }
</style>
