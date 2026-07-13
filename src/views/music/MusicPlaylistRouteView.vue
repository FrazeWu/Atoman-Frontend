<script setup lang="ts">
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import HomeView from '@/views/music/HomeView.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { useMusicSheetRouteSync } from '@/composables/useMusicSheetRouteSync'

const route = useRoute()
const { openPlaylist } = useMusicDrawers()
const { syncEntityRoute } = useMusicSheetRouteSync(useRouter())

watch(
  () => route.params.playlistId,
  (playlistId) => {
    if (typeof playlistId === 'string' && playlistId) {
      syncEntityRoute(`playlist:${playlistId}`, () => openPlaylist(playlistId))
    }
  },
  { immediate: true },
)

</script>

<template>
  <HomeView />
</template>
