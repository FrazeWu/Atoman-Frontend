<template>
  <component
    :is="presentation === 'page' ? 'section' : PSheet"
    :show="show"
    side="bottom"
    title="订阅"
    close-type="header"
    class="feed-mobile-sources-sheet-page"
    @close="emit('close')"
  >
    <header v-if="presentation === 'page'" class="feed-mobile-sources-sheet__header">
      <RouterLink to="/feed/subscriptions" aria-label="返回订阅"><ChevronLeft :size="20" aria-hidden="true" /></RouterLink>
      <h1>订阅</h1>
    </header>
    <div class="feed-mobile-sources-sheet" data-testid="feed-mobile-sources-sheet">
      <SubscriptionHubSidebarTree
        :tree="tree"
        :active-type="activeType"
        :active-group-id="activeGroupId"
        :active-membership-id="activeMembershipId"
        :loading="loading"
        :error="error"
        @select-context="emit('select-context', $event)"
        @manage-rss="emit('manage-rss')"
        @retry="emit('retry')"
      />
    </div>
  </component>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { IconChevronLeft as ChevronLeft } from '@tabler/icons-vue'
import SubscriptionHubSidebarTree from '@/components/feed/SubscriptionHubSidebarTree.vue'
import PSheet from '@/components/ui/PSheet.vue'
import type { SubscriptionHubTree, SubscriptionHubType } from '@/types'

const props = withDefaults(defineProps<{
  show: boolean
  tree: SubscriptionHubTree
  activeType?: SubscriptionHubType | null
  activeGroupId?: string | null
  activeMembershipId?: string | null
  loading?: boolean
  error?: string
  presentation?: 'sheet' | 'page'
}>(), {
  activeType: null,
  activeGroupId: null,
  activeMembershipId: null,
  loading: false,
  error: '',
  presentation: 'sheet',
})

const { presentation } = props

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select-context', value: { subscriptionType: SubscriptionHubType; groupId: string; membershipId?: string }): void
  (e: 'manage-rss'): void
  (e: 'retry'): void
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

.feed-mobile-sources-sheet-page :deep(.subscription-hub-sidebar) {
  padding: 0;
  background: var(--a-color-surface);
}

.feed-mobile-sources-sheet {
  padding: 0.25rem 0 0;
}

.feed-mobile-sources-sheet :deep(.subscription-hub-sidebar) {
  padding: 0;
}
</style>
