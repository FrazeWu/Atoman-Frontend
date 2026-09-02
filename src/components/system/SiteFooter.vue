<script setup lang="ts">
import { computed } from 'vue'
import { getActivePinia } from 'pinia'
import { RouterLink } from 'vue-router'
import { appVersion } from '@/config/appVersion'
import { relatedLinks } from '@/config/relatedLinks'
import { footbarLinks, type FootbarPanel } from '@/config/moduleRooms'
import { createSheetStack } from '@/composables/useSheetStack'
import { useAuthStore } from '@/stores/auth'
import { isAdminRole } from '@/utils/roles'
import SiteFooterSheet from './footer/SiteFooterSheet.vue'
import SiteVisitStats from './SiteVisitStats.vue'

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

function openPanel(panel: FootbarPanel, label: string) {
  sheetStack.push({ key: panel, kind: panel, title: label })
}
</script>

<template>
  <footer class="site-footer">
    <div class="site-footer-inner">
      <div class="site-footer-grid">
        <div class="site-footer-column site-footer-primary">
          <RouterLink v-if="isAdmin" to="/site/setting" class="site-footer-brand">凹凸庵</RouterLink>
          <span v-else class="site-footer-brand site-footer-brand--disabled" title="需要管理员权限">凹凸庵</span>
          <SiteVisitStats />
        </div>

        <div class="site-footer-column site-footer-center">
          <nav class="site-footer-related" aria-label="相关链接">
            <span class="site-footer-section-label">相关链接</span>
            <div class="site-footer-related-grid">
              <a
                v-for="link in relatedLinks"
                :key="link.href"
                class="site-footer-link site-footer-link--related"
                :data-footer-related-link="link.label"
                :data-footer-action="link.action"
                :href="link.href"
                target="_blank"
                rel="noopener noreferrer"
              >{{ link.label }}</a>
            </div>
          </nav>
        </div>

        <div class="site-footer-column site-footer-secondary">
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
          <span class="site-footer-copyright">© {{ copyrightYear }} 凹凸庵</span>
        </div>
      </div>
    </div>

    <SiteFooterSheet :panel="activePanel" @close="sheetStack.clear" />
  </footer>
</template>

<style scoped>
.site-footer {
  position: relative;
  background: var(--a-color-bg);
}

.site-footer-inner {
  display: block;
  height: 100%;
  max-width: 1152px;
  margin: 0 auto;
  padding: 0 var(--a-space-6);
}

.site-footer-grid {
  display: grid;
  grid-template-columns: minmax(140px, 0.9fr) minmax(0, 2fr) minmax(260px, 1.1fr);
  align-items: center;
  gap: var(--a-space-8);
  min-height: 176px;
  padding-block: var(--a-space-7);
}

.site-footer-column {
  min-width: 0;
}

.site-footer-primary {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.site-footer-secondary {
  display: grid;
  align-content: center;
  justify-items: end;
  gap: var(--a-space-1);
  color: var(--a-color-muted);
  font-size: var(--a-text-xs);
  text-align: right;
}

.site-footer-center {
  display: grid;
  min-width: 0;
  justify-items: center;
}

.site-footer-related {
  width: min(100%, 760px);
}

.site-footer-related-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0 var(--a-space-4);
}

.site-footer-section-label {
  display: block;
  min-height: 28px;
  color: var(--a-color-muted);
  font-size: var(--a-text-xs);
  font-weight: var(--a-font-weight-strong);
  line-height: 28px;
  text-align: center;
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
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: var(--a-space-3);
}

.site-footer-meta {
  color: var(--a-color-muted);
}

.site-footer-copyright {
  min-height: 20px;
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
  text-decoration: none;
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

.site-footer-link--related {
  min-width: 0;
  text-align: center;
  overflow-wrap: anywhere;
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

  .site-footer-grid {
    grid-template-columns: 1fr;
    gap: var(--a-space-5);
    min-height: 0;
    padding-block: var(--a-space-6);
  }

  .site-footer-primary {
    justify-content: center;
  }

  .site-footer-center,
  .site-footer-secondary {
    padding-left: calc(152px + var(--a-space-3));
  }

  .site-footer-links,
  .site-footer-meta {
    gap: var(--a-space-3);
  }

  .site-footer-related-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 var(--a-space-3);
  }

  .site-footer-link--related {
    font-size: var(--a-text-xs);
    white-space: nowrap;
  }
}

@media (max-width: 380px) {
  .site-footer-related-grid {
    grid-template-columns: 1fr;
  }
}

</style>
