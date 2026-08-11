<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { Clock3, ListMusic, Music2, Disc3, Users } from 'lucide-vue-next'
import {
  listMusicLibrary,
  type MusicAlbumBookmark,
  type MusicAlbumListItem,
  type MusicArtistBookmark,
  type MusicArtistListItem,
  type MusicPlaylistBookmark,
  type MusicPlaylistSummary,
  type MusicSongBookmark,
  type MusicSongListItem,
} from '@/api/musicV1'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PInput from '@/components/ui/PInput.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PButton from '@/components/ui/PButton.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { useRequestGeneration } from '@/composables/useRequestGeneration'
import { usePlayerStore } from '@/stores/player'
import { useAuthStore } from '@/stores/auth'
import type { Song } from '@/types'

import { getActivePinia } from 'pinia'

type LibraryKind = 'song' | 'album' | 'artist' | 'playlist' | 'later'
type LibrarySongEnvelope = MusicSongBookmark | { song?: MusicSongListItem }
const kind = ref<LibraryKind>('song')
const sort = ref<'latest' | 'popular' | 'name'>('latest')
const query = ref('')
const requestedQuery = ref('')
const loading = ref(false)
const loadingMore = ref(false)
const error = ref('')
const page = ref(1)
const hasMore = ref(false)
const songs = ref<MusicSongListItem[]>([])
const albums = ref<MusicAlbumListItem[]>([])
const artists = ref<MusicArtistListItem[]>([])
const playlists = ref<MusicPlaylistSummary[]>([])
const { openAlbum, openArtist, openPlaylist } = useMusicDrawers()
const player = usePlayerStore()
const authStore = getActivePinia() ? useAuthStore() : { isAuthenticated: true }
const requests = useRequestGeneration()

const options = [
  { label: '歌曲', value: 'song' }, { label: '专辑', value: 'album' },
  { label: '艺人', value: 'artist' }, { label: '歌单', value: 'playlist' },
  { label: '稍后播放', value: 'later' },
]
let queryTimer: ReturnType<typeof setTimeout> | undefined

function playable(song: MusicSongListItem): Song {
  return { id: song.id, title: song.title, artist: song.artists?.map(item => item.name).join(' / ') || '未知艺术家', album: song.album?.title || '', album_id: song.album?.id || '', year: 0, release_date: '', lyrics: song.lyrics || '', audio_url: song.audio_url || '', cover_url: song.cover_url || song.album?.cover_url || '', status: 'approved' }
}

async function load(nextPage = 1) {
  if (authStore && !authStore.isAuthenticated) return
  if (nextPage > 1 && (loading.value || loadingMore.value || !hasMore.value)) return
  const requestedKind = kind.value
  const requestedSort = sort.value
  const keyword = requestedQuery.value
  const { isCurrent } = requests.beginRequest()
  if (nextPage > 1) {
    loadingMore.value = true
  } else {
    page.value = 1
    hasMore.value = false
    loadingMore.value = false
    loading.value = true
  }
  error.value = ''
  try {
    if (requestedKind === 'song' || requestedKind === 'later') {
      const response = await listMusicLibrary<LibrarySongEnvelope>(requestedKind, { q: keyword, sort: requestedSort, page: nextPage, page_size: 24 })
      const rows = response.data.map(item => item.song).filter((song): song is MusicSongListItem => Boolean(song))
      if (!isCurrent()) return
      songs.value = nextPage === 1 ? rows : [...songs.value, ...rows]
      hasMore.value = Boolean(response.meta?.has_more ?? (response.meta as any)?.hasMore)
    } else if (requestedKind === 'album') {
      const response = await listMusicLibrary<MusicAlbumBookmark>('album', { q: keyword, sort: requestedSort, page: nextPage, page_size: 24 })
      const rows = response.data.map(item => item.album).filter((album): album is MusicAlbumListItem => Boolean(album))
      if (!isCurrent()) return
      albums.value = nextPage === 1 ? rows : [...albums.value, ...rows]
      hasMore.value = Boolean(response.meta?.has_more ?? (response.meta as any)?.hasMore)
    } else if (requestedKind === 'artist') {
      const response = await listMusicLibrary<MusicArtistBookmark>('artist', { q: keyword, sort: requestedSort, page: nextPage, page_size: 24 })
      const rows = response.data.map(item => item.artist).filter((artist): artist is MusicArtistListItem => Boolean(artist))
      if (!isCurrent()) return
      artists.value = nextPage === 1 ? rows : [...artists.value, ...rows]
      hasMore.value = Boolean(response.meta?.has_more ?? (response.meta as any)?.hasMore)
    } else {
      const response = await listMusicLibrary<MusicPlaylistBookmark>('playlist', { q: keyword, sort: requestedSort, page: nextPage, page_size: 24 })
      const rows = response.data.map(item => item.playlist).filter((playlist): playlist is MusicPlaylistSummary => Boolean(playlist))
      if (!isCurrent()) return
      playlists.value = nextPage === 1 ? rows : [...playlists.value, ...rows]
      hasMore.value = Boolean(response.meta?.has_more ?? (response.meta as any)?.hasMore)
    }
    page.value = nextPage
  } catch { if (isCurrent()) error.value = '收藏加载失败' } finally { if (isCurrent()) { loading.value = false; loadingMore.value = false } }
}
watch([kind, sort], () => { void load() }, { flush: 'sync' })
watch(
  () => authStore.isAuthenticated,
  (authenticated) => {
    requests.beginRequest()
    loading.value = false
    loadingMore.value = false
    songs.value = []
    albums.value = []
    artists.value = []
    playlists.value = []
    page.value = 1
    hasMore.value = false
    if (authenticated) void load()
  },
  { immediate: true },
)
watch(query, value => {
  clearTimeout(queryTimer)
  queryTimer = setTimeout(() => {
    requestedQuery.value = value.trim()
    void load()
  }, 250)
})
onUnmounted(() => clearTimeout(queryTimer))
</script>

<template>
  <main class="music-library">
    <PPageHeader title="收藏" mb="0">
      <template #action>
        <PSegmentedControl v-model="kind" :options="options" />
      </template>
    </PPageHeader>

    <div v-if="authStore && !authStore.isAuthenticated" class="music-library__unauth">
      <PEmpty
        title="请登录后查看收藏库"
        description="登录账号以同步你的收藏歌曲、专辑、艺术家和歌单。"
      >
        <template #action>
          <RouterLink to="/login" class="a-btn a-btn--primary">立即登录</RouterLink>
        </template>
      </PEmpty>
    </div>

    <template v-else>
      <div class="music-library__sort">
        <button :class="{ active: sort === 'latest' }" @click="sort = 'latest'">最近收藏</button>
        <button :class="{ active: sort === 'name' }" @click="sort = 'name'">名称</button>
        <button :class="{ active: sort === 'popular' }" @click="sort = 'popular'">热度</button>
      </div>

      <PInput v-model="query" type="search" placeholder="搜索收藏" aria-label="搜索收藏" />

      <p v-if="loading" class="state">正在加载...</p>
      <p v-else-if="error" class="state error">{{ error }}</p>
      <PEmpty
        v-else-if="kind === 'album' ? !albums.length : kind === 'artist' ? !artists.length : kind === 'playlist' ? !playlists.length : !songs.length"
        title="这里还没有收藏内容"
        description="浏览发现页面，收藏你喜爱的歌曲、专辑或艺术家。"
      />
      <div v-else class="music-library__list">
        <div v-for="song in songs" v-if="kind === 'song' || kind === 'later'" :key="song.id" class="music-library__row music-library__song-row">
          <button type="button" class="music-library__play" :disabled="!song.audio_url" :aria-label="`播放 ${song.title}`" @click="player.playSong(playable(song))"><Clock3 v-if="kind === 'later'" :size="18"/><Music2 v-else :size="18"/></button>
          <span><RouterLink :to="`/music/song/${song.id}`"><strong>{{ song.title }}</strong></RouterLink><small><template v-if="song.artists?.length"><template v-for="(artist, index) in song.artists" :key="artist.id"><span v-if="index" aria-hidden="true"> / </span><button type="button" :data-testid="`library-song-artist-${artist.id}`" @click="openArtist(String(artist.id))">{{ artist.name }}</button></template></template><span v-else>未知艺术家</span><template v-if="song.album?.id"><span aria-hidden="true"> · </span><button type="button" :data-testid="`library-song-album-${song.album.id}`" @click="openAlbum(String(song.album.id))">{{ song.album.title }}</button></template></small></span>
        </div>
        <button v-for="album in albums" v-else-if="kind === 'album'" :key="album.id" class="music-library__row" @click="openAlbum(album.id)"><Disc3 :size="18"/><span><strong>{{ album.title }}</strong><small>{{ album.artists?.map(item => item.name).join(' / ') }}</small></span></button>
        <button v-for="artist in artists" v-else-if="kind === 'artist'" :key="artist.id" class="music-library__row" @click="openArtist(artist.id)"><Users :size="18"/><span><strong>{{ artist.name }}</strong><small>{{ artist.legal_name || artist.bio }}</small></span></button>
        <button v-for="playlist in playlists" v-else :key="playlist.id" class="music-library__row" @click="openPlaylist(playlist.id)"><ListMusic :size="18"/><span><strong>{{ playlist.name }}</strong><small>{{ playlist.song_count }} 首</small></span></button>
      </div>
      <PButton v-if="hasMore && !loading" variant="secondary" class="music-library__more" :loading="loadingMore" @click="load(page + 1)">{{ loadingMore ? '正在加载' : '加载更多' }}</PButton>
    </template>
  </main>
</template>

<style scoped>
.music-library { display: grid; gap: 1.25rem; max-width: 56rem; margin: 0 auto; padding: 1.5rem 0 3rem; }
.music-library__unauth { padding: 3rem 0; }
.music-library__sort { display: flex; gap: 0.4rem; }
.music-library__sort button { border: 0; background: transparent; color: var(--a-color-muted); padding: 0.35rem 0.6rem; border-radius: var(--a-radius-control); cursor: pointer; transition: all 0.15s ease; }
.music-library__sort button.active { color: var(--a-color-fg); font-weight: 600; background: var(--a-color-surface-muted); }
.music-library__list { display: grid; gap: 0.5rem; }
.music-library__row { display: flex; align-items: center; gap: 0.8rem; min-height: 3.5rem; padding: 0.65rem 1rem; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-card); background: var(--a-color-bg); color: inherit; text-align: left; cursor: pointer; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
.music-library__row:hover { border-color: var(--a-color-border); box-shadow: var(--a-shadow-sm); background: var(--a-color-surface-muted); }
.music-library__row span { display: grid; gap: 0.18rem; min-width: 0; }
.music-library__row small, .state { color: var(--a-color-muted); }
.music-library__song-row { cursor: default; }
.music-library__play, .music-library__song-row small button { border: 0; padding: 0; background: transparent; color: inherit; cursor: pointer; }
.music-library__play { display: grid; flex: 0 0 2.5rem; min-height: 2.5rem; place-items: center; border-radius: var(--a-radius-control); transition: background 0.15s ease; }
.music-library__play:hover:not(:disabled) { background: var(--a-color-surface-muted); }
.music-library__play:disabled { cursor: default; opacity: 0.45; }
.music-library__song-row a { color: inherit; text-decoration: none; }
.music-library__song-row small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.music-library__song-row small button { font: inherit; }
.music-library__song-row a:hover, .music-library__song-row small button:hover { text-decoration: underline; }
.music-library__more { justify-self: center; margin-top: 1rem; }
.state { text-align: center; padding: 2rem 0; color: var(--a-color-muted); }
.error { color: var(--a-color-accent-destructive); }
</style>
