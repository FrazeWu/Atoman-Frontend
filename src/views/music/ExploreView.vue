<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import SearchSurface from '@/components/search/SearchSurface.vue'
import {
  listMusicAlbums,
  listMusicArtists,
  listRecommendedAlbums,
  type MusicAlbumListItem,
  type MusicArtistListItem,
  type MusicRecommendationItem,
  type MusicRecommendationMode,
} from '@/api/musicV1'

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

const modeOptions: Array<{ label: string; value: MusicRecommendationMode }> = [
  { label: '热度', value: 'hot' },
  { label: '精选', value: 'featured' },
  { label: '探索', value: 'discover' },
]

async function fetchRecommendations() {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await listRecommendedAlbums(mode.value)
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
      >
        <template #action>
          <div class="mode-tabs" aria-label="音乐推荐模式">
            <PSegmentedControl
              v-model="mode"
              :options="modeOptions"
            />
          </div>
        </template>
      </PPageHeader>
    </header>

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

    <p v-if="errorMessage" class="state-line state-line--error">{{ errorMessage }}</p>
    <p v-else-if="loading" class="state-line">正在加载...</p>
    <p v-else-if="!albums.length" class="state-line">暂无推荐专辑</p>

    <div v-else class="index-grid" aria-label="推荐专辑列表">
      <RouterLink
        v-for="album in albums"
        :key="album.id"
        :to="album.target_path"
        class="music-card"
        data-testid="recommended-album-card"
      >
        <!-- Thumbnail -->
        <div class="cover-frame">
          <img v-if="album.image_url" :src="album.image_url" :alt="album.title" class="cover-image" loading="lazy" />
          <div v-else class="cover-placeholder">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" style="opacity:0.25">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.48 0-4.5-2.02-4.5-4.5s2.02-4.5 4.5-4.5 4.5 2.02 4.5 4.5-2.02 4.5-4.5 4.5z"/>
            </svg>
          </div>
          
          <!-- Overlays -->
          <div v-if="album.score_label" class="score-overlay">
            <span>{{ album.score_label }}</span>
          </div>
        </div>

        <!-- Info row: avatar + text -->
        <div class="music-info">
          <div class="music-avatar" aria-hidden="true">
            <span>💿</span>
          </div>
          <div class="music-text">
            <h3 class="music-title a-clamp-1">{{ album.title }}</h3>
            <p v-if="album.summary" class="music-summary a-clamp-2">{{ album.summary }}</p>
          </div>
        </div>
      </RouterLink>
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
  max-width: 900px;
}

.search-shell {
  position: relative;
  max-width: 28rem;
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
  grid-template-columns: repeat(auto-fill, minmax(11.5rem, 1fr));
  gap: 1rem;
  margin-top: 1.5rem;
}

.music-card {
  display: block;
  text-decoration: none;
  color: inherit;
  border: none;
}

/* Cover Image */
.cover-frame {
  position: relative;
  aspect-ratio: 1 / 1;
  background: var(--a-color-surface);
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--a-color-line-soft);
}

.music-card:hover .cover-image {
  transform: scale(1.03);
}

.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.2s ease;
  display: block;
}

.cover-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-muted);
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.04), rgba(0, 0, 0, 0.08));
}

/* Score Overlay */
.score-overlay {
  position: absolute;
  bottom: 8px;
  left: 8px;
  z-index: 1;
}

.score-overlay span {
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 6px;
  letter-spacing: 0.02em;
}

/* Info */
.music-info {
  display: flex;
  gap: 10px;
  padding: 10px 0 0;
}

.music-avatar {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--a-color-surface);
  border: 1px solid var(--a-color-line-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
}

.music-text {
  min-width: 0;
  flex: 1;
}

.music-title {
  font-size: 0.95rem;
  font-weight: 800;
  line-height: 1.35;
  color: var(--a-color-fg);
  margin: 0 0 0.25rem 0;
  transition: color 0.2s;
}

.music-card:hover .music-title {
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}

.music-summary {
  margin: 0;
  color: var(--a-color-muted-soft);
  line-height: 1.4;
  font-size: 0.775rem;
}

@media (max-width: 720px) {
  .search-shell,
  .search-shell.is-open {
    max-width: 100%;
  }

  .search-shell.is-open :deep(.search-frame) {
    width: 100%;
  }
}
</style>
