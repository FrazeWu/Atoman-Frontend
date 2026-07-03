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
  listRecommendedAlbums,
  type MusicAlbumListItem,
  type MusicArtistListItem,
  type MusicRecommendationItem,
  type MusicRecommendationMode,
} from '@/api/musicV1'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import { MUSIC_RECOMMENDATION_MODE_OPTIONS } from '@/utils/musicRecommendations'
import { MusicAlbumCard } from '@/components/music'

const router = useRouter()
const mode = ref<MusicRecommendationMode>('hot')
const loading = ref(false)
const errorMessage = ref('')
const albums = ref<MusicRecommendationItem[]>([])
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
    } else {
      await createAlbumBookmark(albumId)
      starredAlbumIds.value.push(albumId)
    }
  } catch (e) {
    console.error('Failed to toggle album bookmark:', e)
  }
}

async function fetchRecommendations() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [response] = await Promise.all([listRecommendedAlbums(mode.value), fetchAlbumBookmarks()])
    albums.value = response.data
  } catch (error) {
    console.error('Failed to fetch music recommendations:', error)
    errorMessage.value = '推荐专辑加载失败'
    albums.value = []
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


function openAlbum(item: MusicRecommendationItem) {
  router.push(item.target_path)
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

watch(mode, () => {
  fetchRecommendations()
})

watch(searchQuery, () => {
  fetchSearchResults()
})

onMounted(() => {
  fetchRecommendations()
})

const hasSearchQuery = computed(() => searchQuery.value.trim().length > 0)
const hasSearchResults = computed(() => searchAlbums.value.length > 0 || searchArtists.value.length > 0)
</script>

<template>
  <section class="music-explore-view">
    <header class="page-header">
      <PPageHeader
        title="探索"
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
      <div class="toolbar-right">
        <div class="recommendation-tabs" aria-label="推荐模式">
          <PSegmentedControl
            v-model="mode"
            :options="MUSIC_RECOMMENDATION_MODE_OPTIONS"
          />
        </div>
      </div>
    </div>

    <p v-if="errorMessage" class="state-line state-line--error">{{ errorMessage }}</p>
    <p v-else-if="loading" class="state-line">正在加载...</p>
    <p v-else-if="!albums.length" class="state-line">暂无推荐专辑</p>

    <div v-else class="index-grid" aria-label="推荐专辑列表">
      <MusicAlbumCard
        v-for="album in albums"
        :key="album.id"
        :album="album"
        :is-bookmarked="starredAlbumIds.includes(String(album.id))"
        data-testid="recommended-album-card"
        @click="router.push(album.target_path)"
        @toggle-bookmark="handleToggleAlbumBookmark(String(album.id))"
      />
    </div>
  </section>
</template>

<style scoped>
.music-explore-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.page-header {
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

.toolbar-right {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
}

.search-shell {
  position: relative;
  max-width: 28rem;
  flex: 0 1 28rem;
}

.recommendation-tabs {
  display: flex;
  justify-content: flex-end;
}

.search-shell.is-open {
  z-index: 15;
}

.search-shell.is-open :deep(.search-frame) {
  position: absolute;
  inset: 0 auto auto 0;
  width: 40rem;
}

.search-dropdown {
  max-width: 34rem;
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

.mode-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.state-line {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 1rem;
}

.state-line--error {
  color: #8a2f2f;
}

.index-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
  gap: 1.25rem;
  margin-top: 1.5rem;
}

/* Unused card styles removed, handled by MusicAlbumCard.vue */

@media (max-width: 720px) {
  .toolbar-row,
  .toolbar-left,
  .toolbar-right {
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

  .recommendation-tabs {
    min-width: 0;
    max-width: 100%;
  }
}
</style>
