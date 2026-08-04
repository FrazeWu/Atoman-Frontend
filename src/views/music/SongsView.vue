<script setup lang="ts">
import { ref, watch } from "vue";
import { CirclePlus, Info, Play } from "lucide-vue-next";
import { searchMusic, type MusicSongListItem } from "@/api/musicV1";
import { useMusicDrawers } from "@/composables/useMusicDrawers";
import { usePlayerStore } from "@/stores/player";
import type { Song } from "@/types";

const query = ref("");
const songs = ref<MusicSongListItem[]>([]);
const albums = ref<Awaited<ReturnType<typeof searchMusic>>["albums"]>([]);
const artists = ref<Awaited<ReturnType<typeof searchMusic>>["artists"]>([]);
const playlists = ref<Awaited<ReturnType<typeof searchMusic>>["playlists"]>([]);
const loading = ref(false);
const error = ref("");
const player = usePlayerStore();
const { openAlbum, openArtist, openPlaylist } = useMusicDrawers();
let timer: number | undefined;
let requestID = 0;

function asSong(song: MusicSongListItem): Song {
  return {
    id: song.id,
    title: song.title,
    artist: song.artists?.map((item) => item.name).join(" / ") || "未知艺术家",
    album: song.album?.title || "",
    album_id: song.album?.id || "",
    year: 0,
    release_date: "",
    lyrics: song.lyrics || "",
    audio_url: song.audio_url || "",
    cover_url: song.cover_url || song.album?.cover_url || "",
    status: "approved",
    track_number: song.track_number,
  };
}

watch(query, (value) => {
  window.clearTimeout(timer);
  const keyword = value.trim();
  if (!keyword) {
    songs.value = [];
    albums.value = [];
    artists.value = [];
    playlists.value = [];
    error.value = "";
    return;
  }
  timer = window.setTimeout(async () => {
    const current = ++requestID;
    loading.value = true;
    error.value = "";
    try {
      const result = await searchMusic(keyword);
      if (current !== requestID) return;
      songs.value = result.songs;
      albums.value = result.albums;
      artists.value = result.artists;
      playlists.value = result.playlists;
    } catch {
      if (current === requestID) error.value = "搜索失败，请重试";
    } finally {
      if (current === requestID) loading.value = false;
    }
  }, 250);
});
</script>

<template>
  <main class="songs-view">
    <input
      v-model="query"
      type="search"
      placeholder="搜索歌曲、专辑、艺术家或歌单"
      autofocus
    />
    <p v-if="loading" class="state">搜索中</p>
    <p v-else-if="error" class="state error">{{ error }}</p>
    <p
      v-else-if="
        query.trim() &&
        !songs.length &&
        !albums.length &&
        !artists.length &&
        !playlists.length
      "
      class="state"
    >
      没有找到结果
    </p>
    <section v-if="songs.length">
      <h2>歌曲</h2>
      <div v-for="song in songs" :key="song.id" class="song-result">
        <button type="button" @click="player.playSong(asSong(song))">
          <Play :size="16" aria-hidden="true" /><span
            ><strong>{{ song.title }}</strong
            ><small
              >{{
                song.artists?.map((item) => item.name).join(" / ") ||
                "未知艺术家"
              }}
              · {{ song.album?.title }}</small
            ></span
          ></button
        ><button
          type="button"
          :title="`加入队列：${song.title}`"
          :aria-label="`加入队列：${song.title}`"
          @click="player.addToQueue(asSong(song))"
        >
          <CirclePlus :size="18" /></button
        ><RouterLink
          :to="`/music/song/${song.id}`"
          :aria-label="`查看 ${song.title}`"
          :title="`查看 ${song.title}`"
          ><Info :size="18"
        /></RouterLink>
      </div>
    </section>
    <section v-if="albums.length">
      <h2>专辑</h2>
      <button
        v-for="album in albums"
        :key="album.id"
        type="button"
        class="entity"
        @click="openAlbum(album.id)"
      >
        <strong>{{ album.title }}</strong
        ><small>{{
          album.artists?.map((item) => item.name).join(" / ")
        }}</small>
      </button>
    </section>
    <section v-if="artists.length">
      <h2>艺术家</h2>
      <button
        v-for="artist in artists"
        :key="artist.id"
        type="button"
        class="entity"
        @click="openArtist(artist.id)"
      >
        <strong>{{ artist.name }}</strong
        ><small>{{ artist.legal_name || artist.bio }}</small>
      </button>
    </section>
    <section v-if="playlists.length">
      <h2>歌单</h2>
      <button
        v-for="playlist in playlists"
        :key="playlist.id"
        type="button"
        class="entity"
        @click="openPlaylist(playlist.id)"
      >
        <strong>{{ playlist.name }}</strong
        ><small>{{ playlist.song_count }} 首</small>
      </button>
    </section>
  </main>
</template>

<style scoped>
.songs-view {
  display: grid;
  gap: 1rem;
  max-width: 52rem;
  margin: 0 auto;
  padding: 1.5rem;
}
.songs-view input {
  min-height: 3rem;
  padding: 0.75rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: inherit;
}
.songs-view section {
  display: grid;
  gap: 0.5rem;
}
.songs-view h2 {
  margin: 0.75rem 0 0;
  font-size: 1rem;
}
.song-result {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 2.75rem 2.75rem;
  border: 1px solid var(--a-color-border-soft);
}
.song-result button,
.song-result a,
.entity {
  min-height: 3.25rem;
  padding: 0.65rem;
  border: 0;
  background: var(--a-color-bg);
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.song-result > button:first-child {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}
.song-result > button:not(:first-child),
.song-result a {
  display: grid;
  place-items: center;
  border-left: 1px solid var(--a-color-border-soft);
}
.song-result span,
.entity {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}
.songs-view small,
.state {
  color: var(--a-color-muted);
}
.error {
  color: var(--a-color-accent-destructive);
}
.entity {
  border: 1px solid var(--a-color-border-soft);
}
</style>
