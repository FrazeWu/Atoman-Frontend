<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ApiErrorResponseError } from '@/api/client'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import {
  deleteAlbumBookmark,
  deleteArtistBookmark,
  getMusicAlbum,
  getMusicArtist,
  listAlbumBookmarks,
  listArtistBookmarks,
  listPlaylistBookmarks,
  type MusicPlaylistSummary,
  type MusicAlbumBookmark,
  type MusicArtistBookmark,
  type MusicStarredItem,
} from '@/api/musicV1'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import { MusicAlbumCard, MusicArtistCard } from '@/components/music'

type StarredFilter = 'album' | 'artist' | 'playlist'
type StarredSortMode = 'latest' | 'popular'

const filterOptions: Array<{ label: string; value: StarredFilter; testid: string }> = [
  { label: '收藏专辑', value: 'album', testid: 'filter-album' },
  { label: '收藏艺人', value: 'artist', testid: 'filter-artist' },
  { label: '收藏歌单', value: 'playlist', testid: 'filter-playlist' },
]

const artistItems = ref<MusicStarredItem[]>([])
const albumItems = ref<MusicStarredItem[]>([])
const playlistItems = ref<MusicPlaylistSummary[]>([])
const activeFilter = ref<StarredFilter>('album')
const sortMode = ref<StarredSortMode>('latest')
const loading = ref(false)
const errorMessage = ref('')

const sortOptions: Array<{ label: string; value: StarredSortMode }> = [
  { label: '最新', value: 'latest' },
  { label: '最热', value: 'popular' },
]
const router = useRouter()

const filteredItems = computed(() => {
  if (activeFilter.value === 'artist') return artistItems.value
  if (activeFilter.value === 'playlist') return []
  return albumItems.value
})
const isPlaylistFilter = computed(() => activeFilter.value === 'playlist')
const hasVisibleItems = computed(() => (
  isPlaylistFilter.value
    ? playlistItems.value.length > 0
    : filteredItems.value.length > 0
))
const { state, isMainShifted, openArtist, openAlbum } = useMusicDrawers()

function handleItemClick(item: MusicStarredItem) {
  if (item.kind === 'artist' && item.artist?.id) {
    openArtist(String(item.artist.id))
    return
  }

  if (item.kind === 'album' && item.album?.id) {
    openAlbum(String(item.album.id))
  }
}

function handlePlaylistClick(playlistId: string) {
  router.push(`/music/playlist/${playlistId}`)
}

async function handleToggleArtistBookmark(artistId: string) {
  try {
    await deleteArtistBookmark(artistId)
    artistItems.value = artistItems.value.filter(
      (item) => !(item.kind === 'artist' && String(item.artist?.id) === artistId)
    )
  } catch (e) {
    console.error('Failed to delete bookmark:', e)
  }
}

async function handleToggleAlbumBookmark(albumId: string) {
  try {
    await deleteAlbumBookmark(albumId)
    albumItems.value = albumItems.value.filter(
      (item) => !(item.kind === 'album' && String(item.album?.id) === albumId)
    )
  } catch (e) {
    console.error('Failed to delete album bookmark:', e)
  }
}

async function loadStarred() {
  loading.value = true
  errorMessage.value = ''
  try {
    let artistBookmarks: { data: MusicArtistBookmark[] }
    let albumBookmarks: { data: MusicAlbumBookmark[] }
    let playlistsResponse: { data: Array<{ playlist?: MusicPlaylistSummary }> }
    try {
      ;[artistBookmarks, albumBookmarks, playlistsResponse] = await Promise.all([
        listArtistBookmarks({ sort: sortMode.value }),
        listAlbumBookmarks({ sort: sortMode.value }),
        listPlaylistBookmarks({ sort: sortMode.value }),
      ])
    } catch (error) {
      if (error instanceof ApiErrorResponseError && error.status === 401) {
        artistItems.value = []
        albumItems.value = []
        playlistItems.value = []
        return
      }
      throw error
    }

    const artistBookmarksById = new Map(
      artistBookmarks.data.map((bookmark: MusicArtistBookmark) => [String(bookmark.artist_id), bookmark]),
    )
    const albumBookmarksById = new Map(
      albumBookmarks.data.map((bookmark: MusicAlbumBookmark) => [String(bookmark.album_id), bookmark]),
    )

    const [artists, albums] = await Promise.all([
      Promise.all(artistBookmarks.data.map((bookmark: MusicArtistBookmark) => getMusicArtist(bookmark.artist_id))),
      Promise.all(albumBookmarks.data.map((bookmark: MusicAlbumBookmark) => getMusicAlbum(bookmark.album_id))),
    ])

    artistItems.value = artistBookmarks.data.map((bookmark: MusicArtistBookmark, index: number) => ({
      id: bookmark.id,
      kind: 'artist' as const,
      starred_at: artistBookmarksById.get(String(bookmark.artist_id))?.created_at ?? '',
      artist: artists[index],
    }))
    albumItems.value = albumBookmarks.data.map((bookmark: MusicAlbumBookmark, index: number) => ({
      id: bookmark.id,
      kind: 'album' as const,
      starred_at: albumBookmarksById.get(String(bookmark.album_id))?.created_at ?? '',
      album: albums[index],
    }))
    playlistItems.value = playlistsResponse.data
      .map(bookmark => bookmark.playlist)
      .filter((playlist): playlist is MusicPlaylistSummary => Boolean(playlist))
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

watch(sortMode, () => {
  loadStarred()
})

watch(
  () => state.value.playlistRefreshToken,
  () => {
    loadStarred()
  },
)
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
          <div class="recommendation-tabs" aria-label="收藏排序">
            <PSegmentedControl
              v-model="sortMode"
              :options="sortOptions"
            />
          </div>
        </div>
      </div>

      <p v-if="errorMessage" class="state-line state-line--error">{{ errorMessage }}</p>
      <p v-else-if="loading" class="state-line">正在加载...</p>

      <div v-else-if="!hasVisibleItems" class="empty-paper" role="status">
        <h2>暂无收藏</h2>
      </div>

      <div v-else class="results">
        <template v-if="isPlaylistFilter">
          <article
            v-for="playlist in playlistItems"
            :key="playlist.id"
            class="result-card result-card--interactive playlist-card"
            data-testid="starred-playlist-card"
            @click="handlePlaylistClick(String(playlist.id))"
          >
            <p class="a-font-meta result-kind">歌单</p>
            <div class="playlist-head">
              <h2>{{ playlist.name }}</h2>
              <span class="playlist-count">{{ playlist.song_count }} 首</span>
            </div>
            <p v-if="playlist.description" class="result-meta">{{ playlist.description }}</p>
          </article>
        </template>

        <template
          v-else
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
        </template>
      </div>
    </div>
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
  border-left: 4px solid var(--a-color-border-soft);
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
  font-family: var(--a-font-sans);
  font-size: 6rem;
  font-style: italic;
  font-weight: 500;
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
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
  background: var(--a-color-bg);
  box-shadow: none;
}

.result-card--interactive {
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
}

.result-card--interactive:hover {
  background: var(--a-color-surface);
  border-color: var(--a-color-muted-soft);
  transform: translateY(1px);
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
  font-weight: 500;
  letter-spacing: 0;
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

.form-input,
.form-textarea {
  width: 100%;
  border: 1px solid var(--a-color-border-soft);
  background: rgba(255, 255, 255, 0.72);
  padding: 0.9rem 1rem;
  font: inherit;
}

.ui-action {
  width: fit-content;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  padding: 0.75rem 1rem;
  font: inherit;
  cursor: pointer;
}

.ui-action:disabled {
  cursor: wait;
  opacity: 0.7;
}

.filter-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.p-tab {
  border: 1px solid var(--a-color-border-soft);
  background: rgba(255, 255, 255, 0.72);
  padding: 0.7rem 1rem;
  cursor: pointer;
}

.p-tab--active {
  background: var(--a-color-bg);
  box-shadow: none;
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
  border: 1px solid var(--a-color-border-soft);
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
  font-weight: 500;
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

.playlist-card {
  display: grid;
  gap: 0.85rem;
}

.playlist-count {
  color: var(--a-color-muted);
  white-space: nowrap;
}

.playlist-songs {
  display: grid;
  gap: 0.9rem;
  margin: 1rem 0 0;
  padding: 1rem 0 0;
  border-top: 1px solid var(--a-color-border-soft);
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
  font-weight: 500;
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

  .page-title {
    font-size: 3rem;
  }
}
</style>
