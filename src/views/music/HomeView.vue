<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { listMusicArtists, listArtistBookmarks, type MusicArtistListItem } from '@/api/musicV1'
import ArtistDrawer from '@/components/music/ArtistDrawer.vue'
import AlbumDrawer from '@/components/music/AlbumDrawer.vue'
import MusicCreationFlowDrawer from '@/components/music/MusicCreationFlowDrawer.vue'
import NestedActionDrawer from '@/components/music/NestedActionDrawer.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import SearchSurface from '@/components/search/SearchSurface.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'

type ArtistFilterTab = 'all' | 'subscribed'
const activeTab = ref<ArtistFilterTab>('all')

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

async function fetchArtists() {
  const requestId = ++activeRequestId
  loading.value = true
  errorMessage.value = ''

  try {
    if (activeTab.value === 'subscribed') {
      const response = await listArtistBookmarks()
      if (requestId !== activeRequestId) return
      artists.value = (response.data || []).map((bookmark: any) => bookmark.artist).filter(Boolean)
    } else {
      const response = await listMusicArtists({
        q: undefined,
        page: 1,
        page_size: 48,
      })
      if (requestId !== activeRequestId) return
      artists.value = response.data
    }
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

      <div class="search-row">
        <div class="search-shell" :class="{ 'is-open': showSearchDropdown }">
          <SearchSurface
            v-model:query="searchQuery"
            :open="showSearchDropdown"
            compact
            eyebrow=""
            :status="searchLoading ? '搜索中...' : '搜索'"
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
        <button
          v-for="artist in artists"
          :key="artist.id"
          class="artist-card"
          data-testid="artist-card"
          type="button"
          @click="openArtistCard(artist.id)"
        >
          <!-- Thumbnail/Avatar -->
          <div class="avatar-frame">
            <img v-if="artist.image_url" :src="artist.image_url" :alt="artist.name" class="avatar-image" loading="lazy" />
            <div v-else class="avatar-placeholder-text">
              <span>{{ artist.name ? artist.name[0].toUpperCase() : '?' }}</span>
            </div>
            
            <!-- Nationality Overlay -->
            <div v-if="artist.nationality" class="nationality-overlay">
              <span>{{ artist.nationality }}</span>
            </div>
          </div>

          <!-- Info row -->
          <div class="artist-info">
            <div class="artist-text">
              <h3 class="artist-card-title a-clamp-1">{{ artist.name }}</h3>
              <p class="artist-card-sub a-clamp-2">{{ artist.bio || '暂无个人简介' }}</p>
            </div>
          </div>
        </button>
      </div>
    </div>

    <ArtistDrawer />
    <AlbumDrawer />
    <MusicCreationFlowDrawer />
    <NestedActionDrawer />
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

.search-row {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.search-shell {
  position: relative;
  max-width: 28rem;
  flex: 0 1 28rem;
}

.search-shell.is-open {
  z-index: 15;
}

.search-shell.is-open :deep(.search-frame) {
  position: absolute;
  inset: 0 auto auto 0;
  width: 40rem;
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
  padding: 0.7rem 1rem;
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
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
  gap: 1.25rem;
  margin-top: 1.5rem;
}
.artist-card {
  display: block;
  text-decoration: none;
  color: inherit;
  border: none;
  background: transparent;
  padding: 0;
  text-align: left;
  cursor: pointer;
  width: 100%;
}
.avatar-frame {
  position: relative;
  aspect-ratio: 16 / 9;
  background: var(--a-color-surface);
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--a-color-line-soft);
}
.artist-card:hover .avatar-image {
  transform: scale(1.03);
}
.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.2s ease;
  display: block;
}
.avatar-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-muted);
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.04), rgba(0, 0, 0, 0.08));
}
.nationality-overlay {
  position: absolute;
  bottom: 8px;
  left: 8px;
  z-index: 1;
}
.nationality-overlay span {
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 5px;
  letter-spacing: 0.02em;
  border-radius: 2px;
  white-space: nowrap;
}
.artist-info {
  display: flex;
  padding: 8px 0 0;
  text-align: left;
}
.artist-text {
  min-width: 0;
  flex: 1;
}
.artist-card-title {
  font-size: 0.9rem;
  font-weight: 800;
  line-height: 1.35;
  color: var(--a-color-fg);
  margin: 0 0 0.25rem 0;
  transition: color 0.2s;
}
.artist-card:hover .artist-card-title {
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}
.artist-card-sub {
  margin: 0;
  color: var(--a-color-muted-soft);
  line-height: 1.4;
  font-size: 0.75rem;
}

@media (max-width: 720px) {
  .search-row {
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

  .search-side-action {
    width: fit-content;
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
