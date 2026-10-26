<template>
  <div class="mobile-artist-detail">
    <!-- Sticky Top Navigation Header -->
    <header class="mobile-artist-detail__topbar">
      <button
        type="button"
        class="mobile-artist-detail__back-btn"
        data-testid="artist-back-btn"
        aria-label="返回"
        @click="handleBack"
      >
        <MIcon name="chevron-left" size="md" :stroke-width="2" />
      </button>
      <span class="mobile-artist-detail__topbar-title">歌手详情</span>
      <div class="mobile-artist-detail__topbar-space" />
    </header>

    <!-- Loading Skeleton -->
    <div v-if="loading" class="mobile-artist-detail__loading">
      <div class="mobile-artist-detail__hero-skeleton">
        <div class="mobile-artist-detail__skeleton-avatar" />
        <div class="mobile-artist-detail__skeleton-meta">
          <div class="mobile-artist-detail__skeleton-title" />
          <div class="mobile-artist-detail__skeleton-sub" />
        </div>
      </div>
    </div>

    <!-- Content -->
    <main v-else-if="artist" class="mobile-artist-detail__content">
      <!-- Hero Header -->
      <section class="mobile-artist-detail__hero">
        <div class="mobile-artist-detail__avatar-wrap">
          <img
            v-if="artist.avatar_url"
            :src="artist.avatar_url"
            :alt="artist.name"
            class="mobile-artist-detail__avatar-img"
          />
          <div v-else class="mobile-artist-detail__avatar-art">
            <MIcon name="person" size="lg" />
          </div>
        </div>

        <div class="mobile-artist-detail__info">
          <h1 class="mobile-artist-detail__name">{{ artist.name }}</h1>
          <p v-if="artist.nationality" class="mobile-artist-detail__meta">
            {{ artist.nationality }}
          </p>
          <p v-if="artist.bio" class="mobile-artist-detail__bio">
            {{ artist.bio }}
          </p>

          <div class="mobile-artist-detail__actions">
            <MButton
              size="sm"
              variant="primary"
              :disabled="songs.length === 0"
              data-testid="artist-play-all-btn"
              @click="handlePlayAll"
            >
              <MIcon name="player-play" size="xs" />
              <span>播放热门单曲</span>
            </MButton>
          </div>
        </div>
      </section>

      <!-- Albums Section -->
      <section v-if="albums.length > 0" class="mobile-artist-detail__section" aria-label="专辑作品">
        <div class="mobile-artist-detail__section-header">
          <span class="mobile-artist-detail__section-title">专辑作品</span>
          <span class="mobile-artist-detail__count">{{ albums.length }} 张</span>
        </div>

        <div class="mobile-artist-detail__albums-scroll">
          <div
            v-for="album in albums"
            :key="album.id"
            class="mobile-artist-detail__album-card"
            data-testid="artist-album-item"
            @click="openAlbum(album.id)"
          >
            <div class="mobile-artist-detail__album-cover">
              <img v-if="album.cover_url" :src="album.cover_url" :alt="album.title" />
              <div v-else class="mobile-artist-detail__album-art">
                <MIcon name="note" size="md" />
              </div>
              <span v-if="album.year" class="mobile-artist-detail__album-year">{{ album.year }}</span>
            </div>
            <span class="mobile-artist-detail__album-name">{{ album.title }}</span>
          </div>
        </div>
      </section>

      <!-- Songs List -->
      <section class="mobile-artist-detail__songs" aria-label="热门单曲">
        <div class="mobile-artist-detail__section-header">
          <span class="mobile-artist-detail__section-title">热门单曲</span>
          <span class="mobile-artist-detail__count">{{ songs.length }} 首</span>
        </div>

        <div v-if="songs.length > 0" class="mobile-artist-detail__list">
          <div
            v-for="(song, index) in songs"
            :key="song.id"
            class="mobile-artist-detail__song-item"
            data-testid="artist-song-item"
            @click="playSong(song)"
          >
            <span class="mobile-artist-detail__song-index">
              {{ String(index + 1).padStart(2, '0') }}
            </span>

            <div class="mobile-artist-detail__song-cover">
              <img v-if="song.cover_url" :src="song.cover_url" :alt="song.title" />
              <div v-else class="mobile-artist-detail__song-art">
                <MIcon name="note" size="sm" />
              </div>
            </div>

            <div class="mobile-artist-detail__song-info">
              <span class="mobile-artist-detail__song-title">{{ song.title }}</span>
              <span class="mobile-artist-detail__song-album">
                {{ song.album || '单曲' }}
              </span>
            </div>

            <span v-if="formatDuration(song.duration)" class="mobile-artist-detail__song-dur">
              {{ formatDuration(song.duration) }}
            </span>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="mobile-artist-detail__empty" data-testid="artist-empty">
          <MIcon name="note" size="lg" class="mobile-artist-detail__empty-icon" />
          <p class="mobile-artist-detail__empty-text">暂无收录单曲</p>
        </div>
      </section>
    </main>

    <!-- Not Found -->
    <div v-else class="mobile-artist-detail__empty" data-testid="artist-not-found">
      <MIcon name="person" size="lg" class="mobile-artist-detail__empty-icon" />
      <p class="mobile-artist-detail__empty-text">未找到歌手信息</p>
      <MButton size="sm" variant="secondary" @click="handleBack">返回发现页</MButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getMusicArtist,
  listMusicAlbums,
  listMusicSongs,
} from '@/api/musicV1'
import { useAudioPlayerStore } from '@/stores/player'
import type { Song } from '@/types'
import MIcon from '@mobile/components/ui/MIcon.vue'
import MButton from '@mobile/components/ui/MButton.vue'

export interface MobileArtistDetailData {
  id: string
  name: string
  avatar_url?: string
  nationality?: string
  bio?: string
}

export interface MobileArtistAlbumItem {
  id: string
  title: string
  year?: string | number
  cover_url?: string
}

const props = withDefaults(
  defineProps<{
    initialArtist?: MobileArtistDetailData
    initialSongs?: Song[]
    initialAlbums?: MobileArtistAlbumItem[]
  }>(),
  {
    initialArtist: undefined,
    initialSongs: undefined,
    initialAlbums: undefined,
  }
)

const route = useRoute()
const router = useRouter()
const player = useAudioPlayerStore()

const loading = ref(false)
const artist = ref<MobileArtistDetailData | null>(props.initialArtist || null)
const songs = ref<Song[]>(props.initialSongs || [])
const albums = ref<MobileArtistAlbumItem[]>(props.initialAlbums || [])

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

function toPlayerSong(item: any, artistContext?: { avatar_url?: string; name?: string }): Song {
  const fallbackCover = artistContext?.avatar_url || artist.value?.avatar_url || ''
  const fallbackArtist = artistContext?.name || artist.value?.name || ''

  return {
    id: item.id,
    title: item.title,
    artist: extractArtist(item, fallbackArtist),
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

async function loadArtistData() {
  if (props.initialArtist) return
  const id = String(route.params.artistId || '')
  if (!id) return

  loading.value = true
  try {
    const res = await getMusicArtist(id)
    const data = res as any
    if (data?.id) {
      artist.value = {
        id: data.id,
        name: data.name || data.display_name || '歌手',
        avatar_url: data.image_url || data.avatar_url || '',
        nationality: data.nationality || '',
        bio: data.bio || '',
      }

      if (data.albums && Array.isArray(data.albums)) {
        albums.value = data.albums.map((alb: any) => ({
          id: alb.id,
          title: alb.title || '专辑',
          year: alb.year || alb.release_year || '',
          cover_url: alb.cover_url || '',
        }))
      }

      try {
        const songsRes = await listMusicSongs({ artist_id: id, page: 1, page_size: 20 })
        if (songsRes?.data?.length) {
          songs.value = songsRes.data.map((s) => toPlayerSong(s, {
            avatar_url: artist.value?.avatar_url,
            name: artist.value?.name,
          }))
        } else {
          songs.value = []
        }
      } catch {
        songs.value = []
      }
    } else {
      artist.value = {
        id,
        name: '热门歌手',
        nationality: '国际',
        bio: '',
      }
      try {
        const songsRes = await listMusicSongs({ page: 1, page_size: 15 })
        if (songsRes?.data?.length) {
          songs.value = songsRes.data.map((s) => toPlayerSong(s))
        }
      } catch {}
    }
  } catch {
    artist.value = {
      id,
      name: '精选歌手',
      nationality: '国际',
      bio: '',
    }
    try {
      const [songsRes, albumsRes] = await Promise.allSettled([
        listMusicSongs({ page: 1, page_size: 15 }),
        listMusicAlbums({ page: 1, page_size: 6 }),
      ])
      if (songsRes.status === 'fulfilled' && songsRes.value?.data?.length) {
        songs.value = songsRes.value.data.map((s) => toPlayerSong(s))
      }
      if (albumsRes.status === 'fulfilled' && albumsRes.value?.data?.length) {
        albums.value = albumsRes.value.data.map((alb: any) => ({
          id: alb.id,
          title: alb.title || '专辑',
          year: alb.year || alb.release_year || '',
          cover_url: alb.cover_url || '',
        }))
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

function openAlbum(id: string) {
  void router.push(`/music/album/${id}`)
}

onMounted(() => {
  void loadArtistData()
})
</script>

<style scoped>
.mobile-artist-detail {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background-color: var(--a-color-bg, #ffffff);
  padding-bottom: var(--mobile-music-page-bottom, 2rem);
}

.mobile-artist-detail__topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 12px;
  background-color: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--a-color-border-soft, #f0f0f0);
}

.mobile-artist-detail__back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--a-color-text, #111111);
  border-radius: 4px;
}

.mobile-artist-detail__topbar-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--a-color-text, #111111);
}

.mobile-artist-detail__topbar-space {
  width: 36px;
}

.mobile-artist-detail__loading {
  padding: 24px 16px;
}

.mobile-artist-detail__hero-skeleton {
  display: flex;
  gap: 16px;
  align-items: center;
}

.mobile-artist-detail__skeleton-avatar {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  background-color: #f0f0f0;
  animation: pulse 1.5s infinite ease-in-out;
}

.mobile-artist-detail__skeleton-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mobile-artist-detail__skeleton-title {
  height: 20px;
  width: 60%;
  background-color: #f0f0f0;
  border-radius: 4px;
  animation: pulse 1.5s infinite ease-in-out;
}

.mobile-artist-detail__skeleton-sub {
  height: 14px;
  width: 40%;
  background-color: #f0f0f0;
  border-radius: 4px;
  animation: pulse 1.5s infinite ease-in-out;
}

.mobile-artist-detail__hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 24px 16px 16px;
  border-bottom: 1px solid var(--a-color-border-soft, #f0f0f0);
}

.mobile-artist-detail__avatar-wrap {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  overflow: hidden;
  background-color: var(--a-color-surface-muted, #f5f5f5);
  border: 1px solid var(--a-color-border-soft, #eeeeee);
  box-shadow: none !important;
  margin-bottom: 12px;
}

.mobile-artist-detail__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-artist-detail__avatar-art {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-text-muted, #999999);
}

.mobile-artist-detail__info {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.mobile-artist-detail__name {
  font-size: 20px;
  font-weight: 700;
  color: var(--a-color-text, #111111);
  margin: 0 0 4px 0;
}

.mobile-artist-detail__meta {
  font-size: 13px;
  color: var(--a-color-text-secondary, #666666);
  margin: 0 0 8px 0;
}

.mobile-artist-detail__bio {
  font-size: 12px;
  color: var(--a-color-text-muted, #888888);
  line-height: 1.5;
  max-width: 320px;
  margin: 0 0 16px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.mobile-artist-detail__actions {
  display: flex;
  gap: 12px;
}

.mobile-artist-detail__section {
  padding: 16px 0 8px;
  border-bottom: 1px solid var(--a-color-border-soft, #f0f0f0);
}

.mobile-artist-detail__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 12px;
}

.mobile-artist-detail__section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--a-color-text, #111111);
}

.mobile-artist-detail__count {
  font-size: 12px;
  color: var(--a-color-text-muted, #999999);
}

.mobile-artist-detail__albums-scroll {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 0 16px 8px;
  scrollbar-width: none;
}

.mobile-artist-detail__albums-scroll::-webkit-scrollbar {
  display: none;
}

.mobile-artist-detail__album-card {
  flex: 0 0 100px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
}

.mobile-artist-detail__album-cover {
  position: relative;
  width: 100px;
  height: 100px;
  border-radius: 4px;
  overflow: hidden;
  background-color: #f5f5f5;
  border: 1px solid var(--a-color-border-soft, #eeeeee);
  margin-bottom: 6px;
}

.mobile-artist-detail__album-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-artist-detail__album-art {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-text-muted, #999999);
}

.mobile-artist-detail__album-year {
  position: absolute;
  bottom: 4px;
  right: 4px;
  font-size: 9px;
  background: var(--a-color-primary, #0f172a);
  color: var(--a-color-primary-contrast, #ffffff);
  padding: 1px 4px;
  border-radius: 2px;
}

.mobile-artist-detail__album-name {
  font-size: 11px;
  font-weight: 500;
  color: var(--a-color-text, #111111);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-artist-detail__songs {
  padding: 16px 0;
}

.mobile-artist-detail__list {
  display: flex;
  flex-direction: column;
}

.mobile-artist-detail__song-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  cursor: pointer;
  border-bottom: 1px solid var(--a-color-border-soft, #f8f8f8);
  transition: background-color 0.15s ease;
}

.mobile-artist-detail__song-item:active {
  background-color: var(--a-color-surface-hover, #f9f9f9);
}

.mobile-artist-detail__song-index {
  font-size: 12px;
  font-weight: 600;
  color: var(--a-color-text-muted, #bbbbbb);
  width: 18px;
  text-align: center;
}

.mobile-artist-detail__song-cover {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  overflow: hidden;
  background-color: #f5f5f5;
  border: 1px solid var(--a-color-border-soft, #eeeeee);
  flex-shrink: 0;
}

.mobile-artist-detail__song-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-artist-detail__song-art {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-text-muted, #999999);
}

.mobile-artist-detail__song-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mobile-artist-detail__song-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--a-color-text, #111111);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-artist-detail__song-album {
  font-size: 11px;
  color: var(--a-color-text-secondary, #888888);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-artist-detail__song-dur {
  font-size: 11px;
  color: var(--a-color-text-muted, #999999);
  margin-left: auto;
}

.mobile-artist-detail__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 16px;
  text-align: center;
  gap: 12px;
}

.mobile-artist-detail__empty-icon {
  color: var(--a-color-text-muted, #cccccc);
}

.mobile-artist-detail__empty-text {
  font-size: 13px;
  color: var(--a-color-text-secondary, #888888);
  margin: 0;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
