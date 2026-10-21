<template>
  <div class="feed-me-view">
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
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import MIcon from '@mobile/components/ui/MIcon.vue'

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

const cacheCleared = ref(false)

const defaultProfile: FeedProfile = {
  name: '探索客',
  username: 'explorer_feed',
  bio: '用 RSS 捕获世界的细微震颤。',
  stats: {
    sourcesCount: 24,
    starredCount: 68,
    readCount: 312,
    readingHours: 42,
  },
}

const profile = computed<FeedProfile>(() => props.initialProfile || defaultProfile)

function handleOpmlExport() {
  // OPML export simulation or toast
}

function clearCache() {
  cacheCleared.value = true
  setTimeout(() => {
    cacheCleared.value = false
  }, 2000)
}
</script>

<style scoped>
.feed-me-view {
  min-height: 100vh;
  background-color: #ffffff;
  padding: 16px 16px 96px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 18px;
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
  border-radius: var(--a-radius-card, 4px);
  background-color: #ffffff;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: var(--a-shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.02));
}

.feed-profile-card__user {
  display: flex;
  align-items: center;
  gap: 14px;
}

.feed-profile-card__avatar {
  width: 44px;
  height: 44px;
  border-radius: 4px;
  background-color: var(--a-color-text, #0f172a);
  color: #ffffff;
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
  background-color: #ffffff;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
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
