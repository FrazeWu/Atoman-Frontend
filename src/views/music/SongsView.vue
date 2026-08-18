<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import { CirclePlus, Info, ListPlus, Play, Search } from "lucide-vue-next";
import { recordMusicSearchInteraction, searchMusic, listMusicPlaylistSongs, getMusicArtist, type MusicSearchKind, type MusicSongListItem } from "@/api/musicV1";
import { useMusicDrawers } from "@/composables/useMusicDrawers";
import { useAuthStore } from "@/stores/auth";
import { usePlayerStore } from "@/stores/player";
import type { Song } from "@/types";
import { getMountedPinia } from "@/utils/pinia";
import PPageHeader from "@/components/ui/PPageHeader.vue";
import PInput from "@/components/ui/PInput.vue";
import PSegmentedControl from "@/components/ui/PSegmentedControl.vue";
import PEmpty from "@/components/ui/PEmpty.vue";
import PButton from "@/components/ui/PButton.vue";
import PaginationBar from "@/components/ui/PaginationBar.vue";

const query = ref("");
const selectedType = ref<"" | MusicSearchKind>("");
const searchTypeOptions = [
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
const authStore = getMountedPinia() ? useAuthStore() : null;
const { openAlbum, openArtist, openPlaylist } = useMusicDrawers();
let timer: number | undefined;
let requestID = 0;
let controller: AbortController | undefined;
const page = ref(1);
const searchMeta = ref({ page: 1, page_size: 20, total: 0, has_more: false });

function trackSearchClick(entityType: MusicSearchKind, entityId: string) {
  if (!authStore?.isAuthenticated) return;
  void recordMusicSearchInteraction({ query: query.value.trim(), entity_type: entityType, entity_id: entityId }).catch(() => undefined);
}

async function runSearch(targetPage = 1) {
  const keyword = query.value.trim();
  if (!keyword) return;
  controller?.abort();
  controller = new AbortController();
  const current = ++requestID;
  loading.value = true;
  error.value = "";
  try {
    const result = await searchMusic(keyword, { type: selectedType.value || undefined, page: targetPage, page_size: 20, signal: controller.signal });
    if (current !== requestID) return;
    songs.value = result.songs;
    albums.value = result.albums;
    artists.value = result.artists;
    playlists.value = result.playlists;
    page.value = targetPage;
    const kinds: MusicSearchKind[] = selectedType.value ? [selectedType.value] : ["song", "album", "artist", "playlist"];
    searchMeta.value = {
      page: targetPage,
      page_size: 20,
      total: Math.max(...kinds.map((kind) => result.meta.totals[kind] ?? 0)),
      has_more: kinds.some((kind) => result.meta.has_more[kind]),
    };
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
    waveform_peaks: song.waveform_peaks,
    cover_url: song.cover_url || song.album?.cover_url || "",
    status: "approved",
    track_number: song.track_number,
  };
}

function asAlbumSong(song: NonNullable<Awaited<ReturnType<typeof searchMusic>>["albums"][number]["songs"]>[number], album: Awaited<ReturnType<typeof searchMusic>>["albums"][number]): Song {
  return {
    id: song.id,
    title: song.title,
    artist: album.artists?.map((item) => item.name).join(" / ") || "未知艺术家",
    album: album.title,
    album_id: album.id,
    year: album.year || 0,
    release_date: album.release_date || "",
    lyrics: song.lyrics || "",
    audio_url: song.audio_url || "",
    cover_url: song.cover_url || album.cover_url || "",
    status: "approved",
    track_number: song.track_number,
  };
}

function playableAlbumSongs(album: Awaited<ReturnType<typeof searchMusic>>["albums"][number]) {
  return (album.songs || []).filter((song) => song.audio_url).map((song) => asAlbumSong(song, album));
}

function playAlbumResult(album: Awaited<ReturnType<typeof searchMusic>>["albums"][number]) {
  const tracks = playableAlbumSongs(album);
  if (!tracks.length) return;
  trackSearchClick("album", String(album.id));
  player.playAlbum(tracks);
}

async function playPlaylistResult(playlist: Awaited<ReturnType<typeof searchMusic>>["playlists"][number]) {
  const result = await listMusicPlaylistSongs(String(playlist.id), { page: 1, page_size: 200 });
  const tracks = result.data.filter((song) => song.audio_url).map(asSong);
  if (!tracks.length) return;
  trackSearchClick("playlist", String(playlist.id));
  player.playAlbum(tracks);
}

async function playArtistResult(artist: Awaited<ReturnType<typeof searchMusic>>["artists"][number]) {
  const detail = await getMusicArtist(String(artist.id));
  const tracks = (detail.albums || []).flatMap(playableAlbumSongs);
  if (!tracks.length) return;
  trackSearchClick("artist", String(artist.id));
  player.playAlbum(tracks);
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
    searchMeta.value = { page: 1, page_size: 20, total: 0, has_more: false };
    return;
  }
  timer = window.setTimeout(() => void runSearch(1), 250);
});

onBeforeUnmount(() => {
  window.clearTimeout(timer);
  controller?.abort();
});
</script>

<template>
  <main class="songs-view">
    <PPageHeader title="歌曲检索" mb="1.25rem">
      <template #action>
        <PSegmentedControl v-model="selectedType" :options="searchTypeOptions" />
      </template>
    </PPageHeader>

    <div class="search-bar-wrap">
      <PInput
        v-model="query"
        type="search"
        placeholder="搜索歌曲、专辑、艺术家或歌单..."
        autofocus
      />
    </div>

    <!-- Default empty guidance state -->
    <div v-if="!query.trim() && !loading" class="songs-view__default-empty">
      <PEmpty title="搜索全库音乐资源" description="支持输入歌曲名称、专辑名、艺术家或歌单名称进行全量检索。">
        <template #icon>
          <Search :size="32" style="color: var(--a-color-muted);" />
        </template>
      </PEmpty>
    </div>

    <p v-else-if="loading" class="state">搜索中...</p>
    <p v-else-if="error" class="state error">{{ error }}</p>
    <PEmpty
      v-else-if="
        query.trim() &&
        !songs.length &&
        !albums.length &&
        !artists.length &&
        !playlists.length
      "
      title="未找到相关结果"
      description="尝试切换不同筛选分类，或更改关键词后再试。"
    />

    <div v-else class="songs-view__results">
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
            class="song-action-btn"
            :title="`加入队列：${song.title}`"
            :aria-label="`加入队列：${song.title}`"
            @click="trackSearchClick('song', String(song.id)); player.addToQueue(asSong(song))"
          >
            <CirclePlus :size="16" />
          </button>
          <button
            type="button"
            class="song-action-btn"
            :title="`下一首播放：${song.title}`"
            :aria-label="`下一首播放：${song.title}`"
            @click="trackSearchClick('song', String(song.id)); player.addToQueue(asSong(song), true)"
          >
            <ListPlus :size="16" />
          </button>
          <RouterLink
            :to="`/music/song/${song.id}`"
            class="song-action-btn"
            :aria-label="`查看 ${song.title}`"
            :title="`查看 ${song.title}`"
            @click="trackSearchClick('song', String(song.id))"
          >
            <Info :size="16" />
          </RouterLink>
        </div>
      </section>

      <section v-if="albums.length">
        <h2>专辑</h2>
        <div v-for="album in albums" :key="album.id" class="entity-row">
          <button type="button" class="entity" @click="trackSearchClick('album', String(album.id)); openAlbum(album.id)">
            <strong>{{ album.title }}</strong>
            <small>{{ album.artists?.map((item) => item.name).join(" / ") }}</small>
          </button>
          <button type="button" class="entity-action" :data-testid="`search-album-play-${album.id}`" :disabled="!playableAlbumSongs(album).length" :aria-label="`播放专辑 ${album.title}`" :title="`播放专辑 ${album.title}`" @click="playAlbumResult(album)">
            <Play :size="16" />
          </button>
        </div>
      </section>

      <section v-if="artists.length">
        <h2>艺术家</h2>
        <div v-for="artist in artists" :key="artist.id" class="entity-row">
          <button type="button" class="entity" @click="trackSearchClick('artist', String(artist.id)); openArtist(artist.id)">
            <strong>{{ artist.name }}</strong>
            <small>{{ artist.legal_name || artist.bio }}</small>
          </button>
          <button type="button" class="entity-action" :data-testid="`search-artist-play-${artist.id}`" :aria-label="`播放 ${artist.name}`" :title="`播放 ${artist.name}`" @click="playArtistResult(artist)">
            <Play :size="16" />
          </button>
        </div>
      </section>

      <section v-if="playlists.length">
        <h2>歌单</h2>
        <div v-for="playlist in playlists" :key="playlist.id" class="entity-row">
          <button type="button" class="entity" @click="trackSearchClick('playlist', String(playlist.id)); openPlaylist(playlist.id)">
            <strong>{{ playlist.name }}</strong>
            <small>{{ playlist.song_count }} 首</small>
          </button>
          <button type="button" class="entity-action" :data-testid="`search-playlist-play-${playlist.id}`" :aria-label="`播放歌单 ${playlist.name}`" :title="`播放歌单 ${playlist.name}`" @click="playPlaylistResult(playlist)">
            <Play :size="16" />
          </button>
        </div>
      </section>

      <PaginationBar
        v-if="searchMeta.total > 0"
        :meta="searchMeta"
        :loading="loading"
        @change="runSearch"
      />
    </div>
  </main>
</template>

<style scoped>
.songs-view {
  display: grid;
  gap: 1.25rem;
  max-width: 56rem;
  margin: 0 auto;
  padding: 1.5rem 0 3rem;
}

.search-bar-wrap {
  margin-bottom: 0.5rem;
}

.songs-view__default-empty {
  padding: 3rem 0;
}

.songs-view__results {
  display: grid;
  gap: 1.5rem;
}

.songs-view section {
  display: grid;
  gap: 0.6rem;
}

.songs-view h2 {
  margin: 0.5rem 0 0.25rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--a-color-fg);
}

.song-result {
  display: grid;
  grid-template-columns: 2.75rem minmax(0, 1fr) repeat(3, 2.5rem);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
  overflow: hidden;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.song-result:hover,
.song-result:focus-within {
  border-color: var(--a-color-border);
  background: var(--a-color-surface-muted);
  box-shadow: inset 4px 0 0 var(--a-color-text), var(--a-shadow-sm);
}

.song-result button,
.song-result a,
.entity {
  min-height: 3.25rem;
  padding: 0.65rem;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.song-action-btn,
.song-result > .song-play {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-muted);
  transition: color 0.15s ease, background 0.15s ease;
}

.song-action-btn:hover,
.song-result > .song-play:hover:not(:disabled) {
  color: var(--a-color-fg);
  background: var(--a-color-surface-muted);
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
  padding: 0.65rem 0.85rem;
}

.song-title {
  justify-self: start;
  color: var(--a-color-fg);
  font-weight: 600;
  font-size: 0.92rem;
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

.state {
  color: var(--a-color-muted);
  text-align: center;
  padding: 2rem 0;
}

.error {
  color: var(--a-color-accent-destructive);
}

.entity-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 2.75rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  overflow: hidden;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.entity-row:hover,
.entity-row:focus-within {
  border-color: var(--a-color-border);
  background: var(--a-color-surface-muted);
  box-shadow: inset 4px 0 0 var(--a-color-text), var(--a-shadow-sm);
}

.entity {
  padding: 0.85rem 1rem;
}

.entity-action {
  display: grid;
  place-items: center;
  min-height: 3.25rem;
  border: 0;
  border-left: 1px solid var(--a-color-border-soft);
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
}

.entity-action:hover:not(:disabled) {
  color: var(--a-color-fg);
  background: var(--a-color-surface-muted);
}

.entity-action:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.load-more {
  justify-self: center;
  margin-top: 1rem;
}
</style>
