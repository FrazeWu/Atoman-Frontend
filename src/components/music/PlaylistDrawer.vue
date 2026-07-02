<!-- web/src/components/music/PlaylistDrawer.vue -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import PSheet from '@/components/ui/PSheet.vue'
import PButton from '@/components/ui/PButton.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { getMusicPlaylist, type MusicPlaylistDetail, type MusicSongListItem } from '@/api/musicV1'
import { usePlayerStore } from '@/stores/player'
import type { Song } from '@/types'

const { state, closePlaylist, isMainShifted } = useMusicDrawers()
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
    .map((song): Song => {
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
    width="640px"
    :index="0"
  >
    <template #header>
      <div class="drawer-header-content">
        <div class="kicker">PLAYLIST</div>
        <h2 class="title">{{ playlist?.name || '歌单详情' }}</h2>
        <p v-if="playlist?.description" class="description">{{ playlist.description }}</p>
        <p class="meta">{{ playlist?.song_count || 0 }} 首单曲</p>
      </div>
    </template>

    <div class="drawer-body">
      <div class="actions">
        <PButton
          variant="primary"
          :disabled="!playableSongs.length"
          dot
          @click="playPlaylist"
        >
          播放歌单
        </PButton>
      </div>

      <div class="content-section">
        <div class="section-title">Tracks</div>
        <p v-if="errorMessage" class="state-line state-line--error">{{ errorMessage }}</p>
        <p v-else-if="loading" class="state-line">正在加载歌单内容...</p>
        <div v-else-if="!playlist?.songs?.length" class="track-empty">此歌单暂无曲目。</div>
        
        <div v-else v-for="(track, index) in playlist.songs" :key="track.id" class="track">
          <div class="track-main">
            <button
              class="track-play-btn"
              type="button"
              :disabled="!track.audio_url"
              @click="playTrack(track)"
              aria-label="播放"
            >
              <span class="track-num">{{ String(index + 1).padStart(2, '0') }}</span>
              <svg class="track-play-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </button>
            <div class="track-info">
              <div class="track-title">{{ track.title }}</div>
              <div class="track-artists">{{ track.artists?.map(a => a.name).join(' / ') || '未知艺术家' }}</div>
            </div>
          </div>
          <div class="track-meta">
            <span v-if="!track.audio_url" class="track-unavailable">无音频</span>
          </div>
        </div>
      </div>
    </div>
  </PSheet>
</template>

<style scoped>
.drawer-header-content { display: flex; flex-direction: column; gap: 0.25rem; }
.kicker {
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  font-weight: bold;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--a-color-ink-soft);
}
.title { font-family: var(--a-font-serif); font-size: 2.2rem; margin: 0; line-height: 1.1; letter-spacing: -0.02em; }
.description { margin: 0.5rem 0 0; color: var(--a-color-ink-soft); font-size: 0.9rem; line-height: 1.5; }
.meta { margin: 0.35rem 0 0; font-family: var(--a-font-meta); font-size: 0.78rem; font-weight: 700; color: var(--a-color-ink-soft); }

.drawer-body { display: flex; flex-direction: column; }
.actions { display: flex; gap: 0.75rem; margin-bottom: 2rem; }

.content-section {
  background: var(--a-color-paper-soft);
  border: 1px solid var(--a-color-line-soft);
  padding: 1.5rem 2rem;
  margin-bottom: 2rem;
}
.section-title {
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--a-color-ink-soft);
  margin-bottom: 1.25rem;
  padding-bottom: 0.45rem;
  border-bottom: 1px solid var(--a-color-line-soft);
}
.track-empty, .state-line {
  font-family: var(--a-font-meta);
  font-size: 0.8rem;
  font-weight: 800;
  color: var(--a-color-ink-soft);
}
.state-line--error { color: var(--a-color-accent-destructive); }

.track {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.65rem 0;
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-ink) 8%, transparent);
}
.track:last-child {
  border-bottom: 0;
}
.track-main {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  min-width: 0;
  flex: 1;
}
.track-play-btn {
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  position: relative;
  color: var(--a-color-ink);
}
.track-play-btn:disabled {
  color: var(--a-color-muted-soft);
  cursor: not-allowed;
}
.track-num {
  font-family: var(--a-font-meta);
  font-size: 0.85rem;
  font-weight: bold;
}
.track-play-icon {
  display: none;
}
.track-play-btn:not(:disabled):hover .track-num {
  display: none;
}
.track-play-btn:not(:disabled):hover .track-play-icon {
  display: block;
}
.track-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.track-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--a-color-fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.track-artists {
  font-size: 0.76rem;
  color: var(--a-color-muted);
}
.track-meta {
  flex-shrink: 0;
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  font-weight: bold;
  color: var(--a-color-ink-soft);
}
.track-unavailable {
  color: var(--a-color-muted-soft);
  text-transform: uppercase;
  font-size: 0.65rem;
}
</style>
