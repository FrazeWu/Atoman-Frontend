<template>
  <main class="mobile-song-view">
    <section v-if="loading" class="mobile-song-view__state" aria-live="polite">正在加载歌曲</section>
    <section v-else-if="error" class="mobile-song-view__state mobile-song-view__state--error" role="alert">
      <h1>歌曲无法加载</h1>
      <p>{{ error }}</p>
      <button type="button" @click="loadSong">重试</button>
    </section>
    <section v-else-if="detail" class="mobile-song-view__content">
      <div class="mobile-song-view__cover-wrap">
        <img
          v-if="song.cover_url || song.album?.cover_url"
          :src="song.cover_url || song.album?.cover_url"
          :alt="`${song.title} 封面`"
          class="mobile-song-view__cover"
        />
        <div v-else class="mobile-song-view__cover mobile-song-view__cover--fallback" aria-hidden="true">
          {{ song.title.slice(0, 1) }}
        </div>
      </div>

      <div class="mobile-song-view__identity">
        <h1>{{ song.title }}</h1>
        <p>{{ artistText }}</p>
      </div>

      <button
        type="button"
        class="mobile-song-view__play"
        :disabled="!detail.playable || !song.audio_url"
        @click="playSong"
      >
        <Play :size="18" fill="currentColor" aria-hidden="true" />
        <span>{{ detail.playable && song.audio_url ? '播放歌曲' : '暂无音频' }}</span>
      </button>

      <dl class="mobile-song-view__metadata">
        <div v-if="song.album">
          <dt>专辑</dt>
          <dd>{{ song.album.title }}</dd>
        </div>
        <div v-if="song.release_date">
          <dt>发行日期</dt>
          <dd>{{ song.release_date }}</dd>
        </div>
        <div v-if="song.duration_sec">
          <dt>时长</dt>
          <dd>{{ formatDuration(song.duration_sec) }}</dd>
        </div>
      </dl>

      <section v-if="song.lyrics" class="mobile-song-view__lyrics" aria-labelledby="lyrics-heading">
        <h2 id="lyrics-heading">歌词</h2>
        <p>{{ song.lyrics }}</p>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Play } from 'lucide-vue-next'
import { getMusicSongDetail, type MusicSongDetail, type MusicSongListItem } from '@/api/musicV1'
import { usePlayerStore } from '@/stores/player'
import type { Song } from '@/types'

const route = useRoute()
const router = useRouter()
const player = usePlayerStore()
const detail = ref<MusicSongDetail | null>(null)
const loading = ref(false)
const error = ref('')

const song = computed(() => detail.value?.song as MusicSongListItem)
const artistText = computed(() => detail.value?.artists.map((artist) => artist.name).join(' / ') || song.value?.artists?.map((artist) => artist.name).join(' / ') || '未知艺术家')

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.floor(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function toPlayableSong(source: MusicSongListItem): Song {
  const status = source.status === 'closed' || source.status === 'pending' || source.status === 'approved' || source.status === 'rejected'
    ? source.status
    : 'open'
  return {
    id: source.id,
    title: source.title,
    artist: source.artists?.map((artist) => artist.name).join(' / ') || '未知艺术家',
    album: source.album?.title || '',
    album_id: source.album_id || source.album?.id || '',
    year: source.album?.year || Number(source.release_date?.slice(0, 4)) || 0,
    release_date: source.release_date || '',
    lyrics: source.lyrics || '',
    audio_url: source.audio_url || '',
    waveform_peaks: source.waveform_peaks,
    cover_url: source.cover_url || source.album?.cover_url || '',
    track_number: source.track_number,
    disc_number: source.disc_number,
    status,
  }
}

async function loadSong() {
  const songId = route.params.songId
  if (typeof songId !== 'string' || !songId) return
  loading.value = true
  error.value = ''
  try {
    detail.value = await getMusicSongDetail(songId)
  } catch {
    detail.value = null
    error.value = '请稍后重试'
  } finally {
    loading.value = false
  }
}

function playSong() {
  if (!song.value?.audio_url || !detail.value?.playable) return
  player.playSong(toPlayableSong(song.value))
  void router.push('/music/player')
}

watch(() => route.params.songId, loadSong, { immediate: true })
</script>

<style scoped>
.mobile-song-view {
  min-width: 0;
  padding: 1.25rem 1rem 2rem;
}

.mobile-song-view__content {
  display: grid;
  gap: 1.25rem;
}

.mobile-song-view__cover-wrap {
  width: min(100%, 20rem);
  margin: 0 auto;
}

.mobile-song-view__cover {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 8px;
  background: var(--a-color-surface-muted);
}

.mobile-song-view__cover--fallback {
  display: grid;
  place-items: center;
  color: var(--a-color-primary-contrast);
  background: var(--a-color-primary);
  font-size: 4rem;
}

.mobile-song-view__identity h1,
.mobile-song-view__identity p,
.mobile-song-view__lyrics h2,
.mobile-song-view__lyrics p,
.mobile-song-view__state h1,
.mobile-song-view__state p {
  margin: 0;
}

.mobile-song-view__identity h1 {
  font-size: 1.5rem;
  line-height: 1.25;
}

.mobile-song-view__identity p,
.mobile-song-view__metadata dt,
.mobile-song-view__lyrics p,
.mobile-song-view__state p {
  color: var(--a-color-muted);
}

.mobile-song-view__play {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  border: 0;
  border-radius: 8px;
  background: var(--a-color-primary);
  color: var(--a-color-primary-contrast);
  font: inherit;
  font-weight: 600;
}

.mobile-song-view__play:disabled {
  background: var(--a-color-surface-muted);
  color: var(--a-color-muted);
}

.mobile-song-view__metadata {
  display: grid;
  gap: 0.75rem;
  margin: 0;
  padding: 1rem 0;
  border-top: 1px solid var(--a-color-border-soft);
  border-bottom: 1px solid var(--a-color-border-soft);
}

.mobile-song-view__metadata div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.mobile-song-view__metadata dt,
.mobile-song-view__metadata dd {
  margin: 0;
}

.mobile-song-view__metadata dd {
  text-align: right;
}

.mobile-song-view__lyrics {
  display: grid;
  gap: 0.75rem;
}

.mobile-song-view__lyrics p {
  white-space: pre-wrap;
  line-height: 1.7;
}

.mobile-song-view__state {
  display: grid;
  min-height: 50dvh;
  place-content: center;
  gap: 0.75rem;
  text-align: center;
}

.mobile-song-view__state button {
  min-height: 44px;
  border: 0;
  border-radius: 8px;
  background: var(--a-color-primary);
  color: var(--a-color-primary-contrast);
  font: inherit;
}
</style>
