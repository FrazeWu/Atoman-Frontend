<template>
  <div class="mobile-music-discover">
    <!-- Header Title -->
    <header class="mobile-music-discover__header">
      <h1 class="mobile-music-discover__title">发现音乐</h1>
    </header>

    <div v-if="!loading && !hasContent" class="mobile-music-discover__empty" role="status">
      <p>{{ loadError ? '音乐加载失败' : '暂时没有可展示的音乐' }}</p>
      <button v-if="loadError" type="button" @click="loadData">重新加载</button>
      <router-link v-else to="/music/search">前往音乐搜索</router-link>
    </div>

    <div v-if="loading && !hasContent" class="mobile-music-discover__loading" role="status" aria-label="正在加载音乐">
      <div class="mobile-music-discover__loading-hero" />
      <div class="mobile-music-discover__loading-heading" />
      <div class="mobile-music-discover__loading-albums">
        <div v-for="n in 3" :key="n" class="mobile-music-discover__loading-album" />
      </div>
      <span class="sr-only">正在加载专辑、艺人和歌单</span>
    </div>

    <!-- Featured Recommendation Card -->
    <RouterLink
      v-if="featuredRecommendation"
      :to="featuredRecommendation.type === 'album' ? '/music/album/' + featuredRecommendation.id : '/music/playlist/' + featuredRecommendation.id"
      class="mobile-music-discover__featured"
      data-testid="featured-recommendation"
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
    </RouterLink>

    <!-- Featured Albums Section -->
    <section v-if="albums.length > 0" class="mobile-music-discover__section" aria-label="热门专辑">
      <div class="mobile-music-discover__section-header">
        <h2 class="mobile-music-discover__section-title">热门专辑</h2>
        <router-link to="/music/search?tab=albums" class="mobile-music-discover__more-link">
          查看全部
        </router-link>
      </div>

      <div class="mobile-music-discover__albums-scroll">
        <RouterLink
          v-for="album in albums"
          :key="album.id"
          :to="'/music/album/' + album.id"
          class="mobile-music-discover__album-card"
          data-testid="album-card"
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
        </RouterLink>
      </div>
    </section>

    <!-- Featured Artists Section -->
    <section v-if="artists.length > 0" class="mobile-music-discover__section" aria-label="热门艺人">
      <div class="mobile-music-discover__section-header">
        <h2 class="mobile-music-discover__section-title">热门艺人</h2>
        <router-link to="/music/search?tab=artists" class="mobile-music-discover__more-link">
          查看全部
        </router-link>
      </div>

      <div class="mobile-music-discover__artists-scroll">
        <RouterLink
          v-for="artist in artists"
          :key="artist.id"
          :to="'/music/artist/' + artist.id"
          class="mobile-music-discover__artist-card"
          data-testid="artist-card"
        >
          <div class="mobile-music-discover__artist-avatar">
            <img
              v-if="artist.avatar_url"
              :src="artist.avatar_url"
              :alt="artist.name"
              class="mobile-music-discover__artist-img"
              loading="lazy"
            />
            <div v-else class="mobile-music-discover__artist-art">
              <MIcon name="person" size="md" />
            </div>
          </div>
          <span class="mobile-music-discover__artist-name">{{ artist.name }}</span>
          <span v-if="artist.nationality" class="mobile-music-discover__artist-sub">{{ artist.nationality }}</span>
        </RouterLink>
      </div>
    </section>

    <!-- Curated Playlists Section -->
    <section v-if="playlists.length > 0" class="mobile-music-discover__section" aria-label="精选歌单">
      <div class="mobile-music-discover__section-header">
        <h2 class="mobile-music-discover__section-title">精选歌单</h2>
        <router-link to="/music/playlists" class="mobile-music-discover__more-link">
          查看全部
        </router-link>
      </div>

      <div class="mobile-music-discover__grid">
        <RouterLink
          v-for="playlist in playlists"
          :key="playlist.id"
          :to="'/music/playlist/' + playlist.id"
          class="mobile-music-discover__card"
          data-testid="playlist-card"
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

          </div>
          <div class="mobile-music-discover__card-info">
            <span class="mobile-music-discover__card-name">{{ playlist.name }}</span>
            <span class="mobile-music-discover__card-count">{{ playlist.song_count || 0 }} 首歌曲</span>
          </div>
        </RouterLink>
      </div>
    </section>

    <!-- Recent Tracks Section -->
    <section v-if="recentTracks.length > 0" class="mobile-music-discover__section" aria-label="最近在听">
      <div class="mobile-music-discover__section-header">
        <h2 class="mobile-music-discover__section-title">新曲上架</h2>
      </div>

      <div class="mobile-music-discover__tracks">
        <button
          v-for="(track, index) in recentTracks"
          :key="track.id || index"
          type="button"
          class="mobile-music-discover__track-item"
          :disabled="!canPlayMusicSong(track)"
          :aria-label="canPlayMusicSong(track) ? '播放' + track.title + '，' + (track.artist || '未知艺术家') : track.title + '，暂无可播放音源'"
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
            <span v-if="!canPlayMusicSong(track)" class="mobile-music-no-audio">暂无音源</span>
            <span v-else-if="formatDuration(track.duration)" class="mobile-music-discover__track-duration">{{ formatDuration(track.duration) }}</span>
          </div>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  getMusicHome,
  listMusicAlbums,
  listMusicArtists,
  listMusicSongs,
  listPublicMusicPlaylists,
  type MusicPlaylistSummary,
} from '@/api/musicV1'
import { useAudioPlayerStore } from '@/stores/player'
import type { Song } from '@/types'
import { musicAudioFromApi, musicPlaybackDetailsFromApi, canPlayMusicSong } from '@mobile/mobileMusicPlayback'
import MIcon from '@mobile/components/ui/MIcon.vue'

export interface MobileAlbumItem {
  id: string
  title: string
  artist: string
  year?: string | number
  cover_url?: string
  song_count?: number
}

export interface MobileArtistItem {
  id: string
  name: string
  avatar_url?: string
  nationality?: string
}

const player = useAudioPlayerStore()

const playlists = ref<MusicPlaylistSummary[]>([])
const albums = ref<MobileAlbumItem[]>([])
const artists = ref<MobileArtistItem[]>([])
const recentTracks = ref<Song[]>([])
const loading = ref(false)
const loadError = ref(false)
const hasContent = computed(() => albums.value.length > 0 || artists.value.length > 0
  || playlists.value.length > 0 || recentTracks.value.length > 0)

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
      subtitle: String(first.song_count || 0) + ' 首歌曲',
      cover_url: first.cover_url,
      type: 'playlist',
    }
  }
  return null
})

function extractArtist(item: any): string {
  if (typeof item?.artist === 'string' && item.artist.trim()) return item.artist.trim()
  if (Array.isArray(item?.artist_credits) && item.artist_credits.length > 0) {
    const names = item.artist_credits
      .map((c: any) => c?.artist?.name || c?.name || c?.display_name)
      .filter((n: any): n is string => typeof n === 'string' && Boolean(n.trim()))
    if (names.length > 0) return names.join(' / ')
  }
  if (Array.isArray(item?.artists) && item.artists.length > 0) {
    const names = item.artists
      .map((a: any) => a?.name || a?.display_name)
      .filter((n: any): n is string => typeof n === 'string' && Boolean(n.trim()))
    if (names.length > 0) return names.join(' / ')
  }
  return '未知艺术家'
}

function toPlayerSong(item: any): Song {
  return {
    id: item.id,
    title: item.title,
    artist: extractArtist(item),
    album: typeof item.album === 'string'
      ? item.album
      : item.album?.title || '',
    duration: typeof item.duration === 'number' && item.duration > 0
      ? item.duration
      : (item.duration_sec ?? item.duration_seconds ?? item.durationSeconds ?? 0),
    ...musicAudioFromApi(item),
    ...musicPlaybackDetailsFromApi(item),
    cover_url: item.cover_url || item.album?.cover_url || '',
  }
}

function toAlbumItem(item: any): MobileAlbumItem {
  return {
    id: item.id,
    title: item.title,
    artist: extractArtist(item),
    year: item.year || item.release_year || '',
    cover_url: item.cover_url || '',
    song_count: item.song_count || 0,
  }
}

function toArtistItem(item: any): MobileArtistItem {
  return {
    id: item.id,
    name: item.name || item.display_name || '歌手',
    avatar_url: item.image_url || item.avatar_url || '',
    nationality: item.nationality || '',
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
  loadError.value = false
  playlists.value = []
  albums.value = []
  artists.value = []
  recentTracks.value = []
  let failures = 0
  let completed = 0
  const settle = async <T>(promise: Promise<T>, update: (value: T) => void) => {
    try {
      update(await promise)
    } catch {
      failures += 1
    } finally {
      completed += 1
      if (completed === 5) {
        loadError.value = failures === 5
        loading.value = false
      }
    }
  }
  await Promise.all([
    settle(getMusicHome(), (data) => {
      const tracks = data?.recently_played || []
      if (tracks.length > 0) recentTracks.value = tracks.map(item => toPlayerSong(item.song ? item.song : item))
    }),
    settle(listPublicMusicPlaylists({ page: 1, page_size: 4 }), data => {
      playlists.value = data?.data || []
    }),
    settle(listMusicAlbums({ page: 1, page_size: 10 }), data => {
      albums.value = (data?.data || []).map(toAlbumItem)
    }),
    settle(listMusicSongs({ page: 1, page_size: 10 }), data => {
      if (!recentTracks.value.length) recentTracks.value = (data?.data || []).map(toPlayerSong)
    }),
    settle(listMusicArtists({ page: 1, page_size: 10 }), data => {
      artists.value = (data?.data || []).map(toArtistItem)
    }),
  ])
}

function playTrack(track: Song) {
  if (!canPlayMusicSong(track)) return
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
  padding-bottom: var(--mobile-music-page-bottom, 2rem);
}

.mobile-music-discover__header {
  padding: 16px 16px 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
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
  border-radius: 8px;
  border: none !important;
  background: #f8fafc;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.mobile-music-discover__featured:active {
  background-color: #f1f5f9;
}

.mobile-music-discover__featured-cover {
  position: relative;
  width: 76px;
  height: 76px;
  border-radius: 6px;
  overflow: hidden;
  border: none;
  background: #f1f5f9;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
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
  padding: 1px 5px;
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.65);
  color: #ffffff;
  backdrop-filter: blur(4px);
}

.mobile-music-discover__featured-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.mobile-music-discover__featured-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--a-color-text, #0f172a);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-music-discover__featured-sub {
  font-size: 12px;
  color: var(--a-color-text-secondary, #64748b);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-music-discover__featured-play {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  font-weight: 600;
  color: #1ed760;
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
  font-weight: 700;
  color: var(--a-color-text, #0f172a);
  margin: 0;
}

.mobile-music-discover__more-link {
  font-size: 12px;
  color: var(--a-color-text-secondary, #64748b);
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
  width: 116px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  text-decoration: none;
}

.mobile-music-discover__album-cover {
  position: relative;
  width: 116px;
  height: 116px;
  border-radius: 6px;
  overflow: hidden;
  border: none !important;
  background: #f1f5f9;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
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
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
  margin-top: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-music-discover__album-artist {
  font-size: 11.5px;
  color: var(--a-color-text-secondary, #64748b);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Artists Scroll */
.mobile-music-discover__artists-scroll {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding-bottom: 8px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.mobile-music-discover__artists-scroll::-webkit-scrollbar {
  display: none;
}

.mobile-music-discover__artist-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  width: 76px;
  flex-shrink: 0;
  cursor: pointer;
  text-decoration: none;
}

.mobile-music-discover__artist-avatar {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  overflow: hidden;
  background-color: #f1f5f9;
  border: none !important;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.mobile-music-discover__artist-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-music-discover__artist-art {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-text-muted, #999999);
}

.mobile-music-discover__artist-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-music-discover__artist-sub {
  font-size: 10.5px;
  color: var(--a-color-text-secondary, #64748b);
  margin-top: 2px;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Playlists Grid - Spotify Borderless Cards */
.mobile-music-discover__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}

.mobile-music-discover__card {
  display: flex;
  flex-direction: column;
  border-radius: 6px;
  border: none !important;
  background-color: transparent !important;
  overflow: hidden;
  cursor: pointer;
  text-decoration: none;
  transition: opacity 0.15s ease;
}

.mobile-music-discover__card:active {
  opacity: 0.8;
}

.mobile-music-discover__card-cover {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  background-color: #f1f5f9;
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
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

.mobile-music-discover__card-info {
  padding: 6px 2px 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mobile-music-discover__card-name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-music-discover__card-count {
  font-size: 11.5px;
  color: var(--a-color-text-secondary, #64748b);
}

/* Tracks List - Borderless Flat Rows */
.mobile-music-discover__tracks {
  display: flex;
  flex-direction: column;
  border: none !important;
  background: transparent !important;
}

.mobile-music-discover__track-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
  min-height: 48px;
  border: none !important;
  border-bottom: none !important;
  background: transparent;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.15s ease;
}

.mobile-music-discover__track-item:active {
  background-color: #f8fafc;
}

.mobile-music-discover__track-index {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: #94a3b8;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
}

.mobile-music-discover__track-cover {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  overflow: hidden;
  background-color: #f1f5f9;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none !important;
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
  text-align: left;
}

.mobile-music-discover__track-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--a-color-text, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-music-discover__track-artist {
  font-size: 12px;
  color: var(--a-color-text-secondary, #64748b);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-music-discover__track-end {
  flex-shrink: 0;
}

.mobile-music-discover__track-duration {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: #94a3b8;
}

.mobile-music-discover__track-duration {
  font-size: 11px;
  font-family: monospace;
  color: var(--a-color-text-muted, #999999);
}
.mobile-music-discover__empty {
  padding: 24px 16px;
  text-align: center;
  color: var(--a-color-muted, #64748b);
}
.mobile-music-discover__empty button,
.mobile-music-discover__empty a {
  display: inline-flex;
  margin-top: 8px;
  min-height: 44px;
  padding: 10px 16px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control, 4px);
  background: var(--a-color-bg, #fff);
  color: var(--a-color-fg, #0f172a);
}
</style>

<style scoped>
.mobile-music-discover__loading { padding: 8px 16px 18px; display: grid; gap: 16px; }
.mobile-music-discover__loading-hero { height: 170px; border-radius: 12px; }
.mobile-music-discover__loading-heading { width: 36%; height: 20px; border-radius: 5px; }
.mobile-music-discover__loading-albums { display: flex; gap: 12px; overflow: hidden; }
.mobile-music-discover__loading-album { flex: 0 0 106px; height: 130px; border-radius: 9px; }
.mobile-music-discover__loading-hero,
.mobile-music-discover__loading-heading,
.mobile-music-discover__loading-album { background: #f0f2f5; animation: mobile-music-shimmer 1.5s ease-in-out infinite alternate; }
@keyframes mobile-music-shimmer { to { background: #e4e8ee; } }
@media (prefers-reduced-motion: reduce) {
  .mobile-music-discover__loading-hero,
  .mobile-music-discover__loading-heading,
  .mobile-music-discover__loading-album { animation: none; }
}
</style>

<style scoped>
.mobile-music-discover__featured,
.mobile-music-discover__album-card,
.mobile-music-discover__artist-card,
.mobile-music-discover__card {
  color: inherit;
  text-decoration: none;
}
.mobile-music-discover__featured:focus-visible,
.mobile-music-discover__album-card:focus-visible,
.mobile-music-discover__artist-card:focus-visible,
.mobile-music-discover__card:focus-visible,
.mobile-music-discover__track-item:focus-visible {
  outline: 2px solid var(--a-color-primary, #2563eb);
  outline-offset: 2px;
}
.mobile-music-discover__track-item {
  width: 100%;
  min-height: 56px;
  text-align: left;
  border: 0;
  border-bottom: 1px solid var(--a-color-border-soft, #f1f1f1);
  background: transparent;
  font: inherit;
  color: inherit;
}
</style>
