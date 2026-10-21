<template>
  <div class="profile-mobile-view">
    <!-- User Profile Card -->
    <section class="profile-user-card" data-testid="profile-card">
      <div class="profile-user-card__top">
        <MAvatar :src="profile.avatar" :name="profile.name || profile.username" :size="60" />
        <div class="profile-user-card__identity">
          <div class="profile-user-card__name-row">
            <h1 class="profile-user-card__name">{{ profile.name || profile.username }}</h1>
            <span class="profile-user-card__handle">@{{ profile.username }}</span>
          </div>
          <div class="profile-user-card__actions">
            <button
              type="button"
              class="profile-action-btn"
              data-testid="edit-profile-btn"
              @click="openEditSheet"
            >
              <MIcon name="edit" size="xs" :stroke-width="1.8" />
              <span>编辑资料</span>
            </button>
            <RouterLink
              to="/posts/me"
              class="profile-action-btn profile-action-btn--link"
              data-testid="public-profile-link"
            >
              <MIcon name="external-link" size="xs" :stroke-width="1.8" />
              <span>公开主页</span>
            </RouterLink>
          </div>
        </div>
      </div>

      <p v-if="profile.bio" class="profile-user-card__bio">{{ profile.bio }}</p>

      <!-- Multi-Space Stats Grid (4 columns) -->
      <div class="profile-stats-grid">
        <RouterLink to="/posts/me" class="profile-stat-box" data-testid="profile-stat-box">
          <span class="profile-stat-box__val">{{ profile.stats?.articles ?? 0 }}</span>
          <span class="profile-stat-box__label">作品</span>
        </RouterLink>
        <RouterLink to="/books/shelf" class="profile-stat-box" data-testid="profile-stat-box">
          <span class="profile-stat-box__val">{{ profile.stats?.reading ?? 4 }}</span>
          <span class="profile-stat-box__label">在读</span>
        </RouterLink>
        <RouterLink to="/feed/starred" class="profile-stat-box" data-testid="profile-stat-box">
          <span class="profile-stat-box__val">{{ profile.stats?.bookmarks ?? 0 }}</span>
          <span class="profile-stat-box__label">收藏</span>
        </RouterLink>
        <div class="profile-stat-box" data-testid="profile-stat-box">
          <span class="profile-stat-box__val">{{ profile.stats?.followers ?? 0 }}</span>
          <span class="profile-stat-box__label">关注者</span>
        </div>
      </div>
    </section>

    <!-- Space Footprints Hub -->
    <section class="profile-footprints-section">
      <h2 class="profile-section-title">空间足迹</h2>
      <div class="profile-footprints-grid">
        <RouterLink to="/music/me" class="profile-footprint-card" data-testid="footprint-card">
          <div class="profile-footprint-card__icon-wrapper">
            <MIcon name="music" size="md" :stroke-width="1.8" />
          </div>
          <div class="profile-footprint-card__body">
            <h3 class="profile-footprint-card__title">音乐收听</h3>
            <p class="profile-footprint-card__desc">最近常听与我的歌单</p>
          </div>
          <MIcon name="chevron-right" size="xs" custom-class="profile-footprint-card__arrow" />
        </RouterLink>

        <RouterLink to="/books/shelf" class="profile-footprint-card" data-testid="footprint-card">
          <div class="profile-footprint-card__icon-wrapper">
            <MIcon name="books" size="md" :stroke-width="1.8" />
          </div>
          <div class="profile-footprint-card__body">
            <h3 class="profile-footprint-card__title">阅读记录</h3>
            <p class="profile-footprint-card__desc">在读书籍与书摘划线</p>
          </div>
          <MIcon name="chevron-right" size="xs" custom-class="profile-footprint-card__arrow" />
        </RouterLink>

        <RouterLink to="/studio" class="profile-footprint-card" data-testid="footprint-card">
          <div class="profile-footprint-card__icon-wrapper">
            <MIcon name="studio" size="md" :stroke-width="1.8" />
          </div>
          <div class="profile-footprint-card__body">
            <h3 class="profile-footprint-card__title">创作台</h3>
            <p class="profile-footprint-card__desc">Studio 草稿与内容管理</p>
          </div>
          <MIcon name="chevron-right" size="xs" custom-class="profile-footprint-card__arrow" />
        </RouterLink>

        <RouterLink to="/feed/starred" class="profile-footprint-card" data-testid="footprint-card">
          <div class="profile-footprint-card__icon-wrapper">
            <MIcon name="bookmark" size="md" :stroke-width="1.8" />
          </div>
          <div class="profile-footprint-card__body">
            <h3 class="profile-footprint-card__title">收藏队列</h3>
            <p class="profile-footprint-card__desc">已星标内容与稍后阅读</p>
          </div>
          <MIcon name="chevron-right" size="xs" custom-class="profile-footprint-card__arrow" />
        </RouterLink>
      </div>
    </section>

    <!-- Settings Options List -->
    <section class="profile-settings-section">
      <h2 class="profile-section-title">偏好与设置</h2>
      <div class="profile-settings-list">
        <!-- Theme Mode Toggle -->
        <div class="profile-settings-item">
          <div class="profile-settings-item__left">
            <MIcon :name="isDarkMode ? 'moon' : 'sun'" size="sm" :stroke-width="1.8" />
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
            <MIcon name="shield" size="sm" :stroke-width="1.8" />
            <span class="profile-settings-item__label">账号与安全</span>
          </div>
          <div class="profile-settings-item__right">
            <span class="profile-settings-item__hint">已保护</span>
            <MIcon name="chevron-right" size="xs" custom-class="profile-settings-chevron" />
          </div>
        </div>

        <!-- Notifications -->
        <RouterLink to="/inbox/notifications" class="profile-settings-item profile-settings-item--link">
          <div class="profile-settings-item__left">
            <MIcon name="bell" size="sm" :stroke-width="1.8" />
            <span class="profile-settings-item__label">消息与通知</span>
          </div>
          <div class="profile-settings-item__right">
            <span class="profile-settings-item__hint">查看提醒</span>
            <MIcon name="chevron-right" size="xs" custom-class="profile-settings-chevron" />
          </div>
        </RouterLink>

        <!-- Storage & Cache -->
        <div class="profile-settings-item" data-testid="settings-cache-item" @click="handleClearCache">
          <div class="profile-settings-item__left">
            <MIcon name="settings" size="sm" :stroke-width="1.8" />
            <span class="profile-settings-item__label">本地缓存</span>
          </div>
          <div class="profile-settings-item__right">
            <span class="profile-settings-item__desc">{{ cacheSizeText }}</span>
            <MIcon name="chevron-right" size="xs" custom-class="profile-settings-chevron" />
          </div>
        </div>

        <!-- About -->
        <div class="profile-settings-item">
          <div class="profile-settings-item__left">
            <MIcon name="compass" size="sm" :stroke-width="1.8" />
            <span class="profile-settings-item__label">关于 Atoman</span>
          </div>
          <span class="profile-settings-item__desc">v1.4.2</span>
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

    <!-- Edit Profile Sheet -->
    <MSheet
      v-model="editSheetOpen"
      title="编辑个人资料"
      data-testid="edit-profile-sheet"
    >
      <div class="profile-edit-form">
        <div class="profile-edit-field">
          <label class="profile-edit-label">显示昵称</label>
          <input
            v-model="formName"
            type="text"
            class="profile-edit-input"
            data-testid="edit-name-input"
            placeholder="输入您的昵称"
          />
        </div>

        <div class="profile-edit-field">
          <label class="profile-edit-label">个人简介</label>
          <textarea
            v-model="formBio"
            class="profile-edit-textarea"
            data-testid="edit-bio-input"
            rows="3"
            placeholder="介绍一下自己"
          />
        </div>

        <div class="profile-edit-actions">
          <MButton
            variant="secondary"
            class="profile-edit-cancel-btn"
            @click="editSheetOpen = false"
          >
            取消
          </MButton>
          <MButton
            variant="primary"
            data-testid="edit-save-btn"
            @click="handleSaveProfile"
          >
            保存
          </MButton>
        </div>
      </div>
    </MSheet>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import MAvatar from '@mobile/components/ui/MAvatar.vue'
import MIcon from '@mobile/components/ui/MIcon.vue'
import MButton from '@mobile/components/ui/MButton.vue'
import MSheet from '@mobile/components/ui/MSheet.vue'

export interface UserProfileData {
  username: string
  name: string
  avatar?: string
  bio?: string
  stats?: {
    articles: number
    reading?: number
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
const authStore = useAuthStore()

const isDarkMode = ref(false)
const cacheSizeText = ref('已占用 12.4 MB')
const editSheetOpen = ref(false)

const localOverrides = ref<{ name?: string; bio?: string }>({})

const defaultProfile: UserProfileData = {
  username: 'atoman_user',
  name: 'Atoman User',
  avatar: '',
  bio: '保持阅读，持续思考与创造。',
  stats: {
    articles: 18,
    reading: 4,
    bookmarks: 56,
    followers: 128,
  },
}

const profile = computed<UserProfileData>(() => {
  const base = props.user
    ? { ...props.user }
    : authStore.user
      ? {
          username: authStore.user.username,
          name: authStore.user.display_name || authStore.user.username,
          avatar: authStore.user.avatar_url || '',
          bio: authStore.user.bio || '保持阅读，持续思考与创造。',
          stats: defaultProfile.stats,
        }
      : defaultProfile

  return {
    ...base,
    name: localOverrides.value.name !== undefined ? localOverrides.value.name : base.name,
    bio: localOverrides.value.bio !== undefined ? localOverrides.value.bio : base.bio,
  }
})

const formName = ref(profile.value.name)
const formBio = ref(profile.value.bio || '')

watch(profile, (newVal) => {
  formName.value = newVal.name
  formBio.value = newVal.bio || ''
})

function openEditSheet() {
  formName.value = profile.value.name
  formBio.value = profile.value.bio || ''
  editSheetOpen.value = true
}

function handleSaveProfile() {
  localOverrides.value = {
    name: formName.value.trim() || profile.value.name,
    bio: formBio.value.trim(),
  }
  editSheetOpen.value = false
}

function toggleTheme() {
  isDarkMode.value = !isDarkMode.value
}

function handleSecurity() {
  if (router && typeof router.push === 'function') {
    void router.push('/users/' + profile.value.username + '/settings')
  }
}

function handleClearCache() {
  cacheSizeText.value = '已占用 0 KB'
}

async function handleLogout() {
  try {
    await authStore.logout()
  } catch {
    // proceed even if network fails
  }
  if (router && typeof router.push === 'function') {
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

/* User Profile Card */
.profile-user-card {
  background-color: #ffffff;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
  padding: 16px;
  box-sizing: border-box;
}

.profile-user-card__top {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 12px;
}

.profile-user-card__identity {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.profile-user-card__name-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.profile-user-card__name {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--a-color-text-primary, #0f172a);
  line-height: 1.3;
}

.profile-user-card__handle {
  font-size: 0.75rem;
  color: var(--a-color-text-secondary, #64748b);
}

.profile-user-card__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.profile-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background-color: #ffffff;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--a-color-text-primary, #0f172a);
  cursor: pointer;
  text-decoration: none;
  transition: background-color 0.15s ease;
}

.profile-action-btn:active {
  background-color: #f8fafc;
}

.profile-user-card__bio {
  margin: 0 0 14px 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--a-color-text-secondary, #475569);
}

/* Stats 4-Grid */
.profile-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-top: 1px solid var(--a-color-border-soft, #e2e8f0);
  padding-top: 12px;
  gap: 4px;
}

.profile-stat-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  text-decoration: none;
  padding: 4px 0;
  border-radius: var(--a-radius-control, 4px);
  transition: background-color 0.15s ease;
}

.profile-stat-box:active {
  background-color: #f8fafc;
}

.profile-stat-box__val {
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--a-color-text-primary, #0f172a);
}

.profile-stat-box__label {
  font-size: 0.6875rem;
  color: var(--a-color-text-secondary, #64748b);
}

/* Space Footprints Section */
.profile-section-title {
  margin: 0 0 10px 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--a-color-text-primary, #0f172a);
}

.profile-footprints-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.profile-footprint-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background-color: #ffffff;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
  text-decoration: none;
  transition: background-color 0.15s ease;
}

.profile-footprint-card:active {
  background-color: #f8fafc;
}

.profile-footprint-card__icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background-color: #f8fafc;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
  color: var(--a-color-text-primary, #0f172a);
  flex-shrink: 0;
}

.profile-footprint-card__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.profile-footprint-card__title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--a-color-text-primary, #0f172a);
}

.profile-footprint-card__desc {
  margin: 0;
  font-size: 0.75rem;
  color: var(--a-color-text-secondary, #64748b);
}

:deep(.profile-footprint-card__arrow) {
  color: var(--a-color-text-secondary, #94a3b8);
  flex-shrink: 0;
}

/* Settings List */
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
  text-decoration: none;
  cursor: pointer;
  background-color: #ffffff;
  transition: background-color 0.15s ease;
}

.profile-settings-item:last-child {
  border-bottom: none;
}

.profile-settings-item:active {
  background-color: #f8fafc;
}

.profile-settings-item__left {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--a-color-text-primary, #0f172a);
}

.profile-settings-item__label {
  font-size: 0.875rem;
  font-weight: 500;
}

.profile-settings-item__right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.profile-settings-item__hint {
  font-size: 0.75rem;
  color: var(--a-color-text-secondary, #64748b);
}

.profile-settings-item__desc {
  font-size: 0.75rem;
  color: var(--a-color-text-secondary, #94a3b8);
}

.profile-toggle-btn {
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  background-color: #f8fafc;
  border-radius: var(--a-radius-control, 4px);
  padding: 4px 10px;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--a-color-text-primary, #0f172a);
  cursor: pointer;
}

:deep(.profile-settings-chevron) {
  color: var(--a-color-text-secondary, #94a3b8);
}

/* Logout Section */
.profile-logout-section {
  margin-top: 10px;
  padding-bottom: 24px;
}

.profile-logout-text {
  color: #e11d48;
  font-weight: 500;
}

/* Edit Form inside MSheet */
.profile-edit-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 0 16px;
}

.profile-edit-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.profile-edit-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--a-color-text-primary, #0f172a);
}

.profile-edit-input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  background-color: #ffffff;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
  font-size: 0.875rem;
  color: var(--a-color-text-primary, #0f172a);
  outline: none;
}

.profile-edit-input:focus {
  border-color: var(--a-color-primary, #0ea5e9);
}

.profile-edit-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  background-color: #ffffff;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
  font-size: 0.875rem;
  color: var(--a-color-text-primary, #0f172a);
  resize: vertical;
  outline: none;
  font-family: inherit;
}

.profile-edit-textarea:focus {
  border-color: var(--a-color-primary, #0ea5e9);
}

.profile-edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
}
</style>
