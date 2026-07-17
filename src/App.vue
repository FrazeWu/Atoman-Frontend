<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <div :class="['app-shell', { 'has-sidebar': hasSidebar, 'has-active-player': hasActiveTrack }]">
      <AppTopbar />
      <FirstLoginOnboarding />
      <main :class="[
        'app-main', 
        { 'app-main--auth': isAuthRoute },
        { 'shutter-exit': transition.isExiting },
        { 'shutter-entry': transition.isEntering }
      ]">
        <div v-if="routeLoading" class="route-loading-state" role="status" aria-live="polite">
          <span>正在加载页面...</span>
          <div class="route-loading-state__line route-loading-state__line--title" />
          <div class="route-loading-state__line" />
          <div class="route-loading-state__panel" />
        </div>
        <router-view v-show="!routeLoading" />
      </main>
      <MobileBottomNav v-if="showMobileBottomNav" />
      <SiteFooter :hide-on-mobile="hasSidebar" />
      <AudioPlayer v-if="hasActiveTrack" />
      <NestedActionDrawer />
    </div>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue'
import { NConfigProvider } from 'naive-ui'
import { useRoute, useRouter } from 'vue-router'
import AppTopbar from '@/components/system/AppTopbar.vue'
import MobileBottomNav from '@/components/system/MobileBottomNav.vue'
import FirstLoginOnboarding from '@/components/onboarding/FirstLoginOnboarding.vue'
import SiteFooter from '@/components/system/SiteFooter.vue'
import { usePlayerStore } from '@/stores/player'
import { useSiteAccessStore } from '@/stores/siteAccess'
import { useTransitionStore } from '@/stores/transition'
import { useTransitionRelay } from '@/composables/useTransitionRelay'

const AudioPlayer = defineAsyncComponent(() => import('@/components/music/AudioPlayer.vue'))
const NestedActionDrawer = defineAsyncComponent(() => import('@/components/music/NestedActionDrawer.vue'))

const themeOverrides = {
  common: {
    primaryColor: '#000000',
    primaryColorHover: '#333333',
    primaryColorPressed: '#000000',
    borderRadius: '0px',
  },
}

const route = useRoute()
const router = useRouter()
const player = usePlayerStore()
const siteAccessStore = useSiteAccessStore()
const transition = useTransitionStore()
const { checkRelay } = useTransitionRelay()

const hasSidebar = computed(() => {
  const closestSetting = [...route.matched]
    .reverse()
    .find(record => typeof record.meta.hasSidebar === 'boolean')

  return closestSetting?.meta.hasSidebar === true
})
const isAuthRoute = computed(() => route.matched.some((record) => record.meta.authLayout))
const hasActiveTrack = computed(() => Boolean(player.currentSong))
const showMobileBottomNav = computed(() => hasSidebar.value && !isAuthRoute.value)
const routeLoading = ref(true)

const removeBeforeEach = router.beforeEach(() => {
  routeLoading.value = true
})
const removeAfterEach = router.afterEach(() => {
  routeLoading.value = false
})

void router.isReady().finally(() => {
  routeLoading.value = false
})

onMounted(() => {
  if (localStorage.getItem('atoman_transition_relay')) {
    transition.triggerEntry()
    checkRelay()
  } else if (localStorage.getItem('atoman_transition_relay_basic')) {
    transition.triggerEntry()
    localStorage.removeItem('atoman_transition_relay_basic')
  }
  siteAccessStore.load()
})

onUnmounted(() => {
  removeBeforeEach()
  removeAfterEach()
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
  flex: 1;
  padding-bottom: 4rem;
  background: #fff;
  transition: opacity 0.5s ease, filter 0.5s ease;
}

.route-loading-state {
  display: grid;
  gap: 1rem;
  width: min(72rem, calc(100% - 2rem));
  margin: 3rem auto;
  color: var(--a-color-ink-soft);
  font-size: var(--a-text-sm);
  font-weight: var(--a-font-weight-strong);
}

.route-loading-state__line,
.route-loading-state__panel {
  overflow: hidden;
  background: var(--a-color-paper-wash);
}

.route-loading-state__line {
  width: min(28rem, 70%);
  height: 1rem;
}

.route-loading-state__line--title {
  width: min(18rem, 52%);
  height: 2.75rem;
}

.route-loading-state__panel {
  min-height: 14rem;
  border: 1px solid var(--a-color-line-soft);
}

/* 出场：内容区原地渐隐 */
.shutter-exit {
  opacity: 0;
  filter: blur(4px);
  pointer-events: none;
}

/* 入场关键帧：内容区原地渐出 */
@keyframes shutterIn {
  from {
    opacity: 0;
    filter: blur(4px);
  }
  to {
    opacity: 1;
    filter: blur(0);
  }
}

.shutter-entry {
  animation: shutterIn 0.7s ease-out forwards;
}

.app-main--auth {
  padding-bottom: 0;
  background: #fff;
}

.has-active-player .app-main {
  padding-bottom: 9rem;
}

@media (max-width: 767px) {
  .app-main {
    padding-bottom: 5rem;
  }

  .app-main--auth {
    padding-bottom: 0;
  }

  .has-active-player .app-main {
    padding-bottom: calc(5rem + 72px);
  }
}
</style>
