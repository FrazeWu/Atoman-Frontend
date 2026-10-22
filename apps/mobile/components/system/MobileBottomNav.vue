<template>
  <div class="mobile-bottom-nav">
    <nav class="mobile-bottom-nav__bar" aria-label="移动端底部导航">
      <a
        v-for="tab in tabs"
        :key="tab.key"
        :href="tab.path"
        class="mobile-bottom-nav__tab"
        :class="{ 'is-active': isTabActive(tab) }"
        :data-tab-key="tab.key"
        data-testid="mobile-bottom-nav-tab"
        @click="onTabClick(tab, $event)"
      >
        <span class="mobile-bottom-nav__icon-wrapper">
          <MIcon :name="tab.icon" size="md" :stroke-width="isTabActive(tab) ? 2.1 : 1.6" />
        </span>
        <span class="mobile-bottom-nav__label">{{ tab.label }}</span>
      </a>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MIcon from '@mobile/components/ui/MIcon.vue'
import { SPACE_TABS, type NavTabItem } from './bottomNavConstants'
import { unifiedSearchEnabled } from '@/utils/searchUrl'

const DEFAULT_MUSIC_TABS: NavTabItem[] = [
  { key: 'discover', label: '发现', icon: 'compass', path: '/music' },
  { key: 'search', label: '搜索', icon: 'search', path: '/music/search' },
  { key: 'playlists', label: '歌单', icon: 'playlists', path: '/music/playlists' },
  { key: 'me', label: '我的', icon: 'person', path: '/music/me' },
]

const props = withDefaults(
  defineProps<{
    currentSpace?: string
    activeTab?: string
  }>(),
  {
    currentSpace: 'music',
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
  const key = props.currentSpace?.toLowerCase() || 'music'
  const map = SPACE_TABS || {}
  const items = map[key] || map.music || DEFAULT_MUSIC_TABS
  return unifiedSearchEnabled ? items.map(tab => tab.key === 'search' ? { ...tab, path: `/search?module=${key}` } : tab) : items
})

const isTabActive = (tab: NavTabItem) => {
  if (props.activeTab) {
    return props.activeTab === tab.key
  }
  if (!route?.path) {
    return false
  }
  if (tab.path.includes('?')) {
    return route.fullPath === tab.path
  }
  const currentPath = route.path.replace(/\/$/, '') || '/'
  const targetPath = tab.path.replace(/\/$/, '') || '/'
  const hasTabQuery = Boolean(route.query?.tab)

  if (hasTabQuery) return false

  if (currentPath === targetPath) return true

  // Special case: "我的" (profile) tab can match /me or /<space>/me
  if (tab.key === 'me' && (currentPath === '/me' || currentPath.endsWith('/me'))) {
    return true
  }

  // Special case: "歌单" tab matches /music/playlists and /music/playlist/:id
  if (tab.key === 'playlists' && (currentPath === '/music/playlists' || currentPath.startsWith('/music/playlist/'))) {
    return true
  }

  return false
}

const onTabClick = (tab: NavTabItem, event: MouseEvent) => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
    return
  }
  event.preventDefault()
  emit('tab-click', tab)
  emit('update:activeTab', tab.key)

  if (router && typeof router.push === 'function') {
    void router.push(tab.path).catch(() => {})
  }
}
</script>

<style scoped>
.mobile-bottom-nav {
  position: fixed !important;
  right: 0 !important;
  bottom: 0 !important;
  left: 0 !important;
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  width: 100% !important;
  z-index: 1000 !important;
  pointer-events: none;
}

.mobile-bottom-nav__bar {
  position: relative !important;
  width: 100% !important;
  max-width: 480px !important;
  height: calc(56px + env(safe-area-inset-bottom, 0px)) !important;
  min-height: 56px !important;
  margin: 0 auto !important;
  display: grid !important;
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  padding-bottom: env(safe-area-inset-bottom, 0px) !important;
  background-color: #ffffff !important;
  border-top: 1px solid var(--a-color-border-soft, #e2e8f0) !important;
  box-shadow: 0 -1px 3px rgba(0, 0, 0, 0.04) !important;
  pointer-events: auto !important;
  visibility: visible !important;
  opacity: 1 !important;
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
