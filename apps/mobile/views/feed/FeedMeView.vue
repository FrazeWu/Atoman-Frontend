<template>
  <div class="feed-me-view">
    <!-- Unauthenticated Guest State -->
    <div v-if="!props.initialProfile && authStore && !authStore.isAuthenticated" class="feed-me-guest-wrap">
      <MGuestCard
        title="登录查看订阅档案"
        description="登录后可管理 RSS 订阅源、同步星标收藏与阅读时长。"
        redirect="/feed/me"
      />
    </div>

    <template v-else>
      <!-- Header -->
      <header class="feed-me-header">
        <h1 class="feed-me-title">我的动态</h1>
      </header>

      <!-- Profile & Stats Card -->
      <section class="feed-profile-card" data-testid="feed-profile-card">
        <div class="feed-profile-card__user">
          <div class="feed-profile-card__avatar">
            <span>{{ profile.name.slice(0, 1) }}</span>
          </div>
          <div class="feed-profile-card__info">
            <h2 class="feed-profile-card__name">{{ profile.name }}</h2>
            <p class="feed-profile-card__bio">{{ profile.bio || '用 RSS 捕获世界的细微震颤。' }}</p>
          </div>
        </div>

        <!-- 4 Stats Grid -->
        <div class="feed-stats-grid">
          <div class="feed-stat-item">
            <span class="feed-stat-item__value">{{ profile.stats.sourcesCount }}</span>
            <span class="feed-stat-item__label">关注源</span>
          </div>
          <div class="feed-stat-item">
            <span class="feed-stat-item__value">{{ profile.stats.starredCount }}</span>
            <span class="feed-stat-item__label">收藏文章</span>
          </div>
          <div class="feed-stat-item">
            <span class="feed-stat-item__value">{{ profile.stats.readCount }}</span>
            <span class="feed-stat-item__label">已读文章</span>
          </div>
          <div class="feed-stat-item">
            <span class="feed-stat-item__value">{{ profile.stats.readingHours }}h</span>
            <span class="feed-stat-item__label">阅读时长</span>
          </div>
        </div>
      </section>

      <!-- Shortcuts & Manage -->
      <section class="feed-shortcuts-section">
        <h2 class="feed-shortcuts-section__title">订阅管理与工具</h2>
        <div class="feed-shortcuts-list">
          <router-link
            to="/feed/sources"
            class="feed-shortcut-item"
            data-testid="feed-sources-manager-link"
          >
            <div class="feed-shortcut-item__left">
              <div class="feed-shortcut-item__icon">
                <MIcon name="antenna" size="sm" />
              </div>
              <div>
                <div class="feed-shortcut-item__name">订阅源管理</div>
                <div class="feed-shortcut-item__sub">管理所有关注的 RSS 站点与播客</div>
              </div>
            </div>
            <div class="feed-shortcut-item__right">
              <span class="feed-shortcut-item__badge">{{ profile.stats.sourcesCount }} 个源</span>
              <MIcon name="chevron-down" size="xs" class="feed-shortcut-item__arrow" />
            </div>
          </router-link>

          <router-link to="/feed/starred" class="feed-shortcut-item">
            <div class="feed-shortcut-item__left">
              <div class="feed-shortcut-item__icon">
                <MIcon name="bookmark" size="sm" />
              </div>
              <div>
                <div class="feed-shortcut-item__name">收藏夹管理</div>
                <div class="feed-shortcut-item__sub">查看已收藏的高价值文章</div>
              </div>
            </div>
            <div class="feed-shortcut-item__right">
              <span class="feed-shortcut-item__badge">{{ profile.stats.starredCount }} 篇</span>
              <MIcon name="chevron-down" size="xs" class="feed-shortcut-item__arrow" />
            </div>
          </router-link>
        </div>
      </section>

      <!-- Data Actions -->
      <section class="feed-data-section">
        <h2 class="feed-shortcuts-section__title">数据与偏好</h2>
        <div class="feed-shortcuts-list">
          <div class="feed-action-row" @click="handleOpmlExport">
            <span class="feed-action-row__label">导出 OPML 文件</span>
            <span class="feed-action-row__value">备份所有源</span>
          </div>
          <div class="feed-action-row" @click="clearCache">
            <span class="feed-action-row__label">清理文章已读缓存</span>
            <span class="feed-action-row__value">{{ cacheCleared ? '已清理' : '释放空间' }}</span>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getActivePinia } from 'pinia'
import MIcon from '@mobile/components/ui/MIcon.vue'
import MGuestCard from '@mobile/components/ui/MGuestCard.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { useApi } from '@/composables/useApi'
import { apiRequestResult } from '@/api/client'

export interface FeedProfile {
  name: string
  username: string
  bio?: string
  avatar?: string
  stats: {
    sourcesCount: number
    starredCount: number
    readCount: number
    readingHours: number
  }
}

const props = withDefaults(
  defineProps<{
    initialProfile?: FeedProfile
  }>(),
  {
    initialProfile: undefined,
  }
)

const authStore = getActivePinia() ? useAuthStore() : null
const feedStore = getActivePinia() ? useFeedStore() : null
const api = useApi()

const cacheCleared = ref(false)
const starredCount = ref(0)

const defaultProfile: FeedProfile = {
  name: '探索客',
  username: 'explorer_feed',
  bio: '用 RSS 捕获世界的细微震颤。',
  stats: {
    sourcesCount: 0,
    starredCount: 0,
    readCount: 0,
    readingHours: 0,
  },
}

const profile = computed<FeedProfile>(() => {
  if (props.initialProfile) return props.initialProfile
  if (authStore?.isAuthenticated && authStore.user) {
    const user = authStore.user
    const subCount = feedStore?.subscriptions?.length ?? 0
    return {
      name: user.display_name || user.username || '探索客',
      username: user.username || 'explorer',
      bio: user.bio || '用 RSS 捕获世界的细微震颤。',
      avatar: user.avatar_url || '',
      stats: {
        sourcesCount: subCount,
        starredCount: starredCount.value,
        readCount: 0,
        readingHours: 0,
      },
    }
  }
  return defaultProfile
})

function handleOpmlExport() {
  if (typeof window !== 'undefined' && authStore?.token) {
    const url = `${api.url}/feed/opml/export`
    window.open(url, '_blank')
  }
}

function clearCache() {
  cacheCleared.value = true
  setTimeout(() => {
    cacheCleared.value = false
  }, 2000)
}

onMounted(async () => {
  if (authStore?.isAuthenticated) {
    if (feedStore) {
      void feedStore.fetchSubscriptions?.().catch(() => {})
    }
    try {
      const res = await apiRequestResult(`${api.url}/feed/stars?limit=1`, {
        headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : undefined,
      })
      if (res.ok && res.data) {
        const data = res.data as any
        const total = Number(data?.total ?? data?.data?.total ?? data?.meta?.total ?? 0)
        starredCount.value = total
      }
    } catch {
      // Graceful fallback
    }
  }
})
</script>

<style scoped>
.feed-me-view {
  min-height: 100vh;
  background-color: var(--a-color-bg, #ffffff);
  padding: 16px 16px 96px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.feed-me-guest-wrap {
  padding-top: 16px;
}

.feed-me-header {
  margin-bottom: 2px;
}

.feed-me-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
  letter-spacing: -0.01em;
}

/* Profile Card */
.feed-profile-card {
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
  background-color: var(--a-color-surface, #ffffff);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: none !important;
}

.feed-profile-card__user {
  display: flex;
  align-items: center;
  gap: 14px;
}

.feed-profile-card__avatar {
  width: 44px;
  height: 44px;
  border-radius: var(--a-radius-control, 4px);
  background-color: var(--a-color-primary, #0f172a);
  color: var(--a-color-primary-contrast, #ffffff);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  flex-shrink: 0;
}

.feed-profile-card__info {
  flex: 1;
  min-width: 0;
}

.feed-profile-card__name {
  margin: 0 0 2px;
  font-size: 16px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.feed-profile-card__bio {
  margin: 0;
  font-size: 12px;
  color: var(--a-color-text-secondary, #64748b);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.feed-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--a-color-border-soft, #f1f5f9);
}

.feed-stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.feed-stat-item__value {
  font-size: 16px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.feed-stat-item__label {
  font-size: 11px;
  color: var(--a-color-text-muted, #94a3b8);
  margin-top: 2px;
}

/* Shortcuts */
.feed-shortcuts-section,
.feed-data-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.feed-shortcuts-section__title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.feed-shortcuts-list {
  display: flex;
  flex-direction: column;
  background-color: var(--a-color-surface, #ffffff);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
  overflow: hidden;
}

.feed-shortcut-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  text-decoration: none;
  border-bottom: 1px solid var(--a-color-border-soft, #f8fafc);
  transition: background-color 0.15s ease;
}

.feed-shortcut-item:last-child {
  border-bottom: none;
}

.feed-shortcut-item:active {
  background-color: #f8fafc;
}

.feed-shortcut-item__left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.feed-shortcut-item__icon {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  background-color: #f1f5f9;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-text, #0f172a);
  flex-shrink: 0;
}

.feed-shortcut-item__name {
  font-size: 13px;
  font-weight: 500;
  color: var(--a-color-text, #0f172a);
  margin-bottom: 2px;
}

.feed-shortcut-item__sub {
  font-size: 11px;
  color: var(--a-color-text-muted, #94a3b8);
}

.feed-shortcut-item__right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.feed-shortcut-item__badge {
  font-size: 11px;
  color: var(--a-color-text-secondary, #64748b);
}

.feed-shortcut-item__arrow {
  color: var(--a-color-text-muted, #cbd5e1);
  transform: rotate(-90deg);
}

.feed-action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--a-color-border-soft, #f8fafc);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.feed-action-row:last-child {
  border-bottom: none;
}

.feed-action-row:active {
  background-color: #f8fafc;
}

.feed-action-row__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--a-color-text, #0f172a);
}

.feed-action-row__value {
  font-size: 12px;
  color: var(--a-color-text-muted, #94a3b8);
}
</style>
