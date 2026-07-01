<template>
  <div v-if="showMediaChannelSwitch" class="channel-select-wrap">
    <PSelect
      :model-value="currentMediaChannelId || ''"
      :options="[
        { label: '频道', value: '' },
        ...channels.map(channel => ({ label: channel.name, value: channel.id }))
      ]"
      @update:model-value="onMediaChannelChange"
    />
  </div>

  <div class="topbar-search-wrap">
    <input
      v-model="searchDraft"
      class="topbar-search-input"
      :class="{ 'is-active': showSearch }"
      type="search"
      placeholder="搜索..."
      @focus="openSearch"
      @input="emitSearchInput"
      @keydown.enter.prevent="expandSearch"
    />
    <TopbarSearchPopover :open="showSearch" @close="showSearch = false" />
  </div>

  <RouterLink :to="modulePathUrl('feed', '/inbox')" class="notif-btn" :title="notificationRoom.helper">
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
      <RouterLink :to="modulePathUrl('blog', '/bookmarks')" class="dropdown-item" @click="closeDropdown">我的收藏</RouterLink>
      <RouterLink :to="modulePathUrl('blog', '/settings')" class="dropdown-item" @click="closeDropdown">编辑资料</RouterLink>
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
import { modulePathUrl, userUrl } from '@/router/siteUrls'
import { resolveSiteContext } from '@/router/siteContext'
import { isAdminRole } from '@/utils/roles'
import { useMediaChannel } from '@/composables/useMediaChannel'
import PSelect from '@/components/ui/PSelect.vue'
import TopbarSearchPopover from '@/components/system/TopbarSearchPopover.vue'

const authStore = useAuthStore()
const inboxStore = useInboxStore()
const router = useRouter()
const route = useRoute()
const { channels, currentMediaChannelId, switchChannel, clearChannels, loadChannels } = useMediaChannel()

const activeDropdown = ref<string | null>(null)
const showSearch = ref(false)
const searchDraft = ref('')
const lastLoadedMediaChannelUserId = ref<string | number | null>(null)
const userInitial = computed(() => (authStore.user?.username || '?').charAt(0).toUpperCase())
const authUserId = computed(() => authStore.user?.uuid ?? authStore.user?.id)
const showSiteSettings = computed(() => isAdminRole(authStore.user?.role))
const showMediaChannelSwitch = computed(() => {
  if (typeof window === 'undefined') return false
  const siteContext = resolveSiteContext(window.location.hostname, window.location.search, route.path)
  return siteContext.type === 'module' && siteContext.module === 'media'
})

const toggleDropdown = (name: string) => {
  activeDropdown.value = activeDropdown.value === name ? null : name
}

const openSearch = () => {
  showSearch.value = true
}

const emitSearchInput = () => {
  showSearch.value = true
  window.dispatchEvent(new CustomEvent('atoman-topbar-search-input', { detail: searchDraft.value }))
}

const expandSearch = () => {
  showSearch.value = true
  window.dispatchEvent(new CustomEvent('atoman-topbar-search-expand'))
}

const closeDropdown = () => {
  activeDropdown.value = null
}

const handleClickOutside = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (!target.closest('[data-dropdown]')) closeDropdown()
  if (!target.closest('.topbar-search-wrap')) {
    showSearch.value = false
    searchDraft.value = ''
  }
}

const ensureMediaChannels = () => {
  const userId = authUserId.value
  if (!showMediaChannelSwitch.value) return
  if (!userId) {
    lastLoadedMediaChannelUserId.value = null
    clearChannels()
    return
  }
  if (lastLoadedMediaChannelUserId.value === userId && channels.value.length > 0) return

  void loadChannels(authStore.token, userId)
    .then(() => {
      if (authUserId.value === userId) {
        lastLoadedMediaChannelUserId.value = userId
      }
    })
    .catch(() => {
      if (lastLoadedMediaChannelUserId.value === userId) {
        lastLoadedMediaChannelUserId.value = null
      }
    })
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  inboxStore.bootstrap()
  ensureMediaChannels()
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

const onMediaChannelChange = (value: string | number) => {
  const channelId = String(value) || null
  void switchChannel(channelId, authStore.token)
}

watch(showMediaChannelSwitch, ensureMediaChannels)
watch(authUserId, ensureMediaChannels)
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

.topbar-search-wrap {
  position: relative;
  width: 10rem;
  transition: width 0.24s cubic-bezier(0.2, 0, 0, 1);
}

.topbar-search-wrap:focus-within,
.topbar-search-wrap:has(.topbar-search-input.is-active) {
  width: 24rem;
}

.topbar-search-input {
  width: 100%;
  border: var(--a-border);
  border-radius: var(--a-radius-none);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  padding: 0.4rem 0.7rem;
  font-size: 0.875rem;
  font-weight: 700;
  transition:
    padding 0.24s cubic-bezier(0.2, 0, 0, 1),
    box-shadow 0.24s cubic-bezier(0.2, 0, 0, 1),
    border-color 0.24s cubic-bezier(0.2, 0, 0, 1);
}

.topbar-search-input.is-active {
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
}

.topbar-search-input:focus {
  outline: none;
  border-color: var(--a-color-fg);
  box-shadow: inset 0 0 0 1px var(--a-color-fg);
}

@media (max-width: 960px) {
  .topbar-search-wrap {
    width: 8.5rem;
  }

  .topbar-search-wrap:focus-within,
  .topbar-search-wrap:has(.topbar-search-input.is-active) {
    width: min(16rem, 42vw);
  }
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
