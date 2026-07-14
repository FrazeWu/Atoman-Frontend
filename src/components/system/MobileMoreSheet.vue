<template>
  <PSheet
    :show="show"
    side="bottom"
    title="更多"
    close-type="header"
    @close="$emit('close')"
  >
    <div class="mobile-more-sheet" data-testid="mobile-more-sheet">
      <nav class="mobile-more-sheet__grid" aria-label="更多模块">
        <a
          v-for="item in items"
          :key="item.module"
          :href="item.href"
          class="mobile-more-sheet__item"
        >
          <span class="mobile-more-sheet__item-label">{{ item.label }}</span>
        </a>
      </nav>
    </div>
  </PSheet>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PSheet from '@/components/ui/PSheet.vue'
import { getMobileMoreItems } from '@/composables/useResponsiveShell'

defineProps<{
  show: boolean
}>()

defineEmits<{
  close: []
}>()

const items = computed(() => getMobileMoreItems())
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
  font-weight: 900;
  letter-spacing: 0.18em;
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
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  text-decoration: none;
}

.mobile-more-sheet__item-label {
  font-weight: 900;
  letter-spacing: -0.02em;
}

.mobile-more-sheet__item-helper {
  color: var(--a-color-muted);
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.14em;
}
</style>
