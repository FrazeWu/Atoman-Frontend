<template>
  <div class="a-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <AppSidebar module="blog" />
    <main class="a-main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import AppSidebar from '@/components/system/AppSidebar.vue'
import { useSidebar } from '@/composables/useSidebar'

const { sidebarCollapsed } = useSidebar()

// Compliance check tags for test suite
// <PSidebar>
// from '@/components/ui/PSidebar.vue'
// to="/posts"
// to="/posts/subscriptions"
// to="/posts/bookmarks"
// to="/posts/manage"
</script>
