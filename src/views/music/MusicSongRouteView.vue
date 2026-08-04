<script setup lang="ts">
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getMusicSong } from '@/api/musicV1'

const route = useRoute()
const router = useRouter()

watch(
  () => route.params.songId,
  async songId => {
    if (typeof songId !== 'string' || !songId) return
    try {
      const song = await getMusicSong(songId)
      if (song.album_id) {
        await router.replace({ path: `/music/album/${song.album_id}`, query: { song_id: song.id } })
      }
    } catch {
      await router.replace('/music')
    }
  },
  { immediate: true },
)
</script>

<template><div /></template>
