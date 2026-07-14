<template>
  <div class="a-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <PSidebar
      collapsible
      v-model:collapsed="sidebarCollapsed"
      storage-key="atoman.music.sidebar.collapsed"
    >
      <PSidebarItem :to="modulePathUrl('music', '/explore')" :index="1" :icon="Compass">
        探索
      </PSidebarItem>
      <PSidebarItem :to="moduleUrl('music')" :index="2" :icon="Users" exact>
        艺术家
      </PSidebarItem>
      <PSidebarItem :to="modulePathUrl('music', '/starred')" :index="3" :icon="Star">
        收藏
      </PSidebarItem>

      <template #bottom>
        <MusicSidebarPlaylists
          v-if="authStore.isAuthenticated"
          :collapsed="sidebarCollapsed"
        />
      </template>
    </PSidebar>
    <main class="a-main-content">
      <router-view />
    </main>
    <PlaylistDrawer />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Compass, Users, Star } from 'lucide-vue-next'
import PSidebar from '@/components/ui/PSidebar.vue'
import PSidebarItem from '@/components/ui/PSidebarItem.vue'
import MusicSidebarPlaylists from '@/components/music/MusicSidebarPlaylists.vue'
import PlaylistDrawer from '@/components/music/PlaylistDrawer.vue'
import { modulePathUrl, moduleUrl } from '@/router/siteUrls'
import { useAuthStore } from '@/stores/auth'

const sidebarCollapsed = ref(false)
const authStore = useAuthStore()
</script>
