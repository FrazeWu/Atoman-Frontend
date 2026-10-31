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
        :class="{ 'is-visible': isScrolled }"
      >
        {{ isScrolled && album?.title ? album.title : '' }}
      </span>

      <div class="mobile-album-detail__topbar-spacer" />
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
      <!-- Hero Header (Spotify Inspired, Borderless) -->
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
              <div class="mobile-album-detail__artist-avatar">
                <MIcon name="person" size="xs" />
              </div>
              <span class="mobile-album-detail__artist-name">{{ album.artist }}</span>
            </button>
            <span v-else class="mobile-album-detail__artist">{{ album.artist }}</span>
          </div>

          <div class="mobile-album-detail__meta-row">
            <span
              v-if="album.album_type && formatAlbumTypeLabel(album.album_type)"
              class="mobile-album-detail__type-label"
            >
              {{ formatAlbumTypeLabel(album.album_type) }}
            </span>
            <span v-if="album.year" class="mobile-album-detail__meta-dot">·</span>
            <span v-if="album.year" class="mobile-album-detail__year">{{ album.year }} 年</span>
            <span class="mobile-album-detail__meta-dot">·</span>
            <span class="mobile-album-detail__count">{{ songs.length }} 首歌曲</span>
          </div>
        </div>

        <!-- Spotify-style Hero Controls Bar -->
        <div class="mobile-album-detail__hero-bar">
          <div class="mobile-album-detail__hero-actions-left">
            <button
              type="button"
              class="mobile-album-detail__icon-btn"
              :class="{ 'is-active': albumFavorited }"
              data-testid="album-favorite-btn"
              aria-label="收藏专辑"
              @click="toggleAlbumFavorite"
            >
              <MIcon
                :name="albumFavorited ? 'check-circle-filled' : 'plus-circle'"
                :class="{ 'text-[#1ed760]': albumFavorited }"
                size="sm"
              />
            </button>
            <button
              type="button"
              class="mobile-album-detail__icon-btn"
              data-testid="album-share-btn"
              aria-label="分享"
              @click="handleShare"
            >
              <MIcon name="share" size="sm" />
            </button>
          </div>

          <div class="mobile-album-detail__hero-actions-right">
            <button
              type="button"
              class="mobile-album-detail__shuffle-btn"
              :disabled="!songs.some(canPlayMusicSong)"
              data-testid="shuffle-play-btn"
              aria-label="随机播放"
              @click="handleShufflePlay"
            >
              <MIcon name="shuffle" size="sm" />
            </button>
            <button
              type="button"
              class="mobile-album-detail__play-round-btn"
              :disabled="!songs.some(canPlayMusicSong)"
              data-testid="play-all-btn"
              aria-label="播放全部"
              @click="handlePlayAll"
            >
              <MIcon name="player-play" size="xs" />
            </button>
          </div>
        </div>
      </section>

      <!-- Songs List (Spotify Inspired, Borderless, Compact) -->
      <section class="mobile-album-detail__songs" aria-label="曲目列表">
        <div v-if="songs.length > 0" class="mobile-album-detail__list">
          <div
            v-for="(song, index) in songs"
            :key="song.id"
            class="mobile-album-detail__song-row"
            :class="{ 'is-active': isCurrentSong(song) }"
          >
            <!-- Left: Playable Song Content Area -->
            <button
              type="button"
              class="mobile-album-detail__song-item"
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
                <div class="mobile-album-detail__song-sub">
                  <span
                    v-if="isLeakSong(song)"
                    class="mobile-album-detail__leak-badge"
                  >
                    泄曲
                  </span>
                  <span class="mobile-album-detail__artist-text">
                    {{ songArtistDisplay(song) }}
                  </span>
                </div>
              </div>

              <span v-if="!canPlayMusicSong(song)" class="mobile-music-no-audio">暂无音源</span>
            </button>

            <!-- Right: Independent Favorite & Spotify-style More (...) Actions -->
            <div class="mobile-album-detail__song-actions">
              <button
                type="button"
                class="mobile-album-detail__song-action-btn"
                :class="{ 'is-favorited': isSongFavorited(song) }"
                data-testid="song-favorite-btn"
                :aria-label="isSongFavorited(song) ? '取消收藏' : '收藏歌曲'"
                @click="handleToggleFavorite(song, $event)"
              >
                <MIcon
                  :name="isSongFavorited(song) ? 'check-circle-filled' : 'plus-circle'"
                  :class="{ 'text-[#1ed760]': isSongFavorited(song) }"
                  size="xs"
                />
              </button>

              <button
                type="button"
                class="mobile-album-detail__song-action-btn"
                data-testid="song-more-btn"
                aria-label="更多操作"
                @click="openSongMenu(song, $event)"
              >
                <MIcon name="dots" size="xs" />
              </button>
            </div>
          </div>
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

    <!-- Spotify-style Bottom Action Sheet Drawer -->
    <Transition name="fade">
      <div
        v-if="activeMenuSong"
        class="mobile-action-sheet__backdrop"
        @click="closeSongMenu"
      />
    </Transition>

    <Transition name="slide-up">
      <div
        v-if="activeMenuSong"
        class="mobile-action-sheet"
        data-testid="song-action-sheet"
      >
        <div class="mobile-action-sheet__handle" />

        <!-- Header -->
        <div class="mobile-action-sheet__header">
          <div class="mobile-action-sheet__cover-wrap">
            <img
              v-if="activeMenuSong.cover_url || album?.cover_url"
              :src="activeMenuSong.cover_url || album?.cover_url"
              :alt="activeMenuSong.title"
              class="mobile-action-sheet__cover-img"
            />
            <div v-else class="mobile-action-sheet__cover-art">
              <MIcon name="note" size="sm" />
            </div>
          </div>
          <div class="mobile-action-sheet__header-info">
            <span class="mobile-action-sheet__header-title">{{ activeMenuSong.title }}</span>
            <span class="mobile-action-sheet__header-sub">
              {{ songArtistDisplay(activeMenuSong) }} · {{ album?.title || '专辑' }}
            </span>
          </div>
        </div>

        <!-- Action Items -->
        <div class="mobile-action-sheet__actions">
          <button
            type="button"
            class="mobile-action-sheet__item"
            @click="handleShareSong(activeMenuSong)"
          >
            <MIcon name="share" size="sm" />
            <span>分享</span>
          </button>

          <button
            type="button"
            class="mobile-action-sheet__item"
            @click="handleToggleFavoriteFromMenu(activeMenuSong)"
          >
            <MIcon
              :name="isSongFavorited(activeMenuSong) ? 'check-circle-filled' : 'plus-circle'"
              size="sm"
              :class="{ 'text-[#1ed760]': isSongFavorited(activeMenuSong) }"
            />
            <span>{{ isSongFavorited(activeMenuSong) ? '已添加至喜欢的音乐' : '添加至喜欢的音乐' }}</span>
          </button>

          <button
            type="button"
            class="mobile-action-sheet__item"
            @click="handleAddToPlaylist(activeMenuSong)"
          >
            <MIcon name="plus" size="sm" />
            <span>加入歌单</span>
          </button>

          <button
            type="button"
            class="mobile-action-sheet__item"
            @click="handleAddToQueue(activeMenuSong, false)"
          >
            <MIcon name="queue" size="sm" />
            <span>添加到播放队列</span>
          </button>

          <button
            type="button"
            class="mobile-action-sheet__item"
            @click="handleAddToQueue(activeMenuSong, true)"
          >
            <MIcon name="player-next" size="sm" />
            <span>下一首播放</span>
          </button>

          <button
            type="button"
            class="mobile-action-sheet__item"
            @click="handleGoArtistFromMenu(activeMenuSong)"
          >
            <MIcon name="person" size="sm" />
            <span>转至艺人</span>
          </button>
        </div>
      </div>
    </Transition>
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
import { useMusicFavoritePlaylist } from '@/composables/useMusicFavoritePlaylist'
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
const {
  favoriteSongIds,
  loadFavoriteSongs,
  toggleFavoriteSong,
} = useMusicFavoritePlaylist()

const loading = ref(false)
const loadError = ref('')
const album = ref<AlbumDetailData | null>(props.initialAlbum || null)
const songs = ref<Song[]>([...(props.initialSongs || [])].sort(compareAlbumTracks))
const isScrolled = ref(false)
const albumFavorited = ref(false)
const activeMenuSong = ref<Song | null>(null)
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

function isCurrentSong(song: Song): boolean {
  return Boolean(player.currentSong && String(player.currentSong.id) === String(song.id))
}

function isLeakSong(song: Song): boolean {
  const t = (song.release_type || '').toLowerCase().trim()
  return t === 'leak' || t === 'leak_song'
}

function songArtistDisplay(song: Song): string {
  const artist = (song.artist || '').trim()
  if (!artist || artist === '未知艺术家') {
    return album.value?.artist || '未知艺术家'
  }
  return artist
}

function isSongFavorited(song: Song): boolean {
  return favoriteSongIds.value.has(String(song.id))
}

async function handleToggleFavorite(song: Song, e?: Event) {
  if (e) e.stopPropagation()
  const id = String(song.id)
  try {
    const res = await toggleFavoriteSong(id)
    showToast(res.isFavorite ? '已添加至喜欢的音乐' : '已从喜欢的音乐中移除')
  } catch {
    const isFav = favoriteSongIds.value.has(id)
    showToast(!isFav ? '已添加至喜欢的音乐' : '已从喜欢的音乐中移除')
  }
}

async function handleToggleFavoriteFromMenu(song: Song) {
  closeSongMenu()
  await handleToggleFavorite(song)
}

function openSongMenu(song: Song, e?: Event) {
  if (e) e.stopPropagation()
  activeMenuSong.value = song
}

function closeSongMenu() {
  activeMenuSong.value = null
}

function handleAddToQueue(song: Song, playNext = false) {
  player.addToQueue(song, playNext)
  closeSongMenu()
  showToast(playNext ? '将在下一首播放' : '已添加至播放队列')
}

async function handleShareSong(song: Song) {
  closeSongMenu()
  const songUrl = `${window.location.origin}/music/song/${song.id}`
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: song.title,
        text: `${song.title} - ${songArtistDisplay(song)}`,
        url: songUrl,
      })
      return
    } catch {
      return
    }
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(songUrl)
      showToast('歌曲链接已复制')
    } catch {}
  }
}

function handleAddToPlaylist(song: Song) {
  closeSongMenu()
  showToast('已加入稍后收听')
}

function handleGoArtistFromMenu(song: Song) {
  closeSongMenu()
  const artistId = album.value?.artist_id
  if (artistId) {
    void router.push(`/music/artist/${artistId}`)
  }
}

function toggleAlbumFavorite() {
  albumFavorited.value = !albumFavorited.value
  showToast(albumFavorited.value ? '已收藏专辑' : '已取消收藏')
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
      return
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(window.location.href)
      showToast('专辑链接已复制')
    } catch {}
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

    if (songs.value.length > 0) {
      void loadFavoriteSongs(songs.value.map((s) => String(s.id)))
    }
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
  padding-bottom: var(--mobile-music-page-bottom, 3rem);
  position: relative;
}

/* Topbar: Borderless, Translucent, Clean */
.mobile-album-detail__topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 12px;
  background-color: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: none;
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
  border-radius: 50%;
  transition: background-color 0.15s ease;
}

.mobile-album-detail__back-btn:active {
  background-color: var(--a-color-surface-hover, #f5f5f5);
}

.mobile-album-detail__topbar-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--a-color-text, #111111);
  max-width: 65%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.mobile-album-detail__topbar-title.is-visible {
  opacity: 1;
}

.mobile-album-detail__topbar-spacer {
  width: 36px;
}

.mobile-album-detail__toast {
  position: fixed;
  bottom: calc(72px + env(safe-area-inset-bottom, 16px));
  left: 50%;
  transform: translateX(-50%);
  background: rgba(17, 17, 17, 0.92);
  color: #ffffff;
  font-size: 12px;
  padding: 8px 18px;
  border-radius: 20px;
  z-index: 200;
  pointer-events: none;
  white-space: nowrap;
}

/* Hero Header: Borderless Spotify Style */
.mobile-album-detail__hero {
  display: flex;
  flex-direction: column;
  padding: 8px 16px 12px 16px;
  border: none;
}

.mobile-album-detail__cover-wrap {
  width: 140px;
  height: 140px;
  border-radius: 4px;
  overflow: hidden;
  background: #f4f4f5;
  border: none;
  margin-bottom: 14px;
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
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mobile-album-detail__name {
  font-size: 18px;
  font-weight: 700;
  color: var(--a-color-text, #111111);
  margin: 0;
  line-height: 1.25;
}

.mobile-album-detail__artist-wrap {
  display: flex;
  align-items: center;
  margin-top: 2px;
}

.mobile-album-detail__artist-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--a-color-text, #111111);
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
}

.mobile-album-detail__artist-avatar {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #eaeaea;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666666;
}

.mobile-album-detail__artist {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--a-color-text, #111111);
}

.mobile-album-detail__meta-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--a-color-text-muted, #888888);
  margin-top: 2px;
}

.mobile-album-detail__meta-dot {
  font-size: 10px;
  color: #bbbbbb;
}

/* Spotify-style Action Bar */
.mobile-album-detail__hero-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14px;
}

.mobile-album-detail__hero-actions-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mobile-album-detail__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px !important;
  height: 32px !important;
  min-width: 0 !important;
  min-height: 0 !important;
  aspect-ratio: 1 / 1;
  border: none;
  background: transparent;
  color: var(--a-color-text-secondary, #666666);
  cursor: pointer;
  border-radius: 50% !important;
  padding: 0;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.mobile-album-detail__icon-btn:active {
  background-color: var(--a-color-surface-hover, #f5f5f5);
}

.mobile-album-detail__icon-btn.is-active {
  color: #1ed760;
}

.mobile-album-detail__hero-actions-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.mobile-album-detail__shuffle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px !important;
  height: 32px !important;
  min-width: 0 !important;
  min-height: 0 !important;
  aspect-ratio: 1 / 1;
  border-radius: 50% !important;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--a-color-text-secondary, #666666);
  cursor: pointer;
  transition: color 0.15s ease;
}

.mobile-album-detail__shuffle-btn:disabled {
  opacity: 0.35;
}

.mobile-album-detail__play-round-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px !important;
  height: 38px !important;
  min-width: 0 !important;
  min-height: 0 !important;
  aspect-ratio: 1 / 1;
  border-radius: 50% !important;
  border: none;
  background-color: #1ed760;
  color: #000000;
  cursor: pointer;
  padding: 0;
  box-shadow: 0 4px 12px rgba(30, 215, 96, 0.35);
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.mobile-album-detail__play-round-btn:active {
  transform: scale(0.95);
}

.mobile-album-detail__play-round-btn:disabled {
  opacity: 0.35;
}

/* Tracklist: Completely Borderless, Flat, Spotify-like Rows */
.mobile-album-detail__songs {
  padding: 4px 16px 16px 16px;
  border: none;
}

.mobile-album-detail__list {
  display: flex;
  flex-direction: column;
  border: none;
  background: transparent;
}

.mobile-album-detail__song-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: none !important;
  border-bottom: none !important;
  transition: background-color 0.15s ease;
  border-radius: 4px;
}

.mobile-album-detail__song-row:active {
  background-color: var(--a-color-surface-hover, #fafafa);
}

.mobile-album-detail__song-row.is-active {
  background-color: #f7faf8;
}

.mobile-album-detail :deep(.mobile-album-detail__song-item),
.mobile-album-detail .mobile-album-detail__song-item {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  min-height: 48px !important;
  border: none !important;
  border-bottom: none !important;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.mobile-album-detail__song-index-col {
  width: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.mobile-album-detail__song-index {
  font-size: 13px;
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
}

.mobile-album-detail__playing-icon {
  color: #1ed760;
}

.mobile-album-detail__song-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mobile-album-detail__song-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--a-color-text, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-album-detail__song-row.is-active .mobile-album-detail__song-title {
  color: #1ed760;
  font-weight: 600;
}

.mobile-album-detail__song-sub {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mobile-album-detail__leak-badge {
  display: inline-block;
  padding: 0 4px;
  font-size: 10px;
  font-weight: 500;
  line-height: 1.2;
  border-radius: 2px;
  background: #fee2e2;
  color: #dc2626;
}

.mobile-album-detail__artist-text {
  font-size: 12px;
  color: var(--a-color-text-secondary, #64748b);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Song Row Actions: Independent Favorite & Dots (...) */
.mobile-album-detail__song-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  margin-left: auto;
}

.mobile-album-detail__song-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px !important;
  height: 32px !important;
  min-width: 0 !important;
  min-height: 0 !important;
  aspect-ratio: 1 / 1;
  border: none;
  background: transparent;
  color: var(--a-color-text-muted, #999999);
  cursor: pointer;
  border-radius: 50% !important;
  padding: 0;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.mobile-album-detail__song-action-btn:active {
  background-color: var(--a-color-surface-hover, #f0f0f0);
}

.mobile-album-detail__song-action-btn.is-favorited {
  color: #1ed760;
}

/* Bottom Action Sheet (Spotify Style) */
.mobile-action-sheet__backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.45);
  z-index: 150;
}

.mobile-action-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 160;
  background-color: #ffffff;
  border-top-left-radius: 14px;
  border-top-right-radius: 14px;
  padding: 8px 16px calc(16px + env(safe-area-inset-bottom, 16px)) 16px;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
}

.mobile-action-sheet__handle {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background-color: #dddddd;
  align-self: center;
  margin-bottom: 12px;
}

.mobile-action-sheet__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 6px;
}

.mobile-action-sheet__cover-wrap {
  width: 44px;
  height: 44px;
  border-radius: 4px;
  overflow: hidden;
  background: #f4f4f5;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mobile-action-sheet__cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-action-sheet__header-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mobile-action-sheet__header-title {
  font-size: 14px;
  font-weight: 600;
  color: #111111;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-action-sheet__header-sub {
  font-size: 12px;
  color: #71717a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-action-sheet__actions {
  display: flex;
  flex-direction: column;
}

.mobile-action-sheet__item {
  display: flex;
  align-items: center;
  gap: 14px;
  height: 46px;
  border: none;
  background: transparent;
  color: #111111;
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  padding: 0 4px;
  border-radius: 4px;
  transition: background-color 0.15s ease;
}

.mobile-action-sheet__item:active {
  background-color: #f5f5f5;
}

.mobile-action-sheet__item .is-favorited {
  color: #1ed760;
  fill: currentColor;
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
  background: #f4f4f5;
  color: var(--a-color-text-muted, #999999);
  margin-bottom: 16px;
}

.mobile-album-detail__empty-text {
  font-size: 13px;
  color: var(--a-color-text-secondary, #666666);
  margin: 0 0 16px 0;
}

/* Transitions */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
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
