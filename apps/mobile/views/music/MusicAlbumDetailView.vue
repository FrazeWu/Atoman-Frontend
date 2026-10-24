<template>
  <div class="mobile-album-detail">
    <!-- Sticky Top Navigation Header -->
    <header class="mobile-album-detail__topbar">
      <button
        type="button"
        class="mobile-album-detail__back-btn"
        data-testid="album-back-btn"
        aria-label="返回"
        @click="handleBack"
      >
        <MIcon name="chevron-left" size="md" :stroke-width="2" />
      </button>
      <span class="mobile-album-detail__topbar-title">专辑详情</span>
      <div class="mobile-album-detail__topbar-space" />
    </header>

    <!-- Loading Skeleton -->
    <div v-if="loading" class="mobile-album-detail__loading">
      <div class="mobile-album-detail__hero-skeleton">
        <div class="mobile-album-detail__skeleton-cover" />
        <div class="mobile-album-detail__skeleton-meta">
          <div class="mobile-album-detail__skeleton-title" />
          <div class="mobile-album-detail__skeleton-sub" />
        </div>
      </div>
    </div>

    <!-- Content -->
    <main v-else-if="album" class="mobile-album-detail__content">
      <!-- Hero Header -->
      <section class="mobile-album-detail__hero">
        <div class="mobile-album-detail__cover-wrap">
          <img
            v-if="album.cover_url"
            :src="album.cover_url"
            :alt="album.title"
            class="mobile-album-detail__cover-img"
          />
          <div v-else class="mobile-album-detail__cover-art">
            <MIcon name="note" size="lg" />
          </div>
        </div>

        <div class="mobile-album-detail__info">
          <h1 class="mobile-album-detail__name">{{ album.title }}</h1>
          <p class="mobile-album-detail__artist">{{ album.artist }}</p>
          <div class="mobile-album-detail__meta-row">
            <span v-if="album.year" class="mobile-album-detail__year">{{ album.year }} 年</span>
            <span class="mobile-album-detail__count">{{ songs.length }} 首歌曲</span>
          </div>

          <div class="mobile-album-detail__actions">
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
      <section class="mobile-album-detail__songs" aria-label="曲目列表">
        <div class="mobile-album-detail__list-header">
          <span class="mobile-album-detail__list-title">曲目列表</span>
        </div>

        <div v-if="songs.length > 0" class="mobile-album-detail__list">
          <div
            v-for="(song, index) in songs"
            :key="song.id"
            class="mobile-album-detail__song-item"
            data-testid="album-song-item"
            @click="playSong(song)"
          >
            <span class="mobile-album-detail__song-index">
              {{ String(index + 1).padStart(2, '0') }}
            </span>

            <div class="mobile-album-detail__song-cover">
              <img v-if="song.cover_url" :src="song.cover_url" :alt="song.title" />
              <div v-else class="mobile-album-detail__song-art">
                <MIcon name="note" size="sm" />
              </div>
            </div>

            <div class="mobile-album-detail__song-info">
              <span class="mobile-album-detail__song-title">{{ song.title }}</span>
              <span class="mobile-album-detail__song-artist">
                {{ song.artist || '未知艺术家' }} · {{ song.album || album?.title || '专辑' }}
              </span>
            </div>

            <span v-if="formatDuration(song.duration)" class="mobile-album-detail__song-dur">
              {{ formatDuration(song.duration) }}
            </span>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="mobile-album-detail__empty" data-testid="album-empty">
          <MIcon name="note" size="lg" class="mobile-album-detail__empty-icon" />
          <p class="mobile-album-detail__empty-text">专辑内暂无歌曲</p>
        </div>
      </section>
    </main>

    <!-- Not Found -->
    <div v-else class="mobile-album-detail__empty" data-testid="album-not-found">
      <MIcon name="note" size="lg" class="mobile-album-detail__empty-icon" />
      <p class="mobile-album-detail__empty-text">未找到专辑信息</p>
      <MButton size="sm" variant="secondary" @click="handleBack">返回发现页</MButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getMusicAlbum, listMusicSongs } from '@/api/musicV1'
import { useAudioPlayerStore } from '@/stores/player'
import type { Song } from '@/types'
import MButton from '@mobile/components/ui/MButton.vue'
import MIcon from '@mobile/components/ui/MIcon.vue'

export interface AlbumDetailData {
  id: string
  title: string
  artist: string
  year?: string | number
  cover_url?: string
}

const props = withDefaults(
  defineProps<{
    initialAlbum?: AlbumDetailData
    initialSongs?: Song[]
  }>(),
  {
    initialAlbum: undefined,
    initialSongs: undefined,
  }
)

const route = useRoute()
const router = useRouter()
const player = useAudioPlayerStore()

const loading = ref(false)
const album = ref<AlbumDetailData | null>(props.initialAlbum || null)
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

function toPlayerSong(item: any, albumContext?: { cover_url?: string; artist?: string; title?: string }): Song {
  const fallbackCover = albumContext?.cover_url || album.value?.cover_url || ''
  const fallbackArtist = albumContext?.artist || album.value?.artist || ''
  const fallbackAlbum = albumContext?.title || album.value?.title || ''

  return {
    id: item.id,
    title: item.title,
    artist: extractArtist(item, fallbackArtist),
    album: extractAlbumTitle(item, fallbackAlbum),
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

async function loadAlbumData() {
  if (props.initialAlbum) return
  const id = String(route.params.albumId || '')
  if (!id) return

  loading.value = true
  try {
    const res = await getMusicAlbum(id)
    const data = res as any
    if (data?.id) {
      const albumArtist = extractArtist(data, '')
      album.value = {
        id: data.id,
        title: data.title || '专辑',
        artist: albumArtist,
        year: data.year || data.release_year || '',
        cover_url: data.cover_url || '',
      }
      if (data.songs && Array.isArray(data.songs)) {
        songs.value = data.songs.map((s: any) => toPlayerSong(s, {
          cover_url: album.value?.cover_url,
          artist: albumArtist,
          title: album.value?.title,
        }))
      } else {
        songs.value = []
      }
    } else {
      album.value = { id, title: '专辑', artist: 'Ye', year: 2026 }
      try {
        const songsRes = await listMusicSongs({ page: 1, page_size: 15 })
        if (songsRes?.data?.length) {
          songs.value = songsRes.data.map((s) => toPlayerSong(s))
        }
      } catch {}
    }
  } catch {
    album.value = { id, title: '精选专辑', artist: 'Ye', year: 2026 }
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
    void router.push('/music')
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
  void loadAlbumData()
})
</script>

<style scoped>
.mobile-album-detail {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background-color: #ffffff;
  padding-bottom: var(--mobile-music-page-bottom, 2rem);
}

.mobile-album-detail__topbar {
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

.mobile-album-detail__back-btn {
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

.mobile-album-detail__topbar-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--a-color-text, #111111);
}

.mobile-album-detail__topbar-space {
  width: 36px;
}

.mobile-album-detail__hero {
  display: flex;
  gap: 16px;
  padding: 16px;
  border-bottom: 1px solid var(--a-color-border-soft, #f0f0f0);
}

.mobile-album-detail__cover-wrap {
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

.mobile-album-detail__cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-album-detail__cover-art {
  color: var(--a-color-text-muted, #999999);
}

.mobile-album-detail__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.mobile-album-detail__name {
  font-size: 17px;
  font-weight: 600;
  color: var(--a-color-text, #111111);
  margin: 0;
  line-height: 1.3;
}

.mobile-album-detail__artist {
  font-size: 13px;
  color: var(--a-color-text-secondary, #666666);
  margin: 4px 0 0 0;
}

.mobile-album-detail__meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--a-color-text-muted, #888888);
  margin: 4px 0 8px 0;
}

.mobile-album-detail__actions {
  display: flex;
}

.mobile-album-detail__songs {
  padding: 12px 16px;
}

.mobile-album-detail__list-header {
  margin-bottom: 8px;
}

.mobile-album-detail__list-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--a-color-text-secondary, #666666);
}

.mobile-album-detail__list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--a-color-border-soft, #f0f0f0);
  border-radius: 4px;
  overflow: hidden;
  background: #ffffff;
}

.mobile-album-detail__song-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--a-color-border-soft, #f7f7f7);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.mobile-album-detail__song-item:last-child {
  border-bottom: none;
}

.mobile-album-detail__song-item:active {
  background-color: var(--a-color-surface-hover, #fafafa);
}

.mobile-album-detail__song-index {
  font-size: 12px;
  font-family: monospace;
  color: var(--a-color-text-muted, #999999);
  width: 20px;
  text-align: center;
  flex-shrink: 0;
}

.mobile-album-detail__song-cover {
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

.mobile-album-detail__song-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-album-detail__song-art {
  color: var(--a-color-text-muted, #999999);
}

.mobile-album-detail__song-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mobile-album-detail__song-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--a-color-text, #111111);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-album-detail__song-artist {
  font-size: 11px;
  color: var(--a-color-text-secondary, #777777);
}

.mobile-album-detail__song-dur {
  font-size: 11px;
  font-family: monospace;
  color: var(--a-color-text-muted, #999999);
  flex-shrink: 0;
}

.mobile-album-detail__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 48px 16px;
}

.mobile-album-detail__empty-icon {
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

.mobile-album-detail__empty-text {
  font-size: 14px;
  color: var(--a-color-text-secondary, #666666);
  margin: 0 0 16px 0;
}
</style>
