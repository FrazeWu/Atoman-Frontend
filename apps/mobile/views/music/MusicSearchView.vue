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

      <!-- Result Filter Tabs -->
      <div class="mobile-music-search__tabs">
        <button
          v-for="tab in filterTabs"
          :key="tab.key"
          type="button"
          class="mobile-music-search__tab"
          :class="{ 'is-active': activeTab === tab.key }"
          :data-testid="`tab-${tab.key}`"
          @click="selectTab(tab.key)"
        >
          {{ tab.label }}
          <span v-if="searchQuery.trim() && getCount(tab.key)" class="mobile-music-search__tab-count">
            {{ getCount(tab.key) }}
          </span>
        </button>
      </div>
    </header>

    <main class="mobile-music-search__content">
      <!-- Empty Query: Hot Searches & Recommendations -->
      <section v-if="!searchQuery.trim()" class="mobile-music-search__explore">
        <div v-if="activeTab === 'all'" class="mobile-music-search__section-title">推荐关键词</div>
        <div v-if="activeTab === 'all'" class="mobile-music-search__tags">
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

        <!-- Recommended Songs -->
        <div v-if="(activeTab === 'all' || activeTab === 'songs') && recommendedSongs.length > 0" class="mobile-music-search__rec-section">
          <div class="mobile-music-search__rec-header">
            <span class="mobile-music-search__section-title">{{ activeTab === 'songs' ? '全部推荐单曲' : '推荐单曲' }}</span>
          </div>
          <div class="mobile-music-search__song-list">
            <div
              v-for="song in recommendedSongs"
              :key="song.id"
              class="mobile-music-search__song-item"
              data-testid="rec-song-item"
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
        </div>

        <!-- Recommended Albums -->
        <div v-if="(activeTab === 'all' || activeTab === 'albums') && recommendedAlbums.length > 0" class="mobile-music-search__rec-section">
          <div class="mobile-music-search__rec-header">
            <span class="mobile-music-search__section-title">{{ activeTab === 'albums' ? '全部推荐专辑' : '热门专辑' }}</span>
            <button
              v-if="activeTab === 'all'"
              type="button"
              class="mobile-music-search__more-link"
              @click="selectTab('albums')"
            >
              查看全部
            </button>
          </div>
          <div :class="activeTab === 'albums' ? 'mobile-music-search__rec-grid' : 'mobile-music-search__rec-scroll'">
            <div
              v-for="album in recommendedAlbums"
              :key="album.id"
              class="mobile-music-search__rec-album-card"
              data-testid="rec-album-item"
              @click="openAlbum(album.id)"
            >
              <div class="mobile-music-search__rec-album-cover">
                <img v-if="album.cover_url" :src="album.cover_url" :alt="album.title" />
                <div v-else class="mobile-music-search__rec-album-art">
                  <MIcon name="note" size="md" />
                </div>
                <span v-if="album.year" class="mobile-music-search__rec-album-year">{{ album.year }}</span>
              </div>
              <span class="mobile-music-search__rec-album-title">{{ album.title }}</span>
              <span class="mobile-music-search__rec-album-artist">{{ album.artist }}</span>
            </div>
          </div>
        </div>

        <!-- Recommended Artists -->
        <div v-if="(activeTab === 'all' || activeTab === 'artists') && recommendedArtists.length > 0" class="mobile-music-search__rec-section">
          <div class="mobile-music-search__rec-header">
            <span class="mobile-music-search__section-title">{{ activeTab === 'artists' ? '全部推荐歌手' : '热门歌手' }}</span>
            <button
              v-if="activeTab === 'all'"
              type="button"
              class="mobile-music-search__more-link"
              @click="selectTab('artists')"
            >
              查看全部
            </button>
          </div>
          <div :class="activeTab === 'artists' ? 'mobile-music-search__rec-grid-artists' : 'mobile-music-search__rec-scroll'">
            <div
              v-for="artist in recommendedArtists"
              :key="artist.id"
              class="mobile-music-search__rec-artist-card"
              data-testid="rec-artist-item"
              @click="openArtist(artist.id)"
            >
              <div class="mobile-music-search__rec-artist-avatar">
                <img v-if="artist.avatar_url" :src="artist.avatar_url" :alt="artist.name" />
                <div v-else class="mobile-music-search__rec-artist-art">
                  <MIcon name="person" size="md" />
                </div>
              </div>
              <span class="mobile-music-search__rec-artist-name">{{ artist.name }}</span>
            </div>
          </div>
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

        <!-- Artists Section -->
        <section
          v-if="(activeTab === 'all' || activeTab === 'artists') && artists.length > 0"
          class="mobile-music-search__group"
        >
          <div v-if="activeTab === 'all'" class="mobile-music-search__group-header">
            <h2 class="mobile-music-search__group-title">歌手 ({{ artists.length }})</h2>
          </div>
          <div class="mobile-music-search__artist-list">
            <div
              v-for="artist in artists"
              :key="artist.id"
              class="mobile-music-search__artist-item"
              data-testid="search-artist-item"
              @click="openArtist(artist.id)"
            >
              <div class="mobile-music-search__artist-avatar">
                <img v-if="artist.avatar_url" :src="artist.avatar_url" :alt="artist.name" />
                <div v-else class="mobile-music-search__artist-art">
                  <MIcon name="person" size="md" />
                </div>
              </div>
              <div class="mobile-music-search__artist-info">
                <span class="mobile-music-search__artist-name">{{ artist.name }}</span>
                <span v-if="artist.nationality" class="mobile-music-search__artist-sub">{{ artist.nationality }}</span>
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
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  listMusicAlbums,
  listMusicArtists,
  listMusicSongs,
  searchMusic,
} from '@/api/musicV1'
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

export interface SearchArtistItem {
  id: string
  name: string
  avatar_url?: string
  nationality?: string
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
    initialArtists?: SearchArtistItem[]
    initialPlaylists?: SearchPlaylistItem[]
  }>(),
  {
    initialQuery: '',
    initialSongs: undefined,
    initialAlbums: undefined,
    initialArtists: undefined,
    initialPlaylists: undefined,
  }
)

const route = useRoute()
const router = useRouter()
const player = useAudioPlayerStore()

const searchQuery = ref(props.initialQuery)
const activeTab = ref<'all' | 'songs' | 'albums' | 'artists' | 'playlists'>('all')
const loading = ref(false)

const songs = ref<SearchSongItem[]>(props.initialSongs ? [...props.initialSongs] : [])
const albums = ref<SearchAlbumItem[]>(props.initialAlbums ? [...props.initialAlbums] : [])
const artists = ref<SearchArtistItem[]>(props.initialArtists ? [...props.initialArtists] : [])
const playlists = ref<SearchPlaylistItem[]>(props.initialPlaylists ? [...props.initialPlaylists] : [])

const recommendedSongs = ref<SearchSongItem[]>([])
const recommendedAlbums = ref<SearchAlbumItem[]>([])
const recommendedArtists = ref<SearchArtistItem[]>([])
const recommendedLoading = ref(false)

const hotTags = ['Ye', 'Kanye', 'Daniel Caesar', 'Kendrick Lamar', '宋冬野', 'BULLY', '2049', 'Graduation', 'Hip-Hop']

const filterTabs = [
  { key: 'all' as const, label: '全部' },
  { key: 'songs' as const, label: '单曲' },
  { key: 'albums' as const, label: '专辑' },
  { key: 'artists' as const, label: '歌手' },
  { key: 'playlists' as const, label: '歌单' },
]

const VALID_TABS = ['all', 'songs', 'albums', 'artists', 'playlists'] as const
type FilterTabKey = (typeof VALID_TABS)[number]

const selectTab = (key: string) => {
  if (VALID_TABS.includes(key as FilterTabKey)) {
    activeTab.value = key as FilterTabKey
  }
}

function syncFromQuery() {
  const queryQ = typeof route.query?.q === 'string' ? route.query.q.trim() : ''
  if (queryQ && queryQ !== searchQuery.value) {
    searchQuery.value = queryQ
    void executeSearch(queryQ)
  }
  const queryTab = typeof route.query?.tab === 'string' ? route.query.tab.trim() : ''
  if (VALID_TABS.includes(queryTab as FilterTabKey)) {
    activeTab.value = queryTab as FilterTabKey
  }
}

watch(
  () => [route.query?.q, route.query?.tab],
  () => {
    syncFromQuery()
  }
)

const hasResults = computed(() => {
  if (activeTab.value === 'songs') return songs.value.length > 0
  if (activeTab.value === 'albums') return albums.value.length > 0
  if (activeTab.value === 'artists') return artists.value.length > 0
  if (activeTab.value === 'playlists') return playlists.value.length > 0
  return songs.value.length > 0 || albums.value.length > 0 || artists.value.length > 0 || playlists.value.length > 0
})

function getCount(key: string): number | null {
  if (key === 'songs') return songs.value.length || null
  if (key === 'albums') return albums.value.length || null
  if (key === 'artists') return artists.value.length || null
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
    artists.value = []
    playlists.value = []
  }
})

function extractArtist(item: any): string {
  if (typeof item?.artist === 'string' && item.artist.trim()) return item.artist.trim()
  if (Array.isArray(item?.artist_credits) && item.artist_credits.length > 0) {
    const names = item.artist_credits
      .map((c: any) => c?.artist?.name || c?.name || c?.display_name)
      .filter((n: any): n is string => typeof n === 'string' && Boolean(n.trim()))
    if (names.length > 0) return names.join(' / ')
  }
  if (Array.isArray(item?.artists) && item.artists.length > 0) {
    const names = item.artists
      .map((a: any) => a?.name || a?.display_name)
      .filter((n: any): n is string => typeof n === 'string' && Boolean(n.trim()))
    if (names.length > 0) return names.join(' / ')
  }
  return '未知艺术家'
}

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
        artist: extractArtist(item),
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
        artist: extractArtist(item),
        year: item.year || item.release_year || '',
        cover_url: item.cover_url || '',
      }))
    } else {
      albums.value = []
    }

    // Artists
    if (data.artists && Array.isArray(data.artists)) {
      artists.value = data.artists.map((item: any) => ({
        id: item.id,
        name: item.name || item.display_name || '歌手',
        avatar_url: item.image_url || item.avatar_url || '',
        nationality: item.nationality || '',
      }))
    } else {
      artists.value = []
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
    artists.value = []
    playlists.value = []
  } finally {
    loading.value = false
  }
}

async function loadRecommended() {
  if (props.initialSongs !== undefined || props.initialAlbums !== undefined) return
  recommendedLoading.value = true
  try {
    const [songsRes, albumsRes, artistsRes] = await Promise.allSettled([
      listMusicSongs({ page: 1, page_size: 6 }),
      listMusicAlbums({ page: 1, page_size: 6 }),
      listMusicArtists({ page: 1, page_size: 8 }),
    ])

    if (songsRes.status === 'fulfilled' && songsRes.value?.data?.length) {
      recommendedSongs.value = songsRes.value.data.map((item: any) => ({
        id: item.id,
        title: item.title,
        artist: extractArtist(item),
        album: typeof item.album === 'string' ? item.album : item.album?.title || '',
        duration: item.duration_sec ?? item.duration_seconds ?? item.duration ?? 0,
        audio_url: item.audio_url || '',
        cover_url: item.cover_url || item.album?.cover_url || '',
      }))
    }

    if (albumsRes.status === 'fulfilled' && albumsRes.value?.data?.length) {
      recommendedAlbums.value = albumsRes.value.data.map((item: any) => ({
        id: item.id,
        title: item.title,
        artist: extractArtist(item),
        year: item.year || item.release_year || '',
        cover_url: item.cover_url || '',
      }))
    }

    if (artistsRes.status === 'fulfilled' && artistsRes.value?.data?.length) {
      recommendedArtists.value = artistsRes.value.data.map((item: any) => ({
        id: item.id,
        name: item.name || item.display_name || '歌手',
        avatar_url: item.image_url || item.avatar_url || '',
        nationality: item.nationality || '',
      }))
    }
  } catch {
    // Graceful fallback
  } finally {
    recommendedLoading.value = false
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
    audio_url: song.audio_url || '/audio/1.mp3',
    cover_url: song.cover_url || '',
  }
  player.playSong(playerSong)
}

function openAlbum(id: string) {
  void router.push(`/music/album/${id}`)
}

function openArtist(id: string) {
  void router.push(`/music/artist/${id}`)
}

function openPlaylist(id: string) {
  void router.push(`/music/playlist/${id}`)
}

onMounted(() => {
  syncFromQuery()
  void loadRecommended()
})
</script>

<style scoped>
.mobile-music-search {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background-color: #ffffff;
  padding-bottom: var(--mobile-music-page-bottom, 2rem);
}

.mobile-music-search__rec-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.mobile-music-search__rec-grid-artists {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
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

.mobile-music-search__rec-section {
  margin-top: 24px;
}

.mobile-music-search__rec-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.mobile-music-search__more-link {
  font-size: 12px;
  color: var(--a-color-text-secondary, #777777);
  text-decoration: none;
}

.mobile-music-search__rec-scroll {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 6px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.mobile-music-search__rec-scroll::-webkit-scrollbar {
  display: none;
}

.mobile-music-search__rec-album-card {
  width: 104px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  cursor: pointer;
}

.mobile-music-search__rec-album-cover {
  position: relative;
  width: 104px;
  height: 104px;
  border-radius: 4px;
  overflow: hidden;
  background: #fbfbfb;
  border: 1px solid var(--a-color-border-soft, #eeeeee);
}

.mobile-music-search__rec-album-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-music-search__rec-album-art {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-text-muted, #999999);
}

.mobile-music-search__rec-album-year {
  position: absolute;
  bottom: 4px;
  right: 4px;
  font-size: 9px;
  padding: 1px 3px;
  background: rgba(0, 0, 0, 0.6);
  color: #ffffff;
  border-radius: 2px;
  font-family: monospace;
}

.mobile-music-search__rec-album-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--a-color-text, #111111);
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-music-search__rec-album-artist {
  font-size: 11px;
  color: var(--a-color-text-secondary, #777777);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-music-search__rec-artist-card {
  width: 68px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  cursor: pointer;
}

.mobile-music-search__rec-artist-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  overflow: hidden;
  background: #f5f5f5;
  border: 1px solid var(--a-color-border-soft, #eeeeee);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 6px;
}

.mobile-music-search__rec-artist-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-music-search__rec-artist-art {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-text-muted, #999999);
}

.mobile-music-search__rec-artist-name {
  font-size: 11px;
  font-weight: 500;
  color: var(--a-color-text, #111111);
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
.mobile-music-search__artist-list,
.mobile-music-search__playlist-list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--a-color-border-soft, #f0f0f0);
  border-radius: 4px;
  overflow: hidden;
  background: #ffffff;
}

.mobile-music-search__artist-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--a-color-border-soft, #f7f7f7);
  cursor: pointer;
}

.mobile-music-search__artist-item:last-child {
  border-bottom: none;
}

.mobile-music-search__artist-item:active {
  background-color: var(--a-color-surface-hover, #fafafa);
}

.mobile-music-search__artist-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  background: #f5f5f5;
  border: 1px solid var(--a-color-border-soft, #eeeeee);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.mobile-music-search__artist-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-music-search__artist-art {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-text-muted, #999999);
}

.mobile-music-search__artist-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mobile-music-search__artist-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--a-color-text, #111111);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-music-search__artist-sub {
  font-size: 11px;
  color: var(--a-color-text-secondary, #777777);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
