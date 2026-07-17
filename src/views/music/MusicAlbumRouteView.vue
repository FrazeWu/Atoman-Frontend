<script setup lang="ts">
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import HomeView from '@/views/music/HomeView.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { useMusicSheetRouteSync } from '@/composables/useMusicSheetRouteSync'

const route = useRoute()
const { openAlbum } = useMusicDrawers()
const { syncEntityRoute } = useMusicSheetRouteSync(useRouter())

watch(
  () => route.params.albumId,
  (albumId) => {
    if (typeof albumId === 'string' && albumId) {
      syncEntityRoute(`album:${albumId}`, () => openAlbum(albumId))
    }
  },
  { immediate: true },
)

</script>

<template>
  <HomeView />
</template>
