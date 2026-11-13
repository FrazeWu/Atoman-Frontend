<template>
  <div class="mobile-books-discover">
    <!-- Header -->
    <header class="mobile-books-discover__header">
      <div class="mobile-books-discover__title-row">
        <h1 class="mobile-books-discover__title">发现图书</h1>
        <router-link to="/books/shelf" class="mobile-books-discover__shelf-link">
          <MIcon name="shelf" size="sm" />
          <span>我的书架</span>
        </router-link>
      </div>

      <!-- Search Bar -->
      <div class="mobile-books-discover__search">
        <MInput
          v-model="searchQuery"
          placeholder="搜索书名或作者..."
          clearable
          data-testid="books-search-input"
          @keyup.enter="handleSearch"
        />
      </div>

      <!-- Tab Filter Chips & Facet Toggle -->
      <div class="mobile-books-discover__chips-bar">
        <div class="mobile-books-discover__chips">
          <button
            type="button"
            class="mobile-books-discover__chip"
            :class="{ 'is-active': activeFilter === 'all' }"
            @click="setFilter('all')"
          >
            全部图书
          </button>
          <button
            type="button"
            class="mobile-books-discover__chip"
            :class="{ 'is-active': activeFilter === 'ranked' }"
            @click="setFilter('ranked')"
          >
            高分榜
          </button>
        </div>

        <button
          v-if="activeFilter === 'all'"
          type="button"
          class="mobile-books-discover__filter-toggle"
          :class="{ 'is-active': activeFilterCount > 0 || facetsExpanded }"
          aria-label="筛选选项"
          @click="facetsExpanded = !facetsExpanded"
        >
          <span>筛选</span>
          <span v-if="activeFilterCount > 0" class="mobile-books-discover__badge-count">{{ activeFilterCount }}</span>
        </button>
      </div>

      <!-- Faceted Filters Row -->
      <div v-if="activeFilter === 'all' && (facetsExpanded || activeFilterCount > 0)" class="mobile-books-discover__facets-bar">
        <div class="mobile-books-discover__facet-scroll">
          <button
            type="button"
            class="mobile-books-discover__facet-pill"
            :class="{ 'is-selected': !activeLang }"
            @click="toggleLang('')"
          >
            全部语言
          </button>
          <button
            type="button"
            class="mobile-books-discover__facet-pill"
            :class="{ 'is-selected': activeLang === 'zh' }"
            @click="toggleLang('zh')"
          >
            中文
          </button>
          <button
            type="button"
            class="mobile-books-discover__facet-pill"
            :class="{ 'is-selected': activeLang === 'en' }"
            @click="toggleLang('en')"
          >
            英语
          </button>

          <button
            type="button"
            class="mobile-books-discover__facet-pill"
            :class="{ 'is-selected': activeEra === '2020s' }"
            @click="toggleEra('2020s')"
          >
            2020年代
          </button>
          <button
            type="button"
            class="mobile-books-discover__facet-pill"
            :class="{ 'is-selected': activeEra === 'classic' }"
            @click="toggleEra('classic')"
          >
            2000年以前
          </button>

          <button
            type="button"
            class="mobile-books-discover__facet-pill"
            :class="{ 'is-selected': activeRating === '9+' }"
            @click="toggleRating('9+')"
          >
            9.0分以上
          </button>

          <button
            v-if="activeFilterCount > 0"
            type="button"
            class="mobile-books-discover__facet-reset"
            @click="resetFacets"
          >
            重置
          </button>
        </div>
      </div>
    </header>

    <!-- Content -->
    <main class="mobile-books-discover__content">
      <!-- Hero Featured Book Card -->
      <section
        v-if="!loading && !loadError && heroBook"
        class="mobile-books-discover__hero"
        data-testid="books-hero-card"
      >
        <div class="mobile-books-discover__hero-tag">作品速览</div>
        <div class="mobile-books-discover__hero-body">
          <div class="mobile-books-discover__hero-cover">
            <img
              v-if="heroBook.cover_url"
              :src="heroBook.cover_url"
              :alt="heroBook.title"
              class="mobile-books-discover__hero-img"
            />
            <div v-else class="mobile-books-discover__hero-placeholder" aria-hidden="true">
              <span class="mobile-books-discover__placeholder-title">{{ heroBook.title }}</span>
              <span class="mobile-books-discover__placeholder-author">{{ getAuthors(heroBook) }}</span>
            </div>
          </div>
          <div class="mobile-books-discover__hero-info">
            <h2 class="mobile-books-discover__hero-title">
              <PHighlightText :text="heroBook.title" :query="searchQuery" />
            </h2>
            <p class="mobile-books-discover__hero-author">{{ getAuthors(heroBook) }}</p>
            <div class="mobile-books-discover__hero-meta">
              <span v-if="heroBook.rating_score" class="mobile-books-discover__rating-badge">
                ★ {{ heroBook.rating_score.toFixed(1) }}
              </span>
              <span v-if="heroBook.publisher" class="mobile-books-discover__hero-publisher">
                {{ heroBook.publisher }}
              </span>
            </div>
            <button
              type="button"
              class="mobile-books-discover__hero-btn"
              data-testid="hero-detail-btn"
              @click="openWork(heroBook.id)"
            >
              查看图书详情
            </button>
          </div>
        </div>
      </section>

      <!-- Section Title for List -->
      <div v-if="!loading && !loadError && listWorks.length > 0" class="mobile-books-discover__section-header">
        <h3 class="mobile-books-discover__section-title">
          {{ activeFilter === 'ranked' ? '高分作品榜' : '其他收录作品' }}
        </h3>
        <span class="mobile-books-discover__section-count">{{ listWorks.length }} 本</span>
      </div>

      <!-- Loading Skeleton -->
      <div v-if="loading" class="mobile-books-discover__loading">
        <div v-for="n in 4" :key="n" class="mobile-books-discover__skeleton">
          <div class="mobile-books-discover__skeleton-cover" />
          <div class="mobile-books-discover__skeleton-info">
            <div class="mobile-books-discover__skeleton-title" />
            <div class="mobile-books-discover__skeleton-sub" />
          </div>
        </div>
      </div>

      <!-- Book List -->
      <div v-else-if="listWorks.length > 0 && !loadError" class="mobile-books-discover__list">
        <RouterLink
          v-for="work in listWorks"
          :key="work.id"
          class="mobile-books-discover__item"
          data-testid="book-catalog-item"
          :to="'/books/work/' + work.id"
        >
          <!-- Cover (48x68) -->
          <div class="mobile-books-discover__cover-wrap">
            <img
              v-if="getCoverUrl(work)"
              :src="getCoverUrl(work)"
              :alt="work.title"
              class="mobile-books-discover__cover-img"
              loading="lazy"
            />
            <div v-else class="mobile-books-discover__cover-placeholder" aria-hidden="true">
              <span class="mobile-books-discover__placeholder-title">{{ work.title }}</span>
            </div>
          </div>

          <!-- Metadata -->
          <div class="mobile-books-discover__meta">
            <h2 class="mobile-books-discover__work-title">
              <PHighlightText :text="work.title" :query="searchQuery" />
            </h2>
            <p class="mobile-books-discover__work-author">{{ getAuthors(work) }}</p>
            <div class="mobile-books-discover__work-extra">
              <span v-if="work.rating_score" class="mobile-books-discover__badge">
                评分 {{ work.rating_score.toFixed(1) }}
              </span>
              <span v-if="getPublisher(work)" class="mobile-books-discover__publisher">
                {{ getPublisher(work) }}
              </span>
            </div>
          </div>

          <div class="mobile-books-discover__arrow">
            <MIcon name="chevron-down" size="xs" class="mobile-books-discover__arrow-icon" />
          </div>
        </RouterLink>
      </div>

      <div v-else-if="loadError" class="mobile-books-discover__empty" role="alert">
        <p class="mobile-books-discover__empty-title">{{ loadError }}</p>
        <button type="button" class="mobile-books-discover__hero-btn" @click="loadCatalog">重新加载</button>
      </div>

      <!-- Empty State -->
      <div v-else class="mobile-books-discover__empty" data-testid="books-discover-empty">
        <div class="mobile-books-discover__empty-icon">
          <MIcon name="books" size="lg" />
        </div>
        <p class="mobile-books-discover__empty-title">
          {{ searchQuery ? '未找到相关图书' : '暂无收录图书' }}
        </p>
        <p class="mobile-books-discover__empty-desc">
          {{ searchQuery ? '试试其他关键词，或清除筛选条件。' : '目前没有公开收录的作品，可稍后再来查看。' }}
        </p>
        <router-link to="/modules" class="mobile-books-discover__empty-action">浏览其他模块</router-link>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { searchCatalogWorks } from '@/api/bookCatalog'
import { searchLocation, unifiedSearchEnabled } from '@/utils/searchUrl'
import { highRatedWorks, type WorkRating } from '@/api/bookCommunity'
import type { BookPublicWork } from '@/api/books'
import PHighlightText from '@/components/ui/PHighlightText.vue'
import MButton from '@mobile/components/ui/MButton.vue'
import MIcon from '@mobile/components/ui/MIcon.vue'
import MInput from '@mobile/components/ui/MInput.vue'

type RankedItem = WorkRating & { work_id: string; title: string }

export interface DiscoverWorkItem {
  id: string
  title: string
  authors: { name: string }[]
  rating_score?: number | null
  cover_url?: string
  publisher?: string
}

const props = withDefaults(
  defineProps<{
    initialWorks?: DiscoverWorkItem[]
  }>(),
  {
    initialWorks: undefined,
  }
)

const router = useRouter()
const searchQuery = ref('')
const activeFilter = ref<'all' | 'ranked'>('all')
const loading = ref(props.initialWorks === undefined)
const loadError = ref('')
const worksList = ref<DiscoverWorkItem[]>(props.initialWorks ? [...props.initialWorks] : [])
const rankedWorks = ref<RankedItem[]>([])

// Mobile Facets State
const activeLang = ref('')
const activeEra = ref('')
const activeRating = ref('')
const facetsExpanded = ref(false)

const activeFilterCount = computed(() => {
  let count = 0
  if (activeLang.value) count++
  if (activeEra.value) count++
  if (activeRating.value) count++
  return count
})

function toggleLang(lang: string) {
  activeLang.value = activeLang.value === lang ? '' : lang
  void loadCatalog()
}

function toggleEra(era: string) {
  activeEra.value = activeEra.value === era ? '' : era
  void loadCatalog()
}

function toggleRating(rating: string) {
  activeRating.value = activeRating.value === rating ? '' : rating
  void loadCatalog()
}

function resetFacets() {
  activeLang.value = ''
  activeEra.value = ''
  activeRating.value = ''
  void loadCatalog()
}

function eraToYears(era: string): { yearFrom?: number; yearTo?: number } {
  if (era === '2020s') return { yearFrom: 2020, yearTo: 2029 }
  if (era === 'classic') return { yearTo: 1999 }
  return {}
}

function ratingToMin(rating: string): number | undefined {
  if (rating === '9+') return 9.0
  if (rating === '8+') return 8.0
  return undefined
}

let searchDebounce: ReturnType<typeof setTimeout> | undefined

watch(searchQuery, () => {
  if (props.initialWorks) return
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => {
    if (activeFilter.value === 'all') {
      void loadCatalog()
    }
  }, 300)
})

onBeforeUnmount(() => {
  if (searchDebounce) clearTimeout(searchDebounce)
})

const filteredWorks = computed<DiscoverWorkItem[]>(() => {
  const query = searchQuery.value.trim().toLowerCase()
  let list = props.initialWorks ? props.initialWorks : worksList.value

  if (!props.initialWorks && activeFilter.value === 'ranked') {
    list = rankedWorks.value.map((r) => ({
      id: r.work_id,
      title: r.title,
      authors: [],
      rating_score: r.weighted_rating_score,
    }))
  }

  if (!query) return list

  return list.filter((w) => {
    const titleMatch = w.title.toLowerCase().includes(query)
    const authorMatch = w.authors?.some((a) => a.name.toLowerCase().includes(query))
    return titleMatch || authorMatch
  })
})

const heroBook = computed<DiscoverWorkItem | null>(() => filteredWorks.value[0] || null)
const listWorks = computed(() => filteredWorks.value.filter((work) => work.id !== heroBook.value?.id))

function getCoverUrl(work: DiscoverWorkItem): string | undefined {
  return work.cover_url
}

function getAuthors(work: DiscoverWorkItem): string {
  if (!work.authors || work.authors.length === 0) return '未知作者'
  return work.authors.map((a) => a.name).join(' / ')
}

function getPublisher(work: DiscoverWorkItem): string | undefined {
  return work.publisher
}

function setFilter(filter: 'all' | 'ranked') {
  activeFilter.value = filter
  if (filter === 'ranked' && rankedWorks.value.length === 0) {
    void loadRanked()
  }
}

function handleSearch() {
  if (unifiedSearchEnabled) {
    void router.push(searchLocation(searchQuery.value, 'books', ['work']))
    return
  }
  if (activeFilter.value === 'all') {
    void loadCatalog()
  }
}

function openWork(id: string) {
  router.push(`/books/work/${id}`)
}

async function loadCatalog() {
  if (props.initialWorks) return
  loading.value = true
  loadError.value = ''
  try {
    const res = activeFilterCount.value > 0
      ? await searchCatalogWorks(
          searchQuery.value.trim(),
          30,
          0,
          {
            language: activeLang.value || undefined,
            minRating: ratingToMin(activeRating.value),
            yearFrom: eraToYears(activeEra.value).yearFrom,
            yearTo: eraToYears(activeEra.value).yearTo,
          },
        )
      : await searchCatalogWorks(searchQuery.value.trim(), 30, 0)
    if (Array.isArray(res?.items)) {
      worksList.value = res.items.map((item: BookPublicWork) => ({
        id: item.id,
        title: item.title,
        authors: item.authors || [],
        rating_score: item.rating_score,
        cover_url: item.editions?.[0]?.cover_url,
        publisher: item.editions?.[0]?.publisher,
      }))
    } else {
      throw new Error('Invalid catalog response')
    }
  } catch {
    worksList.value = []
    loadError.value = '图书目录加载失败，请检查网络后重试。'
  } finally {
    loading.value = false
  }
}

async function loadRanked() {
  try {
    const res = await highRatedWorks()
    if (res?.items && Array.isArray(res.items)) {
      rankedWorks.value = res.items
    }
  } catch {
    rankedWorks.value = []
  }
}

onMounted(() => {
  if (!props.initialWorks) {
    void loadCatalog()
  }
})
</script>

<style scoped>
.mobile-books-discover {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background-color: var(--a-color-bg, #ffffff);
  padding-bottom: 96px;
}

.mobile-books-discover__header {
  padding: 16px 16px 12px;
  background-color: var(--a-color-surface, #ffffff);
  border-bottom: 1px solid var(--a-color-border-soft, #f0f0f0);
}

.mobile-books-discover__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.mobile-books-discover__title {
  font-size: 20px;
  font-weight: 600;
  color: var(--a-color-text, #111111);
  letter-spacing: -0.01em;
  margin: 0;
}

.mobile-books-discover__shelf-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--a-color-text-secondary, #666666);
  text-decoration: none;
  padding: 4px 8px;
  border-radius: var(--a-radius-control, 4px);
  border: 1px solid var(--a-color-border-soft, #eeeeee);
  background: var(--a-color-surface, #ffffff);
}

.mobile-books-discover__search {
  margin-bottom: 12px;
}

.mobile-books-discover__chips-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.mobile-books-discover__chips {
  display: flex;
  gap: 8px;
}

.mobile-books-discover__chip {
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  border-radius: var(--a-radius-pill, 9999px);
  border: 1px solid var(--a-color-border-soft, #eeeeee);
  background: var(--a-color-surface, #ffffff);
  color: var(--a-color-text-secondary, #666666);
  cursor: pointer;
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.mobile-books-discover__chip.is-active {
  background: var(--a-color-primary, #111111);
  color: var(--a-color-primary-contrast, #ffffff);
  border-color: var(--a-color-primary, #111111);
}

.mobile-books-discover__filter-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--a-color-text-secondary, #666666);
  background: transparent;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-pill, 9999px);
  cursor: pointer;
  min-height: 32px;
}

.mobile-books-discover__filter-toggle.is-active {
  color: var(--a-color-primary, #007aff);
  border-color: var(--a-color-primary, #007aff);
}

.mobile-books-discover__badge-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  font-size: 10px;
  font-weight: 600;
  border-radius: 9999px;
  background: var(--a-color-primary, #007aff);
  color: #ffffff;
}

.mobile-books-discover__facets-bar {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--a-color-border-soft, #f0f0f0);
}

.mobile-books-discover__facet-scroll {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 2px;
}

.mobile-books-discover__facet-pill {
  flex-shrink: 0;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 500;
  border-radius: var(--a-radius-pill, 9999px);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  background: var(--a-color-surface, #ffffff);
  color: var(--a-color-text-secondary, #666666);
  cursor: pointer;
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.mobile-books-discover__facet-pill.is-selected {
  background: var(--a-color-primary-subtle, rgba(0, 122, 255, 0.12));
  color: var(--a-color-primary, #007aff);
  border-color: var(--a-color-primary, #007aff);
  font-weight: 600;
}

.mobile-books-discover__facet-reset {
  flex-shrink: 0;
  background: transparent;
  border: 0;
  color: var(--a-color-text-tertiary, #999999);
  font-size: 11px;
  padding: 4px 6px;
  cursor: pointer;
}

.mobile-books-discover__content {
  flex: 1;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Hero Book Card */
.mobile-books-discover__hero {
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
  background-color: var(--a-color-surface, #ffffff);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: none !important;
}

.mobile-books-discover__hero-tag {
  font-size: 11px;
  font-weight: 600;
  color: #b45309;
  background-color: #fef3c7;
  padding: 2px 6px;
  border-radius: 2px;
  align-self: flex-start;
  letter-spacing: 0.02em;
}

.mobile-books-discover__hero-body {
  display: flex;
  gap: 14px;
}

.mobile-books-discover__hero-cover {
  width: 68px;
  height: 96px;
  border-radius: 4px;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  background-color: #f8fafc;
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mobile-books-discover__hero-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-books-discover__hero-placeholder {
  color: var(--a-color-text-muted, #94a3b8);
}

.mobile-books-discover__hero-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.mobile-books-discover__hero-title {
  margin: 0 0 4px 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-books-discover__hero-author {
  margin: 0 0 6px 0;
  font-size: 12px;
  color: var(--a-color-text-secondary, #475569);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-books-discover__hero-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}

.mobile-books-discover__rating-badge {
  font-size: 10px;
  font-weight: 600;
  color: #b45309;
  background-color: #fffbeb;
  border: 1px solid #fde68a;
  padding: 1px 4px;
  border-radius: 2px;
}

.mobile-books-discover__hero-publisher {
  font-size: 11px;
  color: var(--a-color-text-muted, #94a3b8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-books-discover__hero-btn {
  align-self: flex-start;
  min-height: 44px;
  margin-top: auto;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--a-color-primary-contrast, #ffffff);
  background-color: var(--a-color-primary, #0f172a);
  border: 1px solid var(--a-color-primary, #0f172a);
  border-radius: var(--a-radius-control, 4px);
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.mobile-books-discover__hero-btn:active {
  opacity: 0.9;
}

.mobile-books-discover__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
}

.mobile-books-discover__section-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.mobile-books-discover__section-count {
  font-size: 11px;
  color: var(--a-color-text-muted, #94a3b8);
}

.mobile-books-discover__loading {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mobile-books-discover__skeleton {
  display: flex;
  gap: 12px;
  padding: 10px;
  border: 1px solid var(--a-color-border-soft, #f5f5f5);
  border-radius: 4px;
}

.mobile-books-discover__skeleton-cover {
  width: 48px;
  height: 68px;
  background-color: var(--a-color-surface-hover, #f5f5f5);
  border-radius: 4px;
  flex-shrink: 0;
}

.mobile-books-discover__skeleton-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
}

.mobile-books-discover__skeleton-title {
  height: 14px;
  width: 60%;
  background-color: var(--a-color-surface-hover, #f5f5f5);
  border-radius: 2px;
}

.mobile-books-discover__skeleton-sub {
  height: 12px;
  width: 35%;
  background-color: var(--a-color-surface-hover, #f5f5f5);
  border-radius: 2px;
}

.mobile-books-discover__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mobile-books-discover__item {
  color: inherit;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--a-color-border-soft, #f0f0f0);
  border-radius: var(--a-radius-control, 4px);
  background-color: var(--a-color-surface, #ffffff);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.mobile-books-discover__item:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 2px;
}
.mobile-books-discover__item:active {
  background-color: var(--a-color-surface-hover, #fafafa);
}

.mobile-books-discover__cover-wrap {
  width: 48px;
  height: 68px;
  border-radius: var(--a-radius-control, 4px);
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid var(--a-color-border-soft, #eeeeee);
  background-color: var(--a-color-surface-muted, #fcfcfc);
}

.mobile-books-discover__cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-books-discover__cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-text-muted, #999999);
}

.mobile-books-discover__meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mobile-books-discover__work-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--a-color-text, #111111);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-books-discover__work-author {
  font-size: 12px;
  color: var(--a-color-text-secondary, #666666);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-books-discover__work-extra {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

.mobile-books-discover__badge {
  font-size: 10px;
  font-weight: 500;
  color: var(--a-color-primary, #007aff);
  background: color-mix(in srgb, var(--a-color-primary, #007aff) 10%, var(--a-color-surface, #ffffff));
  padding: 1px 4px;
  border-radius: 2px;
}

.mobile-books-discover__publisher {
  font-size: 11px;
  color: var(--a-color-text-muted, #999999);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-books-discover__arrow {
  color: var(--a-color-text-muted, #cccccc);
  transform: rotate(-90deg);
  flex-shrink: 0;
}

.mobile-books-discover__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 48px 16px;
}

.mobile-books-discover__empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: var(--a-radius-control, 4px);
  border: 1px solid var(--a-color-border-soft, #eeeeee);
  background: var(--a-color-surface, #ffffff);
  color: var(--a-color-text-muted, #999999);
  margin-bottom: 16px;
}

.mobile-books-discover__empty-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--a-color-text, #111111);
  margin: 0 0 6px 0;
}

.mobile-books-discover__empty-desc {
  font-size: 13px;
  color: var(--a-color-text-secondary, #777777);
  margin: 0 0 20px 0;
  line-height: 1.5;
  max-width: min(100%, 18rem);
  text-wrap: balance;
}

.mobile-books-discover__empty-action {
  text-decoration: none;
}
</style>
