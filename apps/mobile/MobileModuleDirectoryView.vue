<template>
  <main class="mobile-module-directory a-page">
    <section class="mobile-module-directory__section" aria-labelledby="mobile-modules-title">
      <h2 id="mobile-modules-title">模块</h2>
      <nav class="mobile-module-directory__list" aria-label="模块">
        <RouterLink
          v-for="item in moduleItems"
          :key="item.module"
          :to="item.href"
          class="mobile-module-directory__row"
        >
          <component :is="item.icon" :size="20" aria-hidden="true" />
          <span>{{ item.label }}</span>
          <Check v-if="item.module === currentModule" :size="18" aria-label="当前模块" />
          <ChevronRight v-else :size="18" aria-hidden="true" />
        </RouterLink>
      </nav>
    </section>

    <section class="mobile-module-directory__section" aria-labelledby="mobile-personal-title">
      <h2 id="mobile-personal-title">个人</h2>
      <nav class="mobile-module-directory__list" aria-label="个人入口">
        <RouterLink v-if="authStore.user" :to="`/users/${authStore.user.username}`" class="mobile-module-directory__row">
          <UserRound :size="20" aria-hidden="true" />
          <span>个人资料</span>
          <ChevronRight :size="18" aria-hidden="true" />
        </RouterLink>
        <RouterLink to="/inbox?tab=notifications" class="mobile-module-directory__row">
          <Bell :size="20" aria-hidden="true" />
          <span>通知</span>
          <ChevronRight :size="18" aria-hidden="true" />
        </RouterLink>
        <RouterLink to="/inbox?tab=dm" class="mobile-module-directory__row">
          <MessageCircle :size="20" aria-hidden="true" />
          <span>私信</span>
          <ChevronRight :size="18" aria-hidden="true" />
        </RouterLink>
        <RouterLink to="/studio" class="mobile-module-directory__row">
          <PenLine :size="20" aria-hidden="true" />
          <span>Studio</span>
          <ChevronRight :size="18" aria-hidden="true" />
        </RouterLink>
        <a v-if="authStore.user" :href="desktopAppPath(`/users/${authStore.user.username}/settings`)" class="mobile-module-directory__row">
          <Settings :size="20" aria-hidden="true" />
          <span>设置</span>
          <ExternalLink :size="16" aria-hidden="true" />
        </a>
        <RouterLink v-else to="/login" class="mobile-module-directory__row">
          <LogIn :size="20" aria-hidden="true" />
          <span>登录</span>
          <ChevronRight :size="18" aria-hidden="true" />
        </RouterLink>
      </nav>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { IconBell as Bell, IconCheck as Check, IconChevronRight as ChevronRight, IconExternalLink as ExternalLink, IconLogin as LogIn, IconMessageCircle as MessageCircle, IconPencil as PenLine, IconSettings as Settings, IconUser as UserRound } from '@tabler/icons-vue'
import { getMobileMoreItems } from '@/composables/useResponsiveShell'
import { useAuthStore } from '@/stores/auth'
import { useSiteAccessStore } from '@/stores/siteAccess'
import { desktopAppPath } from '@/utils/desktopAppUrl'
import { MOBILE_MODULES } from './mobileRoutes'

const route = useRoute()
const authStore = useAuthStore()
const siteAccessStore = useSiteAccessStore()
const moduleSet = new Set<string>(MOBILE_MODULES)
const moduleItems = computed(() => getMobileMoreItems().filter((item) => (
  moduleSet.has(item.module) && siteAccessStore.isModuleVisible(item.module)
)))
const currentModule = computed(() => {
  if (route.path.startsWith('/posts') || route.path.startsWith('/post') || route.path.startsWith('/channel') || route.path.startsWith('/collection') || route.path.startsWith('/users')) return 'blog'
  if (route.path.startsWith('/music')) return 'music'
  return 'feed'
})
</script>

<style scoped>
.mobile-module-directory {
  min-height: calc(100dvh - var(--a-topbar-height));
  padding: 1rem 1rem calc(2rem + env(safe-area-inset-bottom, 0px));
  background: var(--a-color-bg);
}

.mobile-module-directory__section {
  margin-bottom: 1.5rem;
}

.mobile-module-directory__section h2 {
  margin: 0 0 0.5rem 0.75rem;
  color: var(--a-color-muted);
  font-size: 0.8125rem;
  font-weight: 500;
}

.mobile-module-directory__list {
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 8px;
  background: var(--a-color-surface);
}

.mobile-module-directory__row {
  display: flex;
  min-height: 52px;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  color: var(--a-color-fg);
  text-decoration: none;
}

.mobile-module-directory__row:last-child {
  border-bottom: 0;
}

.mobile-module-directory__row span {
  flex: 1;
  font-size: 1rem;
}

.mobile-module-directory__row > svg:first-child {
  color: var(--a-color-primary);
}

.mobile-module-directory__row > svg:last-child {
  color: var(--a-color-muted);
}

.mobile-module-directory__row:focus-visible {
  position: relative;
  z-index: 1;
  outline: 2px solid var(--a-color-primary);
  outline-offset: -2px;
}
</style>
