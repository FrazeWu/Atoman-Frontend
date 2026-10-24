<template>
  <div class="mobile-playlist-detail">
    <!-- Sticky Top Navigation Header -->
    <header class="mobile-playlist-detail__topbar">
      <button
        type="button"
        class="mobile-playlist-detail__back-btn"
        data-testid="playlist-back-btn"
        aria-label="返回"
        @click="handleBack"
      >
        <MIcon name="chevron-left" size="md" :stroke-width="2" />
      </button>
      <span class="mobile-playlist-detail__topbar-title">歌单详情</span>
      <div class="mobile-playlist-detail__topbar-space" />
    </header>

    <!-- Loading Skeleton -->
    <div v-if="loading" class="mobile-playlist-detail__loading">
      <div class="mobile-playlist-detail__hero-skeleton">
        <div class="mobile-playlist-detail__skeleton-cover" />
        <div class="mobile-playlist-detail__skeleton-meta">
          <div class="mobile-playlist-detail__skeleton-title" />
          <div class="mobile-playlist-detail__skeleton-sub" />
          <div class="mobile-playlist-detail__skeleton-btn" />
        </div>
      </div>
    </div>

    <!-- Content -->
    <main v-else-if="playlist" class="mobile-playlist-detail__content">
      <!-- Hero Header -->
      <section class="mobile-playlist-detail__hero">
        <div class="mobile-playlist-detail__cover-wrap">
          <img
            v-if="playlist.cover_url"
            :src="playlist.cover_url"
            :alt="playlist.name"
            class="mobile-playlist-detail__cover-img"
          />
          <div v-else class="mobile-playlist-detail__cover-art">
            <MIcon name="playlists" size="lg" />
          </div>
        </div>

        <div class="mobile-playlist-detail__info">
          <h1 class="mobile-playlist-detail__name">{{ playlist.name }}</h1>
          <p v-if="playlist.description" class="mobile-playlist-detail__desc">
            {{ playlist.description }}
          </p>
          <div class="mobile-playlist-detail__meta-row">
            <span v-if="playlist.creator?.display_name" class="mobile-playlist-detail__creator">
              创建者：{{ playlist.creator.display_name }}
            </span>
            <span class="mobile-playlist-detail__count">{{ songs.length }} 首歌曲</span>
          </div>

          <div class="mobile-playlist-detail__actions">
            <MButton
              size="sm"
              variant="primary"
              :disabled="songs.length === 0"
              data-testid="play-all-btn"
              @click="handlePlayAll"
            >
              <MIcon name="player-play" size="xs" />
              <span>播放全部</span>
            </MButton>
          </div>
        </div>
      </section>

      <!-- Songs List -->
      <section class="mobile-playlist-detail__songs" aria-label="歌曲列表">
        <div class="mobile-playlist-detail__list-header">
          <span class="mobile-playlist-detail__list-title">曲目列表</span>
        </div>

        <div v-if="songs.length > 0" class="mobile-playlist-detail__list">
          <div
            v-for="(song, index) in songs"
            :key="song.id"
            class="mobile-playlist-detail__song-item"
            data-testid="playlist-song-item"
            @click="playSong(song)"
          >
            <span class="mobile-playlist-detail__song-index">
              {{ String(index + 1).padStart(2, '0') }}
            </span>

            <div class="mobile-playlist-detail__song-cover">
              <img v-if="song.cover_url" :src="song.cover_url" :alt="song.title" />
              <div v-else class="mobile-playlist-detail__song-art">
                <MIcon name="note" size="sm" />
              </div>
            </div>

            <div class="mobile-playlist-detail__song-info">
              <span class="mobile-playlist-detail__song-title">{{ song.title }}</span>
              <span class="mobile-playlist-detail__song-artist">
                {{ song.artist || '未知艺术家' }} · {{ song.album || '未归类' }}
              </span>
            </div>

            <span v-if="formatDuration(song.duration)" class="mobile-playlist-detail__song-dur">
              {{ formatDuration(song.duration) }}
            </span>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="mobile-playlist-detail__empty" data-testid="playlist-empty">
          <MIcon name="note" size="lg" class="mobile-playlist-detail__empty-icon" />
          <p class="mobile-playlist-detail__empty-text">歌单内暂无歌曲</p>
        </div>
      </section>
    </main>

    <!-- Failed / Not Found -->
    <div v-else class="mobile-playlist-detail__empty" data-testid="playlist-not-found">
      <MIcon name="playlists" size="lg" class="mobile-playlist-detail__empty-icon" />
      <p class="mobile-playlist-detail__empty-text">未找到歌单信息</p>
      <MButton size="sm" variant="secondary" @click="handleBack">返回歌单列表</MButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getMusicPlaylist, listMusicSongs } from '@/api/musicV1'
import { useAudioPlayerStore } from '@/stores/player'
import type { Song } from '@/types'
import MButton from '@mobile/components/ui/MButton.vue'
import MIcon from '@mobile/components/ui/MIcon.vue'

export interface PlaylistDetailData {
  id: string
  name: string
  description?: string
  cover_url?: string
  creator?: { display_name?: string }
  songs?: any[]
}

const props = withDefaults(
  defineProps<{
    initialPlaylist?: PlaylistDetailData
    initialSongs?: Song[]
  }>(),
  {
    initialPlaylist: undefined,
    initialSongs: undefined,
  }
)

const route = useRoute()
const router = useRouter()
const player = useAudioPlayerStore()

const loading = ref(false)
const playlist = ref<PlaylistDetailData | null>(props.initialPlaylist || null)
const songs = ref<Song[]>(props.initialSongs || [])

function extractArtist(item: any, fallback?: string): string {
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
  if (fallback && fallback.trim()) return fallback.trim()
  return '未知艺术家'
}

function extractCover(item: any, fallback?: string): string {
  const c = item?.cover_url || item?.album?.cover_url || fallback || ''
  return typeof c === 'string' ? c.trim() : ''
}

function extractAlbumTitle(item: any, fallback?: string): string {
  if (typeof item?.album === 'string' && item.album.trim()) return item.album.trim()
  if (typeof item?.album?.title === 'string' && item.album.title.trim()) return item.album.title.trim()
  if (fallback && fallback.trim()) return fallback.trim()
  return ''
}

function toPlayerSong(item: any, playlistCover?: string): Song {
  const fallbackCover = playlistCover || playlist.value?.cover_url || ''
  return {
    id: item.id,
    title: item.title,
    artist: extractArtist(item),
    album: extractAlbumTitle(item),
    duration: typeof item.duration === 'number' && item.duration > 0
      ? item.duration
      : (item.duration_sec ?? item.duration_seconds ?? item.durationSeconds ?? 0),
    audio_url: item.audio_url || item.preview_url || '/audio/1.mp3',
    cover_url: extractCover(item, fallbackCover),
  }
}

function formatDuration(seconds?: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return ''
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

async function loadPlaylistData() {
  if (props.initialPlaylist) return
  const id = String(route.params.playlistId || '')
  if (!id) return

  loading.value = true
  try {
    const res = await getMusicPlaylist(id)
    const data = res as any
    if (data?.id) {
      playlist.value = {
        id: data.id,
        name: data.name || '歌单',
        description: data.description || '',
        cover_url: data.cover_url || '',
        creator: data.creator || { display_name: 'Atoman' },
      }
      if (data.songs && Array.isArray(data.songs)) {
        songs.value = data.songs.map((s: any) => toPlayerSong(s, playlist.value?.cover_url))
      } else {
        songs.value = []
      }
    } else {
      // Fallback: load general songs if this was a mock playlist ID
      playlist.value = {
        id,
        name: '精选歌单',
        description: '沉浸氛围音频与工作流音律精选',
        creator: { display_name: '官方推荐' },
      }
      try {
        const songsRes = await listMusicSongs({ page: 1, page_size: 15 })
        if (songsRes?.data?.length) {
          songs.value = songsRes.data.map((s) => toPlayerSong(s))
        }
      } catch {}
    }
  } catch {
    // If not found in DB, provide resilient fallback view
    playlist.value = {
      id,
      name: '精选歌单',
      description: '沉浸氛围音频与工作流音律精选',
      creator: { display_name: '官方推荐' },
    }
    try {
      const songsRes = await listMusicSongs({ page: 1, page_size: 15 })
      if (songsRes?.data?.length) {
        songs.value = songsRes.data.map((s) => toPlayerSong(s))
      }
    } catch {}
  } finally {
    loading.value = false
  }
}

function handleBack() {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back()
  } else {
    void router.push('/music/playlists')
  }
}

function playSong(song: Song) {
  player.playSong(song)
}

function handlePlayAll() {
  if (songs.value.length === 0) return
  player.playSong(songs.value[0])
}

onMounted(() => {
  void loadPlaylistData()
})
</script>

<style scoped>
.mobile-playlist-detail {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background-color: #ffffff;
  padding-bottom: var(--mobile-music-page-bottom, 2rem);
}

/* Top Sticky Navigation Bar */
.mobile-playlist-detail__topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 50px;
  padding: 0 8px;
  background-color: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--a-color-border-soft, #f0f0f0);
}

.mobile-playlist-detail__back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--a-color-text, #111111);
  cursor: pointer;
}

.mobile-playlist-detail__topbar-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--a-color-text, #111111);
}

.mobile-playlist-detail__topbar-space {
  width: 36px;
}

/* Hero Section */
.mobile-playlist-detail__hero {
  display: flex;
  gap: 16px;
  padding: 16px;
  border-bottom: 1px solid var(--a-color-border-soft, #f0f0f0);
}

.mobile-playlist-detail__cover-wrap {
  width: 104px;
  height: 104px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft, #eeeeee);
  background: #f7f7f7;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mobile-playlist-detail__cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-playlist-detail__cover-art {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-text-muted, #999999);
}

.mobile-playlist-detail__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.mobile-playlist-detail__name {
  font-size: 17px;
  font-weight: 600;
  color: var(--a-color-text, #111111);
  margin: 0;
  line-height: 1.3;
}

.mobile-playlist-detail__desc {
  font-size: 12px;
  color: var(--a-color-text-secondary, #666666);
  margin: 4px 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.mobile-playlist-detail__meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--a-color-text-muted, #888888);
  margin: 4px 0 8px 0;
}

.mobile-playlist-detail__actions {
  display: flex;
}

/* Songs Section */
.mobile-playlist-detail__songs {
  padding: 12px 16px;
}

.mobile-playlist-detail__list-header {
  margin-bottom: 8px;
}

.mobile-playlist-detail__list-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--a-color-text-secondary, #666666);
}

.mobile-playlist-detail__list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--a-color-border-soft, #f0f0f0);
  border-radius: 4px;
  overflow: hidden;
  background: #ffffff;
}

.mobile-playlist-detail__song-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--a-color-border-soft, #f7f7f7);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.mobile-playlist-detail__song-item:last-child {
  border-bottom: none;
}

.mobile-playlist-detail__song-item:active {
  background-color: var(--a-color-surface-hover, #fafafa);
}

.mobile-playlist-detail__song-index {
  font-size: 12px;
  font-family: monospace;
  color: var(--a-color-text-muted, #999999);
  width: 20px;
  text-align: center;
  flex-shrink: 0;
}

.mobile-playlist-detail__song-cover {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  overflow: hidden;
  background: #f7f7f7;
  border: 1px solid var(--a-color-border-soft, #eeeeee);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mobile-playlist-detail__song-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-playlist-detail__song-art {
  color: var(--a-color-text-muted, #999999);
}

.mobile-playlist-detail__song-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mobile-playlist-detail__song-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--a-color-text, #111111);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-playlist-detail__song-artist {
  font-size: 11px;
  color: var(--a-color-text-secondary, #777777);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-playlist-detail__song-dur {
  font-size: 11px;
  font-family: monospace;
  color: var(--a-color-text-muted, #999999);
  flex-shrink: 0;
}

.mobile-playlist-detail__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 48px 16px;
}

.mobile-playlist-detail__empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 4px;
  border: 1px solid var(--a-color-border-soft, #eeeeee);
  background: #ffffff;
  color: var(--a-color-text-muted, #999999);
  margin-bottom: 16px;
}

.mobile-playlist-detail__empty-text {
  font-size: 14px;
  color: var(--a-color-text-secondary, #666666);
  margin: 0 0 16px 0;
}
</style>
