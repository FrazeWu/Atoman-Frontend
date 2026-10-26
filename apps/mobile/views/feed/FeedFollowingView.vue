<template>
  <div class="feed-following-view">
    <!-- Header -->
    <header class="feed-following-header">
      <div class="feed-following-header__row">
        <div>
          <h1 class="feed-following-header__title">关注动态</h1>
          <p class="feed-following-header__subtitle">聚合关注源的最新时间线更新</p>
        </div>
        <button
          type="button"
          class="feed-following-header__action-btn"
          data-testid="mark-all-read-btn"
          @click="markAllAsRead"
        >
          <MIcon name="bookmark" size="xs" />
          <span>全部已读</span>
        </button>
      </div>

      <!-- Sources Quick Bar -->
      <div class="feed-following-sources-bar">
        <router-link to="/feed/sources" class="feed-following-manage-link">
          <MIcon name="antenna" size="xs" />
          <span>管理订阅 ({{ sourcesList.length }})</span>
        </router-link>
      </div>
    </header>

    <!-- Articles Stream -->
    <main class="feed-following-content">
      <div v-if="articles.length > 0" class="feed-following-list">
        <article
          v-for="article in articles"
          :key="article.id"
          class="feed-following-item"
          :class="{ 'is-unread': article.unread }"
          data-testid="following-article-item"
          @click="openArticle(article.id)"
        >
          <!-- Source & Meta -->
          <div class="feed-following-item__meta">
            <div class="feed-following-item__source-info">
              <div class="feed-following-item__avatar">
                <span>{{ article.sourceName.slice(0, 1) }}</span>
              </div>
              <span class="feed-following-item__source-name">{{ article.sourceName }}</span>
            </div>
            <div class="feed-following-item__right-meta">
              <span v-if="article.unread" class="feed-following-item__unread-dot" />
              <span class="feed-following-item__time">{{ formatTime(article.published_at) }}</span>
            </div>
          </div>

          <!-- Title & Snippet -->
          <h2 class="feed-following-item__title">{{ article.title }}</h2>
          <p v-if="article.summary" class="feed-following-item__summary">{{ article.summary }}</p>
        </article>
      </div>

      <!-- Empty State -->
      <div v-else class="feed-following-empty">
        <div class="feed-following-empty__icon">
          <MIcon name="antenna" size="lg" />
        </div>
        <p class="feed-following-empty__title">暂无关注动态</p>
        <p class="feed-following-empty__desc">前往订阅源添加你感兴趣的 RSS 订阅源或博主。</p>
        <router-link to="/feed/sources" class="feed-following-empty__btn">
          发现与管理订阅
        </router-link>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getActivePinia } from 'pinia'
import MIcon from '@mobile/components/ui/MIcon.vue'
import { useFeedStore } from '@/stores/feed'
import { useAuthStore } from '@/stores/auth'

export interface FollowingArticleItem {
  id: string
  title: string
  summary?: string
  sourceName: string
  sourceAvatar?: string
  published_at?: string
  unread?: boolean
}

const props = withDefaults(
  defineProps<{
    initialArticles?: FollowingArticleItem[]
  }>(),
  {
    initialArticles: undefined,
  }
)

const router = useRouter()
const feedStore = getActivePinia() ? useFeedStore() : null
const authStore = getActivePinia() ? useAuthStore() : null

function mapTimelineItem(item: any): FollowingArticleItem {
  const fi = item.feed_item || item
  return {
    id: String(fi.id),
    title: fi.title || '',
    summary: fi.summary || fi.description || '',
    sourceName: fi.source_title || 'RSS',
    sourceAvatar: fi.source_avatar || '',
    published_at: fi.published_at || item.published_at,
    unread: !fi.is_read && !item.is_read,
  }
}

const articles = ref<FollowingArticleItem[]>(
  props.initialArticles
    ? [...props.initialArticles]
    : feedStore && feedStore.timeline.length > 0
      ? feedStore.timeline.map(mapTimelineItem)
      : []
)

const sourcesList = ref<{ id: string; name: string }[]>(
  feedStore?.subscriptions && feedStore.subscriptions.length > 0
    ? feedStore.subscriptions.map((s) => ({ id: s.id, name: s.title || '未命名订阅源' }))
    : []
)

watch(
  () => props.initialArticles,
  (newVal) => {
    if (newVal) {
      articles.value = [...newVal]
    }
  },
  { deep: true }
)

watch(
  () => feedStore?.timeline,
  (timeline) => {
    if (!props.initialArticles && timeline) {
      articles.value = timeline.map(mapTimelineItem)
    }
  },
  { immediate: true }
)

watch(
  () => feedStore?.subscriptions,
  (subs) => {
    if (subs && subs.length > 0) {
      sourcesList.value = subs.map((s) => ({ id: s.id, name: s.title || '未命名订阅源' }))
    }
  },
  { immediate: true }
)

function openArticle(id: string) {
  const item = articles.value.find((a) => a.id === id)
  if (item) {
    item.unread = false
  }
  if (feedStore?.markItemsRead) {
    void feedStore.markItemsRead([id]).catch(() => {})
  }
  router.push(`/feed/article/${id}`)
}

async function markAllAsRead() {
  articles.value = articles.value.map((a) => ({ ...a, unread: false }))
  if (feedStore?.markAllFeedRead) {
    try {
      await feedStore.markAllFeedRead()
    } catch {
      // Graceful fallback
    }
  }
}

function formatTime(isoString?: string): string {
  if (!isoString) return '刚刚'
  try {
    const d = new Date(isoString)
    const month = d.getMonth() + 1
    const day = d.getDate()
    const hours = String(d.getHours()).padStart(2, '0')
    const mins = String(d.getMinutes()).padStart(2, '0')
    return `${month}月${day}日 ${hours}:${mins}`
  } catch {
    return '近期'
  }
}

onMounted(async () => {
  if (!props.initialArticles && feedStore) {
    try {
      await Promise.allSettled([
        feedStore.fetchTimeline?.(),
        feedStore.fetchSubscriptions?.(),
      ])
      if (feedStore.timeline?.length) {
        articles.value = feedStore.timeline.map(mapTimelineItem)
      } else if (authStore?.isAuthenticated) {
        articles.value = []
      }
    } catch {
      // Graceful fallback
    }
  }
})
</script>

<style scoped>
.feed-following-view {
  min-height: 100vh;
  background-color: var(--a-color-bg, #ffffff);
  padding: 16px 16px 96px;
  box-sizing: border-box;
}

.feed-following-header {
  margin-bottom: 16px;
}

.feed-following-header__row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.feed-following-header__title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
  letter-spacing: -0.01em;
}

.feed-following-header__subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--a-color-text-secondary, #64748b);
}

.feed-following-header__action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  color: var(--a-color-text-secondary, #64748b);
  background: var(--a-color-surface, #ffffff);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
  padding: 5px 8px;
  cursor: pointer;
  flex-shrink: 0;
}

.feed-following-sources-bar {
  margin-top: 12px;
  display: flex;
  align-items: center;
}

.feed-following-manage-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  color: var(--a-color-text, #0f172a);
  text-decoration: none;
  background-color: #f8fafc;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: 4px;
  padding: 4px 10px;
}

.feed-following-content {
  display: flex;
  flex-direction: column;
}

.feed-following-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.feed-following-item {
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
  background-color: var(--a-color-surface, #ffffff);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: pointer;
  box-shadow: none !important;
  transition: all 0.15s ease;
}

.feed-following-item:active {
  background-color: var(--a-color-surface-hover, #f8fafc);
}

.feed-following-item.is-unread {
  border-left: 3px solid var(--a-color-text, #0f172a);
}

.feed-following-item__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.feed-following-item__source-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.feed-following-item__avatar {
  width: 20px;
  height: 20px;
  border-radius: 3px;
  background-color: #f1f5f9;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.feed-following-item__source-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--a-color-text-secondary, #475569);
}

.feed-following-item__right-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.feed-following-item__unread-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #2563eb;
}

.feed-following-item__time {
  font-size: 11px;
  color: var(--a-color-text-muted, #94a3b8);
}

.feed-following-item__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--a-color-text, #0f172a);
}

.feed-following-item__summary {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--a-color-text-secondary, #64748b);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.feed-following-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 64px 20px;
}

.feed-following-empty__icon {
  width: 52px;
  height: 52px;
  border-radius: 4px;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  background-color: #f8fafc;
  color: var(--a-color-text-muted, #94a3b8);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
}

.feed-following-empty__title {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.feed-following-empty__desc {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--a-color-text-secondary, #64748b);
  line-height: 1.5;
}

.feed-following-empty__btn {
  display: inline-block;
  padding: 8px 16px;
  background-color: var(--a-color-primary, #0f172a);
  color: var(--a-color-primary-contrast, #ffffff);
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  border-radius: var(--a-radius-control, 4px);
}
</style>
