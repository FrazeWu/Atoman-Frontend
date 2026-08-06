<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ListMusic, Music2, Disc3, Users } from 'lucide-vue-next'
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

type LibraryKind = 'song' | 'album' | 'artist' | 'playlist'
const kind = ref<LibraryKind>('song')
const sort = ref<'latest' | 'popular'>('latest')
const query = ref('')
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
]
const items = computed(() => ({ song: songs.value, album: albums.value, artist: artists.value, playlist: playlists.value })[kind.value])
const filteredItems = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase()
  if (!keyword) return items.value
  return items.value.filter(item => {
    if ('title' in item) return `${item.title} ${'artists' in item ? item.artists?.map(artist => artist.name).join(' ') || '' : ''}`.toLocaleLowerCase().includes(keyword)
    if ('name' in item) return `${item.name} ${'legal_name' in item ? item.legal_name || '' : ''}`.toLocaleLowerCase().includes(keyword)
    return false
  })
})

function playable(song: MusicSongListItem): Song {
  return { id: song.id, title: song.title, artist: song.artists?.map(item => item.name).join(' / ') || '未知艺术家', album: song.album?.title || '', album_id: song.album?.id || '', year: 0, release_date: '', lyrics: song.lyrics || '', audio_url: song.audio_url || '', cover_url: song.cover_url || song.album?.cover_url || '', status: 'approved' }
}

async function load(nextPage = 1) {
  const requestedKind = kind.value
  const requestedSort = sort.value
  const { isCurrent } = requests.beginRequest()
  if (nextPage > 1) loadingMore.value = true
  else loading.value = true
  error.value = ''
  try {
    if (requestedKind === 'song') {
      const response = await listMusicLibrary<MusicSongBookmark>('song', { sort: requestedSort, page: nextPage, page_size: 24 })
      const rows = response.data.map(item => item.song).filter((song): song is MusicSongListItem => Boolean(song))
      if (!isCurrent()) return
      songs.value = nextPage === 1 ? rows : [...songs.value, ...rows]
      hasMore.value = response.meta.has_more
    } else if (requestedKind === 'album') {
      const response = await listMusicLibrary<MusicAlbumBookmark>('album', { sort: requestedSort, page: nextPage, page_size: 24 })
      const rows = response.data.map(item => item.album).filter((album): album is MusicAlbumListItem => Boolean(album))
      if (!isCurrent()) return
      albums.value = nextPage === 1 ? rows : [...albums.value, ...rows]
      hasMore.value = response.meta.has_more
    } else if (requestedKind === 'artist') {
      const response = await listMusicLibrary<MusicArtistBookmark>('artist', { sort: requestedSort, page: nextPage, page_size: 24 })
      const rows = response.data.map(item => item.artist).filter((artist): artist is MusicArtistListItem => Boolean(artist))
      if (!isCurrent()) return
      artists.value = nextPage === 1 ? rows : [...artists.value, ...rows]
      hasMore.value = response.meta.has_more
    } else {
      const response = await listMusicLibrary<MusicPlaylistBookmark>('playlist', { sort: requestedSort, page: nextPage, page_size: 24 })
      const rows = response.data.map(item => item.playlist).filter((playlist): playlist is MusicPlaylistSummary => Boolean(playlist))
      if (!isCurrent()) return
      playlists.value = nextPage === 1 ? rows : [...playlists.value, ...rows]
      hasMore.value = response.meta.has_more
    }
    page.value = nextPage
  } catch { if (isCurrent()) error.value = '音乐库加载失败' } finally { if (isCurrent()) { loading.value = false; loadingMore.value = false } }
}
watch([kind, sort], () => { void load() }); onMounted(() => { void load() })
</script>

<template>
  <main class="music-library">
    <PPageHeader title="音乐库" mb="0"><template #action><PSegmentedControl v-model="kind" :options="options" /></template></PPageHeader>
    <div class="music-library__sort"><button :class="{ active: sort === 'latest' }" @click="sort = 'latest'">最近收藏</button><button :class="{ active: sort === 'popular' }" @click="sort = 'popular'">热度</button></div>
    <input v-model="query" class="music-library__search" type="search" placeholder="搜索音乐库" aria-label="搜索音乐库">
    <p v-if="loading" class="state">正在加载</p><p v-else-if="error" class="state error">{{ error }}</p><p v-else-if="!filteredItems.length" class="state">这里还没有内容</p>
    <div v-else class="music-library__list">
      <button v-for="song in filteredItems as MusicSongListItem[]" v-if="kind === 'song'" :key="song.id" class="music-library__row" :disabled="!song.audio_url" @click="player.playSong(playable(song))"><Music2 :size="18"/><span><strong>{{ song.title }}</strong><small>{{ song.artists?.map(item => item.name).join(' / ') || '未知艺术家' }}</small></span></button>
      <button v-for="album in filteredItems as MusicAlbumListItem[]" v-else-if="kind === 'album'" :key="album.id" class="music-library__row" @click="openAlbum(album.id)"><Disc3 :size="18"/><span><strong>{{ album.title }}</strong><small>{{ album.artists?.map(item => item.name).join(' / ') }}</small></span></button>
      <button v-for="artist in filteredItems as MusicArtistListItem[]" v-else-if="kind === 'artist'" :key="artist.id" class="music-library__row" @click="openArtist(artist.id)"><Users :size="18"/><span><strong>{{ artist.name }}</strong><small>{{ artist.legal_name || artist.bio }}</small></span></button>
      <button v-for="playlist in filteredItems as MusicPlaylistSummary[]" v-else :key="playlist.id" class="music-library__row" @click="openPlaylist(playlist.id)"><ListMusic :size="18"/><span><strong>{{ playlist.name }}</strong><small>{{ playlist.song_count }} 首</small></span></button>
    </div>
    <button v-if="hasMore" type="button" class="music-library__more" :disabled="loadingMore" @click="load(page + 1)">{{ loadingMore ? '正在加载' : '加载更多' }}</button>
  </main>
</template>

<style scoped>
.music-library{display:grid;gap:1rem}.music-library__sort{display:flex;gap:.4rem}.music-library__sort button,.music-library__more{border:0;background:transparent;color:var(--a-color-muted);padding:.35rem 0;cursor:pointer}.music-library__sort button+button{border-left:1px solid var(--a-color-border-soft);padding-left:.5rem}.music-library__sort .active{color:var(--a-color-text)}.music-library__search{min-height:2.75rem;padding:.6rem .75rem;border:1px solid var(--a-color-border-soft);background:var(--a-color-bg);color:inherit}.music-library__list{display:grid;border-top:1px solid var(--a-color-border-soft)}.music-library__row{display:flex;align-items:center;gap:.8rem;min-height:4rem;padding:.65rem 0;border:0;border-bottom:1px solid var(--a-color-border-soft);background:transparent;color:inherit;text-align:left;cursor:pointer}.music-library__row span{display:grid;gap:.18rem;min-width:0}.music-library__row small,.state{color:var(--a-color-muted)}.error{color:var(--a-color-accent-destructive)}
</style>
