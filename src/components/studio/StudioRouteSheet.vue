<template>
  <PSheet
    :show="true"
    :title="title"
    panel-class="studio-route-sheet"
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
:deep(.studio-route-sheet .sheet-content) {
  padding: 1.25rem clamp(1rem, 3vw, 2rem) 2rem;
}

:deep(.studio-route-sheet .sheet-content-inner) {
  width: 100%;
  max-width: none;
}
</style>
