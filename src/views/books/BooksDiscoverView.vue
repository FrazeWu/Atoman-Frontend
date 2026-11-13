<template>
  <section class="book-catalog">
    <PPageHeader title="发现图书" sub="收录经典著作与学术文献，探索人类思想谱系。" />

    <!-- 统一工具栏：分类过滤与搜索排布 -->
    <div class="book-discover__controls">
      <!-- 左侧：图书/榜单切换 + 筛选触发按钮 -->
      <div class="book-discover__controls-left">
        <div class="p-segmented-control" role="tablist">
          <RouterLink
            :to="{ path: '/books' }"
            class="p-segmented-item"
            :class="{ active: !ranked }"
            role="tab"
            :aria-selected="!ranked"
          >
            全部图书
          </RouterLink>
          <RouterLink
            :to="{ path: '/books', query: { sort: 'high-rated' } }"
            class="p-segmented-item"
            :class="{ active: ranked }"
            role="tab"
            :aria-selected="ranked"
          >
            高分榜
          </RouterLink>
        </div>

        <button
          v-if="!ranked && route.query.type !== 'people'"
          type="button"
          class="book-discover__filter-toggle"
          :class="{ 'is-active': activeFilterCount > 0, 'is-expanded': facetsExpanded }"
          :aria-expanded="facetsExpanded"
          aria-label="展开筛选工具栏"
          @click="facetsExpanded = !facetsExpanded"
        >
          <SlidersHorizontal :size="14" aria-hidden="true" />
          <span>筛选</span>
          <span v-if="activeFilterCount > 0" class="book-discover__filter-badge">{{ activeFilterCount }}</span>
        </button>
      </div>

      <!-- 右侧：统一搜索栏 (Option 1A) 与添加操作 -->
      <div class="book-discover__search-area">
        <PUnifiedSearchBar
          v-model="query"
          v-model:scope="searchType"
          module="books"
          :types="selectedTypes"
          variant="bar"
          size="sm"
          :scopes="searchScopes"
          placeholder="输入书名、作者或关键词..."
          action-button-text="搜索"
          class="book-discover__search-bar"
          @search="search"
        />
        <PButton
          size="sm"
          class="book-discover__add-btn"
          :to="auth.isAuthenticated ? { path: '/books/new', query: route.query } : { path: '/login', query: { redirect: '/books/new' } }"
        >
          添加图书
        </PButton>
      </div>
    </div>

    <!-- Cupertino 分面筛选面板 (仅在全部图书主视图且展开时呈现) -->
    <transition name="facet-drawer">
      <div v-if="!ranked && route.query.type !== 'people' && facetsExpanded" class="book-discover__facets-panel" role="region" aria-label="图书分面筛选">
        <!-- 语言分面 -->
        <div class="book-discover__facet-group">
          <span class="book-discover__facet-title">语言</span>
          <div class="book-discover__facet-capsules" role="radiogroup" aria-label="按作品语言筛选">
            <button
              type="button"
              class="book-discover__capsule"
              :class="{ 'is-selected': !activeLang }"
              role="radio"
              :aria-checked="!activeLang"
              @click="setLanguage('')"
            >
              全部
            </button>
            <button
              v-for="item in facetLanguages"
              :key="item.key"
              type="button"
              class="book-discover__capsule"
              :class="{ 'is-selected': activeLang === item.key }"
              role="radio"
              :aria-checked="activeLang === item.key"
              @click="setLanguage(item.key)"
            >
              <span>{{ item.label }}</span>
              <span class="book-discover__capsule-badge">{{ item.count }}</span>
            </button>
          </div>
        </div>

        <!-- 年代分面 -->
        <div class="book-discover__facet-group">
          <span class="book-discover__facet-title">年代</span>
          <div class="book-discover__facet-capsules" role="radiogroup" aria-label="按出版年代筛选">
            <button
              type="button"
              class="book-discover__capsule"
              :class="{ 'is-selected': !activeEra }"
              role="radio"
              :aria-checked="!activeEra"
              @click="setEra('')"
            >
              全部
            </button>
            <button
              v-for="item in facetDecades"
              :key="item.key"
              type="button"
              class="book-discover__capsule"
              :class="{ 'is-selected': activeEra === item.key }"
              role="radio"
              :aria-checked="activeEra === item.key"
              @click="setEra(item.key)"
            >
              <span>{{ item.label }}</span>
              <span class="book-discover__capsule-badge">{{ item.count }}</span>
            </button>
          </div>
        </div>

        <!-- 评分分面 -->
        <div class="book-discover__facet-group">
          <span class="book-discover__facet-title">评分</span>
          <div class="book-discover__facet-capsules" role="radiogroup" aria-label="按最低评分筛选">
            <button
              type="button"
              class="book-discover__capsule"
              :class="{ 'is-selected': !activeRating }"
              role="radio"
              :aria-checked="!activeRating"
              @click="setRating('')"
            >
              全部
            </button>
            <button
              v-for="item in facetRatings"
              :key="item.key"
              type="button"
              class="book-discover__capsule"
              :class="{ 'is-selected': activeRating === item.key }"
              role="radio"
              :aria-checked="activeRating === item.key"
              @click="setRating(item.key)"
            >
              <span>{{ item.label }}</span>
              <span class="book-discover__capsule-badge">{{ item.count }}</span>
            </button>
          </div>
        </div>

        <!-- 重置操作 -->
        <div v-if="activeFilterCount > 0" class="book-discover__facet-reset">
          <button
            type="button"
            class="book-discover__reset-btn"
            @click="resetFilters"
          >
            <RotateCcw :size="12" aria-hidden="true" />
            <span>重置筛选</span>
          </button>
        </div>
      </div>
    </transition>

    <!-- 错误重试状态 -->
    <div v-if="error" role="alert" class="book-catalog__error-box">
      <p class="book-catalog__error">{{ error }}</p>
      <PButton variant="secondary" @click="load">重试</PButton>
    </div>

    <!-- 加载中状态 -->
    <div v-else-if="loading" class="book-catalog__grid" role="status" aria-label="正在加载图书">
      <PSkeletonCard v-for="n in 12" :key="n" aspect="3/4" />
    </div>

    <!-- 主体内容 -->
    <template v-else>
      <!-- 高分榜单视图 -->
      <template v-if="ranked">
        <p class="book-discover__meta-note">按加权评分与读者研读热度综合排序。</p>
        <PEmpty v-if="!rankings.length" title="未找到相关书籍" description="尝试更换分类或调整筛选条件" />
        <ul v-else class="book-catalog__list">
          <li v-for="item in rankings" :key="item.work_id" class="book-catalog__row">
            <RouterLink :to="`/books/work/${item.work_id}`">{{ item.title }}</RouterLink>
            <span>加权评分 {{ item.weighted_rating_score }} · {{ item.rating_count }} 人研读</span>
          </li>
        </ul>
      </template>

      <!-- 作者检索视图 -->
      <template v-else-if="route.query.type === 'people'">
        <p class="book-discover__meta-note">{{ total }} 位作者</p>
        <PEmpty v-if="!people.length" title="未找到作者" description="试试输入其他姓名或关键词" />
        <ul v-else class="book-catalog__list">
          <li v-for="person in people" :key="person.id" class="book-catalog__row">
            <strong>{{ person.name }}</strong>
            <p>{{ person.description || '作者简介待补充' }}</p>
            <PButton variant="ghost" :to="{ path: '/books', query: { q: person.name } }">查看相关作品</PButton>
            <BookWikiPanel kind="person" :entity-id="person.id" :authenticated="auth.isAuthenticated" />
          </li>
        </ul>
      </template>

      <!-- 作品书库网格视图（核心主视图） -->
      <template v-else>
        <div class="book-discover__count-row">
          <span class="book-discover__total-count">{{ total }} 本图书</span>
        </div>
        <PEmpty
          v-if="!works.length"
          class="book-catalog__empty book-discover__empty-state"
          align="center"
          :title="route.query.q ? '没有找到相关图书' : '暂无收录图书'"
          :description="route.query.q ? '没有找到图书，试试其他关键词，或添加这本书。' : '还没有图书，添加第一本书即可公开展示。'"
        >
          <template #icon><BookOpen :size="26" :stroke-width="1.5" aria-hidden="true" /></template>
          <template v-if="!route.query.q" #action>
            <PButton
              size="sm"
              :to="auth.isAuthenticated ? { path: '/books/new', query: route.query } : { path: '/login', query: { redirect: '/books/new' } }"
            >添加第一本图书</PButton>
          </template>
        </PEmpty>
        <ul v-else class="book-catalog__grid">
          <li v-for="(work, index) in works" :key="work.id">
            <BookCard :work="work" :eager="index < 6" />
          </li>
        </ul>
      </template>
    </template>

    <PaginationBar
      :meta="{ page, page_size: 24, total, has_more: page * 24 < total }"
      :loading="loading"
      @change="changePage"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { searchLocation, unifiedSearchEnabled } from '@/utils/searchUrl'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { BookOpen, RotateCcw, SlidersHorizontal } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import {
  catalogRevision,
  getCatalogWorkFacets,
  searchCatalogWorks,
  type BookWorkFacetsResult,
  type CatalogFilterParams,
} from '@/api/bookCatalog'
import { highRatedWorks, type WorkRating } from '@/api/bookCommunity'
import { searchWikiPeople } from '@/api/bookWiki'
import BookWikiPanel from '@/components/books/BookWikiPanel.vue'
import BookCard from '@/components/books/BookCard.vue'
import type { BookPublicWork } from '@/api/books'
import PButton from '@/components/ui/PButton.vue'
import PUnifiedSearchBar from '@/components/search/PUnifiedSearchBar.vue'
import type { SearchScopeOption } from '@/components/ui/PSearchInput.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PSkeletonCard from '@/components/ui/PSkeletonCard.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import './bookCatalog.css'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const query = ref('')
const searchType = ref('works')
const selectedTypes = computed(() => {
  if (searchType.value === 'people') return ['author']
  if (searchType.value === 'lists') return ['book_list']
  return ['work']
})
const searchScopes: SearchScopeOption[] = [
  { label: '图书', value: 'works' },
  { label: '作者', value: 'people' },
  { label: '书单', value: 'lists' },
]
const people = ref<{ id: string; name: string; description?: string }[]>([])
const page = computed(() => Math.max(1, Math.floor(Number(route.query.page) || 1)))
const works = ref<BookPublicWork[]>([])
const rankings = ref<(WorkRating & { work_id: string; title: string })[]>([])
const ranked = computed(() => route.query.sort === 'high-rated' && route.query.type !== 'people')
const total = ref(0)
const loading = ref(false)
const error = ref('')
let request: AbortController | undefined
let generation = 0

// 分面筛选状态
const facetsExpanded = ref(Boolean(route.query.lang || route.query.era || route.query.rating))
const facetsData = ref<BookWorkFacetsResult>({
  languages: [],
  decades: [],
  ratings: [],
})

const activeLang = computed(() => String(route.query.lang || ''))
const activeEra = computed(() => String(route.query.era || ''))
const activeRating = computed(() => String(route.query.rating || ''))

const activeFilterCount = computed(() => {
  let count = 0
  if (activeLang.value) count++
  if (activeEra.value) count++
  if (activeRating.value) count++
  return count
})

const facetLanguages = computed(() => facetsData.value.languages)
const facetDecades = computed(() => facetsData.value.decades)
const facetRatings = computed(() => facetsData.value.ratings)

function eraToYears(era: string): { yearFrom?: number; yearTo?: number } {
  if (era === '2020s') return { yearFrom: 2020, yearTo: 2029 }
  if (era === '2010s') return { yearFrom: 2010, yearTo: 2019 }
  if (era === '2000s') return { yearFrom: 2000, yearTo: 2009 }
  if (era === 'classic') return { yearTo: 1999 }
  return {}
}

function ratingToMin(rating: string): number | undefined {
  if (rating === '9+') return 9.0
  if (rating === '8+') return 8.0
  if (rating === '7+') return 7.0
  return undefined
}

function setLanguage(val: string) {
  void router.push({
    path: '/books',
    query: {
      ...route.query,
      lang: val || undefined,
      page: undefined,
    },
  })
}

function setEra(val: string) {
  void router.push({
    path: '/books',
    query: {
      ...route.query,
      era: val || undefined,
      page: undefined,
    },
  })
}

function setRating(val: string) {
  void router.push({
    path: '/books',
    query: {
      ...route.query,
      rating: val || undefined,
      page: undefined,
    },
  })
}

function resetFilters() {
  void router.push({
    path: '/books',
    query: {
      ...route.query,
      lang: undefined,
      era: undefined,
      rating: undefined,
      page: undefined,
    },
  })
}

async function load() {
  request?.abort()
  request = new AbortController()
  const current = ++generation
  loading.value = true
  error.value = ''
  try {
    if (route.query.type === 'people') {
      const result = await searchWikiPeople(String(route.query.q || ''), (page.value - 1) * 24, 24)
      if (current !== generation) return
      people.value = result.items
      total.value = result.total
      return
    }
    if (ranked.value) {
      const result = await highRatedWorks((page.value - 1) * 24)
      if (current !== generation) return
      rankings.value = result.items
      total.value = result.total
      return
    }
    const searchPromise = activeFilterCount.value > 0
      ? searchCatalogWorks(
          String(route.query.q || ''),
          24,
          (page.value - 1) * 24,
          {
            language: activeLang.value || undefined,
            minRating: ratingToMin(activeRating.value),
            yearFrom: eraToYears(activeEra.value).yearFrom,
            yearTo: eraToYears(activeEra.value).yearTo,
          },
          request.signal,
        )
      : searchCatalogWorks(
          String(route.query.q || ''),
          24,
          (page.value - 1) * 24,
          request.signal,
        )

    const [result, facets] = await Promise.all([
      searchPromise,
      getCatalogWorkFacets(String(route.query.q || ''), request.signal).catch(() => ({ languages: [], decades: [], ratings: [] })),
    ])
    if (current !== generation) return
    works.value = result.items
    total.value = result.total
    if (facets) {
      facetsData.value = facets
    }
  } catch (err: unknown) {
    if ((err as any)?.name === 'AbortError' || (err as any)?.code === 20 || (err instanceof Error && err.name === 'AbortError')) {
      return
    }
    console.error('[BooksDiscoverView load error]', err)
    if (current === generation) {
      error.value = '图书加载失败，请重试。'
    }
  } finally {
    if (current === generation) loading.value = false
  }
}
function search() {
  if (unifiedSearchEnabled) {
    void router.push(searchLocation(query.value, 'books', [searchType.value === 'people' ? 'author' : searchType.value === 'lists' ? 'book_list' : 'work']))
    return
  }
  void router.push({
    path: searchType.value === 'lists' ? '/books/lists' : '/books',
    query: {
      ...(query.value.trim() ? { q: query.value.trim() } : {}),
      ...(searchType.value === 'people' ? { type: 'people' } : {}),
    },
  })
}

function changePage(value: number) {
  void router.push({ path: '/books', query: { ...route.query, page: value > 1 ? String(value) : undefined } })
}

// 打开详情不重新挂载发现页；搜索与分页仍由 URL 恢复。
watch(
  [
    () => route.query.q,
    () => route.query.page,
    () => route.query.sort,
    () => route.query.type,
    () => route.query.lang,
    () => route.query.era,
    () => route.query.rating,
    () => catalogRevision.value,
  ],
  () => {
    query.value = String(route.query.q || '')
    searchType.value = route.query.type === 'people' ? 'people' : 'works'
    if (route.query.lang || route.query.era || route.query.rating) {
      facetsExpanded.value = true
    }
    void load()
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  generation++
  request?.abort()
})
</script>

<style scoped>
.book-discover__empty-state {
  box-sizing: border-box;
  min-height: clamp(16rem, 33vh, 23rem);
  margin-block: 1.25rem 1.75rem;
  padding: 2.5rem 2rem;
  align-content: center;
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.02);
}

.book-discover__empty-state :deep(.p-empty__icon) {
  width: 3.5rem;
  height: 3.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  background: var(--a-color-bg, #ffffff);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  color: var(--a-color-text-secondary, #64748b);
}

.book-discover__empty-state :deep(.p-empty__description) {
  max-width: 32rem;
  text-align: center;
}

.book-discover__controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-block: 1.25rem;
}

.book-discover__controls-left {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  flex-wrap: wrap;
}

.book-discover__filter-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  height: 1.875rem;
  padding: 0 0.625rem;
  border-radius: 6px;
  border: 1px solid var(--a-color-border-soft, rgba(0, 0, 0, 0.08));
  background: var(--a-color-bg, #ffffff);
  color: var(--a-color-text-secondary, #64748b);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
}

.book-discover__filter-toggle:hover {
  color: var(--a-color-text, #0f172a);
  background: var(--a-color-surface-hover, rgba(0, 0, 0, 0.02));
}

.book-discover__filter-toggle.is-active,
.book-discover__filter-toggle.is-expanded {
  color: var(--a-color-text, #0f172a);
  border-color: var(--a-color-text, #0f172a);
}

.book-discover__filter-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1rem;
  height: 1rem;
  padding: 0 0.25rem;
  border-radius: 9999px;
  background: var(--a-color-text, #0f172a);
  color: var(--a-color-bg, #ffffff);
  font-size: 0.6875rem;
  font-weight: 600;
  line-height: 1;
}

.book-discover__facets-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  margin-bottom: 1.25rem;
  border-radius: 8px;
  background: var(--a-color-surface-soft, rgba(0, 0, 0, 0.02));
  border: 1px solid var(--a-color-border-soft, rgba(0, 0, 0, 0.06));
}

.book-discover__facet-group {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  flex-wrap: wrap;
}

.book-discover__facet-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--a-color-text-secondary, #64748b);
  width: 2.25rem;
  flex-shrink: 0;
  letter-spacing: 0.02em;
}

.book-discover__facet-capsules {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.book-discover__capsule {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.625rem;
  border-radius: 9999px;
  border: 1px solid transparent;
  background: rgba(0, 0, 0, 0.04);
  color: var(--a-color-text-secondary, #64748b);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
  line-height: 1.2;
}

.book-discover__capsule:hover {
  color: var(--a-color-text, #0f172a);
  background: rgba(0, 0, 0, 0.07);
}

.book-discover__capsule.is-selected {
  background: var(--a-color-text, #0f172a);
  color: var(--a-color-bg, #ffffff);
}

.book-discover__capsule-badge {
  font-size: 0.6875rem;
  opacity: 0.75;
  font-variant-numeric: tabular-nums;
}

.book-discover__capsule.is-selected .book-discover__capsule-badge {
  opacity: 0.9;
}

.book-discover__facet-reset {
  display: flex;
  align-items: center;
  padding-top: 0.375rem;
  border-top: 1px solid var(--a-color-border-soft, rgba(0, 0, 0, 0.04));
}

.book-discover__reset-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: transparent;
  border: none;
  color: var(--a-color-text-secondary, #64748b);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  transition: color 0.15s ease;
}

.book-discover__reset-btn:hover {
  color: var(--a-color-text, #0f172a);
}

.facet-drawer-enter-active,
.facet-drawer-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.facet-drawer-enter-from,
.facet-drawer-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

:root.dark .book-discover__capsule {
  background: rgba(255, 255, 255, 0.06);
}

:root.dark .book-discover__capsule:hover {
  background: rgba(255, 255, 255, 0.1);
}

:root.dark .book-discover__capsule.is-selected {
  background: var(--a-color-text, #f1f5f9);
  color: var(--a-color-bg, #0b0f19);
}

:root.dark .book-discover__filter-toggle {
  border-color: rgba(255, 255, 255, 0.12);
}

:root.dark .book-discover__facets-panel {
  background: rgba(255, 255, 255, 0.02);
  border-color: rgba(255, 255, 255, 0.08);
}

.p-segmented-control {
  display: inline-flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.04);
  padding: 2px;
  border-radius: 6px;
  gap: 2px;
  box-sizing: border-box;
}

.p-segmented-item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.35rem 0.85rem;
  border-radius: 5px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--a-color-text-secondary, #64748b);
  text-decoration: none;
  transition: color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
  user-select: none;
  line-height: 1.2;
}

.p-segmented-item:hover {
  color: var(--a-color-text, #0f172a);
}

.p-segmented-item.active {
  background: var(--a-color-bg, #ffffff);
  color: var(--a-color-text, #0f172a);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 1px rgba(0, 0, 0, 0.04);
}

.book-discover__search-area {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  max-width: 640px;
}

.book-discover__search-bar {
  flex: 1;
  min-width: 200px;
}

.book-discover__search-bar :deep(.p-search-input) {
  height: var(--a-control-height-sm, 2.25rem);
}

.book-discover__add-btn {
  height: var(--a-control-height-sm, 2.25rem);
  flex-shrink: 0;
  border-radius: 6px;
}

.book-discover__count-row {
  display: flex;
  align-items: center;
  margin-bottom: 1.25rem;
}

.book-discover__total-count {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--a-color-text-secondary);
}

.book-discover__meta-note {
  font-size: 0.8125rem;
  color: var(--a-color-text-secondary);
  margin-bottom: 1rem;
}

.book-catalog__error-box {
  padding: 1.5rem;
  margin-block: 1rem;
  border: 1px solid rgba(225, 29, 72, 0.2);
  border-radius: 8px;
  background: rgba(225, 29, 72, 0.04);
}
</style>
