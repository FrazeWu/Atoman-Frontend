<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import ArtistDrawer from '@/components/music/ArtistDrawer.vue'
import AlbumDrawer from '@/components/music/AlbumDrawer.vue'
import {
  getMusicAlbum,
  getMusicArtist,
  listAlbumBookmarks,
  listArtistBookmarks,
  type MusicAlbumBookmark,
  type MusicArtistBookmark,
  type MusicStarredItem,
} from '@/api/musicV1'
import { resolveAlbumCoverUrl } from '@/utils/musicMedia'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'

type StarredFilter = 'all' | 'artist' | 'album'

const filterOptions: Array<{ label: string; value: StarredFilter; testId: string }> = [
  { label: '全部', value: 'all', testId: 'filter-all' },
  { label: '艺术家', value: 'artist', testId: 'filter-artist' },
  { label: '专辑', value: 'album', testId: 'filter-album' },
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
const { openArtist, openAlbum } = useMusicDrawers()

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

    const [artists, albums] = await Promise.all([
      Promise.all(artistBookmarks.data.map((bookmark: MusicArtistBookmark) => getMusicArtist(bookmark.artist_id))),
      Promise.all(albumBookmarks.data.map((bookmark: MusicAlbumBookmark) => getMusicAlbum(bookmark.album_id))),
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
  <section class="music-starred-view">
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

    <p v-if="errorMessage" class="state-line state-line--error">{{ errorMessage }}</p>
    <p v-else-if="loading" class="state-line">正在加载...</p>

    <div v-else-if="!filteredItems.length" class="empty-paper" role="status">
      <h2>暂无收藏</h2>
    </div>

    <div v-else class="results">
      <article
        v-for="item in filteredItems"
        :key="`${item.kind}-${item.id}`"
        class="result-card"
        :class="{ 'result-card--interactive': item.kind === 'artist' || item.kind === 'album' }"
        :data-testid="item.kind === 'artist' ? 'starred-artist-card' : item.kind === 'album' ? 'starred-album-card' : undefined"
        @click="handleItemClick(item)"
      >
        <p class="a-font-meta result-kind">
          {{
            item.kind === 'artist'
              ? '艺术家'
              : item.kind === 'album'
                ? '专辑'
                : item.kind === 'song'
                  ? '单曲'
                  : '歌单'
          }}
        </p>

        <template v-if="item.kind === 'artist' && item.artist">
          <div class="music-info">
            <div class="music-avatar" aria-hidden="true">
              <img v-if="item.artist.image_url" :src="item.artist.image_url" :alt="item.artist.name" class="music-avatar-image" />
              <span v-else>{{ artistInitial(item.artist.name) }}</span>
            </div>
            <div class="music-text">
              <h2 class="music-title">{{ item.artist.name }}</h2>
              <p v-if="item.artist.bio" class="music-summary">{{ item.artist.bio }}</p>
            </div>
          </div>
        </template>

        <template v-else-if="item.kind === 'album' && item.album">
          <div class="cover-frame">
            <img
              v-if="resolveAlbumCoverUrl(item.album)"
              :src="resolveAlbumCoverUrl(item.album)"
              :alt="item.album.title"
              class="cover-image"
              loading="lazy"
            />
            <div v-else class="cover-placeholder">COVER</div>
          </div>
          <div class="music-info">
            <div class="music-avatar" aria-hidden="true">
              <span>💿</span>
            </div>
            <div class="music-text">
              <h2 class="music-title">{{ item.album.title }}</h2>
              <p class="music-summary">{{ artistNamesFromItem(item) }} · {{ albumYearLabel(item) }}</p>
            </div>
          </div>
        </template>

      </article>
    </div>
    <ArtistDrawer />
    <AlbumDrawer />
  </section>
</template>

<style scoped>
.music-starred-view {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.page-header {
  max-width: 760px;
  border-left: 4px solid var(--a-color-line-soft);
  padding-left: 1.25rem;
}

.kicker {
  margin: 0 0 0.75rem;
  color: var(--a-color-muted);
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
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  gap: 1.25rem;
}

.result-kind {
  margin: 0 0 0.85rem;
  color: var(--a-color-muted);
}

.cover-frame {
  position: relative;
  aspect-ratio: 1 / 1;
  background: var(--a-color-surface);
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--a-color-line-soft);
}

.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.2s ease;
  display: block;
}

.result-card--interactive:hover .cover-image {
  transform: scale(1.03);
}

.cover-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-muted);
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.04), rgba(0, 0, 0, 0.08));
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
}

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
