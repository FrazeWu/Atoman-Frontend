<template>
  <div class="feed-article-reader">
    <!-- Sticky Top Navigation Bar -->
    <header class="feed-reader-topbar">
      <button
        type="button"
        class="feed-reader-topbar__btn"
        data-testid="reader-back-btn"
        aria-label="返回"
        @click="handleBack"
      >
        <MIcon name="chevron-left" size="md" :stroke-width="2" />
      </button>

      <span class="feed-reader-topbar__title">{{ currentArticle?.title || '阅读文章' }}</span>

      <button
        type="button"
        class="feed-reader-topbar__btn feed-reader-topbar__btn--bookmark"
        :class="{ 'is-bookmarked': isBookmarked }"
        data-testid="reader-bookmark-btn"
        aria-label="收藏"
        @click="handleToggleBookmark"
      >
        <MIcon name="bookmark" size="md" :stroke-width="isBookmarked ? 2.4 : 1.8" />
      </button>
    </header>

    <!-- Loading State -->
    <div v-if="loading" class="feed-reader-loading">
      <div class="feed-reader-skeleton-title" />
      <div class="feed-reader-skeleton-meta" />
      <div v-for="n in 6" :key="n" class="feed-reader-skeleton-para" />
    </div>

    <!-- Article Content -->
    <main v-else-if="currentArticle" class="feed-reader-main">
      <h1 class="feed-reader-title">{{ currentArticle.title }}</h1>

      <div class="feed-reader-meta">
        <span class="feed-reader-meta__author">{{ currentArticle.author_name || '佚名' }}</span>
        <span v-if="currentArticle.source_title" class="feed-reader-meta__dot">·</span>
        <span v-if="currentArticle.source_title" class="feed-reader-meta__source">{{ currentArticle.source_title }}</span>
        <span v-if="currentArticle.published_at" class="feed-reader-meta__dot">·</span>
        <span v-if="currentArticle.published_at" class="feed-reader-meta__date">{{ formatDate(currentArticle.published_at) }}</span>
      </div>

      <div
        class="feed-reader-content article-typography"
        data-testid="reader-content"
        v-html="sanitizedContent"
      />
    </main>

    <!-- Empty State -->
    <div v-else class="feed-reader-empty">
      <p>未找到文章内容</p>
    </div>

    <!-- Bottom Floating Reading Actions Bar -->
    <footer v-if="currentArticle" class="feed-reader-bottom-bar">
      <button
        type="button"
        class="feed-reader-action"
        :class="{ 'is-active': isBookmarked }"
        @click="handleToggleBookmark"
      >
        <MIcon name="bookmark" size="sm" />
        <span>{{ isBookmarked ? '已稍后读' : '稍后阅读' }}</span>
      </button>

      <button
        type="button"
        class="feed-reader-action"
        @click="handleShare"
      >
        <MIcon name="share" size="sm" />
        <span>分享</span>
      </button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DOMPurify from 'dompurify'
import MIcon from '@mobile/components/ui/MIcon.vue'
import { apiRequestResult } from '@/api/client'
import { useApi } from '@/composables/useApi'
import { useFeedStore } from '@/stores/feed'

export interface ArticleDetailData {
  id: string
  title: string
  content?: string
  author_name?: string
  source_title?: string
  published_at?: string
  bookmarked?: boolean
}

const props = withDefaults(
  defineProps<{
    article?: ArticleDetailData
  }>(),
  {
    article: undefined,
  }
)

const emit = defineEmits<{
  (e: 'toggle-bookmark', bookmarked: boolean): void
}>()

const route = useRoute()
const router = useRouter()
const api = useApi()
const feedStore = useFeedStore()

const loadedArticle = ref<ArticleDetailData | null>(null)
const loading = ref(false)
const localBookmarked = ref(Boolean(props.article?.bookmarked))

const currentArticle = computed(() => props.article || loadedArticle.value)
const isBookmarked = computed(() => {
  if (props.article) return localBookmarked.value
  return Boolean(loadedArticle.value?.bookmarked)
})

watch(() => props.article?.bookmarked, (val) => {
  if (typeof val === 'boolean') {
    localBookmarked.value = val
  }
})

const sanitizedContent = computed(() => {
  const raw = currentArticle.value?.content || ''
  if (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize) {
    return DOMPurify.sanitize(raw)
  }
  return raw
})

function handleBack() {
  router.back()
}

function handleToggleBookmark() {
  localBookmarked.value = !localBookmarked.value
  if (loadedArticle.value) {
    loadedArticle.value.bookmarked = localBookmarked.value
  }
  emit('toggle-bookmark', localBookmarked.value)
}

function handleShare() {
  if (navigator.share && currentArticle.value) {
    void navigator.share({
      title: currentArticle.value.title,
      url: window.location.href,
    }).catch(() => {})
  }
}

function formatDate(isoString?: string): string {
  if (!isoString) return ''
  try {
    const d = new Date(isoString)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  } catch {
    return ''
  }
}

async function fetchArticleById(id: string) {
  if (props.article) return
  loading.value = true
  try {
    const res = await apiRequestResult(`${api.url}/feed/items/${id}`)
    if (res.ok && res.data?.data) {
      const item = res.data.data.item || res.data.data
      const reader = res.data.data.reader
      loadedArticle.value = {
        id: String(item.id),
        title: item.title || '',
        content: reader?.content || item.content || item.summary || '',
        author_name: item.author || item.feed_source?.title || '',
        source_title: item.feed_source?.title,
        published_at: item.published_at,
        bookmarked: Boolean(item.bookmarked),
      }
      localBookmarked.value = Boolean(item.bookmarked)
    }
  } catch {
    // Graceful fallback
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (!props.article && route.params.id) {
    void fetchArticleById(String(route.params.id))
  }
})
</script>

<style scoped>
.feed-article-reader {
  min-height: 100vh;
  background-color: #ffffff;
  color: var(--a-color-text, #0f172a);
  padding-bottom: 80px;
}

.feed-reader-topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: calc(48px + env(safe-area-inset-top, 0px));
  padding-top: env(safe-area-inset-top, 0px);
  padding-left: 8px;
  padding-right: 8px;
  background-color: #ffffff;
  border-bottom: 1px solid var(--a-color-border-soft, #e2e8f0);
}

.feed-reader-topbar__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: transparent;
  border: none;
  border-radius: var(--a-radius-control, 4px);
  color: var(--a-color-text, #0f172a);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.feed-reader-topbar__btn:active {
  background-color: var(--a-color-surface-muted, #f1f5f9);
}

.feed-reader-topbar__btn--bookmark.is-bookmarked {
  color: #f59e0b;
}

.feed-reader-topbar__title {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 60%;
  text-align: center;
}

.feed-reader-main {
  padding: 20px 18px 40px;
  max-width: 680px;
  margin: 0 auto;
}

.feed-reader-title {
  font-size: 22px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--a-color-text, #0f172a);
  margin: 0 0 12px 0;
  letter-spacing: -0.015em;
}

.feed-reader-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--a-color-muted, #64748b);
  margin-bottom: 24px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--a-color-border-soft, #f1f5f9);
}

.feed-reader-meta__author {
  font-weight: 500;
  color: var(--a-color-text, #0f172a);
}

.feed-reader-meta__dot {
  color: var(--a-color-muted, #94a3b8);
}

.feed-reader-content {
  font-size: 16px;
  line-height: 1.75;
  color: #1e293b;
  word-break: break-word;
}

.feed-reader-content :deep(p) {
  margin-top: 0;
  margin-bottom: 1.25em;
}

.feed-reader-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: var(--a-radius-card, 4px);
  margin: 1em 0;
}

.feed-reader-content :deep(a) {
  color: var(--a-color-primary, #0066cc);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.feed-reader-content :deep(blockquote) {
  border-left: 3px solid var(--a-color-border, #cbd5e1);
  margin: 1.2em 0;
  padding-left: 14px;
  color: var(--a-color-muted, #64748b);
  font-style: italic;
}

.feed-reader-bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: calc(52px + env(safe-area-inset-bottom, 0px));
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background-color: #ffffff;
  border-top: 1px solid var(--a-color-border-soft, #e2e8f0);
  display: flex;
  align-items: center;
  justify-content: space-around;
  z-index: 15;
}

.feed-reader-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  font-size: 13px;
  color: var(--a-color-muted, #64748b);
  cursor: pointer;
  padding: 8px 16px;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.feed-reader-action:active {
  background-color: var(--a-color-surface-muted, #f1f5f9);
}

.feed-reader-action.is-active {
  color: #f59e0b;
}

.feed-reader-loading,
.feed-reader-empty {
  padding: 40px 20px;
  text-align: center;
}

.feed-reader-skeleton-title {
  height: 28px;
  width: 80%;
  background-color: var(--a-color-surface-muted, #f1f5f9);
  border-radius: 4px;
  margin-bottom: 12px;
}

.feed-reader-skeleton-meta {
  height: 14px;
  width: 40%;
  background-color: var(--a-color-surface-muted, #f1f5f9);
  border-radius: 4px;
  margin-bottom: 24px;
}

.feed-reader-skeleton-para {
  height: 16px;
  background-color: var(--a-color-surface-muted, #f1f5f9);
  border-radius: 4px;
  margin-bottom: 12px;
}
</style>
