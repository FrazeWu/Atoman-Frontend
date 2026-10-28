<template>
  <div
    class="app-shell mobile-app-shell"
    :class="{ 'mobile-app-shell--with-player': showMobilePlayer }"
  >
    <MobileTopbar
      v-if="showMobileTopbar"
      :current-space="currentSpace"
      :show-back="isSubRoute"
      :hide-actions="isSubRoute"
      :title="isSubRoute ? subRouteTitle : undefined"
      @back="handleBack"
      @open-drawer="isDrawerOpen = true"
      @search="handleSearch"
      @notifications="handleNotifications"
    />
    <MobileSpaceDrawer
      :open="isDrawerOpen"
      :current-space="currentSpace"
      @update:open="isDrawerOpen = $event"
      @select-space="handleSelectSpace"
      @close="isDrawerOpen = false"
    />
    <main
      class="app-main mobile-app-main"
      :class="{ 'app-main--auth': isAuthRoute, 'mobile-app-main--no-bottom-nav': !showMobileBottomNav, 'mobile-app-main--with-player': showMobilePlayer }"
    >
      <RouterView v-slot="{ Component, route: viewRoute }">
        <Transition :name="mobileRouteTransition">
          <KeepAlive :key="authStore.user?.uuid || 'guest'" :max="6">
            <component :is="Component" :key="viewRoute.meta.mobileModule || /^\/(feed|music|studio)(\/|$)/.test(viewRoute.path) ? viewRoute.matched[0]?.path : viewRoute.path" />
          </KeepAlive>
        </Transition>
      </RouterView>
    </main>
    <div
      v-if="showMobilePlayer || showMobileBottomNav"
      class="mobile-app-dock"
      :class="{ 'mobile-app-dock--without-nav': !showMobileBottomNav }"
    >
      <MobileAudioPlayer v-if="showMobilePlayer" />
      <MobileBottomNav
        v-if="showMobileBottomNav"
        :current-space="currentSpace"
      />
    </div>
    <PToastHost />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSiteAccessStore } from '@/stores/siteAccess'
import { useAuthStore } from '@/stores/auth'
import { searchLocation, unifiedSearchEnabled } from '@/utils/searchUrl'
import { usePlayerPresenceStore } from '@/stores/playerPresence'
import { apiRequest } from '@/api/client'
import { useApiUrl } from '@/composables/useApiUrl'
import { scheduleGoogleAnalytics } from '@/utils/analytics'
import { scheduleIdleTask } from '@/utils/scheduleIdleTask'
import { isMobileDetailRoute } from './mobileRouteMeta'
import { resolveMobileSpace, type MobileSpace } from './mobileSpace'
import { SPACE_PATHS } from './components/system/spaceConstants'
import MobileTopbar from './components/system/MobileTopbar.vue'
import MobileSpaceDrawer from './components/system/MobileSpaceDrawer.vue'
import MobileBottomNavComponent from './components/system/MobileBottomNav.vue'
import PToastHost from '@/components/ui/PToastHost.vue'
import './mobileModules.css'
import './mobileDiscovery.css'
import './mobileSaved.css'
import './mobileContent.css'

// Direct static component binding prevents async chunk circular-deadlock on iOS WebKit
const MobileBottomNav = MobileBottomNavComponent
// defineAsyncComponent(() => import('./components/system/MobileBottomNav.vue'))
const MobileAudioPlayer = defineAsyncComponent(() => import('./MobileAudioPlayer.vue'))

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

const route = useRoute()
const router = useRouter()
const siteAccessStore = useSiteAccessStore()
const authStore = useAuthStore()
const playerPresence = usePlayerPresenceStore()
const apiUrl = useApiUrl()

const isAuthRoute = computed(() => {
  const p = (route.path || '/').replace(/\/$/, '') || '/'
  if (/^\/(?:login|register|forgot-password|auth\/oauth)(\/|$)/.test(p)) return true
  return route.matched?.some((record) => record.meta?.authLayout) ?? false
})

const isUtilityRoute = computed(() => {
  return /^\/(?:search|about|terms|privacy|modules|users\/[^/]+\/settings)(\/|$)/.test(route.path)
})

const isSubRoute = computed(() => {
  return (
    isAuthRoute.value ||
    isUtilityRoute.value ||
    isDetailRoute.value ||
    /^\/music\/(?:tags|songs|albums|artists|imports|more)(\/|$)/.test(route.path) ||
    /^\/feed\/(?:sources|stats)(\/|$)/.test(route.path) ||
    /^\/posts\/subscriptions(\/|$)/.test(route.path) ||
    /^\/(?:channel|channels|collection)(\/|$)/.test(route.path) ||
    /^\/debate\/(?:rules|me)(\/|$)/.test(route.path) ||
    /^\/studio\/(?:editor|new)(\/|$)/.test(route.path)
  )
})

const subRouteTitle = computed(() => {
  const p = route.path || '/'
  if (p === '/search') return '全站搜索'
  if (p.startsWith('/login')) return '登录'
  if (p.startsWith('/register')) return '注册'
  if (p.startsWith('/forgot-password')) return '重置密码'
  if (p.startsWith('/about')) return '关于'
  if (p.startsWith('/terms')) return '服务条款'
  if (p.startsWith('/privacy')) return '隐私政策'
  if (p.startsWith('/modules')) return '功能目录'
  if (p.includes('/settings')) return '设置'
  if (p.startsWith('/music/tags')) return '标签'
  if (p.startsWith('/music/song')) return '歌曲详情'
  if (p.startsWith('/music/albums')) return '专辑'
  if (p.startsWith('/music/artists')) return '艺术家'
  if (p.startsWith('/music/imports')) return '导入记录'
  if (/^\/music\/playlist\//.test(p)) return '歌单详情'
  if (p.startsWith('/music/more')) return '更多'
  if (p.startsWith('/posts/notes')) return '短笺'
  if (p.startsWith('/posts/articles')) return '长文'
  if (p.startsWith('/posts/subscriptions')) return '订阅'
  if (/^\/channels?(\/|$)/.test(p)) return '专栏'
  if (p.startsWith('/collection')) return '合集'
  if (p.startsWith('/feed/stats')) return '阅读统计'
  if (p.startsWith('/feed/sources')) return '订阅源管理'
  if (p.startsWith('/debate/rules')) return '辩论规则'
  if (p.startsWith('/debate/me')) return '我的辩题'
  if (/^\/debate\/(?!search(?:\/|$)|me(?:\/|$)|rules(?:\/|$))[^/]+/.test(p)) return '辩题详情'
  if (p.startsWith('/studio/editor')) return '编辑内容'
  if (p.startsWith('/studio/new')) return '新建内容'
  return ''
})

const isDetailRoute = computed(() => isMobileDetailRoute(route.path))

const isFullscreenPlayerRoute = computed(() => (
  route.path === '/music/player' || route.path === '/music/lyrics'
))

const showMobileTopbar = computed(() => {
  if (route.path === '/feed' && typeof route.query.source_id === 'string') return false
  if (isFullscreenPlayerRoute.value) return false
  if (/^\/books\/(?:read|public-read)\//.test(route.path)) return false
  if (/^\/(?:inbox|messages)\/chat\//.test(route.path)) return false
  if (/^\/feed\/(?:article|item)\//.test(route.path)) return false
  if (/^\/(?:post|posts\/post)\//.test(route.path)) return false
  if (/^\/music\/(?:playlist|album|artist|song|songs)\//.test(route.path)) return false
  // The book detail already renders a local back/share toolbar.
  if (/^\/books\/work\//.test(route.path)) return false
  if (/^\/posts\/notes\/[^/]+/.test(route.path)) return false
  return true
})

const showMobileBottomNav = computed(() => {
  const p = (route.path || '/').replace(/\/$/, '') || '/'
  if (p === '/music/lyrics') return false
  if (/^\/music(\/|$)/.test(p)) return true
  if (isAuthRoute.value) return false
  if (/^\/books\/(?:read|public-read)\//.test(p)) return false
  if (/^\/(?:inbox|messages)\/chat\//.test(p)) return false
  if (/^\/posts\/notes\/[^/]+/.test(p)) return false
  return true
})

const showMobilePlayer = computed(() => (
  playerPresence.hasCurrentTrack && !isFullscreenPlayerRoute.value
))

const mobileRouteTransition = ref('')

const handleBack = () => {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back()
  } else {
    const spacePath = SPACE_PATHS[currentSpace.value] || '/'
    void router.push(spacePath)
  }
}

const isDrawerOpen = ref(false)

const lastActiveSpace = ref<MobileSpace>('global')

const currentSpace = computed<MobileSpace>(() =>
  resolveMobileSpace(route.path || '/', route.query.module, lastActiveSpace.value)
)

watch(
  () => route.path,
  (path) => {
    const next = resolveMobileSpace(path || '/')
    if (next !== 'global') lastActiveSpace.value = next
  },
  { immediate: true }
)

const handleSelectSpace = (spaceKey: string) => {
  isDrawerOpen.value = false
  const targetPath = SPACE_PATHS[spaceKey] || '/'
  if (router && typeof router.push === 'function') {
    void router.push(targetPath).catch(() => {})
  }
}

const handleSearch = () => {
  if (currentSpace.value === 'music') {
    void router.push('/music/search').catch(() => {})
    return
  }
  if (unifiedSearchEnabled) {
    void router.push(searchLocation('', currentSpace.value === 'global' ? '' : currentSpace.value))
    return
  }
  if (router && typeof router.push === 'function') {
    if (currentSpace.value === 'books') {
      void router.push('/books/search').catch(() => {})
    } else if (currentSpace.value === 'debate') {
      void router.push('/debate/search').catch(() => {})
    } else {
      void router.push(`/${currentSpace.value}`).catch(() => {})
    }
  }
}

const handleNotifications = () => {
  if (router && typeof router.push === 'function') {
    void router.push('/inbox').catch(() => {})
  }
}

watch(() => route.fullPath, (to, from) => {
  if (isMobileDetailRoute(to)) {
    mobileRouteTransition.value = 'mobile-detail-forward'
  } else if (from && isMobileDetailRoute(from)) {
    mobileRouteTransition.value = 'mobile-detail-back'
  } else {
    mobileRouteTransition.value = ''
  }
  reportPageView()
  reportAnalyticsPageView()
})

const reportPageView = () => {
  if (isAuthRoute.value) return
  try {
    const res = apiRequest(`${apiUrl}/site/visits`, { method: 'POST', keepalive: true })
    if (res && typeof (res as Promise<unknown>).catch === 'function') {
      void (res as Promise<unknown>).catch(() => {})
    }
  } catch {
    // ignore
  }
}

const reportAnalyticsPageView = () => {
  if (isAuthRoute.value) return
  const ga = window.gtag
  if (typeof ga === 'function') {
    ga('event', 'page_view', { page_path: route.fullPath, page_location: window.location.href })
  }
}

let cancelStartupTasks: (() => void) | undefined

onMounted(() => {
  const cancelSiteAccessLoad = scheduleIdleTask(() => {
    void siteAccessStore.load().catch(() => {})
  }, 5000, 8000)
  const cancelPageView = scheduleIdleTask(reportPageView, 5000, 8000)

  cancelStartupTasks = () => {
    cancelSiteAccessLoad()
    cancelPageView()
  }

  scheduleGoogleAnalytics(reportAnalyticsPageView)
})

onBeforeUnmount(() => {
  cancelStartupTasks?.()
})
</script>

<style>
html,
body,
#app {
  min-height: 100%;
}

html {
  overflow-x: clip;
  overscroll-behavior-x: none;
}

body {
  width: 100%;
  max-width: 100%;
  overflow-x: clip;
  overscroll-behavior-x: none;
}

.mobile-app-shell {
  min-width: 0;
  min-height: 100dvh;
  width: 100%;
  max-width: 100%;
  /* hidden 会将 overflow-y 计算为 auto，避免在固定底栏外再创建滚动容器。 */
  overflow-x: clip;
  overscroll-behavior-x: none;
  --mobile-app-player-height: 56px;
  --mobile-app-player-reserved-height: 0px;
  --a-z-navigation: 1000;
  --a-color-bg: #ffffff;
  --a-color-fg: #1c1c1e;
  --a-color-text: #1c1c1e;
  --a-color-text-secondary: #3a3a3c;
  --a-color-surface: #ffffff;
  --a-color-surface-muted: #f8fafc;
  --a-color-border: #e2e8f0;
  --a-color-border-soft: #e2e8f0;
  --a-color-muted: #5c5c60;
  --a-color-muted-soft: #48484a;
  --a-color-primary: #0066cc;
  --a-color-primary-hover: #005bb5;
  --a-color-primary-pressed: #004c99;
  --a-color-primary-contrast: #ffffff;
  --a-radius-base: 4px;
  --a-radius-control: 4px;
  --a-radius-card: 4px;
  --a-shadow-button: none;
  --a-shadow-dropdown: none;
  --a-shadow-modal: none;
  --a-shadow-sm: none;
  --a-shadow-md: none;
  --a-shadow-lg: none;
  --a-shadow-hover: none;
  --a-shadow-active: none;
  --a-font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Microsoft YaHei", sans-serif;
}

.mobile-app-main {
  min-width: 0;
  width: 100%;
  max-width: 100%;
  padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px));
}

/* 播放器和导航共用一个固定容器，位置由正常文档流决定，不再各自偏移。 */
.mobile-app-dock {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: var(--a-z-navigation);
  pointer-events: none;
}

.mobile-app-dock--without-nav {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.mobile-app-shell .mobile-app-dock > .mobile-mini-player {
  position: relative;
  inset: auto;
  pointer-events: auto;
}

.mobile-app-main--no-bottom-nav {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.mobile-app-main--with-player {
  padding-bottom: calc(56px + var(--mobile-app-player-height, 64px) + env(safe-area-inset-bottom, 0px));
}

.mobile-app-main--no-bottom-nav.mobile-app-main--with-player {
  padding-bottom: calc(var(--mobile-app-player-height, 64px) + env(safe-area-inset-bottom, 0px));
}

.mobile-app-shell--with-player {
  --mobile-app-player-reserved-height: var(--mobile-app-player-height);
}

.mobile-app-main > .mobile-detail-forward-enter-active,
.mobile-app-main > .mobile-detail-forward-leave-active,
.mobile-app-main > .mobile-detail-back-enter-active,
.mobile-app-main > .mobile-detail-back-leave-active {
  transition: transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 240ms ease;
}

.mobile-app-main > .mobile-detail-forward-enter-active,
.mobile-app-main > .mobile-detail-back-enter-active {
  position: relative;
  z-index: 1;
}

.mobile-app-main > .mobile-detail-forward-leave-active,
.mobile-app-main > .mobile-detail-back-leave-active {
  position: absolute;
  inset: 0;
  width: 100%;
}

.mobile-detail-forward-enter-from {
  opacity: 0.96;
  transform: translateY(100%);
}

.mobile-detail-forward-leave-to {
  opacity: 0.96;
  transform: translateY(-2%);
}

.mobile-detail-back-enter-from {
  opacity: 0.96;
  transform: translateY(-2%);
}

.mobile-detail-back-leave-to {
  opacity: 0.96;
  transform: translateY(100%);
}

@media (prefers-reduced-motion: reduce) {
  .mobile-app-main > .mobile-detail-forward-enter-active,
  .mobile-app-main > .mobile-detail-forward-leave-active,
  .mobile-app-main > .mobile-detail-back-enter-active,
  .mobile-app-main > .mobile-detail-back-leave-active {
    transition-duration: 1ms;
  }
}

.mobile-app-shell .p-dropdown-panel {
  position: static;
  min-width: 0;
  margin-top: 0.5rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
  box-shadow: none;
  background: var(--a-color-surface);
}

.mobile-app-shell .p-dropdown-panel .p-dropdown-item {
  min-height: 44px;
  display: flex;
  align-items: center;
}

.mobile-app-main .a-page,
.mobile-app-main .a-page-md,
.mobile-app-main .a-page-sm,
.mobile-app-main .a-page-xl {
  max-width: none;
  margin: 0;
  padding-right: 1rem;
  padding-left: 1rem;
}

@media (min-width: 768px) {
  .mobile-app-shell {
    max-width: 480px;
    margin: 0 auto;
    border-right: 1px solid var(--a-color-border-soft);
    border-left: 1px solid var(--a-color-border-soft);
  }
}
</style>
