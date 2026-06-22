<template>
  <div v-if="showKanboChannelSwitch" class="channel-select-wrap">
    <PSelect
      :model-value="currentKanboChannelId || ''"
      :options="[
        { label: '频道', value: '' },
        ...channels.map(channel => ({ label: channel.name, value: channel.id }))
      ]"
      @update:model-value="onKanboChannelChange"
    />
  </div>

  <RouterLink to="/inbox" class="notif-btn" :title="notificationRoom.helper">
    {{ notificationRoom.name }}
    <span v-if="inboxStore.totalUnread > 0" class="notif-count">{{ inboxStore.totalUnread }}</span>
  </RouterLink>

  <div class="dropdown-wrap" data-dropdown="user">
    <button class="user-btn" @click="toggleDropdown('user')">
      <span class="user-avatar">{{ userInitial }}</span>
      <span class="user-name">{{ authStore.user?.username }}</span>
      <span class="chevron" :style="activeDropdown === 'user' ? 'transform:rotate(180deg)' : ''">▾</span>
    </button>
    <div v-if="activeDropdown === 'user'" class="dropdown user-dropdown">
      <a :href="userUrl(authStore.user?.username || '')" class="dropdown-item" @click="closeDropdown">我的主页</a>
      <RouterLink to="/bookmarks" class="dropdown-item" @click="closeDropdown">我的收藏</RouterLink>
      <RouterLink to="/settings" class="dropdown-item" @click="closeDropdown">编辑资料</RouterLink>
      <RouterLink v-if="showSiteSettings" to="/setting" class="dropdown-item" @click="closeDropdown">站点设置</RouterLink>
      <button class="dropdown-item dropdown-item-danger" @click="logout">退出登录</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useInboxStore } from '@/stores/inbox'
import { notificationRoom } from '@/config/moduleRooms'
import { userUrl } from '@/router/siteUrls'
import { resolveSiteContext } from '@/router/siteContext'
import { isAdminRole } from '@/utils/roles'
import { useKanboChannel } from '@/composables/useKanboChannel'
import PSelect from '@/components/ui/PSelect.vue'

const authStore = useAuthStore()
const inboxStore = useInboxStore()
const router = useRouter()
const route = useRoute()
const { channels, currentKanboChannelId, switchChannel, clearChannels, loadChannels } = useKanboChannel()

const activeDropdown = ref<string | null>(null)
const lastLoadedKanboChannelUserId = ref<string | number | null>(null)
const userInitial = computed(() => (authStore.user?.username || '?').charAt(0).toUpperCase())
const authUserId = computed(() => authStore.user?.uuid ?? authStore.user?.id)
const showSiteSettings = computed(() => isAdminRole(authStore.user?.role))
const showKanboChannelSwitch = computed(() => {
  if (route.query.site === 'kanbo') return true
  if (typeof window === 'undefined') return false
  const siteContext = resolveSiteContext(window.location.hostname, window.location.search)
  return siteContext.type === 'module' && siteContext.module === 'kanbo'
})

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

const ensureKanboChannels = () => {
  const userId = authUserId.value
  if (!showKanboChannelSwitch.value) return
  if (!userId) {
    lastLoadedKanboChannelUserId.value = null
    clearChannels()
    return
  }
  if (lastLoadedKanboChannelUserId.value === userId && channels.value.length > 0) return

  lastLoadedKanboChannelUserId.value = userId
  void loadChannels(authStore.token, userId)
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  inboxStore.bootstrap()
  ensureKanboChannels()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  inboxStore.disconnect()
})

const logout = () => {
  authStore.logout()
  closeDropdown()
  inboxStore.disconnect()
  router.push('/login')
}

const onKanboChannelChange = (value: string | number) => {
  const channelId = String(value) || null
  void switchChannel(channelId, authStore.token)
}

watch(showKanboChannelSwitch, ensureKanboChannels)
watch(authUserId, ensureKanboChannels)
</script>

<style scoped>
.channel-select-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.channel-select {
  min-width: 8rem;
  max-width: 12rem;
  border: var(--a-border);
  border-radius: var(--a-radius-none);
  padding: 0.35rem 2rem 0.35rem 0.6rem;
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  font-size: 0.8rem;
  font-weight: var(--a-font-weight-strong, 700);
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
}

.channel-select-icon {
  position: absolute;
  right: 8px;
  pointer-events: none;
  color: var(--a-color-ink-soft);
}

.notif-btn {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--a-color-muted);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  position: relative;
  transition: color 0.2s;
  text-decoration: none;
}

.notif-btn:hover {
  color: var(--a-color-fg);
  text-decoration: underline;
}

.notif-count {
  display: inline-block;
  margin-left: 3px;
  background: var(--a-color-ink);
  color: var(--a-color-paper);
  font-size: 0.6rem;
  font-weight: var(--a-font-weight-strong, 700);
  border-radius: 0;
  border: 1px solid var(--a-color-ink);
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
  font-weight: 700;
  font-size: 0.875rem;
  transition: all 0.15s ease;
}

.user-btn:hover {
  background: var(--a-color-paper-wash);
}

.user-avatar {
  width: 24px;
  height: 24px;
  border-radius: var(--a-radius-none);
  background: var(--a-color-ink);
  color: var(--a-color-paper);
  font-weight: var(--a-font-weight-strong, 700);
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-name {
  font-weight: 700;
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
  font-weight: 700;
  color: var(--a-color-fg);
  text-decoration: none;
  background: none;
  border: none;
  border-bottom: 1px solid var(--a-color-line-soft);
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
  background: var(--a-color-line-soft);
  margin: 0.25rem 0;
}
</style>
