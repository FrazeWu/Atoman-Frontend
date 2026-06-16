<template>
  <header class="topbar">
    <div class="topbar-inner">
      <a href="/" class="brand-link" @click.prevent="handleBrandClick">
        <div class="logo-box">
          <div class="logo-inner"></div>
        </div>
        <span class="logo-copy">
          <span class="logo-text">ATOMAN</span>
          <span v-if="appVersion" class="logo-version">{{ appVersion }}</span>
        </span>
      </a>

      <nav class="nav" data-onboarding-anchor="modules-nav">
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
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSheetStore } from '@/stores/sheet'
import { useSiteAccessStore } from '@/stores/siteAccess'
import { useModuleNav, moduleUrl } from '@/composables/useSubdomainNav'
import { isRoomRouteActive, moduleNavOrder, moduleRooms, type ModuleRoomKey } from '@/config/moduleRooms'
import { resolveSiteContext } from '@/router/siteContext'

const router = useRouter()
const sheetStore = useSheetStore()
const { navigateTo } = useModuleNav()
const AppTopbarAuthControls = defineAsyncComponent(() => import('@/components/system/AppTopbarAuthControls.vue'))
const appVersion = import.meta.env.VITE_APP_VERSION?.trim()

const handleBrandClick = () => {
  if (sheetStore.stack.length > 0) {
    sheetStore.clearStack(true)
  } else {
    // Navigate to current context root
    router.push('/')
  }
}

const authStore = useAuthStore()
const siteAccessStore = useSiteAccessStore()

const navRooms = computed(() => moduleNavOrder.filter((key) => siteAccessStore.isModuleVisible(key)).map((key) => moduleRooms[key]))
const siteContext = computed(() => resolveSiteContext(window.location.hostname, window.location.search))

const isRoomActive = (key: ModuleRoomKey) => isRoomRouteActive(key, siteContext.value)
</script>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  background: var(--a-color-paper);
  border-bottom: 1px solid var(--a-color-line-soft);
  height: 56px;
}
.topbar-inner {
  padding: 0 24px;
  height: 100%;
  display: flex;
  align-items: center;
  gap: 2rem;
}
.brand-link {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: #000;
  flex-shrink: 0;
}
.logo-box {
  width: 32px;
  height: 32px;
  background-color: black;
  display: flex;
  align-items: center;
  justify-content: center;
}
.logo-inner {
  width: 16px;
  height: 16px;
  border: 2px solid white;
  transform: rotate(45deg);
}
.logo-copy {
  display: flex;
  flex-direction: column;
  line-height: 1;
}
.logo-text {
  font-weight: 900;
  font-size: 1.2rem;
  letter-spacing: -0.02em;
}
.logo-version {
  align-self: flex-end;
  margin-top: 2px;
  font-size: 0.52rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--a-color-ink-soft);
  text-transform: uppercase;
}
.nav {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex: 1;
}
.nav-link {
  display: flex;
  align-items: center;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--a-color-ink-soft);
  text-decoration: none;
  transition: color 0.25s ease;
  position: relative;
  padding: 0.25rem 0;
}
.nav-link-name { font-weight: var(--a-font-weight-strong, 700); }
.nav-link:hover { color: var(--a-color-ink); }
.nav-link.active { color: var(--a-color-ink); }

.nav-link::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 100%;
  height: 1.5px;
  background-color: var(--a-color-ink);
  transform: scaleX(0);
  transform-origin: right;
  transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.nav-link:hover::after,
.nav-link.active::after {
  transform: scaleX(1);
  transform-origin: left;
}
.nav-sep { color: #d1d5db; }
.nav-link-sm {
  font-size: 0.75rem;
  font-weight: 700;
  color: #9ca3af;
  text-decoration: none;
  transition: color 0.2s;
}
.nav-link-sm:hover { color: #000; text-decoration: underline; }
.nav-right {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-left: auto;
}

@media (max-width: 720px) {
  .topbar-inner {
    padding: 0 16px;
    gap: 1rem;
  }

  .nav {
    gap: 1rem;
    overflow-x: auto;
  }

}
</style>
