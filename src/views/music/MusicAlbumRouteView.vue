<script setup lang="ts">
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import HomeView from '@/views/music/HomeView.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { useMusicSheetRouteSync } from '@/composables/useMusicSheetRouteSync'
import { getMusicAlbum } from '@/api/musicV1'
import { usePlayerStore } from '@/stores/player'
import { buildPlayableSongsFromAlbum } from '@/utils/musicMedia'

const route = useRoute()
const { openAlbum } = useMusicDrawers()
const { syncEntityRoute } = useMusicSheetRouteSync(useRouter())
const player = usePlayerStore()

async function openLyricTarget(albumId: string, songId: unknown) {
  if (typeof songId !== 'string' || !songId) return
  const album = await getMusicAlbum(albumId)
  const song = buildPlayableSongsFromAlbum(album).find((item) => String(item.id) === songId)
  if (!song) return
  player.playSong(song)
  player.showLyrics = true
}

watch(
  () => route.params.albumId,
  (albumId) => {
    if (typeof albumId === 'string' && albumId) {
      syncEntityRoute(`album:${albumId}`, () => openAlbum(albumId))
      void openLyricTarget(albumId, route.query.song_id)
    }
  },
  { immediate: true },
)

</script>

<template>
  <HomeView />
</template>
