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

      <span
        class="mobile-album-detail__topbar-title"
        :class="{ 'is-scrolled': isScrolled }"
      >
        {{ isScrolled && album?.title ? album.title : '专辑详情' }}
      </span>

      <button
        type="button"
        class="mobile-album-detail__topbar-action"
        data-testid="album-share-btn"
        aria-label="分享"
        @click="handleShare"
      >
        <MIcon name="share" size="sm" />
      </button>
    </header>

    <!-- Toast Notification -->
    <Transition name="fade">
      <div v-if="toastMessage" class="mobile-album-detail__toast" role="status">
        {{ toastMessage }}
      </div>
    </Transition>

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

          <div class="mobile-album-detail__artist-wrap">
            <button
              v-if="album.artist_id"
              type="button"
              class="mobile-album-detail__artist-link"
              @click="handleGoArtist(album.artist_id)"
            >
              <span>{{ album.artist }}</span>
              <MIcon name="chevron-right" size="xs" />
            </button>
            <span v-else class="mobile-album-detail__artist">{{ album.artist }}</span>
          </div>

          <div class="mobile-album-detail__meta-row">
            <span
              v-if="album.album_type && formatAlbumTypeLabel(album.album_type)"
              class="mobile-album-detail__type-tag"
            >
              {{ formatAlbumTypeLabel(album.album_type) }}
            </span>
            <span v-if="album.year" class="mobile-album-detail__year">{{ album.year }} 年</span>
            <span class="mobile-album-detail__count">{{ songs.length }} 首歌曲</span>
          </div>

          <div class="mobile-album-detail__actions">
            <MButton
              size="sm"
              variant="primary"
              :disabled="!songs.some(canPlayMusicSong)"
              data-testid="play-all-btn"
              @click="handlePlayAll"
            >
              <MIcon name="player-play" size="xs" />
              <span>播放全部</span>
            </MButton>
            <MButton
              size="sm"
              variant="secondary"
              :disabled="!songs.some(canPlayMusicSong)"
              data-testid="shuffle-play-btn"
              @click="handleShufflePlay"
            >
              <MIcon name="shuffle" size="xs" />
              <span>随机播放</span>
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
          <button
            v-for="(song, index) in songs"
            :key="song.id"
            type="button"
            class="mobile-album-detail__song-item"
            :class="{ 'is-active': isCurrentSong(song) }"
            data-testid="album-song-item"
            :disabled="!canPlayMusicSong(song)"
            :aria-label="canPlayMusicSong(song) ? '播放 ' + song.title : song.title + '，暂无可播放音源'"
            @click="playSong(song)"
          >
            <div class="mobile-album-detail__song-index-col">
              <MIcon
                v-if="isCurrentSong(song) && player.isPlaying"
                name="waveform"
                size="xs"
                class="mobile-album-detail__playing-icon"
              />
              <MIcon
                v-else-if="isCurrentSong(song)"
                name="player-play"
                size="xs"
                class="mobile-album-detail__playing-icon"
              />
              <span v-else class="mobile-album-detail__song-index">
                {{ String(index + 1).padStart(2, '0') }}
              </span>
            </div>

            <div class="mobile-album-detail__song-info">
              <span class="mobile-album-detail__song-title">{{ song.title }}</span>
              <div v-if="songSubMeta(song)" class="mobile-album-detail__song-sub">
                <span
                  v-if="isLeakSong(song)"
                  class="mobile-album-detail__leak-badge"
                >
                  泄曲
                </span>
                <span v-if="songGuestArtist(song)" class="mobile-album-detail__guest-artist">
                  {{ songGuestArtist(song) }}
                </span>
              </div>
            </div>

            <span v-if="!canPlayMusicSong(song)" class="mobile-music-no-audio">暂无音源</span>
            <span v-else-if="formatDuration(song.duration)" class="mobile-album-detail__song-dur">
              {{ formatDuration(song.duration) }}
            </span>
          </button>
        </div>

        <!-- Empty State -->
        <div v-else class="mobile-album-detail__empty" data-testid="album-empty">
          <MIcon name="note" size="lg" class="mobile-album-detail__empty-icon" />
          <p class="mobile-album-detail__empty-text">专辑内暂无歌曲</p>
        </div>
      </section>
    </main>

    <div v-else-if="loadError" class="mobile-album-detail__empty" role="alert" data-testid="album-load-error">
      <p class="mobile-album-detail__empty-text">{{ loadError }}</p>
      <MButton size="sm" variant="secondary" @click="loadAlbumData(true)">重新加载</MButton>
    </div>

    <!-- Not Found -->
    <div v-else class="mobile-album-detail__empty" data-testid="album-not-found">
      <MIcon name="note" size="lg" class="mobile-album-detail__empty-icon" />
      <p class="mobile-album-detail__empty-text">未找到专辑信息</p>
      <MButton size="sm" variant="secondary" @click="handleBack">返回发现页</MButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getMusicAlbum } from '@/api/musicV1'
import { useAudioPlayerStore } from '@/stores/player'
import type { Song } from '@/types'
import {
  musicAudioFromApi,
  musicPlaybackDetailsFromApi,
  canPlayMusicSong,
  playableMusicQueue,
  startMobileMusicQueue,
} from '@mobile/mobileMusicPlayback'
import { compareAlbumTracks, formatAlbumTypeLabel } from '@/utils/musicMedia'
import MButton from '@mobile/components/ui/MButton.vue'
import MIcon from '@mobile/components/ui/MIcon.vue'

export interface AlbumDetailData {
  id: string
  title: string
  artist: string
  artist_id?: string
  year?: string | number
  album_type?: string
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
const loadError = ref('')
const album = ref<AlbumDetailData | null>(props.initialAlbum || null)
const songs = ref<Song[]>([...(props.initialSongs || [])].sort(compareAlbumTracks))
const isScrolled = ref(false)
const toastMessage = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null
let detailGeneration = 0

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

function extractArtistId(item: any): string {
  if (Array.isArray(item?.artists) && item.artists.length > 0) {
    const id = item.artists[0]?.id || item.artists[0]?.artist_id
    if (id) return String(id)
  }
  if (Array.isArray(item?.artist_credits) && item.artist_credits.length > 0) {
    const id = item.artist_credits[0]?.artist?.id || item.artist_credits[0]?.artist_id || item.artist_credits[0]?.id
    if (id) return String(id)
  }
  if (item?.artist_id) return String(item.artist_id)
  return ''
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
    disc_number: item.disc_number,
    track_number: item.track_number,
    album_id: item.album_id || album.value?.id || undefined,
    release_type: item.release_type,
    ...musicAudioFromApi(item),
    ...musicPlaybackDetailsFromApi(item),
    cover_url: extractCover(item, fallbackCover),
  }
}

function formatDuration(seconds?: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return ''
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function isCurrentSong(song: Song): boolean {
  return Boolean(player.currentSong && String(player.currentSong.id) === String(song.id))
}

function isLeakSong(song: Song): boolean {
  const t = (song.release_type || '').toLowerCase().trim()
  return t === 'leak' || t === 'leak_song'
}

function songGuestArtist(song: Song): string {
  const artist = (song.artist || '').trim()
  if (!artist || artist === '未知艺术家') return ''
  const albumArtist = (album.value?.artist || '').trim()
  if (albumArtist && artist.toLowerCase() === albumArtist.toLowerCase()) return ''
  return artist
}

function songSubMeta(song: Song): boolean {
  return isLeakSong(song) || Boolean(songGuestArtist(song))
}

function onWindowScroll() {
  if (typeof window !== 'undefined') {
    isScrolled.value = window.scrollY > 60
  }
}

async function handleShare() {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: album.value?.title || '专辑',
        text: `${album.value?.title || '专辑'} - ${album.value?.artist || ''}`,
        url: window.location.href,
      })
      return
    } catch {
      // User cancelled
      return
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(window.location.href)
      showToast('链接已复制')
    } catch {
      // Fallback
    }
  }
}

function showToast(msg: string) {
  if (toastTimer) clearTimeout(toastTimer)
  toastMessage.value = msg
  toastTimer = setTimeout(() => {
    toastMessage.value = ''
    toastTimer = null
  }, 2000)
}

function handleGoArtist(artistId?: string) {
  if (artistId) {
    void router.push(`/music/artist/${artistId}`)
  }
}

async function loadAlbumData(force = false) {
  if (props.initialAlbum) return
  const generation = ++detailGeneration
  const id = String(route.params.albumId || '')
  if (!id) { loadError.value = '专辑标识缺失。'; return }
  loading.value = true
  loadError.value = ''
  album.value = null
  songs.value = []
  try {
    const data = await getMusicAlbum(id, { force })
    if (generation !== detailGeneration || String(route.params.albumId || '') !== id) return
    if (!data?.id) { loadError.value = '未找到专辑信息。'; return }
    const albumArtist = extractArtist(data, '')
    const artistId = extractArtistId(data)
    album.value = {
      id: data.id,
      title: data.title || '专辑',
      artist: albumArtist,
      artist_id: artistId,
      year: data.year || '',
      album_type: data.album_type || '',
      cover_url: data.cover_url || '',
    }
    songs.value = Array.isArray(data.songs)
      ? [...data.songs].sort(compareAlbumTracks).map((song) => toPlayerSong(song, {
          cover_url: album.value?.cover_url,
          artist: albumArtist,
          title: album.value?.title,
        }))
      : []
  } catch {
    if (generation === detailGeneration) loadError.value = '专辑加载失败，请检查网络后重试。'
  } finally {
    if (generation === detailGeneration) loading.value = false
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
  if (!canPlayMusicSong(song)) return
  startMobileMusicQueue(player, songs.value, song.id)
}

function handlePlayAll() {
  startMobileMusicQueue(player, songs.value)
}

function handleShufflePlay() {
  const playable = playableMusicQueue(songs.value)
  if (!playable.length) return
  const shuffled = [...playable].sort(() => Math.random() - 0.5)
  player.playAlbum(shuffled, 0)
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('scroll', onWindowScroll, { passive: true })
  }
  void loadAlbumData()
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('scroll', onWindowScroll)
  }
  if (toastTimer) clearTimeout(toastTimer)
})

watch(() => route.params.albumId, (id, previous) => {
  detailGeneration += 1
  if (id && id !== previous) void loadAlbumData()
})
</script>

<style scoped>
.mobile-album-detail {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background-color: #ffffff;
  padding-bottom: var(--mobile-music-page-bottom, 2rem);
  position: relative;
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
  border-radius: 4px;
}

.mobile-album-detail__back-btn:active {
  background-color: var(--a-color-surface-hover, #f5f5f5);
}

.mobile-album-detail__topbar-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--a-color-text, #111111);
  max-width: 65%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
  transition: opacity 0.2s ease;
}

.mobile-album-detail__topbar-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--a-color-text, #111111);
  cursor: pointer;
  border-radius: 4px;
}

.mobile-album-detail__topbar-action:active {
  background-color: var(--a-color-surface-hover, #f5f5f5);
}

.mobile-album-detail__toast {
  position: fixed;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(17, 17, 17, 0.88);
  color: #ffffff;
  font-size: 12px;
  padding: 6px 14px;
  border-radius: 4px;
  z-index: 100;
  pointer-events: none;
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

.mobile-album-detail__artist-wrap {
  margin: 4px 0 0 0;
}

.mobile-album-detail__artist {
  font-size: 13px;
  color: var(--a-color-text-secondary, #666666);
}

.mobile-album-detail__artist-link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 13px;
  color: var(--a-color-text-secondary, #444444);
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
}

.mobile-album-detail__artist-link:active {
  color: var(--a-color-primary, #000000);
}

.mobile-album-detail__meta-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 11px;
  color: var(--a-color-text-muted, #888888);
  margin: 6px 0 10px 0;
}

.mobile-album-detail__type-tag {
  display: inline-block;
  padding: 1px 5px;
  font-size: 10px;
  line-height: 1.3;
  border-radius: 2px;
  background: #f4f4f5;
  color: var(--a-color-text-secondary, #555555);
}

.mobile-album-detail__actions {
  display: flex;
  align-items: center;
  gap: 8px;
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
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--a-color-border-soft, #f7f7f7);
  cursor: pointer;
  background: #ffffff;
  border-left: none;
  border-right: none;
  border-top: none;
  text-align: left;
  width: 100%;
  transition: background-color 0.15s ease;
}

.mobile-album-detail__song-item:last-child {
  border-bottom: none;
}

.mobile-album-detail__song-item:active {
  background-color: var(--a-color-surface-hover, #fafafa);
}

.mobile-album-detail__song-item.is-active {
  background-color: #fafbfc;
}

.mobile-album-detail__song-index-col {
  width: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.mobile-album-detail__song-index {
  font-size: 12px;
  font-family: monospace;
  color: var(--a-color-text-muted, #999999);
}

.mobile-album-detail__playing-icon {
  color: var(--a-color-primary, #059669);
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

.mobile-album-detail__song-item.is-active .mobile-album-detail__song-title {
  color: var(--a-color-primary, #059669);
  font-weight: 600;
}

.mobile-album-detail__song-sub {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mobile-album-detail__leak-badge {
  display: inline-block;
  padding: 1px 4px;
  font-size: 10px;
  font-weight: 500;
  line-height: 1.2;
  border-radius: 2px;
  background: #fef2f2;
  color: #ef4444;
  border: 1px solid #fee2e2;
}

.mobile-album-detail__guest-artist {
  font-size: 11px;
  color: var(--a-color-text-muted, #888888);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
