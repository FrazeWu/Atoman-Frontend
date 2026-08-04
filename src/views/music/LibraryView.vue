<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ListMusic, Music2, Disc3, Users } from 'lucide-vue-next'
import {
  getMusicAlbum,
  getMusicArtist,
  listAlbumBookmarks,
  listArtistBookmarks,
  listPlaylistBookmarks,
  listSongBookmarks,
  type MusicAlbumListItem,
  type MusicArtistListItem,
  type MusicPlaylistSummary,
  type MusicSongListItem,
} from '@/api/musicV1'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { usePlayerStore } from '@/stores/player'
import type { Song } from '@/types'

type LibraryKind = 'song' | 'album' | 'artist' | 'playlist'
const kind = ref<LibraryKind>('song')
const sort = ref<'latest' | 'popular'>('latest')
const loading = ref(false)
const error = ref('')
const songs = ref<MusicSongListItem[]>([])
const albums = ref<MusicAlbumListItem[]>([])
const artists = ref<MusicArtistListItem[]>([])
const playlists = ref<MusicPlaylistSummary[]>([])
const { openAlbum, openArtist, openPlaylist } = useMusicDrawers()
const player = usePlayerStore()

const options = [
  { label: '歌曲', value: 'song' }, { label: '专辑', value: 'album' },
  { label: '艺人', value: 'artist' }, { label: '歌单', value: 'playlist' },
]
const items = computed(() => ({ song: songs.value, album: albums.value, artist: artists.value, playlist: playlists.value })[kind.value])

function playable(song: MusicSongListItem): Song {
  return { id: song.id, title: song.title, artist: song.artists?.map(item => item.name).join(' / ') || '未知艺术家', album: song.album?.title || '', album_id: song.album?.id || '', year: 0, release_date: '', lyrics: song.lyrics || '', audio_url: song.audio_url || '', cover_url: song.cover_url || song.album?.cover_url || '', status: 'approved' }
}

async function load() {
  loading.value = true; error.value = ''
  try {
    if (kind.value === 'song') songs.value = (await listSongBookmarks({ sort: sort.value })).data.map(item => item.song).filter((song): song is MusicSongListItem => Boolean(song))
    else if (kind.value === 'album') albums.value = await Promise.all((await listAlbumBookmarks({ sort: sort.value })).data.map(item => getMusicAlbum(item.album_id)))
    else if (kind.value === 'artist') artists.value = await Promise.all((await listArtistBookmarks({ sort: sort.value })).data.map(item => getMusicArtist(item.artist_id)))
    else playlists.value = (await listPlaylistBookmarks({ sort: sort.value })).data.map(item => item.playlist).filter((item): item is MusicPlaylistSummary => Boolean(item))
  } catch { error.value = '音乐库加载失败' } finally { loading.value = false }
}
watch([kind, sort], () => { void load() }); onMounted(() => { void load() })
</script>

<template>
  <main class="music-library">
    <PPageHeader title="音乐库" mb="0"><template #action><PSegmentedControl v-model="kind" :options="options" /></template></PPageHeader>
    <div class="music-library__sort"><button :class="{ active: sort === 'latest' }" @click="sort = 'latest'">最近收藏</button><button :class="{ active: sort === 'popular' }" @click="sort = 'popular'">热度</button></div>
    <p v-if="loading" class="state">正在加载</p><p v-else-if="error" class="state error">{{ error }}</p><p v-else-if="!items.length" class="state">这里还没有内容</p>
    <div v-else class="music-library__list">
      <button v-for="song in songs" v-show="kind === 'song'" :key="song.id" class="music-library__row" :disabled="!song.audio_url" @click="player.playSong(playable(song))"><Music2 :size="18"/><span><strong>{{ song.title }}</strong><small>{{ song.artists?.map(item => item.name).join(' / ') || '未知艺术家' }}</small></span></button>
      <button v-for="album in albums" v-show="kind === 'album'" :key="album.id" class="music-library__row" @click="openAlbum(album.id)"><Disc3 :size="18"/><span><strong>{{ album.title }}</strong><small>{{ album.artists?.map(item => item.name).join(' / ') }}</small></span></button>
      <button v-for="artist in artists" v-show="kind === 'artist'" :key="artist.id" class="music-library__row" @click="openArtist(artist.id)"><Users :size="18"/><span><strong>{{ artist.name }}</strong><small>{{ artist.legal_name || artist.bio }}</small></span></button>
      <button v-for="playlist in playlists" v-show="kind === 'playlist'" :key="playlist.id" class="music-library__row" @click="openPlaylist(playlist.id)"><ListMusic :size="18"/><span><strong>{{ playlist.name }}</strong><small>{{ playlist.song_count }} 首</small></span></button>
    </div>
  </main>
</template>

<style scoped>
.music-library{display:grid;gap:1rem}.music-library__sort{display:flex;gap:.4rem}.music-library__sort button{border:0;background:transparent;color:var(--a-color-muted);padding:.35rem 0;cursor:pointer}.music-library__sort button+button{border-left:1px solid var(--a-color-border-soft);padding-left:.5rem}.music-library__sort .active{color:var(--a-color-text)}.music-library__list{display:grid;border-top:1px solid var(--a-color-border-soft)}.music-library__row{display:flex;align-items:center;gap:.8rem;min-height:4rem;padding:.65rem 0;border:0;border-bottom:1px solid var(--a-color-border-soft);background:transparent;color:inherit;text-align:left;cursor:pointer}.music-library__row span{display:grid;gap:.18rem;min-width:0}.music-library__row small,.state{color:var(--a-color-muted)}.error{color:var(--a-color-accent-destructive)}
</style>
