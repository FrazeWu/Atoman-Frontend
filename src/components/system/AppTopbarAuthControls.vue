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
    <div v-if="showSearch" class="topbar-search-panel" :style="{ height: `${topbarSearchPanelMaxHeight}px` }">
      <div class="topbar-search-panel__head">
        <span class="topbar-search-panel__eyebrow">全站搜索</span>
        <span class="topbar-search-panel__status">
          {{ globalSearch.loading.value ? '搜索中...' : searchDraft.trim().length >= 2 ? '预览结果' : '输入至少 2 个字' }}
        </span>
      </div>
      <div v-if="globalSearch.loading.value" class="topbar-search-panel__hint">搜索中...</div>
      <div v-else-if="searchDraft.trim().length < 2" class="topbar-search-panel__hint">输入至少 2 个字开始搜索，回车展开纸张结果</div>
      <div v-else-if="globalSearch.sections.value.length === 0" class="topbar-search-panel__hint">没有找到匹配内容</div>
      <div v-else class="topbar-search-panel__body">
        <TopbarSearchSection
          v-for="section in globalSearch.sections.value"
          :key="section.type"
          :section="section"
          :active-id="globalSearch.activeItem.value?.id || ''"
          @open-item="openSearchHref"
          @open-more="openSearchHref"
        />
      </div>
    </div>
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
      <RouterLink :to="modulePathUrl('blog', '/bookmarks')" class="dropdown-item" @click="closeDropdown">收藏</RouterLink>
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
import { useGlobalSearch } from '@/composables/useGlobalSearch'
import PSelect from '@/components/ui/PSelect.vue'
import TopbarSearchSection from '@/components/system/TopbarSearchSection.vue'

const authStore = useAuthStore()
const inboxStore = useInboxStore()
const router = useRouter()
const route = useRoute()
const { channels, currentMediaChannelId, switchChannel, clearChannels, loadChannels } = useMediaChannel()
const globalSearch = useGlobalSearch()

const activeDropdown = ref<string | null>(null)
const showSearch = ref(false)
const searchDraft = ref('')
const topbarSearchPanelMaxHeight = ref(320)
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
  updateTopbarSearchPanelMaxHeight()
}

const emitSearchInput = () => {
  showSearch.value = true
  updateTopbarSearchPanelMaxHeight()
  void globalSearch.search(searchDraft.value, 'preview')
  window.dispatchEvent(new CustomEvent('atoman-topbar-search-input', { detail: searchDraft.value }))
}

const expandSearch = () => {
  showSearch.value = true
  updateTopbarSearchPanelMaxHeight()
  void globalSearch.search(searchDraft.value, 'expanded')
}

const closeDropdown = () => {
  activeDropdown.value = null
}

const openSearchHref = async (href: string) => {
  showSearch.value = false
  searchDraft.value = ''
  globalSearch.reset()
  await router.push(href)
}

const handleClickOutside = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (!target.closest('[data-dropdown]')) closeDropdown()
  if (!target.closest('.topbar-search-wrap')) {
    showSearch.value = false
    searchDraft.value = ''
    globalSearch.reset()
  }
}

const updateTopbarSearchPanelMaxHeight = () => {
  if (typeof window === 'undefined') return
  const searchWrap = document.querySelector('.topbar-search-wrap')
  const rect = searchWrap?.getBoundingClientRect()
  const top = rect?.bottom ?? 56
  const playerTop = document.querySelector('.player')?.getBoundingClientRect().top ?? window.innerHeight - 24
  const safeBottom = Math.max(playerTop - 16, top + 220)
  topbarSearchPanelMaxHeight.value = Math.max(safeBottom - top, Math.floor(window.innerHeight / 3))
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
  window.addEventListener('resize', updateTopbarSearchPanelMaxHeight)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  inboxStore.disconnect()
  window.removeEventListener('resize', updateTopbarSearchPanelMaxHeight)
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
  overflow: visible;
  transition: width 0.48s cubic-bezier(0.16, 1, 0.3, 1);
}

.topbar-search-wrap:focus-within,
.topbar-search-wrap:has(.topbar-search-input.is-active) {
  width: 30rem;
}

.topbar-search-input {
  width: 100%;
  border: var(--a-border);
  border-radius: var(--a-radius-none);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  padding: 0.72rem 0.92rem;
  font-size: 0.875rem;
  font-weight: 700;
  transition:
    padding 0.48s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.48s cubic-bezier(0.16, 1, 0.3, 1),
    border-color 0.48s cubic-bezier(0.16, 1, 0.3, 1);
}

.topbar-search-input.is-active {
  padding-top: 0.86rem;
  padding-bottom: 0.86rem;
}

.topbar-search-input:focus {
  outline: none;
  border-color: var(--a-color-fg);
  box-shadow: inset 0 0 0 1px var(--a-color-fg);
}

.topbar-search-panel {
  position: absolute;
  top: calc(100% - 1px);
  left: 0;
  right: 0;
  z-index: 80;
  border: 1px solid var(--a-color-line-soft);
  border-top: 0;
  background: color-mix(in srgb, var(--a-color-paper) 94%, #f3eee5 6%);
  box-shadow: 0 10px 24px rgba(18, 18, 18, 0.05);
  padding: 1.25rem 1.2rem 1.3rem;
  animation: topbarSearchReveal 0.52s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: auto;
  box-sizing: border-box;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
}

.topbar-search-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.topbar-search-panel__eyebrow,
.topbar-search-panel__status {
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.topbar-search-panel__eyebrow {
  color: var(--a-color-muted-soft);
}

.topbar-search-panel__status {
  color: var(--a-color-ink-soft);
}

.topbar-search-panel__hint {
  color: var(--a-color-muted);
  font-size: 0.88rem;
  font-weight: 700;
  line-height: 1.6;
}

.topbar-search-panel__body {
  display: grid;
  gap: 1rem;
  align-content: start;
  overflow: auto;
  min-height: 0;
}

@keyframes topbarSearchReveal {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 960px) {
  .topbar-search-wrap {
    width: 8.5rem;
  }

  .topbar-search-wrap:focus-within,
  .topbar-search-wrap:has(.topbar-search-input.is-active) {
    width: min(22rem, 52vw);
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
