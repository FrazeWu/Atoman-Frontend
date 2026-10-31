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
            <span class="mobile-playlist-detail__count">{{ playlistCount }} 首歌曲</span>
          </div>
        </div>

        <!-- Spotify-style Hero Controls Bar -->
        <div class="mobile-playlist-detail__hero-controls">
          <div class="mobile-playlist-detail__hero-actions-left">
            <button
              type="button"
              class="mobile-playlist-detail__icon-btn"
              data-testid="playlist-share-btn"
              aria-label="分享歌单"
              @click="handleSharePlaylist"
            >
              <MIcon name="share" size="sm" />
            </button>
            <button
              v-if="canEditPlaylist"
              type="button"
              class="mobile-playlist-detail__icon-btn"
              data-testid="playlist-add-songs-btn"
              aria-label="添加歌曲"
              @click="showAddSongs = !showAddSongs"
            >
              <MIcon name="plus" size="sm" />
            </button>
          </div>

          <div class="mobile-playlist-detail__hero-actions-right">
            <button
              v-if="songs.some(canPlayMusicSong) || playlistCount > songs.length"
              type="button"
              class="mobile-playlist-detail__shuffle-btn"
              :disabled="queueLoading"
              aria-label="随机播放"
              @click="handleShufflePlay"
            >
              <MIcon name="shuffle" size="sm" />
            </button>
            <button
              type="button"
              class="mobile-playlist-detail__play-round-btn"
              :disabled="queueLoading || !(songs.some(canPlayMusicSong) || playlistCount > songs.length)"
              data-testid="play-all-btn"
              aria-label="播放全部"
              @click="handlePlayAll"
            >
              <MIcon name="player-play" size="sm" />
            </button>
          </div>
        </div>

        <div v-if="showAddSongs && canEditPlaylist" class="mobile-playlist-detail__add-panel" data-testid="playlist-add-panel">
          <label for="playlist-song-search">搜索要添加的歌曲</label>
          <input id="playlist-song-search" v-model="addQuery" type="search" placeholder="输入歌曲名或歌手" @keyup.enter="searchAddSongs" />
          <MButton size="sm" variant="secondary" :disabled="addSearching || !addQuery.trim()" @click="searchAddSongs">搜索</MButton>
          <p v-if="addMessage" role="status">{{ addMessage }}</p>
          <div v-for="candidate in addResults" :key="candidate.id" class="mobile-playlist-detail__add-result">
            <span>{{ candidate.title }} · {{ candidate.artist }}</span>
            <button type="button" :disabled="addSaving === candidate.id || songs.some(song => String(song.id) === String(candidate.id))" :aria-label="`添加 ${candidate.title}`" @click="addSong(candidate.id)">
              {{ songs.some(song => String(song.id) === String(candidate.id)) ? '已添加' : '添加' }}
            </button>
          </div>
        </div>
        <p v-if="queueLoading" class="mobile-playlist-detail__queue-status" role="status" data-testid="playlist-queue-loading">正在读取完整播放队列…</p>
        <p v-if="queueError" class="mobile-playlist-detail__queue-error" role="alert" data-testid="playlist-queue-error">{{ queueError }}</p>
      </section>

      <!-- Songs List (Spotify Inspired, Borderless, Compact) -->
      <section class="mobile-playlist-detail__songs" aria-label="歌曲列表">
        <div class="mobile-playlist-detail__list-header">
          <span class="mobile-playlist-detail__list-title">曲目列表</span>
        </div>

        <div v-if="songs.length > 0" class="mobile-playlist-detail__list">
          <div
            v-for="(song, index) in songs"
            :key="song.id"
            class="mobile-playlist-detail__song-row"
            :class="{ 'is-active': isCurrentSong(song) }"
          >
            <!-- Left: Playable Song Content Area -->
            <button
              type="button"
              class="mobile-playlist-detail__song-item"
              data-testid="playlist-song-item"
              :disabled="queueLoading || !canPlayMusicSong(song)"
              :aria-label="canPlayMusicSong(song) ? '播放 ' + song.title : song.title + '，暂无可播放音源'"
              @click="playSong(song)"
            >
              <div class="mobile-playlist-detail__song-index-col">
                <MIcon
                  v-if="isCurrentSong(song) && player.isPlaying"
                  name="waveform"
                  size="xs"
                  class="mobile-playlist-detail__playing-icon"
                />
                <MIcon
                  v-else-if="isCurrentSong(song)"
                  name="player-play"
                  size="xs"
                  class="mobile-playlist-detail__playing-icon"
                />
                <span v-else class="mobile-playlist-detail__song-index">
                  {{ String(index + 1).padStart(2, '0') }}
                </span>
              </div>

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

              <span v-if="!canPlayMusicSong(song)" class="mobile-music-no-audio">暂无音源</span>
            </button>

            <!-- Right: Independent Favorite & Spotify-style More (...) Actions -->
            <div class="mobile-playlist-detail__song-actions">
              <button
                type="button"
                class="mobile-playlist-detail__song-action-btn"
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
                class="mobile-playlist-detail__song-action-btn"
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
        <div v-else class="mobile-playlist-detail__empty" data-testid="playlist-empty">
          <MIcon name="note" size="lg" class="mobile-playlist-detail__empty-icon" />
          <p class="mobile-playlist-detail__empty-text">歌单内暂无歌曲</p>
        </div>
        <div v-if="listHasMore || listLoading || listError" class="mobile-playlist-detail__list-pagination">
          <p v-if="playlistCount > songs.length" class="mobile-playlist-detail__queue-status">
            当前展示前 {{ songs.length }} 首，播放全部可加入完整歌单。
          </p>
          <p class="mobile-playlist-detail__list-progress" role="status">
            已展示 {{ songs.length }} / {{ playlistCount }} 首歌曲
          </p>
          <p v-if="listError" class="mobile-playlist-detail__queue-error" role="alert" data-testid="playlist-list-error">
            {{ listError }}
          </p>
          <MButton
            v-if="listHasMore"
            size="sm"
            variant="secondary"
            :disabled="listLoading"
            data-testid="playlist-load-more-btn"
            @click="loadMoreSongs"
          >
            {{ listLoading ? '正在加载更多歌曲…' : listError ? '重试加载' : '加载更多歌曲' }}
          </MButton>
        </div>
      </section>
    </main>

    <div v-else-if="loadError" class="mobile-playlist-detail__empty" role="alert" data-testid="playlist-load-error">
      <p class="mobile-playlist-detail__empty-text">{{ loadError }}</p>
      <MButton size="sm" variant="secondary" @click="loadPlaylistData">重新加载</MButton>
    </div>

    <!-- Failed / Not Found -->
    <div v-else class="mobile-playlist-detail__empty" data-testid="playlist-not-found">
      <MIcon name="playlists" size="lg" class="mobile-playlist-detail__empty-icon" />
      <p class="mobile-playlist-detail__empty-text">未找到歌单信息</p>
      <MButton size="sm" variant="secondary" @click="handleBack">返回歌单列表</MButton>
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
              v-if="activeMenuSong.cover_url || playlist?.cover_url"
              :src="activeMenuSong.cover_url || playlist?.cover_url"
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
              {{ activeMenuSong.artist || '未知艺术家' }} · {{ playlist?.name || '歌单' }}
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
            v-if="activeMenuSong.artist"
            type="button"
            class="mobile-action-sheet__item"
            @click="handleGoToArtist(activeMenuSong)"
          >
            <MIcon name="person" size="sm" />
            <span>转至艺人</span>
          </button>

          <button
            v-if="canEditPlaylist"
            type="button"
            class="mobile-action-sheet__item mobile-action-sheet__item--danger"
            @click="handleRemoveFromThisPlaylist(activeMenuSong)"
          >
            <MIcon name="trash" size="sm" />
            <span>从此歌单中移除</span>
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
import { onBeforeUnmount, onDeactivated, onMounted, ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getMusicPlaylist, listMusicPlaylistSongs, searchMusicSongs, addMusicPlaylistSong, removeMusicPlaylistSong } from '@/api/musicV1'
import { useAudioPlayerStore } from '@/stores/player'
import { useAuthStore } from '@/stores/auth'
import { useMusicFavoritePlaylist } from '@/composables/useMusicFavoritePlaylist'
import type { Song } from '@/types'
import { musicAudioFromApi, musicPlaybackDetailsFromApi, canPlayMusicSong, fetchFullMobilePlaylist, startMobileMusicQueue } from '@mobile/mobileMusicPlayback'
import MButton from '@mobile/components/ui/MButton.vue'
import MIcon from '@mobile/components/ui/MIcon.vue'

export interface PlaylistDetailData {
  id: string
  name: string
  description?: string
  cover_url?: string
  creator?: { display_name?: string }
  user_id?: string
  kind?: string
  song_count?: number
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
const authStore = useAuthStore()
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

async function handleSharePlaylist() {
  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(shareUrl)
      showToast('歌单链接已复制到剪贴板')
      return
    } catch {
      // ignore
    }
  }
  showToast('歌单链接已生成')
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

function handleGoToArtist(song: Song) {
  closeSongMenu()
  const artistName = song.artist || ''
  if (artistName) {
    void router.push({ path: '/music/search', query: { q: artistName } })
  }
}

async function handleRemoveFromThisPlaylist(song: Song) {
  closeSongMenu()
  if (!playlist.value || !canEditPlaylist.value) return
  try {
    await removeMusicPlaylistSong(playlist.value.id, String(song.id))
    songs.value = songs.value.filter(s => String(s.id) !== String(song.id))
    if (playlist.value.song_count) {
      playlist.value.song_count = Math.max(0, playlist.value.song_count - 1)
    }
    showToast('已从歌单移除')
  } catch {
    showToast('移除失败，请重试')
  }
}

const showAddSongs = ref(false)
const addQuery = ref('')
const addResults = ref<Awaited<ReturnType<typeof searchMusicSongs>>>([])
const addSearching = ref(false)
const addSaving = ref('')
const addMessage = ref('')
const canEditPlaylist = computed(() => authStore.isAuthenticated && Boolean(playlist.value?.user_id) && String(playlist.value?.user_id) === String(authStore.user?.uuid))

async function searchAddSongs() {
  if (!addQuery.value.trim() || addSearching.value) return
  addSearching.value = true
  addMessage.value = ''
  try { addResults.value = (await searchMusicSongs(addQuery.value.trim())).slice(0, 30) }
  catch { addMessage.value = '搜索失败，请重试' }
  finally { addSearching.value = false }
}
async function addSong(id: string) {
  if (!playlist.value || !canEditPlaylist.value || addSaving.value) return
  addSaving.value = id
  addMessage.value = ''
  try {
    await addMusicPlaylistSong(playlist.value.id, id)
    fullQueueCache = null
    await loadPlaylistData()
    addMessage.value = '已添加到歌单'
  } catch { addMessage.value = '添加失败，请重试' }
  finally { addSaving.value = '' }
}

const loading = ref(false)
const loadError = ref('')
const playlist = ref<PlaylistDetailData | null>(props.initialPlaylist || null)
const songs = ref<Song[]>(props.initialSongs || [])
const listLoading = ref(false)
const listError = ref('')
const listPage = ref(1)
const listHasMore = ref(Boolean(props.initialPlaylist?.song_count &&
  props.initialPlaylist.song_count > (props.initialSongs?.length || 0)))
const playlistCount = computed(() => Math.max(songs.value.length, playlist.value?.song_count || 0))
const queueLoading = ref(false)
const queueError = ref('')
let fullQueueCache: { playlistId: string; songs: Song[] } | null = null
let queueGeneration = 0
let unmounted = false
let detailGeneration = 0
let listGeneration = 0

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
    ...musicAudioFromApi(item),
    ...musicPlaybackDetailsFromApi(item),
    playlist_id: playlist.value?.id,
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
  const generation = ++detailGeneration
  const id = String(route.params.playlistId || '')
  if (!id) { loadError.value = '歌单标识缺失。'; return }
  queueGeneration += 1
  listGeneration += 1
  fullQueueCache = null
  queueLoading.value = false
  queueError.value = ''
  listLoading.value = false
  listError.value = ''
  listPage.value = 1
  listHasMore.value = false
  loading.value = true
  loadError.value = ''
  playlist.value = null
  songs.value = []
  try {
    const data = await getMusicPlaylist(id)
    if (generation !== detailGeneration || String(route.params.playlistId || '') !== id) return
    if (!data?.id) { loadError.value = '未找到歌单信息。'; return }
    playlist.value = {
      id: data.id,
      name: data.name || '歌单',
      description: data.description || '',
      cover_url: data.cover_url || '',
      song_count: data.song_count,
      user_id: data.user_id,
      kind: data.kind,
      creator: data.owner_username ? { display_name: data.owner_username } : undefined,
    }
    songs.value = Array.isArray(data.songs)
      ? data.songs.map((song) => toPlayerSong(song, playlist.value?.cover_url))
      : []
    listHasMore.value = Boolean(playlist.value.song_count && playlist.value.song_count > songs.value.length)
    if (songs.value.length > 0) {
      void loadFavoriteSongs(songs.value.map(s => String(s.id)))
    }
  } catch {
    if (generation === detailGeneration) loadError.value = '歌单加载失败，请检查网络后重试。'
  } finally {
    if (generation === detailGeneration) loading.value = false
  }
}

function handleBack() {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back()
  } else {
    void router.push('/music/playlists')
  }
}

const LIST_PAGE_SIZE = 20

async function loadMoreSongs() {
  const current = playlist.value
  if (!current || !listHasMore.value || listLoading.value || unmounted) return
  const playlistId = String(current.id)
  const requestedPage = listPage.value + 1
  const generation = ++listGeneration
  listLoading.value = true
  listError.value = ''

  try {
    let nextSongs: Song[]
    let hasMore: boolean
    if (fullQueueCache?.playlistId === playlistId) {
      // Clicking Play All already loaded every page. Reuse the same ordered
      // snapshot rather than duplicating network traffic for visual paging.
      const start = (requestedPage - 1) * LIST_PAGE_SIZE
      nextSongs = fullQueueCache.songs.slice(start, start + LIST_PAGE_SIZE)
      hasMore = start + nextSongs.length < fullQueueCache.songs.length
    } else {
      const page = await listMusicPlaylistSongs(playlistId, {
        page: requestedPage, page_size: LIST_PAGE_SIZE,
      })
      if (!Array.isArray(page?.data) || typeof page.meta?.has_more !== 'boolean') {
        throw new Error('Invalid playlist page')
      }
      nextSongs = page.data.map((song) => toPlayerSong(song, current.cover_url))
      hasMore = page.meta.has_more
    }
    if (generation !== listGeneration || unmounted ||
      String(playlist.value?.id) !== playlistId ||
      (!props.initialPlaylist && String(route.params.playlistId || '') !== playlistId)) return
    if (!nextSongs.length && hasMore) throw new Error('Playlist page made no progress')

    songs.value = [...songs.value, ...nextSongs]
    listPage.value = requestedPage
    listHasMore.value = hasMore
    if (!hasMore && playlist.value && playlist.value.song_count !== songs.value.length) {
      // Song count may have changed since the overview was requested.
      playlist.value.song_count = songs.value.length
    }
  } catch {
    if (generation === listGeneration && !unmounted) {
      listError.value = '后续歌曲加载失败，已加载的曲目不会丢失，请重试。'
    }
  } finally {
    if (generation === listGeneration && !unmounted) listLoading.value = false
  }
}

async function startPlaylistPlayback(startSongId?: Song['id']) {
  const currentPlaylist = playlist.value
  if (!currentPlaylist || queueLoading.value || unmounted) return

  const playlistId = String(currentPlaylist.id)
  const generation = ++queueGeneration
  queueLoading.value = true
  queueError.value = ''

  try {
    let allSongs: Song[]
    if (props.initialSongs !== undefined) {
      // Injected complete lists (tests / consumers) do not need a remote fetch.
      allSongs = songs.value
    } else if (fullQueueCache?.playlistId === playlistId) {
      allSongs = fullQueueCache.songs
    } else {
      const remoteSongs = await fetchFullMobilePlaylist(
        playlistId,
        listMusicPlaylistSongs,
        () => generation === queueGeneration
          && !unmounted
          && String(playlist.value?.id) === playlistId
          && String(route.params.playlistId || '') === playlistId,
      )
      if (generation !== queueGeneration || unmounted
          || String(playlist.value?.id) !== playlistId
          || String(route.params.playlistId || '') !== playlistId) return

      allSongs = remoteSongs.map((song) => toPlayerSong(song, currentPlaylist.cover_url))
      fullQueueCache = { playlistId, songs: allSongs }
    }

    if (generation !== queueGeneration || unmounted
        || String(playlist.value?.id) !== playlistId
        || (!props.initialPlaylist && String(route.params.playlistId || '') !== playlistId)) return

    if (!startMobileMusicQueue(player, allSongs, startSongId)) {
      queueError.value = startSongId === undefined
        ? '当前歌单暂无可播放的歌曲。'
        : '选中的歌曲已不可播放，请重试。'
    }
  } catch {
    if (generation === queueGeneration && !unmounted) {
      queueError.value = '完整歌单加载失败，请检查网络后重试。'
    }
  } finally {
    if (generation === queueGeneration && !unmounted) queueLoading.value = false
  }
}

function playSong(song: Song) {
  if (!canPlayMusicSong(song)) return
  void startPlaylistPlayback(song.id)
}

function handlePlayAll() {
  void startPlaylistPlayback()
}

function handleShufflePlay() {
  player.playbackMode = 'random'
  void startPlaylistPlayback()
}

onMounted(() => {
  void loadPlaylistData()
})
watch(() => route.params.playlistId, (id, previous) => {
  detailGeneration += 1
  queueGeneration += 1
  listGeneration += 1
  queueLoading.value = false
  listLoading.value = false
  if (id && id !== previous) void loadPlaylistData()
})
onDeactivated(() => {
  // A hidden KeepAlive view must ignore stale playlist pages and queue requests.
  queueGeneration += 1
  queueLoading.value = false
  listGeneration += 1
  listLoading.value = false
})
onBeforeUnmount(() => {
  unmounted = true
  queueGeneration += 1
  listGeneration += 1
})
</script>

<style scoped>
.mobile-playlist-detail__list-pagination {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 8px;
}
.mobile-playlist-detail__list-progress {
  margin: 0;
  font-size: 12px;
  color: var(--a-color-text-secondary, #666666);
}
.mobile-playlist-detail__list-pagination button {
  min-height: 44px;
  min-width: 144px;
}
.mobile-playlist-detail__queue-status {
  padding: 8px 0;
  color: var(--a-color-muted, #64748b);
  font-size: 12px;
}
.mobile-playlist-detail__queue-error {
  padding: 8px 0;
  color: #b42318;
  font-size: 13px;
}


.mobile-playlist-detail {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background-color: #ffffff;
  padding-bottom: var(--mobile-music-page-bottom, calc(56px + env(safe-area-inset-bottom, 16px) + 1.5rem));
}

/* Top Sticky Navigation Bar */
.mobile-playlist-detail__topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 8px;
  background-color: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  border: none;
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
  font-size: 14px;
  font-weight: 600;
  color: var(--a-color-text, #111111);
}

.mobile-playlist-detail__topbar-space {
  width: 36px;
}

/* Hero Section */
.mobile-playlist-detail__hero {
  display: flex;
  flex-direction: column;
  padding: 12px 16px 8px 16px;
  border: none;
}

.mobile-playlist-detail__cover-wrap {
  width: 140px;
  height: 140px;
  border-radius: 4px;
  overflow: hidden;
  border: none;
  background: #f4f4f5;
  margin: 0 auto 14px auto;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
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
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mobile-playlist-detail__name {
  font-size: 18px;
  font-weight: 700;
  color: var(--a-color-text, #111111);
  margin: 0;
  line-height: 1.25;
}

.mobile-playlist-detail__desc {
  font-size: 11.5px;
  color: var(--a-color-text-secondary, #666666);
  margin: 2px 0 0 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.mobile-playlist-detail__meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--a-color-text-muted, #888888);
  margin-top: 2px;
}

.mobile-playlist-detail__creator {
  font-weight: 500;
}

/* Spotify-style Action Bar */
.mobile-playlist-detail__hero-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
}

.mobile-playlist-detail__hero-actions-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mobile-playlist-detail__icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--a-color-text-secondary, #666666);
  cursor: pointer;
  border-radius: 50%;
  transition: color 0.15s ease;
}

.mobile-playlist-detail__icon-btn:active {
  background-color: var(--a-color-surface-hover, #f5f5f5);
}

.mobile-playlist-detail__hero-actions-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mobile-playlist-detail__shuffle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--a-color-text-secondary, #666666);
  cursor: pointer;
  border-radius: 50%;
  padding: 0;
  transition: color 0.15s ease;
}

.mobile-playlist-detail__shuffle-btn:disabled {
  opacity: 0.35;
}

.mobile-playlist-detail__play-round-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background-color: #1ed760;
  color: #000000;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(30, 215, 96, 0.35);
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.mobile-playlist-detail__play-round-btn:active {
  transform: scale(0.95);
}

.mobile-playlist-detail__play-round-btn:disabled {
  opacity: 0.35;
}

/* Tracklist: Completely Borderless, Flat, Spotify-like Rows */
.mobile-playlist-detail__songs {
  padding: 4px 16px 16px 16px;
  border: none;
}

.mobile-playlist-detail__list-header {
  margin-bottom: 6px;
}

.mobile-playlist-detail__list-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--a-color-text-muted, #999999);
}

.mobile-playlist-detail__list {
  display: flex;
  flex-direction: column;
  border: none !important;
  background: transparent !important;
}

.mobile-playlist-detail__song-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: none !important;
  border-bottom: none !important;
  transition: background-color 0.15s ease;
  border-radius: 4px;
}

.mobile-playlist-detail__song-row:active {
  background-color: var(--a-color-surface-hover, #fafafa);
}

.mobile-playlist-detail__song-row.is-active {
  background-color: #f7faf8;
}

.mobile-playlist-detail :deep(.mobile-playlist-detail__song-item),
.mobile-playlist-detail .mobile-playlist-detail__song-item {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 4px;
  min-height: 46px !important;
  border: none !important;
  border-bottom: none !important;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.mobile-playlist-detail__song-index-col {
  width: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.mobile-playlist-detail__song-index {
  font-size: 11px;
  font-family: monospace;
  color: var(--a-color-text-muted, #999999);
}

.mobile-playlist-detail__playing-icon {
  color: var(--a-color-primary, #059669);
}

.mobile-playlist-detail__song-cover {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  overflow: hidden;
  background: #f4f4f5;
  border: none;
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
  gap: 1px;
}

.mobile-playlist-detail__song-title {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--a-color-text, #111111);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-playlist-detail__song-row.is-active .mobile-playlist-detail__song-title {
  color: var(--a-color-primary, #059669);
  font-weight: 600;
}

.mobile-playlist-detail__song-artist {
  font-size: 11.5px;
  color: var(--a-color-text-secondary, #71717a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Song Row Actions: Independent Favorite & Dots (...) */
.mobile-playlist-detail__song-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.mobile-playlist-detail__song-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--a-color-text-muted, #999999);
  cursor: pointer;
  border-radius: 50%;
  transition: color 0.15s ease;
}

.mobile-playlist-detail__song-action-btn:active {
  background-color: var(--a-color-surface-hover, #f0f0f0);
}

.mobile-playlist-detail__song-action-btn.is-favorited {
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

.mobile-action-sheet__item--danger {
  color: #dc2626;
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
  background: #f4f4f5;
  color: var(--a-color-text-muted, #999999);
  margin-bottom: 16px;
}

.mobile-playlist-detail__empty-text {
  font-size: 13px;
  color: var(--a-color-text-secondary, #666666);
  margin: 0 0 16px 0;
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
</style>

<style scoped>
.mobile-playlist-detail__add-panel{margin:12px 16px;padding:12px;border:1px solid var(--a-color-border-soft);border-radius:8px;display:flex;flex-direction:column;gap:10px}
.mobile-playlist-detail__add-panel input{width:100%;min-height:44px;padding:8px;border:1px solid var(--a-color-border-soft);border-radius:6px;background:var(--a-color-surface);color:inherit}
.mobile-playlist-detail__add-result{display:flex;justify-content:space-between;align-items:center;gap:8px;min-height:44px}
.mobile-playlist-detail__add-result span{min-width:0;overflow:hidden;text-overflow:ellipsis}
.mobile-playlist-detail__add-result button{min-height:44px;padding:0 12px;border:1px solid var(--a-color-border-soft);border-radius:6px}
</style>
