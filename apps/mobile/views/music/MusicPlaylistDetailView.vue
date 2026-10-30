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

          <div class="mobile-playlist-detail__actions">
            <MButton
              size="sm"
              variant="primary"
              :disabled="queueLoading || !(songs.some(canPlayMusicSong) || playlistCount > songs.length)"
              data-testid="play-all-btn"
              @click="handlePlayAll"
            >
              <MIcon name="player-play" size="xs" />
              <span>{{ queueLoading ? '正在加载完整歌单…' : '播放全部' }}</span>
            </MButton>
            <MButton v-if="canEditPlaylist" size="sm" variant="secondary" data-testid="playlist-add-songs-btn" @click="showAddSongs = !showAddSongs">
              <MIcon name="plus" size="xs" /><span>添加歌曲</span>
            </MButton>
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
        </div>
      </section>

      <!-- Songs List -->
      <section class="mobile-playlist-detail__songs" aria-label="歌曲列表">
        <div class="mobile-playlist-detail__list-header">
          <span class="mobile-playlist-detail__list-title">曲目列表</span>
        </div>

        <div v-if="songs.length > 0" class="mobile-playlist-detail__list">
          <button
            v-for="(song, index) in songs"
            :key="song.id"
            type="button"
            class="mobile-playlist-detail__song-item"
            data-testid="playlist-song-item"
            :disabled="queueLoading || !canPlayMusicSong(song)"
            :aria-label="canPlayMusicSong(song) ? '播放' + song.title : song.title + '，暂无可播放音源'"
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

            <span v-if="!canPlayMusicSong(song)" class="mobile-music-no-audio">暂无音源</span>
            <span v-else-if="formatDuration(song.duration)" class="mobile-playlist-detail__song-dur">
              {{ formatDuration(song.duration) }}
            </span>
          </button>
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
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onDeactivated, onMounted, ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getMusicPlaylist, listMusicPlaylistSongs, searchMusicSongs, addMusicPlaylistSong } from '@/api/musicV1'
import { useAudioPlayerStore } from '@/stores/player'
import { useAuthStore } from '@/stores/auth'
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

<style scoped>
.mobile-playlist-detail__add-panel{margin:12px 16px;padding:12px;border:1px solid var(--a-color-border-soft);border-radius:8px;display:flex;flex-direction:column;gap:10px}
.mobile-playlist-detail__add-panel input{width:100%;min-height:44px;padding:8px;border:1px solid var(--a-color-border-soft);border-radius:6px;background:var(--a-color-surface);color:inherit}
.mobile-playlist-detail__add-result{display:flex;justify-content:space-between;align-items:center;gap:8px;min-height:44px}
.mobile-playlist-detail__add-result span{min-width:0;overflow:hidden;text-overflow:ellipsis}
.mobile-playlist-detail__add-result button{min-height:44px;padding:0 12px;border:1px solid var(--a-color-border-soft);border-radius:6px}
</style>
