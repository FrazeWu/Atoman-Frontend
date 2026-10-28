<template>
  <div :class="['app-shell', { 'has-sidebar': hasSidebar }]">
      <AppTopbar />
      <main :class="[
        'app-main',
        { 'app-main--auth': isAuthRoute },
        { 'detail-exit': transition.isExiting },
        { 'detail-entry': transition.isEntering },
      ]" :aria-busy="transition.isModuleNavigation || transition.isExiting || transition.isEntering" @transitionend.self="transition.completeExit">
        <div v-if="transition.isModuleNavigation" class="app-route-progress" aria-hidden="true" />
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
      <SiteFooter v-if="showDeferredShell && !isAuthRoute" />
      <AudioPlayer v-if="hasActiveTrack" />
      <PShortcutHints v-if="!isAuthRoute" />
      <PToastHost />
      <PSafeLinkModal />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { apiRequest } from '@/api/client'
import { useApiUrl } from '@/composables/useApiUrl'
import AppTopbar from '@/components/system/AppTopbar.vue'
import PShortcutHints from '@/components/ui/PShortcutHints.vue'
import PToastHost from '@/components/ui/PToastHost.vue'
import PSafeLinkModal from '@/components/ui/PSafeLinkModal.vue'
import { usePlayerPresenceStore } from '@/stores/playerPresence'
import { useUIStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { useSiteAccessStore } from '@/stores/siteAccess'
import { useTransitionStore } from '@/stores/transition'
import { useTransitionRelay } from '@/composables/useTransitionRelay'
import { useKeyboardShortcuts, type KeyboardShortcut } from '@/composables/useKeyboardShortcuts'
import { scheduleGoogleAnalytics } from '@/utils/analytics'
import { scheduleIdleTask } from '@/utils/scheduleIdleTask'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

const AudioPlayer = defineAsyncComponent(() => import('@/components/music/AudioPlayer.vue'))
const BlogSheetStack = defineAsyncComponent(() => import('@/components/blog/BlogSheetStack.vue'))
const SiteFooter = defineAsyncComponent(() => import('@/components/system/SiteFooter.vue'))

const route = useRoute()
const playerPresence = usePlayerPresenceStore()
const uiStore = useUIStore()
const authStore = useAuthStore()
const siteAccessStore = useSiteAccessStore()
const transition = useTransitionStore()
const { checkRelay } = useTransitionRelay()
const apiUrl = useApiUrl()

const hasSidebar = computed(() => route.matched.some((record) => record.meta.hasSidebar))
const isAuthRoute = computed(() => route.matched.some((record) => record.meta.authLayout))
const hasActiveTrack = computed(() => playerPresence.hasCurrentTrack)
const showDeferredShell = ref(false)

const globalShortcuts = computed<KeyboardShortcut[]>(() => [
  { key: 'h', description: '聚焦侧边栏', handler: () => uiStore.focusSidebar() },
  { key: 'l', description: '聚焦内容区', handler: () => uiStore.focusContent() },
  { key: '?', shift: true, description: '打开快捷键说明', handler: () => uiStore.openShortcutHelp() },
])

useKeyboardShortcuts(globalShortcuts)

const reportPageView = (sendAnalytics = true) => {
  if (isAuthRoute.value) return
  // 等待已有会话恢复，避免携带登录 cookie 却尚无 CSRF token 的首访请求。
  void authStore.restoreSession().then(() =>
    apiRequest(`${apiUrl}/site/visits`, { method: 'POST', keepalive: true })
  ).catch(() => {})
  if (!sendAnalytics) return
  const ga = window.gtag
  if (typeof ga === 'function') {
    ga('event', 'page_view', { page_path: route.fullPath, page_location: window.location.href })
  }
}

const reportAnalyticsPageView = () => {
  const ga = window.gtag
  if (typeof ga === 'function') {
    ga('event', 'page_view', { page_path: route.fullPath, page_location: window.location.href })
  }
}

watch(() => route.fullPath, () => reportPageView())

let cancelIdleWork = () => {}

onMounted(() => {
  cancelIdleWork = scheduleIdleTask(() => {
    showDeferredShell.value = true
    reportPageView(false)
    scheduleGoogleAnalytics(reportAnalyticsPageView)
    if (localStorage.getItem('atoman_transition_relay')) {
      checkRelay()
    }
    void siteAccessStore.load().catch(() => {})
  }, 5000, 8000)
})

onBeforeUnmount(() => cancelIdleWork())
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
  transition:
    opacity var(--a-motion-detail-exit) var(--a-motion-ease-exit),
    transform var(--a-motion-detail-exit) var(--a-motion-ease-exit);
}

.module-slide-enter-active,
.module-slide-leave-active {
  transition:
    opacity var(--a-motion-state) var(--a-motion-ease-enter),
    transform var(--a-motion-navigation) var(--a-motion-ease-enter);
  will-change: opacity, transform;
}

.module-slide-enter-from {
  opacity: 0;
  transform: translateX(44px);
}

.module-slide-leave-active {
  position: absolute;
  inset: 0;
  width: 100%;
}

.module-slide-leave-to {
  opacity: 0;
  transform: translateX(-44px);
}

.detail-exit {
  opacity: 0;
  transform: translateY(-12px);
  pointer-events: none;
  will-change: opacity, transform;
}

.detail-entry {
  animation: detail-entry var(--a-motion-detail-entry) var(--a-motion-ease-enter) both;
  will-change: opacity, transform;
}

@keyframes detail-entry {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.app-route-progress {
  position: fixed;
  top: 0;
  right: 0;
  left: var(--a-sidebar-width);
  z-index: calc(var(--a-z-navigation) + 1);
  height: 2px;
  background: var(--a-color-primary);
  transform-origin: left center;
  animation: app-route-progress 900ms var(--a-motion-ease-enter) infinite;
  pointer-events: none;
}

@keyframes app-route-progress {
  0% { transform: scaleX(0.05); opacity: 0.7; }
  50% { transform: scaleX(0.62); opacity: 1; }
  100% { transform: scaleX(1); opacity: 0.75; }
}

.app-main--auth {
  padding-bottom: 0;
  background: #fff;
}

@media (max-width: 767px) {
  .app-route-progress {
    display: none;
  }
}

</style>
