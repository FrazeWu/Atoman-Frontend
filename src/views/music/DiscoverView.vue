<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import { reportError } from '@/utils/logger'
import { useRoute, useRouter } from 'vue-router'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PContentProgress from '@/components/ui/PContentProgress.vue'
import PSkeleton from '@/components/ui/PSkeleton.vue'
import SearchSurface from '@/components/search/SearchSurface.vue'
import PButton from '@/components/ui/PButton.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import {
  createAlbumBookmark,
  createArtistBookmark,
  createPlaylistBookmark,
  deleteAlbumBookmark,
  deleteArtistBookmark,
  deletePlaylistBookmark,
  listAlbumBookmarks,
  listArtistBookmarks,
  listPlaylistBookmarks,
  listMusicAlbums,
  listMusicArtists,
  listRecommendedArtists,
  listPublicMusicPlaylists,
  getMusicHome,
  recordMusicRecommendationEvents,
  type MusicHome,
  type MusicSongListItem,
  type MusicAlbumListItem,
  type MusicArtistListItem,
  type MusicPlaylistSummary,
  type MusicRecommendationItem,
} from '@/api/musicV1'
import { MusicAlbumCard, MusicArtistCard, MusicPlaylistCard } from '@/components/music'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { useMusicRouteSelection } from '@/composables/useMusicRouteSelection'
import { useLoginRedirect } from '@/composables/useLoginRedirect'
import { useRequestGeneration } from '@/composables/useRequestGeneration'
import { useAuthStore } from '@/stores/auth'
import { usePlayerStore } from '@/stores/player'
import type { Song } from '@/types'
import { getMountedPinia } from '@/utils/pinia'
import {
  claimMusicRecommendationImpression,
  getMusicRecommendationAlbumContext,
  rememberMusicRecommendationAlbum,
} from '@/utils/musicRecommendationAttribution'

const props = withDefaults(defineProps<{
  pageTitle?: string
  contentMode?: 'discover' | 'albums'
}>(), {
  pageTitle: '发现',
  contentMode: 'discover',
})

const authStore = getMountedPinia() ? useAuthStore() : null
const router = useRouter()
const route = useRoute()
const player = usePlayerStore()
const musicHome = ref<MusicHome | null>(null)
const {
  openAlbum,
  closeAlbum,
  openArtist,
  closeArtist,
  openMusicCreationFlow,
  closeMusicCreationFlow,
  closeMusicEditor,
} = useMusicDrawers()
const { applyRouteSelection } = useMusicRouteSelection({
  openAlbum,
  closeAlbum,
  openArtist,
  closeArtist,
  openMusicCreationFlow,
  closeMusicCreationFlow,
  closeMusicEditor,
})
const { requireLogin } = useLoginRedirect()
const loading = ref(false)
const errorMessage = ref('')
const discoverAlbums = ref<MusicAlbumListItem[]>([])
const discoverArtists = ref<MusicRecommendationItem[]>([])
const discoverPlaylists = ref<MusicPlaylistSummary[]>([])
type DiscoverSection = 'album' | 'artist' | 'playlist'
type DiscoverPagination = { page: number; page_size: number; total: number; has_more: boolean }
const discoverAlbumPageSize = 12
const discoverArtistPageSize = 12
const discoverPlaylistPageSize = 8
const discoverSectionMeta = reactive<Record<DiscoverSection, DiscoverPagination>>({
  album: { page: 1, page_size: discoverAlbumPageSize, total: 0, has_more: false },
  artist: { page: 1, page_size: discoverArtistPageSize, total: 0, has_more: false },
  playlist: { page: 1, page_size: discoverPlaylistPageSize, total: 0, has_more: false },
})
const discoverSectionLoading = reactive<Record<DiscoverSection, boolean>>({
  album: false,
  artist: false,
  playlist: false,
})
const searchQuery = ref('')
const searchOpen = ref(false)
const searchLoading = ref(false)
const searchAlbums = ref<MusicAlbumListItem[]>([])
const searchArtists = ref<MusicArtistListItem[]>([])
const albumItems = ref<MusicAlbumListItem[]>([])
const albumMeta = ref({ page: 1, page_size: 24, total: 0, has_more: false })
let activeSearchRequestId = 0
let albumSearchTimer: ReturnType<typeof setTimeout> | null = null
let bookmarkRequestId = 0
const musicHomeRequests = useRequestGeneration()
const personalizationRequests = useRequestGeneration()
const albumIndexRequests = useRequestGeneration()

const starredAlbumIds = ref<string[]>([])
const starredArtistIds = ref<string[]>([])
const starredPlaylistIds = ref<string[]>([])

const localFilteredAlbums = computed(() => {
  if (props.contentMode !== 'albums') return []
  return albumItems.value
})

const personalizedAlbums = computed(() => musicHome.value?.for_you ?? [])
const forYouBatchSize = 6
const forYouBatchIndex = ref(0)
const visiblePersonalizedAlbums = computed(() => {
  const start = forYouBatchIndex.value * forYouBatchSize
  return personalizedAlbums.value.slice(start, start + forYouBatchSize)
})
const hasMorePersonalizedAlbums = computed(() => (
  personalizedAlbums.value.length > forYouBatchSize
))
const personalizedAlbumIds = computed(() => new Set(
  personalizedAlbums.value.map(album => String(album.id)),
))
const filteredDiscoverAlbums = computed(() => discoverAlbums.value.filter(
  album => !personalizedAlbumIds.value.has(String(album.id)),
))
const recentPlaybackDisplayLimit = 8
const recentPlaybackItems = computed(() => {
  const continueProgress = musicHome.value?.continue_listening
  const continueSong = continueProgress?.song
  const recentItems = musicHome.value?.personalized ? (musicHome.value.recently_played ?? []) : []
  const recentHistoryLimit = Math.max(0, recentPlaybackDisplayLimit - (continueSong ? 1 : 0))

  return [
    ...(continueSong ? [{ id: `continue-${continueSong.id}`, song: continueSong, isContinue: true, positionSeconds: continueProgress.position_seconds }] : []),
    ...recentItems
      .filter(item => String(item.song.id) !== String(continueSong?.id ?? ''))
      .slice(0, recentHistoryLimit)
      .map(item => ({ ...item, isContinue: false, positionSeconds: undefined })),
  ]
})

async function fetchAlbumBookmarks(requestId = bookmarkRequestId) {
  if (!authStore?.isAuthenticated) {
    starredAlbumIds.value = []
    return
  }
  try {
    const response = await listAlbumBookmarks()
    if (requestId === bookmarkRequestId) {
      starredAlbumIds.value = (response.data ?? []).map((bookmark) => String(bookmark.album_id))
    }
  } catch (e) {
    if (requestId === bookmarkRequestId) starredAlbumIds.value = []
  }
}

async function fetchArtistBookmarks(requestId = bookmarkRequestId) {
  if (!authStore?.isAuthenticated) {
    starredArtistIds.value = []
    return
  }
  try {
    const response = await listArtistBookmarks()
    if (requestId === bookmarkRequestId) {
      starredArtistIds.value = (response.data ?? []).map((bookmark) => String(bookmark.artist_id))
    }
  } catch (e) {
    if (requestId === bookmarkRequestId) starredArtistIds.value = []
  }
}

async function fetchPlaylistBookmarks(requestId = bookmarkRequestId) {
  if (!authStore?.isAuthenticated) {
    starredPlaylistIds.value = []
    return
  }
  try {
    const response = await listPlaylistBookmarks()
    if (requestId === bookmarkRequestId) {
      starredPlaylistIds.value = (response.data ?? []).map((bookmark) => String(bookmark.playlist_id))
    }
  } catch (e) {
    if (requestId === bookmarkRequestId) starredPlaylistIds.value = []
  }
}

function updateAlbumBookmarkCount(albumId: string, delta: number) {
  const update = <T extends { id: string; bookmark_count?: number }>(items: T[]) => items.map((item) => {
    if (String(item.id) !== albumId) return item
    return { ...item, bookmark_count: Math.max(0, (item.bookmark_count ?? 0) + delta) }
  })
  discoverAlbums.value = update(discoverAlbums.value)
  if (musicHome.value) {
    musicHome.value = { ...musicHome.value, for_you: update(musicHome.value.for_you) }
  }
}

async function handleToggleAlbumBookmark(albumId: string) {
  if (!requireLogin()) return
  const isCurrentlyBookmarked = starredAlbumIds.value.includes(albumId)
  try {
    if (isCurrentlyBookmarked) {
      await deleteAlbumBookmark(albumId)
      starredAlbumIds.value = starredAlbumIds.value.filter(id => id !== albumId)
      updateAlbumBookmarkCount(albumId, -1)
      return
    }

    await createAlbumBookmark(albumId)
    starredAlbumIds.value.push(albumId)
    updateAlbumBookmarkCount(albumId, 1)
  } catch (e) {
    reportError(e, 'Failed to toggle album bookmark:')
  }
}

async function handleToggleArtistBookmark(artistId: string) {
  if (!requireLogin()) return
  const isCurrentlyBookmarked = starredArtistIds.value.includes(artistId)
  try {
    if (isCurrentlyBookmarked) {
      await deleteArtistBookmark(artistId)
      starredArtistIds.value = starredArtistIds.value.filter(id => id !== artistId)
      discoverArtists.value = discoverArtists.value.map((item) => {
        if (String(item.id) !== artistId) return item
        return { ...item, bookmark_count: Math.max(0, (item.bookmark_count ?? 0) - 1) }
      })
      return
    }

    await createArtistBookmark(artistId)
    starredArtistIds.value.push(artistId)
    discoverArtists.value = discoverArtists.value.map((item) => {
      if (String(item.id) !== artistId) return item
      return { ...item, bookmark_count: (item.bookmark_count ?? 0) + 1 }
    })
  } catch (e) {
    reportError(e, 'Failed to toggle artist bookmark:')
  }
}

async function handleTogglePlaylistBookmark(playlistId: string) {
  if (!requireLogin()) return
  const isCurrentlyBookmarked = starredPlaylistIds.value.includes(playlistId)
  try {
    if (isCurrentlyBookmarked) {
      await deletePlaylistBookmark(playlistId)
      starredPlaylistIds.value = starredPlaylistIds.value.filter(id => id !== playlistId)
      discoverPlaylists.value = discoverPlaylists.value.map((item) => {
        if (String(item.id) !== playlistId) return item
        return { ...item, bookmark_count: Math.max(0, (item.bookmark_count ?? 0) - 1) }
      })
      return
    }

    await createPlaylistBookmark(playlistId)
    starredPlaylistIds.value.push(playlistId)
    discoverPlaylists.value = discoverPlaylists.value.map((item) => {
      if (String(item.id) !== playlistId) return item
      return { ...item, bookmark_count: (item.bookmark_count ?? 0) + 1 }
    })
  } catch (e) {
    reportError(e, 'Failed to toggle playlist bookmark:')
  }
}

function recordPersonalizedAlbumImpressions(
  albums: MusicAlbumListItem[],
  requestId: string,
  startIndex: number,
) {
  const events = albums
    .slice(startIndex, startIndex + forYouBatchSize)
    .flatMap((album, index) => {
      const context = getMusicRecommendationAlbumContext(String(album.id))
      if (!context || !claimMusicRecommendationImpression(requestId, String(album.id))) return []
      return [{
        event: 'impression' as const,
        entity_type: 'album' as const,
        entity_id: String(album.id),
        position: startIndex + index + 1,
        reason: context.reason,
      }]
    })
  if (!events.length) return
  void recordMusicRecommendationEvents({
    request_id: requestId,
    surface: 'music_home',
    events,
  }).catch((error) => reportError(error, 'Failed to record music recommendation impressions:'))
}

async function fetchPersonalizedHome() {
  const request = personalizationRequests.beginRequest()
  const currentBookmarkRequestId = ++bookmarkRequestId
  if (!authStore?.isAuthenticated) {
    if (!request.isCurrent()) return
    musicHome.value = null
    starredAlbumIds.value = []
    starredArtistIds.value = []
    starredPlaylistIds.value = []
    return
  }

  try {
    const response = await getMusicHome()
    if (!request.isCurrent()) return
    musicHome.value = response
    forYouBatchIndex.value = 0
    const requestId = response.request_id?.trim()
    if (requestId) {
      response.for_you.forEach((album, index) => {
        rememberMusicRecommendationAlbum(String(album.id), {
          request_id: requestId,
          surface: 'music_home',
          position: index + 1,
          reason: album.reason,
        })
      })
      recordPersonalizedAlbumImpressions(response.for_you, requestId, 0)
    }
    void fetchAlbumBookmarks(currentBookmarkRequestId)
    void fetchArtistBookmarks(currentBookmarkRequestId)
    void fetchPlaylistBookmarks(currentBookmarkRequestId)
  } catch (error) {
    if (!request.isCurrent()) return
    reportError(error, 'Failed to fetch personalized music home:')
    musicHome.value = null
  }
}

async function fetchMusicHome() {
  const request = musicHomeRequests.beginRequest()
  resetDiscoverSections()
  loading.value = true
  errorMessage.value = ''
  void fetchPersonalizedHome()
  try {
    await Promise.all((['album', 'artist', 'playlist'] as const).map((section) => (
      loadDiscoverSection(section, 1, false, request.isCurrent)
    )))
  } catch (error) {
    if (!request.isCurrent()) return
    reportError(error, 'Failed to fetch music discovery:')
    resetDiscoverSections()
    errorMessage.value = '发现内容加载失败'
  } finally {
    if (request.isCurrent()) loading.value = false
  }
}

function showNextPersonalizedAlbums() {
  const batchCount = Math.ceil(personalizedAlbums.value.length / forYouBatchSize)
  if (batchCount < 2) return
  const nextIndex = (forYouBatchIndex.value + 1) % batchCount
  forYouBatchIndex.value = nextIndex
  const requestId = musicHome.value?.request_id?.trim()
  if (requestId) recordPersonalizedAlbumImpressions(personalizedAlbums.value, requestId, nextIndex * forYouBatchSize)
}

function resetDiscoverSections() {
  discoverAlbums.value = []
  discoverArtists.value = []
  discoverPlaylists.value = []
  for (const section of ['album', 'artist', 'playlist'] as const) {
    discoverSectionMeta[section] = {
      page: 1,
      page_size: section === 'album'
        ? discoverAlbumPageSize
        : section === 'artist'
          ? discoverArtistPageSize
          : discoverPlaylistPageSize,
      total: 0,
      has_more: false,
    }
    discoverSectionLoading[section] = false
  }
}

function toPlayableSong(song: MusicSongListItem): Song | null {
  if (!song.audio_url) return null
  return {
    id: song.id,
    title: song.title,
    artist: song.artists?.map((artist) => artist.name).join(' / ') || '未知艺术家',
    album: song.album?.title || '',
    album_id: song.album?.id || '',
    year: 0,
    release_date: '',
    lyrics: song.lyrics || '',
    audio_url: song.audio_url,
    waveform_peaks: song.waveform_peaks,
    cover_url: song.cover_url || song.album?.cover_url || '',
    track_number: song.track_number || 0,
    status: (song.status as Song['status']) || 'open',
    artists: song.artists?.map((artist) => ({
      id: artist.id,
      name: artist.name,
      username: '',
      email: '',
    })),
  }
}

function playRecentSong(song: MusicSongListItem, positionSeconds?: number) {
  const playable = toPlayableSong(song)
  if (!playable) return
  if (positionSeconds !== undefined) {
    player.resumeSong(playable, positionSeconds)
    return
  }
  player.playSong(playable)
}

function formatPlaybackPosition(seconds: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds))
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
}

function mergeDiscoverByID<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const byID = new Map(current.map((item) => [String(item.id), item]))
  incoming.forEach((item) => byID.set(String(item.id), item))
  return [...byID.values()]
}

async function loadDiscoverSection(
  section: DiscoverSection,
  targetPage: number,
  append: boolean,
  isCurrent: () => boolean,
) {
  if (discoverSectionLoading[section]) return
  discoverSectionLoading[section] = true
  try {
    if (section === 'album') {
      const response = await listMusicAlbums({ page: targetPage, page_size: discoverAlbumPageSize, sort: 'hot' })
      if (!isCurrent()) return
      const albums = response.data.map((album) => ({ ...album, reason: '近期热门专辑' }))
      discoverAlbums.value = append ? mergeDiscoverByID(discoverAlbums.value, albums) : albums
      discoverSectionMeta.album = response.meta
      return
    }

    if (section === 'artist') {
      const response = await listRecommendedArtists('hot', { page: targetPage, page_size: discoverArtistPageSize })
      if (!isCurrent()) return
      const artists = response.data.map((artist) => ({ ...artist, reason: '近期热门艺人', section: 'artist' }))
      discoverArtists.value = append ? mergeDiscoverByID(discoverArtists.value, artists) : artists
      discoverSectionMeta.artist = response.meta
      return
    }

    const response = await listPublicMusicPlaylists({ page: targetPage, page_size: discoverPlaylistPageSize })
    if (!isCurrent()) return
    const playlists = response.data.map((playlist) => ({ ...playlist, reason: '最新公开歌单', section: 'playlist' }))
    discoverPlaylists.value = append ? mergeDiscoverByID(discoverPlaylists.value, playlists) : playlists
    discoverSectionMeta.playlist = response.meta ?? {
      page: targetPage,
      page_size: discoverPlaylistPageSize,
      total: playlists.length,
      has_more: false,
    }
  } catch (error) {
    if (!isCurrent()) return
    reportError(error, `Failed to load ${section} discovery section:`)
    errorMessage.value = '发现内容加载失败'
  } finally {
    if (isCurrent()) discoverSectionLoading[section] = false
  }
}

function loadMoreDiscoverSection(section: DiscoverSection) {
  const meta = discoverSectionMeta[section]
  if (!meta.has_more || discoverSectionLoading[section]) return
  const generation = musicHomeRequests.currentGeneration()
  void loadDiscoverSection(section, meta.page + 1, true, () => musicHomeRequests.isCurrent(generation))
}

async function fetchAlbumIndex(nextPage = 1) {
  const request = albumIndexRequests.beginRequest()
  loading.value = true
  errorMessage.value = ''
  try {
    const query = searchQuery.value.trim()
    const response = await listMusicAlbums({
      ...(query ? { q: query } : {}),
      page: nextPage,
      page_size: 24,
      sort: 'hot',
    })
    if (!request.isCurrent()) return
    albumItems.value = response.data ?? []
    albumMeta.value = response.meta
    const currentBookmarkRequestId = ++bookmarkRequestId
    void fetchAlbumBookmarks(currentBookmarkRequestId)
  } catch (error) {
    if (!request.isCurrent()) return
    reportError(error, 'Failed to fetch music albums:')
    errorMessage.value = '专辑列表加载失败'
    albumItems.value = []
  } finally {
    if (request.isCurrent()) loading.value = false
  }
}

async function fetchSearchResults() {
  const query = searchQuery.value.trim()
  const requestId = ++activeSearchRequestId

  if (!query) {
    searchAlbums.value = []
    searchArtists.value = []
    searchLoading.value = false
    return
  }

  if (props.contentMode === 'albums') {
    searchLoading.value = false
    return
  }

  searchLoading.value = true
  try {
    const [albumResponse, artistResponse] = await Promise.all([
      listMusicAlbums({ q: query, page: 1, page_size: 10, sort: 'hot' }),
      listMusicArtists({ q: query, page: 1, page_size: 10 }),
    ])
    if (requestId !== activeSearchRequestId) return
    searchAlbums.value = albumResponse.data
    searchArtists.value = artistResponse.data
  } catch (error) {
    if (requestId !== activeSearchRequestId) return
    reportError(error, 'Failed to search music explore entities:')
    searchAlbums.value = []
    searchArtists.value = []
  } finally {
    if (requestId === activeSearchRequestId) {
      searchLoading.value = false
    }
  }
}

function artistCardItem(item: MusicRecommendationItem) {
  return {
    id: item.id,
    name: item.title,
    bio: item.summary,
    image_url: item.image_url,
    play_count: item.play_count,
    bookmark_count: item.bookmark_count,
    birth_year: item.birth_year,
    birth_date: item.birth_date,
    reason: item.reason,
  }
}

function playlistCardItem(item: MusicPlaylistSummary) {
  return {
    id: item.id,
    title: item.name,
    description: item.description,
    cover_url: item.cover_url,
    song_count: item.song_count,
    owner_username: item.owner_username,
    play_count: item.play_count,
    bookmark_count: item.bookmark_count,
    reason: item.reason,
  }
}

function openPersonalizedAlbum(album: MusicAlbumListItem, position: number) {
  const context = getMusicRecommendationAlbumContext(String(album.id))
  if (context) {
    void recordMusicRecommendationEvents({
      request_id: context.request_id,
      surface: 'music_home',
      events: [{
        event: 'click',
        entity_type: 'album',
        entity_id: String(album.id),
        position,
        reason: context.reason,
      }],
    }).catch((error) => reportError(error, 'Failed to record music recommendation click:'))
  }
  openAlbum(String(album.id))
}

function openDiscoverAlbum(album: MusicAlbumListItem) {
  openAlbum(String(album.id))
}

function openDiscoverArtist(artist: MusicRecommendationItem) {
  openArtist(String(artist.id))
}

function openDiscoverPlaylist(playlist: MusicPlaylistSummary) {
  router.push(`/music/playlist/${playlist.id}`)
}

function openAlbumResult(album: MusicAlbumListItem) {
  searchOpen.value = false
  searchQuery.value = ''
  router.push(`/music/album/${album.id}`)
}

function openArtistResult(artist: MusicArtistListItem) {
  searchOpen.value = false
  searchQuery.value = ''
  router.push(`/music/artist/${artist.id}`)
}

function startAlbumCreation() {
  if (!requireLogin()) return
  openMusicCreationFlow({ startStep: 'albumDetails' })
}

function handleSearchFocus() {
  searchOpen.value = true
}

function handleSearchBlur() {
  window.setTimeout(() => {
    searchOpen.value = false
  }, 120)
}

watch(searchQuery, () => {
  if (props.contentMode === 'albums') {
    albumIndexRequests.beginRequest()
    if (albumSearchTimer) clearTimeout(albumSearchTimer)
    albumSearchTimer = setTimeout(() => void fetchAlbumIndex(), 250)
    return
  }
  fetchSearchResults()
})

onMounted(() => {
  if (props.contentMode === 'albums') {
    fetchAlbumIndex()
    return
  }
  fetchMusicHome()
})

onUnmounted(() => {
  if (albumSearchTimer) clearTimeout(albumSearchTimer)
  musicHomeRequests.beginRequest()
  personalizationRequests.beginRequest()
  albumIndexRequests.beginRequest()
})

watch(
  () => [route.query.artist, route.query.album, route.query.editor, route.query.name],
  () => applyRouteSelection(route.query),
  { immediate: true },
)

watch(
  () => [authStore?.isAuthenticated, authStore?.token, authStore?.user?.uuid],
  () => {
    if (props.contentMode === 'discover') void fetchPersonalizedHome()
  },
)

const hasSearchQuery = computed(() => searchQuery.value.trim().length > 0)
const hasSearchResults = computed(() => searchAlbums.value.length > 0 || searchArtists.value.length > 0)
</script>

<template>
  <section class="music-explore-view">
    <header class="page-header">
      <PPageHeader
        :title="pageTitle"
        mb="0"
      />
    </header>

    <div class="toolbar-row">
      <div class="toolbar-left">
        <div class="search-shell" :class="{ 'is-open': searchOpen }">
          <SearchSurface
            v-model:query="searchQuery"
            :open="contentMode === 'discover' && searchOpen"
            compact
            eyebrow=""
            :overlay-results="contentMode === 'discover'"
            :status="contentMode === 'discover' && searchLoading ? '搜索中...' : ''"
            placeholder="搜索专辑或艺术家..."
            input-test-id="music-explore-search-input"
            dropdown-test-id="music-explore-search-dropdown"
            :loading="contentMode === 'discover' && searchLoading"
            :empty="contentMode === 'discover' && hasSearchQuery && !hasSearchResults ? '没有匹配结果' : ''"
            @focus="handleSearchFocus"
            @blur="handleSearchBlur"
          >
            <template #results>
              <div class="search-dropdown__sections">
                <section v-if="searchAlbums.length" class="search-group">
                  <p class="search-group__title">专辑</p>
                  <button
                    v-for="album in searchAlbums"
                    :key="`album-${album.id}`"
                    type="button"
                    class="search-result"
                    data-testid="music-explore-album-result"
                    @mousedown.prevent="openAlbumResult(album)"
                  >
                    <span class="search-result__title">{{ album.title }}</span>
                    <span class="search-result__meta">{{ album.artists?.map((artist) => artist.name).join(' / ') || '专辑' }}</span>
                  </button>
                </section>

                <section v-if="searchArtists.length" class="search-group">
                  <p class="search-group__title">艺术家</p>
                  <button
                    v-for="artist in searchArtists"
                    :key="`artist-${artist.id}`"
                    type="button"
                    class="search-result"
                    data-testid="music-explore-artist-result"
                    @mousedown.prevent="openArtistResult(artist)"
                  >
                    <span class="search-result__title">{{ artist.display_name || artist.name }}</span>
                    <span class="search-result__meta">{{ artist.legal_name || artist.bio || '艺术家' }}</span>
                  </button>
                </section>
              </div>
            </template>
          </SearchSurface>
        </div>
        <PButton
          variant="primary"
          class="search-side-action"
          data-testid="add-album"
          @click="startAlbumCreation"
        >
          添加专辑
        </PButton>
      </div>
    </div>

    <template v-if="contentMode === 'discover' && musicHome">
      <section v-if="recentPlaybackItems.length" class="music-home-section" aria-labelledby="recently-played-title">
        <header class="music-home-section__header">
          <h2 id="recently-played-title">最近播放</h2>
        </header>
        <div class="recently-played-list">
          <div
            v-for="item in recentPlaybackItems"
            :key="item.id"
            class="recently-played-item"
          >
            <button type="button" class="recently-played-item__play" :disabled="!item.song.audio_url" :aria-label="`${item.isContinue ? '从进度继续播放' : '播放'} ${item.song.title}`" :data-testid="item.isContinue ? 'continue-song-play' : 'recent-song-play'" @click="playRecentSong(item.song, item.positionSeconds)">
              <img v-if="item.song.cover_url || item.song.album?.cover_url" :src="item.song.cover_url || item.song.album?.cover_url" :alt="item.song.title" />
              <span v-else class="recently-played-item__cover" aria-hidden="true" />
            </button>
            <span class="recently-played-item__copy">
              <span v-if="item.isContinue" class="recently-played-item__label">从 {{ formatPlaybackPosition(item.positionSeconds || 0) }} 继续</span>
              <RouterLink :to="`/music/song/${item.song.id}`"><strong>{{ item.song.title }}</strong></RouterLink>
              <span class="recently-played-item__links">
                <template v-if="item.song.artists?.length">
                  <template v-for="(artist, index) in item.song.artists" :key="artist.id">
                    <span v-if="index" aria-hidden="true"> / </span>
                    <button type="button" :data-testid="`${item.isContinue ? 'continue' : 'recent'}-song-artist-${artist.id}`" @click="openArtist(String(artist.id))">{{ artist.name }}</button>
                  </template>
                </template>
                <span v-else>未知艺术家</span>
                <template v-if="item.song.album?.id"><span aria-hidden="true"> · </span><button type="button" :data-testid="`${item.isContinue ? 'continue' : 'recent'}-song-album-${item.song.album.id}`" @click="openAlbum(String(item.song.album.id))">{{ item.song.album.title }}</button></template>
              </span>
            </span>
          </div>
        </div>
      </section>

      <section v-if="personalizedAlbums.length" class="music-home-section" aria-labelledby="for-you-title">
        <header class="music-home-section__header">
          <h2 id="for-you-title">为你推荐</h2>
          <PButton
            v-if="hasMorePersonalizedAlbums"
            variant="ghost"
            size="sm"
            data-testid="for-you-next-batch"
            @click="showNextPersonalizedAlbums"
          ><RefreshCw :size="14" aria-hidden="true" /><span>换一批</span></PButton>
        </header>
        <div class="discover-layout discover-layout--albums for-you-layout" aria-label="为你推荐专辑">
          <div v-for="(album, index) in visiblePersonalizedAlbums" :key="album.id" class="discover-result">
            <MusicAlbumCard
              class="discover-layout__item"
              :album="album"
              :is-bookmarked="starredAlbumIds.includes(String(album.id))"
              data-testid="personalized-album-card"
              @click="openPersonalizedAlbum(album, forYouBatchIndex * forYouBatchSize + index + 1)"
              @click-artist="openArtist"
              @toggle-bookmark="handleToggleAlbumBookmark(String(album.id))"
            />
            <p v-if="album.reason" class="discover-result__reason">{{ album.reason }}</p>
          </div>
        </div>
      </section>

    </template>

    <p v-if="errorMessage" class="state-line state-line--error">{{ errorMessage }}</p>

    <PContentProgress
      :loading="loading"
      :retry="fetchMusicHome"
    >
      <template #skeleton>
        <div class="discover-grid" style="padding-top: 1rem;">
          <div v-for="i in 8" :key="i" style="display:flex;flex-direction:column;gap:0.75rem;">
            <PSkeleton height="160px" variant="rect" />
            <PSkeleton width="70%" height="18px" />
            <PSkeleton width="40%" height="14px" />
          </div>
        </div>
      </template>

      <p v-if="contentMode === 'albums' && !localFilteredAlbums.length" class="state-line">暂无专辑</p>
      <p v-else-if="contentMode === 'discover' && !personalizedAlbums.length && !discoverAlbums.length && !discoverPlaylists.length && !discoverArtists.length && !recentPlaybackItems.length" class="state-line">暂无发现内容</p>

      <section v-else-if="contentMode === 'albums'" class="album-index">
      <div class="discover-grid" aria-label="专辑列表">
        <MusicAlbumCard
          v-for="album in localFilteredAlbums"
          :key="album.id"
          :album="album"
          :is-bookmarked="starredAlbumIds.includes(String(album.id))"
          data-testid="discover-album-card"
          @click="router.push(`/music/album/${album.id}`)"
          @click-artist="openArtist"
          @toggle-bookmark="handleToggleAlbumBookmark(String(album.id))"
        />
      </div>
      <PaginationBar
        v-if="albumMeta.total > 0"
        :meta="albumMeta"
        :loading="loading"
        @change="fetchAlbumIndex"
      />
    </section>

    <div v-else class="discover-sections" aria-label="发现分区">
      <section v-if="filteredDiscoverAlbums.length" class="discover-section">
        <div class="discover-section__header">
          <h2 class="discover-section__title" data-testid="discover-section-title">专辑</h2>
        </div>
        <div class="discover-layout discover-layout--albums" aria-label="发现专辑分区">
          <div v-for="item in filteredDiscoverAlbums" :key="item.id" class="discover-result">
            <MusicAlbumCard
            class="discover-layout__item"
            :album="item"
            :is-bookmarked="starredAlbumIds.includes(String(item.id))"
            data-testid="discover-album-card"
            @click="openDiscoverAlbum(item)"
            @click-artist="openArtist"
            @toggle-bookmark="handleToggleAlbumBookmark(String(item.id))"
            />
            <p v-if="item.reason" class="discover-result__reason">{{ item.reason }}</p>
          </div>
        </div>
        <div v-if="discoverSectionMeta.album.has_more" class="discover-load-more-wrap">
          <PButton
            variant="secondary"
            :loading="discoverSectionLoading.album"
            loading-text="加载中..."
            data-testid="discover-albums-load-more"
            @click="loadMoreDiscoverSection('album')"
          >加载更多</PButton>
        </div>
      </section>

      <section v-if="discoverPlaylists.length" class="discover-section">
        <div class="discover-section__header">
          <h2 class="discover-section__title" data-testid="discover-section-title">歌单</h2>
        </div>
        <div class="discover-layout discover-layout--playlists" aria-label="发现歌单分区">
          <div v-for="item in discoverPlaylists" :key="item.id" class="discover-result">
            <MusicPlaylistCard
            class="discover-layout__item"
            :playlist="playlistCardItem(item)"
            :is-bookmarked="starredPlaylistIds.includes(String(item.id))"
            data-testid="discover-playlist-card"
            @click="openDiscoverPlaylist(item)"
            @toggle-bookmark="handleTogglePlaylistBookmark(String(item.id))"
            />
            <p v-if="item.reason" class="discover-result__reason">{{ item.reason }}</p>
          </div>
        </div>
        <div v-if="discoverSectionMeta.playlist.has_more" class="discover-load-more-wrap">
          <PButton
            variant="secondary"
            :loading="discoverSectionLoading.playlist"
            loading-text="加载中..."
            data-testid="discover-playlists-load-more"
            @click="loadMoreDiscoverSection('playlist')"
          >加载更多</PButton>
        </div>
      </section>

      <section v-if="discoverArtists.length" class="discover-section">
        <div class="discover-section__header">
          <h2 class="discover-section__title" data-testid="discover-section-title">艺人</h2>
        </div>
        <div class="discover-layout discover-layout--artists" aria-label="发现艺人分区">
          <div v-for="item in discoverArtists" :key="item.id" class="discover-result">
            <MusicArtistCard
            class="discover-layout__item discover-layout__item--artist"
            :artist="artistCardItem(item)"
            :is-bookmarked="starredArtistIds.includes(String(item.id))"
            data-testid="discover-artist-card"
            @click="openDiscoverArtist(item)"
            @toggle-bookmark="handleToggleArtistBookmark(String(item.id))"
            />
            <p v-if="item.reason" class="discover-result__reason">{{ item.reason }}</p>
          </div>
        </div>
        <div v-if="discoverSectionMeta.artist.has_more" class="discover-load-more-wrap">
          <PButton
            variant="secondary"
            :loading="discoverSectionLoading.artist"
            loading-text="加载中..."
            data-testid="discover-artists-load-more"
            @click="loadMoreDiscoverSection('artist')"
          >加载更多</PButton>
        </div>
      </section>
    </div>
    </PContentProgress>
  </section>
</template>

<style scoped>
.music-explore-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.album-index {
  display: grid;
  gap: 1rem;
}

.toolbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1 1 auto;
  flex-wrap: wrap;
}

.search-shell {
  position: relative;
  max-width: 28rem;
  min-width: 17rem;
  flex: 1 1 20rem;
  height: 36px;
}

.ui-action {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 2.75rem;
  padding: 0.65rem 1rem;
  border: 1px solid color-mix(in srgb, var(--a-color-text) 16%, transparent);
  border-radius: 4px;
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  font-family: var(--a-font-sans);
  font-size: 0.78rem;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: uppercase;
  cursor: pointer;
}

.search-side-action { white-space: nowrap; }
.action-indicator { width: 0.45rem; height: 0.45rem; border-radius: 4px; background: color-mix(in srgb, var(--a-color-text) 72%, transparent); flex-shrink: 0; }

.search-shell.is-open {
  z-index: 15;
}

.search-shell :deep(.search-frame) {
  position: relative;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}

.search-shell.is-open :deep(.search-frame) {
  position: absolute;
  top: 0;
  left: 0;
  width: 40rem;
  height: auto !important;
  z-index: 100;
}

.search-dropdown__sections {
  display: grid;
}

.search-group + .search-group {
  border-top: 1px solid var(--a-color-border-soft);
  margin-top: 0.35rem;
  padding-top: 0.35rem;
}

.search-group__title {
  margin: 0;
  padding: 0.25rem 0.95rem 0.45rem;
  color: var(--a-color-muted-soft);
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: uppercase;
}

.search-result {
  display: grid;
  gap: 0.2rem;
  width: 100%;
  border: 0;
  background: transparent;
  padding: 1rem 1.05rem;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.search-result:hover {
  background: color-mix(in srgb, var(--a-color-bg) 58%, var(--a-color-surface-muted) 42%);
}

.search-result__title {
  font-size: 0.98rem;
  font-weight: 500;
  color: var(--a-color-fg);
}

.search-result__meta {
  font-size: 0.8rem;
  color: var(--a-color-muted-soft);
}

.state-line {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 1rem;
}

.state-line--error {
  color: #8a2f2f;
}

.music-home-section {
  display: grid;
  gap: 0.85rem;
}

.music-home-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.music-home-section__header h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.music-home-section__reason {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.875rem;
}

.recently-played-list {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
}

.recently-played-item {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
  padding: 0.55rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
  background: var(--a-color-bg);
  color: inherit;
  text-align: left;
  transition: background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.recently-played-item:hover,
.recently-played-item:focus-within {
  border-color: var(--a-color-border);
  background: var(--a-color-surface-muted);
  box-shadow: inset 4px 0 0 var(--a-color-text), var(--a-shadow-sm);
}

.recently-played-item__play {
  flex: 0 0 42px;
  border: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
}

.recently-played-item__play:disabled {
  cursor: default;
  opacity: 0.55;
}

.recently-played-item img,
.recently-played-item__cover {
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  border-radius: 4px;
  object-fit: cover;
  background: var(--a-color-surface-muted);
}

.recently-played-item__copy {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.15rem;
  min-width: 0;
  overflow: hidden;
}

.recently-played-item__label {
  color: var(--a-color-muted);
  font-size: 0.7rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recently-played-item__copy > a {
  display: block;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: inherit;
  text-decoration: none;
}

.recently-played-item__copy strong {
  display: block;
  font-size: 0.86rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recently-played-item__links {
  display: block;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--a-color-muted);
  font-size: 0.75rem;
}

.recently-played-item__links button {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  vertical-align: bottom;
}

.recently-played-item__copy > a:hover,
.recently-played-item__links button:hover {
  text-decoration: underline;
}

.music-home-albums {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 1.25rem;
}

.discover-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 1.25rem;
  margin-top: 1.5rem;
}

.discover-sections {
  display: grid;
  gap: 1.6rem;
  margin-top: 1.5rem;
}

.discover-section {
  display: grid;
  gap: 0.85rem;
}

.discover-load-more-wrap {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
}

.discover-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.discover-section__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
  letter-spacing: 0;
}

.discover-layout {
  display: grid;
  gap: 1rem;
}

.discover-layout--albums {
  grid-template-columns: repeat(6, minmax(0, 1fr));
}

.discover-layout.for-you-layout {
  grid-template-columns: repeat(6, minmax(0, 1fr));
}

.discover-layout--playlists {
  grid-template-columns: repeat(6, minmax(0, 1fr));
}

.discover-layout--artists {
  grid-template-columns: repeat(6, minmax(0, 1fr));
}

@media (max-width: 1100px) {
  .discover-layout--albums,
  .discover-layout--playlists,
  .discover-layout--artists,
  .music-home-albums,
  .discover-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.discover-layout__item {
  min-width: 0;
}

.discover-result { display: grid; min-width: 0; gap: 0.35rem; align-content: start; }
.discover-result__reason { margin: 0; color: var(--a-color-muted); font-size: 0.75rem; line-height: 1.4; }
.discover-load-more { align-self: center; min-width: 8rem; }

.discover-layout__playlist-placeholder {
  min-height: 13rem;
  padding: 1rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 18px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--a-color-bg) 86%, var(--a-color-surface-muted) 14%), var(--a-color-bg));
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.8rem;
}

.discover-placeholder__eyebrow {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: uppercase;
  color: var(--a-color-muted-soft);
}

.discover-placeholder__title {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 500;
  color: var(--a-color-fg);
}

.discover-placeholder__title--compact {
  font-size: 1.05rem;
}

.discover-placeholder__copy {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--a-color-muted);
}

@media (max-width: 720px) {
  .music-explore-view {
    padding-inline: 1rem;
  }

  .toolbar-row,
  .toolbar-left {
    flex-direction: column;
    align-items: stretch;
  }

  .search-shell,
  .search-shell.is-open {
    min-width: 0;
    max-width: 100%;
    width: 100%;
    flex: 0 0 36px;
  }

  .search-shell.is-open :deep(.search-frame) {
    width: 100%;
  }

  .discover-layout--albums,
  .discover-layout--playlists,
  .discover-layout--artists,
  .recently-played-list,
  .music-home-albums,
  .discover-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .discover-layout.for-you-layout {
    grid-template-columns: repeat(6, minmax(9rem, 1fr));
    overflow-x: auto;
    padding-bottom: 0.35rem;
    scroll-snap-type: x mandatory;
  }

  .for-you-layout .discover-result { scroll-snap-align: start; }
}
</style>
