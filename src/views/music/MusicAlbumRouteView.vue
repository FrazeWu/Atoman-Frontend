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
let lyricTargetGeneration = 0

async function openLyricTarget(albumId: string, songId: unknown, generation: number) {
  if (typeof songId !== 'string' || !songId) return
  const album = await getMusicAlbum(albumId)
  if (generation !== lyricTargetGeneration) return
  const song = buildPlayableSongsFromAlbum(album).find((item) => String(item.id) === songId)
  if (!song) return
  const player = usePlayerStore()
  player.playSong(song)
  player.showLyrics = true
}

watch(
  () => [route.params.albumId, route.query?.song_id, route.query?.annotation_id] as const,
  ([albumId, songId]) => {
    const generation = ++lyricTargetGeneration
    if (typeof albumId === 'string' && albumId) {
      syncEntityRoute(`album:${albumId}`, () => openAlbum(albumId))
      void openLyricTarget(albumId, songId, generation)
    }
  },
  { immediate: true },
)

</script>

<template>
  <HomeView />
</template>
