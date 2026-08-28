<template>
  <RouterLink
    to="/inbox"
    class="notif-btn"
    data-testid="notification-link"
    :title="notificationRoom.helper"
    :aria-label="inboxStore.totalUnread > 0 ? `${notificationRoom.name}，${inboxStore.totalUnread} 条未读` : notificationRoom.name"
  >
    <Mail class="notif-btn__icon" :size="18" aria-hidden="true" />
    <span v-if="inboxStore.totalUnread > 0" class="notif-count">{{ inboxStore.totalUnread }}</span>
  </RouterLink>

  <RouterLink
    to="/studio"
    class="studio-link"
    data-testid="studio-link"
    aria-label="创作"
  >
    <PencilLine :size="17" aria-hidden="true" />
    <span>创作</span>
  </RouterLink>

  <div class="dropdown-wrap" :class="{ 'is-open': activeDropdown === 'user' }" data-dropdown="user">
    <button class="user-btn" @click="toggleDropdown('user')">
      <span class="user-avatar">
        <img v-if="avatarSrc" :src="avatarSrc" :alt="`${authStore.user?.username || '用户'}的头像`" />
        <span v-else>{{ userInitial }}</span>
      </span>
      <span class="user-name">{{ authStore.user?.username }}</span>
      <span class="chevron" :style="activeDropdown === 'user' ? 'transform:rotate(180deg)' : ''">▾</span>
    </button>
    <Transition name="user-menu">
      <div v-if="activeDropdown === 'user'" class="dropdown user-dropdown">
        <a :href="userUrl(authStore.user?.username || '')" class="dropdown-item" @click="closeDropdown">我的主页</a>
        <RouterLink :to="userSettingsPath" class="dropdown-item" @click="closeDropdown">编辑资料</RouterLink>
        <RouterLink v-if="showSiteSettings" to="/site/setting" class="dropdown-item" @click="closeDropdown">站点设置</RouterLink>
        <button class="dropdown-item dropdown-item-danger" @click="logout">退出登录</button>
      </div>
    </Transition>
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
import { Mail, PencilLine } from 'lucide-vue-next'

const authStore = useAuthStore()
const inboxStore = useInboxStore()
const router = useRouter()

const activeDropdown = ref<string | null>(null)
const userInitial = computed(() => (authStore.user?.username || '?').charAt(0).toUpperCase())
const avatarSrc = computed(() => authStore.user?.avatar_url ? resolveMediaURL(authStore.user.avatar_url) : '')
const userSettingsPath = computed(() => `/users/${authStore.user?.username || ''}/settings`)
const showSiteSettings = computed(() => isAdminRole(authStore.user?.role))
const toggleDropdown = (name: string) => {
  const willOpen = activeDropdown.value !== name
  if (willOpen) {
    window.dispatchEvent(new CustomEvent('atoman:global-overlay-open', { detail: 'user-menu' }))
  }
  activeDropdown.value = willOpen ? name : null
}

const closeDropdown = () => {
  activeDropdown.value = null
}

const handleClickOutside = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (!target.closest('[data-dropdown]')) closeDropdown()
}

const handleGlobalOverlayOpen = (event: Event) => {
  if ((event as CustomEvent<string>).detail !== 'user-menu') closeDropdown()
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('atoman:global-overlay-open', handleGlobalOverlayOpen)
  inboxStore.bootstrap()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('atoman:global-overlay-open', handleGlobalOverlayOpen)
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
  gap: 0.3rem;
  min-height: 2.75rem;
  padding: 0 0.5rem;
  font-size: 0.8125rem;
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
  width: 2.75rem;
  min-width: 2.75rem;
  min-height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-muted);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  position: relative;
  transition: color 0.2s, background 0.2s;
  text-decoration: none;
  flex-shrink: 0;
}

.notif-btn__icon {
  display: inline-flex;
  flex-shrink: 0;
}

@media (max-width: 960px) {
  .user-name,
  .chevron {
    display: none;
  }

  .user-btn {
    padding-inline: 0.5rem;
  }
}

@media (max-width: 720px) {
  .dropdown-wrap[data-dropdown="user"] {
    display: none;
  }

  .studio-link span {
    display: none;
  }
}

.notif-btn:hover {
  color: var(--a-color-fg);
  background: var(--a-color-surface-muted);
  text-decoration: none;
}

.notif-count {
  min-width: 1.1rem;
  height: 1.1rem;
  position: absolute;
  top: 0.18rem;
  right: 0.12rem;
  display: grid;
  place-items: center;
  padding: 0 0.2rem;
  border: 1px solid var(--a-color-bg);
  border-radius: var(--a-radius-pill, 999px);
  background: var(--a-color-danger);
  color: var(--a-color-bg);
  font-size: 0.62rem;
  font-weight: var(--a-font-weight-strong, 700);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.dropdown-wrap {
  position: relative;
}

.dropdown-wrap::after {
  content: '';
  display: none;
  position: absolute;
  left: 0;
  top: calc(100% + 4px);
  width: 100%;
  height: 2px;
  background: var(--a-color-fg);
  z-index: var(--a-z-global-menu);
}

.dropdown-wrap.is-open::after {
  display: block;
}

.user-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  background: var(--a-color-bg);
  border: none;
  border-radius: var(--a-radius-none);
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  font-weight: 500;
  font-size: 0.8125rem;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.dropdown-wrap.is-open .user-btn,
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
  left: 0;
  top: calc(100% + 6px);
  background: var(--a-color-bg);
  border: none;
  border-radius: var(--a-radius-none);
  box-shadow: var(--a-shadow-dropdown);
  z-index: var(--a-z-global-menu);
  min-width: 140px;
}

.user-dropdown {
  width: 100%;
  min-width: 0;
}

.user-menu-enter-active {
  transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1), opacity 160ms ease;
}

.user-menu-leave-active {
  transition: transform 120ms cubic-bezier(0.4, 0, 1, 1), opacity 120ms ease;
}

.user-menu-enter-from,
.user-menu-leave-to {
  transform: translateY(-8px);
  opacity: 0;
}

.dropdown-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  text-align: center;
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--a-color-fg);
  text-decoration: none;
  background: none;
  border: 1px solid transparent;
  border-bottom-color: var(--a-color-border-soft);
  cursor: pointer;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.dropdown-item:last-child {
  border-bottom: none;
}

.dropdown-item:hover,
.dropdown-item:focus-visible {
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
  border-color: var(--a-color-border-soft);
  text-decoration: none;
  outline: none;
}

.dropdown-item-danger {
  color: var(--a-color-danger);
}

.dropdown-item-danger:hover,
.dropdown-item-danger:focus-visible {
  background: var(--a-color-surface-muted);
  color: var(--a-color-danger);
  text-decoration: none;
}

.dropdown-divider {
  height: 1px;
  background: var(--a-color-border-soft);
  margin: 0.25rem 0;
}

</style>
