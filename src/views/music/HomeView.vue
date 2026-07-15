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
import ArtistDrawer from '@/components/music/ArtistDrawer.vue'
import AlbumDrawer from '@/components/music/AlbumDrawer.vue'
import MusicCreationFlowDrawer from '@/components/music/MusicCreationFlowDrawer.vue'
import { MusicArtistCard } from '@/components/music'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import SearchSurface from '@/components/search/SearchSurface.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
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
const { isMainShifted, openAlbum, closeAlbum, openArtist, closeArtist, openMusicCreationFlow } = useMusicDrawers()

const artists = ref<MusicArtistListItem[]>([])
const searchResults = ref<MusicArtistListItem[]>([])
const searchQuery = ref('')
const loading = ref(false)
const searchLoading = ref(false)
const errorMessage = ref('')
const showSearchDropdown = ref(false)
let activeRequestId = 0
let activeSearchRequestId = 0
let lastRouteArtist: string | null = null
let lastRouteAlbum: string | null = null

const starredArtistIds = ref<string[]>([])

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

function applyRouteSelection() {
  const artist = route.query.artist
  const album = route.query.album
  if (typeof artist === 'string' && artist) {
    openArtist(artist)
    lastRouteArtist = artist
  } else if (lastRouteArtist !== null) {
    closeArtist()
    lastRouteArtist = null
  }

  if (typeof album === 'string' && album) {
    openAlbum(album)
    lastRouteAlbum = album
  } else if (lastRouteAlbum !== null) {
    closeAlbum()
    lastRouteAlbum = null
  }
}

onMounted(() => {
  if (typeof route.query.q === 'string' && route.query.q.trim()) {
    searchQuery.value = route.query.q.trim()
  }
  fetchArtists()
  fetchSearchResults()
  applyRouteSelection()
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
    applyRouteSelection()
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
          <button class="paper-action search-side-action" type="button" @click="openMusicCreationFlow({ startStep: 'artist' })">
            <span class="paper-action-dot" aria-hidden="true" />
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
            class="paper-action"
            type="button"
            data-testid="empty-add-artist"
            @click="openMusicCreationFlow({ startStep: 'artist' })"
          >
            <span class="paper-action-dot" aria-hidden="true" />
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

    <ArtistDrawer />
    <AlbumDrawer />
    <MusicCreationFlowDrawer />
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
  height: 36px; /* 与热度选项卡保持一致的初始高度 */
}

.recommendation-tabs {
  display: flex;
  justify-content: flex-end;
}

.search-shell.is-open {
  z-index: 15;
}

/* 默认状态下：relative 相对定位，自适应高度及文档流，确保任何时候都不会被下方的元素遮挡 */
.search-shell :deep(.search-frame) {
  position: relative;
  width: 100%;
  height: 100%; /* 填满占位 shell (36px) */
  box-sizing: border-box;
}

/* 激活状态下：切换为 absolute 绝对定位以向右延伸扩展，并赋予高 z-index 浮动在一切内容上方 */
.search-shell.is-open :deep(.search-frame) {
  position: absolute;
  top: 0;
  left: 0;
  width: 40rem;
  height: auto !important; /* 允许搜索框向下延伸其高度 */
  z-index: 100;
}

.paper-action-dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--a-color-ink) 72%, transparent);
  flex-shrink: 0;
}
.search-dropdown__hint {
  margin: 0;
  padding: 0.55rem 0.95rem;
  color: var(--a-color-muted);
  font-size: 0.82rem;
  font-weight: 700;
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
  background: color-mix(in srgb, var(--a-color-paper) 58%, var(--a-color-paper-wash) 42%);
}
.search-dropdown__item-title {
  font-size: 0.98rem;
  font-weight: 800;
  color: var(--a-color-fg);
}
.search-dropdown__item-meta {
  font-size: 0.8rem;
  color: var(--a-color-muted-soft);
}

/* ─── State / Empty ──────────────── */
.state-line { margin: 1.5rem 0; color: var(--a-color-ink-soft); font-family: var(--a-font-meta); font-weight: 800; }
.state-line--error { color: var(--a-color-accent-destructive); }
.empty-state { margin-top: 1.5rem; }
.empty-actions { display: flex; gap: 1rem; flex-wrap: wrap; }

/* ─── Paper Action Button ─────────── */
.paper-action {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  border: 1px solid var(--a-color-line-soft);
  border-radius: 0;
  padding: 0 1rem; /* 配合固定高度垂直居中 */
  height: 36px; /* 与热度选项卡保持一致的高度 */
  box-sizing: border-box;
  font-weight: 800;
  background: var(--a-color-paper);
  color: var(--a-color-ink);
  cursor: pointer;
  font-family: var(--a-font-meta);
  font-size: 0.78rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  transition: background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}
.paper-action:hover {
  background: var(--a-color-ink);
  color: var(--a-color-paper);
  box-shadow: var(--a-shadow-dropdown);
}

.search-side-action {
  flex-shrink: 0;
}

/* ─── Artist Search Results ──────── */
.artist-results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
  gap: 1.25rem;
  margin-top: 1.5rem;
}
/* Unused artist-card styles removed, handled by MusicArtistCard.vue */

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
    flex-basis: auto;
  }

  .search-shell.is-open :deep(.search-frame) {
    width: 100%;
  }

  .recommendation-tabs {
    min-width: 0;
    max-width: 100%;
  }
}

.avatar-placeholder-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.2rem;
  font-weight: 900;
  color: var(--a-color-ink);
  background: linear-gradient(135deg, var(--a-color-surface), var(--a-color-line-soft));
  text-transform: uppercase;
  font-family: var(--a-font-meta);
  letter-spacing: -0.05em;
  opacity: 0.85;
}

</style>
