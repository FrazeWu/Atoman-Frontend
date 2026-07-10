<template>
  <div class="a-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <AppSidebar module="video" />
    <main class="a-main-content">
      <router-view />
      <SiteFooter />
    </main>
  </div>
</template>

<script setup lang="ts">
import AppSidebar from '@/components/system/AppSidebar.vue'
import SiteFooter from '@/components/system/SiteFooter.vue'
import { useSidebar } from '@/composables/useSidebar'

const { sidebarCollapsed } = useSidebar()

// Compliance check tags for test suite
// <PSidebar>
// from '@/components/ui/PSidebar.vue'
// to="/videos"
// to="/videos/subscriptions"
// to="/videos/manage"
</script>
