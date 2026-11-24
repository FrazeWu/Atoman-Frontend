<template>
  <div class="book-author-view">
    <!-- 加载骨架屏 (参考音乐 ArtistDrawer) -->
    <div v-if="loading && !authorName" class="author-loading-skeleton" role="status" aria-busy="true" aria-label="正在加载作者资料">
      <div class="author-header-profile">
        <PSkeleton class="author-skeleton-avatar" variant="rect" width="80px" height="80px" />
        <div class="author-header-info">
          <PSkeleton width="min(18rem, 60vw)" height="2.25rem" />
          <PSkeleton width="12rem" height="0.85rem" />
        </div>
      </div>
      <PSkeleton width="min(38rem, 100%)" height="2.5rem" style="margin: 0.75rem 0 1.5rem;" />
      <div class="actions" style="margin-bottom: 2rem;">
        <PSkeleton width="6rem" height="2rem" />
        <PSkeleton width="6rem" height="2rem" />
      </div>
      <div class="album-list-header">
        <PSkeleton width="12rem" height="2.125rem" />
        <PSkeleton width="7.5rem" height="2.125rem" />
      </div>
      <div v-for="index in 3" :key="index" class="album-row" style="pointer-events: none;">
        <div class="album-row-left"><PSkeleton width="3.5rem" height="1rem" /></div>
        <div class="album-row-right">
          <PSkeleton width="56px" height="76px" style="border-radius: 4px;" />
          <div class="album-row-info">
            <PSkeleton width="min(16rem, 70%)" height="1.25rem" />
            <PSkeleton width="min(24rem, 90%)" height="0.85rem" />
            <PSkeleton width="8rem" height="0.85rem" />
          </div>
        </div>
      </div>
    </div>

    <!-- 错误重试态 -->
    <div v-else-if="error && !authorName" role="alert" class="book-author-view__error-box">
      <p>{{ error }}</p>
      <PButton variant="secondary" size="sm" @click="loadAuthor">重试</PButton>
    </div>

    <!-- 正常作者资料主体 -->
    <div v-else class="book-author-view__body">
      <!-- 头部档案资料区 (参考音乐 ArtistDrawer 头部) -->
      <header class="author-header-content">
        <div class="author-header-profile">
          <div class="author-avatar-wrap">
            <div class="author-avatar-placeholder" aria-hidden="true">
              {{ (authorName || '作').slice(0, 1) }}
            </div>
          </div>
          <div class="author-header-info">
            <div class="author-title-row">
              <h1 class="author-title">{{ authorName || '作者' }}</h1>
              <span class="author-role-badge">人物 · 作者</span>
            </div>
            <p v-if="works.length" class="author-meta-line">已收录 {{ works.length }} 部作品</p>
          </div>
        </div>
        <p v-if="authorBio" class="author-bio">{{ authorBio }}</p>
        <p v-else class="author-bio author-bio--empty">暂无作者简介。</p>
      </header>

      <!-- 操作按钮栏 (参考音乐 actions 栏) -->
      <div class="actions">
        <BookWikiPanel
          v-if="auth.isAuthenticated"
          kind="person"
          :entity-id="personId"
          :authenticated="auth.isAuthenticated"
          @changed="loadAuthor"
        >
          <template #trigger="{ open }">
            <PButton variant="secondary" size="sm" @click="open">
              <Pencil :size="14" aria-hidden="true" />
              <span>修改资料</span>
            </PButton>
          </template>
        </BookWikiPanel>
        <PButton
          variant="primary"
          size="sm"
          :to="`/books/new?author=${encodeURIComponent(authorName)}`"
        >
          <Plus :size="14" aria-hidden="true" />
          <span>添加作品</span>
        </PButton>
      </div>

      <!-- 作品列表区 (参考音乐 album-list-header & album-row) -->
      <section class="book-author-view__works-section" aria-label="出版作品">
        <div class="album-list-header">
          <PSegmentedControl
            v-model="workFilter"
            :options="filterOptions"
          />
          <div class="album-list-controls">
            <PSelect
              v-model="sortMode"
              :options="sortOptions"
              class="album-sort-pselect"
            />
          </div>
        </div>

        <p v-if="worksLoading && !works.length" class="state-line">正在加载作品列表…</p>
        <p v-else-if="!filteredWorks.length" class="state-line">
          {{ workFilter === 'original' ? '暂未收录该作者的原著作品。' : '暂未收录该作者的译作。' }}
        </p>

        <!-- 作品列表 (PDF / 图书行项，复刻音乐专辑行优雅排版) -->
        <div v-else class="author-works-list">
          <RouterLink
            v-for="work in sortedWorks"
            :key="work.id"
            :to="`/books/work/${work.id}?from=${encodeURIComponent(route.fullPath)}`"
            class="album-row"
          >
            <div class="album-row-left">
              <div class="album-year">{{ getWorkYear(work) || '待考' }}</div>
            </div>
            <div class="album-row-right">
              <div class="album-row-cover">
                <BookCover
                  variant="work"
                  :src="work.cover_url || work.editions?.[0]?.cover_url"
                  :title="work.title"
                  :subtitle="work.subtitle || work.original_title"
                  :author="authorName"
                />
              </div>
              <div class="album-row-info">
                <div class="album-row-title">{{ work.title }}</div>
                <div v-if="work.original_title" class="album-row-sub">{{ work.original_title }}</div>
                <div v-if="work.description" class="album-row-description">
                  {{ work.description }}
                </div>
                <div class="album-row-meta">
                  <span v-if="work.rating_score" class="album-meta-tag rating-tag">★ {{ work.rating_score.toFixed(1) }}</span>
                  <span v-if="work.rating_score" class="album-meta-divider">•</span>
                  <span>{{ work.editions?.length || 1 }} 个版本</span>
                  <template v-if="getWorkPublishers(work)">
                    <span class="album-meta-divider">•</span>
                    <span>{{ getWorkPublishers(work) }}</span>
                  </template>
                </div>
              </div>
            </div>
          </RouterLink>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Pencil, Plus } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import PButton from '@/components/ui/PButton.vue'
import PSkeleton from '@/components/ui/PSkeleton.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PSelect from '@/components/ui/PSelect.vue'
import BookCover from '@/components/books/BookCover.vue'
import BookWikiPanel from '@/components/books/BookWikiPanel.vue'
import { wikiMetadata } from '@/api/bookWiki'
import { searchCatalogWorks } from '@/api/bookCatalog'
import type { BookPublicWork } from '@/entities/book/model/types'

const route = useRoute()
const auth = useAuthStore()

const personId = computed(() => String(route.params.personId || ''))

const loading = ref(false)
const error = ref('')
const authorName = ref('')
const authorBio = ref('')

const works = ref<BookPublicWork[]>([])
const worksLoading = ref(false)

type WorkFilterType = 'original' | 'translation'
const workFilter = ref<WorkFilterType>('original')
const sortMode = ref<'year-desc' | 'rating-desc' | 'title-asc'>('year-desc')

function isOriginalWork(work: BookPublicWork): boolean {
  if (work.authors?.some(a => a.id === personId.value || a.name === authorName.value)) return true
  return !isTranslationWork(work)
}

function isTranslationWork(work: BookPublicWork): boolean {
  return (work.editions || []).some(e =>
    e.translators?.some(t => t.id === personId.value || t.name === authorName.value)
  )
}

const filterOptions = computed<Array<{ label: string; value: WorkFilterType }>>(() => {
  const origCount = works.value.filter(isOriginalWork).length
  const transCount = works.value.filter(isTranslationWork).length
  return [
    { label: `原著 (${origCount})`, value: 'original' },
    { label: `译作 (${transCount})`, value: 'translation' },
  ]
})

watch(works, (newWorks) => {
  const origCount = newWorks.filter(isOriginalWork).length
  const transCount = newWorks.filter(isTranslationWork).length
  if (origCount === 0 && transCount > 0) {
    workFilter.value = 'translation'
  } else {
    workFilter.value = 'original'
  }
})

const sortOptions = [
  { label: '最新出版', value: 'year-desc' },
  { label: '评分最高', value: 'rating-desc' },
  { label: '书名排序', value: 'title-asc' },
]

function getWorkYear(work: BookPublicWork): string {
  for (const edition of work.editions || []) {
    if (edition.published_date) {
      const year = edition.published_date.slice(0, 4)
      if (year && !isNaN(Number(year))) return year
    }
  }
  return ''
}

function getWorkPublishers(work: BookPublicWork): string {
  const publishers = (work.editions || [])
    .map(e => e.publisher_info?.name || e.publisher)
    .filter(Boolean) as string[]
  return [...new Set(publishers)].slice(0, 2).join(' / ')
}

const filteredWorks = computed(() => {
  let list = works.value
  if (workFilter.value === 'original') {
    list = list.filter(isOriginalWork)
  } else if (workFilter.value === 'translation') {
    list = list.filter(isTranslationWork)
  }
  return list
})

const sortedWorks = computed(() => {
  const list = [...filteredWorks.value]
  if (sortMode.value === 'rating-desc') {
    return list.sort((a, b) => (b.rating_score || 0) - (a.rating_score || 0))
  }
  if (sortMode.value === 'title-asc') {
    return list.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
  }
  // year-desc
  return list.sort((a, b) => {
    const yearA = getWorkYear(a)
    const yearB = getWorkYear(b)
    if (yearA && yearB) return yearB.localeCompare(yearA)
    if (yearA) return -1
    if (yearB) return 1
    return 0
  })
})

async function loadAuthor() {
  if (!personId.value) return
  loading.value = true
  error.value = ''
  try {
    const res = await wikiMetadata('person', personId.value)
    const fields = res.fields || {}
    authorName.value = String(fields.name || '')
    authorBio.value = String(fields.description || '')
  } catch {
    error.value = '作者资料加载失败，请重试。'
  } finally {
    loading.value = false
  }

  // 加载该作者的作品列表
  if (authorName.value) {
    worksLoading.value = true
    try {
      const page = await searchCatalogWorks(authorName.value, 50)
      works.value = page.items.filter(item =>
        item.authors?.some(a => a.id === personId.value || a.name === authorName.value) ||
        item.editions?.some(e => e.translators?.some(t => t.id === personId.value || t.name === authorName.value))
      )
      if (!works.value.length && page.items.length) {
        works.value = page.items
      }
    } catch {
      // 容错处理
    } finally {
      worksLoading.value = false
    }
  }
}

watch(personId, () => void loadAuthor(), { immediate: true })
</script>

<style scoped>
.book-author-view {
  width: 100%;
}

.book-author-view__error-box {
  padding: 3rem 1rem;
  text-align: center;
  color: var(--a-color-error, #ef4444);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

/* 头部档案区域 (参考音乐 ArtistDrawer 样式) */
.author-header-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.author-header-profile {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 0.75rem;
}

.author-avatar-wrap {
  width: 80px;
  height: 80px;
  flex-shrink: 0;
}

.author-avatar-placeholder {
  width: 100%;
  height: 100%;
  border-radius: var(--a-radius-card, 4px);
  background: var(--a-color-surface-muted, rgba(0, 0, 0, 0.04));
  border: 1px solid var(--a-color-border-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--a-font-sans);
  font-size: 2rem;
  font-weight: 600;
  color: var(--a-color-muted);
}

.author-header-info {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.author-title-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.author-title {
  font-family: var(--a-font-sans);
  font-size: 2.25rem;
  font-weight: 600;
  color: var(--a-color-text, #1c1c1e);
  margin: 0;
  line-height: 1.15;
  letter-spacing: -0.02em;
}

.author-role-badge {
  font-family: var(--a-font-sans);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--a-color-muted);
  background: var(--a-color-surface-muted, rgba(0, 0, 0, 0.04));
  padding: 2px 8px;
  border-radius: 4px;
}

.author-meta-line {
  margin: 0;
  font-family: var(--a-font-sans);
  font-size: 0.8125rem;
  color: var(--a-color-muted);
}

.author-bio {
  margin: 0.5rem 0 1.5rem;
  max-width: 44rem;
  color: var(--a-color-muted);
  line-height: 1.6;
  font-size: 0.9375rem;
  white-space: pre-wrap;
}

.author-bio--empty {
  color: var(--a-color-muted-soft, #94a3b8);
  font-style: italic;
}

/* 操作按钮行 (参考音乐 ArtistDrawer actions) */
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-bottom: 2rem;
  align-items: center;
}

/* 作品列表头部 (参考音乐 ArtistDrawer album-list-header) */
.album-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
  padding-bottom: 0;
  border-bottom: none;
}

.album-list-heading {
  font-family: var(--a-font-sans);
  font-size: 1.15rem;
  font-weight: 600;
  margin: 0;
  color: var(--a-color-text);
  letter-spacing: -0.01em;
}

.album-list-controls {
  min-width: 140px;
}

.album-sort-pselect :deep(.p-select-trigger) {
  min-height: 34px;
  padding: 0.35rem 0.65rem;
  font-size: 0.8125rem;
  background: var(--a-color-bg);
}

.state-line {
  color: var(--a-color-muted);
  font-size: 0.875rem;
  padding: 1.5rem 0;
}

/* 作品单行列表 (参考音乐 ArtistDrawer album-row) */
.author-works-list {
  display: flex;
  flex-direction: column;
}

.album-row {
  display: flex;
  align-items: center;
  gap: 1.2rem;
  margin-bottom: 0;
  position: relative;
  cursor: pointer;
  padding: 1rem;
  border: none;
  border-bottom: 1px solid var(--a-color-border-soft);
  border-left: 3px solid transparent;
  transition: background-color 0.2s ease, border-color 0.2s ease;
  text-decoration: none;
  color: inherit;
}

.album-row:first-of-type {
  border-top: 1px solid var(--a-color-border-soft);
}

.album-row:hover {
  background: var(--a-color-surface-muted);
  border-left-color: var(--a-color-text);
}

.album-row-left {
  width: 80px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.album-year {
  font-family: var(--a-font-sans);
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--a-color-muted);
  white-space: nowrap;
}

.album-row-right {
  flex: 1;
  display: flex;
  background: transparent;
  border: none;
  padding: 0;
  gap: 1rem;
  align-items: center;
  min-width: 0;
}

.album-row-cover {
  width: 56px;
  height: 76px;
  background: var(--a-color-surface-muted);
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
  flex-shrink: 0;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.album-row-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
}

.album-row-title {
  font-family: var(--a-font-sans);
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--a-color-text, #1c1c1e);
  line-height: 1.3;
}

.album-row-sub {
  font-size: 0.8125rem;
  color: var(--a-color-muted);
}

.album-row-description {
  font-size: 0.8125rem;
  color: var(--a-color-muted);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-top: 0.15rem;
}

.album-row-meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-family: var(--a-font-sans);
  font-size: 0.78rem;
  color: var(--a-color-muted);
  margin-top: 0.15rem;
}

.album-meta-divider {
  opacity: 0.5;
}

.album-meta-tag {
  font-weight: 600;
  color: var(--a-color-text);
}

.rating-tag {
  color: var(--a-color-warning, #f59e0b);
  font-weight: 600;
}

/* 响应式适配 */
@media (max-width: 767px) {
  .author-header-profile {
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 1rem;
  }

  .author-title-row {
    justify-content: center;
  }

  .author-bio {
    text-align: center;
  }

  .actions {
    justify-content: center;
  }

  .album-list-header {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }

  .album-row {
    gap: 0.75rem;
    padding: 0.85rem 0.5rem;
  }

  .album-row-left {
    display: none;
  }
}
</style>
