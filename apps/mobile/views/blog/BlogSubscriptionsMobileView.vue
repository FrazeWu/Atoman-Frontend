<template>
  <div class="blog-subscriptions-mobile">
    <!-- Topbar -->
    <header class="blog-subs-topbar">
      <button
        type="button"
        class="blog-subs-topbar__btn"
        data-testid="subs-back-btn"
        aria-label="返回"
        @click="handleBack"
      >
        <MIcon name="chevron-left" size="md" />
      </button>

      <span class="blog-subs-topbar__title">我的订阅</span>

      <button
        v-if="authStore?.isAuthenticated && items.length > 0"
        type="button"
        class="blog-subs-topbar__action-btn"
        data-testid="mark-all-read-btn"
        @click="handleMarkAllRead"
      >
        全部已读
      </button>
      <div v-else class="blog-subs-topbar__placeholder" />
    </header>

    <main class="blog-subs-main">
      <!-- Guest State -->
      <div v-if="!authStore?.isAuthenticated" class="blog-subs-guest">
        <MGuestCard
          title="登录查看订阅动态"
          description="登录后即可同步你的关注作者与订阅专栏动态。"
        />
      </div>

      <template v-else>
        <!-- Loading State -->
        <div v-if="loading && items.length === 0" class="blog-subs-loading">
          <div v-for="n in 3" :key="n" class="blog-subs-skeleton" />
        </div>

        <!-- Empty State -->
        <div v-else-if="items.length === 0" class="blog-subs-empty" data-testid="subs-empty">
          <div class="blog-subs-empty__icon">
            <MIcon name="antenna" size="lg" />
          </div>
          <p class="blog-subs-empty__title">暂无订阅更新</p>
          <p class="blog-subs-empty__desc">关注你感兴趣的创作者或专栏，获取最新的文章与短笺。</p>
          <router-link to="/posts" class="blog-subs-empty__link">
            <MButton variant="secondary" size="sm">发现优质内容</MButton>
          </router-link>
        </div>

        <!-- Feed List -->
        <div v-else class="blog-subs-list" data-testid="subs-list">
          <article
            v-for="item in items"
            :key="item.id"
            class="blog-subs-card"
            :class="{ 'is-unread': item.unread }"
            @click="openItem(item)"
          >
            <div class="blog-subs-card__meta">
              <MAvatar :src="item.author.avatar" :name="item.author.name" :size="20" />
              <span class="blog-subs-card__author">{{ item.author.name }}</span>
              <span v-if="item.channel_name" class="blog-subs-card__channel">· {{ item.channel_name }}</span>
              <span class="blog-subs-card__dot">·</span>
              <span class="blog-subs-card__time">{{ formatTime(item.published_at) }}</span>
              <span v-if="item.unread" class="blog-subs-card__unread-badge" />
            </div>

            <h3 class="blog-subs-card__title">{{ item.title }}</h3>
            <p v-if="item.summary" class="blog-subs-card__summary">{{ item.summary }}</p>
          </article>

          <!-- Load More Button -->
          <div v-if="hasMore" class="blog-subs-more">
            <MButton
              variant="secondary"
              size="sm"
              :loading="loading"
              @click="loadMore"
            >
              加载更多
            </MButton>
          </div>
        </div>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getActivePinia } from 'pinia'
import MIcon from '@mobile/components/ui/MIcon.vue'
import MButton from '@mobile/components/ui/MButton.vue'
import MAvatar from '@mobile/components/ui/MAvatar.vue'
import MGuestCard from '@mobile/components/ui/MGuestCard.vue'
import { useAuthStore } from '@/stores/auth'
import { useModuleSubscriptionTimeline } from '@/composables/feed/useModuleSubscriptionTimeline'

export interface SubscribedItem {
  id: string
  type: 'post' | 'short_note'
  title: string
  summary?: string
  author: {
    name: string
    avatar?: string
  }
  channel_name?: string
  published_at?: string
  unread?: boolean
}

const props = withDefaults(
  defineProps<{
    initialItems?: SubscribedItem[]
  }>(),
  {
    initialItems: undefined,
  }
)

const router = useRouter()
const authStore = getActivePinia() ? useAuthStore() : null

const timeline = useModuleSubscriptionTimeline('blog', 20)
const loading = timeline.loading
const hasMore = timeline.hasMore

const itemsList = ref<SubscribedItem[]>(props.initialItems ? [...props.initialItems] : [])

const items = computed<SubscribedItem[]>(() => {
  if (props.initialItems) return props.initialItems
  if (itemsList.value.length > 0) return itemsList.value
  const result: SubscribedItem[] = []
  for (const raw of timeline.items.value || []) {
    if (raw.type === 'post' && raw.post) {
      const p = raw.post
      result.push({
        id: String(p.id),
        type: 'post',
        title: p.title || '无标题文章',
        summary: p.summary || '',
        author: {
          name: p.author?.nickname || p.author?.username || p.user?.display_name || p.user?.username || '作者',
          avatar: p.author?.avatar || p.user?.avatar_url || '',
        },
        channel_name: p.channel?.name,
        published_at: p.published_at || raw.published_at,
        unread: !raw.is_read,
      })
    } else if (raw.type === 'short_note' && raw.short_note) {
      const n = raw.short_note
      result.push({
        id: String(n.id),
        type: 'short_note',
        title: n.content?.slice(0, 50) || '短笺',
        summary: n.content || '',
        author: {
          name: n.user?.display_name || n.user?.username || '作者',
          avatar: n.user?.avatar_url || '',
        },
        published_at: n.created_at || raw.published_at,
        unread: !raw.is_read,
      })
    }
  }
  return result
})

function handleBack() {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back()
  } else {
    void router.push('/posts/me')
  }
}

function handleMarkAllRead() {
  timeline.markAllRead()
  itemsList.value = itemsList.value.map((i) => ({ ...i, unread: false }))
}

function openItem(item: SubscribedItem) {
  item.unread = false
  if (item.type === 'short_note') {
    void router.push(`/posts/notes/${item.id}`)
  } else {
    void router.push(`/post/${item.id}`)
  }
}

function loadMore() {
  void timeline.loadMore()
}

function formatTime(isoString?: string): string {
  if (!isoString) return ''
  try {
    const d = new Date(isoString)
    const month = d.getMonth() + 1
    const day = d.getDate()
    return `${month}月${day}日`
  } catch {
    return ''
  }
}

onMounted(() => {
  if (!props.initialItems && authStore?.isAuthenticated) {
    void timeline.refresh()
  }
})
</script>

<style scoped>
.blog-subscriptions-mobile {
  min-height: 100%;
  background: var(--a-color-bg, #ffffff);
  display: flex;
  flex-direction: column;
  padding-bottom: 32px;
}

.blog-subs-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--a-color-bg, #ffffff);
  border-bottom: 1px solid var(--a-color-border-soft, #f0f0f0);
  position: sticky;
  top: 0;
  z-index: 10;
}

.blog-subs-topbar__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--a-color-text, #18181b);
  border-radius: var(--a-radius-card, 4px);
  cursor: pointer;
}

.blog-subs-topbar__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--a-color-text, #18181b);
}

.blog-subs-topbar__action-btn {
  border: none;
  background: transparent;
  font-size: 13px;
  color: var(--a-color-primary, #10b981);
  cursor: pointer;
  padding: 4px 8px;
}

.blog-subs-topbar__placeholder {
  width: 36px;
}

.blog-subs-main {
  padding: 16px;
  flex: 1;
}

.blog-subs-guest {
  padding-top: 16px;
}

.blog-subs-empty {
  padding: 48px 16px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.blog-subs-empty__icon {
  color: var(--a-color-text-tertiary, #a1a1aa);
  margin-bottom: 8px;
}

.blog-subs-empty__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--a-color-text, #18181b);
}

.blog-subs-empty__desc {
  margin: 0;
  font-size: 13px;
  color: var(--a-color-text-secondary, #71717a);
  max-width: 260px;
  line-height: 1.5;
}

.blog-subs-empty__link {
  margin-top: 12px;
  text-decoration: none;
}

.blog-subs-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.blog-subs-card {
  background: var(--a-color-surface, #fafafa);
  border: 1px solid var(--a-color-border-soft, #f4f4f5);
  border-radius: var(--a-radius-card, 4px);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
}

.blog-subs-card__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--a-color-text-secondary, #71717a);
}

.blog-subs-card__author {
  font-weight: 500;
  color: var(--a-color-text, #18181b);
}

.blog-subs-card__channel {
  color: var(--a-color-text-secondary, #71717a);
}

.blog-subs-card__dot {
  color: var(--a-color-text-tertiary, #a1a1aa);
}

.blog-subs-card__unread-badge {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--a-color-primary, #10b981);
  margin-left: auto;
}

.blog-subs-card__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--a-color-text, #18181b);
  line-height: 1.4;
}

.blog-subs-card__summary {
  margin: 0;
  font-size: 13px;
  color: var(--a-color-text-secondary, #71717a);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.blog-subs-more {
  margin-top: 12px;
  display: flex;
  justify-content: center;
}

.blog-subs-loading {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.blog-subs-skeleton {
  height: 90px;
  background: var(--a-color-surface-muted, #f4f4f5);
  border-radius: var(--a-radius-card, 4px);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 0.3; }
}
</style>
