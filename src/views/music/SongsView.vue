<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import { CirclePlus, Info, ListPlus, Play } from "lucide-vue-next";
import { recordMusicSearchInteraction, searchMusic, type MusicSearchKind, type MusicSongListItem } from "@/api/musicV1";
import { useMusicDrawers } from "@/composables/useMusicDrawers";
import { useAuthStore } from "@/stores/auth";
import { usePlayerStore } from "@/stores/player";
import type { Song } from "@/types";
import { getActivePinia } from "pinia";

const query = ref("");
const selectedType = ref<"" | MusicSearchKind>("");
const searchTypes: Array<{ label: string; value: "" | MusicSearchKind }> = [
  { label: "全部", value: "" },
  { label: "歌曲", value: "song" },
  { label: "专辑", value: "album" },
  { label: "艺术家", value: "artist" },
  { label: "歌单", value: "playlist" },
];
const songs = ref<MusicSongListItem[]>([]);
const albums = ref<Awaited<ReturnType<typeof searchMusic>>["albums"]>([]);
const artists = ref<Awaited<ReturnType<typeof searchMusic>>["artists"]>([]);
const playlists = ref<Awaited<ReturnType<typeof searchMusic>>["playlists"]>([]);
const loading = ref(false);
const error = ref("");
const player = usePlayerStore();
const authStore = getActivePinia() ? useAuthStore() : null;
const { openAlbum, openArtist, openPlaylist } = useMusicDrawers();
let timer: number | undefined;
let requestID = 0;
let controller: AbortController | undefined;
const page = ref(1);
const hasMore = ref(false);

function mergeByID<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const byID = new Map(current.map((item) => [String(item.id), item]));
  incoming.forEach((item) => byID.set(String(item.id), item));
  return [...byID.values()];
}

function trackSearchClick(entityType: MusicSearchKind, entityId: string) {
  if (!authStore?.isAuthenticated) return;
  void recordMusicSearchInteraction({ query: query.value.trim(), entity_type: entityType, entity_id: entityId }).catch(() => undefined);
}

async function runSearch(reset: boolean) {
  const keyword = query.value.trim();
  if (!keyword) return;
  controller?.abort();
  controller = new AbortController();
  const current = ++requestID;
  const nextPage = reset ? 1 : page.value + 1;
  loading.value = true;
  error.value = "";
  try {
    const result = await searchMusic(keyword, { type: selectedType.value || undefined, page: nextPage, page_size: 20, signal: controller.signal });
    if (current !== requestID) return;
    songs.value = reset ? result.songs : mergeByID(songs.value, result.songs);
    albums.value = reset ? result.albums : mergeByID(albums.value, result.albums);
    artists.value = reset ? result.artists : mergeByID(artists.value, result.artists);
    playlists.value = reset ? result.playlists : mergeByID(playlists.value, result.playlists);
    page.value = nextPage;
    const kinds: MusicSearchKind[] = selectedType.value ? [selectedType.value] : ["song", "album", "artist", "playlist"];
    hasMore.value = kinds.some((kind) => result.meta.has_more[kind]);
  } catch (caught) {
    if (caught instanceof DOMException && caught.name === "AbortError") return;
    if (current === requestID) error.value = "搜索失败，请重试";
  } finally {
    if (current === requestID) loading.value = false;
  }
}

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

watch([query, selectedType], ([value]) => {
  window.clearTimeout(timer);
  controller?.abort();
  const keyword = value.trim();
  if (!keyword) {
    songs.value = [];
    albums.value = [];
    artists.value = [];
    playlists.value = [];
    error.value = "";
    hasMore.value = false;
    return;
  }
  timer = window.setTimeout(() => void runSearch(true), 250);
});

onBeforeUnmount(() => {
  window.clearTimeout(timer);
  controller?.abort();
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
    <div class="search-types" aria-label="搜索类型">
      <button v-for="option in searchTypes" :key="option.value || 'all'" type="button" :class="{ active: selectedType === option.value }" @click="selectedType = option.value">{{ option.label }}</button>
    </div>
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
        <button
          type="button"
          class="song-play"
          :disabled="!song.audio_url"
          :aria-label="`播放 ${song.title}`"
          @click="trackSearchClick('song', String(song.id)); player.playSong(asSong(song))"
        >
          <Play :size="16" aria-hidden="true" />
        </button>
        <span class="song-copy">
          <RouterLink :to="`/music/song/${song.id}`" class="song-title" @click="trackSearchClick('song', String(song.id))">{{ song.title }}</RouterLink>
          <span class="song-links">
            <template v-if="song.artists?.length">
              <template v-for="(artist, index) in song.artists" :key="artist.id">
                <span v-if="index" aria-hidden="true"> / </span>
                <button type="button" :data-testid="`song-result-artist-${artist.id}`" @click="trackSearchClick('artist', String(artist.id)); openArtist(String(artist.id))">{{ artist.name }}</button>
              </template>
            </template>
            <span v-else>未知艺术家</span>
            <template v-if="song.album?.id">
              <span aria-hidden="true"> · </span>
              <button type="button" :data-testid="`song-result-album-${song.album.id}`" @click="trackSearchClick('album', String(song.album.id)); openAlbum(String(song.album.id))">{{ song.album.title }}</button>
            </template>
          </span>
        </span>
        <button
          type="button"
          :title="`加入队列：${song.title}`"
          :aria-label="`加入队列：${song.title}`"
          @click="trackSearchClick('song', String(song.id)); player.addToQueue(asSong(song))"
        >
          <CirclePlus :size="18" /></button>
        <button type="button" :title="`下一首播放：${song.title}`" :aria-label="`下一首播放：${song.title}`" @click="trackSearchClick('song', String(song.id)); player.addToQueue(asSong(song), true)"><ListPlus :size="18" /></button>
        <RouterLink
          :to="`/music/song/${song.id}`"
          :aria-label="`查看 ${song.title}`"
          :title="`查看 ${song.title}`"
          @click="trackSearchClick('song', String(song.id))"><Info :size="18"
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
        @click="trackSearchClick('album', String(album.id)); openAlbum(album.id)"
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
        @click="trackSearchClick('artist', String(artist.id)); openArtist(artist.id)"
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
        @click="trackSearchClick('playlist', String(playlist.id)); openPlaylist(playlist.id)"
      >
        <strong>{{ playlist.name }}</strong
        ><small>{{ playlist.song_count }} 首</small>
      </button>
    </section>
    <button v-if="hasMore" type="button" class="load-more" :disabled="loading" @click="runSearch(false)">{{ loading ? '加载中' : '加载更多' }}</button>
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
.search-types { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.search-types button,
.load-more { min-height: 2.75rem; padding: 0.55rem 0.9rem; border: 1px solid var(--a-color-border-soft); background: var(--a-color-bg); color: inherit; cursor: pointer; }
.search-types button.active { border-color: var(--a-color-text); background: var(--a-color-surface-muted); }
.load-more { justify-self: center; min-width: 8rem; }
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
  grid-template-columns: 2.75rem minmax(0, 1fr) repeat(3, 2.75rem);
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
.song-result > button,
.song-result a {
  display: grid;
  place-items: center;
}
.song-result > button,
.song-result > a {
  border-left: 1px solid var(--a-color-border-soft);
}
.song-result > .song-play {
  border-left: 0;
}
.song-result > .song-play:disabled {
  cursor: default;
  opacity: 0.45;
}
.song-copy,
.entity {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}
.song-copy {
  align-content: center;
  padding: 0.65rem;
}
.song-title {
  justify-self: start;
  color: inherit;
  font-weight: 600;
  text-decoration: none;
}
.song-links {
  overflow: hidden;
  color: var(--a-color-muted);
  font-size: 0.8rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.song-links button {
  display: inline;
  min-height: 0;
  padding: 0;
  color: inherit;
  font: inherit;
  text-align: inherit;
}
.song-title:hover,
.song-links button:hover {
  text-decoration: underline;
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
