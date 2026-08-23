<script setup lang="ts">
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AlbumsView from '@/views/music/AlbumsView.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { useMusicSheetRouteSync } from '@/composables/useMusicSheetRouteSync'
import { isStandaloneMobileApp } from '@/utils/appRuntime'

const isMobileApp = isStandaloneMobileApp()

const route = useRoute()
const { openSong } = useMusicDrawers()
const { syncEntityRoute } = useMusicSheetRouteSync(useRouter())

watch(
  () => route.params.songId,
  (songId) => {
    if (typeof songId === 'string' && songId) {
      syncEntityRoute(`song:${songId}`, () => openSong(songId))
    }
  },
  { immediate: true },
)
</script>

<template>
  <AlbumsView v-if="!isMobileApp" />
</template>
