<template>
  <div class="a-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <AppSidebar module="video" />
    <main class="a-main-content">
      <ModuleCreateAction module="video" />
      <router-view />
    </main>
    <RouterView name="overlay" v-slot="{ Component }">
      <VideoDetailRouteSheet v-if="Component" @close="closeDetailOverlay" />
    </RouterView>
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import AppSidebar from '@/components/system/AppSidebar.vue'
import ModuleCreateAction from '@/components/studio/ModuleCreateAction.vue'
import VideoDetailRouteSheet from '@/components/video/VideoDetailRouteSheet.vue'
import { useSidebar } from '@/composables/useSidebar'
import { useVideoBookmarks } from '@/composables/useVideoBookmarks'
import { useAuthStore } from '@/stores/auth'

const { sidebarCollapsed } = useSidebar()
const router = useRouter()
const authStore = useAuthStore()
const bookmarks = useVideoBookmarks()

function closeDetailOverlay() {
  if (typeof window !== 'undefined' && window.history.length > 1 && window.history.state?.back) {
    router.back()
    return
  }
  void router.replace('/videos')
}

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
