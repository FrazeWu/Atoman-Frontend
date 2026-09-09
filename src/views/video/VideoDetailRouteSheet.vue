<template>
  <PSheet
    :show="true"
    title="视频详情"
    panel-class="video-detail-route-sheet"
    :side="side"
    close-type="header"
    @close="$emit('close')"
  >
    <VideoDetailView />
  </PSheet>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import PSheet from '@/components/ui/PSheet.vue'
import VideoDetailView from '@/views/video/VideoDetailView.vue'

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
:global(.video-detail-route-sheet.p-sheet-layer) {
  min-height: calc(100dvh - var(--a-topbar-height, 3.5rem) - 3.75rem);
  border: 0;
  box-shadow: none;
}

:global(.video-detail-route-sheet .sheet-content) {
  padding: 0;
}

:global(.video-detail-route-sheet .vd-page) {
  max-width: none;
}
</style>
