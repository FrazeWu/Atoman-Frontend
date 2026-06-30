<template>
  <header class="topbar" :class="{ 'topbar--auth': isAuthRoute }">
    <div class="topbar-inner" :class="{ 'topbar-inner--auth': isAuthRoute }">
      <a href="/" class="brand-link" @click.prevent="handleBrandClick">
        <div class="logo-box">
          <div class="logo-inner"></div>
        </div>
        <span class="logo-copy">
          <span class="logo-text">ATOMAN</span>
          <span v-if="appVersion" class="logo-version">{{ appVersion }}</span>
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
        <AppTopbarAuthControls v-if="authStore.isAuthenticated" />
        <RouterLink v-else to="/login" class="a-btn a-btn--primary a-btn--sm">登录</RouterLink>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { RouterLink, useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSheetStore } from '@/stores/sheet'
import { useSiteAccessStore } from '@/stores/siteAccess'
import { useModuleNav, moduleUrl } from '@/composables/useSubdomainNav'
import { isRoomRouteActive, moduleNavOrder, moduleRooms, type ModuleRoomKey } from '@/config/moduleRooms'
import { resolveSiteContext } from '@/router/siteContext'

const router = useRouter()
const route = useRoute()

const isAuthRoute = computed(() => route.matched.some((record) => record.meta.authLayout))
const sheetStore = useSheetStore()
const { navigateTo } = useModuleNav()
const AppTopbarAuthControls = defineAsyncComponent(() => import('@/components/system/AppTopbarAuthControls.vue'))
const appVersion = import.meta.env.VITE_APP_VERSION?.trim()

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

const navRooms = computed(() => moduleNavOrder.filter((key) => siteAccessStore.isModuleVisible(key)).map((key) => moduleRooms[key]))
const siteContext = computed(() => {
  const queryStart = route.fullPath.indexOf('?')
  const search = queryStart >= 0 ? route.fullPath.slice(queryStart) : ''
  return resolveSiteContext(window.location.hostname, search, route.path)
})

const isRoomActive = (key: ModuleRoomKey) => isRoomRouteActive(key, siteContext.value)
</script>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  background: var(--a-color-bg);
  height: 56px;
}
.topbar--auth {
  background: var(--a-color-bg);
}
.topbar-inner {
  max-width: 80rem;
  margin: 0 auto;
  padding: 0 2rem;
  height: 100%;
  display: flex;
  align-items: center;
  gap: 2rem;
  width: 100%;
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
.logo-copy {
  display: flex;
  flex-direction: column;
  line-height: 1;
}
.logo-version {
  align-self: flex-end;
  margin-top: 2px;
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
}

@media (max-width: 720px) {
  .topbar-inner {
    padding: 0 1rem;
    gap: 1rem;
  }

  .nav {
    gap: 0.25rem;
    overflow-x: auto;
  }

  .nav-link {
    padding: 0 0.625rem;
  }
}
</style>
