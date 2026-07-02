<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PTab from '@/components/ui/PTab.vue'
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

const modeDescription = computed(() => {
  switch (mode.value) {
    case 'featured':
      return '从长期质量和条目完整度出发，挑出更值得反复回看的专辑。'
    case 'discover':
      return '把低曝光但值得被发现的专辑翻出来，像在旧货架里重新找唱片。'
    default:
      return '优先看近期热度更高的专辑，适合先浏览当前最活跃的音乐条目。'
  }
})

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
      listMusicAlbums({ q: query, page: 1, page_size: 4, sort: 'hot' }),
      listMusicArtists({ q: query, page: 1, page_size: 4 }),
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

function changeMode(nextMode: MusicRecommendationMode) {
  if (nextMode === mode.value) return
  mode.value = nextMode
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
        kicker="MUSIC INDEX / RECOMMEND"
        title="探索"
        :sub="modeDescription"
        mb="0"
      >
        <template #action>
          <div class="mode-tabs" aria-label="音乐推荐模式">
            <PTab
              v-for="option in modeOptions"
              :key="option.value"
              :label="option.label"
              :active="mode === option.value"
              @click="changeMode(option.value)"
            />
          </div>
        </template>
      </PPageHeader>
    </header>

    <div class="search-surface">
      <div class="search-frame">
        <div class="search-frame__head">
          <span class="search-frame__eyebrow">Explore Search</span>
          <span class="search-frame__status">
            {{ searchLoading ? '搜索中...' : hasSearchQuery ? '快速跳转' : '搜索专辑或艺术家' }}
          </span>
        </div>
        <input
          v-model="searchQuery"
          class="search-input"
          type="text"
          placeholder="搜索专辑或艺术家..."
          data-testid="music-explore-search-input"
          @focus="handleSearchFocus"
          @blur="handleSearchBlur"
        >
        <div v-if="searchOpen" class="search-dropdown" data-testid="music-explore-search-dropdown">
          <p v-if="!hasSearchQuery" class="search-dropdown__hint">输入名称，从下拉中直接进入专辑或艺术家。</p>
          <p v-else-if="searchLoading" class="search-dropdown__hint">搜索中...</p>
          <p v-else-if="!hasSearchResults" class="search-dropdown__hint">没有匹配结果</p>
          <div v-else class="search-dropdown__sections">
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
        </div>
      </div>
    </div>

    <p v-if="errorMessage" class="state-line state-line--error">{{ errorMessage }}</p>
    <p v-else-if="loading" class="state-line">正在加载推荐专辑...</p>
    <p v-else-if="!albums.length" class="state-line">当前还没有可展示的推荐专辑。</p>

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
            <p class="music-summary a-clamp-2">{{ album.summary || '从音乐档案里继续展开，查看这张专辑的条目与相关讨论。' }}</p>
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
  gap: 2.5rem;
}

.page-header {
  max-width: 900px;
}

.search-surface {
  max-width: 34rem;
}

.search-frame {
  position: relative;
  border: var(--a-border);
  background: color-mix(in srgb, var(--a-color-paper) 94%, #f3eee5 6%);
  box-shadow: 0 10px 24px rgba(18, 18, 18, 0.05);
  padding: 0.8rem 0.95rem 0.9rem;
  display: grid;
  gap: 0.6rem;
}

.search-frame__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.search-frame__eyebrow,
.search-frame__status {
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.search-frame__eyebrow {
  color: var(--a-color-muted-soft);
}

.search-frame__status {
  color: var(--a-color-ink-soft);
}

.search-input {
  width: 100%;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-ink) 22%, transparent);
  background: transparent;
  color: var(--a-color-ink);
  padding: 0 0 0.72rem;
  font-size: 1rem;
  font-family: inherit;
  box-sizing: border-box;
}

.search-input:focus {
  outline: none;
  border-bottom-color: var(--a-color-accent-confirm);
}

.search-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 20;
  border: var(--a-border);
  background: color-mix(in srgb, var(--a-color-paper) 94%, #f3eee5 6%);
  box-shadow: 0 10px 24px rgba(18, 18, 18, 0.05);
  padding: 0.55rem 0;
}

.search-dropdown__hint {
  margin: 0;
  padding: 0.55rem 0.95rem;
  color: var(--a-color-muted);
  font-size: 0.82rem;
  font-weight: 700;
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
  padding: 0.8rem 0.95rem;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.search-result:hover {
  background: color-mix(in srgb, var(--a-color-paper) 58%, var(--a-color-paper-wash) 42%);
}

.search-result__title {
  font-size: 0.9rem;
  font-weight: 800;
  color: var(--a-color-fg);
}

.search-result__meta {
  font-size: 0.74rem;
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
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  gap: 1.25rem;
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
</style>
