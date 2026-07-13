<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import SearchSurface from '@/components/search/SearchSurface.vue'
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
  listMusicDiscoverFeed,
  listMusicAlbums,
  listMusicArtists,
  type MusicDiscoverItem,
  type MusicAlbumListItem,
  type MusicArtistListItem,
  type MusicPlaylistSummary,
  type MusicRecommendationItem,
} from '@/api/musicV1'
import { MusicAlbumCard, MusicArtistCard, MusicPlaylistCard } from '@/components/music'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

const props = withDefaults(defineProps<{
  pageTitle?: string
  contentMode?: 'discover' | 'albums'
}>(), {
  pageTitle: '发现',
  contentMode: 'discover',
})

const router = useRouter()
const { openAlbum, openArtist } = useMusicDrawers()
const loading = ref(false)
const errorMessage = ref('')
const discoverAlbums = ref<MusicAlbumListItem[]>([])
const discoverArtists = ref<MusicRecommendationItem[]>([])
const discoverPlaylists = ref<MusicPlaylistSummary[]>([])
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

async function fetchAlbumBookmarks() {
  try {
    const response = await listAlbumBookmarks()
    starredAlbumIds.value = response.data.map((b: any) => String(b.album_id))
  } catch (e) {
    console.error('Failed to fetch album bookmarks:', e)
  }
}

async function fetchArtistBookmarks() {
  try {
    const response = await listArtistBookmarks()
    starredArtistIds.value = response.data.map((b: any) => String(b.artist_id))
  } catch (e) {
    console.error('Failed to fetch artist bookmarks:', e)
  }
}

async function fetchPlaylistBookmarks() {
  try {
    const response = await listPlaylistBookmarks()
    starredPlaylistIds.value = response.data.map((b: any) => String(b.playlist_id))
  } catch (e) {
    console.error('Failed to fetch playlist bookmarks:', e)
  }
}

async function handleToggleAlbumBookmark(albumId: string) {
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
    console.error('Failed to toggle album bookmark:', e)
  }
}

async function handleToggleArtistBookmark(artistId: string) {
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
    console.error('Failed to toggle artist bookmark:', e)
  }
}

async function handleTogglePlaylistBookmark(playlistId: string) {
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
    console.error('Failed to toggle playlist bookmark:', e)
  }
}

async function fetchDiscoverFeed() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [feedResponse] = await Promise.all([
      listMusicDiscoverFeed(),
      fetchAlbumBookmarks(),
      fetchArtistBookmarks(),
      fetchPlaylistBookmarks(),
    ])
    applyDiscoverFeed(feedResponse.data ?? [])
  } catch (error) {
    console.error('Failed to fetch music discover feed:', error)
    errorMessage.value = '发现内容加载失败'
    discoverAlbums.value = []
    discoverArtists.value = []
    discoverPlaylists.value = []
  } finally {
    loading.value = false
  }
}

function applyDiscoverFeed(items: MusicDiscoverItem[]) {
  discoverAlbums.value = items
    .filter((item) => item.type === 'album')
    .map((item) => ({
      id: item.id,
      title: item.title,
      artists: item.artists,
      year: typeof item.year === 'number' ? item.year : undefined,
      release_date: item.release_date,
      cover_url: item.cover_url || item.image_url,
      description: item.summary,
      play_count: item.play_count,
      bookmark_count: item.bookmark_count,
      entry_status: 'open',
    }))

  discoverArtists.value = items
    .filter((item) => item.type === 'artist')
    .map((item) => ({
      id: item.id,
      title: item.title || item.name,
      summary: item.summary || item.bio,
      image_url: item.image_url,
      target_path: item.target_path,
      play_count: item.play_count,
      bookmark_count: item.bookmark_count,
    }))

  discoverPlaylists.value = items
    .filter((item) => item.type === 'playlist')
    .map((item) => ({
      id: item.id,
      name: item.title,
      description: item.description || item.summary,
      cover_url: item.cover_url || item.image_url,
      song_count: item.song_count,
      owner_username: item.owner_username,
      play_count: item.play_count,
      bookmark_count: item.bookmark_count,
    }))
}

async function fetchAlbumIndex() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [response] = await Promise.all([
      listMusicAlbums({ page: 1, page_size: 48, sort: 'hot' }),
      fetchAlbumBookmarks(),
    ])
    albumItems.value = response.data
  } catch (error) {
    console.error('Failed to fetch music albums:', error)
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
    console.error('Failed to search music explore entities:', error)
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
  fetchDiscoverFeed()
})

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
      </div>
    </div>

    <p v-if="errorMessage" class="state-line state-line--error">{{ errorMessage }}</p>
    <p v-else-if="loading" class="state-line">正在加载...</p>
    <p v-else-if="contentMode === 'albums' && !albumItems.length" class="state-line">暂无专辑</p>
    <p v-else-if="contentMode === 'discover' && !discoverAlbums.length && !discoverPlaylists.length && !discoverArtists.length" class="state-line">暂无发现内容</p>

    <div v-else-if="contentMode === 'albums'" class="discover-grid" aria-label="专辑列表">
      <MusicAlbumCard
        v-for="album in albumItems"
        :key="album.id"
        :album="album"
        :is-bookmarked="starredAlbumIds.includes(String(album.id))"
        data-testid="discover-album-card"
        @click="router.push(`/music/album/${album.id}`)"
        @toggle-bookmark="handleToggleAlbumBookmark(String(album.id))"
      />
    </div>

    <div v-else class="discover-sections" aria-label="发现分区">
      <section v-if="discoverAlbums.length" class="discover-section">
        <div class="discover-section__header">
          <h2 class="discover-section__title" data-testid="discover-section-title">专辑</h2>
        </div>
        <div class="discover-layout discover-layout--albums" aria-label="发现专辑分区">
          <MusicAlbumCard
            v-for="item in discoverAlbums"
            :key="item.id"
            class="discover-layout__item"
            :album="item"
            :is-bookmarked="starredAlbumIds.includes(String(item.id))"
            data-testid="discover-album-card"
            @click="openDiscoverAlbum(item)"
            @toggle-bookmark="handleToggleAlbumBookmark(String(item.id))"
          />
        </div>
      </section>

      <section class="discover-section">
        <div class="discover-section__header">
          <h2 class="discover-section__title" data-testid="discover-section-title">歌单</h2>
        </div>
        <div class="discover-layout discover-layout--playlists" aria-label="发现歌单分区">
          <template v-if="discoverPlaylists.length">
            <MusicPlaylistCard
              v-for="item in discoverPlaylists"
              :key="item.id"
              class="discover-layout__item"
              :playlist="playlistCardItem(item)"
              :is-bookmarked="starredPlaylistIds.includes(String(item.id))"
              data-testid="discover-playlist-card"
              @click="openDiscoverPlaylist(item)"
              @toggle-bookmark="handleTogglePlaylistBookmark(String(item.id))"
            />
          </template>
          <template v-else>
            <article
              class="discover-layout__item discover-layout__playlist-placeholder"
              data-testid="discover-playlist-placeholder"
            >
              <p class="discover-placeholder__eyebrow">Playlist</p>
              <h3 class="discover-placeholder__title">暂无公开歌单</h3>
              <p class="discover-placeholder__copy">这里会保留歌单高块结构，等公开歌单接入后直接落位。</p>
            </article>
            <article
              class="discover-layout__item discover-layout__playlist-placeholder"
              data-testid="discover-playlist-placeholder"
            >
              <p class="discover-placeholder__eyebrow">Playlist</p>
              <h3 class="discover-placeholder__title discover-placeholder__title--compact">留给精选歌单</h3>
            </article>
            <article
              class="discover-layout__item discover-layout__playlist-placeholder"
              data-testid="discover-playlist-placeholder"
            >
              <p class="discover-placeholder__eyebrow">Playlist</p>
              <h3 class="discover-placeholder__title discover-placeholder__title--compact">留给场景歌单</h3>
            </article>
          </template>
        </div>
      </section>

      <section v-if="discoverArtists.length" class="discover-section">
        <div class="discover-section__header">
          <h2 class="discover-section__title" data-testid="discover-section-title">艺人</h2>
        </div>
        <div class="discover-layout discover-layout--artists" aria-label="发现艺人分区">
          <MusicArtistCard
            v-for="item in discoverArtists"
            :key="item.id"
            class="discover-layout__item discover-layout__item--artist"
            :artist="artistCardItem(item)"
            :is-bookmarked="starredArtistIds.includes(String(item.id))"
            data-testid="discover-artist-card"
            @click="openDiscoverArtist(item)"
            @toggle-bookmark="handleToggleArtistBookmark(String(item.id))"
          />
        </div>
      </section>
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
}

.search-shell {
  position: relative;
  max-width: 28rem;
  flex: 0 1 28rem;
  height: 36px;
}

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
  border-top: 1px solid var(--a-color-line-soft);
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
  background: color-mix(in srgb, var(--a-color-paper) 58%, var(--a-color-paper-wash) 42%);
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.discover-layout--playlists {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.discover-layout--artists {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.discover-layout__item {
  min-width: 0;
}

.discover-layout__playlist-placeholder {
  min-height: 13rem;
  padding: 1rem;
  border: 1px solid var(--a-color-line-soft);
  border-radius: 18px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--a-color-paper) 86%, var(--a-color-paper-wash) 14%), var(--a-color-paper));
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
    max-width: 100%;
  }

  .search-shell.is-open :deep(.search-frame) {
    width: 100%;
  }

  .discover-layout--albums,
  .discover-layout--playlists,
  .discover-layout--artists {
    grid-template-columns: 1fr;
  }

}
</style>
