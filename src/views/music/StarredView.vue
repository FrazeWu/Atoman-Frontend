<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import ArtistDrawer from '@/components/music/ArtistDrawer.vue'
import AlbumDrawer from '@/components/music/AlbumDrawer.vue'
import {
  createArtistBookmark,
  deleteAlbumBookmark,
  deleteArtistBookmark,
  getMusicAlbum,
  getMusicArtist,
  listAlbumBookmarks,
  listArtistBookmarks,
  listRecommendedAlbums,
  listRecommendedArtists,
  type MusicAlbumBookmark,
  type MusicArtistBookmark,
  type MusicRecommendationMode,
  type MusicStarredItem,
} from '@/api/musicV1'
import { resolveAlbumCoverUrl } from '@/utils/musicMedia'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import {
  filterAlbumRecommendationsByBookmarks,
  filterArtistRecommendationsByBookmarks,
  MUSIC_RECOMMENDATION_MODE_OPTIONS,
} from '@/utils/musicRecommendations'
import { MusicAlbumCard, MusicArtistCard } from '@/components/music'

type StarredFilter = 'all' | 'artist' | 'album'

const filterOptions: Array<{ label: string; value: StarredFilter; testId: string }> = [
  { label: '全部', value: 'all', testId: 'filter-all' },
  { label: '艺术家', value: 'artist', testId: 'filter-artist' },
  { label: '专辑', value: 'album', testId: 'filter-album' },
]

const items = ref<MusicStarredItem[]>([])
const activeFilter = ref<StarredFilter>('all')
const recommendationMode = ref<MusicRecommendationMode>('hot')
const loading = ref(false)
const errorMessage = ref('')

const filteredItems = computed(() => (
  activeFilter.value === 'all'
    ? items.value
    : items.value.filter((item) => item.kind === activeFilter.value)
))
const { isMainShifted, openArtist, openAlbum } = useMusicDrawers()

function artistNamesFromItem(item: MusicStarredItem) {
  if (item.artist) return item.artist.name
  if (item.album?.artists?.length) return item.album.artists.map((artist) => artist.name).join(' / ')
  return ''
}

function handleItemClick(item: MusicStarredItem) {
  if (item.kind === 'artist' && item.artist?.id) {
    openArtist(String(item.artist.id))
    return
  }

  if (item.kind === 'album' && item.album?.id) {
    openAlbum(String(item.album.id))
  }
}

async function handleToggleArtistBookmark(artistId: string) {
  try {
    await deleteArtistBookmark(artistId)
    items.value = items.value.filter(
      (item) => !(item.kind === 'artist' && String(item.artist?.id) === artistId)
    )
  } catch (e) {
    console.error('Failed to delete bookmark:', e)
  }
}

async function handleToggleAlbumBookmark(albumId: string) {
  try {
    await deleteAlbumBookmark(albumId)
    items.value = items.value.filter(
      (item) => !(item.kind === 'album' && String(item.album?.id) === albumId)
    )
  } catch (e) {
    console.error('Failed to delete album bookmark:', e)
  }
}

function albumYearLabel(item: MusicStarredItem) {
  if (!item.album) return '年份未知'
  if (typeof item.album.year === 'number' && Number.isFinite(item.album.year) && item.album.year > 0) {
    return String(item.album.year)
  }
  if (item.album.release_date?.trim()) return item.album.release_date.slice(0, 4)
  return '年份未知'
}

function artistInitial(name?: string) {
  const value = name?.trim()
  return value ? value[0].toUpperCase() : '?'
}

async function loadStarred() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [artistBookmarks, albumBookmarks] = await Promise.all([
      listArtistBookmarks(),
      listAlbumBookmarks(),
    ])

    const [recommendedArtists, recommendedAlbums] = await Promise.all([
      listRecommendedArtists(recommendationMode.value),
      listRecommendedAlbums(recommendationMode.value),
    ])

    const visibleArtistBookmarks = filterArtistRecommendationsByBookmarks(
      recommendedArtists.data,
      artistBookmarks.data as MusicArtistBookmark[],
    )
    const visibleAlbumBookmarks = filterAlbumRecommendationsByBookmarks(
      recommendedAlbums.data,
      albumBookmarks.data as MusicAlbumBookmark[],
    )

    const artistBookmarksById = new Map(
      artistBookmarks.data.map((bookmark: MusicArtistBookmark) => [String(bookmark.artist_id), bookmark]),
    )
    const albumBookmarksById = new Map(
      albumBookmarks.data.map((bookmark: MusicAlbumBookmark) => [String(bookmark.album_id), bookmark]),
    )

    const [artists, albums] = await Promise.all([
      Promise.all(visibleArtistBookmarks.map((item) => getMusicArtist(item.id))),
      Promise.all(visibleAlbumBookmarks.map((item) => getMusicAlbum(item.id))),
    ])

    items.value = [
      ...visibleArtistBookmarks.map((item, index: number) => ({
        id: artistBookmarksById.get(item.id)?.id ?? item.id,
        kind: 'artist' as const,
        starred_at: artistBookmarksById.get(item.id)?.created_at ?? '',
        artist: artists[index],
      })),
      ...visibleAlbumBookmarks.map((item, index: number) => ({
        id: albumBookmarksById.get(item.id)?.id ?? item.id,
        kind: 'album' as const,
        starred_at: albumBookmarksById.get(item.id)?.created_at ?? '',
        album: albums[index],
      })),
    ]
  } catch (error) {
    console.error('Failed to load music starred items:', error)
    errorMessage.value = '收藏加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadStarred()
})

watch(recommendationMode, () => {
  loadStarred()
})
</script>

<template>
  <div class="music-starred-view">
    <div class="main-level-1" :class="{ 'is-shifted': isMainShifted }">
      <header class="page-header">
        <PPageHeader
          title="收藏"
          mb="0"
        >
          <template #action>
            <div class="mode-tabs" aria-label="收藏筛选">
              <PSegmentedControl
                v-model="activeFilter"
                :options="filterOptions"
              />
            </div>
          </template>
        </PPageHeader>
      </header>

      <div class="toolbar-row">
        <div class="toolbar-left">
          <div class="search-shell search-shell--placeholder" aria-hidden="true" />
        </div>
        <div class="toolbar-right">
          <div class="recommendation-tabs" aria-label="收藏推荐模式">
            <PSegmentedControl
              v-model="recommendationMode"
              :options="MUSIC_RECOMMENDATION_MODE_OPTIONS"
            />
          </div>
        </div>
      </div>

      <p v-if="errorMessage" class="state-line state-line--error">{{ errorMessage }}</p>
      <p v-else-if="loading" class="state-line">正在加载...</p>

      <div v-else-if="!filteredItems.length" class="empty-paper" role="status">
        <h2>暂无收藏</h2>
      </div>

      <div v-else class="results">
        <template
          v-for="item in filteredItems"
          :key="`${item.kind}-${item.id}`"
        >
          <MusicAlbumCard
            v-if="item.kind === 'album' && item.album"
            :album="item.album"
            is-bookmarked
            data-testid="starred-album-card"
            @click="handleItemClick(item)"
            @toggle-bookmark="handleToggleAlbumBookmark(String(item.album.id))"
          />

          <MusicArtistCard
            v-else-if="item.kind === 'artist' && item.artist"
            :artist="item.artist"
            is-bookmarked
            data-testid="starred-artist-card"
            @click="handleItemClick(item)"
            @toggle-bookmark="handleToggleArtistBookmark(String(item.artist.id))"
          />

          <article
            v-else
            class="result-card"
            @click="handleItemClick(item)"
          >
            <p class="a-font-meta result-kind">
              {{
                item.kind === 'song'
                  ? '单曲'
                  : '歌单'
              }}
            </p>
          </article>
        </template>
      </div>
    </div>
    <ArtistDrawer />
    <AlbumDrawer />
  </div>
</template>

<style scoped>
.music-starred-view {
  position: relative;
}

.main-level-1 {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.main-level-1.is-shifted {
  transform: translateX(-10%) scale(0.98);
  opacity: 0.4;
  pointer-events: none;
}

.page-header {
  border-left: 4px solid var(--a-color-line-soft);
  padding-left: 1.25rem;
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
  max-width: 28rem;
  flex: 0 1 28rem;
}

.search-shell--placeholder {
  min-height: 1px;
}

.recommendation-tabs {
  display: flex;
  justify-content: flex-end;
}

.kicker {
  margin: 0 0 0.75rem;
  color: var(--a-color-muted);
}

@media (max-width: 720px) {
  .toolbar-row,
  .toolbar-left,
  .toolbar-right {
    flex-direction: column;
    align-items: stretch;
  }

  .search-shell {
    max-width: 100%;
  }

  .search-shell--placeholder {
    display: none;
  }

  .recommendation-tabs {
    min-width: 0;
    max-width: 100%;
  }
}

.page-title {
  margin: 0;
  font-family: var(--a-font-serif);
  font-size: clamp(3rem, 8vw, 6rem);
  font-style: italic;
  font-weight: 900;
  line-height: 0.9;
}

.page-desc {
  margin: 1rem 0 0;
  color: var(--a-color-muted);
  font-size: 1.05rem;
  line-height: 1.8;
}

.playlist-creation,
.result-card,
.empty-paper {
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper);
  box-shadow: var(--a-shadow-modal);
}

.result-card--interactive {
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
}

.result-card--interactive:hover {
  background: var(--a-color-paper-soft);
  border-color: color-mix(in srgb, var(--a-color-ink) 18%, var(--a-color-line-soft));
  transform: translateY(-1px);
}

.result-card--interactive:hover h2 {
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}

.playlist-creation,
.result-card {
  padding: 1.5rem;
}

.section-heading h2,
.result-card h2,
.empty-paper h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 900;
  letter-spacing: -0.03em;
}

.section-heading p,
.result-meta,
.empty-paper p:last-child,
.state-line {
  color: var(--a-color-muted);
  line-height: 1.7;
}

.playlist-form {
  display: grid;
  gap: 0.85rem;
  margin-top: 1rem;
}

.paper-input,
.paper-textarea {
  width: 100%;
  border: 1px solid var(--a-color-line-soft);
  background: rgba(255, 255, 255, 0.72);
  padding: 0.9rem 1rem;
  font: inherit;
}

.paper-action {
  width: fit-content;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper);
  padding: 0.75rem 1rem;
  font: inherit;
  cursor: pointer;
}

.paper-action:disabled {
  cursor: wait;
  opacity: 0.7;
}

.filter-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.p-tab {
  border: 1px solid var(--a-color-line-soft);
  background: rgba(255, 255, 255, 0.72);
  padding: 0.7rem 1rem;
  cursor: pointer;
}

.p-tab--active {
  background: var(--a-color-paper);
  box-shadow: inset 0 -2px 0 var(--a-color-ink);
}

.empty-paper {
  position: relative;
  max-width: 680px;
  min-height: 220px;
  padding: 3rem 2rem 2rem;
}

.empty-label {
  margin: 0 0 1.5rem;
  color: var(--a-color-muted);
}

.results {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
  gap: 1.25rem;
}

.result-kind {
  margin: 0 0 0.85rem;
  color: var(--a-color-muted);
}

/* Unused cover-frame styles removed, handled by MusicAlbumCard.vue */

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

.music-avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
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

.music-summary {
  margin: 0;
  color: var(--a-color-muted-soft);
  line-height: 1.4;
  font-size: 0.775rem;
}

.playlist-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.playlist-songs {
  display: grid;
  gap: 0.9rem;
  margin: 1rem 0 0;
  padding: 1rem 0 0;
  border-top: 1px solid var(--a-color-line-soft);
}

.playlist-song {
  display: grid;
  grid-template-columns: 2rem 1fr;
  gap: 0.75rem;
}

.playlist-song-index,
.playlist-song-title {
  margin: 0;
}

.playlist-song-title {
  font-weight: 700;
}

.state-line {
  margin: 0;
}

.state-line--error {
  color: #b42318;
}

@media (max-width: 720px) {
  .playlist-head {
    flex-direction: column;
  }
}
</style>
