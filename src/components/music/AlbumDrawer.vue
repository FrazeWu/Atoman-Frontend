<!-- web/src/components/music/AlbumDrawer.vue -->
<script setup lang="ts">
import { reportError } from '@/utils/logger'
import { computed, ref, watch } from 'vue'
import { ApiErrorResponseError } from '@/api/client'
import { modulePathUrl } from '@/router/siteUrls'
import PSheet from '@/components/ui/PSheet.vue'
import PButton from '@/components/ui/PButton.vue'
import PDiscussionFAB from '@/components/ui/PDiscussionFAB.vue'
import PDropdown from '@/components/ui/PDropdown.vue'
import PToast from '@/components/ui/PToast.vue'
import { Plus, Play, Heart, UserRound } from 'lucide-vue-next'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { useLoginRedirect } from '@/composables/useLoginRedirect'
import { useRequestGeneration } from '@/composables/useRequestGeneration'
import { useMusicFavoritePlaylist } from '@/composables/useMusicFavoritePlaylist'
import {
  createAlbumBookmark,
  deleteAlbumBookmark,
  getMusicAlbum,
  listAlbumBookmarks,
  listMusicPlaylists,
  type MusicAlbumListItem,
  type MusicPlaylistSummary,
} from '@/api/musicV1'
import { usePlayerStore } from '@/stores/player'
import { buildPlayableSongsFromAlbum, resolveAlbumCoverUrl } from '@/utils/musicMedia'
import { resolveMusicRedirect } from '@/utils/musicRedirect'
import type { MusicSheetLayer } from './musicSheetTypes'

type AlbumLayer = Extract<MusicSheetLayer, { kind: 'album' }>
const props = withDefaults(defineProps<{ layer?: AlbumLayer; layerIndex?: number; stackSize?: number }>(), { layerIndex: 0, stackSize: 1 })
const { state, closeAlbum, isAlbumShifted, isLayerShifted, isTopLayer, openAlbum, openNestedAction, openArtist, openMusicEditor } = useMusicDrawers()
const { isAuthenticated, requireLogin } = useLoginRedirect()
const player = usePlayerStore()
const albumId = computed(() => props.layer?.payload.albumId ?? state.value.albumId)
const isOpen = computed(() => props.layer !== undefined || albumId.value !== null)
const sheetIndex = computed(() => props.layer ? props.layerIndex : state.value.artistId !== null ? 1 : 0)
const shifted = computed(() => props.layer ? isLayerShifted(props.layer.key) : isAlbumShifted.value)
const topLayer = computed(() => props.layer ? isTopLayer(props.layer.key) : true)
const closeCurrentAlbum = () => closeAlbum(props.layer?.key)
const album = ref<MusicAlbumListItem | null>(null)
const loading = ref(false)
const errorMessage = ref('')
const redirectMessage = ref('')
const isCoverBroken = ref(false)
const isBookmarked = ref(false)
const bookmarkLoading = ref(false)
const albumRequests = useRequestGeneration()

const playlists = ref<MusicPlaylistSummary[]>([])
const playlistsLoaded = ref(false)
const toastVisible = ref(false)
const toastMessage = ref('')
const {
  favoriteSongIds,
  loadFavoriteSongs,
  toggleFavoriteSong,
  addSongToPlaylist,
} = useMusicFavoritePlaylist()

const artistNames = computed(() => {
  if (resolvedAlbumArtists.value.length > 0) {
    return resolvedAlbumArtists.value.map((a) => a.name).join(' / ')
  }
  return 'Unknown Artist'
})

const resolvedAlbumArtists = computed(() => {
  if (!album.value) return []
  const list: Array<{ id: string; name: string; avatarUrl?: string }> = []
  const seenIds = new Set<string>()
  const seenNames = new Set<string>()

  // 1. 探查 album.artists
  if (Array.isArray(album.value.artists)) {
    for (const a of album.value.artists) {
      const raw = a as Record<string, unknown>
      const id = String(raw.id || raw.artistId || raw.artist_id || '')
      const name = String(raw.name || '').trim()
      if (name) {
        const lowerName = name.toLowerCase()
        if (id && !seenIds.has(id)) {
          seenIds.add(id)
          seenNames.add(lowerName)
          list.push({ id, name, avatarUrl: String(raw.avatar_url || raw.avatarUrl || raw.image_url || '') })
        } else if (!id && !seenNames.has(lowerName)) {
          seenNames.add(lowerName)
          list.push({ id: '', name })
        }
      }
    }
  }

  // 2. 探查 album.contributors
  const rawAlbum = album.value as Record<string, unknown>
  if (Array.isArray(rawAlbum.contributors)) {
    for (const c of rawAlbum.contributors) {
      const raw = c as Record<string, unknown>
      const id = String(raw.artistId || raw.artist_id || raw.id || '')
      const name = String(raw.name || '').trim()
      const lowerName = name.toLowerCase()
      if (name && !seenNames.has(lowerName)) {
        seenNames.add(lowerName)
        if (id) seenIds.add(id)
        list.push({ id, name, avatarUrl: String(raw.avatarUrl || raw.avatar_url || '') })
      }
    }
  }

  // 3. 如果依然为空，探查单字符串 artist / artist_name
  if (list.length === 0) {
    const singleArtistName = String(rawAlbum.artist || rawAlbum.artist_name || '').trim()
    if (singleArtistName && singleArtistName !== 'Unknown Artist') {
      const singleArtistId = String(rawAlbum.artist_id || rawAlbum.artistId || '')
      list.push({ id: singleArtistId, name: singleArtistName })
    }
  }

  return list
})

function navigateToArtist(artist: { id: string; name: string }) {
  const target = artist.id || artist.name
  if (target) {
    openArtist(target)
  }
}
const releaseYear = computed(() => {
  const year = album.value?.release_date?.slice(0, 4)
  if (!year || year === '0001' || year === '0000' || year === '----') return ''
  return year
})
const tracks = computed(() => [...(album.value?.songs || [])].sort((a, b) => (a.track_number || 0) - (b.track_number || 0)))
const coverUrl = computed(() => album.value ? resolveAlbumCoverUrl(album.value) : '')
const playableSongs = computed(() => album.value ? buildPlayableSongsFromAlbum(album.value) : [])
const playableSongIdSet = computed(() => new Set(playableSongs.value.map((song) => String(song.id))))
const discussionCount = computed(() => {
  const currentAlbum = album.value as (MusicAlbumListItem & {
    discussion_count?: number
    open_discussion_count?: number
  }) | null

  if (!currentAlbum) return undefined
  return currentAlbum.discussion_count ?? currentAlbum.open_discussion_count
})
const editionLabels: Record<string, string> = {
  original: '原版',
  deluxe: '豪华版',
  reissue: '重发版',
  regional: '地区版',
  live: '现场版',
}

type AlbumTrack = NonNullable<MusicAlbumListItem['songs']>[number]

function formatDuration(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    const minutes = Math.floor(value / 60)
    const seconds = Math.floor(value % 60)
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  }

  if (typeof value === 'string' && value.trim()) return value
  return ''
}

function getTrackDurationLabel(track: AlbumTrack | Record<string, unknown>): string {
  return formatDuration((track as { duration_sec?: unknown }).duration_sec ?? (track as { duration?: unknown }).duration)
}

function playAlbum() {
  if (!playableSongs.value.length) return
  player.playAlbum(playableSongs.value)
}

function canPlayTrack(track: AlbumTrack) {
  return playableSongIdSet.value.has(String(track.id))
}

function playTrack(track: AlbumTrack) {
  if (!canPlayTrack(track)) return
  const startIndex = playableSongs.value.findIndex((song) => String(song.id) === String(track.id))
  if (startIndex < 0) return
  player.playAlbum(playableSongs.value, startIndex)
}

function handleCoverError() {
  isCoverBroken.value = true
}

async function loadPlaylists() {
  if (!isAuthenticated.value) {
    playlists.value = []
    playlistsLoaded.value = false
    return
  }
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
    reportError(err, 'Failed to load playlists in AlbumDrawer:')
  }
}

async function loadFavorites() {
  if (!isAuthenticated.value) {
    favoriteSongIds.value = new Set()
    return
  }
  try {
    await loadFavoriteSongs()
  } catch (err) {
    if (err instanceof ApiErrorResponseError && err.status === 401) {
      favoriteSongIds.value = new Set()
      return
    }
    reportError(err, 'Failed to load favorites in AlbumDrawer:')
  }
}

async function toggleTrackFavorite(songId: string) {
  if (!requireLogin()) return
  try {
    const result = await toggleFavoriteSong(songId)
    toastMessage.value = result.message
    toastVisible.value = true
    await loadPlaylists()
  } catch (err) {
    reportError(err, 'Failed to toggle favorite:')
    toastMessage.value = '操作失败'
    toastVisible.value = true
  }
}

async function addTrackToPlaylist(playlistId: string, songId: string) {
  if (!requireLogin()) return
  try {
    await addSongToPlaylist(playlistId, songId)
    toastMessage.value = '已成功添加到歌单'
    toastVisible.value = true
  } catch (err) {
    reportError(err, 'Failed to add song to playlist:')
    toastMessage.value = '添加失败'
    toastVisible.value = true
  }
}

async function loadAlbum(albumId: string | null) {
  const { generation: loadGeneration, isCurrent: isCurrentLoad } = albumRequests.beginRequest()
  bookmarkLoading.value = false

  if (!albumId) {
    if (isCurrentLoad()) {
      album.value = null
      isBookmarked.value = false
    }
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const resolved = await resolveMusicRedirect(albumId, getMusicAlbum)
    if (!isCurrentLoad()) return

    const albumResponse = resolved.entity
    if (resolved.redirected) {
      redirectMessage.value = '已转到合并后的条目'
      openAlbum(albumResponse.id)
      return
    }
    redirectMessage.value = ''
    album.value = albumResponse
    if (isAuthenticated.value) {
      try {
        const bookmarksResponse = await listAlbumBookmarks()
        if (!isCurrentLoad()) return
        isBookmarked.value = bookmarksResponse.data.some((bookmark) => String(bookmark.album_id) === String(albumId))
      } catch (error) {
        if (!isCurrentLoad()) return
        if (error instanceof ApiErrorResponseError && error.status === 401) {
          isBookmarked.value = false
        } else {
          throw error
        }
      }

      await Promise.all([
        playlistsLoaded.value ? Promise.resolve() : loadPlaylists(),
        loadFavorites(),
      ])
    } else {
      isBookmarked.value = false
      playlists.value = []
      playlistsLoaded.value = false
      favoriteSongIds.value = new Set()
    }
    isCoverBroken.value = false
  } catch (error) {
    if (!isCurrentLoad()) return
    reportError(error, 'Failed to fetch album:')
    errorMessage.value = '专辑信息加载失败'
  } finally {
    if (isCurrentLoad()) loading.value = false
  }
}

async function toggleAlbumBookmark() {
  const targetAlbum = album.value
  if (!targetAlbum || bookmarkLoading.value) return
  if (!requireLogin()) return

  const albumId = String(targetAlbum.id)
  const loadGeneration = albumRequests.currentGeneration()
  const wasBookmarked = isBookmarked.value
  const isCurrentTarget = () => (
    albumRequests.isCurrent(loadGeneration) && String(album.value?.id) === albumId
  )

  bookmarkLoading.value = true
  try {
    if (wasBookmarked) {
      await deleteAlbumBookmark(albumId)
      if (!isCurrentTarget()) return
      isBookmarked.value = false
      return
    }

    await createAlbumBookmark(albumId)
    if (!isCurrentTarget()) return
    isBookmarked.value = true
  } catch (error) {
    if (!isCurrentTarget()) return
    reportError(error, 'Failed to toggle album bookmark:')
    toastMessage.value = wasBookmarked ? '取消订阅失败' : '订阅失败'
    toastVisible.value = true
  } finally {
    if (isCurrentTarget()) bookmarkLoading.value = false
  }
}

function editAlbum() {
  const currentAlbumId = album.value?.id
  if (!currentAlbumId || !requireLogin()) return
  openMusicEditor({ entity: 'album', mode: 'edit', id: currentAlbumId })
}

function mergeAlbum() {
  if (!requireLogin()) return
  openNestedAction('merge_album', { albumId: albumId.value, title: album.value?.title || '' })
}

function guardPlaylistMenu(event: MouseEvent) {
  if (!requireLogin()) event.stopPropagation()
}

watch(albumId, loadAlbum, { immediate: true })
watch(
  () => state.value.albumRefreshToken,
  () => {
    if (albumId.value) void loadAlbum(albumId.value)
  },
)
</script>

<template>
  <PSheet
    :show="isOpen"
    @close="closeCurrentAlbum"
    width="700px"
    :is-shifted="shifted"
    :is-top-layer="topLayer"
    :layer-index="layerIndex"
    :stack-size="stackSize"
    :index="sheetIndex"
    panel-class="album-drawer"
  >
    <div class="drawer-body">
	  <p v-if="redirectMessage" class="state-line">{{ redirectMessage }}</p>
	  <p v-if="album?.entry_status === 'closed' && !album?.redirect_to" class="state-line">该条目已关闭</p>
      <p v-if="errorMessage" class="state-line state-line--error">{{ errorMessage }}</p>
      <p v-else-if="loading" class="state-line">正在加载专辑...</p>

      <div v-else class="album-meta-row">
        <div class="album-cover">
          <img v-if="coverUrl && !isCoverBroken" :src="coverUrl" alt="" class="album-cover-img" @error="handleCoverError" />
          <span v-else>COVER</span>
        </div>
        <div class="album-info">
          <div class="album-type">{{ album?.album_type || '专辑' }}</div>
          <h2 class="album-title">{{ album?.title || `Album ${albumId}` }}</h2>
          <div class="meta-tags">
            <span class="artist-name">
              <template v-for="(artist, index) in resolvedAlbumArtists" :key="artist.id || artist.name">
                <span v-if="index > 0" class="artist-separator"> / </span>
                <button
                  class="artist-link"
                  type="button"
                  :data-testid="`album-header-artist-link-${artist.id || index}`"
                  @click="navigateToArtist(artist)"
                >
                  {{ artist.name }}
                </button>
              </template>
              <template v-if="!resolvedAlbumArtists.length">Unknown Artist</template>
            </span>
            <span v-if="releaseYear" class="release-year">{{ releaseYear }}</span>
          </div>
          <p class="summary">{{ album?.description || '暂无专辑简介。' }}</p>
        </div>
      </div>

      <section v-if="album?.other_versions?.length" class="content-section album-versions">
        <div class="section-title">其他版本</div>
        <button v-for="version in album.other_versions" :key="version.id" type="button" class="album-version" @click="openAlbum(version.id)">
          <span>{{ version.title }}</span>
          <small>{{ editionLabels[version.edition_type || 'original'] || version.edition_type }}</small>
        </button>
      </section>

      <div class="action-bar">
        <PButton
          variant="primary"
          :disabled="!playableSongs.length"
          @click="playAlbum"
        >
          播放全专
        </PButton>
        <PButton
          variant="secondary"
          :disabled="bookmarkLoading"
          data-testid="album-bookmark-toggle"
          @click="toggleAlbumBookmark"
        >
          {{ isBookmarked ? '已订阅' : '订阅' }}
        </PButton>
        <div class="spacer"></div>
        <PButton
          variant="warning"
          data-testid="album-edit-action"
          @click="editAlbum"
        >
          编辑
        </PButton>
        <PButton
          variant="secondary"
          @click="openNestedAction('history', { albumId })"
        >
          版本
        </PButton>
        <PButton
          variant="secondary"
          data-testid="album-merge-action"
          @click="mergeAlbum"
        >
          合并重复条目
        </PButton>
      </div>

      <div class="content-section">
        <div class="section-title">Tracklist</div>
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
                <button class="track-add-btn" type="button" title="添加到歌单" @click="guardPlaylistMenu">
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

      <!-- 底部参与艺术家区块 (可点击跳转) -->
      <section v-if="resolvedAlbumArtists.length" class="content-section album-artists-section">
        <div class="section-title">参与艺术家</div>
        <div class="artist-cards-grid">
          <button
            v-for="artist in resolvedAlbumArtists"
            :key="artist.id || artist.name"
            type="button"
            class="album-artist-card"
            :data-testid="`album-artist-link-${artist.id || artist.name}`"
            @click="navigateToArtist(artist)"
          >
            <div class="artist-card-avatar">
              <img v-if="artist.avatarUrl" :src="artist.avatarUrl" alt="" class="avatar-card-img" />
              <UserRound v-else :size="18" />
            </div>
            <div class="artist-card-info">
              <span class="artist-card-name">{{ artist.name }}</span>
              <span class="artist-card-role">主要创作者</span>
            </div>
          </button>
        </div>
      </section>
    </div>
    <PDiscussionFAB v-if="isOpen" @click="openNestedAction('discussion', { albumId })" :count="discussionCount" />
    <PToast v-model="toastVisible" :message="toastMessage" :type="toastMessage.endsWith('失败') ? 'error' : 'success'" />
  </PSheet>
</template>

<style scoped>
:global(.album-drawer) {
  background: var(--a-color-bg) !important;
  border-left: 1px solid var(--a-color-border-soft) !important;
  box-shadow: none !important;
}

.drawer-body { margin: 0 -2.5rem; padding: 2rem 2.5rem; }

.album-meta-row {
  display: flex;
  gap: 2.25rem;
  margin-bottom: 2.25rem;
  align-items: flex-start;
}
.album-versions { display: grid; gap: 0.5rem; }
.album-version { display: flex; align-items: center; justify-content: space-between; min-height: 2.75rem; padding: 0.5rem 0; border: 0; border-bottom: 1px solid var(--a-color-border-soft); background: transparent; color: inherit; text-align: left; cursor: pointer; }
.album-version small { color: var(--a-color-muted); }
.album-cover {
  width: 180px;
  height: 180px;
  background: var(--a-color-surface-muted);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--a-font-sans);
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--a-color-muted-soft);
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
  box-shadow: none;
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
  font-family: var(--a-font-sans);
  font-size: 0.68rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0;
  color: var(--a-color-muted);
  margin-bottom: 0.25rem;
}
.album-title {
  font-family: var(--a-font-sans);
  font-size: 2.25rem;
  font-weight: 500;
  letter-spacing: 0;
  line-height: 1.15;
  margin: 0 0 0.5rem;
  color: var(--a-color-text);
}
.meta-tags {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
  font-family: var(--a-font-sans);
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--a-color-muted);
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
  font-weight: 500;
  transition: color 0.15s ease;
}
.artist-link:hover {
  color: var(--a-color-fg);
  text-decoration: underline;
}
.artist-separator {
  color: var(--a-color-border-soft);
  margin: 0 0.15rem;
}

.album-artists-section {
  margin-top: 2.25rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--a-color-border-soft);
}

.artist-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.album-artist-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.85rem;
  background: var(--a-color-surface-muted);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.album-artist-card:hover {
  border-color: var(--a-color-primary);
  background: color-mix(in srgb, var(--a-color-primary) 6%, var(--a-color-bg));
  transform: translateY(-1px);
}

.artist-card-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 999px;
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  color: var(--a-color-muted);
  flex-shrink: 0;
  overflow: hidden;
}

.avatar-card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 999px;
}

.artist-card-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  overflow: hidden;
}

.artist-card-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--a-color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.artist-card-role {
  font-size: 0.75rem;
  color: var(--a-color-muted);
}
.release-year::before {
  content: "•";
  margin-right: 0.75rem;
  color: var(--a-color-border-soft);
}
.summary { color: var(--a-color-muted); font-size: 0.875rem; line-height: 1.6; margin: 0; white-space: pre-wrap; }

.action-bar {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 2rem;
}
.spacer { flex: 1; }
.ui-action {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
  padding: 0.55rem 1.1rem;
  font-weight: 500;
  background: var(--a-color-bg);
  color: var(--a-color-text);
  cursor: pointer;
  font-family: var(--a-font-sans);
  font-size: 0.72rem;
  letter-spacing: 0;
  text-transform: uppercase;
  transition: all 0.15s ease;
}
.ui-action--static {
  cursor: default;
}
.ui-action:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.ui-action:disabled:hover {
  background: var(--a-color-bg);
  color: var(--a-color-text);
  border-color: var(--a-color-border-soft);
}
.ui-action--static:hover {
  background: var(--a-color-bg);
  color: var(--a-color-text);
  border-color: var(--a-color-border-soft);
}
.ui-action:hover {
  background: var(--a-color-fg);
  color: var(--a-color-bg);
  border-color: var(--a-color-fg);
}
.ui-action--primary {
  background: var(--a-color-fg);
  color: var(--a-color-bg);
  border-color: var(--a-color-fg);
}
.ui-action--primary:hover {
  background: var(--a-color-text-secondary);
  border-color: var(--a-color-text-secondary);
}
.action-indicator {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 4px;
  background: currentColor;
  opacity: 0.6;
}

.content-section {
  background: var(--a-color-surface);
  border: 1px solid var(--a-color-border-soft);
  padding: 1.5rem 2rem;
  margin-bottom: 2rem;
}
.section-title {
  font-family: var(--a-font-sans);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0;
  border-bottom: 1px solid var(--a-color-border-soft);
  padding-bottom: 0.5rem;
  margin-bottom: 1.25rem;
  color: var(--a-color-muted);
  font-weight: 500;
}
.track {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.85rem;
  padding: 0.65rem 0.5rem;
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-text) 8%, transparent);
  font-size: 0.9rem;
  transition: background-color 0.15s ease;
}
.track:last-child { border-bottom: none; }
.track:hover {
  background-color: var(--a-color-surface-muted);
}
.track-main {
  display: contents;
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
  color: var(--a-color-text);
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
  font-family: monospace;
  font-size: 11px;
  color: var(--a-color-muted);
}
.track:hover .track-play-btn:not(:disabled) .track-play-icon {
  display: block;
}
.track:hover .track-play-btn:not(:disabled) .track-num {
  display: none;
}
.track-title {
  color: var(--a-color-text);
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
  font-family: var(--a-font-sans);
  font-size: 0.68rem;
  letter-spacing: 0;
  color: var(--a-color-muted);
  text-transform: uppercase;
}
.track-empty { color: var(--a-color-muted); font-family: var(--a-font-sans); font-size: 0.875rem; }
.track-time {
  font-family: monospace;
  font-size: 11px;
  color: var(--a-color-muted);
}
.state-line { margin: 0 0 1.5rem; color: var(--a-color-muted); font-family: var(--a-font-sans); font-weight: 500; }
.state-line--error { color: var(--a-color-accent-destructive); }

/* Track Playlist Dropdown styles */
.track-add-dropdown {
  position: relative;
  display: inline-flex;
}
.track-fav-btn {
  background: transparent;
  border: 0;
  color: var(--a-color-muted);
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
  color: var(--a-color-muted);
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
  background-color: var(--a-color-surface-muted);
}
.track-add-menu {
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  box-shadow: none;
  padding: 0.4rem 0;
  min-width: 130px;
  max-width: 200px;
  display: flex;
  flex-direction: column;
}
.track-add-menu-header {
  font-family: var(--a-font-sans);
  font-size: 0.68rem;
  font-weight: 500;
  text-transform: uppercase;
  color: var(--a-color-muted);
  padding: 0.3rem 0.8rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  margin-bottom: 0.25rem;
}
.track-add-menu-empty {
  font-family: var(--a-font-sans);
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
  background-color: var(--a-color-surface-muted);
}
</style>
