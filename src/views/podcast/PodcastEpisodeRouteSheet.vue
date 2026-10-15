<template>
  <PSheet
    :show="true"
    title="单集详情"
    panel-class="podcast-episode-route-sheet"
    :side="side"
    close-type="header"
    @close="$emit('close')"
  >
    <PodcastEpisodeView />
  </PSheet>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import PSheet from '@/components/ui/PSheet.vue'
import PodcastEpisodeView from '@/views/podcast/PodcastEpisodeView.vue'

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
:global(.podcast-episode-route-sheet.p-sheet-layer) {
  min-height: calc(100dvh - var(--a-topbar-height, 3.5rem) - 3.75rem);
  border: 0;
  box-shadow: none;
}

:global(.podcast-episode-route-sheet .sheet-content) {
  padding: 0;
}

:global(.podcast-episode-route-sheet .pev-wrap) {
  max-width: none;
  padding: 1.5rem;
}
</style>
