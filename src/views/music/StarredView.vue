<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ApiErrorResponseError } from '@/api/client'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import {
  deleteAlbumBookmark,
  deleteArtistBookmark,
  getMusicAlbum,
  getMusicArtist,
  listAlbumBookmarks,
  listArtistBookmarks,
  listMusicPlaylists,
  listSongBookmarks,
  type MusicAlbumBookmark,
  type MusicArtistBookmark,
  type MusicPlaylistSummary,
  type MusicSongBookmark,
  type MusicStarredItem,
} from '@/api/musicV1'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import { MusicAlbumCard, MusicArtistCard } from '@/components/music'

type StarredFilter = 'all' | 'artist' | 'album' | 'song' | 'playlist'

const filterOptions: Array<{ label: string; value: StarredFilter; testId: string }> = [
  { label: '全部', value: 'all', testId: 'filter-all' },
  { label: '艺术家', value: 'artist', testId: 'filter-artist' },
  { label: '专辑', value: 'album', testId: 'filter-album' },
  { label: '单曲', value: 'song', testId: 'filter-song' },
  { label: '歌单', value: 'playlist', testId: 'filter-playlist' },
]

const items = ref<MusicStarredItem[]>([])
const activeFilter = ref<StarredFilter>('all')
const loading = ref(false)
const errorMessage = ref('')

const filteredItems = computed(() => (
  activeFilter.value === 'all'
    ? items.value
    : items.value.filter((item) => item.kind === activeFilter.value)
))
const { isMainShifted, openArtist, openAlbum, openPlaylist } = useMusicDrawers()

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
    return
  }

  if (item.kind === 'song' && item.song?.album?.id) {
    openAlbum(String(item.song.album.id))
    return
  }

  if (item.kind === 'playlist' && item.playlist?.id) {
    openPlaylist(String(item.playlist.id))
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

async function loadStarred() {
  loading.value = true
  errorMessage.value = ''
  try {
    let artistBookmarks: { data: MusicArtistBookmark[] }
    let albumBookmarks: { data: MusicAlbumBookmark[] }
    let songBookmarks: { data: MusicSongBookmark[] }
    let playlists: { data: MusicPlaylistSummary[] }
    try {
      ;[artistBookmarks, albumBookmarks, songBookmarks, playlists] = await Promise.all([
        listArtistBookmarks(),
        listAlbumBookmarks(),
        listSongBookmarks(),
        listMusicPlaylists(),
      ])
    } catch (error) {
      if (error instanceof ApiErrorResponseError && error.status === 401) {
        items.value = []
        return
      }
      throw error
    }

    const [artists, albums] = await Promise.all([
      Promise.all(artistBookmarks.data.map((bookmark) => getMusicArtist(bookmark.artist_id))),
      Promise.all(albumBookmarks.data.map((bookmark) => getMusicAlbum(bookmark.album_id))),
    ])

    items.value = [
      ...artistBookmarks.data.map((bookmark: MusicArtistBookmark, index: number) => ({
        id: bookmark.id,
        kind: 'artist' as const,
        starred_at: bookmark.created_at,
        artist: artists[index],
      })),
      ...albumBookmarks.data.map((bookmark: MusicAlbumBookmark, index: number) => ({
        id: bookmark.id,
        kind: 'album' as const,
        starred_at: bookmark.created_at,
        album: albums[index],
      })),
      ...songBookmarks.data
        .filter((bookmark) => bookmark.song)
        .map((bookmark) => ({
          id: bookmark.id,
          kind: 'song' as const,
          starred_at: bookmark.created_at,
          song: bookmark.song,
        })),
      ...playlists.data.map((playlist) => ({
        id: playlist.id,
        kind: 'playlist' as const,
        starred_at: '',
        playlist,
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

      <PEmpty v-if="errorMessage" :text="errorMessage" role="alert">
        <template #action>
          <PButton data-testid="retry-starred" size="sm" @click="loadStarred">重新加载</PButton>
        </template>
      </PEmpty>
      <div v-else-if="loading" class="results music-card-grid--skeleton" role="status" aria-label="正在加载收藏">
        <div v-for="index in 6" :key="index" class="a-skeleton music-card-skeleton" />
      </div>

      <PEmpty v-else-if="!filteredItems.length" text="暂无收藏" />

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
            class="result-card result-card--interactive"
            :data-testid="item.kind === 'song' ? 'starred-song-card' : 'starred-playlist-card'"
            @click="handleItemClick(item)"
          >
            <p class="a-font-meta result-kind">
              {{ item.kind === 'song' ? '单曲' : '歌单' }}
            </p>
            <h2>{{ item.kind === 'song' ? item.song?.title : item.playlist?.name }}</h2>
            <p class="result-meta">
              {{
                item.kind === 'song'
                  ? item.song?.artists?.map((artist) => artist.name).join(' / ')
                  : `${item.playlist?.song_count ?? 0} 首歌曲`
              }}
            </p>
          </article>
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
  gap: 1.5rem;
}

.main-level-1.is-shifted {
  transform: translateX(-10%) scale(0.98);
  opacity: 0.4;
  pointer-events: none;
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
  font-size: 6rem;
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
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 1.25rem;
}

.music-card-skeleton { aspect-ratio: 1; }

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

  .page-title {
    font-size: 3rem;
  }

  .results {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem 0.75rem;
  }
}

@media (min-width: 721px) and (max-width: 1100px) {
  .results { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}

@media (prefers-reduced-motion: reduce) {
  .main-level-1,
  .result-card--interactive { transition: none; }
}
</style>
