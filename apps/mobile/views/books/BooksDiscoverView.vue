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

      <!-- Tab Filter Chips -->
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
    </header>

    <!-- Content -->
    <main class="mobile-books-discover__content">
      <!-- Hero Featured Book Card -->
      <section
        v-if="heroBook"
        class="mobile-books-discover__hero"
        data-testid="books-hero-card"
      >
        <div class="mobile-books-discover__hero-tag">今日力荐</div>
        <div class="mobile-books-discover__hero-body">
          <div class="mobile-books-discover__hero-cover">
            <img
              v-if="heroBook.cover_url"
              :src="heroBook.cover_url"
              :alt="heroBook.title"
              class="mobile-books-discover__hero-img"
            />
            <div v-else class="mobile-books-discover__hero-placeholder">
              <MIcon name="books" size="md" />
            </div>
          </div>
          <div class="mobile-books-discover__hero-info">
            <h2 class="mobile-books-discover__hero-title">{{ heroBook.title }}</h2>
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
      <div v-if="filteredWorks.length > 0" class="mobile-books-discover__section-header">
        <h3 class="mobile-books-discover__section-title">
          {{ activeFilter === 'ranked' ? '高分作品榜' : '热门图书' }}
        </h3>
        <span class="mobile-books-discover__section-count">{{ filteredWorks.length }} 本</span>
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
      <div v-else-if="filteredWorks.length > 0" class="mobile-books-discover__list">
        <article
          v-for="work in filteredWorks"
          :key="work.id"
          class="mobile-books-discover__item"
          data-testid="book-catalog-item"
          @click="openWork(work.id)"
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
            <div v-else class="mobile-books-discover__cover-placeholder">
              <MIcon name="books" size="md" />
            </div>
          </div>

          <!-- Metadata -->
          <div class="mobile-books-discover__meta">
            <h2 class="mobile-books-discover__work-title">{{ work.title }}</h2>
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
        </article>
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
          {{ searchQuery ? '换个关键词搜搜看，或前往书架阅读本地文件。' : '可以在书架中导入本地电子书，或稍后再来看看。' }}
        </p>
        <router-link to="/books/shelf" class="mobile-books-discover__empty-action">
          <MButton size="sm" variant="secondary">前往我的书架</MButton>
        </router-link>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { searchCatalogWorks } from '@/api/bookCatalog'
import { searchLocation, unifiedSearchEnabled } from '@/utils/searchUrl'
import { highRatedWorks, type WorkRating } from '@/api/bookCommunity'
import type { BookPublicWork } from '@/api/books'
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

const defaultCuratedWorks: DiscoverWorkItem[] = [
  {
    id: 'w-1',
    title: '沉思录',
    authors: [{ name: '马可·奥勒留' }],
    rating_score: 9.3,
    publisher: '中央编译出版社',
  },
  {
    id: 'w-2',
    title: '代码整洁之道',
    authors: [{ name: 'Robert C. Martin' }],
    rating_score: 9.1,
    publisher: '人民邮电出版社',
  },
  {
    id: 'w-3',
    title: '瓦尔登湖',
    authors: [{ name: '亨利·戴维·梭罗' }],
    rating_score: 8.9,
    publisher: '译林出版社',
  },
  {
    id: 'w-4',
    title: '工作颂歌',
    authors: [{ name: '阿兰·德波顿' }],
    rating_score: 8.7,
    publisher: '上海译文出版社',
  },
]

const router = useRouter()
const searchQuery = ref('')
const activeFilter = ref<'all' | 'ranked'>('all')
const loading = ref(false)
const worksList = ref<DiscoverWorkItem[]>(props.initialWorks ? [...props.initialWorks] : [...defaultCuratedWorks])
const rankedWorks = ref<RankedItem[]>([])

const filteredWorks = computed<DiscoverWorkItem[]>(() => {
  const query = searchQuery.value.trim().toLowerCase()
  let list = props.initialWorks ? props.initialWorks : worksList.value

  if (!props.initialWorks && activeFilter.value === 'ranked' && rankedWorks.value.length > 0) {
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

const heroBook = computed<DiscoverWorkItem | null>(() => {
  if (filteredWorks.value.length > 0) return filteredWorks.value[0]
  if (worksList.value.length > 0) return worksList.value[0]
  return null
})

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
  try {
    const res = await searchCatalogWorks(searchQuery.value.trim(), 30, 0)
    if (res?.items && res.items.length > 0) {
      worksList.value = res.items.map((item: BookPublicWork) => ({
        id: item.id,
        title: item.title,
        authors: item.authors || [],
        rating_score: item.rating_score,
        cover_url: item.editions?.[0]?.cover_url,
        publisher: item.editions?.[0]?.publisher,
      }))
    } else if (!searchQuery.value.trim()) {
      worksList.value = [...defaultCuratedWorks]
    } else {
      worksList.value = []
    }
  } catch {
    if (!searchQuery.value.trim()) {
      worksList.value = [...defaultCuratedWorks]
    } else {
      worksList.value = []
    }
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
  background-color: #ffffff;
  padding-bottom: 96px;
}

.mobile-books-discover__header {
  padding: 16px 16px 12px;
  background-color: #ffffff;
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
  border-radius: 4px;
  border: 1px solid var(--a-color-border-soft, #eeeeee);
  background: #ffffff;
}

.mobile-books-discover__search {
  margin-bottom: 12px;
}

.mobile-books-discover__chips {
  display: flex;
  gap: 8px;
}

.mobile-books-discover__chip {
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 4px;
  border: 1px solid var(--a-color-border-soft, #eeeeee);
  background: #ffffff;
  color: var(--a-color-text-secondary, #666666);
  cursor: pointer;
  transition: all 0.15s ease;
}

.mobile-books-discover__chip.is-active {
  background: var(--a-color-text, #111111);
  color: #ffffff;
  border-color: var(--a-color-text, #111111);
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
  border-radius: var(--a-radius-card, 4px);
  background-color: #ffffff;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: var(--a-shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.03));
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
  margin-top: auto;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 500;
  color: #ffffff;
  background-color: var(--a-color-text, #0f172a);
  border: 1px solid var(--a-color-text, #0f172a);
  border-radius: 4px;
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
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--a-color-border-soft, #f0f0f0);
  border-radius: 4px;
  background-color: #ffffff;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.mobile-books-discover__item:active {
  background-color: var(--a-color-surface-hover, #fafafa);
}

.mobile-books-discover__cover-wrap {
  width: 48px;
  height: 68px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid var(--a-color-border-soft, #eeeeee);
  background-color: #fcfcfc;
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
  background: color-mix(in srgb, var(--a-color-primary, #007aff) 10%, #ffffff);
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
  border-radius: 4px;
  border: 1px solid var(--a-color-border-soft, #eeeeee);
  background: #ffffff;
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
  max-width: 260px;
}

.mobile-books-discover__empty-action {
  text-decoration: none;
}
</style>
