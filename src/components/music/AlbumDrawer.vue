<!-- web/src/components/music/AlbumDrawer.vue -->
<script setup lang="ts">
import { reportError } from '@/utils/logger'
import { computed, ref, watch } from 'vue'
import { ApiErrorResponseError } from '@/api/client'
import { modulePathUrl } from '@/router/siteUrls'
import PSheet from '@/components/ui/PSheet.vue'
import PButton from '@/components/ui/PButton.vue'
import PSkeleton from '@/components/ui/PSkeleton.vue'
import PDiscussionFAB from '@/components/ui/PDiscussionFAB.vue'
import PDropdown from '@/components/ui/PDropdown.vue'
import PToast from '@/components/ui/PToast.vue'
import MusicContributorsBlock from '@/components/music/MusicContributorsBlock.vue'
import MusicEntryStateControl from '@/components/music/MusicEntryStateControl.vue'
import MusicSongLyricsEditorDrawer from '@/components/music/MusicSongLyricsEditorDrawer.vue'
import { ChevronDown, ChevronLeft, ChevronRight, FileText, Heart, History, Merge, MoreHorizontal, Pause, Pencil, Play, Plus, UserRound } from 'lucide-vue-next'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { useLoginRedirect } from '@/composables/useLoginRedirect'
import { useRequestGeneration } from '@/composables/useRequestGeneration'
import { useMusicFavoritePlaylist } from '@/composables/useMusicFavoritePlaylist'
import {
  createAlbumBookmark,
  deleteAlbumBookmark,
  getMusicAlbum,
  listAlbumBookmarks,
  listAlbumContributors,
  listMusicPlaylists,
  type MusicContributor,
  type MusicAlbumListItem,
  type MusicPlaylistSummary,
} from '@/api/musicV1'
import { usePlayerStore } from '@/stores/player'
import { buildPlayableSongsFromAlbum, compareAlbumTracks, formatAlbumTypeLabel, resolveAlbumCoverUrl } from '@/utils/musicMedia'
import { resolveMusicRedirect } from '@/utils/musicRedirect'
import { getMusicRecommendationAlbumContext } from '@/utils/musicRecommendationAttribution'
import type { MusicSheetLayer } from './musicSheetTypes'
import { albumArtistRoleLabels, albumContributorsFromResponse } from '@/utils/musicAlbumCredits'

type AlbumLayer = Extract<MusicSheetLayer, { kind: 'album' }>
const props = withDefaults(defineProps<{ layer?: AlbumLayer; layerIndex?: number; stackSize?: number }>(), { layerIndex: 0, stackSize: 1 })
const { state, closeAlbum, returnToLayer, isAlbumShifted, isLayerActive, isLayerShifted, isTopLayer, openAlbum, openNestedAction, openArtist, openMusicCreationFlow } = useMusicDrawers()
const { isAuthenticated, requireLogin } = useLoginRedirect()
const player = usePlayerStore()
const albumId = computed(() => props.layer?.payload.albumId ?? state.value.albumId)
const isOpen = computed(() => props.layer ? isLayerActive(props.layer.key) : albumId.value !== null)
const sheetIndex = computed(() => props.layer ? props.layerIndex : state.value.artistId !== null ? 1 : 0)
const shifted = computed(() => props.layer ? isLayerShifted(props.layer.key) : isAlbumShifted.value)
const topLayer = computed(() => props.layer ? isTopLayer(props.layer.key) : true)
const closeCurrentAlbum = () => closeAlbum(props.layer?.key)
const album = ref<MusicAlbumListItem | null>(null)
const sheetTitle = computed(() => album.value?.title ? `专辑 · ${album.value.title}` : (props.layer?.title ?? '专辑'))
const returnCurrentAlbum = () => props.layer && returnToLayer(props.layer.key)
const loading = ref(false)
const errorMessage = ref('')
const redirectMessage = ref('')
const isCoverBroken = ref(false)
const isBookmarked = ref(false)
const bookmarkLoading = ref(false)
const albumRequests = useRequestGeneration()
const contributors = ref<MusicContributor[]>([])
const contributorTotal = ref(0)

const playlists = ref<MusicPlaylistSummary[]>([])
const playlistsLoaded = ref(false)
const playlistPage = ref(1)
const playlistHasMore = ref(false)
const playlistsLoading = ref(false)
const toastVisible = ref(false)
const toastMessage = ref('')
const expandedTrackId = ref<string | null>(null)
const descriptionExpanded = ref(false)
const lyricTrack = ref<{ id: string; title: string } | null>(null)
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

const albumCreatorCredits = computed(() => {
	if (!album.value) return []
	return albumContributorsFromResponse(album.value).map((contributor) => ({
		id: contributor.artistId ?? '',
		name: contributor.name,
		avatarUrl: contributor.avatarUrl,
		roles: contributor.roles.map((role) => (
			role.role === 'custom' ? role.label : albumArtistRoleLabels[role.role]
		)).filter(Boolean).join('、'),
	}))
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
const tracks = computed(() => [...(album.value?.songs || [])].sort(compareAlbumTracks))
const coverUrl = computed(() => album.value ? resolveAlbumCoverUrl(album.value) : '')
const playableSongs = computed(() => {
  if (!album.value) return []
  const songs = buildPlayableSongsFromAlbum(album.value)
  const context = getMusicRecommendationAlbumContext(String(album.value.id))
  if (!context) return songs
  return songs.map((song) => ({ ...song, recommendation_context: context }))
})
const playableSongIdSet = computed(() => new Set(playableSongs.value.map((song) => String(song.id))))
const discussionCount = computed(() => {
  const currentAlbum = album.value as (MusicAlbumListItem & {
    discussion_count?: number
    open_discussion_count?: number
  }) | null

  if (!currentAlbum) return undefined
  return currentAlbum.discussion_count ?? currentAlbum.open_discussion_count
})
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

function formatFileSize(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return ''
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / (1024 * 1024)).toFixed(value >= 100 * 1024 * 1024 ? 0 : 1)} MB`
}

function formatSampleRate(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return ''
  return `${value >= 1000 ? value / 1000 : value} kHz`
}

function sourceSpecification(track: AlbumTrack) {
  const parts = [
    track.source_container?.toUpperCase(),
    track.source_lossless ? '无损' : '',
    track.source_bit_depth ? `${track.source_bit_depth}-bit` : '',
    formatSampleRate(track.source_sample_rate_hz),
    track.source_channels ? `${track.source_channels} ch` : '',
    track.source_bitrate_kbps ? `${track.source_bitrate_kbps} kbps` : '',
    formatFileSize(track.source_size_bytes),
  ]
  return parts.filter(Boolean).join(' · ')
}

function playbackSpecification(track: AlbumTrack) {
  const parts = [
    track.playback_container?.toUpperCase(),
    track.playback_bitrate_kbps ? `${track.playback_bitrate_kbps} kbps` : '',
    formatSampleRate(track.playback_sample_rate_hz),
    track.playback_channels ? `${track.playback_channels} ch` : '',
  ]
  return parts.filter(Boolean).join(' · ')
}

function playAlbum() {
  if (!playableSongs.value.length) return
  player.playAlbum(playableSongs.value)
}

function canPlayTrack(track: AlbumTrack) {
  return playableSongIdSet.value.has(String(track.id))
}

function isTrackPlaying(track: AlbumTrack) {
  const current = player.currentSong
  return player.isPlaying && !!current && String(current.source_id || current.id) === String(track.id)
}

function playTrack(track: AlbumTrack) {
  if (!canPlayTrack(track)) return
  if (isTrackPlaying(track)) {
    player.togglePlay()
    return
  }
  const startIndex = playableSongs.value.findIndex((song) => String(song.id) === String(track.id))
  if (startIndex < 0) return
  player.playAlbum(playableSongs.value, startIndex)
}

function toggleTrackDetails(trackId: string) {
  expandedTrackId.value = expandedTrackId.value === trackId ? null : trackId
}

function handleCoverError() {
  isCoverBroken.value = true
}

async function loadPlaylists(page = 1) {
  if (!isAuthenticated.value) {
    playlists.value = []
    playlistsLoaded.value = false
    playlistPage.value = 1
    playlistHasMore.value = false
    return
  }
  if (playlistsLoading.value) return

  playlistsLoading.value = true
  try {
    const res = await listMusicPlaylists({ page, page_size: 20 })
    playlists.value = res.data
    playlistPage.value = page
    playlistHasMore.value = res.meta?.has_more ?? false
    playlistsLoaded.value = true
  } catch (err) {
    if (err instanceof ApiErrorResponseError && err.status === 401) {
      playlists.value = []
      playlistsLoaded.value = true
      playlistHasMore.value = false
      return
    }
    reportError(err, 'Failed to load playlists in AlbumDrawer:')
    playlistsLoaded.value = true
    playlistHasMore.value = false
  } finally {
    playlistsLoading.value = false
  }
}

function changePlaylistPage(delta: number) {
  const nextPage = playlistPage.value + delta
  if (nextPage < 1 || playlistsLoading.value) return
  if (delta > 0 && !playlistHasMore.value) return
  void loadPlaylists(nextPage)
}

async function loadFavorites(songIds: string[], isCurrentLoad: () => boolean) {
  if (!isAuthenticated.value) {
    if (isCurrentLoad()) favoriteSongIds.value = new Set()
    return
  }
  try {
    await loadFavoriteSongs(songIds, isCurrentLoad)
  } catch (err) {
    if (!isCurrentLoad()) return
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
    await loadPlaylists(playlistPage.value)
  } catch (err) {
    reportError(err, 'Failed to toggle favorite:')
    toastMessage.value = '操作失败'
    toastVisible.value = true
  }
}

async function addTrackToPlaylist(playlistId: string, songId: string, close?: () => void) {
  if (!requireLogin()) return
  try {
    await addSongToPlaylist(playlistId, songId)
    close?.()
    toastMessage.value = '已成功添加到歌单'
    toastVisible.value = true
  } catch (err) {
    reportError(err, 'Failed to add song to playlist:')
    toastMessage.value = '添加失败'
    toastVisible.value = true
  }
}

async function loadAlbum(albumId: string | null) {
  const { isCurrent: isCurrentLoad } = albumRequests.beginRequest()
  bookmarkLoading.value = false
  album.value = null
  isBookmarked.value = false
  contributors.value = []
  contributorTotal.value = 0
  favoriteSongIds.value = new Set()
  lyricTrack.value = null
  expandedTrackId.value = null
  descriptionExpanded.value = false
  errorMessage.value = ''
  redirectMessage.value = ''
  isCoverBroken.value = false

  if (!albumId) {
    if (isCurrentLoad()) {
      loading.value = false
    }
    return
  }

  loading.value = true
  try {
    const resolved = await resolveMusicRedirect(albumId, (id) => getMusicAlbum(id, { force: true }))
    if (!isCurrentLoad()) return

    const albumResponse = resolved.entity
    if (resolved.redirected) {
      redirectMessage.value = '已转到合并后的条目'
      openAlbum(albumResponse.id)
      return
    }
    album.value = albumResponse
    loading.value = false
    void loadAlbumExtras(albumId, albumResponse, isCurrentLoad)
  } catch (error) {
    if (!isCurrentLoad()) return
    reportError(error, 'Failed to fetch album:')
    errorMessage.value = '专辑信息加载失败'
  } finally {
    if (isCurrentLoad()) loading.value = false
  }
}

async function loadAlbumExtras(
  targetAlbumId: string,
  albumResponse: MusicAlbumListItem,
  isCurrentLoad: () => boolean,
) {
  const contributorTask = listAlbumContributors(targetAlbumId)
    .then((response) => {
      if (!isCurrentLoad()) return
      contributors.value = response.data
      contributorTotal.value = response.total
    })
    .catch((error) => {
      if (!isCurrentLoad()) return
      contributors.value = []
      contributorTotal.value = 0
      reportError(error, 'Failed to load album contributors:')
    })

  if (!isAuthenticated.value) {
    playlists.value = []
    playlistsLoaded.value = false
    playlistPage.value = 1
    playlistHasMore.value = false
    return
  }

  const bookmarkTask = loadAlbumBookmarkState(targetAlbumId, isCurrentLoad)
  const playlistTask = playlistsLoaded.value ? Promise.resolve() : loadPlaylists()
  const favoriteTask = loadFavorites((albumResponse.songs || []).map(song => String(song.id)), isCurrentLoad)
  await Promise.all([contributorTask, bookmarkTask, playlistTask, favoriteTask])
}

async function loadAlbumBookmarkState(targetAlbumId: string, isCurrentLoad: () => boolean) {
  try {
    let page = 1
    while (true) {
      const response = await listAlbumBookmarks({ page, page_size: 100 })
      if (!isCurrentLoad()) return
      if (response.data.some((bookmark) => String(bookmark.album_id) === String(targetAlbumId))) {
        isBookmarked.value = true
        return
      }
      if (!response.meta?.has_more) {
        isBookmarked.value = false
        return
      }
      page += 1
    }
  } catch (error) {
    if (!isCurrentLoad()) return
    isBookmarked.value = false
    if (!(error instanceof ApiErrorResponseError && error.status === 401)) {
      reportError(error, 'Failed to load album bookmarks:')
    }
  }
}

function retryLoadAlbum() {
  if (albumId.value) void loadAlbum(albumId.value)
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
  openMusicCreationFlow({
    mode: 'edit',
    entity: 'album',
    albumId: currentAlbumId,
    startStep: 'albumDetails',
  })
}

function editTrackLyrics(track: { id: string; title: string }) {
  if (!requireLogin()) return
  lyricTrack.value = { id: String(track.id), title: track.title }
}

function mergeAlbum() {
  if (!requireLogin()) return
  openNestedAction('merge_album', { albumId: albumId.value, title: album.value?.title || '' })
}

function openAlbumHistory() {
  if (!albumId.value) return
  openNestedAction('history', { albumId: albumId.value })
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
    :title="sheetTitle"
    content-max-width="72rem"
    @close="closeCurrentAlbum"
    @activate="returnCurrentAlbum"
    :is-shifted="shifted"
    :is-top-layer="topLayer"
    :layer-index="layerIndex"
    :stack-size="stackSize"
    :index="sheetIndex"
    panel-class="album-drawer"
  >
    <MusicSongLyricsEditorDrawer
      v-if="lyricTrack"
      show
      :song-id="lyricTrack.id"
      :song-title="lyricTrack.title"
      :current-time-seconds="player.currentTime"
      @close="lyricTrack = null"
      @seek="player.seek"
    />
    <div class="drawer-body">
      <div v-if="loading" class="album-loading-skeleton" data-testid="album-loading-skeleton" role="status" aria-busy="true" aria-label="正在加载专辑详情">
        <div class="album-meta-row" aria-hidden="true">
          <div class="album-cover"><PSkeleton width="100%" height="100%" /></div>
          <div class="album-info">
            <PSkeleton width="4rem" height="0.75rem" />
            <PSkeleton class="album-skeleton-title" width="min(34rem, 100%)" height="2.5rem" />
            <PSkeleton width="12rem" height="0.9rem" />
            <div class="album-skeleton-summary">
              <PSkeleton width="100%" height="0.9rem" />
              <PSkeleton width="76%" height="0.9rem" />
              <PSkeleton width="52%" height="0.9rem" />
            </div>
            <div class="album-actions album-skeleton-actions">
              <PSkeleton width="5rem" height="2.5rem" />
              <PSkeleton width="5rem" height="2.5rem" />
              <PSkeleton width="2.5rem" height="2.5rem" />
            </div>
          </div>
        </div>
        <div class="content-section" aria-hidden="true">
          <div class="section-title">曲目</div>
          <div v-for="index in 5" :key="index" class="track album-skeleton-track">
            <PSkeleton class="album-skeleton-track-play" variant="circle" width="2rem" height="2rem" />
            <PSkeleton width="min(24rem, 80%)" height="1rem" />
            <div class="track-meta album-skeleton-track-meta">
              <PSkeleton variant="circle" width="1.5rem" height="1.5rem" />
              <PSkeleton variant="circle" width="1.5rem" height="1.5rem" />
              <PSkeleton variant="circle" width="1.75rem" height="1.75rem" />
            </div>
          </div>
        </div>
      </div>
	  <p v-if="!loading && redirectMessage" class="state-line">{{ redirectMessage }}</p>
	  <p v-if="!loading && album?.entry_status === 'closed' && !album?.redirect_to" class="state-line">该条目已关闭</p>
      <div v-if="!loading && errorMessage" class="state-line state-line--error">
        <span>{{ errorMessage }}</span>
        <PButton type="button" size="sm" variant="secondary" data-testid="album-retry" @click="retryLoadAlbum">重试</PButton>
      </div>
      <MusicEntryStateControl
        v-if="!loading && album"
        entity-type="album"
        :entity-id="String(album.id)"
        :lifecycle-status="album.lifecycle_status"
        :edit-status="album.edit_status"
        @submitted="loadAlbum(String(album.id))"
      />

      <div v-if="!loading && album" class="album-meta-row">
        <div class="album-cover">
          <div class="album-cover-frame">
            <img
              v-if="coverUrl && !isCoverBroken"
              :src="coverUrl"
              :alt="`${album?.title || '专辑'}封面`"
              class="album-cover-img"
              @error="handleCoverError"
            >
            <span v-else class="album-cover-empty">暂无封面</span>
          </div>
        </div>
        <div class="album-info">
          <div class="album-type">{{ formatAlbumTypeLabel(album?.album_type) }}</div>
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
            <span v-if="tracks.length" class="track-count">{{ tracks.length }} 首</span>
          </div>
          <div class="summary-section">
            <button
              type="button"
              class="summary-toggle"
              :aria-expanded="descriptionExpanded"
              aria-controls="album-description"
              data-testid="album-description-toggle"
              @click="descriptionExpanded = !descriptionExpanded"
            >
              <span>简介</span>
              <ChevronDown :size="16" aria-hidden="true" />
            </button>
            <p v-if="descriptionExpanded" id="album-description" class="summary">{{ album?.description || '暂无专辑简介。' }}</p>
          </div>
          <div class="album-actions">
            <PButton
              variant="primary"
              :disabled="!playableSongs.length"
              data-testid="album-play-action"
              @click="playAlbum"
            >
              <Play :size="16" fill="currentColor" aria-hidden="true" />
              播放
            </PButton>
            <PButton
              variant="secondary"
              :disabled="bookmarkLoading"
              data-testid="album-bookmark-toggle"
              @click="toggleAlbumBookmark"
            >
              {{ isBookmarked ? '已订阅' : '订阅' }}
            </PButton>
            <PDropdown class="album-more-dropdown" position="right">
              <template #trigger>
                <button class="album-more-trigger" type="button" aria-label="更多专辑操作" title="更多操作">
                  <MoreHorizontal :size="19" aria-hidden="true" />
                </button>
              </template>
              <template #default="{ close }">
                <div class="album-more-menu">
                  <button type="button" data-testid="album-edit-action" :disabled="album?.edit_status && album.edit_status !== 'development'" @click="close(); editAlbum()">
                    <Pencil :size="16" aria-hidden="true" />
                    编辑专辑
                  </button>
                  <button type="button" @click="close(); openNestedAction('history', { albumId })">
                    <History :size="16" aria-hidden="true" />
                    查看版本
                  </button>
                  <button type="button" data-testid="album-merge-action" @click="close(); mergeAlbum()">
                    <Merge :size="16" aria-hidden="true" />
                    合并重复条目
                  </button>
                </div>
              </template>
            </PDropdown>
          </div>
        </div>
      </div>

      <div v-if="!loading" class="content-section">
        <div class="section-title">曲目</div>
        <div v-if="!tracks.length" class="track-empty">暂无曲目。</div>
        <div v-for="(track, index) in tracks" :key="track.id" class="track">
          <button
            class="track-play-btn"
            type="button"
            :disabled="!canPlayTrack(track)"
            :data-testid="`track-play-${track.id}`"
            @click="playTrack(track)"
            :aria-label="`${isTrackPlaying(track) ? '暂停' : '播放'} ${track.title}`"
          >
            <span class="track-num">{{ index + 1 }}</span>
            <Pause v-if="isTrackPlaying(track)" class="track-play-icon" :size="14" fill="currentColor" />
            <Play v-else class="track-play-icon" :size="14" fill="currentColor" />
          </button>
          <RouterLink class="track-title" :to="`/music/song/${track.id}`" :title="track.title">{{ track.title }}</RouterLink>
          <div class="track-meta">
            <span v-if="!canPlayTrack(track)" class="track-unavailable">无音频</span>
            <div v-if="getTrackDurationLabel(track)" class="track-time">{{ getTrackDurationLabel(track) }}</div>

            <button
              type="button"
              class="track-fav-btn"
              :class="{ 'is-active': favoriteSongIds.has(String(track.id)) }"
			  :title="favoriteSongIds.has(String(track.id)) ? '移出最爱' : '加入最爱'"
			  :aria-label="`${favoriteSongIds.has(String(track.id)) ? '移出最爱' : '加入最爱'} ${track.title}`"
              @click="toggleTrackFavorite(String(track.id))"
            >
              <Heart :size="12" :fill="favoriteSongIds.has(String(track.id)) ? 'currentColor' : 'none'" />
            </button>

            <PDropdown class="track-add-dropdown" position="right">
              <template #trigger>
                <button
                  class="track-add-btn"
                  type="button"
                  title="添加到歌单"
                  :aria-label="`将 ${track.title} 添加到歌单`"
                  @click="guardPlaylistMenu"
                >
                  <Plus :size="12" />
                </button>
              </template>
              <template #default="{ close }">
                <div class="track-add-menu">
                  <div class="track-add-menu-header">添加到歌单</div>
                  <div v-if="playlistsLoading && !playlists.length" class="track-add-menu-empty">正在加载歌单...</div>
                  <div v-else-if="!playlists.length" class="track-add-menu-empty">暂无歌单</div>
                  <button
                    v-for="p in playlists"
                    :key="p.id"
                    type="button"
                    class="track-add-menu-item"
                    @click="addTrackToPlaylist(String(p.id), track.id, close)"
                  >
                    {{ p.name }}
                  </button>
                  <div v-if="playlists.length || playlistsLoading" class="track-add-menu-pagination">
                    <button
                      type="button"
                      class="track-add-menu-page-btn"
                      :disabled="playlistsLoading || playlistPage <= 1"
                      aria-label="上一页歌单"
                      @click.stop="changePlaylistPage(-1)"
                    >
                      <ChevronLeft :size="14" aria-hidden="true" />
                    </button>
                    <span>第 {{ playlistPage }} 页</span>
                    <button
                      type="button"
                      class="track-add-menu-page-btn"
                      :disabled="playlistsLoading || !playlistHasMore"
                      aria-label="下一页歌单"
                      @click.stop="changePlaylistPage(1)"
                    >
                      <ChevronRight :size="14" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </template>
            </PDropdown>
            <button
              type="button"
              class="track-detail-btn"
              :class="{ 'is-expanded': expandedTrackId === String(track.id) }"
              :aria-expanded="expandedTrackId === String(track.id)"
              :aria-label="`${expandedTrackId === String(track.id) ? '收起' : '展开'} ${track.title} 的更多信息`"
              :data-testid="`track-details-${track.id}`"
              @click="toggleTrackDetails(String(track.id))"
            >
              <ChevronDown :size="16" aria-hidden="true" />
            </button>
          </div>
          <div v-if="expandedTrackId === String(track.id)" class="track-specification">
            <p v-if="sourceSpecification(track)" class="track-specification__line">
              <span>音频源</span>{{ sourceSpecification(track) }}
            </p>
            <p v-if="playbackSpecification(track)" class="track-specification__line">
              <span>播放版本</span>{{ playbackSpecification(track) }}
            </p>
            <div class="track-lyrics-row">
              <span>歌词</span>
              <span class="track-lyrics-status">{{ track.lyrics?.trim() ? '已上传' : '暂无歌词' }}</span>
              <PButton
                type="button"
                size="sm"
                variant="secondary"
                class="track-lyrics-action"
                :data-testid="`track-edit-lyrics-${track.id}`"
                @click="editTrackLyrics(track)"
              >
                <FileText :size="15" aria-hidden="true" />
                {{ track.lyrics?.trim() ? '编辑歌词' : '上传歌词' }}
              </PButton>
            </div>
          </div>
        </div>
      </div>

	  <section v-if="!loading && albumCreatorCredits.length" class="content-section album-artists-section">
		<div class="section-title">创作者</div>
        <div class="artist-cards-grid">
          <button
			v-for="artist in albumCreatorCredits"
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
			  <span class="artist-card-role">{{ artist.roles }}</span>
            </div>
          </button>
        </div>
      </section>
      <MusicContributorsBlock
        v-if="!loading"
        :contributors="contributors"
        :total="contributorTotal"
        @open-history="openAlbumHistory"
      />
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

.drawer-body { padding: 2rem 0 3rem; }

.album-meta-row {
  display: flex;
  gap: 2.5rem;
  margin-bottom: 3rem;
  align-items: flex-start;
}
.album-cover {
  width: 220px;
  height: 220px;
  flex-shrink: 0;
}

.album-cover-frame {
  position: relative;
  width: 100%;
  height: 100%;
  background: var(--a-color-surface-muted);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  overflow: hidden;
  z-index: 2;
  box-shadow: var(--a-shadow-md);
  display: flex;
  align-items: center;
  justify-content: center;
}

.album-cover-empty {
  font-family: var(--a-font-sans);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--a-color-muted-soft);
}

.album-cover-img { width: 100%; height: 100%; object-fit: cover; }
.album-loading-skeleton { pointer-events: none; }
.album-skeleton-title { margin-top: 0.25rem; }
.album-skeleton-summary {
  display: grid;
  gap: 0.35rem;
  margin-top: 1rem;
}
.album-skeleton-actions { margin-top: 1.5rem; }
.album-skeleton-track { cursor: default; }
.album-skeleton-track:hover {
  background: transparent;
  border-left-color: transparent;
  box-shadow: none;
}
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
  margin-bottom: 1rem;
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

.track-lyrics-action {
  width: max-content;
  justify-self: start;
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
  border-radius: var(--a-radius-pill);
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
  border-radius: var(--a-radius-pill);
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
.release-year::before,
.track-count::before {
  content: "•";
  margin-right: 0.75rem;
  color: var(--a-color-border-soft);
}
.summary-section {
  display: grid;
  gap: 0.55rem;
  max-width: 44rem;
}
.summary-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--a-color-muted);
  font: inherit;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}
.summary-toggle:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--a-color-primary) 24%, transparent);
  outline-offset: 3px;
}
.summary-toggle svg { transition: transform 0.18s ease; }
.summary-toggle[aria-expanded="true"] svg { transform: rotate(180deg); }
.summary {
  max-width: 44rem;
  overflow: hidden;
  color: var(--a-color-muted);
  font-size: 0.875rem;
  line-height: 1.6;
  margin: 0;
  white-space: pre-wrap;
}

.album-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.5rem;
}
.album-more-trigger {
  display: inline-grid;
  width: 2.5rem;
  height: 2.5rem;
  place-items: center;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
  background: transparent;
  color: var(--a-color-text);
  cursor: pointer;
}
.album-more-trigger:hover,
.album-more-trigger:focus-visible {
  background: var(--a-color-surface-muted);
}
.album-more-menu {
  display: grid;
  min-width: 12rem;
  padding: 0.35rem;
  border: 1px solid var(--a-color-border-soft);
  background: #ffffff;
}
.album-more-menu button {
  display: flex;
  align-items: center;
  min-height: 2.5rem;
  gap: 0.65rem;
  padding: 0.55rem 0.7rem;
  border: 0;
  background: transparent;
  color: var(--a-color-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.album-more-menu button:hover,
.album-more-menu button:focus-visible {
  background: var(--a-color-surface-muted);
}

.content-section {
  padding: 0;
  margin-bottom: 3rem;
}

@media (max-width: 767px) {
  .drawer-body {
    margin: 0;
    padding: 1rem 0;
  }

  .album-meta-row {
    flex-direction: column;
    gap: 1.25rem;
    margin-bottom: 2rem;
  }

  .album-cover {
    width: min(72vw, 17.5rem);
    height: auto;
    aspect-ratio: 1;
    align-self: center;
  }

  .album-info {
    min-width: 0;
  }

  .album-title {
    font-size: 1.85rem;
    overflow-wrap: anywhere;
  }

  .meta-tags {
    row-gap: 0.35rem;
    flex-wrap: wrap;
  }

  .album-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 2.75rem;
  }

  .album-actions :deep(.p-button) {
    width: 100%;
    min-height: 2.75rem;
  }

  .album-more-trigger {
    width: 2.75rem;
    height: 2.75rem;
  }

  .content-section {
    margin-bottom: 2.25rem;
  }
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
  grid-template-columns: 2rem minmax(0, 1fr) auto;
  grid-template-rows: auto;
  align-items: center;
  gap: 0.65rem;
  padding: 0.4rem 0.5rem;
  border-left: 4px solid transparent;
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-text) 8%, transparent);
  font-size: 0.9rem;
  transition: background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}
.track:last-child { border-bottom: none; }
.track:hover,
.track:focus-within {
  background-color: var(--a-color-surface-muted);
  border-left-color: var(--a-color-text);
  box-shadow: inset 0 0 0 1px var(--a-color-border-soft);
}
.track-play-btn {
  width: 2rem;
  height: 2rem;
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
  display: flex;
  align-self: stretch;
  align-items: center;
  min-height: 2rem;
  color: var(--a-color-text);
  font-size: 1rem;
  line-height: 1.35;
  min-width: 0;
  overflow: hidden;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
  word-break: break-word;
}
.track-title:hover { text-decoration: underline; }
.track-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}
.track-detail-btn {
  display: inline-grid;
  width: 1.75rem;
  height: 1.75rem;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
}
.track-detail-btn svg {
  transition: transform 0.15s ease;
}
.track-detail-btn.is-expanded svg {
  transform: rotate(180deg);
}
.track-detail-btn:hover,
.track-detail-btn:focus-visible {
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
}
.track-specification {
  align-self: start;
  grid-column: 2 / -1;
  display: grid;
  gap: 0.2rem;
  min-width: 0;
  padding: 0.1rem 0 0.15rem;
  color: var(--a-color-muted);
  font-size: 0.75rem;
  line-height: 1.45;
}
.track-specification__line {
  margin: 0;
  overflow-wrap: anywhere;
}
.track-specification__line span {
  display: inline-block;
  min-width: 4.5rem;
  margin-right: 0.5rem;
  color: var(--a-color-text-secondary);
  font-weight: 600;
}
.track-lyrics-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2rem;
}
.track-lyrics-row > span:first-child {
  min-width: 4.5rem;
  color: var(--a-color-text-secondary);
  font-weight: 600;
}
.track-lyrics-status {
  color: var(--a-color-muted);
}
.track-lyrics-action {
  margin-left: auto;
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
.state-line--error {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

/* Track Playlist Dropdown styles */
.track-add-dropdown {
  position: relative;
  display: inline-flex;
}
.track-fav-btn {
  background: transparent;
  border: 0;
  color: var(--a-color-muted);
  opacity: 0.4;
  cursor: pointer;
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: opacity 0.15s ease, color 0.15s ease, background-color 0.15s ease;
}
.track-fav-btn:focus-visible,
.track-add-btn:focus-visible,
.track-add-menu-page-btn:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 2px;
}
.track-fav-btn.is-active {
  opacity: 1 !important;
  color: #e05e5e !important;
}
.track-add-btn {
  background: transparent;
  border: 0;
  color: var(--a-color-muted);
  opacity: 0.4;
  cursor: pointer;
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: opacity 0.15s ease, background-color 0.15s ease;
}
.track:hover .track-add-btn,
.track:hover .track-fav-btn {
  opacity: 0.8;
}
.track-add-btn:hover,
.track-fav-btn:hover {
  opacity: 1 !important;
  background-color: var(--a-color-surface-muted);
}

@media (max-width: 767px) {
  .track {
    grid-template-columns: 2.75rem minmax(0, 1fr) auto;
    gap: 0.5rem;
    padding: 0.25rem 0;
  }

  .track-play-btn,
  .track-fav-btn,
  .track-add-btn,
  .track-detail-btn {
    width: 2.75rem;
    height: 2.75rem;
  }

  .track-meta {
    gap: 0.5rem;
    grid-column: 2 / -1;
    grid-row: 2;
    justify-content: flex-end;
  }

  .album-skeleton-track-play {
    width: 2.75rem !important;
    height: 2.75rem !important;
  }

  .album-skeleton-track-meta {
    min-height: 2.75rem;
  }

  .album-skeleton-track-meta > .p-skeleton {
    width: 2.75rem !important;
    height: 2.75rem !important;
  }

  .track-specification {
    grid-column: 1 / -1;
    padding: 0.5rem 0 0.75rem 3.25rem;
  }
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
.track-add-menu-item:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: -2px;
  background-color: var(--a-color-surface-muted);
}
.track-add-menu-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.25rem;
  padding: 0.35rem 0.55rem 0;
  border-top: 1px solid var(--a-color-border-soft);
  color: var(--a-color-muted);
  font-size: 0.7rem;
}
.track-add-menu-page-btn {
  display: inline-grid;
  width: 1.75rem;
  height: 1.75rem;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--a-color-text);
  cursor: pointer;
}
.track-add-menu-page-btn:hover:not(:disabled) {
  background: var(--a-color-surface-muted);
}
.track-add-menu-page-btn:disabled {
  color: var(--a-color-muted-soft);
  cursor: not-allowed;
}
</style>
