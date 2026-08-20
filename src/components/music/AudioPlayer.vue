<template>
  <div
    v-if="player.currentSong"
    class="player"
    :class="{ 'is-auto-hidden': !effectivePinned && !playerHovered }"
    @mouseenter="revealPlayer"
    @mouseleave="scheduleAutoHide"
    @focusin="revealPlayer"
    @focusout="scheduleAutoHide"
  >
    <div
      v-if="!effectivePinned"
      class="player-reveal-handle"
      aria-hidden="true"
    />
    <div
      ref="playerInnerRef"
      class="player-inner"
      :class="{ 'player-inner--meta-collapsed': isMetaCollapsed }"
    >
      <!-- Left: Identity -->
      <div
        ref="playerInfoRef"
        class="player-info"
        :class="{ 'player-info--collapsed': isMetaCollapsed }"
      >
        <button
          type="button"
          class="cover-wrap"
          :aria-label="isPodcast ? '查看节目说明' : '打开歌词'"
          :title="isPodcast ? '查看节目说明' : '打开歌词'"
          data-hint="歌词 (Shift+F)"
          @click="player.toggleLyrics"
        >
          <img
            v-if="player.currentSong.cover_url"
            :src="player.currentSong.cover_url"
            alt=""
            class="player-cover"
          />
          <div v-else class="player-cover-fallback">{{ coverFallback }}</div>
          <span class="cover-overlay" aria-hidden="true"><ChevronUp :size="20" /></span>
        </button>
        <div
          ref="playerMetaRef"
          class="player-meta"
          :class="{ 'player-meta--collapsed': isMetaCollapsed }"
        >
          <div class="player-tooltip-wrap">
            <RouterLink v-if="!isPodcast" class="player-title" :to="`/music/song/${player.currentSong.id}`">{{ player.currentSong.title }}</RouterLink>
            <h3 v-else class="player-title">{{ player.currentSong.title }}</h3>
            <div class="player-tooltip">{{ player.currentSong.title }}</div>
          </div>
          <div class="player-tooltip-wrap">
            <p class="player-artist">
              TRACK //
              <template v-if="!isPodcast && player.currentSong.artists?.length">
                <template v-for="(artist, index) in player.currentSong.artists" :key="artist.id">
                  <span v-if="index" aria-hidden="true"> / </span>
                  <button type="button" @click="openArtist(String(artist.id))">{{ artist.name }}</button>
                </template>
              </template>
              <span v-else>{{ artistText }}</span>
              <template v-if="!isPodcast && player.currentSong.album_id">
                <span aria-hidden="true"> · </span>
                <button type="button" @click="openAlbum(String(player.currentSong.album_id))">{{ player.currentSong.album }}</button>
              </template>
            </p>
            <div class="player-tooltip player-tooltip--subtle">
              TRACK // {{ artistText }}
            </div>
          </div>
        </div>
      </div>

      <!-- Center: Controls -->
      <div ref="playerControlsRef" class="player-controls-hub">
        <div class="ctrl-row">
          <button type="button" class="skip-btn" aria-label="后退 5 秒" title="后退 5 秒" data-hint="后退 5S (←)" @click="player.skip(-5)">-5S</button>
          <button type="button" class="nav-btn" aria-label="上一首" title="上一首" data-hint="上一首 (Alt+←)" @click="player.playPrevious()">上一首</button>
          <button
            type="button"
            class="main-play-btn"
            :aria-label="player.isPlaying ? '暂停' : '播放'"
            :title="player.isPlaying ? '暂停' : '播放'"
            :data-hint="player.isPlaying ? '暂停 (Space)' : '播放 (Space)'"
            @click="player.togglePlay()"
          >
            {{ player.isPlaying ? "暂停" : "播放" }}
          </button>
          <button type="button" class="nav-btn" aria-label="下一首" title="下一首" data-hint="下一首 (Alt+→)" @click="player.playNext()">下一首</button>
          <button type="button" class="skip-btn" aria-label="前进 5 秒" title="前进 5 秒" data-hint="前进 5S (→)" @click="player.skip(5)">+5S</button>

          <button
            v-if="player.currentSong && !isPodcast"
            type="button"
            class="player-fav-btn"
            :class="{
              'is-active': favoriteSongIds.has(String(player.currentSong.id)),
            }"
			:title="favoriteSongIds.has(String(player.currentSong.id)) ? '移出最爱' : '加入最爱'"
			:data-hint="favoriteSongIds.has(String(player.currentSong.id)) ? '移出最爱' : '加入最爱'"
            @click="toggleTrackFavorite(String(player.currentSong.id))"
          >
            <Heart
              :size="16"
              :fill="
                favoriteSongIds.has(String(player.currentSong.id))
                  ? 'currentColor'
                  : 'none'
              "
            />
          </button>

          <PDropdown
            v-if="player.currentSong && !isPodcast"
            class="player-add-dropdown"
            position="right"
          >
            <template #trigger>
              <button class="player-add-btn" type="button" title="添加到歌单" data-hint="添加到歌单" @click="guardPlaylistMenu">
                <Plus :size="16" />
              </button>
            </template>
            <div class="track-add-menu">
              <div class="track-add-menu-header">添加到歌单</div>
              <div v-if="!playlists.length" class="track-add-menu-empty">
                暂无歌单
              </div>
              <button
                v-for="p in playlists"
                :key="p.id"
                type="button"
                class="track-add-menu-item"
                @click="
                  addTrackToPlaylist(
                    String(p.id),
                    String(player.currentSong.id),
                  )
                "
              >
                {{ p.name }}
              </button>
            </div>
          </PDropdown>

          <button
            v-if="isPodcastEpisode"
            type="button"
            class="player-fav-btn"
            title="收藏单集"
            data-hint="收藏单集"
          @click="addPodcastBookmark(player.currentSong?.source_id)"
          >
            <Heart :size="16" />
          </button>

          <button
            v-if="isPodcastEpisode"
            type="button"
            class="player-add-btn"
            title="稍后听"
            data-hint="稍后听"
          @click="addPodcastListenLater(player.currentSong?.source_id)"
          >
            <Clock :size="16" />
          </button>
        </div>
        <div class="progress-container">
          <AudioWaveformProgress
            :song-id="String(player.currentSong.id)"
            :audio-url="player.currentSong.audio_url"
            :waveform-peaks="player.currentSong.waveform_peaks"
            :current-time="player.currentTime"
            :duration="player.duration"
            :generate-waveform="!isPodcast"
            @seek="player.seek"
          />
        </div>
      </div>

      <!-- Right: Feature Strip -->
      <div class="player-features">
        <button
          type="button"
          class="feature-link"
          :aria-label="featureLabel"
          :title="featureLabel"
          data-hint="歌词 (L)"
          @click="player.toggleLyrics"
        >
          <span>{{ featureLabel }}</span>
        </button>

        <button type="button" class="feature-toggle" aria-label="切换播放模式" title="切换播放模式" data-hint="播放模式" @click="player.cyclePlaybackMode()">
          <div
            v-if="player.playbackMode === 'single'"
            class="repeat-one-wrapper"
          >
            <Repeat :size="20" />
            <span class="one-badge">1</span>
          </div>
          <span v-else style="display: flex; align-items: center">
            <Repeat v-if="player.playbackMode === 'loop'" :size="20" />
            <Shuffle v-else-if="player.playbackMode === 'random'" :size="20" />
          </span>
        </button>

        <div class="volume-container">
          <div class="volume-control">
            <span class="vol-percentage">{{ Math.round(player.volume * 100) }}%</span>
            <div class="vol-slider-wrapper">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                :value="player.volume"
                :style="{ '--vol-percent': `${player.volume * 100}%` }"
                @input="
                  (e) =>
                    player.setVolume(
                      parseFloat((e.target as HTMLInputElement).value),
                    )
                "
                class="vol-slider"
                aria-label="音量"
              />
            </div>
          </div>
          <div class="vol-trigger" data-hint="静音 / 解除静音 (M)">
            <button
              type="button"
              class="vol-icon"
              :aria-label="player.volume > 0 ? '静音' : '解除静音'"
              :title="player.volume > 0 ? '静音' : '解除静音'"
              style="display: flex; align-items: center"
              @click="player.setVolume(player.volume > 0 ? 0 : 0.5)"
            >
              <Volume2 v-if="player.volume > 0.6" :size="20" />
              <Volume1 v-else-if="player.volume > 0.2" :size="20" />
              <Volume v-else-if="player.volume > 0" :size="20" />
              <VolumeX v-else :size="20" />
            </button>
          </div>
        </div>

        <button
          class="queue-trigger"
          :class="{ active: player.showQueue }"
          type="button"
          data-hint="播放队列"
          @click="player.toggleQueue()"
        >
          <List :size="22" />
          <span class="queue-count">{{ player.queue.length || 0 }}</span>
        </button>
        <button
          class="player-pin-btn"
          type="button"
          :aria-label="player.isPinned ? '取消固定播放器' : '固定播放器'"
          :title="player.isPinned ? '取消固定播放器' : '固定播放器'"
          :data-hint="player.isPinned ? '取消固定' : '固定播放器'"
          @click="togglePlayerPin"
        >
          <PinOff v-if="player.isPinned" :size="20" aria-hidden="true" />
          <Pin v-else :size="20" aria-hidden="true" />
        </button>
      </div>
    </div>
  </div>

  <Transition name="slide-up" appear>
    <MusicLyricsPanel
      v-if="player.showLyrics && player.currentSong"
      :song-id="String(player.currentSong.id)"
      :song-title="player.currentSong.title"
      :artist-text="artistText"
      :current-time-seconds="player.currentTime"
      :focus-annotation-id="
        typeof route.query.annotation_id === 'string'
          ? route.query.annotation_id
          : ''
      "
      :start-rebind="route.query.rebind === '1'"
      @close="player.toggleLyrics"
      @seek="player.seek"
    />
  </Transition>

  <Transition name="slide-up" appear>
    <AudioPlayerQueue v-if="player.showQueue" />
  </Transition>
  <PToast v-model="toastVisible" :message="toastMessage" type="success" />
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue";
import { useRoute } from "vue-router";
import { ApiErrorResponseError } from "@/api/client";
import { usePlayerStore } from "@/stores/player";
import { useAuthStore } from "@/stores/auth";
import { useAudioPlayerChrome } from "@/composables/useAudioPlayerChrome";
import { useMusicDrawers } from "@/composables/useMusicDrawers";
import {
  Repeat,
  Shuffle,
  List,
  Volume2,
  Volume1,
  Volume,
  VolumeX,
  Heart,
  Plus,
  Clock,
  Pin,
  PinOff,
  ChevronUp,
} from "lucide-vue-next";
import MusicLyricsPanel from "@/components/music/MusicLyricsPanel.vue";
import AudioWaveformProgress from "@/components/music/AudioWaveformProgress.vue";
import AudioPlayerQueue from "@/components/music/AudioPlayerQueue.vue";
import PDropdown from "@/components/ui/PDropdown.vue";
import PToast from "@/components/ui/PToast.vue";
import { useMusicFavoritePlaylist } from "@/composables/useMusicFavoritePlaylist";
import { useLoginRedirect } from "@/composables/useLoginRedirect";
import { listMusicPlaylists, type MusicPlaylistSummary } from "@/api/musicV1";
import { reportError } from "@/utils/logger";
import { usePodcastPlayerActions } from "@/composables/usePodcastPlayerActions";

const player = usePlayerStore();
const route = useRoute();
const { openAlbum, openArtist } = useMusicDrawers();
const authStore = useAuthStore();
const { requireLogin } = useLoginRedirect();
const playerInfoRef = ref<HTMLElement | null>(null);
const playerMetaRef = ref<HTMLElement | null>(null);
const playerControlsRef = ref<HTMLElement | null>(null);

function handleGlobalKeydown(e: KeyboardEvent) {
  const active = document.activeElement
  if (active) {
    const tagName = active.tagName.toLowerCase()
    if (
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      (active as HTMLElement).isContentEditable
    ) {
      return
    }
  }
  if (!player.currentSong) return

  if (e.key === 'F' && e.shiftKey) {
    e.preventDefault()
    player.toggleLyrics()
  } else if (e.code === 'Space' || e.key === ' ') {
    e.preventDefault()
    player.togglePlay()
  } else if (e.altKey && e.key === 'ArrowLeft') {
    e.preventDefault()
    player.playPrevious()
  } else if (e.altKey && e.key === 'ArrowRight') {
    e.preventDefault()
    player.playNext()
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    player.skip(-5)
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    player.skip(5)
  } else if (e.key === 'm' || e.key === 'M') {
    e.preventDefault()
    player.setVolume(player.volume > 0 ? 0 : 0.5)
  } else if (e.key === 'l' || e.key === 'L') {
    e.preventDefault()
    player.toggleLyrics()
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleGlobalKeydown)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleGlobalKeydown)
  }
})
const {
  effectivePinned,
  isMetaCollapsed,
  playerHovered,
  playerInnerRef,
  revealPlayer,
  scheduleAutoHide,
  togglePlayerPin,
  updateMetaCollapse,
} = useAudioPlayerChrome(computed(() => player.isPinned), () => player.togglePinned());

const artistText = computed(() => {
  if (!player.currentSong) return "未知艺术家";
  if (player.currentSong.artists?.length) {
    return player.currentSong.artists.map((artist) => artist.name).join(", ");
  }
  return player.currentSong.artist || "未知艺术家";
});

const coverFallback = computed(() => {
  const text =
    player.currentSong?.album ||
    player.currentSong?.artist ||
    player.currentSong?.title ||
    "P";
  const firstChar = text.trim().charAt(0);
  return firstChar || "P";
});

const isPodcast = computed(
  () =>
    player.currentSong?.source_type === "podcast_episode" ||
    player.currentSong?.source_type === "feed_podcast",
);

const isPodcastEpisode = computed(
  () => player.currentSong?.source_type === "podcast_episode",
);
const featureLabel = computed(() => (isPodcast.value ? "说明" : "词"));

const playlists = ref<MusicPlaylistSummary[]>([]);
const playlistsLoaded = ref(false);
const toastVisible = ref(false);
const toastMessage = ref("");
const showToast = (message: string) => {
  toastMessage.value = message;
  toastVisible.value = true;
};
const { addPodcastBookmark, addPodcastListenLater } = usePodcastPlayerActions(showToast);
const {
  favoriteSongIds,
  loadFavoriteSongs,
  toggleFavoriteSong,
  addSongToPlaylist,
} = useMusicFavoritePlaylist();

async function loadPlaylists() {
  if (!authStore.isAuthenticated) {
    playlists.value = [];
    playlistsLoaded.value = false;
    return;
  }
  try {
    const res = await listMusicPlaylists();
    playlists.value = res.data || [];
    playlistsLoaded.value = true;
  } catch (err) {
    if (err instanceof ApiErrorResponseError && err.status === 401) {
      playlists.value = [];
      playlistsLoaded.value = true;
      return;
    }
    reportError(err, "加载播放列表失败");
  }
}

async function loadFavorites(songId?: string) {
  if (!authStore.isAuthenticated) {
    favoriteSongIds.value = new Set();
    return;
  }
  try {
    await loadFavoriteSongs(songId ? [songId] : []);
  } catch (err) {
    reportError(err, "加载最爱歌单失败");
  }
}

async function toggleTrackFavorite(songId: string) {
  if (!requireLogin()) return;
  try {
    const result = await toggleFavoriteSong(songId);
    toastMessage.value = result.message;
    toastVisible.value = true;
    await loadPlaylists();
  } catch (err) {
    reportError(err, "更新最爱歌单失败");
    toastMessage.value = "操作失败";
    toastVisible.value = true;
  }
}


async function addTrackToPlaylist(playlistId: string, songId: string) {
  if (!requireLogin()) return;
  try {
    await addSongToPlaylist(playlistId, songId);
    toastMessage.value = "已成功添加到歌单";
    toastVisible.value = true;
  } catch (err) {
    reportError(err, "添加歌曲到播放列表失败");
    toastMessage.value = "添加失败";
    toastVisible.value = true;
  }
}

function guardPlaylistMenu(event: MouseEvent) {
  if (!requireLogin()) event.stopPropagation();
}

watch(
  [
    () => player.currentSong
      ? `${player.currentSong.source_type || "music"}:${player.currentSong.source_id || player.currentSong.id}`
      : "",
    () => authStore.isAuthenticated,
  ],
  async ([playbackKey, isAuthenticated]) => {
    if (!isAuthenticated) {
      playlists.value = [];
      playlistsLoaded.value = false;
      favoriteSongIds.value = new Set();
      return;
    }
    if (isPodcast.value) return;
    if (playbackKey && player.currentSong) {
      if (!playlistsLoaded.value) {
        await loadPlaylists();
      }
      await loadFavorites(String(player.currentSong.id));
    }
  },
  { immediate: true },
);

watch(
  () => player.currentSong?.id,
  async () => {
    await nextTick();
    updateMetaCollapse();
  },
);

</script>

<style scoped>
.player {
  position: fixed;
  bottom: calc(var(--a-footer-reserved-height) + var(--a-mobile-nav-reserved-height));
  width: 100%;
  z-index: var(--a-z-player, 720);
  background: rgba(255, 255, 255, 0.58);
  -webkit-backdrop-filter: blur(18px) saturate(180%);
  backdrop-filter: blur(18px) saturate(180%);
  border-top: 1px solid var(--a-color-border-soft);
  height: var(--a-player-height);
  transition: transform 0.3s cubic-bezier(0.2, 0, 0, 1);
}

:root.dark .player {
  background: rgba(15, 23, 42, 0.64);
  -webkit-backdrop-filter: blur(18px) saturate(180%);
  backdrop-filter: blur(18px) saturate(180%);
  border-top: 1px solid var(--a-color-border-dark, #334155);
}

.player.is-auto-hidden {
  transform: translateY(calc(100% - 10px));
}

.player-reveal-handle {
  position: absolute;
  top: 3px;
  left: 50%;
  width: 40px;
  height: 3px;
  transform: translateX(-50%);
  background: var(--a-color-muted-soft);
  pointer-events: none;
}

.player-inner {
  position: relative;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 2rem;
  height: 100%;
}

/* Left Section */
.player-info {
  display: flex;
  align-items: center;
  gap: 15px;
  flex: 0 0 460px;
  min-width: 0;
  transition:
    flex-basis 0.22s ease,
    width 0.22s ease,
    gap 0.22s ease;
}
.player-info--collapsed {
  flex-basis: 52px;
  width: 52px;
  gap: 0;
}
.cover-wrap {
  position: relative;
  width: 40px;
  height: 40px;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
  padding: 0;
  background: var(--a-color-surface);
  color: var(--a-color-text);
  cursor: pointer;
  flex-shrink: 0;
}
.player-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.player-cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  font-size: 1.4rem;
  font-weight: var(--a-font-weight-strong, 700);
  color: var(--a-color-text);
  background: var(--a-color-surface);
  text-transform: uppercase;
}
.cover-overlay {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--a-color-text) 40%, transparent);
  color: var(--a-color-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  font-size: 20px;
  font-weight: bold;
}
.cover-wrap:hover .cover-overlay {
  opacity: 1;
}

.player-meta {
  min-width: 0;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  overflow: visible;
  transition:
    max-width 0.22s ease,
    opacity 0.18s ease,
    transform 0.22s ease,
    margin 0.22s ease;
}
.player-meta--collapsed {
  max-width: 0;
  opacity: 0;
  overflow: hidden;
  pointer-events: none;
  transform: translateX(-6px);
}
.player-tooltip-wrap {
  position: relative;
  min-width: 0;
}
.player-title {
  display: block;
  font-family: var(--a-font-sans);
  font-weight: 500;
  font-size: 13px;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  color: inherit;
  text-decoration: none;
}
.player-artist {
  font-family: monospace;
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0;
  color: var(--a-color-muted);
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-title:hover,
.player-artist button:hover {
  text-decoration: underline;
}

.player-artist button {
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  cursor: pointer;
}
.player-tooltip {
  position: absolute;
  left: 0;
  bottom: calc(100% + 10px);
  max-width: min(36rem, 80vw);
  padding: 0.5rem 0.7rem;
  background: var(--a-color-text);
  color: var(--a-color-bg);
  font-family: var(--a-font-sans);
  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1.4;
  letter-spacing: 0.04em;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transform: translateY(4px);
  transition:
    opacity 0.18s ease,
    transform 0.18s ease,
    visibility 0.18s ease;
  transition-delay: 0s;
  z-index: 1000;
  box-shadow: var(--a-shadow-dropdown, 0 12px 30px rgba(15, 23, 42, 0.12));
  border-radius: 6px;
}
.player-tooltip::after {
  content: "";
  position: absolute;
  left: 18px;
  top: 100%;
  border: 6px solid transparent;
  border-top-color: var(--a-color-text);
}
.player-tooltip-wrap:hover .player-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
  transition-delay: 1.2s;
}
.player-tooltip--subtle {
  font-size: 0.66rem;
  letter-spacing: 0.12em;
}

/* Center Section */
.player-controls-hub {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: clamp(280px, calc(100% - 780px), 600px);
  min-width: 280px;
}
.ctrl-row {
  display: flex;
  gap: clamp(8px, 1.8vw, 24px);
  align-items: center;
  justify-content: center;
  font-family: var(--a-font-sans);
  font-weight: 950;
  font-size: 10px;
  letter-spacing: 0.15em;
  color: var(--a-color-text);
  flex-wrap: nowrap;
  white-space: nowrap;
  width: 100%;
}
.skip-btn,
.nav-btn,
.main-play-btn,
.player-fav-btn,
.player-add-dropdown {
  flex-shrink: 0;
}
.skip-btn,
.nav-btn {
  font-size: 11px;
  font-weight: 500;
  opacity: 0.5;
  border: 0;
  background: transparent;
  color: inherit;
  padding: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    opacity 0.2s,
    color 0.2s;
}
.skip-btn:hover,
.nav-btn:hover {
  opacity: 1;
  text-decoration: underline;
}

/* 延迟 1.2 秒浮现 Tooltip 快捷键提示 */
[data-hint] {
  position: relative;
}
[data-hint]::before {
  content: attr(data-hint);
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%) translateY(4px);
  padding: 4px 8px;
  background: var(--a-color-fg);
  color: var(--a-color-bg);
  font-family: var(--a-font-mono, monospace);
  font-size: 10px;
  font-weight: 600;
  border-radius: 4px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.16);
  transition:
    opacity 0.18s ease,
    transform 0.18s ease,
    visibility 0.18s ease;
  transition-delay: 0s;
  z-index: 999;
}
[data-hint]:hover::before {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
  transition-delay: 1.2s;
}
.skip-btn:hover,
.nav-btn:hover {
  opacity: 1;
  text-decoration: underline;
}

.main-play-btn {
  background: var(--a-color-text);
  color: var(--a-color-bg);
  border: 1px solid var(--a-color-text);
  border-radius: 4px;
  padding: 4px 16px;
  font-weight: 500;
  font-size: 11px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 0.1em;
  transition:
    transform 0.1s,
    background-color 0.15s;
}
.main-play-btn:active {
  transform: translateY(1px);
}

.progress-container {
  width: 100%;
  max-width: 600px;
  height: 24px;
}

/* Right Section */
.player-features {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 20px;
  font-family: var(--a-font-sans);
  font-weight: 950;
  font-size: 10px;
  letter-spacing: 0.1em;
  flex-shrink: 0;
}
.feature-link {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  border: 0;
  background: transparent;
  color: var(--a-color-text);
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  opacity: 0.5;
  padding: 0 0.5rem;
  border-bottom: 1.5px solid transparent;
  transition:
    opacity 0.2s,
    border-bottom-color 0.2s;
}
.feature-link:hover {
  opacity: 1;
  border-bottom-color: var(--a-color-text);
}

.feature-toggle {
  cursor: pointer;
  display: flex;
  align-items: center;
  border: 0;
  background: transparent;
  padding: 4px;
  color: var(--a-color-muted);
  transition: color 0.2s;
}
.feature-toggle:hover {
  color: var(--a-color-text);
}

.repeat-one-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.one-badge {
  position: absolute;
  font-size: 8px;
  font-weight: 950;
  font-family: var(--a-font-sans);
  color: currentColor;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -45%);
  line-height: 1;
}

.volume-container {
  display: flex;
  align-items: center;
  position: relative;
}
.volume-control {
  position: absolute;
  bottom: calc(100% + 12px);
  left: 50%;
  transform: translateX(-50%) translateY(6px);
  width: 48px;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition:
    opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.2s cubic-bezier(0.16, 1, 0.3, 1),
    visibility 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  padding: 12px 0 14px 0;
  z-index: 100;
  box-shadow: var(--a-shadow-dropdown, 0 12px 30px rgba(15, 23, 42, 0.12));
  border-radius: 12px;
}
:root.dark .volume-control {
  background: var(--a-color-bg);
  border-color: var(--a-color-border-dark, #334155);
}
.volume-control::before {
  content: "";
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  height: 16px;
}
.volume-control::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: var(--a-color-bg);
}
.volume-container:hover .volume-control,
.volume-container:focus-within .volume-control {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transform: translateX(-50%) translateY(0);
}
.vol-percentage {
  font-size: 11px;
  font-weight: 600;
  font-family: var(--a-font-mono, monospace);
  color: var(--a-color-muted);
  user-select: none;
  line-height: 1;
}
.vol-slider-wrapper {
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.vol-trigger {
  display: flex;
  align-items: center;
}
.vol-icon {
  cursor: pointer;
  border: 0;
  background: transparent;
  padding: 4px;
  color: var(--a-color-muted);
  transition: color 0.2s;
  flex-shrink: 0;
}
.vol-icon:hover {
  color: var(--a-color-text);
}

.vol-slider {
  -webkit-appearance: none;
  appearance: none;
  height: 96px;
  width: 6px;
  outline: none;
  border-radius: 3px;
  cursor: pointer;
  writing-mode: vertical-lr;
  direction: rtl;
  background: linear-gradient(
    to top,
    var(--a-color-primary, #2563eb) 0%,
    var(--a-color-primary, #2563eb) var(--vol-percent, 50%),
    var(--a-color-surface-muted, #f1f5f9) var(--vol-percent, 50%),
    var(--a-color-surface-muted, #f1f5f9) 100%
  );
  transition: background 0.1s linear;
}

:root.dark .vol-slider {
  background: linear-gradient(
    to top,
    var(--a-color-primary, #2563eb) 0%,
    var(--a-color-primary, #2563eb) var(--vol-percent, 50%),
    rgba(255, 255, 255, 0.12) var(--vol-percent, 50%),
    rgba(255, 255, 255, 0.12) 100%
  );
}

.vol-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--a-color-bg);
  border: 2px solid var(--a-color-primary, #2563eb);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.vol-slider:hover::-webkit-slider-thumb,
.vol-slider:active::-webkit-slider-thumb {
  transform: scale(1.25);
  box-shadow: 0 3px 8px rgba(37, 99, 235, 0.3);
}

.vol-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--a-color-bg);
  border: 2px solid var(--a-color-primary, #2563eb);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.vol-slider:hover::-moz-range-thumb,
.vol-slider:active::-moz-range-thumb {
  transform: scale(1.25);
  box-shadow: 0 3px 8px rgba(37, 99, 235, 0.3);
}

.queue-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  color: var(--a-color-muted);
  transition: all 0.2s;
  padding: 4px 8px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.05);
  border: none;
}
:root.dark .queue-trigger {
  background: rgba(255, 255, 255, 0.1);
}

.player-pin-btn {
  width: 2.75rem;
  height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
}

.player-pin-btn:hover,
.player-pin-btn:focus-visible {
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
}

@media (prefers-reduced-motion: reduce) {
  .player {
    transition-duration: 0.01ms;
  }
}
.queue-trigger:hover {
  color: var(--a-color-text);
  background: var(--a-color-overlay-soft);
}
.queue-trigger.active {
  color: var(--a-color-text);
  background: var(--a-color-overlay-soft);
}
.queue-count {
  font-family: monospace;
  font-size: 9px;
  font-weight: 500;
  min-width: 14px;
  text-align: center;
}

@media (max-width: 1023px) {
  .player-inner {
    gap: 1rem;
    padding: 0 1rem;
  }

  .player-info {
    flex: 0 0 auto;
    max-width: 18rem;
  }

  .player-controls-hub {
    width: clamp(240px, calc(100% - 420px), 440px);
  }

  .ctrl-row {
    gap: 14px;
  }

  .player-features {
    gap: 12px;
  }
}

@media (max-width: 1024px) {
  .player-inner {
    gap: 1rem;
  }
  .player-info {
    flex-basis: 320px;
  }
  .player-controls-hub {
    width: clamp(240px, calc(100% - 620px), 420px);
  }
  .player-features {
    gap: 12px;
  }
  .volume-container {
    display: none;
  }
}

.lyrics-panel {
  position: fixed;
  top: var(--a-topbar-height);
  bottom: var(--a-content-bottom-offset);
  left: 0;
  right: 0;
  width: 100%;
  height: calc(
    100dvh - var(--a-topbar-height) - var(--a-content-bottom-offset)
  );
  background: var(--a-color-bg);
  border-top: 1px solid var(--a-color-border-soft);
  z-index: var(--a-z-player-lyrics);
  padding: 3rem;
  display: flex;
  flex-direction: column;
}
.lyrics-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 2rem;
}
.close-btn {
  font-family: inherit;
  font-weight: var(--a-font-weight-strong, 700);
  font-size: 10px;
  letter-spacing: 0.1em;
  cursor: pointer;
  border-bottom: 1px solid var(--a-color-border);
}
.lyrics-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.placeholder-text {
  font-family: inherit;
  font-size: 2rem;
  font-weight: var(--a-font-weight-black, 900);
  margin-bottom: 1rem;
  color: var(--a-color-fg);
}
.song-meta {
  font-family: inherit;
  font-weight: var(--a-font-weight-strong, 700);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--a-color-muted);
}

.slide-up-enter-active {
  transition: transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.slide-up-leave-active {
  transition: transform 220ms cubic-bezier(0.4, 0, 1, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}

.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.4s cubic-bezier(0.2, 0, 0, 1);
}
.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(100%);
}

/* Player Center Favorite & Add button styles */
.player-fav-btn {
  background: transparent;
  border: 0;
  color: var(--a-color-muted);
  cursor: pointer;
  width: 2rem;
  height: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    color 0.15s ease,
    background-color 0.15s ease;
  margin-left: 0.5rem;
}
.player-fav-btn.is-active {
  color: #e05e5e !important;
}
.player-fav-btn:hover {
  background-color: var(--a-color-surface-muted);
}
.player-add-dropdown {
  position: relative;
  display: inline-flex;
}
.player-add-dropdown :deep(.p-dropdown-panel) {
  top: auto;
  bottom: calc(100% + 8px);
}
.player-add-btn {
  background: transparent;
  border: 0;
  color: var(--a-color-muted);
  cursor: pointer;
  width: 2rem;
  height: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    color 0.15s ease,
    background-color 0.15s ease;
}
.player-add-btn:hover {
  background-color: var(--a-color-surface-muted);
}

.track-add-menu {
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  box-shadow: var(--a-shadow-dropdown);
  padding: 0.4rem 0;
  min-width: 130px;
  max-width: 200px;
  display: flex;
  flex-direction: column;
}
.track-add-menu-header {
  font-family: var(--a-font-sans);
  font-size: 0.68rem;
  font-weight: 900;
  text-transform: uppercase;
  color: var(--a-color-muted);
  padding: 0.3rem 0.8rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  margin-bottom: 0.25rem;
}
.track-add-menu-empty {
  font-family: var(--a-font-sans);
  font-size: 0.72rem;
  color: var(--a-color-muted-soft);
  padding: 0.4rem 0.8rem;
}
.track-add-menu-item {
  background: transparent;
  border: 0;
  text-align: left;
  font-size: 0.82rem;
  padding: 0.4rem 0.8rem;
  color: var(--a-color-fg);
  cursor: pointer;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: background-color 0.15s ease;
}
.track-add-menu-item:hover {
  background-color: var(--a-color-surface-muted);
}

@media (max-width: 767px) {
  .player {
    height: var(--a-mobile-player-height);
    transform: none !important;
  }

  .player-reveal-handle,
  .player-pin-btn,
  .feature-toggle,
  .volume-container,
  .skip-btn,
  .nav-btn,
  .player-fav-btn,
  .player-add-dropdown,
  .player-add-btn {
    display: none;
  }

  .player-inner {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 44px 88px;
    gap: 0.75rem;
    padding: 0 0.75rem 16px;
  }

  .player-info,
  .player-info--collapsed {
    flex: 1 1 auto;
    width: auto;
    max-width: none;
    overflow: hidden;
    gap: 0.75rem;
  }

  .cover-wrap {
    width: 44px;
    height: 44px;
  }

  .player-meta,
  .player-meta--collapsed {
    display: block;
    min-width: 0;
    max-width: none;
    opacity: 1;
    pointer-events: auto;
    transform: none;
  }

  .player-controls-hub {
    position: static;
    transform: none;
    width: auto;
    min-width: 0;
  }

  .progress-container {
    position: absolute;
    right: 0.75rem;
    bottom: 1px;
    left: 0.75rem;
    width: auto;
    max-width: none;
    height: 24px;
  }

  .ctrl-row {
    gap: 0;
  }

  .main-play-btn,
  .queue-trigger {
    width: 44px;
    height: 44px;
  }

  .main-play-btn {
    padding: 0;
    white-space: nowrap;
  }

  .player-features {
    margin-left: 0;
    gap: 0;
  }

  .feature-link {
    width: 44px;
    min-width: 44px;
    height: 44px;
    padding: 0;
    opacity: 1;
    border-bottom: 0;
  }

  .feature-link span {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
  }

}
</style>
