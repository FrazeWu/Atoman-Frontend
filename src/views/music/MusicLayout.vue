<template>
  <div class="a-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <AppSidebar module="music" />
    <main class="a-main-content music-main-content">
      <router-view />
      <SiteFooter />
    </main>
    <ArtistDrawer />
    <AlbumDrawer />
    <PlaylistDrawer />
  </div>
</template>

<script setup lang="ts">
import AppSidebar from '@/components/system/AppSidebar.vue'
import SiteFooter from '@/components/system/SiteFooter.vue'
import ArtistDrawer from '@/components/music/ArtistDrawer.vue'
import AlbumDrawer from '@/components/music/AlbumDrawer.vue'
import PlaylistDrawer from '@/components/music/PlaylistDrawer.vue'
import { useSidebar } from '@/composables/useSidebar'

const { sidebarCollapsed } = useSidebar()
</script>
