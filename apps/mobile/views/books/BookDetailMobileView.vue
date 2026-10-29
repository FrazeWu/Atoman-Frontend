<template>
  <div class="book-detail-mobile">
    <!-- Topbar -->
    <header class="book-detail-mobile__topbar">
      <button
        type="button"
        class="book-detail-mobile__back-btn"
        data-testid="book-detail-back-btn"
        @click="goBack"
      >
        <MIcon name="chevron-left" size="sm" />
        <span>返回</span>
      </button>
      <div class="book-detail-mobile__topbar-actions">
        <button
          type="button"
          class="book-detail-mobile__action-icon"
          title="分享"
          aria-label="分享图书"
          @click="shareBook"
        >
          <MIcon name="share" size="sm" />
        </button>
      </div>
    </header>

    <!-- Content -->
    <main v-if="book" class="book-detail-mobile__content">
      <!-- Hero Header Card -->
      <section class="book-detail-mobile__hero">
        <div class="book-detail-mobile__cover-wrap">
          <img
            v-if="book.cover"
            :src="book.cover"
            :alt="book.title"
            class="book-detail-mobile__cover-img"
          />
          <div v-else class="book-detail-mobile__cover-placeholder">
            <MIcon name="books" size="lg" />
          </div>
        </div>

        <div class="book-detail-mobile__hero-info">
          <h1 class="book-detail-mobile__title">{{ book.title }}</h1>
          <p class="book-detail-mobile__author">{{ book.author }}</p>
          <p v-if="book.publisher" class="book-detail-mobile__publisher">{{ book.publisher }}</p>

          <div class="book-detail-mobile__rating-row">
            <span v-if="book.rating" class="book-detail-mobile__rating-badge">
              ★ {{ book.rating.toFixed(1) }}
            </span>
            <span v-if="book.year" class="book-detail-mobile__year">{{ book.year }} 年版</span>
          </div>
        </div>
      </section>

      <!-- Action Buttons -->
      <section class="book-detail-mobile__actions">
        <button
          type="button"
          class="book-detail-mobile__btn book-detail-mobile__btn--primary"
          :class="{ 'book-detail-mobile__btn--unavailable': readingStatus === 'unavailable' }"
          data-testid="start-reading-btn"
          :disabled="readingBusy || readingStatus === 'checking' || readingStatus === 'unavailable'"
          :aria-busy="readingBusy || readingStatus === 'checking'"
          @click="startReading"
        >
          <MIcon name="books" size="sm" />
          <span>{{ readingStatus === 'checking' ? '正在检查电子书…' : readingStatus === 'unavailable' ? '暂无电子版' : readingStatus === 'error' ? '重新检查电子书' : '开始阅读' }}</span>
        </button>
      </section>
      <p v-if="readingStatus === 'unavailable'" class="book-detail-mobile__asset-hint" role="status">该作品目前没有可阅读的电子书，可先查看作品信息与读者讨论。</p>
      <p v-else-if="readingStatus === 'error'" class="book-detail-mobile__asset-hint" role="status">暂时无法确认阅读资源，请点击上方按钮重试。</p>

      <p v-if="actionError" role="alert">{{ actionError }}</p>
      <p v-if="shareFeedback" class="book-detail-mobile__share-feedback" role="status">{{ shareFeedback }}</p>
      <label v-if="shareFallbackUrl" class="book-detail-mobile__share-fallback">
        分享链接（可长按复制）
        <input :value="shareFallbackUrl" readonly aria-label="图书分享链接" @focus="($event.target as HTMLInputElement).select()" />
      </label>
      <!-- Synopsis / Introduction -->
      <section v-if="book.synopsis" class="book-detail-mobile__section">
        <h2 class="book-detail-mobile__section-title">内容简介</h2>
        <div class="book-detail-mobile__synopsis">
          <p>{{ book.synopsis || '暂无详细内容简介。' }}</p>
        </div>
      </section>
      <p v-else class="book-detail-mobile__missing-synopsis">暂无内容简介</p>

      <!-- Chapters Preview -->
      <section v-if="book.chapters && book.chapters.length > 0" class="book-detail-mobile__section">
        <div class="book-detail-mobile__section-header">
          <h2 class="book-detail-mobile__section-title">目录节选</h2>
          <span class="book-detail-mobile__section-meta">共 {{ book.chapters.length }} 卷/章</span>
        </div>
        <ul class="book-detail-mobile__chapters">
          <li
            v-for="(chap, idx) in book.chapters"
            :key="idx"
            class="book-detail-mobile__chapter-item"
          >
            <span class="book-detail-mobile__chapter-index">{{ String(idx + 1).padStart(2, '0') }}</span>
            <span class="book-detail-mobile__chapter-title">{{ chap }}</span>
          </li>
        </ul>
      </section>

      <BookShelfAction v-if="auth.isAuthenticated" :key="`${book.id}:${auth.user?.uuid}`" :work-id="book.id" />
      <BookWorkCommunity :key="`${book.id}:${auth.user?.uuid || 'guest'}`" :work-id="book.id" :authenticated="auth.isAuthenticated" />

    </main>

    <div v-else-if="loadError" role="alert" class="book-detail-mobile__loading">
      <p>{{ loadError }}</p>
      <button type="button" @click="loadBookData">重试</button>
    </div>
    <!-- Loading State -->
    <div v-else class="book-detail-mobile__loading">
      <div class="book-detail-mobile__spinner" />
      <span>正在载入图书信息...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getCatalogWork } from '@/api/bookCatalog'
import { readingRecommendation, type ReadingRecommendation } from '@/api/bookPrivate'
import { useAuthStore } from '@/stores/auth'
import BookShelfAction from '@/components/books/BookShelfAction.vue'
import BookWorkCommunity from '@/components/books/BookWorkCommunity.vue'
import MIcon from '@mobile/components/ui/MIcon.vue'

export interface BookDetailData {
  id: string
  title: string
  author: string
  publisher?: string
  rating?: number
  year?: string | number
  cover?: string
  synopsis?: string
  inShelf?: boolean
  chapters?: string[]
}
const props = defineProps<{ initialBook?: BookDetailData }>()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const book = ref<BookDetailData | null>(null)
const loadError = ref('')
const actionError = ref('')
const shareFeedback = ref('')
const shareFallbackUrl = ref('')
const readingBusy = ref(false)
const readingStatus = ref<'checking' | 'available' | 'unavailable' | 'error'>('checking')
const cachedReading = ref<ReadingRecommendation | null>(null)
let loadGeneration = 0

function goBack() {
  if (window.history.length > 1) router.back()
  else void router.push('/books')
}
async function shareBook() {
  if (!book.value) return
  shareFeedback.value = ''
  shareFallbackUrl.value = ''
  const url = window.location.href
  if (navigator.share) {
    try {
      await navigator.share({
        title: book.value.title,
        text: book.value.title + ' - ' + book.value.author,
        url,
      })
      return
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
    }
  }
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
    await navigator.clipboard.writeText(url)
    shareFeedback.value = '图书链接已复制'
  } catch {
    shareFeedback.value = '无法自动复制，请选择下方链接手动复制'
    shareFallbackUrl.value = url
  }
}
async function checkReadingAvailability(workId: string, generation: number) {
  readingStatus.value = 'checking'
  cachedReading.value = null
  try {
    const result = await readingRecommendation(workId)
    if (generation !== loadGeneration) return
    if (result?.available && result.asset?.id && result.revision_id) {
      cachedReading.value = result
      readingStatus.value = 'available'
    } else {
      readingStatus.value = 'unavailable'
    }
  } catch {
    if (generation === loadGeneration) readingStatus.value = 'error'
  }
}
async function startReading() {
  if (!book.value || readingBusy.value || readingStatus.value === 'checking' || readingStatus.value === 'unavailable') return
  if (readingStatus.value === 'error') {
    await checkReadingAvailability(book.value.id, loadGeneration)
    return
  }
  const next = cachedReading.value
  if (!next?.asset?.id || !next.revision_id) return
  readingBusy.value = true
  actionError.value = ''
  try {
    await router.push('/books/read/' +
      encodeURIComponent(next.work_id || book.value.id) + '/' +
      encodeURIComponent(next.asset.id) + '/' +
      encodeURIComponent(next.revision_id))
  } catch {
    actionError.value = '阅读器打开失败，请重试。'
  } finally {
    readingBusy.value = false
  }
}
async function loadBookData() {
  const generation = ++loadGeneration
  book.value = null
  loadError.value = ''
  actionError.value = ''
  shareFeedback.value = ''
  shareFallbackUrl.value = ''
  readingBusy.value = false
  readingStatus.value = 'checking'
  cachedReading.value = null
  if (props.initialBook) {
    book.value = { ...props.initialBook }
    void checkReadingAvailability(book.value.id, generation)
    return
  }
  const id = String(route.params.id || route.params.workId || '')
  if (!id) { loadError.value = '图书标识缺失。'; return }
  try {
    const result = await getCatalogWork(id)
    if (generation !== loadGeneration) return
    if (result.id !== id) {
      await router.replace({ path: `/books/work/${result.id}`, query: route.query })
      return
    }
    book.value = {
      id: result.id, title: result.title,
      author: result.authors?.map(author => author.name).join(' / ') || '未知作者',
      publisher: result.editions?.[0]?.publisher,
      cover: result.cover_url || result.editions?.[0]?.cover_url,
      synopsis: result.description || '',
    }
    void checkReadingAvailability(result.id, generation)
  } catch {
    if (generation === loadGeneration) loadError.value = '图书加载失败或已下架，请重试。'
  }
}
watch(() => [route.params.id, route.params.workId, props.initialBook], () => { void loadBookData() }, { immediate: true })
onBeforeUnmount(() => { loadGeneration += 1 })
</script>

<style scoped>
.book-detail-mobile__asset-hint { margin: -12px 0 0; font-size: 13px; color: var(--a-color-muted); line-height: 1.6; }
.book-detail-mobile__btn:disabled { opacity: 0.66; cursor: not-allowed; }
.book-detail-mobile {
  min-height: 100vh;
  background-color: var(--a-color-bg, #ffffff);
  padding-bottom: 96px;
  box-sizing: border-box;
}

.book-detail-mobile__topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 16px;
  background-color: var(--a-color-surface, #ffffff);
  border-bottom: 1px solid var(--a-color-border-soft, #f0f0f0);
  position: sticky;
  top: 0;
  z-index: 10;
}

.book-detail-mobile__back-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  font-weight: 500;
  color: var(--a-color-text, #111111);
  background: none;
  border: none;
  padding: 6px 0;
  cursor: pointer;
}

.book-detail-mobile__topbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.book-detail-mobile__action-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--a-radius-control, 4px);
  border: 1px solid var(--a-color-border-soft, #eeeeee);
  background: var(--a-color-surface, #ffffff);
  color: var(--a-color-text-secondary, #666666);
  cursor: pointer;
}

.book-detail-mobile__content {
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.book-detail-mobile__hero {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.book-detail-mobile__cover-wrap {
  width: 90px;
  height: 126px;
  flex-shrink: 0;
  border-radius: var(--a-radius-control, 4px);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  background-color: var(--a-color-surface-muted, #f8fafc);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: none !important;
}

.book-detail-mobile__cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.book-detail-mobile__cover-placeholder {
  color: var(--a-color-text-muted, #94a3b8);
}

.book-detail-mobile__hero-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.book-detail-mobile__title {
  margin: 0 0 6px 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
  line-height: 1.3;
}

.book-detail-mobile__author {
  margin: 0 0 4px 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--a-color-text-secondary, #475569);
}

.book-detail-mobile__publisher {
  margin: 0 0 8px 0;
  font-size: 12px;
  color: var(--a-color-text-muted, #94a3b8);
}

.book-detail-mobile__rating-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.book-detail-mobile__rating-badge {
  font-size: 11px;
  font-weight: 600;
  color: #b45309;
  background-color: #fef3c7;
  padding: 2px 6px;
  border-radius: 2px;
  border: 1px solid #fde68a;
}

.book-detail-mobile__year {
  font-size: 11px;
  color: var(--a-color-text-muted, #94a3b8);
}

.book-detail-mobile__actions {
  display: flex;
  gap: 12px;
}

.book-detail-mobile__btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  border-radius: var(--a-radius-control, 4px);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.book-detail-mobile__btn--primary {
  background-color: var(--a-color-primary, #0f172a);
  color: var(--a-color-primary-contrast, #ffffff);
  border: 1px solid var(--a-color-primary, #0f172a);
}

.book-detail-mobile__btn--primary:active {
  opacity: 0.9;
}

.book-detail-mobile__btn--secondary {
  background-color: var(--a-color-surface, #ffffff);
  color: var(--a-color-text, #0f172a);
  border: 1px solid var(--a-color-border-soft, #cbd5e1);
}

.book-detail-mobile__btn--secondary.is-in-shelf {
  background-color: var(--a-color-surface-muted, #f8fafc);
  color: var(--a-color-text-secondary, #64748b);
  border-color: var(--a-color-border-soft, #e2e8f0);
}

.book-detail-mobile__section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.book-detail-mobile__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.book-detail-mobile__section-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.book-detail-mobile__section-meta {
  font-size: 12px;
  color: var(--a-color-text-muted, #94a3b8);
}

.book-detail-mobile__synopsis {
  font-size: 13px;
  line-height: 1.65;
  color: var(--a-color-text-secondary, #334155);
  background-color: var(--a-color-surface-muted, #fcfcfc);
  border: 1px solid var(--a-color-border-soft, #f1f5f9);
  border-radius: var(--a-radius-control, 4px);
  padding: 12px 14px;
}

.book-detail-mobile__synopsis p {
  margin: 0;
}

.book-detail-mobile__chapters {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--a-color-border-soft, #f1f5f9);
  border-radius: var(--a-radius-control, 4px);
  overflow: hidden;
  background-color: var(--a-color-surface, #ffffff);
}

.book-detail-mobile__chapter-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--a-color-border-soft, #f8fafc);
  font-size: 13px;
}

.book-detail-mobile__chapter-item:last-child {
  border-bottom: none;
}

.book-detail-mobile__chapter-index {
  font-size: 11px;
  font-weight: 600;
  color: var(--a-color-text-muted, #94a3b8);
  width: 18px;
}

.book-detail-mobile__chapter-title {
  color: var(--a-color-text, #1e293b);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.book-detail-mobile__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 80px 20px;
  font-size: 13px;
  color: var(--a-color-text-muted, #94a3b8);
}

.book-detail-mobile__spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--a-color-border-soft, #e2e8f0);
  border-top-color: var(--a-color-text, #0f172a);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.book-detail-mobile__btn--unavailable:disabled {
  color: var(--a-color-text-secondary, #64748b);
  background: var(--a-color-surface-muted, #f1f5f9);
  border-color: var(--a-color-border-soft, #e2e8f0);
  opacity: 1;
}
.book-detail-mobile__missing-synopsis,
.book-detail-mobile__share-feedback {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--a-color-text-secondary, #64748b);
}
.book-detail-mobile__share-fallback {
  display: grid;
  gap: 6px;
  font-size: 12px;
  margin-bottom: 12px;
  overflow: hidden;
}
.book-detail-mobile__share-fallback input {
  width: 100%;
  min-height: 44px;
  padding: 8px;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: 8px;
  box-sizing: border-box;
  font: inherit;
}
</style>
