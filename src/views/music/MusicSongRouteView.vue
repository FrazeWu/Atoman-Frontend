<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, Play } from 'lucide-vue-next'
import { getMusicSongDetail, type MusicSongDetail, type MusicSongListItem } from '@/api/musicV1'
import PButton from '@/components/ui/PButton.vue'
import { usePlayerStore } from '@/stores/player'
import type { Song } from '@/types'
import { useRoute } from 'vue-router'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

const route = useRoute()
const player = usePlayerStore()
const { openAlbum, openArtist } = useMusicDrawers()
const detail = ref<MusicSongDetail | null>(null)
const loading = ref(false)
const error = ref('')

function playable(song: MusicSongListItem): Song {
  return {
    id: song.id,
    title: song.title,
    artist: song.artists?.map(artist => artist.name).join(' / ') || '未知艺术家',
    album: song.album?.title || '',
    album_id: song.album?.id || '',
    year: 0,
    release_date: '',
    lyrics: song.lyrics || '',
    audio_url: song.audio_url || '',
    cover_url: song.cover_url || song.album?.cover_url || '',
    status: 'approved',
  }
}

const roleGroups = computed(() => {
  const groups = new Map<string, Array<{ id: string; name: string }>>()
  for (const artist of detail.value?.artists ?? []) {
    const role = artist.role || 'primary'
    groups.set(role, [...(groups.get(role) ?? []), artist])
  }
  return [...groups.entries()]
})
const roleLabels: Record<string, string> = { primary: '艺术家', featured: '合作艺人', producer: '制作人', writer: '作词', composer: '作曲' }

async function load(songId: unknown) {
  if (typeof songId !== 'string' || !songId) return
  loading.value = true
  error.value = ''
  try {
    detail.value = await getMusicSongDetail(songId)
  } catch {
    detail.value = null
    error.value = '歌曲无法加载'
  } finally {
    loading.value = false
  }
}

watch(() => route.params.songId, load, { immediate: true })
</script>

<template>
  <main class="song-detail">
    <p v-if="loading" class="song-detail__state">正在加载</p>
    <p v-else-if="error" class="song-detail__state song-detail__state--error">{{ error }}</p>
    <section v-else-if="detail" class="song-detail__content">
      <img v-if="detail.song.cover_url || detail.song.album?.cover_url" :src="detail.song.cover_url || detail.song.album?.cover_url" :alt="`${detail.song.title} 封面`" class="song-detail__cover">
      <div class="song-detail__main">
        <button v-if="detail.song.album?.id" type="button" class="song-detail__album song-detail__entity-link" @click="openAlbum(String(detail.song.album.id))">{{ detail.song.album.title }}</button>
        <p v-else class="song-detail__album">单曲</p>
        <h1>{{ detail.song.title }}</h1>
        <div v-for="[role, artists] in roleGroups" :key="role" class="song-detail__artists">
          <span>{{ roleLabels[role] || role }}</span>
          <button v-for="artist in artists" :key="artist.id" type="button" class="song-detail__entity-link" @click="openArtist(String(artist.id))">{{ artist.name }}</button>
        </div>
        <PButton :disabled="!detail.playable" @click="player.playSong(playable(detail.song))"><Play :size="16" aria-hidden="true" />播放</PButton>
      </div>
      <nav class="song-detail__navigation" aria-label="相邻曲目">
        <RouterLink v-if="detail.previous" :to="`/music/song/${detail.previous.id}`"><ChevronLeft :size="16" aria-hidden="true" />{{ detail.previous.title }}</RouterLink>
        <RouterLink v-if="detail.next" :to="`/music/song/${detail.next.id}`">{{ detail.next.title }}<ChevronRight :size="16" aria-hidden="true" /></RouterLink>
      </nav>
    </section>
  </main>
</template>

<style scoped>
.song-detail { max-width: 56rem; margin: 0 auto; padding: 1.5rem; }
.song-detail__content { display: grid; grid-template-columns: minmax(10rem, 16rem) minmax(0, 1fr); gap: 1.5rem; }
.song-detail__cover { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px; background: var(--a-color-bg-subtle); }
.song-detail__main { display: grid; align-content: center; justify-items: start; gap: 0.75rem; }
.song-detail__main h1, .song-detail__album { margin: 0; }
.song-detail__album, .song-detail__artists span, .song-detail__state { color: var(--a-color-muted); }
.song-detail__artists { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
.song-detail__artists a { color: inherit; }
.song-detail__entity-link { border: 0; padding: 0; background: transparent; color: inherit; font: inherit; cursor: pointer; text-decoration: underline; }
.song-detail__navigation { grid-column: 1 / -1; display: flex; justify-content: space-between; gap: 1rem; border-top: 1px solid var(--a-color-border-soft); padding-top: 1rem; }
.song-detail__navigation a { display: inline-flex; gap: 0.25rem; align-items: center; color: inherit; min-width: 0; }
.song-detail__state--error { color: var(--a-color-accent-destructive); }
@media (max-width: 640px) { .song-detail { padding: 1rem; } .song-detail__content { grid-template-columns: 1fr; } .song-detail__cover { max-width: 18rem; } }
</style>
