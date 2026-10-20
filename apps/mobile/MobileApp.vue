<template>
  <div class="app-shell mobile-app-shell" :class="{ 'mobile-app-shell--with-player': showMobilePlayer }">
    <MobileTopbar
      :current-space="currentSpace"
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
    <MobileAudioPlayer v-if="showMobilePlayer" />
    <MobileBottomNav
      v-if="showMobileBottomNav"
      :current-space="currentSpace"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSiteAccessStore } from '@/stores/siteAccess'
import { useAuthStore } from '@/stores/auth'
import { usePlayerPresenceStore } from '@/stores/playerPresence'
import { apiRequest } from '@/api/client'
import { useApiUrl } from '@/composables/useApiUrl'
import { scheduleGoogleAnalytics } from '@/utils/analytics'
import { scheduleIdleTask } from '@/utils/scheduleIdleTask'
import { isMobileDetailRoute } from './mobileRouteMeta'
import MobileTopbar from './components/system/MobileTopbar.vue'
import MobileSpaceDrawer from './components/system/MobileSpaceDrawer.vue'
import './mobileModules.css'
import './mobileDiscovery.css'
import './mobileSaved.css'
import './mobileContent.css'

const MobileAudioPlayer = defineAsyncComponent(() => import('./MobileAudioPlayer.vue'))
const MobileBottomNav = defineAsyncComponent(() => import('./components/system/MobileBottomNav.vue'))

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

const isAuthRoute = computed(() => route.matched?.some((record) => record.meta?.authLayout) ?? false)
const showMobileBottomNav = computed(() => !isAuthRoute.value && route.path !== '/' && route.path !== '/music/player')
const showMobilePlayer = computed(() => playerPresence.hasCurrentTrack && showMobileBottomNav.value && route.path !== '/music/player')
const mobileRouteTransition = ref('')

const isDrawerOpen = ref(false)

const lastActiveSpace = ref<string>('music')

const currentSpace = computed<string>(() => {
  const p = route.path || '/'
  if (/^\/music(\/|$)/.test(p)) return (lastActiveSpace.value = 'music')
  if (/^\/feed(\/|$)/.test(p)) return (lastActiveSpace.value = 'feed')
  if (/^\/books(\/|$)/.test(p)) return (lastActiveSpace.value = 'books')
  if (/^\/(?:posts|post|channel|channels|collection|users)(\/|$)/.test(p)) return (lastActiveSpace.value = 'blog')
  if (/^\/debate(\/|$)/.test(p)) return (lastActiveSpace.value = 'debate')
  if (/^\/(?:inbox|messages|notifications)(\/|$)/.test(p)) return (lastActiveSpace.value = 'messages')
  if (/^\/studio(\/|$)/.test(p)) return (lastActiveSpace.value = 'studio')
  if (/^\/me(\/|$)/.test(p)) return lastActiveSpace.value
  return lastActiveSpace.value || 'feed'
})

const SPACE_PATHS: Record<string, string> = {
  feed: '/feed',
  music: '/music',
  books: '/books',
  blog: '/posts',
  debate: '/debate',
  messages: '/inbox',
  studio: '/studio',
}

const handleSelectSpace = (spaceKey: string) => {
  isDrawerOpen.value = false
  const targetPath = SPACE_PATHS[spaceKey] || `/${spaceKey}`
  if (router && typeof router.push === 'function') {
    void router.push(targetPath).catch(() => {})
  }
}

const handleSearch = () => {
  if (router && typeof router.push === 'function') {
    if (currentSpace.value === 'music') {
      void router.push('/music/tags').catch(() => {})
    } else if (currentSpace.value === 'books') {
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
  overflow-x: hidden;
  overflow-x: clip;
}

body {
  overflow-x: hidden;
  overflow-x: clip;
}

.mobile-app-shell {
  min-width: 0;
  width: 100%;
  overflow-x: hidden;
  overflow-x: clip;
  --mobile-app-player-height: 76px;
  --mobile-app-player-reserved-height: 0px;
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

.mobile-app-main--no-bottom-nav {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.mobile-app-main--with-player {
  padding-bottom: calc(56px + var(--mobile-app-player-height) + env(safe-area-inset-bottom, 0px));
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
