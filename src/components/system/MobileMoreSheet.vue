<template>
  <PSheet
    :show="show"
    side="bottom"
    title="更多"
    close-type="header"
    @close="$emit('close')"
  >
    <div class="mobile-more-sheet" data-testid="mobile-more-sheet">
      <p class="mobile-more-sheet__eyebrow">MORE</p>

      <nav class="mobile-more-sheet__grid" aria-label="更多模块">
        <a
          v-for="item in items"
          :key="item.module"
          :href="item.href"
          class="mobile-more-sheet__item"
        >
          <span class="mobile-more-sheet__item-label">{{ item.label }}</span>
          <span class="mobile-more-sheet__item-helper">{{ item.module.toUpperCase() }}</span>
        </a>
      </nav>

      <section class="mobile-more-sheet__site">
        <p class="mobile-more-sheet__eyebrow">站点信息</p>
        <nav class="mobile-more-sheet__site-links" aria-label="站点信息">
          <button
            v-for="link in footbarLinks"
            :key="link.panel"
            type="button"
            class="mobile-more-sheet__site-link"
            :data-footer-panel="link.panel"
            @click="openFooterPanel(link.panel)"
          >{{ link.label }}</button>
        </nav>
      </section>
    </div>
  </PSheet>

  <SiteFooterSheet :panel="activePanel" @close="activePanel = null" />
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import PSheet from '@/components/ui/PSheet.vue'
import SiteFooterSheet from '@/components/system/footer/SiteFooterSheet.vue'
import { getMobileMoreItems } from '@/composables/useResponsiveShell'
import { footbarLinks, type FootbarPanel } from '@/config/moduleRooms'

defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const items = computed(() => getMobileMoreItems())
const activePanel = ref<FootbarPanel | null>(null)

async function openFooterPanel(panel: FootbarPanel) {
  emit('close')
  await nextTick()
  activePanel.value = panel
}
</script>

<style scoped>
.mobile-more-sheet {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.mobile-more-sheet__eyebrow {
  margin: 0;
  color: var(--a-color-muted);
  font-family: var(--a-font-meta);
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0;
}

.mobile-more-sheet__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.mobile-more-sheet__item {
  display: flex;
  min-height: 76px;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 1rem;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  text-decoration: none;
}

.mobile-more-sheet__item-label {
  font-weight: 500;
  letter-spacing: 0;
}

.mobile-more-sheet__item-helper {
  color: var(--a-color-muted);
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0;
}

.mobile-more-sheet__site {
  display: grid;
  gap: var(--a-space-2);
  padding-top: var(--a-space-4);
  border-top: 1px solid var(--a-color-line-soft);
}

.mobile-more-sheet__site-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--a-space-4);
}

.mobile-more-sheet__site-link {
  min-height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--a-color-muted);
  font: inherit;
  font-size: var(--a-text-sm);
  font-weight: var(--a-font-weight-strong);
  cursor: pointer;
}

.mobile-more-sheet__site-link:hover,
.mobile-more-sheet__site-link:focus-visible {
  color: var(--a-color-fg);
  text-decoration: underline;
}
</style>
