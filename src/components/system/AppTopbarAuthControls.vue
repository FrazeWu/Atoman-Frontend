<template>
  <RouterLink
    to="/inbox"
    class="notif-btn"
    data-testid="notification-link"
    :title="notificationRoom.helper"
    :aria-label="notificationRoom.name"
  >
    <Bell class="notif-btn__icon" :size="16" aria-hidden="true" />
    <span class="notif-btn__text">{{ notificationRoom.name }}</span>
    <span v-if="inboxStore.totalUnread > 0" class="notif-count">{{ inboxStore.totalUnread }}</span>
  </RouterLink>

  <RouterLink
    to="/studio"
    class="studio-link"
    data-testid="studio-link"
    aria-label="创作中心"
  >
    <PencilLine :size="17" aria-hidden="true" />
    <span>创作中心</span>
  </RouterLink>

  <RouterLink
    :to="userSettingsPath"
    class="user-settings-link"
    data-testid="user-settings-link"
    title="设置"
    aria-label="设置"
  >
    <Settings :size="17" aria-hidden="true" />
  </RouterLink>

  <div class="dropdown-wrap" data-dropdown="user">
    <button class="user-btn" @click="toggleDropdown('user')">
      <span class="user-avatar">
        <img v-if="avatarSrc" :src="avatarSrc" :alt="`${authStore.user?.username || '用户'}的头像`" />
        <span v-else>{{ userInitial }}</span>
      </span>
      <span class="user-name">{{ authStore.user?.username }}</span>
      <span class="chevron" :style="activeDropdown === 'user' ? 'transform:rotate(180deg)' : ''">▾</span>
    </button>
    <div v-if="activeDropdown === 'user'" class="dropdown user-dropdown">
      <a :href="userUrl(authStore.user?.username || '')" class="dropdown-item" @click="closeDropdown">我的主页</a>
      <RouterLink :to="userSettingsPath" class="dropdown-item" @click="closeDropdown">编辑资料</RouterLink>
      <RouterLink v-if="showSiteSettings" to="/site/setting" class="dropdown-item" @click="closeDropdown">站点设置</RouterLink>
      <button class="dropdown-item dropdown-item-danger" @click="logout">退出登录</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useInboxStore } from '@/stores/inbox'
import { notificationRoom } from '@/config/moduleRooms'
import { userUrl } from '@/router/siteUrls'
import { isAdminRole } from '@/utils/roles'
import { resolveMediaURL } from '@/utils/mediaUrl'
import { Bell, PencilLine, Settings } from 'lucide-vue-next'

const authStore = useAuthStore()
const inboxStore = useInboxStore()
const router = useRouter()

const activeDropdown = ref<string | null>(null)
const userInitial = computed(() => (authStore.user?.username || '?').charAt(0).toUpperCase())
const avatarSrc = computed(() => authStore.user?.avatar_url ? resolveMediaURL(authStore.user.avatar_url) : '')
const userSettingsPath = computed(() => `/users/${authStore.user?.username || ''}/settings`)
const showSiteSettings = computed(() => isAdminRole(authStore.user?.role))
const toggleDropdown = (name: string) => {
  activeDropdown.value = activeDropdown.value === name ? null : name
}

const closeDropdown = () => {
  activeDropdown.value = null
}

const handleClickOutside = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (!target.closest('[data-dropdown]')) closeDropdown()
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  inboxStore.bootstrap()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  inboxStore.disconnect()
})

const logout = async () => {
  await authStore.logout()
  closeDropdown()
  inboxStore.disconnect()
  await router.push('/login')
}

</script>

<style scoped>
.studio-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 2.75rem;
  padding: 0 0.625rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--a-color-fg);
  text-decoration: none;
  white-space: nowrap;
  flex-shrink: 0;
}

.studio-link:hover,
.studio-link.router-link-active {
  background: var(--a-color-surface-muted);
}

.studio-link:focus-visible {
  outline: 2px solid var(--a-color-fg);
  outline-offset: 2px;
}

.notif-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--a-color-muted);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  position: relative;
  transition: color 0.2s;
  text-decoration: none;
  white-space: nowrap;
  flex-shrink: 0;
}

.notif-btn__icon {
  display: none;
  flex-shrink: 0;
}

@media (max-width: 960px) {
  .notif-btn {
    justify-content: center;
    min-width: 2rem;
  }

  .notif-btn__icon {
    display: inline-flex;
  }

  .notif-btn__text {
    display: none;
  }

  .user-name,
  .chevron {
    display: none;
  }

  .user-btn {
    padding-inline: 0.5rem;
  }
}

@media (max-width: 720px) {
  .user-settings-link,
  .dropdown-wrap[data-dropdown="user"] {
    display: none;
  }

  .studio-link span {
    display: none;
  }
}

.notif-btn:hover {
  color: var(--a-color-fg);
  text-decoration: underline;
}

.user-settings-link {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-muted);
  border: none;
  background: var(--a-color-bg);
  text-decoration: none;
  flex-shrink: 0;
}

.user-settings-link:hover {
  color: var(--a-color-fg);
  background: var(--a-color-surface-muted);
  text-decoration: none;
}

.notif-count {
  display: inline-block;
  margin-left: 3px;
  background: var(--a-color-text);
  color: var(--a-color-bg);
  font-size: 0.6rem;
  font-weight: var(--a-font-weight-strong, 700);
  border-radius: 0;
  border: 1px solid var(--a-color-text);
  padding: 1px 5px;
  line-height: 1;
  vertical-align: middle;
}

.dropdown-wrap {
  position: relative;
}

.user-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--a-color-bg);
  border: var(--a-border);
  border-radius: var(--a-radius-none);
  cursor: pointer;
  padding: 0.375rem 0.75rem;
  font-weight: 500;
  font-size: 0.875rem;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.user-btn:hover {
  background: var(--a-color-surface-muted);
}

.user-avatar {
  width: 24px;
  height: 24px;
  border-radius: var(--a-radius-none);
  background: var(--a-color-text);
  color: var(--a-color-bg);
  font-weight: var(--a-font-weight-strong, 700);
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-name {
  font-weight: 500;
}

.chevron {
  font-size: 0.75rem;
  transition: transform 0.2s;
}

.dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  background: var(--a-color-bg);
  border: var(--a-border);
  border-radius: var(--a-radius-none);
  box-shadow: var(--a-shadow-dropdown);
  z-index: 40;
  min-width: 140px;
}

.user-dropdown {
  width: 144px;
}

.dropdown-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.625rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--a-color-fg);
  text-decoration: none;
  background: none;
  border: none;
  border-bottom: 1px solid var(--a-color-border-soft);
  cursor: pointer;
}

.dropdown-item:last-child {
  border-bottom: none;
}

.dropdown-item:hover {
  background: var(--a-color-fg);
  color: var(--a-color-bg);
  text-decoration: none;
}

.dropdown-item-danger {
  color: var(--a-color-danger);
}

.dropdown-item-danger:hover {
  background: var(--a-color-danger);
  color: var(--a-color-bg);
  text-decoration: none;
}

.dropdown-divider {
  height: 1px;
  background: var(--a-color-border-soft);
  margin: 0.25rem 0;
}

</style>
