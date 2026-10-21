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
          data-testid="start-reading-btn"
          @click="startReading"
        >
          <MIcon name="books" size="sm" />
          <span>开始阅读</span>
        </button>
        <button
          type="button"
          class="book-detail-mobile__btn book-detail-mobile__btn--secondary"
          :class="{ 'is-in-shelf': inShelfState }"
          data-testid="toggle-shelf-btn"
          @click="toggleShelf"
        >
          <MIcon :name="inShelfState ? 'shelf' : 'plus'" size="sm" />
          <span>{{ inShelfState ? '已在书架' : '加入书架' }}</span>
        </button>
      </section>

      <!-- Synopsis / Introduction -->
      <section class="book-detail-mobile__section">
        <h2 class="book-detail-mobile__section-title">内容简介</h2>
        <div class="book-detail-mobile__synopsis">
          <p>{{ book.synopsis || '暂无详细内容简介。' }}</p>
        </div>
      </section>

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
    </main>

    <!-- Loading State -->
    <div v-else class="book-detail-mobile__loading">
      <div class="book-detail-mobile__spinner" />
      <span>正在载入图书信息...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getCatalogWork } from '@/api/bookCatalog'
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

const props = withDefaults(
  defineProps<{
    initialBook?: BookDetailData
  }>(),
  {
    initialBook: undefined,
  }
)

const route = useRoute()
const router = useRouter()

const book = ref<BookDetailData | null>(props.initialBook ? { ...props.initialBook } : null)
const inShelfState = ref(props.initialBook?.inShelf ?? false)

watch(
  () => props.initialBook,
  (newVal) => {
    if (newVal) {
      book.value = { ...newVal }
      inShelfState.value = newVal.inShelf ?? false
    }
  },
  { deep: true }
)

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/books')
  }
}

function shareBook() {
  if (navigator.share && book.value) {
    navigator.share({
      title: book.value.title,
      text: `${book.value.title} - ${book.value.author}`,
      url: window.location.href,
    }).catch(() => {})
  }
}

function toggleShelf() {
  inShelfState.value = !inShelfState.value
}

function startReading() {
  if (book.value?.id) {
    router.push(`/books/read/${book.value.id}`)
  }
}

async function loadBookData() {
  if (props.initialBook) return
  const id = String(route.params.id || '')
  if (!id) return

  try {
    const res = await getCatalogWork(id)
    if (res) {
      book.value = {
        id: res.id,
        title: res.title,
        author: res.authors?.map((a) => a.name).join(' / ') || '未知作者',
        publisher: res.editions?.[0]?.publisher,
        rating: res.rating_score ?? undefined,
        year: (res.editions?.[0] as any)?.edition_year ?? (res.editions?.[0] as any)?.year ?? undefined,
        cover: res.editions?.[0]?.cover_url,
        synopsis: res.description || '暂无内容简介。',
        inShelf: false,
        chapters: ['第1卷：来自祖先的德行', '第2卷：清晨的自我告诫', '第3卷：自然的和谐法则'],
      }
      return
    }
  } catch {
    // Fallback to sample book
  }

  // Fallback demo data
  book.value = {
    id,
    title: '沉思录',
    author: '马可·奥勒留',
    publisher: '中央编译出版社',
    rating: 9.3,
    year: '2015',
    synopsis: '古罗马唯一一位哲学家皇帝马可·奥勒留写给自己的私人对话记录。面对动荡的帝国战事与繁复的宫廷政务，他在军营帐篷中借由哲学省思，审视人性的弱点、生死的无常以及内在理性的力量。',
    inShelf: false,
    chapters: [
      '第1卷：来自祖先与师长的德行',
      '第2卷：清晨的自我告诫',
      '第3卷：自然的和谐法则',
      '第4卷：内在心灵的避难所',
      '第5卷：清晨起身与工作之责',
    ],
  }
}

onMounted(() => {
  if (!props.initialBook) {
    void loadBookData()
  }
})
</script>

<style scoped>
.book-detail-mobile {
  min-height: 100vh;
  background-color: #ffffff;
  padding-bottom: 96px;
  box-sizing: border-box;
}

.book-detail-mobile__topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 16px;
  background-color: #ffffff;
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
  width: 32px;
  height: 32px;
  border-radius: 4px;
  border: 1px solid var(--a-color-border-soft, #eeeeee);
  background: #ffffff;
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
  border-radius: 4px;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  background-color: #f8fafc;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--a-shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.04));
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
  height: 40px;
  border-radius: var(--a-radius-control, 4px);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.book-detail-mobile__btn--primary {
  background-color: var(--a-color-text, #0f172a);
  color: #ffffff;
  border: 1px solid var(--a-color-text, #0f172a);
}

.book-detail-mobile__btn--primary:active {
  opacity: 0.9;
}

.book-detail-mobile__btn--secondary {
  background-color: #ffffff;
  color: var(--a-color-text, #0f172a);
  border: 1px solid var(--a-color-border-soft, #cbd5e1);
}

.book-detail-mobile__btn--secondary.is-in-shelf {
  background-color: #f8fafc;
  color: var(--a-color-text-secondary, #64748b);
  border-color: #e2e8f0;
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
  background-color: #fcfcfc;
  border: 1px solid var(--a-color-border-soft, #f1f5f9);
  border-radius: var(--a-radius-card, 4px);
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
  border-radius: var(--a-radius-card, 4px);
  overflow: hidden;
  background-color: #ffffff;
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
</style>
