<template>
  <div class="a-module-layout books-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <AppSidebar module="books" />
    <main class="a-main-content books-main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import AppSidebar from '@/components/system/AppSidebar.vue'
import { useSidebar } from '@/composables/useSidebar'

const { sidebarCollapsed } = useSidebar()
</script>
