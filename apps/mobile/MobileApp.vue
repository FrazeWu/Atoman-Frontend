<template>
  <div class="app-shell has-sidebar mobile-app-shell">
    <MobileTopbar />
    <main
      class="app-main mobile-app-main"
      :class="{ 'app-main--auth': isAuthRoute, 'mobile-app-main--no-bottom-nav': !showMobileBottomNav, 'shutter-exit': transition.isExiting, 'shutter-entry': transition.isEntering }"
    >
      <RouterView />
    </main>
    <MobileBottomNav v-if="showMobileBottomNav" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import MobileBottomNav from '@/components/system/MobileBottomNav.vue'
import { useAuthStore } from '@/stores/auth'
import { useSiteAccessStore } from '@/stores/siteAccess'
import { useTransitionStore } from '@/stores/transition'
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
const showMobileBottomNav = computed(() => !isAuthRoute.value && !route.path.startsWith('/inbox') && !route.path.startsWith('/studio'))

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

body {
  overflow-x: hidden;
}

.mobile-app-shell {
  --mobile-app-player-height: 76px;
}

.mobile-app-main {
  min-width: 0;
  padding-bottom: calc(5.5rem + env(safe-area-inset-bottom, 0px));
}

.mobile-app-main--no-bottom-nav {
  padding-bottom: env(safe-area-inset-bottom, 0px);
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
