<template>
  <header class="topbar" :class="{ 'topbar--auth': isAuthLayout }">
    <div :class="['topbar-inner', { 'topbar-inner--auth': isAuthLayout }]">
      <a href="/" class="brand-link" @click.prevent="handleBrandClick">
        <div class="logo-box">
          <div class="logo-inner"></div>
        </div>
        <span class="logo-text">ATOMAN</span>
      </a>

      <template v-if="isAuthLayout">
        <div class="auth-kicker">ACCESS</div>
      </template>

      <template v-else>
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
      </template>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSheetStore } from '@/stores/sheet'
import { useSiteAccessStore } from '@/stores/siteAccess'
import { useModuleNav, moduleUrl } from '@/composables/useSubdomainNav'
import { isRoomRouteActive, moduleNavOrder, moduleRooms, type ModuleRoomKey } from '@/config/moduleRooms'
import { resolveSiteContext } from '@/router/siteContext'

const router = useRouter()
const sheetStore = useSheetStore()
const { navigateTo } = useModuleNav()
const AppTopbarAuthControls = defineAsyncComponent(() => import('@/components/AppTopbarAuthControls.vue'))

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

const route = useRoute()
const navRooms = computed(() => moduleNavOrder.filter((key) => siteAccessStore.isModuleVisible(key)).map((key) => moduleRooms[key]))
const isAuthLayout = computed(() => route.matched.some((record) => record.meta.authLayout))
const siteContext = computed(() => resolveSiteContext(window.location.hostname, window.location.search))

const isRoomActive = (key: ModuleRoomKey) => isRoomRouteActive(key, siteContext.value)
</script>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  background: #ffffff;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  height: 56px;
}
.topbar--auth {
  background: #ffffff;
  border-bottom-color: rgba(0, 0, 0, 0.12);
}
.topbar-inner {
  padding: 0 24px;
  height: 100%;
  display: flex;
  align-items: center;
  gap: 2rem;
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
.logo-text {
  font-weight: 900;
  font-size: 1.2rem;
  letter-spacing: -0.02em;
}
.auth-kicker {
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.28em;
  color: #8a7b67;
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
  color: #6b7280;
  text-decoration: none;
  transition: color 0.2s;
}
.nav-link-name { font-weight: 900; }
.nav-link:hover { color: #000; text-decoration: underline; }
.nav-link.active { color: #000; }
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

  .auth-kicker {
    display: none;
  }
}
</style>
