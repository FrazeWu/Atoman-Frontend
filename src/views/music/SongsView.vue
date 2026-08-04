<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { listMusicAlbums, listMusicArtists, searchMusicSongs, type MusicAlbumListItem, type MusicArtistListItem, type MusicSongSearchResult } from '@/api/musicV1'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { usePlayerStore } from '@/stores/player'

const query = ref('')
const songs = ref<MusicSongSearchResult[]>([])
const albums = ref<MusicAlbumListItem[]>([])
const artists = ref<MusicArtistListItem[]>([])
const loading = ref(false)
const player = usePlayerStore()
const router = useRouter()
const { openAlbum, openArtist } = useMusicDrawers()

watch(query, async value => {
  const keyword = value.trim()
  if (!keyword) { songs.value = []; albums.value = []; artists.value = []; return }
  loading.value = true
  try {
    const [songResults, albumResults, artistResults] = await Promise.all([
      searchMusicSongs(keyword), listMusicAlbums({ q: keyword, page: 1, page_size: 8 }), listMusicArtists({ q: keyword, page: 1, page_size: 8 }),
    ])
    songs.value = songResults
    albums.value = albumResults.data
    artists.value = artistResults.data
  } finally { loading.value = false }
})

function play(song: MusicSongSearchResult) {
  if (!song.audio_url) return
  player.playSong({ id: song.id, title: song.title, artist: song.artist, album: song.album, album_id: song.album_id || '', year: 0, release_date: '', lyrics: '', audio_url: song.audio_url, cover_url: song.cover_url || '', status: 'approved' })
}

function queue(song: MusicSongSearchResult) {
  if (!song.audio_url) return
  player.addToQueue({ id: song.id, title: song.title, artist: song.artist, album: song.album, album_id: song.album_id || '', year: 0, release_date: '', lyrics: '', audio_url: song.audio_url, cover_url: song.cover_url || '', status: 'approved' })
}

function openSong(song: MusicSongSearchResult) { void router.push(`/music/song/${song.id}`) }
</script>

<template><main class="songs-view"><input v-model="query" type="search" placeholder="搜索歌曲、艺术家或专辑" autofocus><p v-if="loading">搜索中</p><section v-if="songs.length"><h2>歌曲</h2><div v-for="song in songs" :key="song.id" class="song-result"><button type="button" @click="play(song)"><strong>{{ song.title }}</strong><span>{{ song.artist }} · {{ song.album }}</span></button><button type="button" aria-label="加入队列" @click="queue(song)">+</button><button type="button" aria-label="打开歌曲详情" @click="openSong(song)">i</button></div></section><section v-if="albums.length"><h2>专辑</h2><button v-for="album in albums" :key="album.id" type="button" @click="openAlbum(album.id)"><strong>{{ album.title }}</strong><span>{{ album.artists?.map(item => item.name).join(' / ') }}</span></button></section><section v-if="artists.length"><h2>艺术家</h2><button v-for="artist in artists" :key="artist.id" type="button" @click="openArtist(artist.id)"><strong>{{ artist.name }}</strong><span>{{ artist.legal_name || artist.bio }}</span></button></section></main></template>
<style scoped>.songs-view{display:grid;gap:.75rem;max-width:52rem;margin:0 auto;padding:1.5rem}.songs-view input,.songs-view button{min-height:3rem;padding:.75rem;border:1px solid var(--a-color-border-soft);background:var(--a-color-bg);color:inherit;text-align:left}.songs-view button{display:grid;gap:.2rem;cursor:pointer}.songs-view span{color:var(--a-color-muted)}</style>
