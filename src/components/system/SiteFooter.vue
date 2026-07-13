<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { getActivePinia } from 'pinia'
import { RouterLink } from 'vue-router'
import { appVersion } from '@/config/appVersion'
import { footbarLinks, type FootbarPanel } from '@/config/moduleRooms'
import { createSheetStack } from '@/composables/useSheetStack'
import { useAuthStore } from '@/stores/auth'
import { isAdminRole } from '@/utils/roles'
import SiteFooterSheet from './footer/SiteFooterSheet.vue'

type FooterSheetLayer = {
  key: FootbarPanel
  kind: FootbarPanel
  title: string
  returnFocusTo?: HTMLElement | null
}

const pinia = getActivePinia()
const authStore = pinia ? useAuthStore(pinia) : null
const isAdmin = computed(() => authStore ? isAdminRole(authStore.user?.role) : false)
const copyrightYear = new Date().getFullYear()
const primaryLinks = footbarLinks.filter(link => link.group === 'primary')
const secondaryLinks = footbarLinks.filter(link => link.group === 'secondary')
const sheetStack = createSheetStack<FooterSheetLayer>({ maxLayers: 1 })
const activePanel = computed(() => sheetStack.top.value?.kind ?? null)
const isScrolled = ref(false)

function handleScroll(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLElement)) {
    isScrolled.value = (window.scrollY || document.documentElement.scrollTop) > 0
  } else if (target.classList.contains('a-main-content')) {
    isScrolled.value = target.scrollTop > 0
  }
}

function openPanel(panel: FootbarPanel, label: string) {
  sheetStack.push({ key: panel, kind: panel, title: label })
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { capture: true, passive: true })
  const mainContent = document.querySelector('.a-main-content')
  isScrolled.value = mainContent ? mainContent.scrollTop > 0 : window.scrollY > 0
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll, { capture: true })
})
</script>

<template>
  <footer class="site-footer" :class="{ 'is-scrolled': isScrolled }">
    <div class="site-footer-inner">
      <div class="site-footer-row site-footer-primary">
        <RouterLink v-if="isAdmin" to="/site/setting" class="site-footer-brand">凹凸庵</RouterLink>
        <span v-else class="site-footer-brand site-footer-brand--disabled" title="需要管理员权限">凹凸庵</span>
        <nav class="site-footer-links" aria-label="站点信息">
          <button
            v-for="link in primaryLinks"
            :key="link.panel"
            class="site-footer-link"
            type="button"
            :data-footer-panel="link.panel"
            @click="openPanel(link.panel, link.label)"
          >{{ link.label }}</button>
        </nav>
      </div>

      <div class="site-footer-row site-footer-secondary">
        <span>© {{ copyrightYear }} 凹凸庵</span>
        <div class="site-footer-meta">
          <button
            v-for="link in secondaryLinks"
            :key="link.panel"
            class="site-footer-link site-footer-link--meta"
            type="button"
            :data-footer-panel="link.panel"
            @click="openPanel(link.panel, link.label)"
          >{{ link.label }}</button>
          <span class="site-footer-version" aria-label="当前版本">{{ appVersion }}</span>
        </div>
      </div>
    </div>

    <SiteFooterSheet :panel="activePanel" @close="sheetStack.clear" />
  </footer>
</template>

<style scoped>
.site-footer {
  position: fixed;
  right: 0;
  bottom: 0;
  left: var(--a-sidebar-width);
  z-index: var(--a-z-navigation);
  height: var(--a-footer-reserved-height);
  background: var(--a-color-bg);
  transition: background-color 0.25s ease, backdrop-filter 0.25s ease, -webkit-backdrop-filter 0.25s ease;
}

.site-footer.is-scrolled {
  background: color-mix(in srgb, var(--a-color-bg) 80%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.site-footer::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  width: 20px;
  height: 1px;
  transform: translateX(-50%);
  background-color: var(--a-color-ink);
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.site-footer::after {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  width: 68px;
  height: 1px;
  transform: translateX(-50%);
  background: linear-gradient(
    to right,
    var(--a-color-ink) 0 12px,
    transparent 12px 56px,
    var(--a-color-ink) 56px 68px
  );
  opacity: 0.45;
  transition: opacity 0.25s ease;
}

.site-footer.is-scrolled::before {
  width: 75%;
}

.site-footer.is-scrolled::after {
  opacity: 0;
}

.site-footer-inner {
  display: flex;
  height: 100%;
  flex-direction: column;
  max-width: 1152px;
  margin: 0 auto;
  padding: 0 var(--a-space-6);
}

.site-footer-row {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: space-between;
  gap: var(--a-space-5);
  min-height: 44px;
}

.site-footer-brand {
  color: var(--a-color-fg);
  font-size: var(--a-text-lg);
  font-weight: var(--a-font-weight-black);
  text-decoration: none;
}

.site-footer-brand:hover {
  text-decoration: underline;
}

.site-footer-brand--disabled {
  color: var(--a-color-muted);
  cursor: not-allowed;
  opacity: 0.45;
}

.site-footer-brand--disabled:hover {
  text-decoration: none;
}

.site-footer-links,
.site-footer-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--a-space-4);
}

.site-footer-link {
  min-height: 44px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--a-color-muted);
  font: inherit;
  font-size: var(--a-text-sm);
  font-weight: var(--a-font-weight-strong);
  cursor: pointer;
}

.site-footer-link:hover {
  color: var(--a-color-fg);
  text-decoration: underline;
}

.site-footer-link:focus-visible,
.site-footer-brand:focus-visible {
  outline: 2px solid var(--a-color-fg);
  outline-offset: 2px;
}

.site-footer-secondary {
  margin-top: 0;
  color: var(--a-color-muted);
  font-size: var(--a-text-xs);
}

.site-footer-link--meta,
.site-footer-version {
  color: var(--a-color-muted);
  font-size: var(--a-text-xs);
  white-space: nowrap;
}

.site-footer-version {
  font-weight: var(--a-font-weight-strong);
}

@media (max-width: 767px) {
  .site-footer-inner {
    padding: 0 var(--a-space-5) env(safe-area-inset-bottom, 0px);
  }

  .site-footer-row {
    gap: var(--a-space-4);
  }

  .site-footer-links,
  .site-footer-meta {
    justify-content: flex-end;
    gap: var(--a-space-3);
  }
}

@media (prefers-reduced-motion: reduce) {
  .site-footer,
  .site-footer::before,
  .site-footer::after {
    transition: none;
  }
}
</style>
