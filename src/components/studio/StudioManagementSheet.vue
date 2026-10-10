<template>
  <PSheet
    :show="true"
    :title="title"
    mode="partial"
    partial-width="42rem"
    panel-class="studio-management-sheet"
    side="right"
    close-type="header"
    @close="$emit('close')"
  >
    <slot />
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </PSheet>
</template>

<script setup lang="ts">
import PSheet from '@/components/ui/PSheet.vue'

defineProps<{ title: string }>()
defineEmits<{ close: [] }>()
</script>

<style scoped>
:global(.studio-management-sheet.p-sheet-layer) {
  min-height: calc(100dvh - var(--a-topbar-height, 3.5rem));
}

:global(.studio-management-sheet .sheet-content) {
  padding: 2rem clamp(1rem, 3vw, 2rem);
}

:global(.studio-management-sheet .sheet-content-inner) {
  max-width: none;
}

:global(.studio-management-sheet .p-sheet-footer) {
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom, 0px));
}
</style>
