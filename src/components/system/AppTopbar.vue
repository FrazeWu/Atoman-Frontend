<template>
  <header class="topbar" :class="{ 'topbar--auth': isAuthRoute, 'is-scrolled': isScrolled }">
    <div class="topbar-inner" :class="{ 'topbar-inner--auth': isAuthRoute }">
      <a href="/" class="brand-link" @click.prevent="handleBrandClick">
        <button
          v-if="hasSidebar && !isAuthRoute"
          class="topbar-collapse-btn"
          type="button"
          aria-label="Toggle sidebar"
          @click.stop="toggleSidebar"
        >
          <Menu :size="18" aria-hidden="true" />
        </button>
        <div class="logo-box">
          <div class="logo-inner"></div>
        </div>
        <span class="logo-block">
          <span class="logo-copy">
            <span class="logo-text">ATOMAN</span>
            <span class="logo-meta">
              <span v-if="appVersion" class="logo-version">{{ appVersion }}</span>
              <span class="logo-notice">测试阶段，不保留用户数据</span>
            </span>
          </span>
        </span>
      </a>

      <nav v-if="!isAuthRoute" class="nav" data-onboarding-anchor="modules-nav">
        <a
          v-for="room in navRooms"
          :key="room.key"
          :href="moduleUrl(room.key)"
          class="nav-link"
          :class="{ active: isRoomActive(room.key) }"
          :data-onboarding-anchor="room.key === 'feed' ? 'feed-nav-link' : undefined"
          @click.prevent="navigateTo(room.key)"
        >
          <span class="nav-link-name">{{ room.name }}</span>
        </a>
      </nav>

      <div class="nav-right">
        <AppTopbarAuthControls v-if="showAuthControls" />
        <RouterLink v-else to="/login" class="a-btn a-btn--primary a-btn--sm">登录</RouterLink>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref, onMounted, onBeforeUnmount } from 'vue'
import { RouterLink, useRouter, useRoute } from 'vue-router'
import { Menu } from 'lucide-vue-next'
import { useSidebar } from '@/composables/useSidebar'
import { useAuthStore } from '@/stores/auth'
import { useSheetStore } from '@/stores/sheet'
import { useSiteAccessStore } from '@/stores/siteAccess'
import { useModuleNav, moduleUrl } from '@/composables/useSubdomainNav'
import { isRoomRouteActive, moduleRooms, topbarNavOrder, type ModuleRoomKey } from '@/config/moduleRooms'
import { appVersion } from '@/config/appVersion'
import { resolveSiteContext } from '@/router/siteContext'

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
  } else {
    // Navigate to current context root
    const context = resolveSiteContext(window.location.hostname, window.location.search, window.location.pathname)
    router.push(context.type === 'module' ? moduleUrl(context.module) : '/feed')
  }
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

// Scroll detection to animate the bottom tick mark
const isScrolled = ref(false)
const handleScroll = (e: Event) => {
  const target = e.target
  if (target === document || target === window) {
    isScrolled.value = (window.scrollY || document.documentElement.scrollTop) > 0
  } else if (target instanceof HTMLElement && target.classList.contains('a-main-content')) {
    isScrolled.value = target.scrollTop > 0
  }
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { capture: true, passive: true })
  const mainContent = document.querySelector('.a-main-content')
  if (mainContent) {
    isScrolled.value = mainContent.scrollTop > 0
  } else {
    isScrolled.value = window.scrollY > 0
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll, { capture: true })
})
</script>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--a-color-bg);
  height: 56px;
  transition: background-color 0.25s ease, backdrop-filter 0.25s ease, -webkit-backdrop-filter 0.25s ease;
}
.topbar::after {
  content: '';
  position: absolute;
  left: calc(50% + var(--a-sidebar-width, 0px) / 2);
  bottom: 0;
  transform: translateX(-50%);
  width: 20px;
  height: 1px;
  background-color: var(--a-color-ink);
  z-index: 10;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.topbar.is-scrolled::after {
  width: calc((100% - var(--a-sidebar-width, 0px)) * 0.75);
}
.topbar--auth {
  background: var(--a-color-bg);
}
.topbar.is-scrolled {
  background: color-mix(in srgb, var(--a-color-bg) 80%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
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
  text-decoration: none;
  color: var(--a-color-fg);
  flex-shrink: 0;
  /* 与侧边栏等宽，使 nav 左侧与内容区对齐 */
  min-width: var(--a-sidebar-width, 0px);
  padding: 0 2rem;
  box-sizing: border-box;
}
.logo-box {
  width: 32px;
  height: 32px;
  background-color: var(--a-color-fg);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--a-shadow-paper-sm);
}
.logo-inner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--a-color-bg);
  transform: rotate(45deg);
}
.logo-text {
  font-weight: 900;
  font-size: 1.2rem;
  letter-spacing: -0.02em;
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
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: 0.04em;
  color: var(--a-color-muted-soft);
  white-space: nowrap;
}
.logo-version {
  font-size: 0.52rem;
  font-weight: 800;
  letter-spacing: 0.1em;
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
  border-radius: 0px; /* Straight corner block */
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--a-color-muted);
  text-decoration: none;
  background: transparent;
  transition: color 0.2s ease, background-color 0.2s ease;
}
.nav-link-name { font-weight: 900; }
.nav-link:hover,
.nav-link.active {
  color: var(--a-color-fg);
  background: var(--a-color-paper-wash); /* Flat wash block */
  text-decoration: none;
}
.nav-sep { color: var(--a-color-line); }
.nav-link-sm {
  min-height: 2rem;
  display: inline-flex;
  align-items: center;
  padding: 0 0.625rem;
  border-radius: 0px; /* Straight corner */
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--a-color-muted-soft);
  text-decoration: none;
  transition: color 0.2s ease, background-color 0.2s ease;
}
.nav-link-sm:hover {
  color: var(--a-color-fg);
  background: var(--a-color-paper-wash);
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

@media (max-width: 720px) {
  .topbar-inner {
    padding: 0 1rem 0 0;
    gap: 0;
  }

  .brand-link {
    min-width: unset;
    padding: 0 1rem;
  }

  .logo-block {
    width: 100%;
  }

  .logo-meta {
    flex-wrap: wrap;
    gap: 0.25rem 0.5rem;
  }

  .logo-notice {
    white-space: normal;
  }

  .nav {
    gap: 0.25rem;
    overflow-x: auto;
  }

  .nav-link {
    padding: 0 0.625rem;
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
  border-radius: var(--a-radius-none, 4px);
  margin-right: 8px;
  margin-left: -12px;
  transition: background-color 0.2s ease;
  flex-shrink: 0;
}

.topbar-collapse-btn:hover {
  background-color: var(--a-color-paper-wash);
}
</style>
