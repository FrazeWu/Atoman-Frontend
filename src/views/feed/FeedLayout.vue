<template>
  <div class="a-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <PaperSidebar
      collapsible
      v-model:collapsed="sidebarCollapsed"
    >
      <PaperSidebarItem
        v-for="(item, index) in navItems"
        :key="item.to"
        :to="item.to"
        :index="index + 1"
        :icon="item.icon"
        :is-focused="uiStore.focusedSection === 'sidebar' && focusedSidebarIndex === index"
        :exact="item.exact"
      >
        {{ item.label }}
      </PaperSidebarItem>

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
    </PaperSidebar>
    <main class="a-main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { BookmarkOutline, CompassOutline, LogoRss, StarOutline } from '@vicons/ionicons5'
import FeedSidebarSources from '@/components/feed/FeedSidebarSources.vue'
import PaperSidebar from '@/components/ui/PaperSidebar.vue'
import PaperSidebarItem from '@/components/ui/PaperSidebarItem.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { useUIStore } from '@/stores/ui'
import { useKeyboardLayout } from '@/composables/useKeyboardLayout'
import { useKeyboardList } from '@/composables/useKeyboardList'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const feedStore = useFeedStore()
const uiStore = useUIStore()

// 1. Setup global area switching (H/L)
useKeyboardLayout()

const sidebarStorageKey = 'atoman.feed.sidebar.collapsed'
const sidebarCollapsed = ref(false)

const subscriptions = computed(() => feedStore.subscriptions)
const groups = computed(() => feedStore.groups)
const querySourceId = computed(() => typeof route.query.source_id === 'string' ? route.query.source_id : null)

const navItems = [
  { to: '/', label: '订阅', icon: LogoRss, exact: true },
  { to: '/explore', label: '探索', icon: CompassOutline },
  { to: '/reading-list', label: '稍后阅读', icon: BookmarkOutline },
  { to: '/starred', label: '收藏', icon: StarOutline },
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
  void router.push({ path: '/', query: { source_id: sourceId } })
}

const openManageSheet = () => {
  void router.push({ path: '/', query: { ...route.query, manage_subscriptions: '1' } })
}

watch(() => authStore.isAuthenticated, ensureSidebarSources, { immediate: true })

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

onMounted(() => {
  sidebarCollapsed.value = localStorage.getItem(sidebarStorageKey) === 'true'
})

watch(sidebarCollapsed, (collapsed) => {
  localStorage.setItem(sidebarStorageKey, String(collapsed))
})
</script>

<style scoped>
kbd {
  font-family: inherit;
  background: #fff;
  border: 1px solid var(--a-color-line-soft);
  padding: 0.1rem 0.3rem;
  border-radius: 0;
  font-weight: 900;
}
</style>
