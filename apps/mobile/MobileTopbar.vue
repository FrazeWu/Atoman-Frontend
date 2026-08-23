<template>
  <header class="mobile-app-topbar" :class="{ 'is-large-title': isLargeTitle, 'is-scrolled': isScrolled }">
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
      v-if="!isAuthRoute"
      :label="mobileModuleLabel"
      :current-module="mobileModule"
      :available-modules="availableModules"
      :desktop-base-url="desktopAppUrl"
      native-personal-routes
    />
    <RouterLink v-else to="/feed" class="mobile-app-topbar__brand">ATOMAN</RouterLink>
  </header>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ArrowLeft } from 'lucide-vue-next'
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
const isScrolled = ref(false)
const isLargeTitle = computed(() => !isScrolled.value && ['/feed', '/posts', '/music'].includes(route.path))
const isAuthRoute = computed(() => route.matched.some((record) => record.meta.authLayout))
const siteContext = computed(() => resolveSiteContext(window.location.hostname, '', route.path))
const isBlogContextRoute = computed(() => /^\/(?:post\/|posts\/(?:post\/|channel\/|notes(?:\/|$))|channel\/|collection\/|channels\/|users\/)/.test(route.path))
const mobileModule = computed<ModuleRoomKey | null>(() => {
  if (siteContext.value.type === 'module' && availableModuleSet.has(siteContext.value.module)) {
    return siteContext.value.module
  }
  return isBlogContextRoute.value ? 'blog' : null
})
const mobileModuleLabel = computed(() => {
  if (route.path === '/modules') return '模块'
  if (route.path.startsWith('/inbox')) return '私信'
  if (route.path.startsWith('/studio')) return 'Studio'
  if (mobileModule.value === 'blog') return '博客'
  if (mobileModule.value === 'feed') return 'Feed'
  if (mobileModule.value === 'music') return '音乐'
  return '模块'
})
const showMobileBack = computed(() => !isAuthRoute.value && (route.path === '/modules' || /^\/(?:inbox\/|studio\/(?:blog|podcast|video)\/|feed\/item\/|post\/|posts\/(?:post\/|channel\/|notes\/[^/]+)|channel\/|collection\/|channels\/|users\/|music\/(?:player|artist\/|album\/|song\/|playlist\/))/.test(route.path)))

function updateScrollState() {
  isScrolled.value = window.scrollY > 8
}

onMounted(() => window.addEventListener('scroll', updateScrollState, { passive: true }))
onUnmounted(() => window.removeEventListener('scroll', updateScrollState))

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

.mobile-app-topbar.is-large-title {
  min-height: 5.25rem;
  align-items: flex-end;
  padding-bottom: 0.75rem;
}

.mobile-app-topbar.is-large-title .mobile-module-switcher {
  font-size: 1.75rem;
  line-height: 1.15;
}

.mobile-app-topbar.is-scrolled {
  background: var(--a-color-surface);
}

.mobile-app-topbar__back {
  display: inline-flex;
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
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

.mobile-app-topbar__brand {
  color: var(--a-color-fg);
  font-size: 0.85rem;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-decoration: none;
}
</style>
