<template>
  <div class="a-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <PSidebar
      collapsible
      v-model:collapsed="sidebarCollapsed"
      storage-key="atoman.music.sidebar.collapsed"
    >
      <PSidebarItem :to="modulePathUrl('music', '/discover')" :index="1" :icon="Compass">
        发现
      </PSidebarItem>
      <PSidebarItem :to="moduleUrl('music')" :index="2" :icon="Disc3" exact>
        专辑
      </PSidebarItem>
      <PSidebarItem :to="modulePathUrl('music', '/artists')" :index="3" :icon="Users">
        艺人
      </PSidebarItem>
      <PSidebarItem :to="modulePathUrl('music', '/starred')" :index="4" :icon="Star">
        收藏
      </PSidebarItem>

      <template #bottom>
        <MusicSidebarPlaylists
          :collapsed="sidebarCollapsed"
        />
      </template>
    </PSidebar>
    <main class="a-main-content music-main-content">
      <router-view />
    </main>
    <ArtistDrawer />
    <AlbumDrawer />
    <PlaylistDrawer />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Compass, Disc3, Users, Star } from 'lucide-vue-next'
import PSidebar from '@/components/ui/PSidebar.vue'
import PSidebarItem from '@/components/ui/PSidebarItem.vue'
import MusicSidebarPlaylists from '@/components/music/MusicSidebarPlaylists.vue'
import ArtistDrawer from '@/components/music/ArtistDrawer.vue'
import AlbumDrawer from '@/components/music/AlbumDrawer.vue'
import PlaylistDrawer from '@/components/music/PlaylistDrawer.vue'
import { modulePathUrl, moduleUrl } from '@/router/siteUrls'

const sidebarCollapsed = ref(false)
</script>

<style scoped>
.music-main-content {
  position: static;
  top: auto;
  height: auto;
  overflow-y: visible;
}
</style>
