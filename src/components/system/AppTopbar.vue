<template>
  <header class="topbar" :class="{ 'topbar--auth': isAuthRoute, 'is-scrolled': isScrolled }">
    <div class="topbar-inner" :class="{ 'topbar-inner--auth': isAuthRoute }">
      <div class="brand-link">
        <button
          v-if="hasSidebar && !isAuthRoute"
          class="topbar-collapse-btn"
          type="button"
          aria-label="Toggle sidebar"
          @click="toggleSidebar"
        >
          <Menu :size="18" aria-hidden="true" />
        </button>
        <a href="/" class="brand-logo-link" @click.prevent="handleBrandClick">
          <div class="logo-box">
            <div class="logo-inner"></div>
          </div>
          <span class="logo-block">
            <span class="logo-copy">
              <span class="logo-text">ATOMAN</span>
              <span class="logo-meta">
                <span v-if="appVersion" class="logo-version">{{ appVersion }}</span>
                <span class="logo-notice">beta</span>
              </span>
            </span>
          </span>
        </a>
      </div>

      <button
        v-if="showMobileBack"
        type="button"
        class="mobile-back-btn"
        aria-label="返回上一页"
        title="返回上一页"
        data-testid="mobile-back-button"
        @click="goBack"
      >
        <ArrowLeft :size="18" aria-hidden="true" />
      </button>

      <MobileModuleSwitcher
        v-if="!isAuthRoute"
        :label="mobileModuleLabel"
        :current-module="mobileModule"
      />

      <nav v-if="!isAuthRoute" class="nav">
        <a
          v-for="room in navRooms"
          :key="room.key"
          :href="moduleUrl(room.key)"
          class="nav-link"
          :class="{ active: isRoomActive(room.key) }"
          @click.prevent="navigateTo(room.key)"
        >
          <span class="nav-link-name">{{ room.name }}</span>
        </a>
      </nav>

      <div class="nav-right">
        <AppTopbarGlobalSearch v-if="!isAuthRoute" />
        <button
          type="button"
          class="theme-toggle-btn"
          aria-label="切换主题"
          @click="toggleTheme"
        >
          <Sun v-if="isDark" :size="18" />
          <Moon v-else :size="18" />
        </button>
        <AppTopbarAuthControls v-if="showAuthControls" />
        <RouterLink v-else to="/login" class="a-btn a-btn--primary a-btn--sm">登录</RouterLink>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter, useRoute } from 'vue-router'
import { Menu, Sun, Moon, ArrowLeft } from 'lucide-vue-next'
import { useSidebar } from '@/composables/useSidebar'
import { useAuthStore } from '@/stores/auth'
import { useSheetStore } from '@/stores/sheet'
import { useSiteAccessStore } from '@/stores/siteAccess'
import { useModuleNav, moduleUrl } from '@/composables/useSubdomainNav'
import { isRoomRouteActive, moduleRooms, topbarNavOrder, type ModuleRoomKey } from '@/config/moduleRooms'
import { appVersion } from '@/config/appVersion'
import { resolveSiteContext } from '@/router/siteContext'
import AppTopbarGlobalSearch from '@/components/system/AppTopbarGlobalSearch.vue'
import MobileModuleSwitcher from '@/components/system/MobileModuleSwitcher.vue'

const { toggleSidebar } = useSidebar()
const hasSidebar = computed(() => route.matched.some((record) => record.meta.hasSidebar))

const router = useRouter()
const route = useRoute()

const isAuthRoute = computed(() => route.matched.some((record) => record.meta.authLayout))
const sheetStore = useSheetStore()
const { navigateTo } = useModuleNav()
const AppTopbarAuthControls = defineAsyncComponent(() => import('@/components/system/AppTopbarAuthControls.vue'))

const handleBrandClick = () => {
  if (sheetStore.stack.length > 0) {
    sheetStore.clearStack(true)
  }
  void router.push('/')
}

const authStore = useAuthStore()
const siteAccessStore = useSiteAccessStore()
const showAuthControls = computed(() => authStore.isAuthenticated && !!authStore.user)

const navRooms = computed(() => topbarNavOrder.filter((key) => siteAccessStore.isModuleVisible(key)).map((key) => moduleRooms[key]))
const siteContext = computed(() => {
  const queryStart = route.fullPath.indexOf('?')
  const search = queryStart >= 0 ? route.fullPath.slice(queryStart) : ''
  return resolveSiteContext(window.location.hostname, search, route.path)
})

const isRoomActive = (key: ModuleRoomKey) => isRoomRouteActive(key, siteContext.value)

const mobileModule = computed<ModuleRoomKey | null>(() => (
  siteContext.value.type === 'module' ? siteContext.value.module : null
))
const mobileModuleLabel = computed(() => {
  if (mobileModule.value) return moduleRooms[mobileModule.value].name
  if (route.path.startsWith('/studio')) return 'Studio'
  return '模块'
})

const detailRoutePattern = /^\/(?:feed\/item\/|music\/(?:artist|album|song|playlist)\/|forum\/topic\/|debate\/(?!search(?:\/|$)|me(?:\/|$)|rules(?:\/|$))[^/]+|timeline\/person\/|podcasts\/(?:show|episode)\/|videos\/(?:watch|collections)\/|posts\/(?:post|notes)\/)/
const showMobileBack = computed(() => !isAuthRoute.value && detailRoutePattern.test(route.path))

const goBack = () => {
  if (window.history.length > 1 && window.history.state?.back) {
    router.back()
    return
  }
  if (mobileModule.value) void router.push(moduleUrl(mobileModule.value))
}

const isDark = ref(false)
const isScrolled = ref(false)

const handleScroll = (event: Event) => {
  const target = event.target
  if (target === document || target === window) {
    isScrolled.value = (window.scrollY || document.documentElement.scrollTop) > 0
  } else if (target instanceof HTMLElement && target.classList.contains('a-main-content')) {
    isScrolled.value = target.scrollTop > 0
  }
}

onMounted(() => {
  isDark.value = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
  if (isDark.value) {
    document.documentElement.classList.add('dark')
  }
  if (!isAuthRoute.value) {
    void authStore.restoreSession()
  }

  window.addEventListener('scroll', handleScroll, { capture: true, passive: true })
  const mainContent = document.querySelector('.a-main-content')
  isScrolled.value = mainContent instanceof HTMLElement
    ? mainContent.scrollTop > 0
    : window.scrollY > 0
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll, { capture: true })
})

watch(isAuthRoute, (isAuthRoute, wasAuthRoute) => {
  if (wasAuthRoute && !isAuthRoute) {
    void authStore.restoreSession()
  }
})

const toggleTheme = (event: MouseEvent) => {
  const isSupported = typeof document.startViewTransition === 'function'
  
  const changeTheme = () => {
    isDark.value = !isDark.value
    if (isDark.value) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  if (!isSupported) {
    changeTheme()
    return
  }

  const rect = (event.currentTarget as HTMLElement)?.getBoundingClientRect()
  const x = event.clientX || (rect ? rect.left + rect.width / 2 : window.innerWidth / 2)
  const y = event.clientY || (rect ? rect.top + rect.height / 2 : window.innerHeight / 2)
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  )

  const transition = document.startViewTransition(changeTheme)
  
  void transition.ready.then(() => {
    const clipPath = [
      `circle(0px at ${x}px ${y}px)`,
      `circle(${endRadius}px at ${x}px ${y}px)`
    ]
    document.documentElement.animate(
      {
        clipPath: isDark.value ? [...clipPath].reverse() : clipPath
      },
      {
        duration: 400,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        pseudoElement: isDark.value
          ? '::view-transition-old(root)'
          : '::view-transition-new(root)'
      }
    )
  })
}

</script>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: var(--a-z-navigation);
  background: rgba(255, 255, 255, 0.58);
  -webkit-backdrop-filter: blur(18px) saturate(180%);
  backdrop-filter: blur(18px) saturate(180%);
  height: var(--a-topbar-height);
  border-bottom: 1px solid var(--a-color-border-soft);
  transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.topbar::after {
  content: '';
  position: absolute;
  left: calc(50% + var(--a-sidebar-width, 0px) / 2);
  bottom: 0;
  width: 20px;
  height: 1px;
  transform: translateX(-50%);
  background: var(--a-color-fg);
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.topbar.is-scrolled::after {
  width: calc((100% - var(--a-sidebar-width, 0px)) * 0.75);
}

.topbar.is-scrolled {
  box-shadow: var(--a-shadow-sm);
  border-bottom-color: var(--a-color-border);
}

:root.dark .topbar,
html.dark .topbar {
  background: rgba(9, 10, 15, 0.75);
  -webkit-backdrop-filter: blur(20px) saturate(190%);
  backdrop-filter: blur(20px) saturate(190%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.topbar:has(.topbar-search-wrap.is-open),
.topbar:has(.dropdown-wrap .dropdown) {
  z-index: var(--a-z-global-menu);
}

.topbar--auth {
  background: rgba(255, 255, 255, 0.58);
}
:root.dark .topbar--auth,
html.dark .topbar--auth {
  background: rgba(9, 10, 15, 0.75);
}
.topbar-inner {
  padding: 0 2rem 0 0;
  height: 100%;
  display: flex;
  align-items: center;
  gap: 0;
  width: 100%;
  min-width: 0;
}
.topbar-inner--auth {
  flex: 1;
  max-width: 1120px;
  margin: 0 auto;
  justify-content: space-between;
}
.brand-link {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  /* 与侧边栏等宽，使 nav 左侧与内容区对齐 */
  min-width: var(--a-sidebar-width, 0px);
  padding: 0 2rem;
  box-sizing: border-box;
}
.brand-logo-link {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: var(--a-color-fg);
}
.logo-box {
  width: 32px;
  height: 32px;
  background-color: var(--a-color-fg);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--a-shadow-sm);
}
.logo-inner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--a-color-bg);
  transform: rotate(45deg);
}
.logo-text {
  font-weight: 500;
  font-size: 1.2rem;
  letter-spacing: 0;
}
.logo-block {
  min-width: 0;
}
.logo-copy {
  display: flex;
  flex-direction: column;
  line-height: 1;
}
.logo-meta {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  margin-top: 2px;
  min-width: 0;
}
.logo-notice {
  font-size: 0.62rem;
  font-weight: 500;
  line-height: 1.1;
  letter-spacing: 0;
  color: var(--a-color-muted-soft);
  white-space: nowrap;
}
.logo-version {
  font-size: 0.52rem;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--a-color-muted-soft);
  text-transform: uppercase;
}
.nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}

.nav::-webkit-scrollbar {
  display: none;
}
.nav-link {
  display: flex;
  align-items: center;
  min-height: 2.25rem;
  padding: 0 0.75rem;
  border-radius: var(--a-radius-control);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--a-color-muted);
  text-decoration: none;
  background: transparent;
  transition: color 0.2s ease, background-color 0.2s ease;
}
.nav-link-name {
  font-weight: 500;
  white-space: nowrap;
}
.nav-link:hover,
.nav-link.active {
  color: var(--a-color-fg);
  background: var(--a-color-surface-muted);
  text-decoration: none;
}
.nav-sep { color: var(--a-color-border); }
.nav-link-sm {
  min-height: 2rem;
  display: inline-flex;
  align-items: center;
  padding: 0 0.625rem;
  border-radius: var(--a-radius-control);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--a-color-muted-soft);
  text-decoration: none;
  transition: color 0.2s ease, background-color 0.2s ease;
}
.nav-link-sm:hover {
  color: var(--a-color-fg);
  background: var(--a-color-surface-muted);
  text-decoration: none;
}
.nav-right {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-left: auto;
  min-width: 0;
  flex-shrink: 0;
  overflow: visible;
}

@media (max-width: 1280px) {
  .topbar-inner {
    padding-right: 1rem;
  }

  .brand-link {
    min-width: auto;
    padding-right: 1rem;
  }

  .logo-notice {
    display: none;
  }
}

.mobile-back-btn {
  display: none;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--a-color-fg);
  cursor: pointer;
}

.mobile-back-btn:hover,
.mobile-back-btn:focus-visible {
  background: var(--a-color-surface-muted);
}

@media (max-width: 720px) {
  .mobile-back-btn {
    display: inline-flex;
  }

  .topbar-inner {

    padding: 0 1rem 0 0;
    gap: 0;
  }

  .brand-link {
    display: none;
  }

  .mobile-module-switcher {
    display: inline-flex;
  }

  .nav {
    display: none;
  }

  .nav-right {
    gap: 0.35rem;
    overflow: visible;
  }
}

@media (max-width: 420px) {
  .topbar-inner {
    padding-right: 0.5rem;
  }

  .brand-link {
    padding-inline: 0.5rem;
  }

}

.topbar-collapse-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--a-color-fg);
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  border-radius: var(--a-radius-control);
  margin-right: 8px;
  margin-left: -12px;
  transition: background-color 0.2s ease;
  flex-shrink: 0;
}

.topbar-collapse-btn:hover {
  background-color: var(--a-color-surface-muted);
}

.theme-toggle-btn {
  border: 0;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border-radius: 50%;
  color: var(--a-color-text);
  transition: background-color 0.2s;
  margin-right: 0.5rem; /* spacing from auth controls */
}
.theme-toggle-btn:hover {
  background: var(--a-color-surface-muted);
}

@media (max-width: 420px) {
  .topbar-collapse-btn {
    margin-left: 0;
  }

  .nav-right {
    gap: 0;
  }

  .theme-toggle-btn {
    margin-right: 0;
  }
}
</style>
