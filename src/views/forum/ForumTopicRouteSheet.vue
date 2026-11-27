<template>
  <PSheet
    :show="true"
    title="话题详情"
    panel-class="forum-topic-route-sheet"
    side="right"
    mode="full"
    close-type="header"
    @close="$emit('close')"
  >
    <ForumTopicView />
  </PSheet>
</template>

<script setup lang="ts">
import PSheet from '@/components/ui/PSheet.vue'
import ForumTopicView from '@/views/forum/ForumTopicView.vue'

defineEmits<{
  (e: 'close'): void
}>()
</script>

<style scoped>
:global(.forum-topic-route-sheet.p-sheet-layer) {
  min-height: calc(100dvh - var(--a-topbar-height, 3.5rem));
  border: 0;
  box-shadow: none;
}

:global(.forum-topic-route-sheet .sheet-content) {
  padding: 0;
}

:global(.forum-topic-route-sheet .topic-page) {
  max-width: 52rem;
  margin: 0 auto;
  padding: 2rem 2rem 5rem;
}

:global(.forum-topic-route-sheet.p-sheet-mobile-page) {
  top: var(--a-topbar-height, 56px);
  bottom: var(--a-content-bottom-offset, 0px);
  padding-top: 0.75rem;
  border-left: 0;
}

:global(.forum-topic-route-sheet.p-sheet-mobile-page .p-sheet-mobile-page__header) {
  margin-bottom: 0.5rem;
}

:global(.forum-topic-route-sheet.p-sheet-mobile-page .topic-page) {
  max-width: none;
  padding: 0.5rem 1rem 5rem;
}
</style>
