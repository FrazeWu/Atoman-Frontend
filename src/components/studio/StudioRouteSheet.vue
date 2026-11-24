<template>
  <PSheet
    :show="true"
    :title="title"
    panel-class="studio-route-sheet"
    :side="side"
    close-type="header"
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
  min-height: calc(100dvh - var(--a-topbar-height, 3.5rem));
  border-left: 1px solid var(--a-color-border-soft);
  border-top: 1px solid var(--a-color-border-soft);
  box-shadow: -4px 0 16px rgba(0, 0, 0, 0.04);
}

:global(.studio-route-sheet .sheet-content),
:global(.studio-route-sheet.is-right .sheet-content--has-bookmark-close),
:global(.studio-route-sheet.p-sheet-panel .sheet-content) {
  padding: 0 !important;
  padding-left: 36px !important;
  height: 100% !important;
}

:global(.studio-route-sheet .sheet-content-inner) {
  width: 100% !important;
  max-width: none !important;
  height: 100% !important;
}
</style>
