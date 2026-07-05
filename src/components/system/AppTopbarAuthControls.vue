<template>
  <!-- Topbar Search -->
  <div ref="searchWrapRef" class="topbar-search-wrap" :class="{ 'is-open': showSearch }">
    <!-- Collapsed pill: shown when search not active -->
    <button
      v-if="!showSearch"
      class="search-pill"
      type="button"
      data-testid="topbar-search-pill"
      @click.stop="openSearch"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <span>搜索...</span>
    </button>

    <!-- Expanded search input -->
    <div v-else class="search-box" @click.stop>
      <svg class="search-box-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        ref="searchInputRef"
        v-model="searchDraft"
        class="topbar-search-input"
        type="search"
        placeholder="搜索..."
        data-testid="topbar-search-input"
        @input="emitSearchInput"
        @keydown.enter.prevent="expandSearch"
        @keydown.escape="closeSearch"
      />
      <button class="search-close-btn" type="button" @click="closeSearch" aria-label="关闭搜索">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <!-- Search panel: positioned absolutely relative to topbar-search-wrap, drops down and expands rightwards -->
    <Transition name="search-panel-slide">
      <div
        v-if="showSearch"
        class="search-panel"
        :style="{ '--panel-height': isExpanded ? '70vh' : '30vh' }"
        data-testid="topbar-search-dropdown"
        @click.stop
      >
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
    </Transition>
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useInboxStore } from '@/stores/inbox'
import { notificationRoom } from '@/config/moduleRooms'
import { modulePathUrl, userUrl } from '@/router/siteUrls'
import { isAdminRole } from '@/utils/roles'
import { useGlobalSearch } from '@/composables/useGlobalSearch'
import TopbarSearchSection from '@/components/system/TopbarSearchSection.vue'

const authStore = useAuthStore()
const inboxStore = useInboxStore()
const router = useRouter()
const globalSearch = useGlobalSearch()

const activeDropdown = ref<string | null>(null)
const showSearch = ref(false)
const isExpanded = ref(false)
const searchDraft = ref('')
const searchWrapRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)
const userInitial = computed(() => (authStore.user?.username || '?').charAt(0).toUpperCase())
const showSiteSettings = computed(() => isAdminRole(authStore.user?.role))

const toggleDropdown = (name: string) => {
  activeDropdown.value = activeDropdown.value === name ? null : name
}

const openSearch = async () => {
  showSearch.value = true
  isExpanded.value = false
  await nextTick()
  searchInputRef.value?.focus()
}

const closeSearch = () => {
  showSearch.value = false
  isExpanded.value = false
  searchDraft.value = ''
  globalSearch.reset()
}

const emitSearchInput = () => {
  isExpanded.value = false
  void globalSearch.search(searchDraft.value, 'preview')
  window.dispatchEvent(new CustomEvent('atoman-topbar-search-input', { detail: searchDraft.value }))
}

const expandSearch = () => {
  isExpanded.value = true
  void globalSearch.search(searchDraft.value, 'expanded')
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
  margin-left: auto;
  margin-right: 4rem; /* 向左推开，避免拥挤右边 */
  flex-shrink: 0;
  width: 400px; /* 默认就是展开后的大致宽度 */
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.topbar-search-wrap.is-open {
  /* 长度不再变化，高度通过内部 dropdown 延伸 */
}

/* Collapsed pill */
.search-pill {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  background: var(--a-color-bg);
  border: var(--a-border);
  border-radius: var(--a-radius-none);
  height: 36px; /* 固定的 36px 高度，保证与展开时高度一致，防止跳动 */
  padding: 0 0.75rem; /* 取消上下内边距，完全通过 height 居中 */
  margin: 0;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--a-color-muted);
  cursor: pointer;
  white-space: nowrap;
  width: 100%; /* 占满父级 400px */
  text-align: left;
  transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
  box-sizing: border-box;
}

.search-pill:hover {
  color: var(--a-color-fg);
  background: var(--a-color-paper-wash);
  border-color: var(--a-color-ink);
}

.search-box {
  display: flex;
  align-items: center;
  gap: 0;
  margin: 0;
  border: 1px solid var(--a-color-fg);
  border-bottom: 1px solid var(--a-color-line-soft); /* 输入框下方的横线 */
  background: var(--a-color-bg);
  width: 100%; /* 占满父级 400px */
  height: 36px; /* 固定的 36px 高度 */
  box-sizing: border-box;
}

.search-box-icon {
  flex-shrink: 0;
  margin-left: 0.75rem;
  color: var(--a-color-muted);
}

.topbar-search-input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--a-color-fg);
  padding: 0 0.75rem; /* 移除上下 padding */
  height: 100%; /* 占满父级容器高度 */
  font-size: 0.875rem;
  font-weight: 700;
  font-family: inherit;
  min-width: 0;
}

.topbar-search-input:focus {
  outline: none;
}

.topbar-search-input::-webkit-search-cancel-button {
  display: none;
}

.search-close-btn {
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

.search-close-btn:hover {
  color: var(--a-color-fg);
}



/* Floating search panel */
.search-panel {
  position: absolute;
  top: 100%; /* 与输入框无缝连接 */
  left: 0;
  z-index: 500;
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-fg);
  border-top: none; /* 移除顶部边框，避免双重边框 */
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.12);
  overflow-y: auto;
  min-height: 80px;
  width: 100%;
  max-width: calc(100vw - 20px);
  max-height: var(--panel-height, 30vh);
  animation: panelReveal 0.28s cubic-bezier(0.16, 1, 0.3, 1);
  transition: max-height 0.28s cubic-bezier(0.16, 1, 0.3, 1);
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
  .topbar-search-wrap {
    width: 200px;
    margin-right: 1.5rem;
  }
  .topbar-search-wrap.is-open {
    width: 320px;
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

/* 下拉菜单向下平滑展开延伸的动画 */
.search-panel-slide-enter-active,
.search-panel-slide-leave-active {
  transition: max-height 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
  overflow: hidden;
}

.search-panel-slide-enter-from,
.search-panel-slide-leave-to {
  max-height: 0 !important;
  opacity: 0;
}
</style>
