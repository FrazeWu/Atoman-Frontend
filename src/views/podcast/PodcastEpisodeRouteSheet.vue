<template>
  <PSheet
    :show="true"
    title="单集详情"
    panel-class="podcast-episode-route-sheet"
    side="right"
    close-type="header"
    @close="$emit('close')"
  >
    <PodcastEpisodeView />
  </PSheet>
</template>

<script setup lang="ts">
import PSheet from '@/components/ui/PSheet.vue'
import PodcastEpisodeView from '@/views/podcast/PodcastEpisodeView.vue'

defineEmits<{ close: [] }>()
</script>

<style scoped>
:global(.podcast-episode-route-sheet.p-sheet-layer) {
  min-height: calc(100dvh - var(--a-topbar-height, 3.5rem));
  border: 0;
  box-shadow: none;
}

:global(.podcast-episode-route-sheet .sheet-content) {
  padding: 0;
}

:global(.podcast-episode-route-sheet .pev-wrap) {
  max-width: 52rem;
  margin: 0 auto;
  padding: 2rem 2rem 5rem;
}

:global(.podcast-episode-route-sheet.p-sheet-mobile-page) {
  top: var(--a-topbar-height, 56px);
  bottom: var(--a-content-bottom-offset, 0px);
  padding-top: 0.75rem;
  border-left: 0;
}

:global(.podcast-episode-route-sheet.p-sheet-mobile-page .p-sheet-mobile-page__header) {
  margin-bottom: 0.5rem;
}

:global(.podcast-episode-route-sheet.p-sheet-mobile-page .pev-wrap) {
  max-width: none;
  padding: 0.5rem 1rem 5rem;
}
</style>
