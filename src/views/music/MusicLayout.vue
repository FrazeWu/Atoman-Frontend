<template>
  <div class="a-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <AppSidebar module="music" />
    <main class="a-main-content music-main-content">
      <router-view v-slot="{ Component }">
        <KeepAlive :include="detailRouteViews">
          <component :is="Component" />
        </KeepAlive>
      </router-view>
    </main>
    <MusicSheetStack />
  </div>
</template>

<script setup lang="ts">
import AppSidebar from '@/components/system/AppSidebar.vue'
import MusicSheetStack from '@/components/music/MusicSheetStack.vue'
import { useSidebar } from '@/composables/useSidebar'
import { useMusicSheetRouteSync } from '@/composables/useMusicSheetRouteSync'
import { useRouter } from 'vue-router'

const { sidebarCollapsed } = useSidebar()
const detailRouteViews = [
  'MusicArtistRouteView',
  'MusicAlbumRouteView',
  'MusicSongRouteView',
  'MusicPlaylistRouteView',
]
useMusicSheetRouteSync(useRouter())
</script>
