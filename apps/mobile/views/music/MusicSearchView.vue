<template>
  <div class="mobile-music-search">
    <!-- Header with Search Input -->
    <header class="mobile-music-search__header">
      <h1 class="mobile-music-search__title">音乐搜索</h1>
      <div class="mobile-music-search__input-wrap">
        <MInput
          v-model="searchQuery"
          placeholder="搜索单曲、专辑、歌手、歌单..."
          clearable
          data-testid="music-search-input"
          @keyup.enter="handleSearch"
        />
      </div>

      <!-- Result Filter Tabs (when searching or has results) -->
      <div v-if="searchQuery.trim()" class="mobile-music-search__tabs">
        <button
          v-for="tab in filterTabs"
          :key="tab.key"
          type="button"
          class="mobile-music-search__tab"
          :class="{ 'is-active': activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
          <span v-if="getCount(tab.key)" class="mobile-music-search__tab-count">
            {{ getCount(tab.key) }}
          </span>
        </button>
      </div>
    </header>

    <main class="mobile-music-search__content">
      <!-- Empty Query: Hot Searches & Discover Entry -->
      <section v-if="!searchQuery.trim()" class="mobile-music-search__explore">
        <div class="mobile-music-search__section-title">热门搜索</div>
        <div class="mobile-music-search__tags">
          <button
            v-for="tag in hotTags"
            :key="tag"
            type="button"
            class="mobile-music-search__tag"
            @click="selectTag(tag)"
          >
            {{ tag }}
          </button>
        </div>

        <div class="mobile-music-search__section-title" style="margin-top: 24px;">快速分类</div>
        <div class="mobile-music-search__categories">
          <router-link to="/music/playlists" class="mobile-music-search__cat-card">
            <div class="mobile-music-search__cat-icon">
              <MIcon name="playlists" size="md" />
            </div>
            <div class="mobile-music-search__cat-text">
              <span class="mobile-music-search__cat-name">精选歌单</span>
              <span class="mobile-music-search__cat-desc">探索专属主题集</span>
            </div>
          </router-link>

          <router-link to="/music" class="mobile-music-search__cat-card">
            <div class="mobile-music-search__cat-icon">
              <MIcon name="compass" size="md" />
            </div>
            <div class="mobile-music-search__cat-text">
              <span class="mobile-music-search__cat-name">新碟与推荐</span>
              <span class="mobile-music-search__cat-desc">今日最新发行</span>
            </div>
          </router-link>
        </div>
      </section>

      <!-- Loading State -->
      <div v-else-if="loading" class="mobile-music-search__loading">
        <div v-for="n in 5" :key="n" class="mobile-music-search__skeleton">
          <div class="mobile-music-search__skeleton-cover" />
          <div class="mobile-music-search__skeleton-info">
            <div class="mobile-music-search__skeleton-title" />
            <div class="mobile-music-search__skeleton-sub" />
          </div>
        </div>
      </div>

      <!-- Results View -->
      <div v-else-if="hasResults" class="mobile-music-search__results">
        <!-- Songs Section -->
        <section
          v-if="(activeTab === 'all' || activeTab === 'songs') && songs.length > 0"
          class="mobile-music-search__group"
        >
          <div v-if="activeTab === 'all'" class="mobile-music-search__group-header">
            <h2 class="mobile-music-search__group-title">单曲 ({{ songs.length }})</h2>
          </div>
          <div class="mobile-music-search__song-list">
            <div
              v-for="song in songs"
              :key="song.id"
              class="mobile-music-search__song-item"
              data-testid="search-song-item"
              @click="playSong(song)"
            >
              <div class="mobile-music-search__song-cover">
                <img v-if="song.cover_url" :src="song.cover_url" :alt="song.title" />
                <div v-else class="mobile-music-search__song-art">
                  <MIcon name="note" size="sm" />
                </div>
              </div>
              <div class="mobile-music-search__song-info">
                <span class="mobile-music-search__song-name">{{ song.title }}</span>
                <span class="mobile-music-search__song-meta">
                  {{ song.artist }} · {{ song.album || '单曲' }}
                </span>
              </div>
              <span v-if="formatDuration(song.duration)" class="mobile-music-search__song-dur">
                {{ formatDuration(song.duration) }}
              </span>
            </div>
          </div>
        </section>

        <!-- Albums Section -->
        <section
          v-if="(activeTab === 'all' || activeTab === 'albums') && albums.length > 0"
          class="mobile-music-search__group"
        >
          <div v-if="activeTab === 'all'" class="mobile-music-search__group-header">
            <h2 class="mobile-music-search__group-title">专辑 ({{ albums.length }})</h2>
          </div>
          <div class="mobile-music-search__album-list">
            <div
              v-for="album in albums"
              :key="album.id"
              class="mobile-music-search__album-item"
              data-testid="search-album-item"
              @click="openAlbum(album.id)"
            >
              <div class="mobile-music-search__album-cover">
                <img v-if="album.cover_url" :src="album.cover_url" :alt="album.title" />
                <div v-else class="mobile-music-search__album-art">
                  <MIcon name="note" size="md" />
                </div>
              </div>
              <div class="mobile-music-search__album-info">
                <span class="mobile-music-search__album-name">{{ album.title }}</span>
                <span class="mobile-music-search__album-meta">
                  {{ album.artist }} · {{ album.year ? album.year + ' 年' : '专辑' }}
                </span>
              </div>
            </div>
          </div>
        </section>

        <!-- Playlists Section -->
        <section
          v-if="(activeTab === 'all' || activeTab === 'playlists') && playlists.length > 0"
          class="mobile-music-search__group"
        >
          <div v-if="activeTab === 'all'" class="mobile-music-search__group-header">
            <h2 class="mobile-music-search__group-title">歌单 ({{ playlists.length }})</h2>
          </div>
          <div class="mobile-music-search__playlist-list">
            <div
              v-for="pl in playlists"
              :key="pl.id"
              class="mobile-music-search__playlist-item"
              data-testid="search-playlist-item"
              @click="openPlaylist(pl.id)"
            >
              <div class="mobile-music-search__playlist-cover">
                <img v-if="pl.cover_url" :src="pl.cover_url" :alt="pl.name" />
                <div v-else class="mobile-music-search__playlist-art">
                  <MIcon name="playlists" size="md" />
                </div>
              </div>
              <div class="mobile-music-search__playlist-info">
                <span class="mobile-music-search__playlist-name">{{ pl.name }}</span>
                <span class="mobile-music-search__playlist-count">{{ pl.song_count || 0 }} 首歌曲</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- No Results State -->
      <div v-else class="mobile-music-search__empty" data-testid="search-empty">
        <div class="mobile-music-search__empty-icon">
          <MIcon name="search" size="lg" />
        </div>
        <p class="mobile-music-search__empty-title">未找到相关结果</p>
        <p class="mobile-music-search__empty-desc">换个关键词试试，或检查拼写是否正确。</p>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { searchMusic } from '@/api/musicV1'
import { useAudioPlayerStore } from '@/stores/player'
import type { Song } from '@/types'
import MIcon from '@mobile/components/ui/MIcon.vue'
import MInput from '@mobile/components/ui/MInput.vue'

export interface SearchSongItem {
  id: string
  title: string
  artist: string
  album?: string
  duration?: number
  audio_url?: string
  cover_url?: string
}

export interface SearchAlbumItem {
  id: string
  title: string
  artist: string
  year?: string | number
  cover_url?: string
}

export interface SearchPlaylistItem {
  id: string
  name: string
  song_count?: number
  cover_url?: string
}

const props = withDefaults(
  defineProps<{
    initialQuery?: string
    initialSongs?: SearchSongItem[]
    initialAlbums?: SearchAlbumItem[]
    initialPlaylists?: SearchPlaylistItem[]
  }>(),
  {
    initialQuery: '',
    initialSongs: undefined,
    initialAlbums: undefined,
    initialPlaylists: undefined,
  }
)

const router = useRouter()
const player = useAudioPlayerStore()

const searchQuery = ref(props.initialQuery)
const activeTab = ref<'all' | 'songs' | 'albums' | 'playlists'>('all')
const loading = ref(false)

const songs = ref<SearchSongItem[]>(props.initialSongs ? [...props.initialSongs] : [])
const albums = ref<SearchAlbumItem[]>(props.initialAlbums ? [...props.initialAlbums] : [])
const playlists = ref<SearchPlaylistItem[]>(props.initialPlaylists ? [...props.initialPlaylists] : [])

const hotTags = ['Ye', 'Kanye', '2049', 'Graduation', 'Hey Mama', 'Ambient', '电子', 'Hip-Hop']

const filterTabs = [
  { key: 'all' as const, label: '全部' },
  { key: 'songs' as const, label: '单曲' },
  { key: 'albums' as const, label: '专辑' },
  { key: 'playlists' as const, label: '歌单' },
]

const hasResults = computed(() => {
  if (activeTab.value === 'songs') return songs.value.length > 0
  if (activeTab.value === 'albums') return albums.value.length > 0
  if (activeTab.value === 'playlists') return playlists.value.length > 0
  return songs.value.length > 0 || albums.value.length > 0 || playlists.value.length > 0
})

function getCount(key: string): number | null {
  if (key === 'songs') return songs.value.length || null
  if (key === 'albums') return albums.value.length || null
  if (key === 'playlists') return playlists.value.length || null
  return null
}

function selectTag(tag: string) {
  searchQuery.value = tag
  void executeSearch(tag)
}

function handleSearch() {
  const q = searchQuery.value.trim()
  if (q) {
    void executeSearch(q)
  }
}

watch(searchQuery, (next) => {
  if (!next.trim()) {
    songs.value = []
    albums.value = []
    playlists.value = []
  }
})

async function executeSearch(query: string) {
  if (!query.trim()) return
  if (props.initialSongs !== undefined || props.initialAlbums !== undefined) return
  loading.value = true
  try {
    const res = await searchMusic(query)
    const data: any = (res as any)?.data || res || {}

    // Songs
    if (data.songs && Array.isArray(data.songs)) {
      songs.value = data.songs.map((item: any) => ({
        id: item.id,
        title: item.title,
        artist: typeof item.artist === 'string'
          ? item.artist
          : item.artists?.map((a: any) => a.name || a.display_name).join(' / ') || '未知艺术家',
        album: typeof item.album === 'string' ? item.album : item.album?.title || '',
        duration: item.duration_sec ?? item.duration_seconds ?? item.duration ?? 0,
        audio_url: item.audio_url || '',
        cover_url: item.cover_url || item.album?.cover_url || '',
      }))
    } else {
      songs.value = []
    }

    // Albums
    if (data.albums && Array.isArray(data.albums)) {
      albums.value = data.albums.map((item: any) => ({
        id: item.id,
        title: item.title,
        artist: typeof item.artist === 'string'
          ? item.artist
          : item.artists?.map((a: any) => a.name || a.display_name).join(' / ') || '未知艺术家',
        year: item.year || item.release_year || '',
        cover_url: item.cover_url || '',
      }))
    } else {
      albums.value = []
    }

    // Playlists
    if (data.playlists && Array.isArray(data.playlists)) {
      playlists.value = data.playlists.map((item: any) => ({
        id: item.id,
        name: item.name || item.title || '歌单',
        song_count: item.song_count || 0,
        cover_url: item.cover_url || '',
      }))
    } else {
      playlists.value = []
    }
  } catch {
    songs.value = []
    albums.value = []
    playlists.value = []
  } finally {
    loading.value = false
  }
}

function formatDuration(seconds?: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return ''
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function playSong(song: SearchSongItem) {
  const playerSong: Song = {
    id: song.id,
    title: song.title,
    artist: song.artist,
    album: song.album || '',
    duration: song.duration || 0,
    audio_url: song.audio_url || '',
    cover_url: song.cover_url || '',
  }
  player.playSong(playerSong)
}

function openAlbum(id: string) {
  void router.push(`/music/album/${id}`)
}

function openPlaylist(id: string) {
  void router.push(`/music/playlist/${id}`)
}
</script>

<style scoped>
.mobile-music-search {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background-color: #ffffff;
  padding-bottom: 96px;
}

.mobile-music-search__header {
  padding: 16px 16px 12px;
  background-color: #ffffff;
  border-bottom: 1px solid var(--a-color-border-soft, #f0f0f0);
}

.mobile-music-search__title {
  font-size: 20px;
  font-weight: 600;
  color: var(--a-color-text, #111111);
  margin: 0 0 12px 0;
}

.mobile-music-search__input-wrap {
  margin-bottom: 10px;
}

.mobile-music-search__tabs {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  overflow-x: auto;
  scrollbar-width: none;
}

.mobile-music-search__tabs::-webkit-scrollbar {
  display: none;
}

.mobile-music-search__tab {
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 4px;
  border: 1px solid var(--a-color-border-soft, #eeeeee);
  background: #ffffff;
  color: var(--a-color-text-secondary, #666666);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.mobile-music-search__tab.is-active {
  background: var(--a-color-text, #111111);
  color: #ffffff;
  border-color: var(--a-color-text, #111111);
}

.mobile-music-search__tab-count {
  font-size: 10px;
  opacity: 0.8;
  margin-left: 2px;
}

.mobile-music-search__content {
  flex: 1;
  padding: 16px;
}

.mobile-music-search__section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--a-color-text-secondary, #666666);
  margin-bottom: 10px;
}

.mobile-music-search__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.mobile-music-search__tag {
  padding: 6px 12px;
  font-size: 12px;
  border-radius: 4px;
  border: 1px solid var(--a-color-border-soft, #eeeeee);
  background: #fafafa;
  color: var(--a-color-text, #222222);
  cursor: pointer;
}

.mobile-music-search__tag:active {
  background: #f0f0f0;
}

.mobile-music-search__categories {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.mobile-music-search__cat-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border-radius: 4px;
  border: 1px solid var(--a-color-border-soft, #eeeeee);
  background: #ffffff;
  text-decoration: none;
  transition: background-color 0.15s ease;
}

.mobile-music-search__cat-card:active {
  background-color: var(--a-color-surface-hover, #fafafa);
}

.mobile-music-search__cat-icon {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  background: #f7f7f7;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-text, #111111);
}

.mobile-music-search__cat-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.mobile-music-search__cat-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--a-color-text, #111111);
}

.mobile-music-search__cat-desc {
  font-size: 11px;
  color: var(--a-color-text-secondary, #888888);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Loading Skeleton */
.mobile-music-search__loading {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mobile-music-search__skeleton {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 8px 0;
}

.mobile-music-search__skeleton-cover {
  width: 44px;
  height: 44px;
  border-radius: 4px;
  background: #f2f2f2;
  flex-shrink: 0;
}

.mobile-music-search__skeleton-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mobile-music-search__skeleton-title {
  height: 14px;
  width: 50%;
  background: #f2f2f2;
  border-radius: 2px;
}

.mobile-music-search__skeleton-sub {
  height: 11px;
  width: 30%;
  background: #f2f2f2;
  border-radius: 2px;
}

/* Results */
.mobile-music-search__group {
  margin-bottom: 20px;
}

.mobile-music-search__group-header {
  margin-bottom: 8px;
}

.mobile-music-search__group-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--a-color-text, #111111);
  margin: 0;
}

.mobile-music-search__song-list,
.mobile-music-search__album-list,
.mobile-music-search__playlist-list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--a-color-border-soft, #f0f0f0);
  border-radius: 4px;
  overflow: hidden;
  background: #ffffff;
}

.mobile-music-search__song-item,
.mobile-music-search__album-item,
.mobile-music-search__playlist-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--a-color-border-soft, #f7f7f7);
  cursor: pointer;
}

.mobile-music-search__song-item:last-child,
.mobile-music-search__album-item:last-child,
.mobile-music-search__playlist-item:last-child {
  border-bottom: none;
}

.mobile-music-search__song-item:active,
.mobile-music-search__album-item:active,
.mobile-music-search__playlist-item:active {
  background-color: var(--a-color-surface-hover, #fafafa);
}

.mobile-music-search__song-cover,
.mobile-music-search__album-cover,
.mobile-music-search__playlist-cover {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  overflow: hidden;
  background: #f7f7f7;
  border: 1px solid var(--a-color-border-soft, #eeeeee);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mobile-music-search__song-cover img,
.mobile-music-search__album-cover img,
.mobile-music-search__playlist-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-music-search__song-info,
.mobile-music-search__album-info,
.mobile-music-search__playlist-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mobile-music-search__song-name,
.mobile-music-search__album-name,
.mobile-music-search__playlist-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--a-color-text, #111111);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-music-search__song-meta,
.mobile-music-search__album-meta,
.mobile-music-search__playlist-count {
  font-size: 11px;
  color: var(--a-color-text-secondary, #777777);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-music-search__song-dur {
  font-size: 11px;
  font-family: monospace;
  color: var(--a-color-text-muted, #999999);
}

.mobile-music-search__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 48px 16px;
}

.mobile-music-search__empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 4px;
  border: 1px solid var(--a-color-border-soft, #eeeeee);
  background: #ffffff;
  color: var(--a-color-text-muted, #999999);
  margin-bottom: 16px;
}

.mobile-music-search__empty-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--a-color-text, #111111);
  margin: 0 0 6px 0;
}

.mobile-music-search__empty-desc {
  font-size: 13px;
  color: var(--a-color-text-secondary, #777777);
  margin: 0;
}
</style>
