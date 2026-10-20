<template>
  <div class="mobile-music-discover">
    <!-- Header Title -->
    <header class="mobile-music-discover__header">
      <h1 class="mobile-music-discover__title">发现音乐</h1>
    </header>

    <!-- Curated Playlists Section -->
    <section class="mobile-music-discover__section" aria-label="精选歌单">
      <div class="mobile-music-discover__section-header">
        <h2 class="mobile-music-discover__section-title">精选歌单</h2>
        <router-link to="/music/playlists" class="mobile-music-discover__more-link">
          查看全部
        </router-link>
      </div>

      <div class="mobile-music-discover__grid">
        <div
          v-for="playlist in playlists"
          :key="playlist.id"
          class="mobile-music-discover__card"
          data-testid="playlist-card"
          @click="openPlaylist(playlist.id)"
        >
          <div class="mobile-music-discover__card-cover">
            <img
              v-if="playlist.cover_url"
              :src="playlist.cover_url"
              :alt="playlist.name"
              class="mobile-music-discover__card-img"
            />
            <div v-else class="mobile-music-discover__card-art">
              <MIcon name="waveform" size="lg" />
            </div>
            <span class="mobile-music-discover__tag">LOSSLESS</span>
          </div>
          <div class="mobile-music-discover__card-info">
            <span class="mobile-music-discover__card-name">{{ playlist.name }}</span>
            <span class="mobile-music-discover__card-count">{{ playlist.song_count || 0 }} 首歌曲</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Recent Tracks Section -->
    <section class="mobile-music-discover__section" aria-label="最近在听">
      <div class="mobile-music-discover__section-header">
        <h2 class="mobile-music-discover__section-title">最近在听</h2>
      </div>

      <div class="mobile-music-discover__tracks">
        <div
          v-for="(track, index) in recentTracks"
          :key="track.id || index"
          class="mobile-music-discover__track-item"
          data-testid="track-item"
          @click="playTrack(track)"
        >
          <span class="mobile-music-discover__track-index">{{ String(index + 1).padStart(2, '0') }}</span>
          
          <div class="mobile-music-discover__track-cover">
            <img
              v-if="track.cover_url"
              :src="track.cover_url"
              :alt="track.title"
              class="mobile-music-discover__track-img"
            />
            <div v-else class="mobile-music-discover__track-art">
              <MIcon name="note" size="sm" />
            </div>
          </div>

          <div class="mobile-music-discover__track-meta">
            <span class="mobile-music-discover__track-title">{{ track.title }}</span>
            <span class="mobile-music-discover__track-artist">{{ track.artist || '未知艺术家' }}</span>
          </div>

          <div class="mobile-music-discover__track-end">
            <span class="mobile-music-discover__track-duration">{{ formatDuration(track.duration) }}</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getMusicHome, listPublicMusicPlaylists, listMusicSongs, type MusicPlaylistSummary } from '@/api/musicV1'
import { useAudioPlayerStore } from '@/stores/player'
import type { Song } from '@/types'
import MIcon from '@mobile/components/ui/MIcon.vue'

const router = useRouter()
const player = useAudioPlayerStore()

const playlists = ref<MusicPlaylistSummary[]>([])
const recentTracks = ref<Song[]>([])
const loading = ref(false)

const fallbackPlaylists: MusicPlaylistSummary[] = [
  { id: 'curated-1', name: '深度工作流', song_count: 18, is_public: true },
  { id: 'curated-2', name: '午夜脉冲', song_count: 24, is_public: true },
  { id: 'curated-3', name: '极简专注音', song_count: 15, is_public: true },
  { id: 'curated-4', name: '环境氛围志', song_count: 20, is_public: true },
]

const fallbackTracks: Song[] = [
  { id: 'fb-1', title: 'Echoes of Silence', artist: 'Lumine', album: 'Abyssal', duration: 215, audio_url: '/audio/1.mp3' },
  { id: 'fb-2', title: 'Quantum Drift', artist: 'Aethel', album: 'Synapse', duration: 184, audio_url: '/audio/2.mp3' },
  { id: 'fb-3', title: 'Midnight City Lights', artist: 'Lumine', album: 'Abyssal', duration: 240, audio_url: '/audio/3.mp3' },
]

function toPlayerSong(item: any): Song {
  return {
    id: item.id,
    title: item.title,
    artist: typeof item.artist === 'string'
      ? item.artist
      : item.artists?.map((a: any) => a.name).join(' / ') || '未知艺术家',
    album: typeof item.album === 'string'
      ? item.album
      : item.album?.title || '',
    duration: typeof item.duration === 'number' ? item.duration : (item.duration_seconds || 0),
    audio_url: item.audio_url || '',
    cover_url: item.cover_url || item.album?.cover_url || '',
  }
}

function formatDuration(seconds?: number): string {
  if (!seconds || isNaN(seconds)) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

async function loadData() {
  loading.value = true
  try {
    const [homeRes, playlistsRes] = await Promise.allSettled([
      getMusicHome(),
      listPublicMusicPlaylists({ page: 1, page_size: 4 }),
    ])

    if (playlistsRes.status === 'fulfilled' && playlistsRes.value?.data?.length) {
      playlists.value = playlistsRes.value.data
    } else {
      playlists.value = fallbackPlaylists
    }

    if (homeRes.status === 'fulfilled' && homeRes.value) {
      const items = homeRes.value.recently_played || []
      if (items.length > 0) {
        recentTracks.value = items.map((item) => toPlayerSong(item.song ? item.song : item))
      } else {
        try {
          const songsRes = await listMusicSongs({ page: 1, page_size: 5 })
          if (songsRes?.data?.length) {
            recentTracks.value = songsRes.data.map(toPlayerSong)
          } else {
            recentTracks.value = fallbackTracks
          }
        } catch {
          recentTracks.value = fallbackTracks
        }
      }
    } else {
      try {
        const songsRes = await listMusicSongs({ page: 1, page_size: 5 })
        if (songsRes?.data?.length) {
          recentTracks.value = songsRes.data.map(toPlayerSong)
        } else {
          recentTracks.value = fallbackTracks
        }
      } catch {
        recentTracks.value = fallbackTracks
      }
    }
  } catch {
    playlists.value = fallbackPlaylists
    recentTracks.value = fallbackTracks
  } finally {
    loading.value = false
  }
}

function openPlaylist(id: string) {
  void router.push(`/music/playlist/${id}`)
}

function playTrack(track: Song) {
  player.playSong(track)
}

onMounted(() => {
  void loadData()
})
</script>

<style scoped>
.mobile-music-discover {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
  padding: 1rem 1rem 5rem;
  background-color: #ffffff;
  color: var(--a-color-text, #0f172a);
}

.mobile-music-discover__header {
  margin-bottom: 1.25rem;
}

.mobile-music-discover__title {
  font-size: 1.375rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin: 0;
}

.mobile-music-discover__section {
  margin-bottom: 2rem;
}

.mobile-music-discover__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.875rem;
}

.mobile-music-discover__section-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  color: var(--a-color-text, #0f172a);
}

.mobile-music-discover__more-link {
  font-size: 0.8125rem;
  color: var(--a-color-muted, #64748b);
  text-decoration: none;
}

/* 2-Column Curated Grid */
.mobile-music-discover__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.875rem;
  width: 100%;
  box-sizing: border-box;
}

.mobile-music-discover__card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #ffffff;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.1s ease;
}

.mobile-music-discover__card:active {
  transform: scale(0.98);
}

.mobile-music-discover__card-cover {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  background: var(--a-color-surface-muted, #f8fafc);
  overflow: hidden;
}

.mobile-music-discover__card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-music-discover__card-art {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-muted, #94a3b8);
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}

.mobile-music-discover__tag {
  position: absolute;
  top: 6px;
  right: 6px;
  padding: 2px 5px;
  background: rgba(15, 23, 42, 0.75);
  color: #ffffff;
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  border-radius: 2px;
}

.mobile-music-discover__card-info {
  padding: 0.625rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.mobile-music-discover__card-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-music-discover__card-count {
  font-size: 0.75rem;
  color: var(--a-color-muted, #64748b);
}

/* Recent Tracks List */
.mobile-music-discover__tracks {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
  background: #ffffff;
  overflow: hidden;
}

.mobile-music-discover__track-item {
  display: flex;
  align-items: center;
  padding: 0.75rem 0.875rem;
  gap: 0.75rem;
  border-bottom: 1px solid var(--a-color-border-soft, #e2e8f0);
  cursor: pointer;
  user-select: none;
  transition: background-color 0.1s ease;
}

.mobile-music-discover__track-item:last-child {
  border-bottom: none;
}

.mobile-music-discover__track-item:active {
  background-color: var(--a-color-surface-muted, #f8fafc);
}

.mobile-music-discover__track-index {
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  color: var(--a-color-muted, #94a3b8);
  width: 1.5rem;
  flex-shrink: 0;
}

.mobile-music-discover__track-cover {
  width: 38px;
  height: 38px;
  border-radius: var(--a-radius-control, 4px);
  overflow: hidden;
  background: var(--a-color-surface-muted, #f1f5f9);
  flex-shrink: 0;
}

.mobile-music-discover__track-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-music-discover__track-art {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-muted, #94a3b8);
}

.mobile-music-discover__track-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
  gap: 0.125rem;
}

.mobile-music-discover__track-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--a-color-text, #0f172a);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-music-discover__track-artist {
  font-size: 0.75rem;
  color: var(--a-color-muted, #64748b);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-music-discover__track-end {
  flex-shrink: 0;
}

.mobile-music-discover__track-duration {
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  color: var(--a-color-muted, #94a3b8);
}
</style>
