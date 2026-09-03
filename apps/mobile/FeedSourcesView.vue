<template>
  <main class="feed-sources-view a-page-md">
    <FeedMobileSourcesSheet
      :show="true"
      presentation="page"
      :tree="subscriptionHubTree"
      :active-type="activeHubType"
      :active-group-id="activeHubGroupId"
      :active-membership-id="activeHubMembershipId"
      :loading="loadingSubscriptionHubTree"
      :error="subscriptionHubTreeError"
      @close="router.push('/feed/subscriptions')"
      @select-context="selectSubscriptionHubContext"
      @manage="openSubscriptionManagement"
      @retry="reloadSubscriptionHubTree"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import FeedMobileSourcesSheet from '@/components/feed/FeedMobileSourcesSheet.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import type { SubscriptionHubSelection, SubscriptionHubType } from '@/types'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const feedStore = useFeedStore()

const subscriptionHubTree = computed(() => feedStore.subscriptionHubTree)
const loadingSubscriptionHubTree = computed(() => feedStore.loadingSubscriptionHubTree)
const subscriptionHubTreeError = computed(() => feedStore.subscriptionHubTreeError)

const isSubscriptionHubType = (value: unknown): value is SubscriptionHubType =>
  value === 'podcast' || value === 'video' || value === 'blog' || value === 'rss'

const activeHubType = computed<SubscriptionHubType | null>(() =>
  isSubscriptionHubType(route.query.hub_type) ? route.query.hub_type : null,
)
const activeHubGroupId = computed(() => typeof route.query.hub_group_id === 'string' ? route.query.hub_group_id : null)
const activeHubMembershipId = computed(() => typeof route.query.hub_membership_id === 'string' ? route.query.hub_membership_id : null)

const selectSubscriptionHubContext = (selection: SubscriptionHubSelection) => {
  void router.push({
    path: '/feed/subscriptions',
    query: {
      ...route.query,
      source_id: undefined,
      group_id: undefined,
      hub_type: selection.subscriptionType,
      hub_group_id: selection.groupId,
      hub_membership_id: selection.membershipId,
      q: undefined,
      sort: undefined,
      merge_duplicates: undefined,
      page: undefined,
    },
  })
}

const openSubscriptionManagement = () => {
  void router.push({
    path: '/feed/subscriptions',
    query: {
      ...route.query,
      hub_type: undefined,
      hub_group_id: undefined,
      hub_membership_id: undefined,
      manage_subscriptions: '1',
      manage_tab: 'sources',
    },
  })
}

const reloadSubscriptionHubTree = () => {
  void feedStore.fetchSubscriptionHubTree()
}

onMounted(() => {
  if (authStore.isAuthenticated) void feedStore.fetchSubscriptionHubTree()
})
</script>

<style scoped>
.feed-sources-view {
  padding-top: 0.5rem;
  padding-bottom: 2rem;
}
</style>
