<script setup lang="ts">
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import HomeView from '@/views/music/HomeView.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { useMusicSheetRouteSync } from '@/composables/useMusicSheetRouteSync'

const route = useRoute()
const { openArtist } = useMusicDrawers()
const { syncEntityRoute } = useMusicSheetRouteSync(useRouter())

watch(
  () => route.params.artistId,
  (artistId) => {
    if (typeof artistId === 'string' && artistId) {
      syncEntityRoute(`artist:${artistId}`, () => openArtist(artistId))
    }
  },
  { immediate: true },
)

</script>

<template>
  <HomeView />
</template>
