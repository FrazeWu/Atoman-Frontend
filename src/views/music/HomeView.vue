<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { listMusicAlbums, listMusicArtists, type MusicAlbumListItem, type MusicArtistListItem } from '@/api/musicV1'
import ArtistDrawer from '@/components/music/ArtistDrawer.vue'
import AlbumDrawer from '@/components/music/AlbumDrawer.vue'
import MusicCreationFlowDrawer from '@/components/music/MusicCreationFlowDrawer.vue'
import NestedActionDrawer from '@/components/music/NestedActionDrawer.vue'
import PTab from '@/components/ui/PTab.vue'
import PInput from '@/components/ui/PInput.vue'

type DiscoveryMode = 'hot' | 'random'

const { isMainShifted, openAlbum, openArtist, openMusicCreationFlow } = useMusicDrawers()

const albums = ref<MusicAlbumListItem[]>([])
const artists = ref<MusicArtistListItem[]>([])
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
    const query = searchQuery.value.trim() || undefined
    const [albumsResponse, artistsResponse] = await Promise.all([
      listMusicAlbums({
        q: query,
        page: 1,
        page_size: 48,
        sort: mode.value,
      }),
      query
        ? listMusicArtists({
            q: query,
            page: 1,
            page_size: 12,
          })
        : Promise.resolve({ data: [], meta: { page: 1, page_size: 12, total: 0, has_more: false } }),
    ])
    albums.value = albumsResponse.data
    artists.value = artistsResponse.data
  } catch (e) {
    console.error('Failed to fetch music discovery data:', e)
    errorMessage.value = '专辑列表加载失败'
  } finally {
    loading.value = false
  }
}

const showArtistResults = computed(() => !!searchQuery.value.trim() && artists.value.length > 0)

function openArtistCard(artistId: string) {
  openArtist(String(artistId))
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
          <p class="page-kicker">Music Archive</p>
          <h1 class="page-title">专辑发现</h1>
          <p class="a-muted">按热度或随机浏览音乐档案库中的专辑与艺术家。</p>
        </div>
        <div class="mode-tabs" aria-label="专辑浏览模式">
          <PTab
            label="热门"
            :active="mode === 'hot'"
            data-testid="mode-hot"
            @click="changeMode('hot')"
          />
          <PTab
            label="随机"
            :active="mode === 'random'"
            data-testid="mode-random"
            @click="changeMode('random')"
          />
        </div>
      </div>

      <div class="search-bar">
        <span class="search-bar-dot" aria-hidden="true" />
        <PInput
          v-model="searchQuery"
          placeholder="搜索艺术家..."
          class="search-input"
        />
        <button class="paper-action" type="button" @click="openMusicCreationFlow()">
          <span class="paper-action-dot" aria-hidden="true" />
          找不到？添加艺术家
        </button>
      </div>

      <p v-if="errorMessage" class="state-line state-line--error">{{ errorMessage }}</p>
      <p v-else-if="loading" class="state-line">正在加载{{ modeLabel }}专辑...</p>

      <div v-else-if="!albums.length" class="empty-state">
        <p class="state-line">没有匹配的专辑，可以提交新的 wiki 编辑。</p>
        <div class="empty-actions">
          <button class="paper-action" type="button" data-testid="empty-add-artist" @click="openMusicCreationFlow()">
            <span class="paper-action-dot" aria-hidden="true" />
            添加艺术家
          </button>
          <button class="paper-action" type="button" data-testid="empty-add-album" @click="openMusicCreationFlow()">
            <span class="paper-action-dot" aria-hidden="true" />
            提交专辑
          </button>
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

      <section v-if="showArtistResults" class="artist-results-panel">
        <div class="artist-results-header">
          <span class="artist-results-dot" aria-hidden="true" />
          <h2>匹配艺术家</h2>
        </div>
        <div class="artist-results-grid">
          <article
            v-for="artist in artists"
            :key="artist.id"
            class="artist-card"
            data-testid="artist-card"
            @click="openArtistCard(artist.id)"
          >
            <div class="artist-card-title">{{ artist.name }}</div>
            <p class="artist-card-sub">{{ artist.nationality || artist.bio || '新建艺术家，暂未关联专辑' }}</p>
          </article>
        </div>
      </section>
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
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
}
.page-kicker {
  margin: 0 0 0.35rem;
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.page-title { font-family: var(--a-font-serif); font-size: 3rem; font-weight: 900; margin: 0 0 0.5rem; font-style: italic; }
.mode-tabs {
  display: inline-flex;
  gap: 0.35rem;
  flex-shrink: 0;
}
.search-bar {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 2rem 0;
  padding: 0.85rem 0 1rem;
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-ink) 18%, transparent);
}
.search-bar-dot,
.paper-action-dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--a-color-ink) 72%, transparent);
  flex-shrink: 0;
}
.search-input {
  border: 0;
  background: transparent;
  padding: 0;
  font-size: 1rem;
  flex: 1;
  max-width: 520px;
  outline: none;
}
.search-input:focus {
  box-shadow: none;
}
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1.5rem; }
.card {
  background: var(--a-color-paper);
  border: none;
  border-bottom: 1.5px dashed var(--a-color-line-soft);
  border-left: 3px solid transparent;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}
.card:hover {
  background: var(--a-color-paper-wash);
  border-left-color: var(--a-color-ink);
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
.paper-action {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  border: 0;
  border-radius: 0px;
  padding: 0.8rem 1rem;
  font-weight: 800;
  background: color-mix(in srgb, var(--a-color-paper-wash) 78%, white);
  cursor: pointer;
  font-family: var(--a-font-meta);
  transition: background-color 0.15s ease;
}
.artist-results-panel {
  margin-top: 2rem;
  display: grid;
  gap: 1rem;
}
.artist-results-header {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
}
.artist-results-dot {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--a-color-ink) 72%, transparent);
}
.artist-results-header h2 {
  margin: 0;
  font-family: var(--a-font-serif);
  font-size: 1.25rem;
}
.artist-results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
}
.artist-card {
  display: grid;
  gap: 0.45rem;
  padding: 1rem 1.05rem;
  border-radius: 8px;
  background: color-mix(in srgb, var(--a-color-paper-wash) 74%, white);
  cursor: pointer;
  border-bottom: 1.5px dashed var(--a-color-line-soft);
  border-left: 3px solid transparent;
  transition: background-color 0.2s ease;
}
.artist-card:hover {
  background: var(--a-color-paper-wash);
  border-left-color: var(--a-color-ink);
}
.artist-card-title {
  font-family: var(--a-font-serif);
  font-size: 1.1rem;
  font-weight: 800;
}
.artist-card-sub {
  margin: 0;
  color: var(--a-color-ink-soft);
  line-height: 1.5;
  font-size: 0.9rem;
}

@media (max-width: 720px) {
  .page-header,
  .search-bar { flex-direction: column; }
  .mode-tabs,
  .search-input { width: 100%; max-width: none; }
  .mode-tab { flex: 1; }
}
</style>
