<template>
  <main class="feed-sources-view a-page-md">
    <FeedMobileSourcesSheet
      :show="true"
      presentation="page"
      :subscriptions="subscriptions"
      :groups="groups"
      :active-source-id="activeSourceId"
      :unread-counts="unreadCounts"
      @close="router.push('/feed')"
      @select-source="selectSource"
      @select-all="selectAll"
      @manage="openManage"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FeedMobileSourcesSheet from '@/components/feed/FeedMobileSourcesSheet.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { findSubscriptionByTimelineItem } from '@/utils/feedSubscriptions'
import type { TimelineItem } from '@/types'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const feedStore = useFeedStore()
const subscriptions = computed(() => feedStore.subscriptions)
const groups = computed(() => feedStore.groups)
const activeSourceId = computed(() => typeof route.query.source_id === 'string' ? route.query.source_id : null)
const unreadCounts = computed(() => {
  const counts: Record<string, number> = {}
  const hasServerCounts = subscriptions.value.some((subscription) => typeof subscription.unread_count === 'number')
  if (hasServerCounts) {
    subscriptions.value.forEach((subscription) => {
      if (typeof subscription.unread_count === 'number') counts[subscription.id] = subscription.unread_count
    })
    return counts
  }
  feedStore.timeline.forEach((item: TimelineItem) => {
    if (item.is_read) return
    const subscription = findSubscriptionByTimelineItem(item, subscriptions.value)
    if (subscription) counts[subscription.id] = (counts[subscription.id] || 0) + 1
  })
  return counts
})

function selectSource(sourceId: string) {
  void router.push({ path: '/feed', query: { source_id: sourceId } })
}

function selectAll() {
  void router.push('/feed')
}

function openManage() {
  void router.push({ path: '/feed/subscriptions', query: { manage_subscriptions: '1', manage_tab: 'groups' } })
}

onMounted(() => {
  if (authStore.isAuthenticated) void Promise.all([feedStore.fetchSubscriptions(), feedStore.fetchGroups()])
})
</script>

<style scoped>
.feed-sources-view {
  padding-top: 0.5rem;
  padding-bottom: 2rem;
}
</style>
