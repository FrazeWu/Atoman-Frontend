<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { Music2, Play, X } from 'lucide-vue-next'
import {
  deleteAlbumBookmark,
  deleteArtistBookmark,
  deletePlaylistBookmark,
  listMusicLibrary,
  listMusicPlaylists,
  removeMusicSongFromLater,
  type MusicAlbumBookmark,
  type MusicAlbumListItem,
  type MusicArtistBookmark,
  type MusicArtistListItem,
  type MusicPlaylistBookmark,
  type MusicPlaylistSummary,
  type MusicSongListItem,
} from '@/api/musicV1'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PInput from '@/components/ui/PInput.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PButton from '@/components/ui/PButton.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import { MusicAlbumCard, MusicArtistCard, MusicPlaylistCard } from '@/components/music'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { useRequestGeneration } from '@/composables/useRequestGeneration'
import { usePlayerStore } from '@/stores/player'
import { useAuthStore } from '@/stores/auth'
import type { Song } from '@/types'
import { getMountedPinia } from '@/utils/pinia'

type LibraryKind = 'album' | 'artist' | 'playlist' | 'later'
type LibrarySongEnvelope = { song?: MusicSongListItem }
const kind = ref<LibraryKind>('album')
const sort = ref<'latest' | 'popular' | 'name'>('latest')
const query = ref('')
const requestedQuery = ref('')
const loading = ref(false)
const loadingMore = ref(false)
const error = ref('')
const page = ref(1)
const hasMore = ref(false)
const libraryMeta = ref({ page: 1, page_size: 24, total: 0, has_more: false })
const songs = ref<MusicSongListItem[]>([])
const albums = ref<MusicAlbumListItem[]>([])
const artists = ref<MusicArtistListItem[]>([])
const playlists = ref<MusicPlaylistSummary[]>([])
const favoritePlaylistId = ref('')
const removingKey = ref('')
const playingAll = ref(false)
const { openAlbum, openArtist, openPlaylist } = useMusicDrawers()
const player = usePlayerStore()
const authStore = getMountedPinia() ? useAuthStore() : { isAuthenticated: true }
const requests = useRequestGeneration()
const playableSongs = computed(() => songs.value.filter(song => Boolean(song.audio_url)).map(playable))

const options = [
  { label: '专辑', value: 'album' }, { label: '艺人', value: 'artist' },
  { label: '歌单', value: 'playlist' },
  { label: '稍后播放', value: 'later' },
]
let queryTimer: ReturnType<typeof setTimeout> | undefined

function playable(song: MusicSongListItem): Song {
  return { id: song.id, title: song.title, artist: song.artists?.map(item => item.name).join(' / ') || '未知艺术家', album: song.album?.title || '', album_id: song.album?.id || '', year: 0, release_date: '', lyrics: song.lyrics || '', audio_url: song.audio_url || '', waveform_peaks: song.waveform_peaks, cover_url: song.cover_url || song.album?.cover_url || '', status: 'open' }
}

function playlistCardItem(playlist: MusicPlaylistSummary) {
  return { ...playlist, title: playlist.name }
}

async function playAllLater() {
  if (playingAll.value || !playableSongs.value.length) return
  player.playAlbum(playableSongs.value)
  playingAll.value = true
  error.value = ''
  try {
    const allSongs = [...songs.value]
    let nextPage = page.value + 1
    let more = hasMore.value
    while (more) {
      const response = await listMusicLibrary<LibrarySongEnvelope>('later', {
        q: requestedQuery.value,
        sort: sort.value,
        page: nextPage,
        page_size: 24,
      })
      const nextSongs = response.data.map(item => item.song).filter((song): song is MusicSongListItem => Boolean(song))
      allSongs.push(...nextSongs)
      nextSongs.filter(song => Boolean(song.audio_url)).map(playable).forEach(song => player.addToQueue(song))
      more = Boolean(response.meta?.has_more ?? (response.meta as any)?.hasMore)
      nextPage += 1
    }
    songs.value = allSongs
    page.value = nextPage - 1
    hasMore.value = false
  } catch {
    error.value = '加载剩余稍后内容失败'
  } finally {
    playingAll.value = false
  }
}

async function removeLibraryItem(itemKind: LibraryKind, id: string) {
  const key = `${itemKind}:${id}`
  if (removingKey.value) return
  removingKey.value = key
  error.value = ''
  try {
    if (itemKind === 'later') {
      await removeMusicSongFromLater(id)
      songs.value = songs.value.filter(item => String(item.id) !== id)
    } else if (itemKind === 'album') {
      await deleteAlbumBookmark(id)
      albums.value = albums.value.filter(item => String(item.id) !== id)
    } else if (itemKind === 'artist') {
      await deleteArtistBookmark(id)
      artists.value = artists.value.filter(item => String(item.id) !== id)
    } else {
      await deletePlaylistBookmark(id)
      playlists.value = playlists.value.filter(item => String(item.id) !== id)
    }
  } catch {
    error.value = itemKind === 'later' ? '移出稍后播放失败' : '取消收藏失败'
  } finally {
    removingKey.value = ''
  }
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
    if (requestedKind === 'later') {
      const response = await listMusicLibrary<LibrarySongEnvelope>(requestedKind, { q: keyword, sort: requestedSort, page: nextPage, page_size: 24 })
      const rows = response.data.map(item => item.song).filter((song): song is MusicSongListItem => Boolean(song))
      if (!isCurrent()) return
      songs.value = rows
      hasMore.value = Boolean(response.meta?.has_more ?? (response.meta as any)?.hasMore)
      libraryMeta.value = response.meta
    } else if (requestedKind === 'album') {
      const response = await listMusicLibrary<MusicAlbumBookmark>('album', { q: keyword, sort: requestedSort, page: nextPage, page_size: 24 })
      const rows = response.data.map(item => item.album).filter((album): album is MusicAlbumListItem => Boolean(album))
      if (!isCurrent()) return
      albums.value = rows
      hasMore.value = Boolean(response.meta?.has_more ?? (response.meta as any)?.hasMore)
      libraryMeta.value = response.meta
    } else if (requestedKind === 'artist') {
      const response = await listMusicLibrary<MusicArtistBookmark>('artist', { q: keyword, sort: requestedSort, page: nextPage, page_size: 24 })
      const rows = response.data.map(item => item.artist).filter((artist): artist is MusicArtistListItem => Boolean(artist))
      if (!isCurrent()) return
      artists.value = rows
      hasMore.value = Boolean(response.meta?.has_more ?? (response.meta as any)?.hasMore)
      libraryMeta.value = response.meta
    } else {
      const [response, ownedResponse] = await Promise.all([
        listMusicLibrary<MusicPlaylistBookmark>('playlist', { q: keyword, sort: requestedSort, page: nextPage, page_size: 24 }),
        nextPage === 1 ? listMusicPlaylists({ page: 1, page_size: 100 }) : Promise.resolve(null),
      ])
      const rows = response.data.map(item => item.playlist).filter((playlist): playlist is MusicPlaylistSummary => Boolean(playlist))
      const favorite = ownedResponse?.data.find(playlist => (
        playlist.kind === 'favorite'
        && (!keyword || playlist.name.toLocaleLowerCase().includes(keyword.toLocaleLowerCase()))
      ))
      favoritePlaylistId.value = favorite ? String(favorite.id) : favoritePlaylistId.value
      const pageRows = favorite && !rows.some(playlist => String(playlist.id) === String(favorite.id))
        ? [favorite, ...rows]
        : rows
      if (!isCurrent()) return
      playlists.value = pageRows
      hasMore.value = Boolean(response.meta?.has_more ?? (response.meta as any)?.hasMore)
      libraryMeta.value = response.meta
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
        description="登录账号以同步你的专辑、艺术家和歌单。"
      >
        <template #action>
          <RouterLink to="/login" class="a-btn a-btn--primary">立即登录</RouterLink>
        </template>
      </PEmpty>
    </div>

    <template v-else>
      <div class="music-library__toolbar">
        <div class="music-library__sort">
          <button :class="{ active: sort === 'latest' }" @click="sort = 'latest'">最近收藏</button>
          <button :class="{ active: sort === 'name' }" @click="sort = 'name'">名称</button>
          <button :class="{ active: sort === 'popular' }" @click="sort = 'popular'">热度</button>
        </div>
        <PButton
          v-if="kind === 'later'"
          variant="primary"
          :disabled="!playableSongs.length"
          :loading="playingAll"
          data-testid="library-later-play-all"
          @click="playAllLater"
        ><Play :size="16" aria-hidden="true" />播放全部</PButton>
      </div>

      <PInput v-model="query" type="search" placeholder="搜索收藏" aria-label="搜索收藏" />

      <p v-if="loading" class="state">正在加载...</p>
      <p v-else-if="error" class="state error">{{ error }}</p>
      <PEmpty
        v-else-if="kind === 'album' ? !albums.length : kind === 'artist' ? !artists.length : kind === 'playlist' ? !playlists.length : !songs.length"
        title="这里还没有收藏内容"
        description="浏览发现页面，收藏你喜爱的专辑、艺术家或歌单。"
      />
      <div v-else class="music-library__cards">
        <article v-for="song in songs" v-if="kind === 'later'" :key="song.id" class="music-library__song-card" data-testid="library-song-card">
          <div class="music-library__song-cover">
            <button type="button" class="music-library__song-play" :disabled="!song.audio_url" :aria-label="`播放 ${song.title}`" @click="player.playSong(playable(song))">
              <img v-if="song.cover_url || song.album?.cover_url" :src="song.cover_url || song.album?.cover_url" :alt="song.title" loading="lazy" />
              <span v-else class="music-library__song-placeholder" aria-hidden="true"><Music2 :size="28" /></span>
              <span v-if="song.audio_url" class="music-library__play-indicator" aria-hidden="true"><Play :size="18" fill="currentColor" /></span>
            </button>
            <button
              type="button"
              class="music-library__later-remove"
              :disabled="removingKey === `later:${song.id}`"
              :aria-label="`取消稍后播放 ${song.title}`"
              title="取消稍后播放"
              @click="removeLibraryItem('later', String(song.id))"
            ><X :size="18" aria-hidden="true" /></button>
          </div>
          <div class="music-library__song-info">
            <h3><RouterLink :to="`/music/song/${song.id}`">{{ song.title }}</RouterLink></h3>
            <p>
              <template v-if="song.artists?.length"><template v-for="(artist, index) in song.artists" :key="artist.id"><span v-if="index" aria-hidden="true"> / </span><button type="button" :data-testid="`library-song-artist-${artist.id}`" @click="openArtist(String(artist.id))">{{ artist.name }}</button></template></template><span v-else>未知艺术家</span><template v-if="song.album?.id"><span aria-hidden="true"> · </span><button type="button" :data-testid="`library-song-album-${song.album.id}`" @click="openAlbum(String(song.album.id))">{{ song.album.title }}</button></template>
            </p>
          </div>
        </article>

        <MusicAlbumCard
          v-for="album in albums"
          v-else-if="kind === 'album'"
          :key="album.id"
          :album="album"
          :is-bookmarked="true"
          data-testid="library-album-card"
          @click="openAlbum(String(album.id))"
          @click-artist="openArtist"
          @toggle-bookmark="removeLibraryItem('album', String(album.id))"
        />

        <MusicArtistCard
          v-for="artist in artists"
          v-else-if="kind === 'artist'"
          :key="artist.id"
          :artist="artist"
          :is-bookmarked="true"
          data-testid="library-artist-card"
          @click="openArtist(String(artist.id))"
          @toggle-bookmark="removeLibraryItem('artist', String(artist.id))"
        />

        <MusicPlaylistCard
          v-for="playlist in playlists"
          v-else
          :key="playlist.id"
          :playlist="playlistCardItem(playlist)"
          :is-bookmarked="String(playlist.id) !== favoritePlaylistId"
          :show-bookmark-button="String(playlist.id) !== favoritePlaylistId"
          data-testid="library-playlist-card"
          @click="openPlaylist(String(playlist.id))"
          @toggle-bookmark="removeLibraryItem('playlist', String(playlist.id))"
        />
      </div>
      <PaginationBar
        v-if="libraryMeta.total > 0"
        :meta="libraryMeta"
        :loading="loading || loadingMore"
        @change="load"
      />
    </template>
  </main>
</template>

<style scoped>
.music-library { display: grid; gap: 1.25rem; max-width: 72rem; margin: 0 auto; padding: 1.5rem 0 3rem; }
.music-library__unauth { padding: 3rem 0; }
.music-library__toolbar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.music-library__sort { display: flex; gap: 0.4rem; }
.music-library__sort button { border: 0; background: transparent; color: var(--a-color-muted); padding: 0.35rem 0.6rem; border-radius: var(--a-radius-control); cursor: pointer; transition: all 0.15s ease; }
.music-library__sort button.active { color: var(--a-color-fg); font-weight: 600; background: var(--a-color-surface-muted); }
.music-library__cards { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 1.25rem; }
.music-library__cards > * { min-width: 0; align-self: start; }
.music-library__cards :deep(.bookmark-btn) { opacity: 1; }
.music-library__song-card { display: grid; gap: 0.75rem; min-width: 0; }
.music-library__song-cover { position: relative; aspect-ratio: 1; overflow: hidden; border: 1px solid var(--a-color-border-soft); border-radius: 4px; background: var(--a-color-surface); }
.music-library__song-play { position: absolute; inset: 0; width: 100%; height: 100%; padding: 0; border: 0; background: transparent; color: inherit; cursor: pointer; }
.music-library__song-play:disabled { cursor: default; }
.music-library__song-play img, .music-library__song-placeholder { width: 100%; height: 100%; display: grid; place-items: center; object-fit: cover; color: var(--a-color-muted); background: var(--a-color-surface-muted); }
.music-library__play-indicator { position: absolute; left: 0.6rem; bottom: 0.6rem; display: grid; width: 2.25rem; height: 2.25rem; place-items: center; border-radius: 50%; background: var(--a-color-bg); color: var(--a-color-fg); box-shadow: var(--a-shadow-sm); }
.music-library__later-remove { position: absolute; z-index: 2; top: 0.5rem; right: 0.5rem; display: grid; width: 2.75rem; height: 2.75rem; place-items: center; padding: 0; border: 1px solid var(--a-color-border-soft); border-radius: 50%; background: var(--a-color-bg); color: var(--a-color-muted); cursor: pointer; box-shadow: var(--a-shadow-sm); }
.music-library__later-remove:hover { color: var(--a-color-accent-destructive); }
.music-library__later-remove:disabled { cursor: default; opacity: 0.55; }
.music-library__song-info { display: grid; gap: 0.25rem; min-width: 0; }
.music-library__song-info h3, .music-library__song-info p { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.music-library__song-info h3 { font-size: 1rem; font-weight: 500; }
.music-library__song-info p { color: var(--a-color-muted); font-size: 0.82rem; }
.music-library__song-info a, .music-library__song-info button { border: 0; padding: 0; background: transparent; color: inherit; font: inherit; text-decoration: none; cursor: pointer; }
.music-library__song-info a:hover, .music-library__song-info button:hover { text-decoration: underline; }
.music-library__song-play:focus-visible, .music-library__later-remove:focus-visible, .music-library__song-info a:focus-visible, .music-library__song-info button:focus-visible { outline: 2px solid var(--a-color-focus, var(--a-color-text)); outline-offset: 2px; }
.music-library__more { justify-self: center; margin-top: 1rem; }
.state { text-align: center; padding: 2rem 0; color: var(--a-color-muted); }
.error { color: var(--a-color-accent-destructive); }

@media (max-width: 1100px) {
  .music-library__cards { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}

@media (max-width: 720px) {
  .music-library {
    padding-inline: 1rem;
  }

  .music-library__toolbar { align-items: stretch; flex-direction: column; }
  .music-library__cards { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
}
</style>
