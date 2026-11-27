<template>
  <PSheet
    :show="true"
    title="视频详情"
    panel-class="video-detail-route-sheet"
    side="right"
    close-type="header"
    @close="$emit('close')"
  >
    <VideoDetailView />
  </PSheet>
</template>

<script setup lang="ts">
import PSheet from '@/components/ui/PSheet.vue'
import VideoDetailView from '@/views/video/VideoDetailView.vue'

defineEmits<{ close: [] }>()
</script>

<style scoped>
:global(.video-detail-route-sheet.p-sheet-layer) {
  min-height: calc(100dvh - var(--a-topbar-height, 3.5rem));
  border: 0;
  box-shadow: none;
}

:global(.video-detail-route-sheet .sheet-content) {
  padding: 0;
}

:global(.video-detail-route-sheet .vd-page) {
  max-width: var(--a-content-max-width, 72rem);
  margin: 0 auto;
  padding: 1.75rem 2rem 5rem;
}

:global(.video-detail-route-sheet.p-sheet-mobile-page) {
  top: var(--a-topbar-height, 56px);
  bottom: var(--a-content-bottom-offset, 0px);
  padding-top: 0.75rem;
  border-left: 0;
}

:global(.video-detail-route-sheet.p-sheet-mobile-page .p-sheet-mobile-page__header) {
  margin-bottom: 0.5rem;
}

:global(.video-detail-route-sheet.p-sheet-mobile-page .vd-page) {
  max-width: none;
  padding: 0.5rem 1rem 5rem;
}
</style>
