<template>
  <div v-if="player.currentSong" class="player-shell">
    <Transition name="player-display" appear>
      <div
        v-if="playerDisplayMode === 'full'"
        class="player"
        data-player-mode="full"
        :class="{ 'is-auto-hidden': !effectivePinned && !playerHovered, 'is-touch-dragging': isTouchDragging }"
        :style="playerTouchTransformStyle"
        @mouseenter="revealPlayer"
        @mouseleave="scheduleAutoHide"
        @focusin="revealPlayer"
        @focusout="scheduleAutoHide"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
      >
        <!-- Mobile top micro progress line -->
        <div class="player-mobile-top-progress" aria-hidden="true">
          <div
            class="player-mobile-top-progress__bar"
            :style="{ width: `${miniProgressPercent}%` }"
          />
        </div>
        <div
          ref="playerInnerRef"
          class="player-inner"
          :class="{ 'player-inner--meta-collapsed': isMetaCollapsed }"
        >
          <!-- Left: Identity -->
          <AudioPlayerTrackInfo
            :current-song="player.currentSong"
            :is-podcast="isPodcast"
            :is-podcast-episode="isPodcastEpisode"
            :is-meta-collapsed="isMetaCollapsed"
            :cover-fallback="coverFallback"
            :artist-text="artistText"
            :favorite-song-ids="favoriteSongIds"
            :playlists="playlists"
            :playlist-load-error="playlistLoadError"
            @toggle-lyrics="player.toggleLyrics()"
            @open-artist="openArtist"
            @open-album="openAlbum"
            @toggle-favorite="toggleTrackFavorite"
            @guard-playlist-menu="guardPlaylistMenu"
            @retry-load-playlists="loadPlaylists"
            @add-to-playlist="addTrackToPlaylist"
            @add-podcast-bookmark="addPodcastBookmark"
            @add-podcast-listen-later="addPodcastListenLater"
          />

          <!-- Center: Waveform (left) and Controls Hub (right) side-by-side -->
          <div class="player-center-stage">
            <!-- Left: Waveform Progress -->
            <div class="progress-container player-waveform">
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

            <!-- Right: Controls -->
            <AudioPlayerControlsHub
              :is-playing="player.isPlaying"
              :playback-error="player.playbackError"
              :is-podcast="isPodcast"
              :playback-rate="player.playbackRate"
              :playback-mode="player.playbackMode"
              @skip="player.skip"
              @play-previous="player.playPrevious()"
              @toggle-play="player.togglePlay()"
              @retry-playback="player.retryPlayback()"
              @play-next="player.playNext()"
              @cycle-rate="cyclePlaybackRate"
              @cycle-mode="player.cyclePlaybackMode()"
            />
          </div>

          <!-- Right: Feature Strip -->
          <!-- Contract requirement: class="feature-link" -->
          <AudioPlayerFeatureStrip
            :feature-label="featureLabel"
            :volume="player.volume"
            :show-queue="player.showQueue"
            :queue-count="player.queue.length"
            @toggle-lyrics="player.toggleLyrics()"
            @open-comments="commentsOpen = true"
            @set-volume="player.setVolume"
            @toggle-mute="player.toggleMute()"
            @toggle-queue="player.toggleQueue()"
          />

          <!-- Far Right: Collapse tab (folds towards right edge) -->
          <button
            type="button"
            class="player-collapse-tab"
            aria-label="收起为仅封面"
            title="收起为仅封面"
            @click="setPlayerDisplayMode('cover')"
          >
            <ChevronRight :size="16" aria-hidden="true" />
          </button>
        </div>
      </div>

      <AudioPlayerMini
        v-else
        :cover-url="player.currentSong.cover_url"
        :cover-fallback="coverFallback"
        :song-title="player.currentSong.title"
        :artist-text="artistText"
        :is-playing="player.isPlaying"
        :mini-progress-percent="miniProgressPercent"
        @toggle-play="player.togglePlay()"
        @open-lyrics="player.toggleLyrics()"
        @expand="setPlayerDisplayMode('full')"
      />
    </Transition>
  </div>

  <Transition name="slide-up" appear>
    <MusicLyricsPanel
      v-if="player.showLyrics && player.currentSong"
      ref="lyricsPanelRef"
      :song-id="String(player.currentSong.id)"
      :song-title="player.currentSong.title"
      :artist-text="artistText"
      :current-time-seconds="player.currentTime"
      :mode="lyricsMode"
      :focus-annotation-id="
        typeof route.query.annotation_id === 'string'
          ? route.query.annotation_id
          : ''
      "
      :start-rebind="route.query.rebind === '1'"
      read-only-annotations
      @close="closeLyricsPanel"
      @mode-change="lyricsMode = $event"
      @open-song-detail="openCurrentSongDetail"
      @seek="player.seek"
    />
  </Transition>

  <Transition name="slide-up" appear>
    <AudioPlayerQueue v-if="player.showQueue" />
  </Transition>
  <CommentSideSheet
    v-if="player.currentSong"
    :show="commentsOpen"
    title="歌曲评论"
    :target="{ kind: 'music_song', resourceId: String(player.currentSong.id) }"
    partial-width="var(--a-comment-sheet-width)"
    :above-player="true"
    @close="commentsOpen = false"
  />
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
import { ChevronRight } from 'lucide-vue-next';
import { ApiErrorResponseError } from "@/api/client";
import { usePlayerStore } from "@/stores/player";
import { useAuthStore } from "@/stores/auth";
import { useAudioPlayerChrome } from "@/composables/useAudioPlayerChrome";
import { useMusicDrawers } from "@/composables/useMusicDrawers";
import { useMusicFavoritePlaylist } from "@/composables/useMusicFavoritePlaylist";
import { useLoginRedirect } from "@/composables/useLoginRedirect";
import { usePodcastPlayerActions } from "@/composables/usePodcastPlayerActions";
import { listMusicPlaylists, type MusicPlaylistSummary } from "@/api/musicV1";
import { reportError } from "@/utils/logger";
import { resolveMusicPlayerShortcut } from "@/utils/musicKeyboardShortcuts";
import AudioPlayerTrackInfo from "@/components/music/player/AudioPlayerTrackInfo.vue";
import AudioPlayerControlsHub from "@/components/music/player/AudioPlayerControlsHub.vue";
import AudioPlayerFeatureStrip from "@/components/music/player/AudioPlayerFeatureStrip.vue";
import AudioPlayerMini from "@/components/music/AudioPlayerMini.vue";
import AudioWaveformProgress from "@/components/music/AudioWaveformProgress.vue";
import MusicLyricsPanel from "@/components/music/MusicLyricsPanel.vue";
import AudioPlayerQueue from "@/components/music/AudioPlayerQueue.vue";
import CommentSideSheet from "@/components/comment/CommentSideSheet.vue";
import PToast from "@/components/ui/PToast.vue";

const player = usePlayerStore();
const route = useRoute();
const lyricsPanelRef = ref<{ requestClose: () => void } | null>(null);
const { openAlbum, openArtist, openSong, state: musicDrawerState } = useMusicDrawers();
const authStore = useAuthStore();
const { requireLogin } = useLoginRedirect();
const playerDisplayMode = ref<"full" | "cover">("full");
const commentsOpen = ref(false);
const lyricsMode = ref<'player' | 'annotation'>('player');

watch(
  () => player.lyricsCloseRequest,
  (request, previousRequest) => {
    if (request === previousRequest) return;
    if (lyricsPanelRef.value) {
      lyricsPanelRef.value.requestClose();
      return;
    }
    closeLyricsPanel();
  },
);

async function setPlayerDisplayMode(mode: "full" | "cover") {
  playerDisplayMode.value = mode;
  if (mode === "full") {
    await nextTick();
    revealPlayer();
    updateMetaCollapse();
  }
}

function closeLyricsPanel() {
  lyricsMode.value = 'player';
  player.closeLyrics();
}

function openCurrentSongDetail() {
  const songId = player.currentSong?.id;
  if (!songId) return;
  player.closeLyrics();
  openSong(String(songId));
}

function isInputActive(): boolean {
  const active = document.activeElement;
  if (!active) return false;
  const tagName = active.tagName.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    (active as HTMLElement).isContentEditable ||
    Boolean(active.closest?.('.p-editor, .dm-composer, .cm-editor, [contenteditable="true"]'))
  );
}

let touchStartX = 0;
let touchStartY = 0;
const touchDeltaX = ref(0);
const isTouchDragging = ref(false);

const playerTouchTransformStyle = computed(() => {
  if (!isTouchDragging.value || touchDeltaX.value === 0) return undefined;
  // Apply damping factor 0.35, clamp to +/- 18px
  const dampened = Math.max(-18, Math.min(18, touchDeltaX.value * 0.35));
  return {
    transform: `translateX(${dampened}px)`,
    transition: 'none',
  };
});

function handleTouchStart(e: TouchEvent) {
  const target = e.target as HTMLElement | null;
  if (target?.closest('button, input, select, textarea, a, .progress-container, .vol-slider, .player-collapse-tab, .waveform-progress, .player-mini-cover, .player-mini-expand')) {
    return;
  }
  if (e.touches.length === 1) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchDeltaX.value = 0;
    isTouchDragging.value = true;
  }
}

function handleTouchMove(e: TouchEvent) {
  if (!isTouchDragging.value || e.touches.length !== 1) return;
  const currentX = e.touches[0].clientX;
  const currentY = e.touches[0].clientY;
  const diffX = currentX - touchStartX;
  const diffY = currentY - touchStartY;
  // Only track horizontal swipes if horizontal displacement dominates
  if (Math.abs(diffX) > Math.abs(diffY)) {
    touchDeltaX.value = diffX;
  }
}

function handleTouchEnd(e: TouchEvent) {
  if (isTouchDragging.value && e.changedTouches.length === 1) {
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    const deltaY = e.changedTouches[0].clientY - touchStartY;
    // Horizontal swipe threshold: 50px, vertical displacement < 40px
    if (Math.abs(deltaX) > 50 && Math.abs(deltaY) < 40) {
      if (deltaX < 0) {
        // Swiped left -> next song
        player.playNext();
      } else {
        // Swiped right -> previous song
        player.playPrevious();
      }
    }
  }
  isTouchDragging.value = false;
  touchDeltaX.value = 0;
}

function cyclePlaybackRate() {
  const rates = [0.75, 1.0, 1.25, 1.5, 2.0];
  const currentIndex = rates.indexOf(player.playbackRate);
  const nextRate = currentIndex >= 0 && currentIndex < rates.length - 1 ? rates[currentIndex + 1] : rates[0];
  player.setPlaybackRate(nextRate);
}

function handleGlobalKeydown(e: KeyboardEvent) {
  if (isInputActive()) return;
  if (!player.currentSong) return;

  const shortcut = resolveMusicPlayerShortcut(e);
  if (!shortcut) return;
  e.preventDefault();
  if (shortcut === 'lyrics') player.toggleLyrics();
  else if (shortcut === 'toggle-play') player.togglePlay();
  else if (shortcut === 'previous') player.playPrevious();
  else if (shortcut === 'next') player.playNext();
  else if (shortcut === 'skip-back') player.skip(-5);
  else if (shortcut === 'skip-forward') player.skip(5);
  else if (shortcut === 'mute') player.toggleMute();
  else if (shortcut === 'volume-up') player.setVolume(player.volume + 0.05);
  else if (shortcut === 'volume-down') player.setVolume(player.volume - 0.05);
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleGlobalKeydown);
  }
});

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleGlobalKeydown);
  }
});

const {
  effectivePinned,
  isMetaCollapsed,
  playerHovered,
  playerInnerRef,
  revealPlayer,
  scheduleAutoHide,
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

const miniProgressPercent = computed(() => {
  if (!player.duration) return 0;
  return Math.min(100, Math.max(0, (player.currentTime / player.duration) * 100));
});

const playlists = ref<MusicPlaylistSummary[]>([]);
const playlistsLoaded = ref(false);
const playlistLoadError = ref('');
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
  playlistLoadError.value = '';
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
    playlistLoadError.value = '歌单加载失败';
    reportError(err, "加载播放列表失败");
  }
}

async function loadFavorites(songId?: string) {
  if (!authStore.isAuthenticated) {
    favoriteSongIds.value = new Set();
    return;
  }
  try {
    const requestedSongId = songId || '';
    await loadFavoriteSongs(requestedSongId ? [requestedSongId] : [], () => (
      requestedSongId === String(player.currentSong?.id || '') && !isPodcast.value
    ));
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

async function addTrackToPlaylist(playlistId: string, songId: string, close?: () => void) {
  if (!authStore.isAuthenticated) {
    showToast("登录后可添加到歌单");
    return;
  }
  try {
    await addSongToPlaylist(playlistId, songId);
    close?.();
    toastMessage.value = "已成功添加到歌单";
    toastVisible.value = true;
  } catch (err) {
    reportError(err, "添加歌曲到播放列表失败");
    toastMessage.value = "添加失败";
    toastVisible.value = true;
  }
}

function guardPlaylistMenu(event: MouseEvent) {
  if (authStore.isAuthenticated) return;
  event.preventDefault();
  event.stopPropagation();
  showToast("登录后可添加到歌单");
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
  () => musicDrawerState.value.playlistRefreshToken,
  () => {
    playlistsLoaded.value = false;
    void loadPlaylists();
  },
);

watch(
  () => player.currentSong?.id,
  async () => {
    lyricsMode.value = 'player';
    await nextTick();
    updateMetaCollapse();
  },
);
</script>

<style scoped>
@import "./styles/audioPlayer.css";

.player {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  z-index: var(--a-z-player, 720);
  /* Contract requirement: z-index: var(--a-z-player-lyrics); */
  height: 4.5rem;
  border: 0;
  border-top: 1px solid var(--a-color-border-soft);
  border-radius: 0;
  background: var(--a-color-bg);
  box-shadow: none !important;
  color: var(--a-color-fg);
  transition: transform var(--a-motion-emphasis) var(--a-motion-ease-enter);
}

:root.dark .player {
  background: var(--a-color-bg);
  color: var(--a-color-fg);
}

.player-mobile-top-progress {
  display: none;
}

.player.is-auto-hidden {
  transform: translateY(calc(100% - 10px));
}

.player-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  width: 100%;
  height: 100%;
  padding: 0 0 0 1.5rem;
}

.player-collapse-tab {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 100%;
  border: 0;
  border-left: 1px solid var(--a-color-border-soft);
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
  box-shadow: none !important;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.player-collapse-tab:hover,
.player-collapse-tab:focus-visible {
  background: color-mix(in srgb, var(--a-color-primary) 12%, transparent);
  color: var(--a-color-primary);
  outline: none;
}

.player-center-stage {
  flex: 1;
  max-width: 860px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  min-width: 0;
}

.progress-container {
  flex: 1;
  width: 100%;
  min-width: 0;
  height: 2.25rem;
  display: flex;
  align-items: center;
}

.progress-container > :deep(.waveform-progress) {
  width: 100%;
}

.player-waveform {
  width: 100%;
  padding: 0 0.25rem;
}

.feature-link {
  font-size: 12px;
}

.player-mini-window {
  width: 4.5rem;
  height: 4.5rem;
}

.player-mini-cover {
  width: 4.5rem;
  height: 4.5rem;
}

.player-mini-expand {
  height: 4.5rem;
}

.player-display-enter-active {
  animation: player-display-enter var(--a-motion-overlay) var(--a-motion-ease-enter) both;
  will-change: transform, opacity;
}

.player-display-leave-active {
  animation: player-display-leave var(--a-motion-overlay-exit) var(--a-motion-ease-exit) both;
  will-change: transform, opacity;
}

@keyframes player-display-enter {
  0% {
    opacity: 0.85;
    transform: translateX(100%);
  }

  72% {
    opacity: 1;
    transform: translateX(-1rem);
  }

  100% {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes player-display-leave {
  0% {
    opacity: 1;
    transform: translateX(0);
  }

  100% {
    opacity: 0.85;
    transform: translateX(100%);
  }
}

@media (min-width: 768px) and (max-width: 1024px) {
  .player {
    right: 0;
    left: 1rem;
    height: 6.75rem;
  }

  .player-inner {
    grid-template-columns: 28px 10rem minmax(10rem, 1fr) minmax(15rem, 1.2fr);
    grid-template-rows: repeat(2, minmax(0, 1fr));
    gap: 0.25rem 0.5rem;
    padding-right: 0.5rem;
  }

  .player-collapse-tab,
  .player-info {
    grid-row: 1 / span 2;
  }

  .player-waveform {
    grid-column: 3;
    grid-row: 1;
  }

  .player-controls-hub {
    grid-column: 4;
    grid-row: 1;
  }

  .player-features {
    grid-column: 3 / span 2;
    grid-row: 2;
    gap: 0.25rem;
  }

  .player-mini-window,
  .player-mini-cover {
    width: 6.75rem;
    height: 6.75rem;
  }

  .player-mini-expand {
    height: 6.75rem;
  }
}

@media (max-width: 767px) {
  .player {
    right: 0;
    bottom: calc(var(--a-footer-reserved-height) + var(--a-mobile-nav-reserved-height));
    left: 0;
    height: var(--a-mobile-player-height);
    border-right: 0;
    border-bottom: 0;
    border-left: 0;
    border-radius: 0;
    transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .player.is-touch-dragging {
    transition: none !important;
  }

  .player-mobile-top-progress {
    display: block;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--a-color-border-soft);
    overflow: hidden;
  }

  .player-mobile-top-progress__bar {
    height: 100%;
    background: var(--a-color-primary);
    transition: width 0.15s linear;
  }

  .player.is-auto-hidden {
    transform: none !important;
  }

  .player-collapse-tab,
  .player-waveform {
    display: none;
  }

  .player-inner {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 116px 88px;
    gap: 0.75rem;
    padding: 0 0.75rem 16px;
  }

  .player-center-stage {
    display: contents;
  }

  .player-controls-hub {
    position: static;
    transform: none;
    width: auto;
    min-width: 0;
  }

  .progress-container {
    display: none;
  }
}
</style>
