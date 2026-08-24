<script setup lang="ts">
import { reportError } from '@/utils/logger'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ApiErrorResponseError } from '@/api/client'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import {
  createArtistBookmark,
  deleteArtistBookmark,
  listArtistBookmarks,
  listMusicArtists,
  listMusicLibrary,
  listRecommendedArtists,
  type MusicArtistBookmark,
  type MusicArtistListItem,
  type MusicRecommendationMode,
} from '@/api/musicV1'
import { MusicArtistCard } from '@/components/music'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PContentProgress from '@/components/ui/PContentProgress.vue'
import PSkeleton from '@/components/ui/PSkeleton.vue'
import SearchSurface from '@/components/search/SearchSurface.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PButton from '@/components/ui/PButton.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import { useMusicRouteSelection } from '@/composables/useMusicRouteSelection'
import { useLoginRedirect } from '@/composables/useLoginRedirect'
import { useAuthStore } from '@/stores/auth'
import { MUSIC_RECOMMENDATION_MODE_OPTIONS } from '@/utils/musicRecommendations'

type ArtistFilterTab = 'all' | 'subscribed'
const activeTab = ref<ArtistFilterTab>('all')
const recommendationMode = ref<MusicRecommendationMode>('hot')

const tabOptions = [
  { label: '全部', value: 'all' },
  { label: '已订阅', value: 'subscribed' },
]

const route = useRoute()
const authStore = useAuthStore()
const { requireLogin } = useLoginRedirect()
const {
  isMainShifted,
  openAlbum,
  closeAlbum,
  openArtist,
  closeArtist,
  openMusicCreationFlow,
  closeMusicCreationFlow,
  closeMusicEditor,
} = useMusicDrawers()

const artists = ref<MusicArtistListItem[]>([])
const searchResults = ref<MusicArtistListItem[]>([])
const searchQuery = ref('')
searchQuery.value = typeof route.query.q === 'string' ? route.query.q.trim() : ''
const loading = ref(false)
const searchLoading = ref(false)
const errorMessage = ref('')
const showSearchDropdown = ref(false)
let activeRequestId = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined

const starredArtistIds = ref<string[]>([])
const artistMeta = ref({ page: 1, page_size: 48, total: 0, has_more: false })
const { applyRouteSelection } = useMusicRouteSelection({
  openAlbum,
  closeAlbum,
  openArtist,
  closeArtist,
  openMusicCreationFlow,
  closeMusicCreationFlow,
  closeMusicEditor,
})

async function fetchBookmarks() {
  if (!authStore.isAuthenticated) {
    starredArtistIds.value = []
    return
  }
  try {
    const response = await listArtistBookmarks()
    starredArtistIds.value = response.data.map((bookmark) => String(bookmark.artist_id))
  } catch (e) {
    if (e instanceof ApiErrorResponseError && e.status === 401) {
      starredArtistIds.value = []
      return
    }
    reportError(e, 'Failed to fetch bookmarks:')
  }
}

async function handleToggleBookmark(artistId: string) {
  if (!requireLogin()) return
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
    reportError(e, 'Failed to toggle bookmark:')
  }
}

async function fetchArtists(page = 1) {
  const requestId = ++activeRequestId
  loading.value = true
  errorMessage.value = ''

  try {
    const query = searchQuery.value.trim()
    if (query) {
      searchLoading.value = true
      const response = await listMusicArtists({ q: query, page: 1, page_size: 48 })
      if (requestId !== activeRequestId) return
      artists.value = response.data
      searchResults.value = response.data
      artistMeta.value = response.meta ?? { page: 1, page_size: 48, total: response.data.length, has_more: false }
      return
    }

    searchResults.value = []
    await fetchBookmarks()
    if (requestId !== activeRequestId) return

    if (activeTab.value === 'subscribed') {
      const response = await listMusicLibrary<MusicArtistBookmark>('artist', { page, page_size: 48 })
      if (requestId !== activeRequestId) return
      artists.value = response.data
        .map((bookmark) => bookmark.artist)
        .filter((artist): artist is MusicArtistListItem => Boolean(artist))
      artistMeta.value = response.meta ?? { page, page_size: 48, total: response.data.length, has_more: false }
      return
    }

    const [recommendedResult, ownedDraftResult] = await Promise.allSettled([
      listRecommendedArtists(recommendationMode.value, { page, page_size: 48 }),
      authStore.isAuthenticated && page === 1
        ? listMusicArtists({ page: 1, page_size: 48 })
        : Promise.resolve(null),
    ])
    if (requestId !== activeRequestId) return

    if (recommendedResult.status === 'rejected') {
      reportError(recommendedResult.reason, 'Failed to fetch recommended music artists:')
      const fallbackResponse = await listMusicArtists({ page, page_size: 48 })
      if (requestId !== activeRequestId) return
      artists.value = fallbackResponse.data
      artistMeta.value = fallbackResponse.meta ?? {
        page,
        page_size: 48,
        total: fallbackResponse.data.length,
        has_more: false,
      }
      return
    }

    const recommendedResponse = recommendedResult.value
    const ownedDraftResponse = ownedDraftResult.status === 'fulfilled'
      ? ownedDraftResult.value
      : null
    if (ownedDraftResult.status === 'rejected') {
      reportError(ownedDraftResult.reason, 'Failed to fetch owned artist drafts:')
    }
    const recommendedMeta = recommendedResponse.meta ?? {
      page,
      page_size: 48,
      total: recommendedResponse.data.length,
      has_more: false,
    }

    const recommendedArtists = recommendedResponse.data.map((item) => ({
      id: item.id,
      name: item.title,
      display_name: item.title,
      bio: item.summary,
      image_url: item.image_url,
      play_count: item.play_count,
      bookmark_count: item.bookmark_count,
      birth_year: item.birth_year,
      birth_date: item.birth_date,
      entry_status: 'open' as const,
    }))
    const ownedDrafts = (ownedDraftResponse?.data ?? []).filter((artist) => artist.entry_status === 'draft')
    const ownedDraftsToAdd = ownedDrafts.filter((draft) =>
      !recommendedArtists.some((artist) => String(artist.id) === String(draft.id)),
    )
    artistMeta.value = {
      ...recommendedMeta,
      total: recommendedMeta.total + ownedDraftsToAdd.length,
    }
    artists.value = page === 1
      ? [...ownedDrafts, ...recommendedArtists.filter((artist) =>
          !ownedDrafts.some((draft) => String(draft.id) === String(artist.id)),
        )]
      : recommendedArtists
  } catch (e) {
    if (requestId !== activeRequestId) return
    reportError(e, 'Failed to fetch music artists:')
    errorMessage.value = '艺术家列表加载失败'
    artists.value = []
  } finally {
    if (requestId === activeRequestId) {
      loading.value = false
      searchLoading.value = false
    }
  }
}

watch(activeTab, () => {
  void fetchArtists(1)
})

watch(recommendationMode, () => {
  void fetchArtists(1)
})

watch(() => authStore.isAuthenticated, () => {
  void fetchArtists(1)
})

function openArtistCard(artistId: string) {
  openArtist(String(artistId))
  showSearchDropdown.value = false
  searchQuery.value = ''
}

function startArtistCreation() {
  if (!requireLogin()) return
  openMusicCreationFlow({ startStep: 'artist' })
}

onMounted(() => {
  void fetchArtists(1)
  applyRouteSelection(route.query)
})

watch(searchQuery, () => {
  activeRequestId += 1
  clearTimeout(searchTimer)
  searchLoading.value = Boolean(searchQuery.value.trim())
  searchTimer = setTimeout(() => void fetchArtists(1), 250)
})

onUnmounted(() => clearTimeout(searchTimer))

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
                    <span class="search-dropdown__item-title">{{ artist.display_name || artist.name }}</span>
                    <span class="search-dropdown__item-meta">{{ artist.legal_name || artist.bio || '艺术家' }}</span>
                  </button>
                </div>
              </template>
            </SearchSurface>
          </div>
          <PButton
            variant="primary"
            class="search-side-action"
            @click="startArtistCreation"
          >
            添加艺术家
          </PButton>
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

      <PContentProgress
        :loading="loading"
        :retry="fetchArtists"
      >
        <template #skeleton>
          <div class="artist-results-grid" style="padding-top: 1rem;">
            <div v-for="i in 8" :key="i" style="display:flex;flex-direction:column;gap:0.75rem;align-items:center;">
              <PSkeleton width="120px" height="120px" variant="circle" />
              <PSkeleton width="60%" height="18px" />
              <PSkeleton width="40%" height="14px" />
            </div>
          </div>
        </template>

        <div v-if="!artists.length" class="empty-state">
          <p class="state-line">{{ activeTab === 'subscribed' ? '暂无订阅的艺术家' : '没有匹配的艺术家' }}</p>
          <div class="empty-actions">
            <PButton
              variant="primary"
              data-testid="empty-add-artist"
              @click="startArtistCreation"
            >
              添加艺术家
            </PButton>
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

        <PaginationBar
          v-if="!hasSearchQuery && artistMeta.total > 0"
          :meta="artistMeta"
          :loading="loading"
          @change="fetchArtists"
        />
      </PContentProgress>
    </div>
  </div>
</template>

<style scoped>
.music-base-view { position: relative; }
.main-level-1 {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s;
}
.main-level-1.is-shifted {
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
    width: 100%;
    flex: 0 0 36px;
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
