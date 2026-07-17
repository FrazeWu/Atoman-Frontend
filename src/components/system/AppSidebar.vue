<template>
  <PSidebar aria-label="音乐导航">
    <PSidebarItem
      v-for="(item, index) in musicNavItems"
      :key="item.to"
      :to="item.to"
      :index="index + 1"
      :icon="item.icon"
      :exact="item.exact"
    >
      {{ item.label }}
    </PSidebarItem>

    <template #bottom>
      <PSidebarItem
        v-if="authStore.isAuthenticated"
        :to="modulePathUrl('music', '/history')"
        :icon="History"
        data-testid="music-history-link"
      >
        播放历史
      </PSidebarItem>
      <MusicSidebarPlaylists
        v-if="authStore.isAuthenticated"
        :collapsed="sidebarCollapsed"
      />
    </template>
  </PSidebar>
</template>

<script setup lang="ts">
import { Compass, Disc3, History, Star, Users } from 'lucide-vue-next'
import PSidebar from '@/components/ui/PSidebar.vue'
import PSidebarItem from '@/components/ui/PSidebarItem.vue'
import MusicSidebarPlaylists from '@/components/music/MusicSidebarPlaylists.vue'
import { useSidebar } from '@/composables/useSidebar'
import { useAuthStore } from '@/stores/auth'
import { modulePathUrl, moduleUrl } from '@/router/siteUrls'

defineProps<{ module?: string }>()

const authStore = useAuthStore()
const { sidebarCollapsed } = useSidebar()

const musicNavItems = [
  { to: modulePathUrl('music', '/discover'), label: '发现', icon: Compass },
  { to: moduleUrl('music'), label: '专辑', icon: Disc3, exact: true },
  { to: modulePathUrl('music', '/artists'), label: '艺人', icon: Users },
  { to: modulePathUrl('music', '/starred'), label: '收藏', icon: Star },
]
</script>
