<template>
  <PSheet
    :show="show"
    side="bottom"
    title="来源"
    close-type="header"
    @close="emit('close')"
  >
    <div class="feed-mobile-sources-sheet" data-testid="feed-mobile-sources-sheet">
      <FeedSidebarSources
        :subscriptions="subscriptions"
        :groups="groups"
        :active-source-id="activeSourceId"
        @select-source="emit('select-source', $event)"
        @manage="emit('manage')"
      />
    </div>
  </PSheet>
</template>

<script setup lang="ts">
import FeedSidebarSources from '@/components/feed/FeedSidebarSources.vue'
import PSheet from '@/components/ui/PSheet.vue'
import type { Subscription, SubscriptionGroup } from '@/types'

defineProps<{
  show: boolean
  subscriptions: Subscription[]
  groups: SubscriptionGroup[]
  activeSourceId?: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select-source', sourceId: string): void
  (e: 'manage'): void
}>()
</script>

<style scoped>
.feed-mobile-sources-sheet {
  padding: 0.25rem 0 0;
}

.feed-mobile-sources-sheet :deep(.feed-sidebar-sources) {
  padding: 0;
}
</style>
