<template>
  <div class="profile-mobile-view">
    <!-- User Profile Card -->
    <section class="profile-user-card" data-testid="profile-card">
      <div class="profile-user-card__top">
        <MAvatar :src="profile.avatar" :name="profile.name || profile.username" :size="64" />
        <div class="profile-user-card__identity">
          <h1 class="profile-user-card__name">{{ profile.name || profile.username }}</h1>
          <span class="profile-user-card__handle">@{{ profile.username }}</span>
        </div>
      </div>

      <p v-if="profile.bio" class="profile-user-card__bio">{{ profile.bio }}</p>

      <!-- Stats Grid -->
      <div class="profile-stats-grid">
        <div class="profile-stat-box">
          <span class="profile-stat-box__val">{{ profile.stats?.articles ?? 0 }}</span>
          <span class="profile-stat-box__label">文章</span>
        </div>
        <div class="profile-stat-box">
          <span class="profile-stat-box__val">{{ profile.stats?.bookmarks ?? 0 }}</span>
          <span class="profile-stat-box__label">收藏</span>
        </div>
        <div class="profile-stat-box">
          <span class="profile-stat-box__val">{{ profile.stats?.followers ?? 0 }}</span>
          <span class="profile-stat-box__label">关注者</span>
        </div>
      </div>
    </section>

    <!-- Settings Options List -->
    <section class="profile-settings-section">
      <h2 class="profile-section-title">偏好与设置</h2>
      <div class="profile-settings-list">
        <!-- Theme Mode Toggle -->
        <div class="profile-settings-item">
          <div class="profile-settings-item__left">
            <MIcon name="sun" size="sm" />
            <span class="profile-settings-item__label">主题外观</span>
          </div>
          <button
            type="button"
            class="profile-toggle-btn"
            data-testid="settings-theme-toggle"
            @click="toggleTheme"
          >
            {{ isDarkMode ? '深色' : '浅色' }}
          </button>
        </div>

        <!-- Account Security -->
        <div class="profile-settings-item" @click="handleSecurity">
          <div class="profile-settings-item__left">
            <MIcon name="shield" size="sm" />
            <span class="profile-settings-item__label">账号与安全</span>
          </div>
          <MIcon name="chevron-left" size="xs" custom-class="profile-settings-chevron" />
        </div>

        <!-- Storage & Cache -->
        <div class="profile-settings-item" @click="handleClearCache">
          <div class="profile-settings-item__left">
            <MIcon name="settings" size="sm" />
            <span class="profile-settings-item__label">本地缓存</span>
          </div>
          <span class="profile-settings-item__desc">已占用 12.4 MB</span>
        </div>
      </div>
    </section>

    <!-- Logout Action -->
    <section class="profile-logout-section">
      <MButton
        variant="secondary"
        block
        data-testid="logout-btn"
        @click="handleLogout"
      >
        <span class="profile-logout-text">退出登录</span>
      </MButton>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import MAvatar from '@mobile/components/ui/MAvatar.vue'
import MIcon from '@mobile/components/ui/MIcon.vue'
import MButton from '@mobile/components/ui/MButton.vue'

export interface UserProfileData {
  username: string
  name: string
  avatar?: string
  bio?: string
  stats?: {
    articles: number
    bookmarks: number
    followers: number
  }
}

const props = withDefaults(
  defineProps<{
    user?: UserProfileData
  }>(),
  {
    user: undefined,
  }
)

const router = useRouter()
const isDarkMode = ref(false)

const defaultProfile: UserProfileData = {
  username: 'atoman_user',
  name: 'Atoman User',
  avatar: '',
  bio: '保持阅读，持续思考与创造。',
  stats: {
    articles: 12,
    bookmarks: 48,
    followers: 128,
  },
}

const profile = computed<UserProfileData>(() => props.user || defaultProfile)

function toggleTheme() {
  isDarkMode.value = !isDarkMode.value
}

function handleSecurity() {
  if (router) {
    void router.push('/users/' + profile.value.username + '/settings')
  }
}

function handleClearCache() {
  // Clear local temporary cache
}

function handleLogout() {
  if (router) {
    void router.push('/login')
  }
}
</script>

<style scoped>
.profile-mobile-view {
  min-height: 100vh;
  background-color: var(--a-color-bg, #ffffff);
  padding: 16px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* User Card */
.profile-user-card {
  background-color: #ffffff;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
  padding: 18px 16px;
  box-sizing: border-box;
}

.profile-user-card__top {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 12px;
}

.profile-user-card__identity {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.profile-user-card__name {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.profile-user-card__handle {
  font-size: 0.75rem;
  color: var(--a-color-muted, #64748b);
}

.profile-user-card__bio {
  margin: 0 0 16px 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--a-color-text-secondary, #475569);
}

/* Stats */
.profile-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-top: 1px solid var(--a-color-border-soft, #e2e8f0);
  padding-top: 14px;
}

.profile-stat-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.profile-stat-box__val {
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.profile-stat-box__label {
  font-size: 0.6875rem;
  color: var(--a-color-muted, #64748b);
}

/* Settings List */
.profile-section-title {
  margin: 0 0 10px 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.profile-settings-list {
  background-color: #ffffff;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
  overflow: hidden;
}

.profile-settings-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--a-color-border-soft, #e2e8f0);
  box-sizing: border-box;
}

.profile-settings-item:last-child {
  border-bottom: none;
}

.profile-settings-item__left {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--a-color-text, #0f172a);
}

.profile-settings-item__label {
  font-size: 0.875rem;
  font-weight: 500;
}

.profile-toggle-btn {
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  background-color: var(--a-color-surface-muted, #f8fafc);
  border-radius: var(--a-radius-control, 4px);
  padding: 4px 10px;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--a-color-text, #0f172a);
  cursor: pointer;
}

.profile-settings-item__desc {
  font-size: 0.75rem;
  color: var(--a-color-muted, #94a3b8);
}

:deep(.profile-settings-chevron) {
  transform: rotate(180deg);
  color: var(--a-color-muted, #94a3b8);
}

/* Logout Section */
.profile-logout-section {
  margin-top: auto;
  padding-bottom: 24px;
}

.profile-logout-text {
  color: #e11d48;
  font-weight: 500;
}
</style>
