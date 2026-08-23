<template>
  <div class="app-shell has-sidebar mobile-app-shell">
    <MobileTopbar />
    <main
      class="app-main mobile-app-main"
      :class="{ 'app-main--auth': isAuthRoute, 'shutter-exit': transition.isExiting, 'shutter-entry': transition.isEntering }"
    >
      <RouterView />
    </main>
    <BlogSheetStack v-if="!isAuthRoute" />
    <MobileBottomNav v-if="!isAuthRoute" />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import MobileBottomNav from '@/components/system/MobileBottomNav.vue'
import { useAuthStore } from '@/stores/auth'
import { useSiteAccessStore } from '@/stores/siteAccess'
import { useTransitionStore } from '@/stores/transition'
import { apiRequest } from '@/api/client'
import { useApiUrl } from '@/composables/useApi'
import MobileTopbar from './MobileTopbar.vue'

const BlogSheetStack = defineAsyncComponent(() => import('@/components/blog/BlogSheetStack.vue'))
const route = useRoute()
const authStore = useAuthStore()
const siteAccessStore = useSiteAccessStore()
const transition = useTransitionStore()
const apiUrl = useApiUrl()
const isAuthRoute = computed(() => route.matched.some((record) => record.meta.authLayout))

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

.mobile-app-main {
  min-width: 0;
  padding-bottom: calc(5.5rem + env(safe-area-inset-bottom, 0px));
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
