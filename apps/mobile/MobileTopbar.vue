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
      v-if="!isAuthRoute"
      :label="mobileModuleLabel"
      :current-module="mobileModule"
      :available-modules="availableModules"
      :desktop-base-url="desktopAppUrl"
    />
    <RouterLink v-else to="/feed" class="mobile-app-topbar__brand">ATOMAN</RouterLink>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ArrowLeft } from 'lucide-vue-next'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import MobileModuleSwitcher from '@/components/system/MobileModuleSwitcher.vue'
import { moduleUrl } from '@/router/siteUrls'
import { resolveSiteContext } from '@/router/siteContext'
import type { ModuleRoomKey } from '@atoman/module-config'
import { MOBILE_MODULES } from './mobileRoutes'

const availableModules: ModuleRoomKey[] = [...MOBILE_MODULES]
const availableModuleSet = new Set<ModuleRoomKey>(availableModules)
const desktopAppUrl = import.meta.env.VITE_DESKTOP_APP_URL?.trim()
  || (import.meta.env.PROD ? 'https://www.atoman.org' : '')
const route = useRoute()
const router = useRouter()
const isAuthRoute = computed(() => route.matched.some((record) => record.meta.authLayout))
const siteContext = computed(() => resolveSiteContext(window.location.hostname, '', route.path))
const mobileModule = computed<ModuleRoomKey | null>(() => (
  siteContext.value.type === 'module' && availableModuleSet.has(siteContext.value.module)
    ? siteContext.value.module
    : null
))
const mobileModuleLabel = computed(() => {
  if (mobileModule.value === 'blog') return '博客'
  if (mobileModule.value === 'feed') return '订阅'
  return '模块'
})
const showMobileBack = computed(() => !isAuthRoute.value && /^\/(?:feed\/item\/|post\/|channel\/|collection\/|posts\/notes\/[^/]+)/.test(route.path))

const goBack = () => {
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
  background: var(--a-color-bg);
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
