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
      <NotificationToastStack v-if="!isAuthRoute" />
      <MobileBottomNav v-if="showMobileBottomNav" />
      <SiteFooter v-if="!isAuthRoute" />
      <AudioPlayer v-if="hasActiveTrack" />
      <PShortcutHints v-if="!isAuthRoute" v-model="shortcutHelpOpen" :hints="shortcutHints" />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { apiRequest } from '@/api/client'
import { useApiUrl } from '@/composables/useApi'
import AppTopbar from '@/components/system/AppTopbar.vue'
import NotificationToastStack from '@/components/system/NotificationToastStack.vue'
import MobileBottomNav from '@/components/system/MobileBottomNav.vue'
import SiteFooter from '@/components/system/SiteFooter.vue'
import PShortcutHints, { type ShortcutHint } from '@/components/ui/PShortcutHints.vue'
import { usePlayerStore } from '@/stores/player'
import { useUIStore } from '@/stores/ui'
import { useSiteAccessStore } from '@/stores/siteAccess'
import { useTransitionStore } from '@/stores/transition'
import { useTransitionRelay } from '@/composables/useTransitionRelay'
import { useKeyboardShortcuts, type KeyboardShortcut } from '@/composables/useKeyboardShortcuts'
import { scheduleGoogleAnalytics } from '@/utils/analytics'

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
const uiStore = useUIStore()
const siteAccessStore = useSiteAccessStore()
const transition = useTransitionStore()
const { checkRelay } = useTransitionRelay()
const apiUrl = useApiUrl()

const hasSidebar = computed(() => route.matched.some((record) => record.meta.hasSidebar))
const isAuthRoute = computed(() => route.matched.some((record) => record.meta.authLayout))
const hasActiveTrack = computed(() => Boolean(player.currentSong))
const showMobileBottomNav = computed(() => hasSidebar.value && !isAuthRoute.value)
const shortcutHelpOpen = ref(false)
const isMediaModule = computed(() => /^\/(music|podcasts|videos)(\/|$)/.test(route.path))

const commonShortcutHints: ShortcutHint[] = [
  { key: 'H', label: '聚焦侧边栏' },
  { key: 'L', label: '聚焦内容区' },
  { key: 'J / K', label: '上下选择项目' },
  { key: 'Enter', label: '打开当前项目' },
  { key: '/', label: '打开全局搜索' },
  { key: '?', label: '打开快捷键说明' },
]

const shortcutHints = computed<ShortcutHint[]>(() => {
  const path = route.path
  const hints = [...commonShortcutHints]
  if (path.startsWith('/feed') || path.startsWith('/posts')) {
    hints.push(
      { key: 'S', label: '收藏/取消收藏' },
      { key: 'M', label: '标记已读/未读' },
      { key: 'V', label: '查看原文' },
    )
  } else if (path.startsWith('/forum')) {
    hints.push(
      { key: 'N', label: '发起新话题' },
    )
  } else if (isMediaModule.value) {
    hints.push(
      { key: 'Space', label: '播放/暂停' },
      { key: 'Alt + ← / →', label: '上一首/下一首' },
      { key: '← / →', label: '快退/快进 5 秒' },
      { key: 'M', label: '静音' },
      { key: 'Shift + F', label: '打开歌词' },
    )
  }
  return hints
})

const globalShortcuts = computed<KeyboardShortcut[]>(() => [
  { key: 'h', description: '聚焦侧边栏', handler: () => uiStore.focusSidebar() },
  ...(!player.currentSong ? [{ key: 'l', description: '聚焦内容区', handler: () => uiStore.focusContent() }] : []),
  { key: '?', shift: true, description: '打开快捷键说明', handler: () => { shortcutHelpOpen.value = true } },
])

useKeyboardShortcuts(globalShortcuts)

const reportPageView = (sendAnalytics = true) => {
  if (isAuthRoute.value) return
  void apiRequest(`${apiUrl}/site/visits`, { method: 'POST', keepalive: true }).catch(() => {})
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

onMounted(() => {
  reportPageView(false)
  scheduleGoogleAnalytics(reportAnalyticsPageView)
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
