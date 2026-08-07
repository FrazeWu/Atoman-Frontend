<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { reportError } from '@/utils/logger'
import { useRoute, useRouter } from 'vue-router'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import SearchSurface from '@/components/search/SearchSurface.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PButton from '@/components/ui/PButton.vue'
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
  getMusicHome,
  type MusicHome,
  type MusicSongListItem,
  type MusicDiscoverItem,
  type MusicAlbumListItem,
  type MusicArtistListItem,
  type MusicPlaylistSummary,
  type MusicRecommendationItem,
} from '@/api/musicV1'
import { MusicAlbumCard, MusicArtistCard, MusicPlaylistCard } from '@/components/music'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { useMusicRouteSelection } from '@/composables/useMusicRouteSelection'
import { useLoginRedirect } from '@/composables/useLoginRedirect'
import { useAuthStore } from '@/stores/auth'
import { usePlayerStore } from '@/stores/player'
import type { Song } from '@/types'
import { getActivePinia } from 'pinia'

const props = withDefaults(defineProps<{
  pageTitle?: string
  contentMode?: 'discover' | 'albums'
}>(), {
  pageTitle: '发现',
  contentMode: 'discover',
})

const authStore = getActivePinia() ? useAuthStore() : null
const router = useRouter()
const route = useRoute()
const player = usePlayerStore()
const musicHome = ref<MusicHome | null>(null)
const musicHomeLoading = ref(false)
const {
  openAlbum,
  closeAlbum,
  openArtist,
  closeArtist,
  openMusicCreationFlow,
  closeMusicCreationFlow,
  openMusicEditor,
  closeMusicEditor,
} = useMusicDrawers()
const { applyRouteSelection } = useMusicRouteSelection({
  openAlbum,
  closeAlbum,
  openArtist,
  closeArtist,
  openMusicCreationFlow,
  closeMusicCreationFlow,
  openMusicEditor,
  closeMusicEditor,
})
const { requireLogin } = useLoginRedirect()
const loading = ref(false)
const errorMessage = ref('')
const discoverAlbums = ref<MusicAlbumListItem[]>([])
const discoverArtists = ref<MusicRecommendationItem[]>([])
const discoverPlaylists = ref<MusicPlaylistSummary[]>([])
const discoverLoadingMore = ref(false)
const discoverPage = ref(1)
const searchQuery = ref('')
const searchOpen = ref(false)
const searchLoading = ref(false)
const searchAlbums = ref<MusicAlbumListItem[]>([])
const searchArtists = ref<MusicArtistListItem[]>([])
const albumItems = ref<MusicAlbumListItem[]>([])
let activeSearchRequestId = 0

const starredAlbumIds = ref<string[]>([])
const starredArtistIds = ref<string[]>([])
const starredPlaylistIds = ref<string[]>([])

const filterYear = ref('all')
const filterGenre = ref('all')
const filterLanguage = ref('all')

const yearOptions = [
  { label: '全部年代', value: 'all' },
  { label: '2020年代', value: '2020s' },
  { label: '2010年代', value: '2010s' },
  { label: '2000年代', value: '2000s' },
  { label: '90年代及以前', value: '1990s' },
]

const genreOptions = [
  { label: '全部流派', value: 'all' },
  { label: 'Pop', value: 'Pop' },
  { label: 'Rock', value: 'Rock' },
  { label: 'Hip Hop', value: 'Hip Hop' },
  { label: 'R&B', value: 'R&B' },
  { label: 'Electronic', value: 'Electronic' },
]

const languageOptions = [
  { label: '全部语言', value: 'all' },
  { label: '国语', value: 'Mandarin' },
  { label: '粤语', value: 'Cantonese' },
  { label: '英语', value: 'English' },
  { label: '日语', value: 'Japanese' },
  { label: '韩语', value: 'Korean' },
]

const localFilteredAlbums = computed(() => {
  if (props.contentMode !== 'albums') return []
  let results = albumItems.value

  if (filterYear.value !== 'all') {
    results = results.filter(a => {
      if (!a.year) return false
      if (filterYear.value === '2020s') return a.year >= 2020
      if (filterYear.value === '2010s') return a.year >= 2010 && a.year < 2020
      if (filterYear.value === '2000s') return a.year >= 2000 && a.year < 2010
      if (filterYear.value === '1990s') return a.year < 2000
      return true
    })
  }

  // 本地基于分词器的轻量级检索
  const sq = searchQuery.value.trim().toLowerCase()
  if (sq) {
    results = results.filter(a => 
      a.title.toLowerCase().includes(sq) || 
      (a.artists && a.artists.some(artist => artist.name.toLowerCase().includes(sq))) ||
      (a.description && a.description.toLowerCase().includes(sq))
    )
  }
  
  return results
})

const filteredDiscoverAlbums = computed(() => {
  let results = discoverAlbums.value
  if (filterYear.value !== 'all') {
    results = results.filter(a => {
      if (!a.year) return false
      if (filterYear.value === '2020s') return a.year >= 2020
      if (filterYear.value === '2010s') return a.year >= 2010 && a.year < 2020
      if (filterYear.value === '2000s') return a.year >= 2000 && a.year < 2010
      if (filterYear.value === '1990s') return a.year < 2000
      return true
    })
  }
  return results
})

async function fetchAlbumBookmarks() {
  if (!authStore?.isAuthenticated) {
    starredAlbumIds.value = []
    return
  }
  try {
    const response = await listAlbumBookmarks()
    starredAlbumIds.value = (response.data ?? []).map((bookmark) => String(bookmark.album_id))
  } catch (e) {
    starredAlbumIds.value = []
  }
}

async function fetchArtistBookmarks() {
  if (!authStore?.isAuthenticated) {
    starredArtistIds.value = []
    return
  }
  try {
    const response = await listArtistBookmarks()
    starredArtistIds.value = (response.data ?? []).map((bookmark) => String(bookmark.artist_id))
  } catch (e) {
    starredArtistIds.value = []
  }
}

async function fetchPlaylistBookmarks() {
  if (!authStore?.isAuthenticated) {
    starredPlaylistIds.value = []
    return
  }
  try {
    const response = await listPlaylistBookmarks()
    starredPlaylistIds.value = (response.data ?? []).map((bookmark) => String(bookmark.playlist_id))
  } catch (e) {
    starredPlaylistIds.value = []
  }
}

async function handleToggleAlbumBookmark(albumId: string) {
  if (!requireLogin()) return
  const isCurrentlyBookmarked = starredAlbumIds.value.includes(albumId)
  try {
    if (isCurrentlyBookmarked) {
      await deleteAlbumBookmark(albumId)
      starredAlbumIds.value = starredAlbumIds.value.filter(id => id !== albumId)
      discoverAlbums.value = discoverAlbums.value.map((item) => {
        if (String(item.id) !== albumId) return item
        return { ...item, bookmark_count: Math.max(0, (item.bookmark_count ?? 0) - 1) }
      })
      return
    }

    await createAlbumBookmark(albumId)
    starredAlbumIds.value.push(albumId)
    discoverAlbums.value = discoverAlbums.value.map((item) => {
      if (String(item.id) !== albumId) return item
      return { ...item, bookmark_count: (item.bookmark_count ?? 0) + 1 }
    })
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

async function fetchMusicHome() {
  musicHomeLoading.value = true
  loading.value = true
  errorMessage.value = ''
  try {
    musicHome.value = await getMusicHome({ page: 1, page_size: 24 })
    discoverPage.value = 1
    applyDiscoverFeed(musicHome.value.discover ?? [])
    void fetchAlbumBookmarks()
    void fetchArtistBookmarks()
    void fetchPlaylistBookmarks()
  } catch (error) {
    reportError(error, 'Failed to fetch music home:')
    musicHome.value = null
    discoverAlbums.value = []
    discoverArtists.value = []
    discoverPlaylists.value = []
    errorMessage.value = '发现内容加载失败'
  } finally {
    musicHomeLoading.value = false
    loading.value = false
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
    cover_url: song.cover_url || song.album?.cover_url || '',
    track_number: song.track_number || 0,
    status: (song.status as Song['status']) || 'approved',
    artists: song.artists?.map((artist) => ({
      id: artist.id,
      name: artist.name,
      username: '',
      email: '',
    })),
  }
}

function playRecentSong(song: MusicSongListItem) {
  const playable = toPlayableSong(song)
  if (playable) player.playSong(playable)
}

function mergeDiscoverByID<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const byID = new Map(current.map((item) => [String(item.id), item]))
  incoming.forEach((item) => byID.set(String(item.id), item))
  return [...byID.values()]
}

function applyDiscoverFeed(items: MusicDiscoverItem[], append = false) {
  const albums = items
      .filter((item) => item.type === 'album')
      .map((item) => ({
        id: item.id,
        title: item.title,
        artists: item.artists,
        year: typeof item.year === 'number' ? item.year : undefined,
        release_date: item.release_date,
        cover_url: item.cover_url || item.image_url,
        description: item.summary,
        reason: item.reason,
        section: item.section,
        play_count: item.play_count,
        bookmark_count: item.bookmark_count,
        entry_status: 'open' as const,
      }))

  const artists = items
    .filter((item) => item.type === 'artist')
    .map((item) => ({
      id: item.id,
      title: item.title || item.name,
      summary: item.summary || item.bio,
      image_url: item.image_url,
      target_path: item.target_path,
      play_count: item.play_count,
      bookmark_count: item.bookmark_count,
      reason: item.reason,
      section: item.section,
    }))

  const playlists = items
    .filter((item) => item.type === 'playlist')
    .map((item) => ({
      id: item.id,
      name: item.title,
      description: item.description || item.summary,
      cover_url: item.cover_url || item.image_url,
      song_count: item.song_count,
      owner_username: item.owner_username,
      is_public: true,
      play_count: item.play_count,
      bookmark_count: item.bookmark_count,
      reason: item.reason,
      section: item.section,
    }))

  discoverAlbums.value = append ? mergeDiscoverByID(discoverAlbums.value, albums) : albums
  discoverArtists.value = append ? mergeDiscoverByID(discoverArtists.value, artists) : artists
  discoverPlaylists.value = append ? mergeDiscoverByID(discoverPlaylists.value, playlists) : playlists
}

async function loadMoreDiscover() {
  if (!musicHome.value?.discover_meta.has_more || discoverLoadingMore.value) return
  discoverLoadingMore.value = true
  try {
    const nextPage = discoverPage.value + 1
    const next = await getMusicHome({ page: nextPage, page_size: musicHome.value.discover_meta.page_size || 24 })
    applyDiscoverFeed(next.discover ?? [], true)
    discoverPage.value = nextPage
    musicHome.value.discover_meta = next.discover_meta
    musicHome.value.discover_has_more = next.discover_has_more
  } catch (error) {
    reportError(error, 'Failed to load more music discovery:')
    errorMessage.value = '更多内容加载失败'
  } finally {
    discoverLoadingMore.value = false
  }
}

async function fetchAlbumIndex() {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await listMusicAlbums({ page: 1, page_size: 2000, sort: 'hot' })
    albumItems.value = response.data ?? []
    void fetchAlbumBookmarks()
  } catch (error) {
    reportError(error, 'Failed to fetch music albums:')
    errorMessage.value = '专辑列表加载失败'
    albumItems.value = []
  } finally {
    loading.value = false
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

  // 对于本地相册全量库模式，由于是本地过滤，我们可以跳过发起远端请求
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
  openMusicCreationFlow()
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
  fetchSearchResults()
})

onMounted(() => {
  if (props.contentMode === 'albums') {
    fetchAlbumIndex()
    return
  }
  fetchMusicHome()
})

watch(
  () => [route.query.artist, route.query.album, route.query.editor, route.query.name],
  () => applyRouteSelection(route.query),
  { immediate: true },
)

watch(
  () => [authStore?.isAuthenticated, authStore?.token, authStore?.user?.uuid],
  () => {
    if (props.contentMode === 'discover') void fetchMusicHome()
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
            :open="searchOpen"
            compact
            eyebrow=""
            overlay-results
            :status="searchLoading ? '搜索中...' : ''"
            placeholder="搜索专辑或艺术家..."
            input-test-id="music-explore-search-input"
            dropdown-test-id="music-explore-search-dropdown"
            :loading="searchLoading"
            :empty="hasSearchQuery && !hasSearchResults ? '没有匹配结果' : ''"
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
                    <span class="search-result__title">{{ artist.name }}</span>
                    <span class="search-result__meta">{{ artist.legal_name || artist.bio || '艺术家' }}</span>
                  </button>
                </section>
              </div>
            </template>
          </SearchSurface>
        </div>
        <div class="filters-row">
          <PSelect v-model="filterYear" :options="yearOptions" aria-label="发行年代" />
          <PSelect v-model="filterGenre" :options="genreOptions" aria-label="流派" />
          <PSelect v-model="filterLanguage" :options="languageOptions" aria-label="语言" />
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

    <div v-if="contentMode === 'discover' && musicHomeLoading" class="state-line">正在加载...</div>
    <template v-if="contentMode === 'discover' && musicHome">
      <section v-if="musicHome.continue_listening?.song" class="music-home-section" aria-labelledby="continue-listening-title">
        <header class="music-home-section__header"><h2 id="continue-listening-title">继续播放</h2></header>
        <div class="recently-played-list">
          <div class="recently-played-item">
            <button type="button" class="recently-played-item__play" :disabled="!musicHome.continue_listening.song.audio_url" :aria-label="`播放 ${musicHome.continue_listening.song.title}`" @click="playRecentSong(musicHome.continue_listening.song)">
              <img v-if="musicHome.continue_listening.song.cover_url || musicHome.continue_listening.song.album?.cover_url" :src="musicHome.continue_listening.song.cover_url || musicHome.continue_listening.song.album?.cover_url" :alt="musicHome.continue_listening.song.title" />
              <span v-else class="recently-played-item__cover" aria-hidden="true" />
            </button>
            <span class="recently-played-item__copy"><RouterLink :to="`/music/song/${musicHome.continue_listening.song.id}`"><strong>{{ musicHome.continue_listening.song.title }}</strong></RouterLink></span>
          </div>
        </div>
      </section>
      <section v-if="musicHome.personalized && musicHome.recently_played.length" class="music-home-section" aria-labelledby="recently-played-title">
        <header class="music-home-section__header">
          <h2 id="recently-played-title">最近播放</h2>
        </header>
        <div class="recently-played-list">
          <div
            v-for="item in musicHome.recently_played"
            :key="item.id"
            class="recently-played-item"
          >
            <button type="button" class="recently-played-item__play" :disabled="!item.song.audio_url" :aria-label="`播放 ${item.song.title}`" data-testid="recent-song-play" @click="playRecentSong(item.song)">
              <img v-if="item.song.cover_url || item.song.album?.cover_url" :src="item.song.cover_url || item.song.album?.cover_url" :alt="item.song.title" />
              <span v-else class="recently-played-item__cover" aria-hidden="true" />
            </button>
            <span class="recently-played-item__copy">
              <RouterLink :to="`/music/song/${item.song.id}`"><strong>{{ item.song.title }}</strong></RouterLink>
              <span class="recently-played-item__links">
                <template v-if="item.song.artists?.length">
                  <template v-for="(artist, index) in item.song.artists" :key="artist.id">
                    <span v-if="index" aria-hidden="true"> / </span>
                    <button type="button" :data-testid="`recent-song-artist-${artist.id}`" @click="openArtist(String(artist.id))">{{ artist.name }}</button>
                  </template>
                </template>
                <span v-else>未知艺术家</span>
                <template v-if="item.song.album?.id"><span aria-hidden="true"> · </span><button type="button" :data-testid="`recent-song-album-${item.song.album.id}`" @click="openAlbum(String(item.song.album.id))">{{ item.song.album.title }}</button></template>
              </span>
            </span>
          </div>
        </div>
      </section>

      <section v-if="musicHome.personalized && musicHome.for_you.length" class="music-home-section" aria-labelledby="for-you-title">
        <header class="music-home-section__header">
          <h2 id="for-you-title">为你发现</h2>
        </header>
        <div class="music-home-albums">
          <MusicAlbumCard
            v-for="album in musicHome.for_you"
            :key="album.id"
            :album="album"
            :show-bookmark="false"
            @click="openAlbum(String(album.id))"
            @click-artist="openArtist"
          />
        </div>
        <p v-if="musicHome.for_you_reason" class="music-home-section__reason">{{ musicHome.for_you_reason }}</p>
      </section>

      <section v-for="section in musicHome.sections" :key="section.key" class="music-home-section" :aria-labelledby="`home-${section.key}`">
        <header class="music-home-section__header"><h2 :id="`home-${section.key}`">{{ section.title }}</h2></header>
        <div class="music-home-albums">
          <MusicAlbumCard
            v-for="album in section.albums"
            :key="album.id"
            :album="album"
            :show-bookmark="false"
            @click="openAlbum(String(album.id))"
            @click-artist="openArtist"
          />
        </div>
      </section>
    </template>

    <p v-if="errorMessage" class="state-line state-line--error">{{ errorMessage }}</p>
    <p v-else-if="loading" class="state-line">正在加载...</p>
    <p v-else-if="contentMode === 'albums' && !localFilteredAlbums.length" class="state-line">暂无专辑</p>
    <p v-else-if="contentMode === 'discover' && !discoverAlbums.length && !discoverPlaylists.length && !discoverArtists.length && !musicHome?.sections.length && !musicHome?.for_you.length && !musicHome?.recently_played.length" class="state-line">暂无发现内容</p>

    <div v-else-if="contentMode === 'albums'" class="discover-grid" aria-label="专辑列表">
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

    <div v-else class="discover-sections" aria-label="发现分区">
      <section v-if="discoverAlbums.length" class="discover-section">
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
      </section>
      <PButton v-if="musicHome?.discover_meta.has_more" variant="secondary" :disabled="discoverLoadingMore" class="discover-load-more" @click="loadMoreDiscover">{{ discoverLoadingMore ? '加载中' : '加载更多' }}</PButton>
    </div>
  </section>
</template>

<style scoped>
.music-explore-view {
  display: flex;
  flex-direction: column;
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

.filters-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 0 0 auto;
}

.filters-row :deep(.p-field) {
  flex: 0 0 7rem;
  min-width: 7rem;
}

.filters-row :deep(.p-select-trigger) {
  gap: 0.5rem;
  white-space: nowrap;
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
}

.recently-played-item:hover,
.recently-played-item:focus-visible {
  border-color: var(--a-color-muted-soft);
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
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.recently-played-item__copy strong,
.recently-played-item__copy span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recently-played-item__copy strong {
  font-size: 0.86rem;
}

.recently-played-item__copy span {
  color: var(--a-color-muted);
  font-size: 0.75rem;
}

.recently-played-item__copy > a {
  color: inherit;
  text-decoration: none;
}

.recently-played-item__links button {
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.recently-played-item__copy > a:hover,
.recently-played-item__links button:hover {
  text-decoration: underline;
}

.music-home-albums {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}

.discover-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
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

.discover-layout--playlists {
  grid-template-columns: repeat(6, minmax(0, 1fr));
}

.discover-layout--artists {
  grid-template-columns: repeat(6, minmax(0, 1fr));
}

@media (max-width: 1100px) {
  .discover-layout--albums,
  .discover-layout--playlists,
  .discover-layout--artists {
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

  .filters-row {
    flex-wrap: wrap;
  }

  .filters-row :deep(.p-field) {
    flex: 1 1 8rem;
    min-width: 0;
  }

  .search-shell.is-open :deep(.search-frame) {
    width: 100%;
  }

  .discover-layout--albums,
  .discover-layout--playlists,
  .discover-layout--artists {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .recently-played-list,
  .music-home-albums {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
