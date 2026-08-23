<template>
  <component
    :is="presentation === 'page' ? 'section' : PSheet"
    :show="show"
    side="bottom"
    title="来源"
    close-type="header"
    class="feed-mobile-sources-sheet-page"
    @close="emit('close')"
  >
    <header v-if="presentation === 'page'" class="feed-mobile-sources-sheet__header">
      <RouterLink to="/feed" aria-label="返回 Feed"><ChevronLeft :size="20" aria-hidden="true" /></RouterLink>
      <h1>来源</h1>
    </header>
    <div class="feed-mobile-sources-sheet" data-testid="feed-mobile-sources-sheet">
      <FeedSidebarSources
        :subscriptions="subscriptions"
        :groups="groups"
        :active-source-id="activeSourceId"
        :unread-counts="unreadCounts"
        @select-source="emit('select-source', $event)"
        @select-all="emit('select-all')"
        @manage="emit('manage')"
      />
    </div>
  </component>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ChevronLeft } from 'lucide-vue-next'
import FeedSidebarSources from '@/components/feed/FeedSidebarSources.vue'
import PSheet from '@/components/ui/PSheet.vue'
import type { Subscription, SubscriptionGroup } from '@/types'

const props = withDefaults(defineProps<{
  show: boolean
  subscriptions: Subscription[]
  groups: SubscriptionGroup[]
  activeSourceId?: string | null
  unreadCounts?: Record<string, number>
  presentation?: 'sheet' | 'page'
}>(), {
  unreadCounts: () => ({}),
  presentation: 'sheet',
})

const { presentation } = props

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select-source', sourceId: string): void
  (e: 'select-all'): void
  (e: 'manage'): void
}>()
</script>

<style scoped>
.feed-mobile-sources-sheet__header {
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.feed-mobile-sources-sheet__header a {
  display: inline-grid;
  width: 44px;
  height: 44px;
  place-items: center;
  color: var(--a-color-primary);
  text-decoration: none;
}

.feed-mobile-sources-sheet__header h1 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 650;
}

.feed-mobile-sources-sheet-page {
  display: block;
}

.feed-mobile-sources-sheet-page :deep(.feed-sidebar-sources) {
  border: 1px solid var(--a-color-border-soft);
  border-radius: 8px;
  background: var(--a-color-surface);
}

.feed-mobile-sources-sheet {
  padding: 0.25rem 0 0;
}

.feed-mobile-sources-sheet :deep(.feed-sidebar-sources) {
  padding: 0;
}
</style>
