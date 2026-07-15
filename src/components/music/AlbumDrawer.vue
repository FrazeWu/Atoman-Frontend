<!-- web/src/components/music/AlbumDrawer.vue -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ApiErrorResponseError } from '@/api/client'
import { modulePathUrl } from '@/router/siteUrls'
import PSheet from '@/components/ui/PSheet.vue'
import PButton from '@/components/ui/PButton.vue'
import CommentSection from '@/components/comment/CommentSection.vue'
import PDropdown from '@/components/ui/PDropdown.vue'
import PToast from '@/components/ui/PToast.vue'
import { Plus, Play, Heart } from 'lucide-vue-next'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import {
  createAlbumBookmark,
  deleteAlbumBookmark,
  getMusicAlbum,
  getMusicPlaylist,
  listAlbumBookmarks,
  listMusicPlaylists,
  addMusicPlaylistSong,
  removeMusicPlaylistSong,
  createMusicPlaylist,
  type MusicAlbumListItem,
  type MusicPlaylistSummary,
} from '@/api/musicV1'
import { usePlayerStore } from '@/stores/player'
import { buildPlayableSongsFromAlbum, resolveAlbumCoverUrl } from '@/utils/musicMedia'

const { state, closeAlbum, isAlbumShifted, openNestedAction, openArtist } = useMusicDrawers()
const player = usePlayerStore()
const isOpen = computed(() => state.value.albumId !== null)
const sheetIndex = computed(() => state.value.artistId !== null ? 1 : 0)
const album = ref<MusicAlbumListItem | null>(null)
const loading = ref(false)
const errorMessage = ref('')
const isCoverBroken = ref(false)
const isBookmarked = ref(false)
const bookmarkLoading = ref(false)

const playlists = ref<MusicPlaylistSummary[]>([])
const playlistsLoaded = ref(false)
const favoriteSongIds = ref<Set<string>>(new Set())
const toastVisible = ref(false)
const toastMessage = ref('')

const artistNames = computed(() => album.value?.artists?.map((artist) => artist.name).join(' / ') || 'Unknown Artist')
const releaseYear = computed(() => {
  const year = album.value?.release_date?.slice(0, 4)
  if (!year || year === '0001' || year === '0000' || year === '----') return ''
  return year
})
const tracks = computed(() => [...(album.value?.songs || [])].sort((a, b) => (a.track_number || 0) - (b.track_number || 0)))
const coverUrl = computed(() => album.value ? resolveAlbumCoverUrl(album.value) : '')
const playableSongs = computed(() => album.value ? buildPlayableSongsFromAlbum(album.value) : [])
const playableSongIdSet = computed(() => new Set(playableSongs.value.map((song) => String(song.id))))
const editAlbumHref = computed(() => {
  if (!album.value?.id) return modulePathUrl('music', '/')
  return modulePathUrl('music', `/album/${album.value.id}/edit`)
})
function formatDuration(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    const minutes = Math.floor(value / 60)
    const seconds = Math.floor(value % 60)
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  }

  if (typeof value === 'string' && value.trim()) return value
  return ''
}

function getTrackDurationLabel(track: MusicAlbumListItem['songs'][number] | Record<string, unknown>): string {
  return formatDuration((track as { duration_sec?: unknown }).duration_sec ?? (track as { duration?: unknown }).duration)
}

function playAlbum() {
  if (!playableSongs.value.length) return
  player.playAlbum(playableSongs.value)
}

function canPlayTrack(track: MusicAlbumListItem['songs'][number]) {
  return playableSongIdSet.value.has(String(track.id))
}

function playTrack(track: MusicAlbumListItem['songs'][number]) {
  if (!canPlayTrack(track)) return
  const startIndex = playableSongs.value.findIndex((song) => String(song.id) === String(track.id))
  if (startIndex < 0) return
  player.playAlbum(playableSongs.value, startIndex)
}

function handleCoverError() {
  isCoverBroken.value = true
}

async function loadPlaylists() {
  try {
    const res = await listMusicPlaylists()
    playlists.value = res.data
    playlistsLoaded.value = true
  } catch (err) {
    if (err instanceof ApiErrorResponseError && err.status === 401) {
      playlists.value = []
      playlistsLoaded.value = true
      return
    }
    console.error('Failed to load playlists in AlbumDrawer:', err)
  }
}

async function loadFavorites() {
  try {
    const res = await listMusicPlaylists()
    const list = res.data || []
    const fav = list.find((p) => p.name === '最爱' || p.name === '我喜欢的单曲' || p.name === '我喜欢')
    if (fav) {
      const favPlaylistDetail = await getMusicPlaylist(String(fav.id))
      const ids = (favPlaylistDetail.songs || []).map((s) => String(s.id))
      favoriteSongIds.value = new Set(ids)
    } else {
      favoriteSongIds.value = new Set()
    }
  } catch (err) {
    if (err instanceof ApiErrorResponseError && err.status === 401) {
      favoriteSongIds.value = new Set()
      return
    }
    console.error('Failed to load favorites in AlbumDrawer:', err)
  }
}

async function toggleTrackFavorite(songId: string) {
  try {
    const res = await listMusicPlaylists()
    const list = res.data || []
    let fav = list.find((p) => p.name === '最爱' || p.name === '我喜欢的单曲' || p.name === '我喜欢')
    if (!fav) {
      fav = await createMusicPlaylist({ name: '最爱' })
      // Refresh sidebar/playlists
      await loadPlaylists()
    }
    const playlistId = String(fav.id)
    const isFav = favoriteSongIds.value.has(songId)
    if (isFav) {
      await removeMusicPlaylistSong(playlistId, songId)
      favoriteSongIds.value.delete(songId)
      toastMessage.value = '已从最爱中移除'
    } else {
      await addMusicPlaylistSong(playlistId, songId)
      favoriteSongIds.value.add(songId)
      toastMessage.value = '已添加到最爱'
    }
    toastVisible.value = true
  } catch (err) {
    console.error('Failed to toggle favorite:', err)
    toastMessage.value = '操作失败'
    toastVisible.value = true
  }
}

async function addTrackToPlaylist(playlistId: string, songId: string) {
  try {
    await addMusicPlaylistSong(playlistId, songId)
    toastMessage.value = '已成功添加到歌单'
    toastVisible.value = true
    // If the playlist happens to be the favorites playlist, update favoriteSongIds too
    const res = await listMusicPlaylists()
    const list = res.data || []
    const fav = list.find((p) => p.name === '最爱' || p.name === '我喜欢的单曲' || p.name === '我喜欢')
    if (fav && String(fav.id) === playlistId) {
      favoriteSongIds.value.add(songId)
    }
  } catch (err) {
    console.error('Failed to add song to playlist:', err)
    toastMessage.value = '添加失败'
    toastVisible.value = true
  }
}

async function loadAlbum(albumId: string | null) {
  if (!albumId) {
    album.value = null
    isBookmarked.value = false
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    album.value = await getMusicAlbum(albumId)
    try {
      const bookmarksResponse = await listAlbumBookmarks()
      isBookmarked.value = bookmarksResponse.data.some((bookmark) => String(bookmark.album_id) === String(albumId))
    } catch (error) {
      if (error instanceof ApiErrorResponseError && error.status === 401) {
        isBookmarked.value = false
      } else {
        throw error
      }
    }
    isCoverBroken.value = false

    await Promise.all([
      playlistsLoaded.value ? Promise.resolve() : loadPlaylists(),
      loadFavorites(),
    ])
  } catch (error) {
    console.error('Failed to fetch album:', error)
    errorMessage.value = '专辑信息加载失败'
  } finally {
    loading.value = false
  }
}

async function toggleAlbumBookmark() {
  const albumId = album.value?.id
  if (!albumId || bookmarkLoading.value) return

  bookmarkLoading.value = true
  try {
    if (isBookmarked.value) {
      await deleteAlbumBookmark(albumId)
      isBookmarked.value = false
      return
    }

    await createAlbumBookmark(albumId)
    isBookmarked.value = true
  } catch (error) {
    console.error('Failed to toggle album bookmark:', error)
  } finally {
    bookmarkLoading.value = false
  }
}

watch(() => state.value.albumId, loadAlbum, { immediate: true })
watch(
  () => state.value.albumRefreshToken,
  () => {
    if (state.value.albumId) void loadAlbum(state.value.albumId)
  },
)
</script>

<template>
  <PSheet
    :show="isOpen"
    @close="closeAlbum"
    width="700px"
    :is-shifted="isAlbumShifted"
    :index="sheetIndex"
  >
    <div class="drawer-header">
      <div>
        <div class="kicker">专辑资料</div>
      </div>
    </div>

    <div class="drawer-body">
      <p v-if="errorMessage" class="state-line state-line--error">{{ errorMessage }}</p>
      <p v-else-if="loading" class="state-line">正在加载专辑...</p>

      <div v-else class="album-meta-row">
        <div class="album-cover">
          <img v-if="coverUrl && !isCoverBroken" :src="coverUrl" alt="" class="album-cover-img" @error="handleCoverError" />
          <span v-else>封面</span>
        </div>
        <div class="album-info">
          <div class="album-type">{{ album?.album_type || '专辑' }}</div>
          <h2 class="album-title">{{ album?.title || `Album ${state.albumId}` }}</h2>
          <div class="meta-tags">
            <span class="artist-name">
              <template v-for="(artist, index) in album?.artists" :key="artist.id">
                <span v-if="index > 0" class="artist-separator"> / </span>
                <button
                  class="artist-link"
                  type="button"
                  @click="openArtist(String(artist.id))"
                >
                  {{ artist.name }}
                </button>
              </template>
              <template v-if="!album?.artists?.length">未知艺术家</template>
            </span>
            <span v-if="releaseYear" class="release-year">{{ releaseYear }}</span>
          </div>
          <p class="summary">{{ album?.description || '暂无专辑简介。' }}</p>
        </div>
      </div>

      <div class="action-bar">
        <PButton
          variant="primary"
          :disabled="!playableSongs.length"
          dot
          @click="playAlbum"
        >
          播放全专
        </PButton>
        <PButton
          variant="secondary"
          :disabled="bookmarkLoading"
          dot
          data-testid="album-bookmark-toggle"
          @click="toggleAlbumBookmark"
        >
          {{ isBookmarked ? '已订阅' : '订阅' }}
        </PButton>
        <div class="spacer"></div>
        <PButton
          variant="secondary"
          :href="editAlbumHref"
          dot
        >
          编辑
        </PButton>
        <PButton
          variant="secondary"
          dot
          @click="openNestedAction('revise')"
        >
          修改
        </PButton>
        <PButton
          variant="secondary"
          dot
          @click="openNestedAction('history')"
        >
          版本
        </PButton>
      </div>

      <div class="content-section">
        <div class="section-title">曲目</div>
        <div v-if="!tracks.length" class="track-empty">暂无曲目。</div>
        <div v-for="(track, index) in tracks" :key="track.id" class="track">
          <div class="track-main">
            <button
              class="track-play-btn"
              type="button"
              :disabled="!canPlayTrack(track)"
              :data-testid="`track-play-${track.id}`"
              @click="playTrack(track)"
              aria-label="播放"
            >
              <span class="track-num">{{ index + 1 }}</span>
              <Play class="track-play-icon" :size="14" fill="currentColor" />
            </button>
            <div class="track-title">{{ track.title }}</div>
          </div>
          <div class="track-meta">
            <span v-if="!canPlayTrack(track)" class="track-unavailable">无音频</span>
            <div v-if="getTrackDurationLabel(track)" class="track-time">{{ getTrackDurationLabel(track) }}</div>

            <button
              type="button"
              class="track-fav-btn"
              :class="{ 'is-active': favoriteSongIds.has(String(track.id)) }"
              title="添加到最爱"
              @click="toggleTrackFavorite(String(track.id))"
            >
              <Heart :size="12" :fill="favoriteSongIds.has(String(track.id)) ? 'currentColor' : 'none'" />
            </button>

            <PDropdown class="track-add-dropdown" position="right">
              <template #trigger>
                <button class="track-add-btn" type="button" title="添加到歌单">
                  <Plus :size="12" />
                </button>
              </template>
              <div class="track-add-menu">
                <div class="track-add-menu-header">添加到歌单</div>
                <div v-if="!playlists.length" class="track-add-menu-empty">暂无歌单</div>
                <button
                  v-for="p in playlists"
                  :key="p.id"
                  type="button"
                  class="track-add-menu-item"
                  @click="addTrackToPlaylist(String(p.id), track.id)"
                >
                  {{ p.name }}
                </button>
              </div>
            </PDropdown>
          </div>
        </div>
      </div>
      <CommentSection
        v-if="album"
        class="album-discussion"
        :target="{ kind: 'music_album', resourceId: String(album.id) }"
        noun="讨论"
      />
    </div>
    <PToast v-model="toastVisible" :message="toastMessage" type="success" />
  </PSheet>
</template>

<style scoped>
.drawer-header {
  margin: -2.5rem -2.5rem 0;
  padding: 1.5rem 2.5rem 1.25rem;
  border-bottom: 1px solid var(--a-color-line-soft);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  background: var(--a-color-paper-soft);
}
.kicker {
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  font-weight: bold;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--a-color-ink-soft);
}
.drawer-body { margin: 0 -2.5rem; padding: 2rem 2.5rem; }
.album-discussion { margin-top: 2rem; }

.album-meta-row {
  display: flex;
  gap: 2.25rem;
  margin-bottom: 2.25rem;
  align-items: flex-start;
}
.album-cover {
  width: 180px;
  height: 180px;
  background: var(--a-color-paper-wash);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--a-font-meta);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--a-color-muted-soft);
  overflow: hidden;
  border: 1px solid var(--a-color-line-soft);
  border-radius: 4px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06), 0 2px 6px rgba(0, 0, 0, 0.03);
}
.album-cover-img { width: 100%; height: 100%; object-fit: cover; }
.album-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-self: stretch;
  justify-content: center;
}
.album-type {
  font-family: var(--a-font-meta);
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--a-color-muted);
  margin-bottom: 0.25rem;
}
.album-title {
  font-family: var(--a-font-serif);
  font-size: 2.25rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.15;
  margin: 0 0 0.5rem;
  color: var(--a-color-ink);
}
.meta-tags {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
  font-family: var(--a-font-meta);
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--a-color-ink-soft);
}
.artist-name {
  font-weight: bold;
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
}
.artist-link {
  background: transparent;
  border: none;
  padding: 0;
  margin: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
  font-weight: 700;
  transition: color 0.15s ease;
}
.artist-link:hover {
  color: var(--a-color-fg);
  text-decoration: underline;
}
.artist-separator {
  color: var(--a-color-line-soft);
  margin: 0 0.15rem;
}
.release-year::before {
  content: "•";
  margin-right: 0.75rem;
  color: var(--a-color-line-soft);
}
.summary { color: var(--a-color-ink-soft); font-size: 0.875rem; line-height: 1.6; margin: 0; white-space: pre-wrap; }

.action-bar {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 2rem;
}
.spacer { flex: 1; }
.paper-action {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid var(--a-color-line-soft);
  border-radius: 99px;
  padding: 0.55rem 1.1rem;
  font-weight: 800;
  background: var(--a-color-paper);
  color: var(--a-color-ink);
  cursor: pointer;
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  transition: all 0.15s ease;
}
.paper-action--static {
  cursor: default;
}
.paper-action:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.paper-action:disabled:hover {
  background: var(--a-color-paper);
  color: var(--a-color-ink);
  border-color: var(--a-color-line-soft);
}
.paper-action--static:hover {
  background: var(--a-color-paper);
  color: var(--a-color-ink);
  border-color: var(--a-color-line-soft);
}
.paper-action:hover {
  background: var(--a-color-fg);
  color: var(--a-color-bg);
  border-color: var(--a-color-fg);
}
.paper-action--primary {
  background: var(--a-color-fg);
  color: var(--a-color-bg);
  border-color: var(--a-color-fg);
}
.paper-action--primary:hover {
  background: var(--a-color-ink-muted);
  border-color: var(--a-color-ink-muted);
}
.paper-action-dot {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.6;
}

.content-section {
  background: var(--a-color-paper-soft);
  border: 1px solid var(--a-color-line-soft);
  padding: 1.5rem 2rem;
  margin-bottom: 2rem;
}
.section-title {
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  border-bottom: 1px solid var(--a-color-line-soft);
  padding-bottom: 0.5rem;
  margin-bottom: 1.25rem;
  color: var(--a-color-ink-soft);
  font-weight: 800;
}
.track {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.65rem 0;
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-ink) 8%, transparent);
  font-size: 0.9rem;
}
.track:last-child { border-bottom: none; }
.track-main {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  min-width: 0;
}
.track-play-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
  color: var(--a-color-ink);
  flex-shrink: 0;
}
.track-play-btn:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}
.track-play-icon {
  display: none;
}
.track-num {
  font-family: var(--a-font-meta);
  font-size: 0.8rem;
  color: var(--a-color-muted-soft);
}
.track:hover .track-play-btn:not(:disabled) .track-play-icon {
  display: block;
}
.track:hover .track-play-btn:not(:disabled) .track-num {
  display: none;
}
.track-title {
  color: var(--a-color-ink);
  font-size: 0.9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.track-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}
.track-unavailable {
  font-family: var(--a-font-meta);
  font-size: 0.68rem;
  letter-spacing: 0.05em;
  color: var(--a-color-muted);
  text-transform: uppercase;
}
.track-empty { color: var(--a-color-ink-soft); font-family: var(--a-font-meta); font-size: 0.875rem; }
.track-time { font-family: var(--a-font-meta); color: var(--a-color-ink-soft); font-size: 0.8rem; }
.state-line { margin: 0 0 1.5rem; color: var(--a-color-ink-soft); font-family: var(--a-font-meta); font-weight: 800; }
.state-line--error { color: var(--a-color-accent-destructive); }

/* Track Playlist Dropdown styles */
.track-add-dropdown {
  position: relative;
  display: inline-flex;
}
.track-fav-btn {
  background: transparent;
  border: 0;
  color: var(--a-color-ink-soft);
  opacity: 0;
  cursor: pointer;
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s ease, color 0.15s ease, background-color 0.15s ease;
}
.track-fav-btn.is-active {
  opacity: 1 !important;
  color: #e05e5e !important;
}
.track-add-btn {
  background: transparent;
  border: 0;
  color: var(--a-color-ink-soft);
  opacity: 0;
  cursor: pointer;
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s ease, background-color 0.15s ease;
}
.track:hover .track-add-btn,
.track:hover .track-fav-btn {
  opacity: 0.7;
}
.track-add-btn:hover,
.track-fav-btn:hover {
  opacity: 1 !important;
  background-color: var(--a-color-paper-wash);
}
.track-add-menu {
  background: var(--a-color-paper);
  border: 1px solid var(--a-color-line-soft);
  box-shadow: var(--a-shadow-dropdown);
  padding: 0.4rem 0;
  min-width: 130px;
  max-width: 200px;
  display: flex;
  flex-direction: column;
}
.track-add-menu-header {
  font-family: var(--a-font-meta);
  font-size: 0.68rem;
  font-weight: 900;
  text-transform: uppercase;
  color: var(--a-color-ink-soft);
  padding: 0.3rem 0.8rem;
  border-bottom: 1px solid var(--a-color-line-soft);
  margin-bottom: 0.25rem;
}
.track-add-menu-empty {
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  color: var(--a-color-muted-soft);
  padding: 0.4rem 0.8rem;
}
.track-add-menu-item {
  background: transparent;
  border: 0;
  text-align: left;
  font-size: 0.82rem;
  padding: 0.4rem 0.8rem;
  color: var(--a-color-fg);
  cursor: pointer;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: background-color 0.15s ease;
}
.track-add-menu-item:hover {
  background-color: var(--a-color-paper-wash);
}
</style>
