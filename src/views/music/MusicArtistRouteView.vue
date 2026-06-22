<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import HomeView from '@/views/music/HomeView.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

const route = useRoute()
const { openArtist, closeAll } = useMusicDrawers()

watch(
  () => route.params.artistId,
  (artistId) => {
    if (typeof artistId === 'string' && artistId) openArtist(artistId)
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
