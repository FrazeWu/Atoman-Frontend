<template>
  <header class="mobile-app-topbar">
    <button
      v-if="showMobileBack"
      type="button"
      class="mobile-app-topbar__back"
      aria-label="返回上一页"
      @click="goBack"
    >
      <ArrowLeft :size="18" aria-hidden="true" />
    </button>
    <MobileModuleSwitcher
      v-if="!isAuthRoute && !isVideoRoute && route.path !== '/modules'"
      :label="mobileModuleLabel"
      :current-module="mobileModule"
      :available-modules="availableModules"
      :desktop-base-url="desktopAppUrl"
      native-personal-routes
    />
    <RouterLink
      v-if="isMusicRoute && route.path !== '/music/player'"
      to="/music/player"
      class="mobile-app-topbar__player"
      aria-label="打开播放器"
      title="打开播放器"
    >
      <PlayCircle :size="19" aria-hidden="true" />
    </RouterLink>
    <span v-else-if="!isAuthRoute && route.path === '/modules'" class="mobile-app-topbar__title">{{ mobileModuleLabel }}</span>
    <RouterLink v-else to="/feed" class="mobile-app-topbar__brand">ATOMAN</RouterLink>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { IconArrowLeft as ArrowLeft, IconPlayerPlay as PlayCircle } from '@tabler/icons-vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import MobileModuleSwitcher from '@/components/system/MobileModuleSwitcher.vue'
import { moduleUrl } from '@/router/siteUrls'
import { desktopAppBaseUrl } from '@/utils/desktopAppUrl'
import { resolveSiteContext } from '@/router/siteContext'
import type { ModuleRoomKey } from '@atoman/module-config'
import { MOBILE_MODULES } from './mobileRoutes'

const availableModules: ModuleRoomKey[] = [...MOBILE_MODULES]
const availableModuleSet = new Set<ModuleRoomKey>(availableModules)
const desktopAppUrl = desktopAppBaseUrl()
const route = useRoute()
const router = useRouter()
const isAuthRoute = computed(() => route.matched.some((record) => record.meta.authLayout))
const siteContext = computed(() => resolveSiteContext(window.location.hostname, '', route.path))
const isBlogContextRoute = computed(() => /^\/(?:post\/|posts\/(?:post\/|channel\/|notes(?:\/|$))|channel\/|collection\/|channels\/|users\/)/.test(route.path))
const mobileModule = computed<ModuleRoomKey | null>(() => {
  if (siteContext.value.type === 'module' && availableModuleSet.has(siteContext.value.module)) {
    return siteContext.value.module
  }
  return isBlogContextRoute.value ? 'blog' : null
})
const isMusicRoute = computed(() => /^\/music(?:\/|$)/.test(route.path))
const isVideoRoute = computed(() => route.path.startsWith('/videos/watch/'))
const mobileModuleLabel = computed(() => {
  if (route.path === '/') return '首页'
  if (route.path === '/modules') return '模块'
  if (route.path.startsWith('/inbox')) return '私信'
  if (route.path.startsWith('/studio')) return 'Studio'
  if (isVideoRoute.value) return '视频'
  if (mobileModule.value === 'blog') return '博客'
  if (mobileModule.value === 'feed') return 'Feed'
  if (mobileModule.value === 'music') return '音乐'
  return '模块'
})
const showMobileBack = computed(() => !isAuthRoute.value && (route.path === '/modules' || /^\/(?:inbox\/|studio\/(?:blog|podcast|video)\/|feed\/item\/|post\/|posts\/(?:post\/|channel\/|notes\/[^/]+)|channel\/|collection\/|channels\/|users\/|music\/(?:player|lyrics|artist\/|album\/|song\/|playlist\/)|videos\/watch\/)/.test(route.path)))

const goBack = () => {
  if (route.path === '/modules') {
    void router.push('/feed')
    return
  }
  if (window.history.length > 1 && window.history.state?.back) {
    router.back()
    return
  }
  if (mobileModule.value) void router.push(moduleUrl(mobileModule.value))
  else if (isVideoRoute.value) void router.push('/feed')
}
</script>

<style scoped>
.mobile-app-topbar {
  position: sticky;
  top: 0;
  z-index: var(--a-z-navigation);
  display: flex;
  min-height: var(--a-topbar-height);
  align-items: center;
  gap: 0.25rem;
  padding: 0 0.75rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface);
}

.mobile-app-topbar__back {
  display: inline-flex;
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--a-color-fg);
  cursor: pointer;
}

.mobile-app-topbar__back:hover,
.mobile-app-topbar__back:focus-visible {
  background: var(--a-color-surface-muted);
}

.mobile-app-topbar__player {
  display: inline-flex;
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  color: var(--a-color-fg);
  text-decoration: none;
}

.mobile-app-topbar__player:hover,
.mobile-app-topbar__player:focus-visible {
  background: var(--a-color-surface-muted);
}

.mobile-app-topbar__title {
  min-width: 0;
  flex: 1;
  font-size: 1.0625rem;
  font-weight: 650;
}
.mobile-app-topbar__brand {
  color: var(--a-color-fg);
  font-size: 0.85rem;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-decoration: none;
}
</style>
