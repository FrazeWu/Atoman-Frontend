<template>
  <div class="a-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <AppSidebar module="forum" />
    <main class="a-main-content">
      <div class="a-content-frame">
        <router-view />
      </div>
    </main>
    <RouterView name="overlay" v-slot="{ Component }">
      <component :is="Component" v-if="Component" @close="closeTopicOverlay" />
    </RouterView>
  </div>
</template>

<script setup lang="ts">
import { RouterView, useRouter } from 'vue-router'
import AppSidebar from '@/components/system/AppSidebar.vue'
import { useSidebar } from '@/composables/useSidebar'

const { sidebarCollapsed } = useSidebar()
const router = useRouter()

function closeTopicOverlay() {
  if (typeof window !== 'undefined' && window.history.length > 1 && window.history.state?.back) {
    router.back()
    return
  }
  void router.replace('/forum')
}
</script>
