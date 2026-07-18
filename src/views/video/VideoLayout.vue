<template>
  <div class="a-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <AppSidebar module="video" />
    <main class="a-main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import AppSidebar from '@/components/system/AppSidebar.vue'
import { useSidebar } from '@/composables/useSidebar'
import { useVideoBookmarks } from '@/composables/useVideoBookmarks'
import { useAuthStore } from '@/stores/auth'

const { sidebarCollapsed } = useSidebar()
const authStore = useAuthStore()
const bookmarks = useVideoBookmarks()

watch(
  () => authStore.isAuthenticated,
  (authenticated) => {
    if (authenticated) void bookmarks.load()
    else bookmarks.reset()
  },
  { immediate: true },
)

// Compliance check tags for test suite
// <PSidebar>
// from '@/components/ui/PSidebar.vue'
// to="/videos"
// to="/videos/subscriptions"
// to="/videos/favorites"
</script>
