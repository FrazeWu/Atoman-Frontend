<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
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
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { useRequestGeneration } from '@/composables/useRequestGeneration'
import { usePlayerStore } from '@/stores/player'
import type { Song } from '@/types'

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
      hasMore.value = response.meta.has_more
    } else if (requestedKind === 'album') {
      const response = await listMusicLibrary<MusicAlbumBookmark>('album', { q: keyword, sort: requestedSort, page: nextPage, page_size: 24 })
      const rows = response.data.map(item => item.album).filter((album): album is MusicAlbumListItem => Boolean(album))
      if (!isCurrent()) return
      albums.value = nextPage === 1 ? rows : [...albums.value, ...rows]
      hasMore.value = response.meta.has_more
    } else if (requestedKind === 'artist') {
      const response = await listMusicLibrary<MusicArtistBookmark>('artist', { q: keyword, sort: requestedSort, page: nextPage, page_size: 24 })
      const rows = response.data.map(item => item.artist).filter((artist): artist is MusicArtistListItem => Boolean(artist))
      if (!isCurrent()) return
      artists.value = nextPage === 1 ? rows : [...artists.value, ...rows]
      hasMore.value = response.meta.has_more
    } else {
      const response = await listMusicLibrary<MusicPlaylistBookmark>('playlist', { q: keyword, sort: requestedSort, page: nextPage, page_size: 24 })
      const rows = response.data.map(item => item.playlist).filter((playlist): playlist is MusicPlaylistSummary => Boolean(playlist))
      if (!isCurrent()) return
      playlists.value = nextPage === 1 ? rows : [...playlists.value, ...rows]
      hasMore.value = response.meta.has_more
    }
    page.value = nextPage
  } catch { if (isCurrent()) error.value = '收藏加载失败' } finally { if (isCurrent()) { loading.value = false; loadingMore.value = false } }
}
watch([kind, sort], () => { void load() }, { flush: 'sync' }); onMounted(() => { void load() })
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
    <PPageHeader title="收藏" mb="0"><template #action><PSegmentedControl v-model="kind" :options="options" /></template></PPageHeader>
    <div class="music-library__sort"><button :class="{ active: sort === 'latest' }" @click="sort = 'latest'">最近收藏</button><button :class="{ active: sort === 'name' }" @click="sort = 'name'">名称</button><button :class="{ active: sort === 'popular' }" @click="sort = 'popular'">热度</button></div>
    <input v-model="query" class="music-library__search" type="search" placeholder="搜索收藏" aria-label="搜索收藏">
    <p v-if="loading" class="state">正在加载</p><p v-else-if="error" class="state error">{{ error }}</p><p v-else-if="kind === 'album' ? !albums.length : kind === 'artist' ? !artists.length : kind === 'playlist' ? !playlists.length : !songs.length" class="state">这里还没有内容</p>
    <div v-else class="music-library__list">
      <div v-for="song in songs" v-if="kind === 'song' || kind === 'later'" :key="song.id" class="music-library__row music-library__song-row">
        <button type="button" class="music-library__play" :disabled="!song.audio_url" :aria-label="`播放 ${song.title}`" @click="player.playSong(playable(song))"><Clock3 v-if="kind === 'later'" :size="18"/><Music2 v-else :size="18"/></button>
        <span><RouterLink :to="`/music/song/${song.id}`"><strong>{{ song.title }}</strong></RouterLink><small><template v-if="song.artists?.length"><template v-for="(artist, index) in song.artists" :key="artist.id"><span v-if="index" aria-hidden="true"> / </span><button type="button" :data-testid="`library-song-artist-${artist.id}`" @click="openArtist(String(artist.id))">{{ artist.name }}</button></template></template><span v-else>未知艺术家</span><template v-if="song.album?.id"><span aria-hidden="true"> · </span><button type="button" :data-testid="`library-song-album-${song.album.id}`" @click="openAlbum(String(song.album.id))">{{ song.album.title }}</button></template></small></span>
      </div>
      <button v-for="album in albums" v-else-if="kind === 'album'" :key="album.id" class="music-library__row" @click="openAlbum(album.id)"><Disc3 :size="18"/><span><strong>{{ album.title }}</strong><small>{{ album.artists?.map(item => item.name).join(' / ') }}</small></span></button>
      <button v-for="artist in artists" v-else-if="kind === 'artist'" :key="artist.id" class="music-library__row" @click="openArtist(artist.id)"><Users :size="18"/><span><strong>{{ artist.name }}</strong><small>{{ artist.legal_name || artist.bio }}</small></span></button>
      <button v-for="playlist in playlists" v-else :key="playlist.id" class="music-library__row" @click="openPlaylist(playlist.id)"><ListMusic :size="18"/><span><strong>{{ playlist.name }}</strong><small>{{ playlist.song_count }} 首</small></span></button>
    </div>
    <button v-if="hasMore && !loading" type="button" class="music-library__more" :disabled="loading || loadingMore" @click="load(page + 1)">{{ loadingMore ? '正在加载' : '加载更多' }}</button>
  </main>
</template>

<style scoped>
.music-library{display:grid;gap:1rem}.music-library__sort{display:flex;gap:.4rem}.music-library__sort button,.music-library__more{border:0;background:transparent;color:var(--a-color-muted);padding:.35rem 0;cursor:pointer}.music-library__sort button+button{border-left:1px solid var(--a-color-border-soft);padding-left:.5rem}.music-library__sort .active{color:var(--a-color-text)}.music-library__search{min-height:2.75rem;padding:.6rem .75rem;border:1px solid var(--a-color-border-soft);background:var(--a-color-bg);color:inherit}.music-library__list{display:grid;border-top:1px solid var(--a-color-border-soft)}.music-library__row{display:flex;align-items:center;gap:.8rem;min-height:4rem;padding:.65rem 0;border:0;border-bottom:1px solid var(--a-color-border-soft);background:transparent;color:inherit;text-align:left;cursor:pointer}.music-library__row span{display:grid;gap:.18rem;min-width:0}.music-library__row small,.state{color:var(--a-color-muted)}.music-library__song-row{cursor:default}.music-library__play,.music-library__song-row small button{border:0;padding:0;background:transparent;color:inherit;cursor:pointer}.music-library__play{display:grid;flex:0 0 2.75rem;min-height:2.75rem;place-items:center}.music-library__play:disabled{cursor:default;opacity:.45}.music-library__song-row a{color:inherit;text-decoration:none}.music-library__song-row small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.music-library__song-row small button{font:inherit}.music-library__song-row a:hover,.music-library__song-row small button:hover{text-decoration:underline}.error{color:var(--a-color-accent-destructive)}
</style>
