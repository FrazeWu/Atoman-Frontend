<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import HomeView from '@/views/music/HomeView.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

const route = useRoute()
const { openPlaylist, closeAll } = useMusicDrawers()

watch(
  () => route.params.playlistId,
  (playlistId) => {
    if (typeof playlistId === 'string' && playlistId) openPlaylist(playlistId)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  closeAll()
})
</script>

<template>
  <HomeView />
</template>
