<template>
  <section class="unified-search a-content-frame" aria-labelledby="search-title">
    <div class="search-header-area">
      <h1 id="search-title" class="search-title">全站搜索</h1>
      <!-- Main Search Form using PUnifiedSearchBar -->
      <form class="search-form" role="search" @submit.prevent="update({ q: draft.trim() })">
        <PUnifiedSearchBar
          v-model="draft"
          :scope="state.scope"
          :module="state.module"
          variant="bar"
          size="lg"
          placeholder="搜索图书、文章、音乐等内容"
          action-button-text="搜索"
          :clearable="true"
          :auto-navigate-on-select="true"
          @search="(q) => update({ q: q.trim() })"
        />
      </form>
    </div>

    <!-- Scopes: public vs mine -->
    <nav class="search-tabs search-tabs--scopes" aria-label="搜索范围">
      <button
        v-for="scope in scopes"
        :key="scope.key"
        type="button"
        class="search-tab-scope-btn"
        :class="{ 'is-active': state.scope === scope.key }"
        :aria-pressed="state.scope === scope.key"
        @click="update({ scope: scope.key, module: '', types: [] }, true)"
      >
        {{ scope.label }}
      </button>
    </nav>

    <!-- Modules tabs -->
    <nav class="search-tabs search-tabs--modules" aria-label="搜索模块">
      <button
        type="button"
        class="search-tab-pill"
        :class="{ 'is-active': !state.module }"
        :aria-pressed="!state.module"
        @click="update({ module: '', types: [] }, true)"
      >
        全部
      </button>
      <button
        v-for="module in search.capabilities.value?.modules"
        :key="module.module"
        type="button"
        class="search-tab-pill"
        :class="{ 'is-active': state.module === module.module }"
        :aria-pressed="state.module === module.module"
        @click="update({ module: module.module, types: [] }, true)"
      >
        {{ module.label }}
      </button>
    </nav>

    <!-- Sub-types tabs (if module selected) -->
    <nav v-if="search.selectedModule.value" class="search-tabs search-tabs--types" aria-label="结果类型">
      <button
        type="button"
        class="search-subtab-pill"
        :class="{ 'is-active': !state.types.length }"
        :aria-pressed="!state.types.length"
        @click="update({ types: [] }, true)"
      >
        全部类型
      </button>
      <button
        v-for="type in search.selectedModule.value.types"
        :key="type.key"
        type="button"
        class="search-subtab-pill"
        :class="{ 'is-active': state.types.includes(type.key) }"
        :aria-pressed="state.types.includes(type.key)"
        @click="update({ types: [type.key] }, true)"
      >
        {{ type.label }}
      </button>
    </nav>

    <!-- Filters & Sort Details Panel -->
    <details v-if="search.capability.value" class="search-filters">
      <summary class="search-filters__summary">
        <span>筛选与排序</span>
      </summary>
      <form class="filter-fields" @submit.prevent="applyFilters">
        <label class="filter-field">
          <span class="filter-label">排序</span>
          <select v-model="sortDraft" class="filter-select" aria-label="排序">
            <option value="">默认排序</option>
            <option v-for="sort in search.capability.value.sorts" :key="sort.key" :value="sort.key">{{ sort.label }}</option>
          </select>
        </label>
        <label v-for="filter in search.capability.value.filters" :key="filter.key" class="filter-field">
          <span class="filter-label">{{ filter.label }}</span>
          <select
            v-if="filter.kind === 'enum' || filter.kind === 'boolean'"
            class="filter-select"
            :aria-label="filter.label"
            :value="filter.multiple ? (filterDraft[filter.key] || []) : (filterDraft[filter.key]?.[0] || '')"
            :multiple="filter.multiple"
            @change="setFilter(filter.key, $event)"
          >
            <option v-if="!filter.multiple" value="">不限</option>
            <template v-if="filter.kind === 'boolean'">
              <option value="true">是</option>
              <option value="false">否</option>
            </template>
            <option v-for="option in filter.options" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
          <input
            v-else
            class="filter-input"
            :aria-label="filter.label"
            :value="filterInput(filter.key, filter.kind === 'date')"
            :type="filter.kind === 'number' ? 'number' : 'text'"
            :inputmode="filter.kind === 'date' ? 'numeric' : undefined"
            :pattern="filter.kind === 'date' ? '[0-9]{4}/[0-9]{2}/[0-9]{2}' : undefined"
            :placeholder="filter.kind === 'date' ? 'YYYY/MM/DD' : filter.multiple ? '多个值用逗号分隔' : filter.kind === 'entity' ? '对象 ID' : ''"
            :min="filter.min"
            :max="filter.max"
            :step="filter.integer ? 1 : 'any'"
            @input="setTextFilter(filter.key, $event)"
          />
        </label>
        <div class="filter-actions">
          <button type="submit" class="filter-btn filter-btn--primary">应用筛选</button>
          <button type="button" class="filter-btn filter-btn--secondary" @click="update({}, true)">清空筛选</button>
        </div>
      </form>
    </details>

    <!-- Search Results / States -->
    <div class="search-content" aria-live="polite" :aria-busy="search.loading.value">
      <!-- Loading message -->
      <div v-if="search.loading.value" class="search-state-message is-loading">
        <Loader2 class="animate-spin w-4 h-4 mr-2 inline" />
        <span>正在搜索…</span>
      </div>

      <!-- Error message -->
      <div v-else-if="search.error.value" class="search-state-message is-error" role="alert">
        <span>{{ search.error.value }}</span>
        <button type="button" class="retry-btn" @click="search.reload">重试</button>
      </div>

      <template v-else-if="search.result.value">
        <div v-if="search.result.value.partial" class="search-notice" role="status">
          <span>部分结果暂不可用，已显示其余结果。</span>
          <button type="button" class="retry-btn" @click="search.reload">重试</button>
        </div>

        <!-- List View -->
        <template v-if="search.result.value.view === 'list'">
          <div class="search-meta">
            <span class="search-meta__total">共 {{ search.result.value.pagination?.total ?? 0 }} 条结果</span>
          </div>
          <SearchResultList :items="search.result.value.items || []" />
          <nav v-if="search.result.value.pagination" class="search-pagination" aria-label="结果分页">
            <button
              type="button"
              class="pagination-btn"
              :disabled="state.page <= 1"
              @click="update({ page: state.page - 1 })"
            >
              上一页
            </button>
            <span class="pagination-page">第 {{ state.page }} 页</span>
            <button
              type="button"
              class="pagination-btn"
              :disabled="!search.result.value.pagination.has_more"
              @click="update({ page: state.page + 1 })"
            >
              下一页
            </button>
          </nav>
        </template>

        <!-- Grouped View -->
        <section v-for="module in groupedModules" :key="module.key" class="search-module-card">
          <h2 class="search-module-card__title">{{ module.label }}</h2>
          <section v-for="group in module.groups" :key="group.type" class="search-group">
            <header class="search-group__header">
              <h3 class="search-group__title">{{ group.label }}</h3>
              <RouterLink
                v-if="group.has_more"
                class="search-group__more-link"
                :to="{ path: '/search', query: writeSearchQuery({ ...state, module: group.module, types: [group.type], page: 1 }) }"
              >
                查看全部{{ group.total === null ? '' : `（${group.total}）` }}
              </RouterLink>
            </header>
            <div v-if="group.error" class="search-group__error">
              <span>此类结果暂不可用。</span>
              <button type="button" class="retry-btn" @click="search.reload">重试</button>
            </div>
            <SearchResultList v-else :items="group.items || []" />
          </section>
        </section>

        <!-- No results -->
        <PEmpty
          v-if="!hasResults && !search.result.value.partial"
          title="未找到匹配结果"
          description="请检查关键词拼写或尝试其他搜索词"
          align="center"
        />
      </template>

      <!-- Initial empty state -->
      <div v-else class="search-state-message is-initial">
        <span>输入关键词开始搜索，或选择模块和类型浏览内容。</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Loader2 } from 'lucide-vue-next'
import PEmpty from '@/components/ui/PEmpty.vue'
import type { SearchScope, SearchState } from '@/api/search'
import { useUnifiedSearch } from '@/composables/useUnifiedSearch'
import { readSearchQuery, writeSearchQuery } from '@/utils/searchUrl'
import SearchResultList from '@/components/search/SearchResultList.vue'
import PUnifiedSearchBar from '@/components/search/PUnifiedSearchBar.vue'

const route = useRoute()
const router = useRouter()
const state = computed(() => readSearchQuery(route.query))
const search = useUnifiedSearch(state)
const draft = ref('')
const sortDraft = ref('')
const filterDraft = ref<Record<string, string[]>>({})
const filterTextDraft = ref<Record<string, string>>({})
const scopes: { key: SearchScope; label: string }[] = [
  { key: 'public', label: '公开内容' },
  { key: 'mine', label: '我的内容' },
]

watch(
  state,
  (value) => {
    draft.value = value.q
    sortDraft.value = value.sort
    filterDraft.value = { ...value.filters }
    filterTextDraft.value = Object.fromEntries(
      Object.entries(value.filters).map(([key, values]) => [key, values.join(', ')])
    )
  },
  { immediate: true }
)

function update(patch: Partial<SearchState>, clearFilters = false) {
  void router.push({
    path: '/search',
    query: writeSearchQuery({
      ...state.value,
      page: 1,
      ...(clearFilters ? { sort: '', filters: {} } : {}),
      ...patch,
    }),
  })
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
  filterDraft.value[key] =
    target instanceof HTMLSelectElement && target.multiple
      ? Array.from(target.selectedOptions, (option) => option.value)
      : target.value
        ? [target.value]
        : []
}

function applyFilters() {
  const filters = { ...filterDraft.value }
  for (const filter of search.capability.value?.filters || []) {
    if (filter.kind === 'enum' || filter.kind === 'boolean') continue
    const value = (filterTextDraft.value[filter.key] || '').trim()
    filters[filter.key] = !value
      ? []
      : filter.multiple
        ? value
            .split(/[,，]/)
            .map((v) => v.trim())
            .filter(Boolean)
        : [filter.kind === 'date' ? value.replaceAll('/', '-') : value]
  }
  update({ sort: sortDraft.value, filters })
}

const groupedModules = computed(() => {
  const groups = search.result.value?.groups || []
  return [...new Set(groups.map((group) => group.module))]
    .map((key) => ({
      key,
      label: search.capabilities.value?.modules.find((module) => module.module === key)?.label || key,
      groups: groups.filter((group) => group.module === key && (group.items?.length || group.error)),
    }))
    .filter((mod) => mod.groups.length > 0)
})

const hasResults = computed(
  () =>
    !!search.result.value?.items?.length ||
    !!search.result.value?.groups?.some((group) => group.items?.length)
)
</script>

<style scoped>
.unified-search {
  width: 100%;
  max-width: 64rem;
  padding: 2.5rem 1.5rem 4rem;
  margin-inline: auto;
  color: var(--a-color-text-primary, #0f172a);
}

.search-header-area {
  margin-bottom: 1.5rem;
}

.search-title {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0 0 1rem;
  color: var(--a-color-text-primary, #0f172a);
}

.search-form {
  width: 100%;
  margin-bottom: 0.75rem;
}

/* Tabs: Scopes, Modules, Types */
.search-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}

.search-tabs--scopes {
  margin-bottom: 0.75rem;
}

.search-tab-scope-btn {
  font-size: 14px;
  font-weight: 500;
  padding: 6px 14px;
  background-color: transparent;
  color: var(--a-color-text-secondary, #64748b);
  border: none;
  border-radius: var(--a-radius-control, 4px);
  cursor: pointer;
  box-shadow: none !important;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.search-tab-scope-btn:hover {
  color: var(--a-color-text-primary, #0f172a);
  background-color: var(--a-color-surface-muted, #f8fafc);
}

.search-tab-scope-btn.is-active,
.search-tab-scope-btn[aria-pressed='true'] {
  color: var(--a-color-primary, #0ea5e9);
  background-color: var(--a-color-surface-muted, #f0f9ff);
  font-weight: 600;
}

.search-tabs--modules {
  margin-bottom: 0.75rem;
}

.search-tab-pill {
  font-size: 13px;
  font-weight: 500;
  padding: 5px 12px;
  background-color: transparent;
  color: var(--a-color-text-secondary, #64748b);
  border: none;
  border-radius: var(--a-radius-control, 4px);
  cursor: pointer;
  box-shadow: none !important;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.search-tab-pill:hover {
  color: var(--a-color-text-primary, #0f172a);
  background-color: var(--a-color-surface-muted, #f8fafc);
}

.search-tab-pill.is-active,
.search-tab-pill[aria-pressed='true'] {
  color: var(--a-color-primary-contrast, #ffffff);
  background-color: var(--a-color-text-primary, #0f172a);
}

.search-tabs--types {
  margin-bottom: 1.25rem;
  padding-left: 4px;
}

.search-subtab-pill {
  font-size: 12px;
  font-weight: 500;
  padding: 4px 10px;
  background-color: transparent;
  color: var(--a-color-text-secondary, #64748b);
  border: none;
  border-radius: var(--a-radius-control, 4px);
  cursor: pointer;
  box-shadow: none !important;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.search-subtab-pill:hover {
  color: var(--a-color-text-primary, #0f172a);
  background-color: var(--a-color-surface-muted, #f8fafc);
}

.search-subtab-pill.is-active,
.search-subtab-pill[aria-pressed='true'] {
  color: var(--a-color-text-primary, #0f172a);
  background-color: var(--a-color-surface-muted, #e2e8f0);
  font-weight: 600;
}

/* Filters Details */
.search-filters {
  background-color: transparent;
  border: none;
  border-radius: var(--a-radius-control, 4px);
  box-shadow: none !important;
  margin-bottom: 1.5rem;
}

.search-filters__summary {
  display: inline-flex;
  align-items: center;
  font-size: 13px;
  font-weight: 500;
  color: var(--a-color-text-secondary, #64748b);
  padding: 6px 12px;
  cursor: pointer;
  user-select: none;
  background-color: var(--a-color-surface-muted, #f8fafc);
  border: none;
  border-radius: var(--a-radius-control, 4px);
  transition: background-color 0.15s ease, color 0.15s ease;
}

.search-filters[open] .search-filters__summary {
  margin-bottom: 8px;
}

.search-filters__summary:hover {
  color: var(--a-color-text-primary, #0f172a);
}

.filter-fields {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px;
  padding: 14px;
  background-color: var(--a-color-surface-muted, #f8fafc);
  border-radius: var(--a-radius-control, 4px);
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 11rem;
}

.filter-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--a-color-text-secondary, #64748b);
}

.filter-select,
.filter-input {
  height: 36px;
  padding: 0 10px;
  font-size: 13px;
  background-color: var(--a-color-bg, #ffffff);
  color: var(--a-color-text-primary, #0f172a);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
  box-shadow: none !important;
  outline: none;
}

.filter-select:focus,
.filter-input:focus {
  border-color: var(--a-color-primary, #0ea5e9);
}

.filter-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 4px;
}

.filter-btn {
  height: 36px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 500;
  border-radius: var(--a-radius-control, 4px);
  cursor: pointer;
  box-shadow: none !important;
  transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
}

.filter-btn--primary {
  background-color: var(--a-color-primary, #0ea5e9);
  color: var(--a-color-primary-contrast, #ffffff);
  border: 1px solid var(--a-color-primary, #0ea5e9);
}

.filter-btn--primary:hover {
  filter: brightness(0.96);
}

.filter-btn--secondary {
  background-color: var(--a-color-bg, #ffffff);
  color: var(--a-color-text-secondary, #64748b);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
}

.filter-btn--secondary:hover {
  background-color: var(--a-color-bg-subtle, #f8fafc);
  color: var(--a-color-text-primary, #0f172a);
}

/* States & Meta */
.search-state-message {
  padding: 3rem 1rem;
  text-align: center;
  font-size: 14px;
  color: var(--a-color-text-secondary, #64748b);
  background-color: transparent;
  border: none;
  box-shadow: none !important;
}

.search-state-message.is-error {
  color: var(--a-color-danger, #ef4444);
  background-color: color-mix(in srgb, var(--a-color-danger, #ef4444) 6%, var(--a-color-bg, #ffffff));
  border: 1px solid color-mix(in srgb, var(--a-color-danger, #ef4444) 20%, var(--a-color-border-soft, #e2e8f0));
  border-radius: var(--a-radius-control, 4px);
}

.search-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  margin-bottom: 1rem;
  font-size: 13px;
  color: var(--a-color-text-secondary, #64748b);
  background-color: var(--a-color-bg-subtle, #f8fafc);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
  box-shadow: none !important;
}

.retry-btn {
  font-size: 12px;
  font-weight: 500;
  padding: 3px 8px;
  background-color: var(--a-color-bg, #ffffff);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
  color: var(--a-color-primary, #0ea5e9);
  cursor: pointer;
  box-shadow: none !important;
}

.retry-btn:hover {
  background-color: var(--a-color-bg-subtle, #f8fafc);
}

.search-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.search-meta__total {
  font-size: 13px;
  font-weight: 500;
  color: var(--a-color-text-secondary, #64748b);
}

/* Grouped Modules */
.search-module-card {
  margin-bottom: 2.25rem;
  background-color: transparent;
  border: none;
  box-shadow: none !important;
  padding: 0;
}

.search-module-card__title {
  font-size: 1.15rem;
  font-weight: 600;
  margin: 0 0 1rem;
  color: var(--a-color-text-primary, #0f172a);
}

.search-group {
  margin-bottom: 1.25rem;
}

.search-group:last-child {
  margin-bottom: 0;
}

.search-group__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
  margin-bottom: 6px;
}

.search-group__title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--a-color-text-secondary, #64748b);
  margin: 0;
}

.search-group__more-link {
  font-size: 12.5px;
  color: var(--a-color-primary, #0ea5e9);
  text-decoration: none;
}

.search-group__more-link:hover {
  text-decoration: underline;
}

.search-group__error {
  font-size: 13px;
  color: var(--a-color-danger, #ef4444);
  padding: 8px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Pagination */
.search-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 1.5rem;
  padding-top: 1rem;
}

.pagination-btn {
  font-size: 13px;
  font-weight: 500;
  padding: 6px 14px;
  background-color: var(--a-color-bg, #ffffff);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
  color: var(--a-color-text-secondary, #64748b);
  cursor: pointer;
  box-shadow: none !important;
  transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
}

.pagination-btn:hover:not(:disabled) {
  background-color: var(--a-color-bg-subtle, #f8fafc);
  color: var(--a-color-text-primary, #0f172a);
  border-color: var(--a-color-border, #cbd5e1);
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-page {
  font-size: 13px;
  color: var(--a-color-text-secondary, #64748b);
}

@media (max-width: 640px) {
  .unified-search {
    padding: 1.25rem 1rem 3rem;
  }
  .search-tabs--modules, .search-tabs--types {
    flex-wrap: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    max-width: 100%;
    overscroll-behavior-inline: contain;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    padding-bottom: 4px;
  }
  .search-tabs--modules::-webkit-scrollbar, .search-tabs--types::-webkit-scrollbar { display: none; }
  .search-tabs--modules > button, .search-tabs--types > button {
    flex: 0 0 auto;
    min-height: 44px;
    white-space: nowrap;
  }
  .search-tab-scope-btn { min-height: 44px; }
  .search-filters__summary { min-height: 44px; }
  .filter-field {
    flex-basis: 100%;
  }
}
</style>
