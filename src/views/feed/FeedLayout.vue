<template>
  <div class="a-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <PSidebar
      collapsible
      v-model:collapsed="sidebarCollapsed"
      storage-key="atoman.feed.sidebar.collapsed"
    >
      <PSidebarItem
        v-for="(item, index) in navItems"
        :key="item.to"
        :to="item.to"
        :index="index + 1"
        :icon="item.icon"
        :is-focused="uiStore.focusedSection === 'sidebar' && focusedSidebarIndex === index"
        :exact="item.exact"
      >
        {{ item.label }}
      </PSidebarItem>

      <template #bottom>
        <FeedSidebarSources
          v-if="authStore.isAuthenticated"
          :subscriptions="subscriptions"
          :groups="groups"
          :active-source-id="querySourceId"
          :collapsed="sidebarCollapsed"
          @select-source="selectSource"
          @manage="openManageSheet"
        />
      </template>
    </PSidebar>
    <main class="a-main-content">
      <header v-if="authStore.isAuthenticated" class="module-mobile-header">
        <button
          v-if="authStore.isAuthenticated"
          type="button"
          class="module-mobile-header__action a-font-meta"
          data-testid="feed-mobile-sources-trigger"
          @click="mobileSourcesOpen = true"
        >
          来源
        </button>
      </header>
      <router-view />
    </main>
    <FeedMobileSourcesSheet
      v-if="authStore.isAuthenticated"
      :show="mobileSourcesOpen"
      :subscriptions="subscriptions"
      :groups="groups"
      :active-source-id="querySourceId"
      @close="mobileSourcesOpen = false"
      @select-source="selectSource"
      @manage="openManageSheet"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Bookmark, Compass, Rss, Star } from 'lucide-vue-next'
import FeedMobileSourcesSheet from '@/components/feed/FeedMobileSourcesSheet.vue'
import FeedSidebarSources from '@/components/feed/FeedSidebarSources.vue'
import PSidebar from '@/components/ui/PSidebar.vue'
import PSidebarItem from '@/components/ui/PSidebarItem.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { useUIStore } from '@/stores/ui'
import { useKeyboardLayout } from '@/composables/useKeyboardLayout'
import { useKeyboardList } from '@/composables/useKeyboardList'
import { modulePathUrl, moduleUrl } from '@/router/siteUrls'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const feedStore = useFeedStore()
const uiStore = useUIStore()

// 1. Setup global area switching (H/L)
useKeyboardLayout()

const sidebarCollapsed = ref(false)
const mobileSourcesOpen = ref(false)

const subscriptions = computed(() => feedStore.subscriptions)
const groups = computed(() => feedStore.groups)
const querySourceId = computed(() => typeof route.query.source_id === 'string' ? route.query.source_id : null)

const navItems = [
  { to: moduleUrl('feed'), label: '订阅', icon: Rss, exact: true },
  { to: modulePathUrl('feed', '/explore'), label: '探索', icon: Compass },
  { to: modulePathUrl('feed', '/reading-list'), label: '稍后阅读', icon: Bookmark },
  { to: modulePathUrl('feed', '/starred'), label: '收藏', icon: Star },
]

// 2. Setup sidebar list navigation (J/K)
const { focusedIndex: focusedSidebarIndex } = useKeyboardList({
  items: ref(navItems),
  section: 'sidebar'
})

const syncSidebarFocus = () => {
  const currentIndex = navItems.findIndex(item =>
    item.exact ? route.path === item.to : route.path.startsWith(item.to as string)
  )
  if (currentIndex !== -1) {
    focusedSidebarIndex.value = currentIndex
  }
}

const ensureSidebarSources = () => {
  if (!authStore.isAuthenticated) return
  void Promise.all([feedStore.fetchSubscriptions(), feedStore.fetchGroups()])
}

const selectSource = (sourceId: string) => {
  mobileSourcesOpen.value = false
  void router.push({ path: moduleUrl('feed'), query: { source_id: sourceId } })
}

const openManageSheet = () => {
  mobileSourcesOpen.value = false
  void router.push({ path: moduleUrl('feed'), query: { ...route.query, manage_subscriptions: '1' } })
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
  { immediate: true },
)

// Sync focus when section switches to sidebar
watch(() => uiStore.focusedSection, (section) => {
  if (section === 'sidebar') {
    syncSidebarFocus()
  }
})

// Sync focusedSidebarIndex to current route on mount
onMounted(() => {
  syncSidebarFocus()
})

// Auto-navigate when sidebar focus moves
watch(focusedSidebarIndex, (newIndex) => {
  if (uiStore.focusedSection === 'sidebar' && navItems[newIndex]) {
    router.push(navItems[newIndex].to)
  }
})

</script>

<style scoped>
.module-mobile-header {
  display: none;
}

@media (max-width: 767px) {
  .module-mobile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .module-mobile-header__action {
    border: 1px solid var(--a-color-line-soft);
    padding: 0.45rem 0.75rem;
    background: var(--a-color-bg);
    color: var(--a-color-fg);
    font-size: 0.7rem;
    letter-spacing: 0.12em;
    cursor: pointer;
  }
}

kbd {
  font-family: inherit;
  background: #fff;
  border: 1px solid var(--a-color-line-soft);
  padding: 0.1rem 0.3rem;
  border-radius: 0;
  font-weight: 900;
}
</style>
