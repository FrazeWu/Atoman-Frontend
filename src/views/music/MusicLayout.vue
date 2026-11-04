<template>
  <div class="a-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <AppSidebar module="music" />
    <main class="a-main-content music-main-content">
      <div class="a-content-frame">
        <router-view v-slot="{ Component }">
          <KeepAlive :include="detailRouteViews">
            <component :is="Component" />
          </KeepAlive>
        </router-view>
      </div>
    </main>
    <MusicSheetStack />
  </div>
</template>

<script setup lang="ts">
import AppSidebar from '@/components/system/AppSidebar.vue'
import MusicSheetStack from '@/components/music/MusicSheetStack.vue'
import { useSidebar } from '@/composables/useSidebar'
import { useMusicSheetRouteSync } from '@/composables/useMusicSheetRouteSync'
import { useRoute, useRouter } from 'vue-router'
import { watch } from 'vue'

const { sidebarCollapsed } = useSidebar()
const route = useRoute()

// Fetch the relevant detail drawer in parallel with the lazy route shell.
// Rendering and sheet ownership remain in MusicSheetStack.
watch(() => route.path, (path) => {
  if (path.startsWith('/music/album/')) {
    void import('@/components/music/AlbumDrawer.vue')
  } else if (path.startsWith('/music/artist/')) {
    void import('@/components/music/ArtistDrawer.vue')
  }
}, { immediate: true })
const detailRouteViews = [
  'MusicArtistRouteView',
  'MusicAlbumRouteView',
  'MusicSongRouteView',
  'MusicPlaylistRouteView',
]
useMusicSheetRouteSync(useRouter())
</script>
