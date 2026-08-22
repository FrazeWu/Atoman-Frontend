<template>
  <PSheet
    :show="true"
    :title="title"
    panel-class="studio-route-sheet"
    :side="side"
    close-type="header"
    above-player
    @close="$emit('close')"
  >
    <slot />
  </PSheet>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import PSheet from '@/components/ui/PSheet.vue'

defineProps<{ title: string }>()
defineEmits<{ close: [] }>()

const isMobileViewport = ref(false)
const side = computed<'right' | 'bottom'>(() => (isMobileViewport.value ? 'bottom' : 'right'))
let mobileViewportQuery: MediaQueryList | null = null

function syncViewport(event?: MediaQueryListEvent) {
  isMobileViewport.value = event?.matches ?? mobileViewportQuery?.matches ?? false
}

onMounted(() => {
  mobileViewportQuery = window.matchMedia?.('(max-width: 767px)') ?? null
  syncViewport()
  mobileViewportQuery?.addEventListener?.('change', syncViewport)
})

onBeforeUnmount(() => {
  mobileViewportQuery?.removeEventListener?.('change', syncViewport)
})
</script>

<style scoped>
:global(.studio-route-sheet.p-sheet-layer) {
  min-height: calc(100dvh - var(--a-topbar-height, 3.5rem) - 3.75rem);
  border: 0;
  box-shadow: none;
}

:global(.studio-route-sheet .sheet-content) {
  padding: 1.25rem clamp(1rem, 3vw, 2rem) 2rem;
}

:global(.studio-route-sheet .sheet-content-inner) {
  width: 100%;
  max-width: none;
}
</style>
