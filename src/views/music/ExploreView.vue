<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import SearchSurface from '@/components/search/SearchSurface.vue'
import {
  createAlbumBookmark,
  deleteAlbumBookmark,
  listAlbumBookmarks,
  listMusicAlbums,
  listMusicArtists,
  listMusicDiscoverFeed,
  type MusicAlbumListItem,
  type MusicArtistListItem,
  type MusicDiscoverAlbumItem,
  type MusicDiscoverArtistItem,
  type MusicDiscoverItem,
  type MusicDiscoverPlaylistItem,
} from '@/api/musicV1'
import { MusicAlbumCard, MusicArtistCard, MusicPlaylistCard } from '@/components/music'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

withDefaults(defineProps<{
  pageTitle?: string
}>(), {
  pageTitle: '发现',
})

const router = useRouter()
const { openPlaylist } = useMusicDrawers()
const loading = ref(false)
const errorMessage = ref('')
const discoverItems = ref<MusicDiscoverItem[]>([])
const searchQuery = ref('')
const searchOpen = ref(false)
const searchLoading = ref(false)
const searchAlbums = ref<MusicAlbumListItem[]>([])
const searchArtists = ref<MusicArtistListItem[]>([])
let activeSearchRequestId = 0

const starredAlbumIds = ref<string[]>([])

async function fetchAlbumBookmarks() {
  try {
    const response = await listAlbumBookmarks()
    starredAlbumIds.value = response.data.map((b: any) => String(b.album_id))
  } catch (e) {
    console.error('Failed to fetch album bookmarks:', e)
  }
}

async function handleToggleAlbumBookmark(albumId: string) {
  const isCurrentlyBookmarked = starredAlbumIds.value.includes(albumId)
  try {
    if (isCurrentlyBookmarked) {
      await deleteAlbumBookmark(albumId)
      starredAlbumIds.value = starredAlbumIds.value.filter(id => id !== albumId)
      discoverItems.value = discoverItems.value.map((item) => {
        if (item.type !== 'album' || String(item.id) !== albumId) return item
        return { ...item, bookmark_count: Math.max(0, (item.bookmark_count ?? 0) - 1) }
      })
      return
    }

    await createAlbumBookmark(albumId)
    starredAlbumIds.value.push(albumId)
    discoverItems.value = discoverItems.value.map((item) => {
      if (item.type !== 'album' || String(item.id) !== albumId) return item
      return { ...item, bookmark_count: (item.bookmark_count ?? 0) + 1 }
    })
  } catch (e) {
    console.error('Failed to toggle album bookmark:', e)
  }
}

async function fetchDiscoverFeed() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [response] = await Promise.all([listMusicDiscoverFeed(), fetchAlbumBookmarks()])
    discoverItems.value = response.data ?? []
  } catch (error) {
    console.error('Failed to fetch music discover feed:', error)
    errorMessage.value = '发现内容加载失败'
    discoverItems.value = []
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

function openDiscoverItem(item: MusicDiscoverItem) {
  if (item.type === 'playlist') {
    openPlaylist(String(item.id))
    return
  }
  router.push(item.target_path)
}

function discoverItemTestId(item: MusicDiscoverItem) {
  if (item.type === 'album') return 'discover-album-card'
  if (item.type === 'artist') return 'discover-artist-card'
  return 'discover-playlist-card'
}

function albumCardItem(item: MusicDiscoverAlbumItem) {
  return {
    ...item,
    cover_url: item.cover_url || item.image_url,
  }
}

function artistCardItem(item: MusicDiscoverArtistItem) {
  return {
    ...item,
    name: item.name || item.title,
    bio: item.bio || item.summary,
  }
}

function playlistCardItem(item: MusicDiscoverPlaylistItem) {
  return {
    ...item,
    description: item.description || item.summary,
    cover_url: item.cover_url || item.image_url,
  }
}

function openAlbumResult(album: MusicAlbumListItem) {
  searchOpen.value = false
  searchQuery.value = ''
  router.push(`/music?album=${album.id}`)
}

function openArtistResult(artist: MusicArtistListItem) {
  searchOpen.value = false
  searchQuery.value = ''
  router.push(`/music?artist=${artist.id}`)
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
    <p v-else-if="!discoverItems.length" class="state-line">暂无发现内容</p>

    <div v-else class="discover-grid" aria-label="发现流列表">
      <template v-for="item in discoverItems" :key="`${item.type}-${item.id}`">
        <MusicAlbumCard
          v-if="item.type === 'album'"
          :album="albumCardItem(item)"
          :is-bookmarked="starredAlbumIds.includes(String(item.id))"
          :data-testid="discoverItemTestId(item)"
          @click="openDiscoverItem(item)"
          @toggle-bookmark="handleToggleAlbumBookmark(String(item.id))"
        />

        <MusicArtistCard
          v-else-if="item.type === 'artist'"
          :artist="artistCardItem(item)"
          :show-bookmark-button="false"
          :data-testid="discoverItemTestId(item)"
          @click="openDiscoverItem(item)"
        />

        <MusicPlaylistCard
          v-else
          :playlist="playlistCardItem(item)"
          :data-testid="discoverItemTestId(item)"
          @click="openDiscoverItem(item)"
        />
      </template>
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
  font-weight: 900;
  letter-spacing: 0.12em;
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
  font-weight: 800;
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
}
</style>
