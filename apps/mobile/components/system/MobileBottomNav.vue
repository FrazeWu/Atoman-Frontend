<template>
  <div class="mobile-bottom-nav">
    <nav class="mobile-bottom-nav__bar" aria-label="移动端底部导航">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        class="mobile-bottom-nav__tab"
        :class="{ 'is-active': isTabActive(tab) }"
        :data-tab-key="tab.key"
        data-testid="mobile-bottom-nav-tab"
        @click="onTabClick(tab)"
      >
        <span class="mobile-bottom-nav__icon-wrapper">
          <MIcon :name="tab.icon" size="md" :stroke-width="isTabActive(tab) ? 2.1 : 1.6" />
        </span>
        <span class="mobile-bottom-nav__label">{{ tab.label }}</span>
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MIcon from '@mobile/components/ui/MIcon.vue'
import { SPACE_TABS, type NavTabItem } from './bottomNavConstants'
import { unifiedSearchEnabled } from '@/utils/searchUrl'

const props = withDefaults(
  defineProps<{
    currentSpace?: string
    activeTab?: string
  }>(),
  {
    currentSpace: 'global',
    activeTab: undefined,
  }
)

const emit = defineEmits<{
  (e: 'tab-click', tab: NavTabItem): void
  (e: 'update:activeTab', key: string): void
}>()

let route: ReturnType<typeof useRoute> | undefined
let router: ReturnType<typeof useRouter> | undefined
try {
  route = useRoute()
  router = useRouter()
} catch {
  // outside router context
}

const tabs = computed<NavTabItem[]>(() => {
  const key = props.currentSpace?.toLowerCase() || 'global'
  const items = SPACE_TABS[key] || SPACE_TABS.global || []
  return unifiedSearchEnabled
    ? items.map(tab => (tab.key === 'search' && key !== 'music' && key !== 'global') ? { ...tab, path: `/search?module=${key}` } : tab)
    : items
})

const activeTabKey = computed(() => {
  if (props.activeTab) {
    return props.activeTab
  }
  if (!route?.path) {
    return ''
  }
  const currentPath = route.path.replace(/\/$/, '') || '/'
  const currentFullPath = route.fullPath || currentPath

  // Unified search check
  if (unifiedSearchEnabled && route.path === '/search') {
    if (route.query.module === (props.currentSpace?.toLowerCase() || 'global')) {
      return 'search'
    }
  }
  if (route.path === '/music/search') {
    return 'search'
  }

  // Exact fullPath match (for query-based tabs like /debate?tab=opinions, /studio?tab=drafts)
  const currentTabs = tabs.value
  const queryMatch = currentTabs.find(t => t.path.includes('?') && t.path === currentFullPath)
  if (queryMatch) {
    return queryMatch.key
  }

  // Exact path match
  const pathMatch = currentTabs.find(t => !t.path.includes('?') && (t.path.replace(/\/$/, '') || '/') === currentPath)
  if (pathMatch) {
    return pathMatch.key
  }

  // Special cases:
  // "我的" tab matches /me or /<space>/me
  if (currentPath === '/me' || currentPath.endsWith('/me')) {
    const meTab = currentTabs.find(t => t.key === 'me')
    if (meTab) return 'me'
  }

  // "歌单" tab matches /music/playlists and /music/playlist/:id
  if (currentPath === '/music/playlists' || currentPath.startsWith('/music/playlist/')) {
    const plTab = currentTabs.find(t => t.key === 'playlists')
    if (plTab) return 'playlists'
  }

  return ''
})

const isTabActive = (tab: NavTabItem) => {
  return activeTabKey.value === tab.key
}

const onTabClick = (tab: NavTabItem) => {
  emit('tab-click', tab)
  emit('update:activeTab', tab.key)

  if (router && typeof router.push === 'function') {
    if (route && (route.fullPath === tab.path || route.path === tab.path)) {
      return
    }
    void router.push(tab.path).catch(() => {})
  }
}
</script>

<style scoped>
.mobile-bottom-nav {
  position: relative;
  display: block;
  visibility: visible;
  opacity: 1;
  width: 100%;
  pointer-events: none;
}

.mobile-bottom-nav[style*="display: none"] {
  display: none !important;
}

.mobile-bottom-nav__bar {
  position: relative;
  width: 100%;
  max-width: 480px;
  height: calc(56px + env(safe-area-inset-bottom, 0px));
  min-height: 56px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background-color: var(--a-color-surface, #ffffff);
  border-top: 1px solid var(--a-color-border-soft, #e2e8f0);
  box-shadow: none !important;
  pointer-events: auto;
  visibility: visible;
  opacity: 1;
}

.mobile-bottom-nav__tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 6px 0;
  color: var(--a-color-muted, #64748b);
  text-decoration: none;
  background: transparent;
  border: none;
  font-family: inherit;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition: color 0.15s ease;
}

.mobile-bottom-nav__tab:active {
  color: var(--a-color-fg, #0f172a);
}

.mobile-bottom-nav__tab.is-active {
  color: var(--a-color-primary, #0066cc);
}

.mobile-bottom-nav__icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}

.mobile-bottom-nav__label {
  font-size: 11px;
  font-weight: 500;
  line-height: 1.2;
  letter-spacing: 0;
  text-align: center;
}
</style>
