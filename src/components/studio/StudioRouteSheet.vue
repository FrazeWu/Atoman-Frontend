<template>
  <PSheet
    :show="true"
    :title="title"
    panel-class="studio-route-sheet"
    side="bottom"
    close-type="header"
    :show-backdrop="false"
    :teleport="false"
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
:deep(.studio-route-sheet) {
  position: relative;
  inset: auto;
  min-height: calc(100dvh - var(--a-topbar-height, 3.5rem) - 3.75rem);
  border: 0;
  box-shadow: none;
  z-index: auto;
}

:deep(.studio-route-sheet .sheet-content) {
  padding: 1.25rem clamp(1rem, 3vw, 2rem) 2rem;
}

:deep(.studio-route-sheet .sheet-content-inner) {
  width: 100%;
  max-width: none;
}
</style>
