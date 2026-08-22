<template>
  <div v-if="tabs.length > 0" class="mobile-bottom-nav">
    <nav class="mobile-bottom-nav__bar" aria-label="当前模块导航">
      <a
        v-for="tab in tabs"
        :key="tab.key"
        :href="tab.href"
        class="mobile-bottom-nav__tab"
        :class="{ 'is-active': isTabActive(tab) }"
        :data-tab-key="tab.key"
        data-testid="mobile-bottom-nav-tab"
        @click="onTabClick(tab, $event)"
      >
        <component :is="tab.icon" :size="18" aria-hidden="true" />
        <span class="mobile-bottom-nav__tab-copy">{{ tab.label }}</span>
      </a>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getMobilePrimaryTabs, type MobilePrimaryTab } from '@/composables/useResponsiveShell'
import { resolveSiteContext } from '@/router/siteContext'


defineOptions({
  name: 'MobileBottomNav',
})

const route = useRoute()
const router = useRouter()

const siteContext = computed(() => {
  const queryStart = route.fullPath.indexOf('?')
  const search = queryStart >= 0 ? route.fullPath.slice(queryStart) : ''
  return resolveSiteContext(window.location.hostname, search, route.path)
})

const currentModule = computed(() => siteContext.value.type === 'module' ? siteContext.value.module : undefined)
const tabs = computed(() => getMobilePrimaryTabs(currentModule.value))

const isTabActive = (tab: MobilePrimaryTab) => {
  if (siteContext.value.type !== 'module' || siteContext.value.module !== tab.module) return false
  const currentPath = route.path.replace(/\/$/, '') || '/'
  const targetPath = router.resolve(tab.href).path.replace(/\/$/, '') || '/'
  if (currentPath === targetPath) return true

  const homeKeys = new Set(['discover', 'topics', 'timeline'])
  const homePath = tab.module === 'blog'
    ? '/posts'
    : tab.module === 'podcast'
      ? '/podcasts'
      : tab.module === 'video'
        ? '/videos'
        : `/${tab.module}`
  return homeKeys.has(tab.key) && currentPath === homePath
}

const onTabClick = async (tab: MobilePrimaryTab, event: MouseEvent) => {
  event.preventDefault()
  await router.push(tab.href)
}
</script>

<style scoped>
.mobile-bottom-nav {
  position: relative;
  z-index: var(--a-z-navigation);
}

.mobile-bottom-nav__bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border-top: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
}

.mobile-bottom-nav__tab {
  display: flex;
  min-height: calc(64px + env(safe-area-inset-bottom, 0px));
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.55rem 0.35rem calc(0.55rem + env(safe-area-inset-bottom, 0px));
  color: var(--a-color-muted);
  text-decoration: none;
  transition: color 0.2s ease, background-color 0.2s ease;
}

.mobile-bottom-nav__tab.is-active {
  color: var(--a-color-fg);
  background: var(--a-color-surface-muted);
}

.mobile-bottom-nav__tab-copy {
  max-width: 100%;
  overflow: hidden;
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (min-width: 768px) {
  .mobile-bottom-nav__bar {
    display: none;
  }
}
</style>
