<!-- web/src/components/music/PlaylistDrawer.vue -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Play, Disc, Music, AlertCircle } from 'lucide-vue-next'
import PSheet from '@/components/ui/PSheet.vue'
import PButton from '@/components/ui/PButton.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { getMusicPlaylist, type MusicPlaylistDetail, type MusicSongListItem } from '@/api/musicV1'
import { usePlayerStore } from '@/stores/player'
import type { Song } from '@/types'

const { state, closePlaylist } = useMusicDrawers()
const player = usePlayerStore()

const isOpen = computed(() => state.value.playlistId !== null)
const playlist = ref<MusicPlaylistDetail | null>(null)
const loading = ref(false)
const errorMessage = ref('')

async function loadPlaylist(playlistId: string | null) {
  if (!playlistId) {
    playlist.value = null
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const detail = await getMusicPlaylist(playlistId)
    playlist.value = detail
  } catch (error) {
    console.error('Failed to fetch playlist details:', error)
    errorMessage.value = '歌单信息加载失败'
  } finally {
    loading.value = false
  }
}

const playableSongs = computed<Song[]>(() => {
  if (!playlist.value?.songs) return []
  const playlistName = playlist.value.name
  const playlistId = playlist.value.id
  return playlist.value.songs
    .filter((song): song is MusicSongListItem & { audio_url: string } => typeof song.audio_url === 'string' && song.audio_url.trim().length > 0)
    .map((song) => {
      const albumTitle = song.album?.title || playlistName
      const albumId = song.album?.id || playlistId
      const artistText = song.artists?.map((a) => a.name).join(' / ') || '未知艺术家'
      return {
        id: song.id,
        title: song.title,
        artist: artistText,
        album: albumTitle,
        album_id: albumId,
        year: 0,
        release_date: '',
        lyrics: song.lyrics || '',
        audio_url: song.audio_url,
        cover_url: song.cover_url || '',
        track_number: song.track_number,
        status: (song.status as Song['status']) || 'approved',
        artists: song.artists?.map((artist) => ({
          id: artist.id,
          name: artist.name,
          username: '',
          email: '',
        })),
      }
    })
})

const firstSongCover = computed(() => {
  const songs = playlist.value?.songs
  if (!songs || songs.length === 0) return null
  return songs[0]?.cover_url || null
})

function playPlaylist() {
  if (!playableSongs.value.length) return
  player.playAlbum(playableSongs.value)
}

function playTrack(track: MusicSongListItem) {
  if (!track.audio_url) return
  const index = playableSongs.value.findIndex((song) => song.id === track.id)
  player.playAlbum(playableSongs.value, index >= 0 ? index : 0)
}

watch(() => state.value.playlistId, loadPlaylist, { immediate: true })
</script>

<template>
  <PSheet
    :show="isOpen"
    @close="closePlaylist"
    width="680px"
    :index="0"
  >
    <template #header>
      <div class="playlist-header-container">
        <!-- Spotify-style Cover Collage / Art Block -->
        <div class="playlist-cover-wrapper">
          <div v-if="firstSongCover" class="cover-single">
            <img :src="firstSongCover" class="single-img" alt="歌单封面" />
          </div>
          <div v-else class="cover-placeholder">
            <Disc class="placeholder-icon" :size="36" />
          </div>
        </div>

        <div class="playlist-meta-info">
          <span class="playlist-eyebrow">歌单 / PLAYLIST</span>
          <h2 class="playlist-title">{{ playlist?.name || '歌单详情' }}</h2>
          <p v-if="playlist?.description" class="playlist-description">{{ playlist.description }}</p>
          <div class="playlist-stats">
            <span class="stat-author">Atoman Studio</span>
            <span class="stat-dot">•</span>
            <span class="stat-count">{{ playlist?.song_count || 0 }} 首单曲</span>
          </div>
        </div>
      </div>
    </template>

    <div class="playlist-body">
      <!-- Action Bar -->
      <div class="playlist-actions-bar">
        <PButton
          variant="primary"
          :disabled="!playableSongs.length"
          dot
          @click="playPlaylist"
        >
          播放歌单
        </PButton>
      </div>

      <!-- Tracks Table -->
      <div class="tracks-container">
        <div class="tracks-header">
          <div class="col-index">#</div>
          <div class="col-title">标题</div>
          <div class="col-album">专辑</div>
          <div class="col-status"></div>
        </div>

        <p v-if="errorMessage" class="state-line error">
          <AlertCircle :size="16" /> {{ errorMessage }}
        </p>
        <p v-else-if="loading" class="state-line loading">正在加载歌单内容...</p>
        <div v-else-if="!playlist?.songs?.length" class="track-empty">
          <Music :size="28" />
          <p>此歌单暂无曲目</p>
        </div>
        
        <div
          v-else
          v-for="(track, index) in playlist.songs"
          :key="track.id"
          class="track-row"
          :class="{ 'is-disabled': !track.audio_url }"
        >
          <div class="col-index">
            <button
              class="row-play-btn"
              type="button"
              :disabled="!track.audio_url"
              @click="playTrack(track)"
              aria-label="播放单曲"
            >
              <span class="row-num">{{ index + 1 }}</span>
              <Play class="row-play-icon" :size="14" fill="currentColor" />
            </button>
          </div>

          <div class="col-title">
            <div class="track-meta">
              <span class="track-name">{{ track.title }}</span>
              <span class="track-artists-text">
                {{ track.artists?.map(a => a.name).join(' / ') || '未知艺术家' }}
              </span>
            </div>
          </div>

          <div class="col-album">
            <span class="album-name">{{ track.album?.title || '未归属专辑' }}</span>
          </div>

          <div class="col-status">
            <span v-if="!track.audio_url" class="badge-no-audio">无音频</span>
          </div>
        </div>
      </div>
    </div>
  </PSheet>
</template>

<style scoped>
/* Spotify-style Header */
.playlist-header-container {
  display: flex;
  align-items: flex-end;
  gap: 1.5rem;
  padding: 0.5rem 0 1rem;
}

.playlist-cover-wrapper {
  width: 120px;
  height: 120px;
  background: var(--a-color-paper-wash);
  border: 1px solid var(--a-color-line-soft);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-shadow: var(--a-shadow-dropdown);
}

.cover-collage {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  width: 100%;
  height: 100%;
}

.collage-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-single {
  width: 100%;
  height: 100%;
}

.single-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  color: var(--a-color-ink-soft);
  opacity: 0.6;
}

.playlist-meta-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
  flex: 1;
}

.playlist-eyebrow {
  font-family: var(--a-font-meta);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: var(--a-color-ink-soft);
}

.playlist-title {
  font-family: var(--a-font-serif);
  font-size: 2rem;
  font-weight: 900;
  line-height: 1.1;
  margin: 0.1rem 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.playlist-description {
  margin: 0.25rem 0 0.5rem;
  font-size: 0.85rem;
  color: var(--a-color-ink-soft);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.playlist-stats {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-family: var(--a-font-meta);
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--a-color-ink-soft);
}

.stat-author {
  color: var(--a-color-fg);
}

.stat-dot {
  opacity: 0.5;
}

/* Play Action Bar */
.playlist-actions-bar {
  display: flex;
  align-items: center;
  padding: 1.25rem 0;
}



/* Table layout */
.tracks-container {
  display: flex;
  flex-direction: column;
  margin-bottom: 2rem;
}

.tracks-header {
  display: flex;
  align-items: center;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--a-color-line-soft);
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--a-color-ink-soft);
}

.col-index {
  width: 2.5rem;
  flex-shrink: 0;
  text-align: center;
}

.col-title {
  flex: 1.5;
  min-width: 0;
}

.col-album {
  flex: 1;
  min-width: 0;
  padding-left: 1rem;
}

.col-status {
  width: 4rem;
  flex-shrink: 0;
  text-align: right;
}

/* Track Row */
.track-row {
  display: flex;
  align-items: center;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-ink) 5%, transparent);
  transition: background-color 0.15s ease;
}

.track-row:hover {
  background-color: var(--a-color-paper-wash);
}

.track-row:last-child {
  border-bottom: none;
}

.row-play-btn {
  border: none;
  background: transparent;
  width: 100%;
  height: 100%;
  cursor: pointer;
  color: var(--a-color-ink-soft);
  display: flex;
  align-items: center;
  justify-content: center;
}

.row-play-icon {
  display: none;
}

.track-row:hover:not(.is-disabled) .row-num {
  display: none;
}

.track-row:hover:not(.is-disabled) .row-play-icon {
  display: block;
  color: var(--a-color-ink);
}

.track-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.track-name {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--a-color-fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-artists-text {
  font-size: 0.75rem;
  color: var(--a-color-ink-soft);
  margin-top: 0.1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.album-name {
  font-size: 0.82rem;
  color: var(--a-color-ink-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge-no-audio {
  font-family: var(--a-font-meta);
  font-size: 0.62rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  padding: 0.15rem 0.35rem;
  background: var(--a-color-paper-wash);
  color: var(--a-color-ink-soft);
  border: 1px solid var(--a-color-line-soft);
}

.is-disabled {
  opacity: 0.65;
}

/* State lines */
.state-line {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-family: var(--a-font-meta);
  font-size: 0.8rem;
  font-weight: 700;
  padding: 1.5rem 0.75rem;
  color: var(--a-color-ink-soft);
}

.state-line.error {
  color: var(--a-color-accent-destructive);
}

.track-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 3rem 0;
  color: var(--a-color-ink-soft);
  opacity: 0.6;
  font-family: var(--a-font-meta);
  font-size: 0.82rem;
  font-weight: 700;
}
</style>
