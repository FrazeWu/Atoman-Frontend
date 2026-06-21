<template>
  <div class="mobile-bottom-nav">
    <nav class="mobile-bottom-nav__bar" aria-label="移动主导航">
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
        <span class="mobile-bottom-nav__tab-copy">{{ tab.label }}</span>
      </a>
    </nav>

    <MobileMoreSheet :show="isMoreOpen" @close="closeMore" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import MobileMoreSheet from '@/components/system/MobileMoreSheet.vue'
import { getMobilePrimaryTabs, type MobilePrimaryTab } from '@/composables/useResponsiveShell'
import { useModuleNav } from '@/composables/useSubdomainNav'
import { useAsyncNavigate } from '@/composables/useAsyncNavigate'
import { resolveSiteContext } from '@/router/siteContext'

defineOptions({
  name: 'MobileBottomNav',
})

const { navigateTo } = useModuleNav()
const { navigateModuleWithShutter } = useAsyncNavigate()

const tabs = computed(() => getMobilePrimaryTabs())
const isMoreOpen = ref(false)
const siteContext = computed(() => resolveSiteContext(window.location.hostname, window.location.search))

const closeMore = () => {
  isMoreOpen.value = false
}

const isTabActive = (tab: MobilePrimaryTab) => {
  if (tab.key === 'more') return isMoreOpen.value
  return siteContext.value.type === 'module' && siteContext.value.module === tab.module
}

const onTabClick = (tab: MobilePrimaryTab, event: MouseEvent) => {
  if (tab.key === 'more') {
    event.preventDefault()
    isMoreOpen.value = true
    return
  }

  closeMore()

  if (tab.key === 'create' && tab.href) {
    event.preventDefault()
    void navigateModuleWithShutter(tab.href)
    return
  }

  if (tab.module) {
    event.preventDefault()
    navigateTo(tab.module)
  }
}
</script>

<style scoped>
.mobile-bottom-nav {
  position: relative;
  z-index: 60;
}

.mobile-bottom-nav__bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border-top: 1px solid var(--a-color-line-soft);
  background: color-mix(in srgb, var(--a-color-bg) 94%, white 6%);
  backdrop-filter: blur(18px);
}

.mobile-bottom-nav__tab {
  display: flex;
  min-height: calc(64px + env(safe-area-inset-bottom, 0px));
  align-items: center;
  justify-content: center;
  padding: 0.9rem 0.5rem calc(0.9rem + env(safe-area-inset-bottom, 0px));
  color: var(--a-color-muted);
  text-decoration: none;
  transition: color 0.2s ease, background-color 0.2s ease;
}

.mobile-bottom-nav__tab.is-active {
  color: var(--a-color-fg);
  background: var(--a-color-paper-wash);
}

.mobile-bottom-nav__tab-copy {
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: -0.02em;
  text-align: center;
}
@media (min-width: 768px) {
  .mobile-bottom-nav__bar {
    display: none;
  }
}
</style>
