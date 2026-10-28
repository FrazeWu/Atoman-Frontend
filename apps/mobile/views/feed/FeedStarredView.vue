<template>
  <div class="feed-starred-view">
    <!-- Header -->
    <header class="feed-starred-header">
      <div class="feed-starred-header__top">
        <h1 class="feed-starred-header__title">我的收藏</h1>
        <span v-if="!isGuest" class="feed-starred-header__count">{{ filteredArticles.length }} 篇</span>
      </div>
      <p class="feed-starred-header__subtitle">随时重温的高价值深度文章</p>

      <!-- Category Filter Chips -->
      <div v-if="!isGuest && articles.length > 0" class="feed-starred-chips">
        <button
          v-for="cat in categories"
          :key="cat"
          type="button"
          class="feed-starred-chip"
          :class="{ 'is-active': activeCategory === cat }"
          @click="activeCategory = cat"
        >
          {{ cat }}
        </button>
      </div>
    </header>

    <!-- Starred List -->
    <main class="feed-starred-content">
      <div v-if="isGuest" class="feed-starred-empty" data-testid="feed-starred-guest-state">
        <div class="feed-starred-empty__icon"><MIcon name="bookmark" size="lg" /></div>
        <p class="feed-starred-empty__title">登录查看收藏</p>
        <p class="feed-starred-empty__desc">登录后可同步稍后阅读的文章。</p>
        <RouterLink class="feed-starred-empty__action" to="/login?redirect=/feed/starred">立即登录</RouterLink>
      </div>
      <div v-else-if="filteredArticles.length > 0" class="feed-starred-list">
        <article
          v-for="article in filteredArticles"
          :key="article.id"
          class="feed-starred-item"
          data-testid="starred-article-item"
          @click="openArticle(article.id)"
        >
          <div class="feed-starred-item__meta">
            <span v-if="article.category" class="feed-starred-item__category-badge">
              {{ article.category }}
            </span>
            <span class="feed-starred-item__source">{{ article.sourceName }}</span>
            <span class="feed-starred-item__time">{{ formatTime(article.savedAt) }}</span>
          </div>

          <h2 class="feed-starred-item__title">{{ article.title }}</h2>

          <div class="feed-starred-item__footer">
            <span class="feed-starred-item__hint">点击阅读全文</span>
            <button
              type="button"
              class="feed-starred-item__unstar-btn"
              :data-testid="`unstar-btn-${article.id}`"
              title="取消收藏"
              @click.stop="unstar(article.id)"
            >
              <MIcon name="bookmark" size="xs" />
              <span>取消收藏</span>
            </button>
          </div>
        </article>
      </div>

      <!-- Empty State -->
      <div v-else class="feed-starred-empty">
        <div class="feed-starred-empty__icon">
          <MIcon name="bookmark" size="lg" />
        </div>
        <p class="feed-starred-empty__title">暂无收藏文章</p>
        <p class="feed-starred-empty__desc">在阅读文章时点击收藏书签，即可在此随时温习。</p>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getActivePinia } from 'pinia'
import MIcon from '@mobile/components/ui/MIcon.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { useApi } from '@/composables/useApi'
import { apiRequestResult } from '@/api/client'

export interface StarredArticleItem {
  id: string
  title: string
  sourceName: string
  category?: string
  savedAt?: string
}

const props = withDefaults(
  defineProps<{
    initialArticles?: StarredArticleItem[]
  }>(),
  {
    initialArticles: undefined,
  }
)

const router = useRouter()
const api = useApi()
const authStore = getActivePinia() ? useAuthStore() : null
const isGuest = computed(() => props.initialArticles === undefined && !authStore?.isAuthenticated)
const feedStore = getActivePinia() ? useFeedStore() : null

const articles = ref<StarredArticleItem[]>(
  props.initialArticles ? [...props.initialArticles] : []
)

const categories = ['全部', '技术', '设计', '思考']
const activeCategory = ref('全部')

watch(
  () => props.initialArticles,
  (newVal) => {
    if (newVal) {
      articles.value = [...newVal]
    }
  },
  { deep: true }
)

const filteredArticles = computed(() => {
  if (activeCategory.value === '全部') return articles.value
  return articles.value.filter((a) => a.category === activeCategory.value)
})

function openArticle(id: string) {
  router.push(`/feed/article/${id}`)
}

async function unstar(id: string) {
  const prevArticles = [...articles.value]
  articles.value = articles.value.filter((a) => a.id !== id)
  if (feedStore?.toggleStar) {
    try {
      await feedStore.toggleStar(id)
    } catch {
      articles.value = prevArticles
    }
  }
}

function formatTime(isoString?: string): string {
  if (!isoString) return '近期'
  try {
    const d = new Date(isoString)
    const month = d.getMonth() + 1
    const day = d.getDate()
    return `${month}月${day}日收藏`
  } catch {
    return '已收藏'
  }
}

async function loadStarredArticles() {
  if (props.initialArticles || !authStore?.isAuthenticated) return
  try {
    const res = await apiRequestResult(`${api.url}/feed/stars?page=1&limit=50`, {
      headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : undefined,
    })
    if (res.ok && res.data) {
      const data = res.data as any
      const itemsList = data?.items || data?.data?.items || []
      if (Array.isArray(itemsList) && itemsList.length > 0) {
        articles.value = itemsList.map((item: any) => ({
          id: String(item.id),
          title: item.title,
          sourceName: item.source_title || 'RSS',
          category: item.category || '全部',
          savedAt: item.starred_at || item.created_at,
        }))
      } else if (authStore.isAuthenticated) {
        articles.value = []
      }
    }
  } catch {
    // Graceful fallback
  }
}

onMounted(() => {
  void loadStarredArticles()
})
</script>

<style scoped>
.feed-starred-empty__action {
  display: inline-flex; min-height: 44px; padding: 0 18px; margin-top: 12px;
  align-items: center; justify-content: center; text-decoration: none;
  background: var(--a-color-primary); color: #fff; border-radius: var(--a-radius-control);
}
.feed-starred-view {
  min-height: 100vh;
  background-color: var(--a-color-bg, #ffffff);
  padding: 16px 16px 96px;
  box-sizing: border-box;
}

.feed-starred-header {
  margin-bottom: 16px;
}

.feed-starred-header__top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.feed-starred-header__title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
  letter-spacing: -0.01em;
}

.feed-starred-header__count {
  font-size: 12px;
  color: var(--a-color-text-muted, #94a3b8);
}

.feed-starred-header__subtitle {
  margin: 4px 0 12px;
  font-size: 13px;
  color: var(--a-color-text-secondary, #64748b);
}

.feed-starred-chips {
  display: flex;
  gap: 8px;
}

.feed-starred-chip {
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  border-radius: var(--a-radius-control, 4px);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  background: var(--a-color-surface, #ffffff);
  color: var(--a-color-text-secondary, #64748b);
  cursor: pointer;
  transition: all 0.15s ease;
}

.feed-starred-chip.is-active {
  background-color: var(--a-color-primary, #0f172a);
  color: var(--a-color-primary-contrast, #ffffff);
  border-color: var(--a-color-primary, #0f172a);
}

.feed-starred-content {
  display: flex;
  flex-direction: column;
}

.feed-starred-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.feed-starred-item {
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

.feed-starred-item:active {
  background-color: #f8fafc;
}

.feed-starred-item__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}

.feed-starred-item__category-badge {
  font-size: 10px;
  font-weight: 600;
  color: #0369a1;
  background-color: #f0f9ff;
  border: 1px solid #bae6fd;
  padding: 1px 5px;
  border-radius: 2px;
}

.feed-starred-item__source {
  color: var(--a-color-text-secondary, #475569);
  font-weight: 500;
}

.feed-starred-item__time {
  color: var(--a-color-text-muted, #94a3b8);
  margin-left: auto;
}

.feed-starred-item__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--a-color-text, #0f172a);
}

.feed-starred-item__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 6px;
  border-top: 1px solid var(--a-color-border-soft, #f1f5f9);
}

.feed-starred-item__hint {
  font-size: 11px;
  color: var(--a-color-text-muted, #94a3b8);
}

.feed-starred-item__unstar-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  color: var(--a-color-text-secondary, #64748b);
  background: none;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: 3px;
  padding: 3px 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.feed-starred-item__unstar-btn:active {
  color: #dc2626;
  border-color: #fecaca;
  background-color: #fef2f2;
}

.feed-starred-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 64px 20px;
}

.feed-starred-empty__icon {
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

.feed-starred-empty__title {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.feed-starred-empty__desc {
  margin: 0;
  font-size: 13px;
  color: var(--a-color-text-secondary, #64748b);
  line-height: 1.5;
}
</style>
