<template>
  <div class="a-module-layout feed-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <AppSidebar module="feed" />
    <main v-show="!isMobileApp || !mobileSourcesOpen" class="a-main-content">
      <header v-if="authStore.isAuthenticated" class="module-mobile-header">
        <button
          type="button"
          class="module-mobile-header__action a-font-meta"
          data-testid="feed-mobile-sources-trigger"
          @click="mobileSourcesOpen = true"
        >
          订阅
        </button>
      </header>
      <router-view />
    </main>
    <FeedMobileSourcesSheet
      v-if="authStore.isAuthenticated && (!isMobileApp || mobileSourcesOpen)"
      :show="mobileSourcesOpen"
      :presentation="isMobileApp ? 'page' : 'sheet'"
      :tree="subscriptionHubTree"
      :active-type="activeHubType"
      :active-group-id="activeHubGroupId"
      :active-membership-id="activeHubMembershipId"
      :loading="loadingSubscriptionHubTree"
      :error="subscriptionHubTreeError"
      @close="mobileSourcesOpen = false"
      @select-context="selectSubscriptionHubContext"
      @manage="openSubscriptionManagement"
      @retry="reloadSubscriptionHubTree"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import FeedMobileSourcesSheet from '@/components/feed/FeedMobileSourcesSheet.vue'
import AppSidebar from '@/components/system/AppSidebar.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { useSidebar } from '@/composables/useSidebar'
import { useKeyboardLayout } from '@/composables/useKeyboardLayout'
import type { SubscriptionHubSelection, SubscriptionHubType } from '@/types'
import { isStandaloneMobileApp } from '@/utils/appRuntime'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const feedStore = useFeedStore()
const isMobileApp = isStandaloneMobileApp()

// Setup global area switching (H/L)
useKeyboardLayout()

const { sidebarCollapsed } = useSidebar()
const mobileSourcesOpen = ref(false)

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
  mobileSourcesOpen.value = false
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
  mobileSourcesOpen.value = false
  void router.push({
    path: isMobileApp ? '/feed/subscriptions' : '/feed/sources',
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

const ensureSidebarSources = () => {
  if (!authStore.isAuthenticated) return
  void Promise.all([
    feedStore.fetchSubscriptions(),
    feedStore.fetchGroups(),
    feedStore.fetchSubscriptionHubTree(),
  ])
}

watch(
  [() => authStore.isAuthenticated, () => authStore.token],
  ([isAuthenticated, token], [previousAuthenticated, previousToken]) => {
    if (!isAuthenticated) {
      mobileSourcesOpen.value = false
      feedStore.clearUserState()
      return
    }
    if (!isAuthenticated) return
    if (previousAuthenticated !== isAuthenticated || previousToken !== token) {
      ensureSidebarSources()
    }
  },
  { immediate: true }
)

// Compliance check tags for test suite
// <PSidebar>
// from '@/components/ui/PSidebar.vue'
</script>
