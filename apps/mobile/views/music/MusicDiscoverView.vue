<template>
  <div class="mobile-music-discover">
    <!-- Header Title -->
    <header class="mobile-music-discover__header">
      <h1 class="mobile-music-discover__title">发现音乐</h1>
    </header>

    <!-- Featured Recommendation Card -->
    <section
      v-if="featuredRecommendation"
      class="mobile-music-discover__featured"
      data-testid="featured-recommendation"
      @click="openRecommendation(featuredRecommendation)"
    >
      <div class="mobile-music-discover__featured-cover">
        <img
          v-if="featuredRecommendation.cover_url"
          :src="featuredRecommendation.cover_url"
          :alt="featuredRecommendation.title"
          class="mobile-music-discover__featured-img"
        />
        <div v-else class="mobile-music-discover__featured-art">
          <MIcon name="waveform" size="lg" />
        </div>
        <span class="mobile-music-discover__featured-badge">今日推荐</span>
      </div>

      <div class="mobile-music-discover__featured-info">
        <h2 class="mobile-music-discover__featured-title">{{ featuredRecommendation.title }}</h2>
        <p class="mobile-music-discover__featured-sub">{{ featuredRecommendation.subtitle }}</p>
        <div class="mobile-music-discover__featured-play">
          <MIcon name="player-play" size="xs" />
          <span>立即聆听</span>
        </div>
      </div>
    </section>

    <!-- Featured Albums Section -->
    <section v-if="albums.length > 0" class="mobile-music-discover__section" aria-label="热门专辑">
      <div class="mobile-music-discover__section-header">
        <h2 class="mobile-music-discover__section-title">热门专辑</h2>
        <router-link to="/music/search?tab=albums" class="mobile-music-discover__more-link">
          查看全部
        </router-link>
      </div>

      <div class="mobile-music-discover__albums-scroll">
        <div
          v-for="album in albums"
          :key="album.id"
          class="mobile-music-discover__album-card"
          data-testid="album-card"
          @click="openAlbum(album.id)"
        >
          <div class="mobile-music-discover__album-cover">
            <img
              v-if="album.cover_url"
              :src="album.cover_url"
              :alt="album.title"
              class="mobile-music-discover__album-img"
              loading="lazy"
            />
            <div v-else class="mobile-music-discover__album-art">
              <MIcon name="note" size="md" />
            </div>
            <span v-if="album.year" class="mobile-music-discover__album-year">{{ album.year }}</span>
          </div>
          <span class="mobile-music-discover__album-name">{{ album.title }}</span>
          <span class="mobile-music-discover__album-artist">{{ album.artist || '未知艺术家' }}</span>
        </div>
      </div>
    </section>

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
              loading="lazy"
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
        <h2 class="mobile-music-discover__section-title">新曲上架</h2>
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
              loading="lazy"
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
            <span v-if="formatDuration(track.duration)" class="mobile-music-discover__track-duration">{{ formatDuration(track.duration) }}</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  getMusicHome,
  listMusicAlbums,
  listMusicSongs,
  listPublicMusicPlaylists,
  type MusicPlaylistSummary,
} from '@/api/musicV1'
import { useAudioPlayerStore } from '@/stores/player'
import type { Song } from '@/types'
import MIcon from '@mobile/components/ui/MIcon.vue'

export interface MobileAlbumItem {
  id: string
  title: string
  artist: string
  year?: string | number
  cover_url?: string
  song_count?: number
}

const router = useRouter()
const player = useAudioPlayerStore()

const playlists = ref<MusicPlaylistSummary[]>([])
const albums = ref<MobileAlbumItem[]>([])
const recentTracks = ref<Song[]>([])
const loading = ref(false)

const fallbackPlaylists: MusicPlaylistSummary[] = [
  { id: 'curated-1', name: '深度工作流', song_count: 18, is_public: true },
  { id: 'curated-2', name: '午夜脉冲', song_count: 24, is_public: true },
  { id: 'curated-3', name: '极简专注音', song_count: 15, is_public: true },
  { id: 'curated-4', name: '环境氛围志', song_count: 20, is_public: true },
]

const fallbackAlbums: MobileAlbumItem[] = [
  { id: 'alb-1', title: '2049', artist: 'Ye', year: 2026 },
  { id: 'alb-2', title: '12-hey-mama', artist: 'Ye', year: 2008 },
  { id: 'alb-3', title: 'Graduation', artist: 'Kanye West', year: 2007 },
]

const fallbackTracks: Song[] = [
  { id: 'fb-1', title: 'Echoes of Silence', artist: 'Lumine', album: 'Abyssal', duration: 215, audio_url: '/audio/1.mp3' },
  { id: 'fb-2', title: 'Quantum Drift', artist: 'Aethel', album: 'Synapse', duration: 184, audio_url: '/audio/2.mp3' },
  { id: 'fb-3', title: 'Midnight City Lights', artist: 'Lumine', album: 'Abyssal', duration: 240, audio_url: '/audio/3.mp3' },
]

const featuredRecommendation = computed(() => {
  if (albums.value.length > 0) {
    const first = albums.value[0]
    return {
      id: first.id,
      title: first.title,
      subtitle: `${first.artist} · ${first.year ? first.year + ' 年' : '热门专辑'}`,
      cover_url: first.cover_url,
      type: 'album',
    }
  }
  if (playlists.value.length > 0) {
    const first = playlists.value[0]
    return {
      id: first.id,
      title: first.name,
      subtitle: `${first.song_count || 0} 首精选曲目 · 无损音质`,
      cover_url: first.cover_url,
      type: 'playlist',
    }
  }
  return null
})

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
    duration: typeof item.duration === 'number' && item.duration > 0
      ? item.duration
      : (item.duration_sec ?? item.duration_seconds ?? item.durationSeconds ?? 0),
    audio_url: item.audio_url || '',
    cover_url: item.cover_url || item.album?.cover_url || '',
  }
}

function toAlbumItem(item: any): MobileAlbumItem {
  return {
    id: item.id,
    title: item.title,
    artist: typeof item.artist === 'string'
      ? item.artist
      : item.artists?.map((a: any) => a.name || a.display_name).join(' / ') || '未知艺术家',
    year: item.year || item.release_year || '',
    cover_url: item.cover_url || '',
    song_count: item.song_count || 0,
  }
}

function formatDuration(seconds?: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return ''
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

async function loadData() {
  loading.value = true
  try {
    const [homeRes, playlistsRes, albumsRes, songsRes] = await Promise.allSettled([
      getMusicHome(),
      listPublicMusicPlaylists({ page: 1, page_size: 4 }),
      listMusicAlbums({ page: 1, page_size: 6 }),
      listMusicSongs({ page: 1, page_size: 8 }),
    ])

    if (playlistsRes.status === 'fulfilled' && playlistsRes.value?.data?.length) {
      playlists.value = playlistsRes.value.data
    } else {
      playlists.value = fallbackPlaylists
    }

    if (albumsRes.status === 'fulfilled' && albumsRes.value?.data?.length) {
      albums.value = albumsRes.value.data.map(toAlbumItem)
    } else {
      albums.value = fallbackAlbums
    }

    if (homeRes.status === 'fulfilled' && homeRes.value) {
      const items = homeRes.value.recently_played || []
      if (items.length > 0) {
        recentTracks.value = items.map((item) => toPlayerSong(item.song ? item.song : item))
      } else if (songsRes.status === 'fulfilled' && songsRes.value?.data?.length) {
        recentTracks.value = songsRes.value.data.map(toPlayerSong)
      } else {
        recentTracks.value = fallbackTracks
      }
    } else if (songsRes.status === 'fulfilled' && songsRes.value?.data?.length) {
      recentTracks.value = songsRes.value.data.map(toPlayerSong)
    } else {
      recentTracks.value = fallbackTracks
    }
  } catch {
    playlists.value = fallbackPlaylists
    albums.value = fallbackAlbums
    recentTracks.value = fallbackTracks
  } finally {
    loading.value = false
  }
}

function openPlaylist(id: string) {
  void router.push(`/music/playlist/${id}`)
}

function openAlbum(id: string) {
  void router.push(`/music/album/${id}`)
}

function openRecommendation(rec: any) {
  if (rec.type === 'album') {
    void router.push(`/music/album/${rec.id}`)
  } else {
    void router.push(`/music/playlist/${rec.id}`)
  }
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
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background-color: #ffffff;
  padding-bottom: 96px;
}

.mobile-music-discover__header {
  padding: 16px 16px 8px;
}

.mobile-music-discover__title {
  font-size: 20px;
  font-weight: 600;
  color: var(--a-color-text, #111111);
  letter-spacing: -0.01em;
  margin: 0;
}

/* Featured Recommendation Banner */
.mobile-music-discover__featured {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 8px 16px 16px;
  padding: 12px;
  border-radius: 4px;
  border: 1px solid var(--a-color-border-soft, #eeeeee);
  background: #ffffff;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.mobile-music-discover__featured:active {
  background-color: var(--a-color-surface-hover, #fafafa);
}

.mobile-music-discover__featured-cover {
  position: relative;
  width: 72px;
  height: 72px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft, #eeeeee);
  background: #fbfbfb;
  flex-shrink: 0;
}

.mobile-music-discover__featured-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-music-discover__featured-art {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-text-muted, #999999);
}

.mobile-music-discover__featured-badge {
  position: absolute;
  top: 4px;
  left: 4px;
  font-size: 9px;
  font-weight: 500;
  padding: 1px 4px;
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.7);
  color: #ffffff;
}

.mobile-music-discover__featured-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mobile-music-discover__featured-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--a-color-text, #111111);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-music-discover__featured-sub {
  font-size: 12px;
  color: var(--a-color-text-secondary, #666666);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-music-discover__featured-play {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  color: var(--a-color-primary, #007aff);
  margin-top: 4px;
}

.mobile-music-discover__section {
  padding: 12px 16px;
}

.mobile-music-discover__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.mobile-music-discover__section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--a-color-text, #111111);
  margin: 0;
}

.mobile-music-discover__more-link {
  font-size: 12px;
  color: var(--a-color-text-secondary, #666666);
  text-decoration: none;
  font-weight: 500;
}

/* Albums Horizontal Scroll */
.mobile-music-discover__albums-scroll {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 6px;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.mobile-music-discover__albums-scroll::-webkit-scrollbar {
  display: none;
}

.mobile-music-discover__album-card {
  width: 112px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  cursor: pointer;
}

.mobile-music-discover__album-cover {
  position: relative;
  width: 112px;
  height: 112px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft, #eeeeee);
  background: #fbfbfb;
}

.mobile-music-discover__album-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-music-discover__album-art {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-text-muted, #999999);
}

.mobile-music-discover__album-year {
  position: absolute;
  bottom: 4px;
  right: 4px;
  font-size: 9px;
  padding: 1px 4px;
  background: rgba(0, 0, 0, 0.6);
  color: #ffffff;
  border-radius: 2px;
  font-family: monospace;
}

.mobile-music-discover__album-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--a-color-text, #111111);
  margin-top: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-music-discover__album-artist {
  font-size: 11px;
  color: var(--a-color-text-secondary, #666666);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Playlists Grid */
.mobile-music-discover__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.mobile-music-discover__card {
  display: flex;
  flex-direction: column;
  border-radius: 4px;
  border: 1px solid var(--a-color-border-soft, #f0f0f0);
  background-color: #ffffff;
  overflow: hidden;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.mobile-music-discover__card:active {
  background-color: var(--a-color-surface-hover, #fafafa);
}

.mobile-music-discover__card-cover {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  background-color: #f7f7f7;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mobile-music-discover__card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-music-discover__card-art {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-text-muted, #999999);
}

.mobile-music-discover__tag {
  position: absolute;
  top: 8px;
  left: 8px;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.05em;
  padding: 2px 5px;
  background-color: rgba(0, 0, 0, 0.6);
  color: #ffffff;
  border-radius: 2px;
  backdrop-filter: blur(4px);
}

.mobile-music-discover__card-info {
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mobile-music-discover__card-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--a-color-text, #111111);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-music-discover__card-count {
  font-size: 11px;
  color: var(--a-color-text-secondary, #777777);
}

/* Tracks List */
.mobile-music-discover__tracks {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--a-color-border-soft, #f0f0f0);
  border-radius: 4px;
  background-color: #ffffff;
  overflow: hidden;
}

.mobile-music-discover__track-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--a-color-border-soft, #f7f7f7);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.mobile-music-discover__track-item:last-child {
  border-bottom: none;
}

.mobile-music-discover__track-item:active {
  background-color: var(--a-color-surface-hover, #fafafa);
}

.mobile-music-discover__track-index {
  font-size: 12px;
  font-family: monospace;
  color: var(--a-color-text-muted, #999999);
  width: 20px;
  text-align: center;
  flex-shrink: 0;
}

.mobile-music-discover__track-cover {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  overflow: hidden;
  background-color: #f7f7f7;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--a-color-border-soft, #eeeeee);
}

.mobile-music-discover__track-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-music-discover__track-art {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-text-muted, #999999);
}

.mobile-music-discover__track-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mobile-music-discover__track-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--a-color-text, #111111);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-music-discover__track-artist {
  font-size: 11px;
  color: var(--a-color-text-secondary, #777777);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-music-discover__track-end {
  flex-shrink: 0;
}

.mobile-music-discover__track-duration {
  font-size: 11px;
  font-family: monospace;
  color: var(--a-color-text-muted, #999999);
}
</style>
