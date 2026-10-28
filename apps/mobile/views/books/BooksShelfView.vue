<template>
  <div class="books-shelf-view">
    <!-- Header / Title -->
    <header class="books-shelf-header">
      <h1 class="books-shelf-title">书架</h1>
    </header>

    <p v-if="loading" role="status">正在加载书架…</p>
    <p v-if="error" role="alert">{{ error }} <button type="button" @click="loadShelfData">重试</button></p>
    <div v-if="!loading && guest" class="books-shelf-empty" data-testid="books-guest-state">
      <div class="books-shelf-empty__icon"><MIcon name="books" size="lg" /></div>
      <p class="books-shelf-empty__title">登录查看我的书架</p>
      <p class="books-shelf-empty__desc">登录后可同步在读作品、书架与阅读进度。</p>
      <RouterLink class="books-shelf-empty__action" to="/login?redirect=/books/shelf">登录查看书架</RouterLink>
    </div>
    <!-- Empty State if no books -->
    <div v-else-if="!loading && !error && !currentReadingBook && booksList.length === 0" class="books-shelf-empty" data-testid="books-empty-state">
      <div class="books-shelf-empty__icon">
        <MIcon name="books" size="lg" />
      </div>
      <p class="books-shelf-empty__title">书架暂无图书</p>
      <p class="books-shelf-empty__desc">从图书详情添加你感兴趣的书籍。</p>
    </div>

    <div v-else class="books-shelf-content">
      <!-- "当前在读" Card -->
      <section v-if="currentReadingBook" class="books-current-card" data-testid="current-reading-card" role="button" tabindex="0" @click="openBook(currentReadingBook.id)" @keydown.enter="openBook(currentReadingBook.id)" @keydown.space.prevent="openBook(currentReadingBook.id)">
        <div class="books-current-card__badge">当前在读</div>
        <div class="books-current-card__body">
          <!-- 58x80 Book Spine/Cover -->
          <div class="books-current-card__spine">
            <img v-if="currentReadingBook.cover" :src="currentReadingBook.cover" :alt="currentReadingBook.title" class="books-current-card__img" />
            <div v-else class="books-current-card__placeholder">
              <MIcon name="books" size="md" />
            </div>
          </div>
          <!-- Info -->
          <div class="books-current-card__info">
            <h2 class="books-current-card__title">{{ currentReadingBook.title }}</h2>
            <p class="books-current-card__author">{{ currentReadingBook.author }}</p>
            <div class="books-current-card__meta">
              已读 {{ currentReadingBook.progress }}%<template v-if="currentReadingBook.annotationsCount !== undefined"> · {{ currentReadingBook.annotationsCount }} 条划线批注</template>
            </div>
            <!-- 3px progress bar fill -->
            <div class="books-current-card__progress-track" data-testid="reading-progress-bar">
              <div
                class="books-current-card__progress-fill"
                :style="{ width: `${currentReadingBook.progress}%` }"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- "书架图书" List -->
      <section v-if="booksList.length > 0" class="books-shelf-section">
        <div class="books-shelf-section__header">
          <h2 class="books-shelf-section__title">书架图书</h2>
          <span class="books-shelf-section__count">{{ booksList.length }} 本</span>
        </div>
        <div class="books-shelf-list">
          <div
            v-for="book in booksList"
            :key="book.id"
            class="books-shelf-item"
            data-testid="book-shelf-item"
            role="button"
            tabindex="0"
            @click="openBook(book.id)"
            @keydown.enter="openBook(book.id)"
            @keydown.space.prevent="openBook(book.id)"
          >
            <div class="books-shelf-item__icon">
              <MIcon name="books" size="md" />
            </div>
            <div class="books-shelf-item__info">
              <div class="books-shelf-item__row">
                <span class="books-shelf-item__title">{{ book.title }}</span>
                <span v-if="book.format" class="books-shelf-item__badge">{{ book.format }}</span>
              </div>
              <div class="books-shelf-item__meta">
                <span>{{ book.author }}</span>
                <span v-if="book.fileSize" class="books-shelf-item__dot">·</span>
                <span v-if="book.fileSize">{{ book.fileSize }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getActivePinia } from 'pinia'
import MIcon from '@mobile/components/ui/MIcon.vue'
import { useAuthStore } from '@/stores/auth'
import { listLibrary, readingRecommendation, type LibraryEntry } from '@/api/bookPrivate'
import { getCloudReadingState } from '@/api/bookReading'
import { resourceReaderPath } from '@/api/bookResources'

export interface ShelfBook {
  id: string
  title: string
  author: string
  format?: string
  fileSize?: string
  progress?: number
  annotationsCount?: number
  cover?: string
}

const props = withDefaults(
  defineProps<{
    currentReading?: ShelfBook | null
    initialCurrentBook?: ShelfBook | null
    initialBooks?: ShelfBook[]
  }>(),
  {
    currentReading: undefined,
    initialCurrentBook: undefined,
    initialBooks: undefined,
  }
)

const router = useRouter()
const authStore = getActivePinia() ? useAuthStore() : null
const loading = ref(false)
const guest = ref(false)
const error = ref('')
const opening = ref(false)
const fetchedCurrentReading = ref<ShelfBook | null>(null)
const fetchedBooks = ref<ShelfBook[]>([])

async function loadShelfData() {
  if (props.initialBooks !== undefined || props.currentReading !== undefined || props.initialCurrentBook !== undefined) return
  loading.value = true
  error.value = ''
  guest.value = false
  try {
    if (!authStore || !await authStore.restoreSession()) {
      guest.value = true
      return
    }
    const entries: LibraryEntry[] = []
    let page
    do {
      page = await listLibrary(entries.length)
      entries.push(...page.items)
    } while (page.items.length && entries.length < page.total)
    fetchedBooks.value = entries.map(entry => ({ id: entry.work_id, title: entry.work_title, author: '' }))
    fetchedCurrentReading.value = null
    const current = entries.find(entry => entry.status === 'reading')
    if (current) {
      const recommendation = await readingRecommendation(current.work_id)
      if (recommendation.available && recommendation.asset && recommendation.revision_id) {
        const state = await getCloudReadingState(recommendation.revision_id)
        fetchedCurrentReading.value = {
          id: current.work_id,
          title: current.work_title,
          author: '',
          progress: Math.round(state.current_percent * 100),
          format: recommendation.asset.format.toUpperCase(),
        }
      }
    }
  } catch {
    error.value = '书架或阅读进度加载失败，请重试。'
  } finally {
    loading.value = false
  }
}

const currentReadingBook = computed<ShelfBook | null>(() => {
  if (props.initialCurrentBook !== undefined) return props.initialCurrentBook
  if (props.currentReading !== undefined) return props.currentReading
  return fetchedCurrentReading.value
})

const booksList = computed<ShelfBook[]>(() => {
  if (props.initialBooks !== undefined) return props.initialBooks
  return fetchedBooks.value
})

async function openBook(workId: string) {
  if (opening.value) return
  opening.value = true
  error.value = ''
  try {
    const result = await readingRecommendation(workId)
    await router.push(result.available && result.asset && result.revision_id
      ? resourceReaderPath(result.work_id, result.asset.id, result.revision_id)
      : `/books/work/${workId}`)
  } catch {
    error.value = '无法恢复阅读，请重试。'
  } finally {
    opening.value = false
  }
}

onMounted(() => {
  void loadShelfData()
})
</script>

<style scoped>
.books-shelf-empty__action {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: 44px; margin-top: 12px; padding: 0 18px; text-decoration: none;
  color: var(--a-color-primary-contrast, #fff); background: var(--a-color-primary); border-radius: var(--a-radius-control);
}
.books-shelf-view {
  min-height: 100vh;
  background-color: var(--a-color-bg, #ffffff);
  padding: 16px;
  box-sizing: border-box;
}

.books-shelf-header {
  margin-bottom: 16px;
}

.books-shelf-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.books-shelf-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* "当前在读" Card */
.books-current-card {
  background-color: #ffffff;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
  padding: 16px;
  cursor: pointer;
  box-sizing: border-box;
  transition: border-color 0.15s ease;
}

.books-current-card:active {
  background-color: var(--a-color-surface-muted, #f8fafc);
}

.books-current-card__badge {
  display: inline-block;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: var(--a-color-muted, #64748b);
  margin-bottom: 12px;
}

.books-current-card__body {
  display: flex;
  gap: 14px;
}

.books-current-card__spine {
  width: 58px;
  height: 80px;
  flex-shrink: 0;
  border-radius: 4px;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  background-color: var(--a-color-surface-muted, #f1f5f9);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.books-current-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.books-current-card__placeholder {
  color: var(--a-color-muted, #94a3b8);
}

.books-current-card__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.books-current-card__title {
  margin: 0 0 4px 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.books-current-card__author {
  margin: 0 0 8px 0;
  font-size: 0.75rem;
  color: var(--a-color-muted, #64748b);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.books-current-card__meta {
  font-size: 0.75rem;
  color: var(--a-color-text-secondary, #475569);
  margin-bottom: 8px;
}

.books-current-card__progress-track {
  width: 100%;
  height: 3px;
  background-color: var(--a-color-border-soft, #e2e8f0);
  border-radius: 2px;
  overflow: hidden;
  margin-top: auto;
}

.books-current-card__progress-fill {
  height: 100%;
  background-color: var(--a-color-primary, #0f172a);
  transition: width 0.2s ease;
}

/* Books List */
.books-shelf-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.books-shelf-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.books-shelf-section__title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.books-shelf-section__count {
  font-size: 0.75rem;
  color: var(--a-color-muted, #64748b);
}

.books-shelf-list {
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
  overflow: hidden;
}

.books-shelf-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  cursor: pointer;
  border-bottom: 1px solid var(--a-color-border-soft, #e2e8f0);
  transition: background-color 0.15s ease;
}

.books-shelf-item:last-child {
  border-bottom: none;
}

.books-shelf-item:active {
  background-color: var(--a-color-surface-muted, #f8fafc);
}

.books-shelf-item__icon {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  background-color: var(--a-color-surface-muted, #f1f5f9);
  color: var(--a-color-text, #0f172a);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.books-shelf-item__info {
  flex: 1;
  min-width: 0;
}

.books-shelf-item__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 2px;
}

.books-shelf-item__title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--a-color-text, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.books-shelf-item__badge {
  font-size: 0.625rem;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  background-color: var(--a-color-surface-muted, #f8fafc);
  color: var(--a-color-muted, #64748b);
  flex-shrink: 0;
}

.books-shelf-item__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: var(--a-color-muted, #64748b);
}

.books-shelf-item__dot {
  opacity: 0.5;
}

/* Empty State */
.books-shelf-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 20px;
  text-align: center;
}

.books-shelf-empty__icon {
  width: 48px;
  height: 48px;
  border-radius: 4px;
  background-color: var(--a-color-surface-muted, #f1f5f9);
  color: var(--a-color-muted, #94a3b8);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.books-shelf-empty__title {
  margin: 0 0 6px 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.books-shelf-empty__desc {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--a-color-muted, #64748b);
}
</style>
