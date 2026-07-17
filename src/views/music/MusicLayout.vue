<template>
  <div class="a-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <AppSidebar module="music" />
    <main class="a-main-content music-main-content">
      <router-view />
    </main>
    <MusicSheetStack />
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import AppSidebar from '@/components/system/AppSidebar.vue'
import { useSidebar } from '@/composables/useSidebar'

const MusicSheetStack = defineAsyncComponent(() => import('@/components/music/MusicSheetStack.vue'))
const { sidebarCollapsed } = useSidebar()
</script>
