<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ApiErrorResponseError } from '@/api/client'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import {
  createArtistBookmark,
  deleteArtistBookmark,
  getMusicArtist,
  listArtistBookmarks,
  listMusicArtists,
  listRecommendedArtists,
  type MusicArtistBookmark,
  type MusicArtistListItem,
  type MusicRecommendationMode,
} from '@/api/musicV1'
import { MusicArtistCard } from '@/components/music'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import SearchSurface from '@/components/search/SearchSurface.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import { useMusicRouteSelection } from '@/composables/useMusicRouteSelection'
import {
  filterArtistRecommendationsByBookmarks,
  MUSIC_RECOMMENDATION_MODE_OPTIONS,
} from '@/utils/musicRecommendations'

type ArtistFilterTab = 'all' | 'subscribed'
const activeTab = ref<ArtistFilterTab>('all')
const recommendationMode = ref<MusicRecommendationMode>('hot')

const tabOptions = [
  { label: '全部', value: 'all' },
  { label: '已订阅', value: 'subscribed' },
]

const route = useRoute()
const {
  isMainShifted,
  openAlbum,
  closeAlbum,
  openArtist,
  closeArtist,
  openMusicCreationFlow,
  closeMusicCreationFlow,
  openMusicEditor,
  closeMusicEditor,
} = useMusicDrawers()

const artists = ref<MusicArtistListItem[]>([])
const searchResults = ref<MusicArtistListItem[]>([])
const searchQuery = ref('')
const loading = ref(false)
const searchLoading = ref(false)
const errorMessage = ref('')
const showSearchDropdown = ref(false)
let activeRequestId = 0
let activeSearchRequestId = 0

const starredArtistIds = ref<string[]>([])
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

async function fetchBookmarks() {
  try {
    const response = await listArtistBookmarks()
    starredArtistIds.value = response.data.map((b: any) => String(b.artist_id))
  } catch (e) {
    if (e instanceof ApiErrorResponseError && e.status === 401) {
      starredArtistIds.value = []
      return
    }
    console.error('Failed to fetch bookmarks:', e)
  }
}

async function handleToggleBookmark(artistId: string) {
  const isCurrentlyBookmarked = starredArtistIds.value.includes(artistId)
  try {
    if (isCurrentlyBookmarked) {
      await deleteArtistBookmark(artistId)
      starredArtistIds.value = starredArtistIds.value.filter(id => id !== artistId)
      artists.value = artists.value.map((artist) => (
        String(artist.id) === artistId
          ? { ...artist, bookmark_count: Math.max(0, (artist.bookmark_count ?? 0) - 1) }
          : artist
      ))
      searchResults.value = searchResults.value.map((artist) => (
        String(artist.id) === artistId
          ? { ...artist, bookmark_count: Math.max(0, (artist.bookmark_count ?? 0) - 1) }
          : artist
      ))
      if (activeTab.value === 'subscribed') {
        artists.value = artists.value.filter(a => String(a.id) !== artistId)
      }
    } else {
      await createArtistBookmark(artistId)
      starredArtistIds.value.push(artistId)
      artists.value = artists.value.map((artist) => (
        String(artist.id) === artistId
          ? { ...artist, bookmark_count: (artist.bookmark_count ?? 0) + 1 }
          : artist
      ))
      searchResults.value = searchResults.value.map((artist) => (
        String(artist.id) === artistId
          ? { ...artist, bookmark_count: (artist.bookmark_count ?? 0) + 1 }
          : artist
      ))
    }
  } catch (e) {
    console.error('Failed to toggle bookmark:', e)
  }
}

async function fetchArtists() {
  const requestId = ++activeRequestId
  loading.value = true
  errorMessage.value = ''

  try {
    await fetchBookmarks()
    if (requestId !== activeRequestId) return

    if (searchQuery.value.trim()) {
      const response = await listMusicArtists({
        q: searchQuery.value.trim(),
        page: 1,
        page_size: 48,
      })
      if (requestId !== activeRequestId) return
      artists.value = response.data
      return
    }

    const recommendedResponse = await listRecommendedArtists(recommendationMode.value)
    if (requestId !== activeRequestId) return

    let filteredRecommendations = recommendedResponse.data
    if (activeTab.value === 'subscribed') {
      filteredRecommendations = filterArtistRecommendationsByBookmarks(
        recommendedResponse.data,
        starredArtistIds.value.map((artistId) => ({ artist_id: artistId })) as MusicArtistBookmark[],
      )
    }

    const detailResults = await Promise.all(
      filteredRecommendations.map((item) => getMusicArtist(item.id).catch(() => null)),
    )
    if (requestId !== activeRequestId) return
    artists.value = detailResults.filter(Boolean) as MusicArtistListItem[]
  } catch (e) {
    if (requestId !== activeRequestId) return
    console.error('Failed to fetch music artists:', e)
    errorMessage.value = '艺术家列表加载失败'
    artists.value = []
  } finally {
    if (requestId === activeRequestId) {
      loading.value = false
    }
  }
}

watch(activeTab, () => {
  fetchArtists()
})

watch(recommendationMode, () => {
  fetchArtists()
})

async function fetchSearchResults() {
  const query = searchQuery.value.trim()
  const requestId = ++activeSearchRequestId

  if (!query) {
    searchResults.value = []
    searchLoading.value = false
    return
  }

  searchLoading.value = true
  try {
    const response = await listMusicArtists({
      q: query,
      page: 1,
      page_size: 20,
    })
    if (requestId !== activeSearchRequestId) return
    searchResults.value = response.data
  } catch (e) {
    if (requestId !== activeSearchRequestId) return
    console.error('Failed to search music artists:', e)
    searchResults.value = []
  } finally {
    if (requestId === activeSearchRequestId) {
      searchLoading.value = false
    }
  }
}

function openArtistCard(artistId: string) {
  openArtist(String(artistId))
  showSearchDropdown.value = false
  searchQuery.value = ''
}

onMounted(() => {
  if (typeof route.query.q === 'string' && route.query.q.trim()) {
    searchQuery.value = route.query.q.trim()
  }
  fetchArtists()
  fetchSearchResults()
  applyRouteSelection(route.query)
})

watch(searchQuery, () => {
  fetchSearchResults()
  fetchArtists()
})

watch(
  () => [route.query.artist, route.query.album, route.query.q],
  () => {
    const routeQuery = typeof route.query.q === 'string' ? route.query.q.trim() : ''
    if (routeQuery !== searchQuery.value) {
      searchQuery.value = routeQuery
    }
    applyRouteSelection(route.query)
  },
)

const hasSearchQuery = computed(() => searchQuery.value.trim().length > 0)

function handleSearchFocus() {
  showSearchDropdown.value = true
}

function handleSearchBlur() {
  window.setTimeout(() => {
    showSearchDropdown.value = false
  }, 120)
}
</script>

<template>
  <div class="music-base-view">
    <div class="main-level-1" :class="{ 'is-shifted': isMainShifted }">
      <div class="page-header">
        <PPageHeader
          title="艺术家"
          mb="0"
        >
          <template #action>
            <div class="mode-tabs" aria-label="艺术家列表模式">
              <PSegmentedControl
                v-model="activeTab"
                :options="tabOptions"
              />
            </div>
          </template>
        </PPageHeader>
      </div>

      <div class="toolbar-row">
        <div class="toolbar-left">
          <div class="search-shell" :class="{ 'is-open': showSearchDropdown }">
            <SearchSurface
              v-model:query="searchQuery"
              :open="showSearchDropdown"
              compact
              eyebrow=""
              overlay-results
              :status="searchLoading ? '搜索中...' : ''"
              placeholder="搜索艺术家..."
              input-test-id="music-search-input"
              dropdown-test-id="music-search-dropdown"
              :loading="searchLoading"
              :empty="hasSearchQuery && !searchResults.length ? '没有匹配的艺术家' : ''"
              @focus="handleSearchFocus"
              @blur="handleSearchBlur"
            >
              <template #results>
                <div class="search-dropdown__list">
                  <button
                    v-for="artist in searchResults"
                    :key="artist.id"
                    type="button"
                    class="search-dropdown__item"
                    data-testid="music-search-result"
                    @mousedown.prevent="openArtistCard(artist.id)"
                  >
                    <span class="search-dropdown__item-title">{{ artist.name }}</span>
                    <span class="search-dropdown__item-meta">{{ artist.legal_name || artist.bio || '艺术家' }}</span>
                  </button>
                </div>
              </template>
            </SearchSurface>
          </div>
          <button class="ui-action search-side-action" type="button" @click="openMusicCreationFlow()">
            <span class="action-indicator" aria-hidden="true" />
            添加艺术家
          </button>
        </div>
        <div class="toolbar-right">
          <div class="recommendation-tabs" aria-label="艺术家推荐模式">
            <PSegmentedControl
              v-model="recommendationMode"
              :options="MUSIC_RECOMMENDATION_MODE_OPTIONS"
            />
          </div>
        </div>
      </div>

      <p v-if="errorMessage" class="state-line state-line--error">{{ errorMessage }}</p>
      <p v-else-if="loading" class="state-line">正在加载艺术家...</p>

      <div v-else-if="!artists.length" class="empty-state">
        <p class="state-line">{{ activeTab === 'subscribed' ? '暂无订阅的艺术家' : '没有匹配的艺术家' }}</p>
        <div class="empty-actions">
          <button
            class="ui-action"
            type="button"
            data-testid="empty-add-artist"
            @click="openMusicCreationFlow()"
          >
            <span class="action-indicator" aria-hidden="true" />
            添加艺术家
          </button>
        </div>
      </div>

      <div v-else class="artist-results-grid">
        <MusicArtistCard
          v-for="artist in artists"
          :key="artist.id"
          :artist="artist"
          :is-bookmarked="starredArtistIds.includes(String(artist.id))"
          data-testid="artist-card"
          @click="openArtistCard(artist.id)"
          @toggle-bookmark="handleToggleBookmark(String(artist.id))"
        />
      </div>
    </div>

  </div>
</template>

<style scoped>
.music-base-view { position: relative; }
.main-level-1 {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s;
}
.main-level-1.is-shifted {
  transform: translateX(-10%) scale(0.98);
  opacity: 0.4;
  pointer-events: none;
}

.page-header {
  padding-bottom: 0.5rem;
  margin-bottom: 0.75rem;
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
  height: 36px;
}

.recommendation-tabs {
  display: flex;
  justify-content: flex-end;
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

.action-indicator {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 4px;
  background: color-mix(in srgb, var(--a-color-text) 72%, transparent);
  flex-shrink: 0;
}
.search-dropdown__hint {
  margin: 0;
  padding: 0.55rem 0.95rem;
  color: var(--a-color-muted);
  font-size: 0.82rem;
  font-weight: 500;
}
.search-dropdown__list {
  display: grid;
}
.search-dropdown__item {
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
.search-dropdown__item:hover {
  background: color-mix(in srgb, var(--a-color-bg) 58%, var(--a-color-surface-muted) 42%);
}
.search-dropdown__item-title {
  font-size: 0.98rem;
  font-weight: 500;
  color: var(--a-color-fg);
}
.search-dropdown__item-meta {
  font-size: 0.8rem;
  color: var(--a-color-muted-soft);
}

.state-line { margin: 1.5rem 0; color: var(--a-color-muted); font-family: var(--a-font-sans); font-weight: 500; }
.state-line--error { color: var(--a-color-accent-destructive); }
.empty-state { margin-top: 1.5rem; }
.empty-actions { display: flex; gap: 1rem; flex-wrap: wrap; }

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
  transition: border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
}

.ui-action:hover {
  border-color: color-mix(in srgb, var(--a-color-text) 30%, transparent);
  transform: translateY(1px);
  box-shadow: none;
}

.search-side-action {
  white-space: nowrap;
}

.artist-results-grid {
  margin-top: 1.5rem;
  display: grid;
  gap: 1.25rem;
  grid-template-columns: repeat(6, minmax(0, 1fr));
}

@media (max-width: 1100px) {
  .artist-results-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

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

  .artist-results-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem 0.75rem;
  }
}
</style>
