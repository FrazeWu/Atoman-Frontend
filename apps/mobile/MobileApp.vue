<template>
  <div class="app-shell has-sidebar mobile-app-shell">
    <MobileTopbar />
    <main
      class="app-main mobile-app-main"
      :class="{ 'app-main--auth': isAuthRoute, 'mobile-app-main--no-bottom-nav': !showMobileBottomNav, 'mobile-app-main--with-player': showMobilePlayer, 'shutter-exit': transition.isExiting, 'shutter-entry': transition.isEntering }"
    >
      <RouterView />
    </main>
    <MobileAudioPlayer v-if="showMobilePlayer" />
    <MobileBottomNav v-if="showMobileBottomNav" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import MobileBottomNav from '@/components/system/MobileBottomNav.vue'
import MobileAudioPlayer from './MobileAudioPlayer.vue'
import { useAuthStore } from '@/stores/auth'
import { useSiteAccessStore } from '@/stores/siteAccess'
import { useTransitionStore } from '@/stores/transition'
import { usePlayerStore } from '@/stores/player'
import { apiRequest } from '@/api/client'
import { useApiUrl } from '@/composables/useApi'
import MobileTopbar from './MobileTopbar.vue'

const route = useRoute()
const authStore = useAuthStore()
const siteAccessStore = useSiteAccessStore()
const transition = useTransitionStore()
const player = usePlayerStore()
const apiUrl = useApiUrl()
const isAuthRoute = computed(() => route.matched.some((record) => record.meta.authLayout))
const showMobileBottomNav = computed(() => !isAuthRoute.value && !route.path.startsWith('/modules') && !route.path.startsWith('/inbox') && !route.path.startsWith('/studio') && !route.path.startsWith('/videos/watch/'))
const showMobilePlayer = computed(() => Boolean(player.currentSong) && showMobileBottomNav.value && route.path !== '/music/player')

const reportPageView = () => {
  if (isAuthRoute.value) return
  void apiRequest(`${apiUrl}/site/visits`, { method: 'POST', keepalive: true }).catch(() => {})
}

watch(() => route.fullPath, reportPageView)

onMounted(() => {
  void authStore.restoreSession()
  void siteAccessStore.load().catch(() => {})
  reportPageView()
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
  --a-color-bg: #f2f2f7;
  --a-color-fg: #1c1c1e;
  --a-color-text: #1c1c1e;
  --a-color-text-secondary: #3a3a3c;
  --a-color-surface: #ffffff;
  --a-color-surface-muted: #e5e5ea;
  --a-color-border: #c6c6c8;
  --a-color-border-soft: #d1d1d6;
  --a-color-muted: #8e8e93;
  --a-color-muted-soft: #aeaeb2;
  --a-color-primary: #007aff;
  --a-color-primary-hover: #006ee6;
  --a-color-primary-pressed: #005ecb;
  --a-color-primary-contrast: #ffffff;
  --a-radius-base: 8px;
  --a-radius-control: 8px;
  --a-radius-card: 8px;
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
  padding-bottom: calc(5.5rem + env(safe-area-inset-bottom, 0px));
}

.mobile-app-main--no-bottom-nav {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.mobile-app-main--with-player {
  padding-bottom: calc(9rem + env(safe-area-inset-bottom, 0px));
}

.mobile-app-shell .p-dropdown-panel {
  position: static;
  min-width: 0;
  margin-top: 0.5rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 8px;
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
