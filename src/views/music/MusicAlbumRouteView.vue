<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import HomeView from '@/views/music/HomeView.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

const route = useRoute()
const { openAlbum, closeAll } = useMusicDrawers()

watch(
  () => route.params.albumId,
  (albumId) => {
    if (typeof albumId === 'string' && albumId) openAlbum(albumId)
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
