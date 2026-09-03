<template>
  <div :class="['app-shell', { 'has-sidebar': hasSidebar }]">
      <AppTopbar />
      <main :class="[
        'app-main', 
        { 'app-main--auth': isAuthRoute },
        { 'shutter-exit': transition.isExiting },
        { 'shutter-entry': transition.isEntering }
      ]">
        <RouterView v-slot="{ Component, route: viewRoute }">
          <Transition
            :name="transition.isModuleNavigation ? 'module-slide' : ''"
            @after-enter="transition.finishModuleNavigation"
          >
            <component
              :is="Component"
              :key="viewRoute.matched[0]?.path || viewRoute.fullPath"
            />
          </Transition>
        </RouterView>
      </main>
      <BlogSheetStack />
      <NotificationToastStack v-if="!isAuthRoute" />
      <MobileBottomNav v-if="showMobileBottomNav" />
      <SiteFooter v-if="!isAuthRoute" />
      <AudioPlayer v-if="hasActiveTrack" />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { apiRequest } from '@/api/client'
import { useApiUrl } from '@/composables/useApi'
import AppTopbar from '@/components/system/AppTopbar.vue'
import NotificationToastStack from '@/components/system/NotificationToastStack.vue'
import MobileBottomNav from '@/components/system/MobileBottomNav.vue'
import SiteFooter from '@/components/system/SiteFooter.vue'
import { usePlayerStore } from '@/stores/player'
import { useSiteAccessStore } from '@/stores/siteAccess'
import { useTransitionStore } from '@/stores/transition'
import { useTransitionRelay } from '@/composables/useTransitionRelay'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

const AudioPlayer = defineAsyncComponent(() => import('@/components/music/AudioPlayer.vue'))
const BlogSheetStack = defineAsyncComponent(() => import('@/components/blog/BlogSheetStack.vue'))

const route = useRoute()
const player = usePlayerStore()
const siteAccessStore = useSiteAccessStore()
const transition = useTransitionStore()
const { checkRelay } = useTransitionRelay()
const apiUrl = useApiUrl()

const hasSidebar = computed(() => route.matched.some((record) => record.meta.hasSidebar))
const isAuthRoute = computed(() => route.matched.some((record) => record.meta.authLayout))
const hasActiveTrack = computed(() => Boolean(player.currentSong))
const showMobileBottomNav = computed(() => hasSidebar.value && !isAuthRoute.value)

const reportPageView = (sendAnalytics = true) => {
  if (isAuthRoute.value) return
  void apiRequest(`${apiUrl}/site/visits`, { method: 'POST', keepalive: true }).catch(() => {})
  if (!sendAnalytics) return
  const ga = window.gtag
  if (typeof ga === 'function') {
    ga('event', 'page_view', { page_path: route.fullPath, page_location: window.location.href })
  }
}

watch(() => route.fullPath, () => reportPageView())

onMounted(() => {
  reportPageView(false)
  if (localStorage.getItem('atoman_transition_relay')) {
    checkRelay()
  }
  siteAccessStore.load()
})
</script>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  position: relative;
}

.app-main {
  flex: 1 0 auto;
  background: var(--a-color-bg);
  position: relative;
  transition: opacity 0.5s ease, filter 0.5s ease;
}

.module-slide-enter-active,
.module-slide-leave-active {
  transition:
    opacity 180ms ease,
    transform 320ms cubic-bezier(0.16, 1, 0.3, 1);
}

.module-slide-enter-from {
  opacity: 0;
  transform: translateX(14px);
}

.module-slide-leave-active {
  position: absolute;
  inset: 0;
  width: 100%;
}

.module-slide-leave-to {
  opacity: 0;
  transform: translateX(-14px);
}

/* 出场：内容区稍微上移并渐隐 */
.shutter-exit {
  opacity: 0;
  filter: blur(2px);
  transform: translateY(-12px);
  pointer-events: none;
  transition: opacity 0.3s ease, filter 0.3s ease, transform 0.3s ease;
}

/* 入场关键帧：内容区平滑上浮渐现 */
@keyframes shutterIn {
  from {
    opacity: 0;
    transform: translateY(16px);
    filter: blur(2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
    filter: blur(0);
  }
}

.shutter-entry {
  animation: shutterIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.app-main--auth {
  padding-bottom: 0;
  background: #fff;
}
</style>
