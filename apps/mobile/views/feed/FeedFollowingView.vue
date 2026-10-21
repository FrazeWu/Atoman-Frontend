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
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import MIcon from '@mobile/components/ui/MIcon.vue'

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

const defaultSampleArticles: FollowingArticleItem[] = [
  {
    id: 'f-1',
    title: 'Vue 3.5 响应式系统深度解析',
    summary: '内存占用减少 56%，SSR 性能大幅飞跃，重构响应式双向链表。',
    sourceName: 'Evan You Blog',
    sourceAvatar: '',
    published_at: '2026-10-21T09:00:00Z',
    unread: true,
  },
  {
    id: 'f-2',
    title: 'TypeScript 5.8 发布速览',
    summary: '更精确的类型推导与更低的编译内存开销，模块检测行为全面优化。',
    sourceName: 'TypeScript Official',
    sourceAvatar: '',
    published_at: '2026-10-20T14:00:00Z',
    unread: true,
  },
  {
    id: 'f-3',
    title: '现代化微前端与跨端架构设计思考',
    summary: '探讨轻量单页应用在多端多宿主环境下的边界隔离与状态解耦方案。',
    sourceName: '前端技术周刊',
    sourceAvatar: '',
    published_at: '2026-10-19T16:30:00Z',
    unread: false,
  },
  {
    id: 'f-4',
    title: '用 Rust 编写高性能网络服务的一线经验',
    summary: '异步运行时 Tokio 的踩坑记录与内存零拷贝技术实践。',
    sourceName: 'Rust 观察',
    sourceAvatar: '',
    published_at: '2026-10-18T11:00:00Z',
    unread: false,
  },
]

const articles = ref<FollowingArticleItem[]>(
  props.initialArticles ? [...props.initialArticles] : defaultSampleArticles
)

const sourcesList = ref([
  { id: 'src-1', name: 'Evan You Blog' },
  { id: 'src-2', name: 'TypeScript Official' },
  { id: 'src-3', name: '前端技术周刊' },
  { id: 'src-4', name: 'Rust 观察' },
])

watch(
  () => props.initialArticles,
  (newVal) => {
    if (newVal) {
      articles.value = [...newVal]
    }
  },
  { deep: true }
)

function openArticle(id: string) {
  router.push(`/feed/article/${id}`)
}

function markAllAsRead() {
  articles.value = articles.value.map((a) => ({ ...a, unread: false }))
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
</script>

<style scoped>
.feed-following-view {
  min-height: 100vh;
  background-color: #ffffff;
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
  background: #ffffff;
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
  border-radius: var(--a-radius-card, 4px);
  background-color: #ffffff;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: pointer;
  box-shadow: var(--a-shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.02));
  transition: all 0.15s ease;
}

.feed-following-item:active {
  background-color: #f8fafc;
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
  background-color: var(--a-color-text, #0f172a);
  color: #ffffff;
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  border-radius: 4px;
}
</style>
