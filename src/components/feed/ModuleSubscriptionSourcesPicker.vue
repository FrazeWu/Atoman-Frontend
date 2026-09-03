<template>
  <template v-if="visible">
    <header class="module-mobile-header module-subscription-picker">
      <span class="module-subscription-picker__context a-font-meta">{{ contextLabel }}</span>
      <button
        type="button"
        class="module-mobile-header__action module-subscription-picker__trigger"
        data-testid="module-subscription-sources-trigger"
        @click="open = true"
      >
        <Filter :size="15" aria-hidden="true" />
        <span>来源</span>
      </button>
    </header>

    <FeedMobileSourcesSheet
      v-if="open"
      :show="open"
      :tree="feedStore.subscriptionHubTree"
      :active-type="subscriptionType"
      :active-group-id="groupId"
      :active-membership-id="membershipId"
      :fixed-type="subscriptionType"
      :loading="feedStore.loadingSubscriptionHubTree"
      :error="feedStore.subscriptionHubTreeError"
      @close="open = false"
      @select-context="selectContext"
      @manage="openManagement"
      @retry="feedStore.fetchSubscriptionHubTree()"
    />
  </template>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { IconFilter as Filter } from '@tabler/icons-vue'

import FeedMobileSourcesSheet from '@/components/feed/FeedMobileSourcesSheet.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import type { SubscriptionHubSelection, SubscriptionHubType } from '@/types'

const props = defineProps<{
  subscriptionType: SubscriptionHubType
  subscriptionPath: string
}>()

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const feedStore = useFeedStore()
const open = ref(false)
const visible = computed(() => authStore.isAuthenticated && route.path === props.subscriptionPath)
const groupId = computed(() => typeof route.query.hub_group_id === 'string' ? route.query.hub_group_id : null)
const membershipId = computed(() => typeof route.query.hub_membership_id === 'string' ? route.query.hub_membership_id : null)
const typeNode = computed(() => feedStore.subscriptionHubTree.types.find(
  (node) => node.subscription_type === props.subscriptionType,
))
const contextLabel = computed(() => {
  if (membershipId.value) {
    for (const group of typeNode.value?.groups ?? []) {
      const membership = group.memberships.find((item) => item.id === membershipId.value)
      if (membership) return membership.title || membership.feed_source?.title || '当前来源'
    }
  }
  if (groupId.value) {
    return typeNode.value?.groups.find((group) => group.id === groupId.value)?.name || '当前分组'
  }
  return '全部来源'
})

watch(
  [() => authStore.isAuthenticated, () => authStore.token],
  ([isAuthenticated]) => {
    if (!isAuthenticated || feedStore.loadingSubscriptionHubTree || feedStore.subscriptionHubTree.types.length) return
    void feedStore.fetchSubscriptionHubTree()
  },
  { immediate: true },
)

const selectContext = (selection: SubscriptionHubSelection) => {
  open.value = false
  void router.push({
    path: props.subscriptionPath,
    query: {
      ...route.query,
      hub_group_id: selection.groupId,
      hub_membership_id: selection.membershipId,
    },
  })
}

const openManagement = () => {
  open.value = false
  void router.push({
    path: '/feed/sources',
    query: {
      manage_subscriptions: '1',
      manage_tab: 'sources',
    },
  })
}
</script>

<style scoped>
.module-subscription-picker__context {
  min-width: 0;
  overflow: hidden;
  color: var(--a-color-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.module-subscription-picker__trigger {
  display: inline-flex;
  min-height: 2.75rem;
  align-items: center;
  gap: 0.35rem;
}
</style>
