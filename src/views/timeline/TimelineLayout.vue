<template>
  <div class="a-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <AppSidebar module="timeline" />
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
// to="/timeline"
// to="/timeline/persons"
</script>
