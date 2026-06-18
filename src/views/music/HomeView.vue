<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { listMusicAlbums, type MusicAlbumListItem } from '@/api/musicV1'
import ArtistDrawer from '@/components/music/ArtistDrawer.vue'
import AlbumDrawer from '@/components/music/AlbumDrawer.vue'
import NestedActionDrawer from '@/components/music/NestedActionDrawer.vue'

type DiscoveryMode = 'hot' | 'random'

const { isMainShifted, openAlbum, openArtist, openNestedAction } = useMusicDrawers()

const albums = ref<MusicAlbumListItem[]>([])
const searchQuery = ref('')
const mode = ref<DiscoveryMode>('hot')
const loading = ref(false)
const errorMessage = ref('')

const modeLabel = computed(() => (mode.value === 'hot' ? '热门' : '随机'))

function albumArtists(album: MusicAlbumListItem) {
  return album.artists || []
}

function releaseLabel(album: MusicAlbumListItem) {
  if (album.year) return String(album.year)
  if (album.release_date) return album.release_date.slice(0, 4)
  return '年份未知'
}

function statusLabel(status: string) {
  return status === 'confirmed' ? '已确认' : '待完善'
}

function hotScoreLabel(album: MusicAlbumListItem) {
  if (album.hot_score === undefined || album.hot_score === null) return ''
  return Number.isInteger(album.hot_score) ? String(album.hot_score) : album.hot_score.toFixed(1)
}

async function fetchAlbums() {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await listMusicAlbums({
      q: searchQuery.value.trim() || undefined,
      page: 1,
      page_size: 48,
      sort: mode.value,
    })
    albums.value = response.data
  } catch (e) {
    console.error('Failed to fetch albums:', e)
    errorMessage.value = '专辑列表加载失败'
  } finally {
    loading.value = false
  }
}

function changeMode(nextMode: DiscoveryMode) {
  if (mode.value === nextMode) return
  mode.value = nextMode
}

function openAlbumCard(album: MusicAlbumListItem) {
  openAlbum(String(album.id))
}

function openArtistFromCard(artistId: string) {
  openArtist(String(artistId))
}

onMounted(() => {
  fetchAlbums()
})

watch([searchQuery, mode], () => {
  fetchAlbums()
})
</script>

<template>
  <div class="music-base-view">
    <div class="main-level-1" :class="{ 'is-shifted': isMainShifted }">
      <div class="page-header">
        <div>
          <!-- <h1 class="page-title">专辑发现</h1> -->
          <h1 style="display: none">专辑发现</h1>
          <h1 class="page-title">艺术家</h1>
          <p class="a-muted">按热度或随机浏览音乐档案库中的专辑与艺术家。</p>
        </div>
        <div class="mode-tabs" aria-label="专辑浏览模式">
          <button
            class="mode-tab"
            :class="{ 'is-active': mode === 'hot' }"
            type="button"
            data-testid="mode-hot"
            @click="changeMode('hot')"
          >
            热门
          </button>
          <button
            class="mode-tab"
            :class="{ 'is-active': mode === 'random' }"
            type="button"
            data-testid="mode-random"
            @click="changeMode('random')"
          >
            随机
          </button>
        </div>
      </div>

      <div class="search-bar">
        <input
          v-model="searchQuery"
          placeholder="搜索艺术家..."
          class="search-input"
        />
        <button class="a-btn" type="button" @click="openNestedAction('add_artist')">找不到？添加艺术家</button>
      </div>

      <p v-if="errorMessage" class="state-line state-line--error">{{ errorMessage }}</p>
      <p v-else-if="loading" class="state-line">正在加载{{ modeLabel }}专辑...</p>

      <div v-else-if="!albums.length" class="empty-state">
        <p class="state-line">没有匹配的专辑，可以提交新的 wiki 编辑。</p>
        <div class="empty-actions">
          <button class="a-btn" type="button" data-testid="empty-add-artist" @click="openNestedAction('add_artist')">添加艺术家</button>
          <button class="a-btn" type="button" data-testid="empty-add-album" @click="openNestedAction('add_album')">提交专辑</button>
        </div>
      </div>

      <div v-else class="grid">
        <article
          v-for="album in albums"
          :key="album.id"
          class="card"
          data-testid="album-card"
          @click="openAlbumCard(album)"
        >
          <div class="card-img">
            <img v-if="album.cover_url" :src="album.cover_url" class="album-cover" alt="" />
            <span v-else>ALBUM</span>
          </div>
          <div class="card-body">
            <div class="card-title">{{ album.title }}</div>
            <div class="artist-row" @click.stop>
              <button
                v-for="artist in albumArtists(album)"
                :key="artist.id"
                class="artist-link"
                type="button"
                data-testid="album-artist"
                @click="openArtistFromCard(artist.id)"
              >
                {{ artist.name }}
              </button>
              <span v-if="!albumArtists(album).length" class="card-sub">未知艺术家</span>
            </div>
            <div class="meta-row">
              <span>{{ releaseLabel(album) }}</span>
              <span>{{ album.album_type || 'album' }}</span>
              <span>{{ statusLabel(album.entry_status) }}</span>
            </div>
            <div v-if="hotScoreLabel(album)" class="card-sub">热度 {{ hotScoreLabel(album) }}</div>
          </div>
        </article>
      </div>
    </div>

    <ArtistDrawer />
    <AlbumDrawer />
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
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
}
.page-title { font-family: var(--a-font-serif); font-size: 3rem; font-weight: 900; margin-bottom: 0.5rem; font-style: italic; border-left: 8px solid var(--a-color-ink); padding-left: 1rem; }
.mode-tabs {
  display: inline-flex;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper);
  flex-shrink: 0;
}
.mode-tab {
  border: 0;
  border-right: 1px solid var(--a-color-line-soft);
  padding: 0.75rem 1.25rem;
  background: transparent;
  cursor: pointer;
  font-family: var(--a-font-meta);
  font-weight: 900;
}
.mode-tab:last-child { border-right: 0; }
.mode-tab.is-active {
  background: var(--a-color-ink);
  color: var(--a-color-paper);
}
.search-bar { display: flex; gap: 1rem; margin: 2rem 0; }
.search-input {
  border: var(--a-border);
  border-radius: var(--a-radius-none);
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  flex: 1;
  max-width: 520px;
  outline: none;
}
.search-input:focus {
  border-color: var(--a-color-fg);
  box-shadow: inset 0 0 0 1px var(--a-color-fg);
}
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1.5rem; }
.card {
  background: var(--a-color-paper);
  border: none;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  border-radius: var(--a-radius-none);
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
}
.card:hover {
  background: var(--a-color-paper-wash);
  box-shadow: var(--a-shadow-paper-sm);
}
.card-img {
  aspect-ratio: 1;
  background: #eee;
  border-bottom: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--a-font-meta);
  color: #999;
  overflow: hidden;
}
.album-cover { width: 100%; height: 100%; object-fit: cover; }
.card-body { padding: 1rem; text-align: left; display: flex; flex-direction: column; gap: 0.45rem; }
.card-title { font-weight: 900; font-size: 1.1rem; line-height: 1.2; }
.artist-row { display: flex; flex-wrap: wrap; gap: 0.35rem; min-height: 1.4rem; }
.artist-link {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--a-color-ink);
  cursor: pointer;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 800;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  font-size: 0.75rem;
  font-family: var(--a-font-meta);
  color: var(--a-color-muted);
}
.meta-row span::after { content: '·'; margin-left: 0.4rem; }
.meta-row span:last-child::after { content: ''; margin-left: 0; }
.card-sub { font-size: 0.8rem; color: var(--a-color-muted); }
.state-line { margin: 1.5rem 0; color: var(--a-color-ink-soft); font-family: var(--a-font-meta); font-weight: 800; }
.state-line--error { color: #b42318; }
.empty-state { margin-top: 1.5rem; }
.empty-actions { display: flex; gap: 1rem; flex-wrap: wrap; }
.a-btn { border: 2px solid var(--a-color-ink); padding: 0.75rem 1.5rem; font-weight: bold; background: var(--a-color-paper); cursor: pointer; font-family: var(--a-font-meta); transition: all 0.1s; }
.p-button:hover { background: var(--a-color-paper-soft); }

@media (max-width: 720px) {
  .page-header,
  .search-bar { flex-direction: column; }
  .mode-tabs,
  .search-input { width: 100%; max-width: none; }
  .mode-tab { flex: 1; }
}
</style>
