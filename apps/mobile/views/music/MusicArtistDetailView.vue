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
        </div>

        <!-- Spotify-style Hero Controls Bar -->
        <div class="mobile-artist-detail__hero-controls">
          <div class="mobile-artist-detail__hero-actions-left">
            <button
              type="button"
              class="mobile-artist-detail__icon-btn"
              data-testid="artist-share-btn"
              aria-label="分享艺人"
              @click="handleShareArtist"
            >
              <MIcon name="share" size="sm" />
            </button>
          </div>

          <div class="mobile-artist-detail__hero-actions-right">
            <button
              type="button"
              class="mobile-artist-detail__play-round-btn"
              :disabled="!songs.some(canPlayMusicSong)"
              data-testid="artist-play-all-btn"
              aria-label="播放热门单曲"
              @click="handlePlayAll"
            >
              <MIcon name="player-play" size="xs" />
            </button>
          </div>
        </div>
      </section>

      <!-- Tabs (单曲 / 专辑) & Sort (热度 / 时间) Navigation Bar -->
      <section class="mobile-artist-detail__content-section">
        <div class="mobile-artist-detail__nav-bar">
          <!-- Left: Main Tab Switcher -->
          <div class="mobile-artist-detail__main-tabs" role="tablist" aria-label="作品分类">
            <button
              type="button"
              class="mobile-artist-detail__main-tab"
              :class="{ 'is-active': activeTab === 'songs' }"
              role="tab"
              :aria-selected="activeTab === 'songs'"
              data-testid="artist-tab-songs"
              @click="activeTab = 'songs'"
            >
              <span>单曲</span>
              <span v-if="songs.length" class="mobile-artist-detail__tab-count">{{ songs.length }}</span>
            </button>
            <button
              v-if="albums.length > 0"
              type="button"
              class="mobile-artist-detail__main-tab"
              :class="{ 'is-active': activeTab === 'albums' }"
              role="tab"
              :aria-selected="activeTab === 'albums'"
              data-testid="artist-tab-albums"
              @click="activeTab = 'albums'"
            >
              <span>专辑</span>
              <span class="mobile-artist-detail__tab-count">{{ albums.length }}</span>
            </button>
          </div>

          <!-- Right: Sort Switcher (热度 / 时间) -->
          <div class="mobile-artist-detail__sort-tabs" role="group" aria-label="排序方式">
            <button
              type="button"
              class="mobile-artist-detail__sort-btn"
              :class="{ 'is-active': currentSort === 'popularity' }"
              data-testid="sort-popularity-btn"
              @click="currentSort = 'popularity'"
            >
              热度
            </button>
            <button
              type="button"
              class="mobile-artist-detail__sort-btn"
              :class="{ 'is-active': currentSort === 'time' }"
              data-testid="sort-time-btn"
              @click="currentSort = 'time'"
            >
              时间
            </button>
          </div>
        </div>

        <!-- Songs Tab Panel -->
        <div v-show="activeTab === 'songs'" class="mobile-artist-detail__tab-panel" role="tabpanel" aria-label="单曲列表">
          <div v-if="songsError" class="mobile-artist-detail__empty" role="alert">
            <p class="mobile-artist-detail__empty-text">{{ songsError }}</p>
            <MButton size="sm" variant="secondary" @click="loadArtistData(true)">重新加载</MButton>
          </div>
          <div v-else-if="displaySongs.length > 0" class="mobile-artist-detail__list">
            <div
              v-for="(song, index) in displaySongs"
              :key="song.id"
              class="mobile-artist-detail__song-row"
              :class="{ 'is-active': isCurrentSong(song) }"
            >
              <!-- Left: Playable Song Content Area -->
              <button
                type="button"
                class="mobile-artist-detail__song-item"
                data-testid="artist-song-item"
                :disabled="!canPlayMusicSong(song)"
                :aria-label="canPlayMusicSong(song) ? '播放 ' + song.title : song.title + '，暂无可播放音源'"
                @click="playSong(song)"
              >
                <div class="mobile-artist-detail__song-index-col">
                  <MIcon
                    v-if="isCurrentSong(song) && player.isPlaying"
                    name="waveform"
                    size="xs"
                    class="mobile-artist-detail__playing-icon"
                  />
                  <MIcon
                    v-else-if="isCurrentSong(song)"
                    name="player-play"
                    size="xs"
                    class="mobile-artist-detail__playing-icon"
                  />
                  <span v-else class="mobile-artist-detail__song-index">
                    {{ String(index + 1).padStart(2, '0') }}
                  </span>
                </div>

                <div class="mobile-artist-detail__song-cover">
                  <img v-if="song.cover_url" :src="song.cover_url" :alt="song.title" />
                  <div v-else class="mobile-artist-detail__song-art">
                    <MIcon name="note" size="sm" />
                  </div>
                </div>

                <div class="mobile-artist-detail__song-info">
                  <span class="mobile-artist-detail__song-title">{{ song.title }}</span>
                  <span class="mobile-artist-detail__song-album">
                    {{ song.album || formatAlbumTypeLabel(song.release_type || 'single') }}
                  </span>
                </div>

                <span v-if="!canPlayMusicSong(song)" class="mobile-music-no-audio">暂无音源</span>
              </button>

              <!-- Right: Independent Favorite & Spotify-style More (...) Actions -->
              <div class="mobile-artist-detail__song-actions">
                <button
                  type="button"
                  class="mobile-artist-detail__song-action-btn"
                  :class="{ 'is-favorited': isSongFavorited(song) }"
                  data-testid="song-favorite-btn"
                  :aria-label="isSongFavorited(song) ? '取消收藏' : '收藏歌曲'"
                  @click="handleToggleFavorite(song, $event)"
                >
                  <MIcon name="heart" size="xs" />
                </button>

                <button
                  type="button"
                  class="mobile-artist-detail__song-action-btn"
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
          <div v-else class="mobile-artist-detail__empty" data-testid="artist-empty">
            <MIcon name="note" size="lg" class="mobile-artist-detail__empty-icon" />
            <p class="mobile-artist-detail__empty-text">暂无收录单曲</p>
          </div>
        </div>

        <!-- Albums Tab Panel (Vertical List) -->
        <div
          v-if="albums.length > 0"
          v-show="activeTab === 'albums'"
          class="mobile-artist-detail__tab-panel"
          role="tabpanel"
          aria-label="专辑列表"
        >
          <div class="mobile-artist-detail__album-list">
            <div
              v-for="album in displayAlbums"
              :key="album.id"
              class="mobile-artist-detail__album-row"
              data-testid="artist-album-item"
              @click="openAlbum(album.id)"
            >
              <div class="mobile-artist-detail__album-row-cover">
                <img v-if="album.cover_url" :src="album.cover_url" :alt="album.title" />
                <div v-else class="mobile-artist-detail__album-row-art">
                  <MIcon name="note" size="sm" />
                </div>
              </div>

              <div class="mobile-artist-detail__album-row-info">
                <span class="mobile-artist-detail__album-row-title">{{ album.title }}</span>
                <div class="mobile-artist-detail__album-row-meta">
                  <span v-if="album.year">{{ album.year }}</span>
                  <span class="mobile-artist-detail__meta-dot">·</span>
                  <span>专辑</span>
                  <template v-if="album.song_count">
                    <span class="mobile-artist-detail__meta-dot">·</span>
                    <span>{{ album.song_count }} 首歌曲</span>
                  </template>
                </div>
              </div>

              <MIcon name="chevron-right" size="xs" class="mobile-artist-detail__album-row-arrow" />
            </div>
          </div>
        </div>
      </section>
    </main>

    <div v-else-if="loadError" class="mobile-artist-detail__empty" role="alert" data-testid="artist-load-error">
      <p class="mobile-artist-detail__empty-text">{{ loadError }}</p>
      <MButton size="sm" variant="secondary" @click="loadArtistData(true)">重新加载</MButton>
    </div>

    <!-- Not Found -->
    <div v-else class="mobile-artist-detail__empty" data-testid="artist-not-found">
      <MIcon name="person" size="lg" class="mobile-artist-detail__empty-icon" />
      <p class="mobile-artist-detail__empty-text">未找到歌手信息</p>
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
              v-if="activeMenuSong.cover_url || artist?.avatar_url"
              :src="activeMenuSong.cover_url || artist?.avatar_url"
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
              {{ activeMenuSong.artist || artist?.name || '歌手' }} · {{ activeMenuSong.album || '热门单曲' }}
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
              name="heart"
              size="sm"
              :class="{ 'is-favorited': isSongFavorited(activeMenuSong) }"
            />
            <span>{{ isSongFavorited(activeMenuSong) ? '已从已点赞歌曲移除' : '添加至 已点赞的歌曲' }}</span>
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
            <MIcon name="player-play" size="sm" />
            <span>下一首播放</span>
          </button>

          <button
            v-if="activeMenuSong.album_id"
            type="button"
            class="mobile-action-sheet__item"
            @click="handleGoToAlbum(activeMenuSong)"
          >
            <MIcon name="note" size="sm" />
            <span>转至专辑</span>
          </button>
        </div>
      </div>
    </Transition>

    <!-- Floating Pill Toast -->
    <Transition name="toast-fade">
      <div v-if="toastMessage" class="mobile-floating-toast" role="status">
        {{ toastMessage }}
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getMusicArtist,
  listMusicSongs,
} from '@/api/musicV1'
import { useAudioPlayerStore } from '@/stores/player'
import { useMusicFavoritePlaylist } from '@/composables/useMusicFavoritePlaylist'
import type { Song } from '@/types'
import { formatAlbumTypeLabel } from '@/utils/musicMedia'
import { musicAudioFromApi, musicPlaybackDetailsFromApi, canPlayMusicSong, startMobileMusicQueue } from '@mobile/mobileMusicPlayback'
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
  release_date?: string
  cover_url?: string
  song_count?: number
  plays_count?: number
}

type SortMode = 'popularity' | 'time'
const activeTab = ref<'songs' | 'albums'>('songs')
const songSort = ref<SortMode>('popularity')
const albumSort = ref<SortMode>('popularity')

const currentSort = computed({
  get: () => (activeTab.value === 'songs' ? songSort.value : albumSort.value),
  set: (val: SortMode) => {
    if (activeTab.value === 'songs') {
      songSort.value = val
    } else {
      albumSort.value = val
    }
  }
})

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
const { favoriteSongIds, loadFavoriteSongs, toggleFavoriteSong, addSongToPlaylist } = useMusicFavoritePlaylist()

const isCurrentSong = (song: Song) => {
  return String(player.currentSong?.id) === String(song.id)
}
const isSongFavorited = (song: Song) => {
  return favoriteSongIds.value.has(String(song.id))
}

const toastMessage = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(msg: string) {
  toastMessage.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastMessage.value = ''
    toastTimer = null
  }, 2200)
}

async function handleToggleFavorite(song: Song, e?: Event) {
  e?.stopPropagation()
  const songId = String(song.id)
  try {
    const res = await toggleFavoriteSong(songId)
    showToast(res.isFavorite ? '已添加至已点赞的歌曲' : '已从已点赞的歌曲移除')
  } catch {
    showToast('操作失败，请重试')
  }
}

const activeMenuSong = ref<Song | null>(null)
function openSongMenu(song: Song, e?: Event) {
  e?.stopPropagation()
  activeMenuSong.value = song
}
function closeSongMenu() {
  activeMenuSong.value = null
}

async function handleShareSong(song: Song) {
  closeSongMenu()
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/music/songs/${song.id}`
    : ''
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(shareUrl)
      showToast('歌曲链接已复制到剪贴板')
      return
    } catch {
      // ignore
    }
  }
  showToast('歌曲链接已生成')
}

async function handleShareArtist() {
  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(shareUrl)
      showToast('歌手主页链接已复制到剪贴板')
      return
    } catch {
      // ignore
    }
  }
  showToast('歌手主页链接已生成')
}

async function handleToggleFavoriteFromMenu(song: Song) {
  closeSongMenu()
  await handleToggleFavorite(song)
}

function handleAddToPlaylist(song: Song) {
  closeSongMenu()
  showToast('已加入稍后收听')
}

function handleAddToQueue(song: Song, playNext: boolean) {
  closeSongMenu()
  player.addToQueue(song, playNext)
  showToast(playNext ? '将在下一首播放' : '已添加到播放队列')
}

function handleGoToAlbum(song: Song) {
  closeSongMenu()
  const albumName = song.album || ''
  if (albumName) {
    void router.push({ path: '/music/search', query: { q: albumName } })
  }
}

const loading = ref(false)
const loadError = ref('')
const songsError = ref('')
const artist = ref<MobileArtistDetailData | null>(props.initialArtist || null)
const songs = ref<Song[]>(props.initialSongs || [])
const albums = ref<MobileArtistAlbumItem[]>(props.initialAlbums || [])
let detailGeneration = 0

const displaySongs = computed(() => {
  const list = [...songs.value]
  if (songSort.value === 'popularity') {
    return list.sort((a, b) => {
      const pA = Number((a as any).plays_count ?? (a as any).play_count ?? 0)
      const pB = Number((b as any).plays_count ?? (b as any).play_count ?? 0)
      if (pA !== pB) return pB - pA
      return 0
    })
  }
  return list.sort((a, b) => {
    const tA = (a as any).release_date || (a as any).year || (a as any).created_at || ''
    const tB = (b as any).release_date || (b as any).year || (b as any).created_at || ''
    return String(tB).localeCompare(String(tA))
  })
})

const displayAlbums = computed(() => {
  const list = [...albums.value]
  if (albumSort.value === 'time') {
    return list.sort((a, b) => {
      const tA = a.release_date || String(a.year || '')
      const tB = b.release_date || String(b.year || '')
      return String(tB).localeCompare(String(tA))
    })
  }
  return list.sort((a, b) => {
    const pA = Number((a as any).plays_count ?? (a as any).song_count ?? 0)
    const pB = Number((b as any).plays_count ?? (b as any).song_count ?? 0)
    return pB - pA
  })
})

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
    release_type: item.release_type,
    duration: typeof item.duration === 'number' && item.duration > 0
      ? item.duration
      : (item.duration_sec ?? item.duration_seconds ?? item.durationSeconds ?? 0),
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

async function loadArtistData(force = false) {
  if (props.initialArtist) return
  const generation = ++detailGeneration
  const id = String(route.params.artistId || '')
  if (!id) { loadError.value = '歌手标识缺失。'; return }
  loading.value = true
  loadError.value = ''
  songsError.value = ''
  artist.value = null
  songs.value = []
  albums.value = []
  try {
    const data = await getMusicArtist(id, { force })
    if (generation !== detailGeneration || String(route.params.artistId || '') !== id) return
    if (!data?.id) { loadError.value = '未找到歌手信息。'; return }
    artist.value = {
      id: data.id,
      name: data.name || data.display_name || '歌手',
      avatar_url: data.image_url || '',
      nationality: data.nationality || '',
      bio: data.bio || '',
    }
    albums.value = Array.isArray(data.albums)
      ? data.albums.map((album) => ({
          id: album.id,
          title: album.title || '专辑',
          year: album.year || '',
          cover_url: album.cover_url || '',
        }))
      : []
    try {
      const result = await listMusicSongs({ artist_id: id, page: 1, page_size: 20 }, { force })
      if (generation !== detailGeneration || String(route.params.artistId || '') !== id) return
      songs.value = (result?.data || []).map((song) => toPlayerSong(song, {
        avatar_url: artist.value?.avatar_url,
        name: artist.value?.name,
      }))
      if (songs.value.length > 0) {
        void loadFavoriteSongs(songs.value.map(s => String(s.id)))
      }
    } catch {
      if (generation === detailGeneration) songsError.value = '该歌手曲目加载失败，请重试。'
    }
  } catch {
    if (generation === detailGeneration) loadError.value = '歌手加载失败，请检查网络后重试。'
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
  startMobileMusicQueue(player, displaySongs.value, song.id)
}

function handlePlayAll() {
  startMobileMusicQueue(player, displaySongs.value)
}

function openAlbum(id: string) {
  void router.push(`/music/album/${id}`)
}

onMounted(() => {
  void loadArtistData()
})
watch(() => route.params.artistId, (id, previous) => {
  detailGeneration += 1
  if (id && id !== previous) void loadArtistData()
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
  backdrop-filter: blur(12px);
  border: none;
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
  font-size: 14px;
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
  padding: 16px 16px 10px;
  border: none;
}

.mobile-artist-detail__avatar-wrap {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  overflow: hidden;
  background-color: #f4f4f5;
  border: none;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
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
  margin: 0 0 2px 0;
  line-height: 1.25;
}

.mobile-artist-detail__meta {
  font-size: 11.5px;
  color: var(--a-color-text-muted, #888888);
  margin: 0 0 6px 0;
}

.mobile-artist-detail__bio {
  font-size: 11.5px;
  color: var(--a-color-text-secondary, #666666);
  line-height: 1.4;
  max-width: 320px;
  margin: 0 0 10px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Spotify-style Hero Controls */
.mobile-artist-detail__hero-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-top: 8px;
  padding: 0 4px;
}

.mobile-artist-detail__hero-actions-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mobile-artist-detail__icon-btn {
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

.mobile-artist-detail__icon-btn:active {
  background-color: var(--a-color-surface-hover, #f5f5f5);
}

.mobile-artist-detail__hero-actions-right {
  display: flex;
  align-items: center;
}

.mobile-artist-detail__play-round-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px !important;
  height: 32px !important;
  min-width: 0 !important;
  min-height: 0 !important;
  aspect-ratio: 1 / 1;
  border-radius: 50% !important;
  border: none;
  background-color: var(--a-color-text, #111111);
  color: #ffffff;
  cursor: pointer;
  padding: 0;
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.mobile-artist-detail__play-round-btn:active {
  transform: scale(0.95);
}

.mobile-artist-detail__play-round-btn:disabled {
  opacity: 0.35;
}

/* Tab + Sort Nav Bar */
.mobile-artist-detail__content-section {
  padding: 6px 0 24px;
}

.mobile-artist-detail__nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 8px;
}

/* Main Tab Switcher (单曲 / 专辑) */
.mobile-artist-detail__main-tabs {
  display: inline-flex;
  align-items: center;
  background-color: #f1f5f9;
  border-radius: 4px;
  padding: 2px;
  gap: 2px;
  height: 26px;
  min-height: 0 !important;
  box-sizing: border-box;
}

.mobile-artist-detail__main-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 0 8px;
  height: 22px !important;
  min-height: 0 !important;
  line-height: 22px;
  font-size: 11.5px;
  font-weight: 500;
  color: #64748b;
  background: transparent;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
  box-sizing: border-box;
  margin: 0;
}

.mobile-artist-detail__main-tab.is-active {
  background-color: #ffffff;
  color: #0f172a;
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.mobile-artist-detail__tab-count {
  font-size: 10px;
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
}

.mobile-artist-detail__main-tab.is-active .mobile-artist-detail__tab-count {
  color: #64748b;
}

/* Sort Switcher Tabs */
.mobile-artist-detail__sort-tabs {
  display: inline-flex;
  align-items: center;
  background-color: #f1f5f9;
  border-radius: 4px;
  padding: 2px;
  gap: 2px;
  height: 26px;
  min-height: 0 !important;
  box-sizing: border-box;
}

.mobile-artist-detail__sort-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  height: 22px !important;
  min-height: 0 !important;
  line-height: 22px;
  font-size: 11px;
  font-weight: 500;
  color: #64748b;
  background: transparent;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
  box-sizing: border-box;
  margin: 0;
}

.mobile-artist-detail__sort-btn.is-active {
  background-color: #ffffff;
  color: #0f172a;
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

/* Albums Vertical List */
.mobile-artist-detail__album-list {
  display: flex;
  flex-direction: column;
  padding: 0 16px;
}

.mobile-artist-detail__album-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
  cursor: pointer;
  border: none !important;
  border-bottom: none !important;
  border-radius: 4px;
  transition: background-color 0.15s ease;
}

.mobile-artist-detail__album-row:active {
  background-color: var(--a-color-surface-hover, #fafafa);
}

.mobile-artist-detail__album-row-cover {
  width: 48px;
  height: 48px;
  border-radius: 4px;
  overflow: hidden;
  background-color: #f4f4f5;
  border: none;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
}

.mobile-artist-detail__album-row-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-artist-detail__album-row-art {
  color: var(--a-color-text-muted, #999999);
}

.mobile-artist-detail__album-row-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mobile-artist-detail__album-row-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--a-color-text, #111111);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-artist-detail__album-row-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  color: var(--a-color-text-secondary, #71717a);
}

.mobile-artist-detail__meta-dot {
  font-size: 10px;
  color: #cbd5e1;
}

.mobile-artist-detail__album-row-arrow {
  color: #cbd5e1;
  flex-shrink: 0;
}

/* Songs List */
.mobile-artist-detail__songs {
  padding: 10px 0 16px;
  border: none;
}

.mobile-artist-detail__list {
  display: flex;
  flex-direction: column;
  border: none;
}

.mobile-artist-detail__song-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border: none !important;
  border-bottom: none !important;
  transition: background-color 0.15s ease;
  border-radius: 4px;
}

.mobile-artist-detail__song-row:active {
  background-color: var(--a-color-surface-hover, #fafafa);
}

.mobile-artist-detail__song-row.is-active {
  background-color: #f7faf8;
}

.mobile-artist-detail :deep(.mobile-artist-detail__song-item),
.mobile-artist-detail .mobile-artist-detail__song-item {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  min-height: 46px !important;
  border: none !important;
  border-bottom: none !important;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.mobile-artist-detail__song-index-col {
  width: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.mobile-artist-detail__song-index {
  font-size: 11px;
  font-family: monospace;
  color: var(--a-color-text-muted, #999999);
}

.mobile-artist-detail__playing-icon {
  color: var(--a-color-primary, #059669);
}

.mobile-artist-detail__song-cover {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  overflow: hidden;
  background-color: #f4f4f5;
  border: none;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mobile-artist-detail__song-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-artist-detail__song-art {
  color: var(--a-color-text-muted, #999999);
}

.mobile-artist-detail__song-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.mobile-artist-detail__song-title {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--a-color-text, #111111);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-artist-detail__song-row.is-active .mobile-artist-detail__song-title {
  color: var(--a-color-primary, #059669);
  font-weight: 600;
}

.mobile-artist-detail__song-album {
  font-size: 11.5px;
  color: var(--a-color-text-secondary, #71717a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Song Row Actions: Independent Favorite & Dots (...) */
.mobile-artist-detail__song-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.mobile-artist-detail__song-action-btn {
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

.mobile-artist-detail__song-action-btn:active {
  background-color: var(--a-color-surface-hover, #f0f0f0);
}

.mobile-artist-detail__song-action-btn.is-favorited {
  color: #1ed760;
  fill: currentColor;
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
  font-size: 13.5px;
  font-weight: 600;
  color: #111111;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-action-sheet__header-sub {
  font-size: 11.5px;
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
  height: 44px;
  border: none;
  background: transparent;
  color: #111111;
  font-size: 13px;
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

/* Floating Bottom Pill Toast */
.mobile-floating-toast {
  position: fixed;
  left: 50%;
  bottom: calc(72px + env(safe-area-inset-bottom, 16px));
  transform: translateX(-50%);
  background-color: rgba(18, 18, 18, 0.9);
  color: #ffffff;
  font-size: 12.5px;
  font-weight: 500;
  padding: 8px 18px;
  border-radius: 20px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  z-index: 200;
  white-space: nowrap;
  pointer-events: none;
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
.fade-leave-active,
.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to,
.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
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
