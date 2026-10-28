<template>
  <div class="feed-stream-view">
    <!-- Top Segmented Tabs: 推荐 / 订阅 -->
    <header class="feed-stream-header">
      <div class="feed-stream-tabs" role="tablist">
        <button
          type="button"
          class="feed-stream-tab"
          :class="{ 'is-active': activeTab === 'recommend' }"
          data-testid="feed-tab-recommend"
          role="tab"
          :aria-selected="activeTab === 'recommend'"
          @click="selectTab('recommend')"
        >
          推荐
        </button>
        <button
          type="button"
          class="feed-stream-tab"
          :class="{ 'is-active': activeTab === 'subscriptions' }"
          data-testid="feed-tab-subscriptions"
          role="tab"
          :aria-selected="activeTab === 'subscriptions'"
          @click="selectTab('subscriptions')"
        >
          订阅
        </button>
      </div>
    </header>

    <!-- Articles Stream -->
    <div v-if="loading" class="feed-stream-loading">
      <div v-for="n in 3" :key="n" class="feed-stream-skeleton">
        <div class="feed-skeleton-header">
          <div class="feed-skeleton-avatar" />
          <div class="feed-skeleton-meta" />
        </div>
        <div class="feed-skeleton-title" />
        <div class="feed-skeleton-summary" />
      </div>
    </div>

    <div v-else-if="articles.length === 0" class="feed-stream-empty">
      <p class="feed-stream-empty__title">{{ activeTab === 'subscriptions' ? '暂无订阅更新' : '暂无推荐内容' }}</p>
      <p class="feed-stream-empty__desc">{{ activeTab === 'subscriptions' ? '前往订阅源添加你感兴趣的 RSS 源或博主。' : '稍后再来看看吧。' }}</p>
    </div>

    <div v-else class="feed-stream-list">
      <article
        v-for="article in articles"
        :key="article.id"
        class="feed-article-item"
        data-testid="feed-article-item"
        @click="openArticle(article)"
      >
        <!-- Author Row -->
        <div class="feed-article-item__header">
          <MAvatar
            :src="article.author?.avatar"
            :name="article.author?.name || article.source_title || 'Feed'"
            :size="26"
            class="feed-article-item__avatar"
          />
          <div class="feed-article-item__author-info">
            <span class="feed-article-item__author">{{ article.author?.name || article.source_title || '匿名' }}</span>
            <span
              v-if="article.source_title && article.author?.name && article.source_title.trim().toLowerCase() !== article.author.name.trim().toLowerCase()"
              class="feed-article-item__source-bullet"
            >·</span>
            <span
              v-if="article.source_title && article.author?.name && article.source_title.trim().toLowerCase() !== article.author.name.trim().toLowerCase()"
              class="feed-article-item__source"
            >{{ article.source_title }}</span>
            <span v-if="formatTime(article.published_at)" class="feed-article-item__dot">·</span>
            <span v-if="formatTime(article.published_at)" class="feed-article-item__time">{{ formatTime(article.published_at) }}</span>
          </div>
        </div>

        <!-- Article Title & Summary -->
        <h2 class="feed-article-item__title">{{ decodeHtmlEntities(article.title) }}</h2>
        <p v-if="article.summary" class="feed-article-item__summary">{{ decodeHtmlEntities(article.summary) }}</p>

        <!-- Bottom Action Row -->
        <div class="feed-article-item__meta" @click.stop>
          <button
            type="button"
            class="feed-action-btn"
            :class="{ 'is-active': article.liked }"
            aria-label="赞"
            @click="toggleLike(article)"
          >
            <MIcon name="heart" size="xs" :stroke-width="1.8" />
            <span v-if="article.likes_count" class="feed-action-btn__count">{{ article.likes_count }}</span>
          </button>

          <button
            type="button"
            class="feed-action-btn"
            aria-label="评论"
            @click="openComments(article)"
          >
            <MIcon name="messages" size="xs" :stroke-width="1.8" />
            <span v-if="article.comments_count" class="feed-action-btn__count">{{ article.comments_count }}</span>
          </button>

          <button
            type="button"
            class="feed-action-btn feed-action-btn--bookmark"
            :class="{ 'is-active': article.bookmarked }"
            aria-label="稍后阅读"
            @click="toggleBookmark(article)"
          >
            <MIcon name="bookmark" size="xs" :stroke-width="1.8" />
            <span class="feed-action-btn__label">稍后阅读</span>
          </button>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import MAvatar from '@mobile/components/ui/MAvatar.vue'
import MIcon from '@mobile/components/ui/MIcon.vue'
import { useFeedStore } from '@/stores/feed'
import { apiRequestResult } from '@/api/client'
import { useApi } from '@/composables/useApi'

export interface FeedArticleItem {
  id: string
  title: string
  summary?: string
  content?: string
  author?: {
    name: string
    avatar?: string
  }
  source_title?: string
  published_at?: string
  likes_count?: number
  comments_count?: number
  liked?: boolean
  bookmarked?: boolean
  target_path?: string
}

const props = withDefaults(
  defineProps<{
    initialArticles?: FeedArticleItem[]
    initialTab?: 'recommend' | 'subscriptions'
  }>(),
  {
    initialArticles: undefined,
    initialTab: 'recommend',
  }
)

const emit = defineEmits<{
  (e: 'select', article: FeedArticleItem): void
  (e: 'update:tab', tab: 'recommend' | 'subscriptions'): void
}>()

const router = useRouter()
const api = useApi()
const feedStore = useFeedStore()

const defaultCuratedFeed: FeedArticleItem[] = [
  {
    id: 'art-1',
    title: '构建现代化纯白极简阅读体验',
    summary: '探索移动端纯白卡片流排版与 SF Symbols 图标设计系统在内容型应用中的实践。',
    author: { name: 'Alex' },
    source_title: '设计随笔',
    published_at: '2026-10-21T08:00:00Z',
    likes_count: 42,
    comments_count: 9,
    bookmarked: false,
  },
  {
    id: 'art-2',
    title: 'Swift 与 TypeScript 中的单向数据流实践',
    summary: '深入探讨移动端与桌面端共享核心状态模型的设计原则与事件派发机制。',
    author: { name: 'Sarah' },
    source_title: '工程架构',
    published_at: '2026-10-20T14:30:00Z',
    likes_count: 28,
    comments_count: 4,
    bookmarked: true,
  },
  {
    id: 'art-3',
    title: '数字极简主义与深度专注力重构',
    summary: '在海量碎片化信息中建立属于自己的宁静阅读避难所与思考仪式。',
    author: { name: '墨客' },
    source_title: '思辨日记',
    published_at: '2026-10-19T10:15:00Z',
    likes_count: 65,
    comments_count: 12,
    bookmarked: false,
  },
]

const activeTab = ref<'recommend' | 'subscriptions'>(props.initialTab)
const articlesList = ref<FeedArticleItem[]>(props.initialArticles ? [...props.initialArticles] : [...defaultCuratedFeed])
const loading = ref(false)

const articles = computed(() => {
  if (props.initialArticles) return props.initialArticles
  return articlesList.value
})

watch(() => props.initialArticles, (next) => {
  if (next) {
    articlesList.value = [...next]
  }
})

function selectTab(tab: 'recommend' | 'subscriptions') {
  activeTab.value = tab
  emit('update:tab', tab)
  if (!props.initialArticles) {
    void fetchArticles()
  }
}

function openArticle(article: FeedArticleItem) {
  emit('select', article)
  if (article.target_path) {
    if (article.target_path.startsWith('http://') || article.target_path.startsWith('https://')) {
      if (typeof window !== 'undefined') window.open(article.target_path, '_blank', 'noopener,noreferrer')
      return
    }
    void router.push(article.target_path)
    return
  }
  void router.push(`/feed/article/${article.id}`)
}

function toggleLike(article: FeedArticleItem) {
  article.liked = !article.liked
  if (article.liked) {
    article.likes_count = (article.likes_count || 0) + 1
  } else if (article.likes_count) {
    article.likes_count -= 1
  }
}

function openComments(article: FeedArticleItem) {
  void router.push(`/feed/article/${article.id}#comments`)
}

async function toggleBookmark(article: FeedArticleItem) {
  article.bookmarked = !article.bookmarked
  if (article.id && feedStore && typeof feedStore.toggleReadingListItem === 'function') {
    try {
      await feedStore.toggleReadingListItem(article.id)
    } catch {
      // ignore
    }
  }
}

function decodeHtmlEntities(text?: string): string {
  if (!text) return ''
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

function formatTime(isoString?: string): string {
  if (!isoString) return ''
  try {
    const date = new Date(isoString)
    const now = new Date()
    const diffHours = Math.round((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    if (diffHours < 1) return '刚刚'
    if (diffHours < 24) return `${diffHours}小时前`
    const diffDays = Math.round(diffHours / 24)
    if (diffDays <= 7) return `${diffDays}天前`
    return `${date.getMonth() + 1}/${date.getDate()}`
  } catch {
    return ''
  }
}

async function fetchArticles() {
  if (props.initialArticles) return
  loading.value = true
  try {
    if (activeTab.value === 'subscriptions') {
      await feedStore.fetchTimeline()
      const timeline = feedStore.timeline || []
      articlesList.value = timeline
        .map((item) => {
          const feedItem = item.feed_item
          const post = item.post
          const title = feedItem?.title || post?.title || ''
          return {
            id: feedItem?.id || post?.id || '',
            title,
            summary: feedItem?.summary || post?.summary || '',
            author: {
              name: feedItem?.author || post?.author?.nickname || post?.user?.display_name || post?.user?.username || feedItem?.feed_source?.title || '订阅源',
              avatar: post?.author?.avatar || post?.user?.avatar_url || '',
            },
            source_title: feedItem?.feed_source?.title || post?.channel?.name,
            published_at: feedItem?.published_at || post?.published_at || item.published_at,
            likes_count: post?.likes_count || 0,
            comments_count: post?.comments_count || 0,
            bookmarked: Boolean(post?.bookmarked),
          }
        })
        .filter((item) => Boolean(item.title))
    } else {
      // Primary: recommended articles API
      const recRes = await apiRequestResult(`${api.url}/feed/recommend/articles?page=1&page_size=20&mode=hot`)
      const recItems = recRes.ok && Array.isArray(recRes.data?.data) ? recRes.data.data : []
      if (recItems.length > 0) {
        articlesList.value = recItems
          .map((item: any) => ({
            id: String(item.id),
            title: item.title || '',
            summary: item.summary || item.description || '',
            author: {
              name: item.source_title || '推荐',
              avatar: item.source_image_url || item.image_url || '',
            },
            source_title: item.source_title,
            published_at: item.last_published_at || item.published_at || item.created_at,
            likes_count: item.view_count || 0,
            comments_count: item.bookmark_count || 0,
            bookmarked: false,
            target_path: item.target_path || (item.id ? `/feed/article/${item.id}` : undefined),
          }))
          .filter((item: FeedArticleItem) => Boolean(item.title))
      } else {
        // Fallback: explore feed API
        const exploreRes = await apiRequestResult(`${api.url}/feed/explore?limit=20`)
        const exploreItems = exploreRes.ok && Array.isArray(exploreRes.data?.data) ? exploreRes.data.data : []
        articlesList.value = exploreItems
          .map((raw: any) => {
            const item = raw.feed_item || raw.post || raw
            return {
              id: String(item.id || raw.id || ''),
              title: item.title || '',
              summary: item.summary || item.snippet || item.description || '',
              author: {
                name: item.author || item.feed_source?.title || item.source_title || '推荐',
                avatar: item.feed_source?.icon_url || item.author_avatar || '',
              },
              source_title: item.feed_source?.title || item.source_title,
              published_at: item.published_at || raw.published_at || item.created_at,
              likes_count: item.likes_count || 0,
              comments_count: item.comments_count || 0,
              bookmarked: Boolean(item.bookmarked),
              target_path: item.url || (item.id ? `/feed/article/${item.id}` : undefined),
            }
          })
          .filter((item: FeedArticleItem) => Boolean(item.title))
      }
    }
  } catch {
    if (!props.initialArticles) {
      articlesList.value = [...defaultCuratedFeed]
    } else {
      articlesList.value = []
    }
  } finally {
    if (!props.initialArticles && articlesList.value.length === 0) {
      articlesList.value = [...defaultCuratedFeed]
    }
    loading.value = false
  }
}

onMounted(() => {
  if (!props.initialArticles) {
    void fetchArticles()
  }
})
</script>

<style scoped>
.feed-stream-view {
  min-height: 100vh;
  background-color: var(--a-color-bg, #ffffff);
  padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px));
}

.feed-stream-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: var(--a-color-surface, #ffffff);
  border-bottom: 1px solid var(--a-color-border-soft, #e2e8f0);
  padding: 8px 16px;
}

.feed-stream-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--a-color-surface-muted, #f1f5f9);
  padding: 3px;
  border-radius: var(--a-radius-control, 4px);
  width: fit-content;
}

.feed-stream-tab {
  border: none;
  background: transparent;
  color: var(--a-color-muted, #64748b);
  font-size: 13px;
  font-weight: 500;
  padding: 5px 14px;
  border-radius: calc(var(--a-radius-control, 4px) - 1px);
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

.feed-stream-tab.is-active {
  background-color: var(--a-color-surface, #ffffff);
  color: var(--a-color-text, #0f172a);
  font-weight: 600;
  border: 1px solid var(--a-color-border-soft);
  box-shadow: none !important;
}

.feed-stream-list {
  display: flex;
  flex-direction: column;
}

.feed-article-item {
  padding: 16px;
  border-bottom: 1px solid var(--a-color-border-soft, #f1f5f9);
  cursor: pointer;
  transition: background-color 0.12s ease;
}

.feed-article-item:active {
  background-color: var(--a-color-surface-muted, #f8fafc);
}

.feed-article-item__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.feed-article-item__avatar {
  border-radius: 4px;
}

.feed-article-item__author-info {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--a-color-muted, #64748b);
  overflow: hidden;
  white-space: nowrap;
}

.feed-article-item__author {
  font-weight: 500;
  color: var(--a-color-text, #0f172a);
}

.feed-article-item__source-bullet,
.feed-article-item__dot {
  color: var(--a-color-muted, #94a3b8);
}

.feed-article-item__source {
  color: var(--a-color-muted, #64748b);
}

.feed-article-item__time {
  color: var(--a-color-muted, #94a3b8);
}

.feed-article-item__title {
  margin: 0 0 6px 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--a-color-text, #0f172a);
  letter-spacing: -0.01em;
}

.feed-article-item__summary {
  margin: 0 0 12px 0;
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--a-color-text-secondary, #475569);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.feed-article-item__meta {
  display: flex;
  align-items: center;
  gap: 16px;
}

.feed-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  padding: 6px;
  min-width: 44px;
  min-height: 44px;
  justify-content: center;
  border-radius: 4px;
  font-size: 12px;
  color: var(--a-color-muted, #64748b);
  cursor: pointer;
  transition: all 0.15s ease;
}

.feed-action-btn:active {
  background-color: var(--a-color-surface-muted, #f1f5f9);
}

.feed-action-btn.is-active {
  color: var(--a-color-primary, #0066cc);
}

.feed-action-btn--bookmark.is-active {
  color: #f59e0b;
}

.feed-action-btn__count {
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.feed-action-btn__label {
  font-size: 11.5px;
}

.feed-stream-empty {
  padding: 64px 24px;
  text-align: center;
}

.feed-stream-empty__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
  margin-bottom: 6px;
}

.feed-stream-empty__desc {
  font-size: 13px;
  color: var(--a-color-muted, #64748b);
  margin: 0;
}

.feed-stream-loading {
  padding: 16px;
}

.feed-stream-skeleton {
  padding: 12px 0;
  border-bottom: 1px solid var(--a-color-border-soft, #f1f5f9);
}

.feed-skeleton-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.feed-skeleton-avatar {
  width: 24px;
  height: 24px;
  background-color: var(--a-color-surface-muted, #f1f5f9);
  border-radius: 4px;
}

.feed-skeleton-meta {
  width: 90px;
  height: 12px;
  background-color: var(--a-color-surface-muted, #f1f5f9);
  border-radius: 3px;
}

.feed-skeleton-title {
  width: 75%;
  height: 18px;
  background-color: var(--a-color-surface-muted, #f1f5f9);
  border-radius: 4px;
  margin-bottom: 6px;
}

.feed-skeleton-summary {
  width: 95%;
  height: 14px;
  background-color: var(--a-color-surface-muted, #f1f5f9);
  border-radius: 4px;
}
</style>
