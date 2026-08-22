<template>
  <PSheet
    :show="true"
    :title="title"
    panel-class="studio-route-sheet"
    side="bottom"
    close-type="header"
    :show-backdrop="false"
    :teleport="false"
    :focus-on-open="false"
    above-player
    @close="$emit('close')"
  >
    <slot />
  </PSheet>
</template>

<script setup lang="ts">
import PSheet from '@/components/ui/PSheet.vue'

defineProps<{ title: string }>()
defineEmits<{ close: [] }>()
</script>

<style scoped>
:global(.studio-route-sheet.p-sheet-layer) {
  position: relative !important;
  inset: auto !important;
  min-height: calc(100dvh - var(--a-topbar-height, 3.5rem) - 3.75rem);
  border: 0;
  box-shadow: none;
  z-index: auto !important;
}

:global(.studio-route-sheet .sheet-content) {
  padding: 1.25rem clamp(1rem, 3vw, 2rem) 2rem;
}

:global(.studio-route-sheet .sheet-content-inner) {
  width: 100%;
  max-width: none;
}
</style>
