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

  <!-- Topbar Search: pill always visible -->
  <div ref="searchWrapRef" class="topbar-search-wrap">
    <button
      class="search-pill"
      :class="{ 'is-active': showSearch }"
      type="button"
      data-testid="topbar-search-pill"
      @click.stop="showSearch ? closeSearch() : openSearch()"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <span>搜索</span>
    </button>
  </div>

  <!-- Search panel: single box containing both input and results, expanding rightwards -->
  <Teleport to="body">
    <div
      v-if="showSearch"
      class="search-panel"
      :style="panelStyle"
      data-testid="topbar-search-dropdown"
      @click.stop
    >
      <!-- Input line within the unified panel -->
      <div class="search-panel__input-row">
        <svg class="search-panel__input-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          ref="searchInputRef"
          v-model="searchDraft"
          class="search-panel__input"
          type="search"
          placeholder="搜索..."
          data-testid="topbar-search-input"
          @input="emitSearchInput"
          @keydown.enter.prevent="expandSearch"
          @keydown.escape="closeSearch"
        />
        <button class="search-panel__close-btn" type="button" @click="closeSearch" aria-label="关闭搜索">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="search-panel__inner">
        <p v-if="globalSearch.loading.value" class="search-panel__hint">搜索中...</p>
        <p v-else-if="searchDraft.trim().length === 0" class="search-panel__hint">输入关键词开始搜索</p>
        <p v-else-if="searchDraft.trim().length < 2" class="search-panel__hint">请再输入一些字符...</p>
        <template v-else-if="globalSearch.sections.value.length > 0">
          <div class="search-panel__body">
            <TopbarSearchSection
              v-for="section in globalSearch.sections.value"
              :key="section.type"
              :section="section"
              :active-id="globalSearch.activeItem.value?.id || ''"
              @open-item="openSearchHref"
              @open-more="openSearchHref"
            />
          </div>
          <div v-if="!isExpanded" class="search-panel__footer">
            <button class="search-panel__expand-btn" type="button" @click="expandSearch">回车查看全部结果</button>
          </div>
        </template>
        <p v-else class="search-panel__hint">没有匹配的结果</p>
      </div>
    </div>
  </Teleport>

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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
const isExpanded = ref(false)
const searchDraft = ref('')
const searchWrapRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)
const panelStyle = ref<Record<string, string>>({})
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

const openSearch = async () => {
  // 先算好面板坐标，再显示 panel，避免首帧位置错误
  updatePanelGeometry()
  showSearch.value = true
  isExpanded.value = false
  await nextTick()
  searchInputRef.value?.focus()
  // 展开后 search-box 改变了布局，再算一次
  updatePanelGeometry()
}

const closeSearch = () => {
  showSearch.value = false
  isExpanded.value = false
  searchDraft.value = ''
  globalSearch.reset()
}

const emitSearchInput = () => {
  isExpanded.value = false
  updatePanelGeometry()
  void globalSearch.search(searchDraft.value, 'preview')
  window.dispatchEvent(new CustomEvent('atoman-topbar-search-input', { detail: searchDraft.value }))
}

const expandSearch = () => {
  isExpanded.value = true
  updatePanelGeometry()
  void globalSearch.search(searchDraft.value, 'expanded')
}

const updatePanelGeometry = () => {
  if (typeof window === 'undefined') return
  const wrap = searchWrapRef.value
  if (!wrap) return
  const rect = wrap.getBoundingClientRect()
  const panelTop = rect.bottom + 4
  const playerEl = document.querySelector('.player')
  const playerTop = playerEl ? playerEl.getBoundingClientRect().top : window.innerHeight
  // 预览模式底边：屏幕高度的 1/3 处
  const previewBottom = window.innerHeight - Math.floor(window.innerHeight / 3)
  // 展开模式底边：音乐播放器上方 8px，或至少留 80px
  const expandedBottom = window.innerHeight - Math.max(playerTop - 8, 80)
  
  // 向右弹出：左边缘对齐 pill 左端，右边缘宽度通过 width 弹性控制，避免溢出视口
  const left = rect.left
  const bottom = isExpanded.value ? expandedBottom : previewBottom
  panelStyle.value = {
    top: `${panelTop}px`,
    left: `${left}px`,
    bottom: `${bottom}px`,
    width: `min(480px, calc(100vw - ${left}px - 16px))`
  }
}

const closeDropdown = () => {
  activeDropdown.value = null
}

const openSearchHref = async (href: string) => {
  showSearch.value = false
  isExpanded.value = false
  searchDraft.value = ''
  globalSearch.reset()
  await router.push(href)
}

const handleClickOutside = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (!target.closest('[data-dropdown]')) closeDropdown()
  // 点击搜索区域（wrap/panel）的事件已被 @click.stop 拦截，
  // 到达 document 的点击一定在搜索区域外，直接关闭搜索
  if (showSearch.value) closeSearch()
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  inboxStore.bootstrap()
  ensureMediaChannels()
  window.addEventListener('resize', updatePanelGeometry)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  inboxStore.disconnect()
  window.removeEventListener('resize', updatePanelGeometry)
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
  display: flex;
  align-items: center;
  z-index: 120;
}

/* Collapsed pill */
.search-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--a-color-bg);
  border: var(--a-border);
  border-radius: var(--a-radius-none);
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--a-color-muted);
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
}

.search-pill:hover {
  color: var(--a-color-fg);
  background: var(--a-color-paper-wash);
  border-color: var(--a-color-ink);
}


.search-panel__input-row {
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--a-color-line-soft);
  padding: 0.5rem 0.75rem;
}

.search-panel__input-icon {
  flex-shrink: 0;
  margin-left: 0.5rem;
  color: var(--a-color-muted);
}

.search-panel__input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--a-color-fg);
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 700;
  font-family: inherit;
  min-width: 0;
}

.search-panel__input:focus {
  outline: none;
}

.search-panel__input::-webkit-search-cancel-button {
  display: none;
}

.search-panel__close-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
  transition: color 0.15s ease;
}

.search-panel__close-btn:hover {
  color: var(--a-color-fg);
}


/* Floating search panel - rendered via Teleport to body */
.search-panel {
  position: fixed;
  z-index: 500;
  bottom: var(--panel-preview-bottom);
  background: var(--a-color-bg);
  border: var(--a-border);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.12);
  overflow-y: auto;
  animation: panelReveal 0.28s cubic-bezier(0.16, 1, 0.3, 1);
  transition: bottom 0.36s cubic-bezier(0.16, 1, 0.3, 1);
}

.search-panel.is-expanded {
  bottom: var(--panel-expanded-bottom);
}

@keyframes panelReveal {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.search-panel__inner {
  padding: 0.75rem 0;
}

.search-panel__hint {
  margin: 0;
  padding: 0.75rem 1.25rem;
  color: var(--a-color-muted);
  font-size: 0.875rem;
  font-weight: 600;
}

.search-panel__body {
  display: grid;
  gap: 0;
}

.search-panel__footer {
  border-top: 1px solid var(--a-color-line-soft);
  padding: 0.5rem 1rem;
  text-align: center;
}

.search-panel__expand-btn {
  background: none;
  border: none;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--a-color-muted);
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  transition: color 0.15s ease;
}

.search-panel__expand-btn:hover {
  color: var(--a-color-fg);
  text-decoration: underline;
}

@media (max-width: 960px) {
  .search-box {
    width: calc(100vw - 10rem);
    max-width: 28rem;
    min-width: 12rem;
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

<!-- Global styles for Teleported search panel (cannot be scoped) -->
<style>
.search-panel {
  position: fixed;
  z-index: 500;
  background: var(--a-color-bg, #fff);
  border: var(--a-border, 1px solid #e4e4e4);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.12);
  overflow-y: auto;
  min-height: 80px;
  animation: atoman-panelReveal 0.28s cubic-bezier(0.16, 1, 0.3, 1);
  transition: bottom 0.36s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes atoman-panelReveal {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.search-panel__inner {
  padding: 0.75rem 0;
}

.search-panel__hint {
  margin: 0;
  padding: 0.75rem 1.25rem;
  color: var(--a-color-muted, #999);
  font-size: 0.875rem;
  font-weight: 600;
}

.search-panel__body {
  display: grid;
  gap: 0;
}

.search-panel__footer {
  border-top: 1px solid var(--a-color-line-soft, #f0f0f0);
  padding: 0.5rem 1rem;
  text-align: center;
}

.search-panel__expand-btn {
  background: none;
  border: none;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--a-color-muted, #999);
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  transition: color 0.15s ease;
}

.search-panel__expand-btn:hover {
  color: var(--a-color-fg, #111);
  text-decoration: underline;
}
</style>
