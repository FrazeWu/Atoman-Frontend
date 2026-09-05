<template>
  <div v-if="player.currentSong" class="player-shell">
    <Transition name="player-display" appear>
    <div
      v-if="playerDisplayMode === 'full'"
      class="player"
      data-player-mode="full"
      :class="{ 'is-auto-hidden': !effectivePinned && !playerHovered }"
    @mouseenter="revealPlayer"
    @mouseleave="scheduleAutoHide"
    @focusin="revealPlayer"
    @focusout="scheduleAutoHide"
  >
    <div
      ref="playerInnerRef"
      class="player-inner"
      :class="{ 'player-inner--meta-collapsed': isMetaCollapsed }"
    >
      <button
        type="button"
        class="player-collapse-tab"
        aria-label="收起为仅封面"
        title="收起为仅封面"
        @click="setPlayerDisplayMode('cover')"
      >
        <ChevronRight :size="16" aria-hidden="true" />
      </button>
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

      <!-- Center: Controls -->
      <div ref="playerControlsRef" class="player-controls-hub">
        <div class="ctrl-row">
          <button v-if="isPodcast" type="button" class="skip-btn" aria-label="后退 15 秒" title="后退 15 秒" data-hint="后退 15S (←)" @click="player.skip(-15)">-15S</button>
          <button
            v-else
            type="button"
            class="player-fav-btn"
            :class="{ 'is-active': favoriteSongIds.has(String(player.currentSong.id)) }"
            :aria-label="favoriteSongIds.has(String(player.currentSong.id)) ? '移出最爱' : '添加到最爱'"
            :title="favoriteSongIds.has(String(player.currentSong.id)) ? '移出最爱' : '添加到最爱'"
            @click="toggleTrackFavorite(String(player.currentSong.id))"
          >
            <Heart :size="18" :fill="favoriteSongIds.has(String(player.currentSong.id)) ? 'currentColor' : 'none'" aria-hidden="true" />
          </button>
          <button type="button" class="nav-btn" aria-label="上一首" title="上一首" data-hint="上一首 (Alt+←)" @click="player.playPrevious()">上一首</button>
          <button
            type="button"
            class="main-play-btn"
            :aria-label="player.isPlaying ? '暂停' : '播放'"
            :title="player.isPlaying ? '暂停' : '播放'"
            :data-hint="player.isPlaying ? '暂停 (Space)' : '播放 (Space)'"
            @click="player.togglePlay()"
          >
            {{ player.isPlaying ? '暂停' : '播放' }}
          </button>
          <button type="button" class="nav-btn" aria-label="下一首" title="下一首" data-hint="下一首 (Alt+→)" @click="player.playNext()">下一首</button>
          <button v-if="isPodcast" type="button" class="skip-btn" aria-label="前进 15 秒" title="前进 15 秒" data-hint="前进 15S (→)" @click="player.skip(15)">+15S</button>
          <button v-else type="button" class="feature-toggle player-mode-btn" aria-label="切换播放模式" title="切换播放模式" data-hint="播放模式" @click="player.cyclePlaybackMode()">
            <div v-if="player.playbackMode === 'single'" class="repeat-one-wrapper">
              <Repeat :size="20" />
              <span class="one-badge">1</span>
            </div>
            <span v-else style="display: flex; align-items: center">
              <Repeat v-if="player.playbackMode === 'loop'" :size="20" />
              <Shuffle v-else-if="player.playbackMode === 'random'" :size="20" />
            </span>
          </button>

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
      </div>

      <!-- Right: Feature Strip -->
      <div class="player-features">
        <PDropdown v-if="player.currentSong && !isPodcast" class="player-add-dropdown" position="right">
          <template #trigger>
            <button class="player-add-btn" type="button" aria-label="添加到歌单" title="添加到歌单" @click="guardPlaylistMenu">
              <Plus :size="18" aria-hidden="true" />
            </button>
          </template>
          <template #default="{ close }">
            <div class="track-add-menu">
              <div class="track-add-menu-header">添加到歌单</div>
              <div v-if="!playlists.length" class="track-add-menu-empty">暂无歌单</div>
              <button v-for="p in playlists" :key="p.id" type="button" class="track-add-menu-item" @click="addTrackToPlaylist(String(p.id), String(player.currentSong.id), close)">
                {{ p.name }}
              </button>
            </div>
          </template>
        </PDropdown>

        <button
          type="button"
          class="feature-link"
          aria-label="歌词"
          title="歌词"
          data-hint="歌词 (L)"
          @click="player.toggleLyrics"
        >
          <span>{{ featureLabel }}</span>
        </button>

        <button type="button" class="feature-link" aria-label="评论" title="评论" @click="commentsOpen = true">
          <span>评</span>
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
                class="vol-slider"
                aria-label="音量"
                @input="(e) => player.setVolume(parseFloat((e.target as HTMLInputElement).value))"
              />
            </div>
          </div>
          <div class="vol-trigger" data-hint="静音 / 解除静音 (M)">
            <button
              type="button"
              class="vol-icon"
              :aria-label="player.volume > 0 ? '静音' : '解除静音'"
              :title="player.volume > 0 ? '静音' : '解除静音'"
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
          aria-label="播放队列"
          title="播放队列"
          @click="player.toggleQueue()"
        >
          <List :size="20" aria-hidden="true" />
          <span class="queue-count">{{ player.queue.length || 0 }}</span>
        </button>

      </div>
    </div>
    </div>

    <div
      v-else
      class="player-mini-window"
      data-player-mode="cover"
    >
      <button
        type="button"
        class="player-mini-cover"
        :aria-label="player.isPlaying ? '暂停播放' : '继续播放'"
        :title="player.isPlaying ? '暂停播放' : '继续播放'"
        @click="player.togglePlay()"
      >
        <img
          v-if="player.currentSong.cover_url"
          :src="player.currentSong.cover_url"
          alt=""
          class="player-cover"
        />
        <span v-else class="player-cover-fallback">{{ coverFallback }}</span>
        <svg class="player-mini-progress-ring" :data-progress="miniProgressPercent" viewBox="0 0 100 100" aria-hidden="true">
          <rect class="player-mini-progress-ring__track" x="3" y="3" width="94" height="94" pathLength="100" />
          <rect class="player-mini-progress-ring__value" x="3" y="3" width="94" height="94" pathLength="100" :style="{ strokeDashoffset: String(100 - miniProgressPercent) }" />
        </svg>
        <span v-if="!player.isPlaying" class="player-mini-play-overlay" aria-hidden="true">
          <Play :size="22" fill="currentColor" />
        </span>
      </button>
      <button
        type="button"
        class="player-mini-expand"
        aria-label="展开完整播放器"
        title="展开完整播放器"
        @click.stop="setPlayerDisplayMode('full')"
      >
        <ChevronLeft :size="15" aria-hidden="true" />
      </button>
    </div>
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
      :focus-annotation-id="
        typeof route.query.annotation_id === 'string'
          ? route.query.annotation_id
          : ''
      "
      :start-rebind="route.query.rebind === '1'"
      @close="player.closeLyrics"
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
    partial-width="42rem"
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
import { ApiErrorResponseError } from "@/api/client";
import { usePlayerStore } from "@/stores/player";
import { useAuthStore } from "@/stores/auth";
import { useAudioPlayerChrome } from "@/composables/useAudioPlayerChrome";
import { useMusicDrawers } from "@/composables/useMusicDrawers";
import { IconRepeat as Repeat, IconArrowsShuffle as Shuffle, IconList as List, IconVolume2 as Volume2, IconVolume as Volume1, IconVolume as Volume, IconVolumeOff as VolumeX, IconHeart as Heart, IconPlus as Plus, IconClock as Clock, IconChevronRight as ChevronRight, IconChevronLeft as ChevronLeft, IconChevronUp as ChevronUp, IconPlayerPlay as Play } from '@tabler/icons-vue';
import MusicLyricsPanel from "@/components/music/MusicLyricsPanel.vue";
import AudioWaveformProgress from "@/components/music/AudioWaveformProgress.vue";
import AudioPlayerQueue from "@/components/music/AudioPlayerQueue.vue";
import CommentSideSheet from "@/components/comment/CommentSideSheet.vue";
import PDropdown from "@/components/ui/PDropdown.vue";
import PToast from "@/components/ui/PToast.vue";
import { useMusicFavoritePlaylist } from "@/composables/useMusicFavoritePlaylist";
import { useLoginRedirect } from "@/composables/useLoginRedirect";
import { listMusicPlaylists, type MusicPlaylistSummary } from "@/api/musicV1";
import { reportError } from "@/utils/logger";
import { usePodcastPlayerActions } from "@/composables/usePodcastPlayerActions";

const player = usePlayerStore();
const route = useRoute();
const lyricsPanelRef = ref<{ requestClose: () => void } | null>(null);
const { openAlbum, openArtist } = useMusicDrawers();
const authStore = useAuthStore();
const { requireLogin } = useLoginRedirect();
const playerInfoRef = ref<HTMLElement | null>(null);
const playerMetaRef = ref<HTMLElement | null>(null);
const playerControlsRef = ref<HTMLElement | null>(null);
const playerDisplayMode = ref<"full" | "cover">("full");
const commentsOpen = ref(false);

watch(
  () => player.lyricsCloseRequest,
  (request, previousRequest) => {
    if (request === previousRequest) return;
    if (lyricsPanelRef.value) {
      lyricsPanelRef.value.requestClose();
      return;
    }
    player.closeLyrics();
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
  right: 0;
  bottom: calc(
    var(--a-footer-reserved-height) + var(--a-mobile-nav-reserved-height) +
      1.25rem
  );
  left: 2.5vw;
  z-index: var(--a-z-player, 720);
  height: 4.5rem;
  border: 1px solid var(--a-color-border-soft);
  border-right: 0;
  border-radius: 0;
  background: #fff;
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.16);
  color: #131c2e;
  transition: transform var(--a-motion-emphasis) var(--a-motion-ease-enter);
}

:root.dark .player {
  border-color: var(--a-color-border-soft);
  background: #fff;
  color: #131c2e;
}

.player.is-auto-hidden {
  transform: translateY(calc(100% - 10px));
}

.player-inner {
  display: grid;
  grid-template-columns: 20px minmax(10rem, 0.85fr) minmax(20rem, 2.4fr) minmax(17rem, 1.25fr) minmax(14rem, 0.8fr);
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  height: 100%;
  padding: 0 0.75rem 0 0;
}

.player-collapse-tab {
  align-self: stretch;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
}

.player-collapse-tab:hover,
.player-collapse-tab:focus-visible {
  background: var(--a-color-primary-soft, #edf2ff);
  color: var(--a-color-primary);
  outline: none;
}

/* Left Section */
.player-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  transition:
    flex-basis var(--a-motion-state) var(--a-motion-ease-enter),
    width var(--a-motion-state) var(--a-motion-ease-enter),
    gap var(--a-motion-state) var(--a-motion-ease-enter);
}
.player-info--collapsed {
  min-width: 52px;
  gap: 0;
}
.cover-wrap {
  position: relative;
  align-self: center;
  width: 3.25rem;
  height: 3.25rem;
  border: 0;
  border-radius: 0;
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
  transition: opacity var(--a-motion-state) ease;
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
    max-width var(--a-motion-state) var(--a-motion-ease-enter),
    opacity var(--a-motion-state) var(--a-motion-ease-enter),
    transform var(--a-motion-state) var(--a-motion-ease-enter),
    margin var(--a-motion-state) var(--a-motion-ease-enter);
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
  border-radius: 0;
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
  display: flex;
  align-items: center;
  min-width: 0;
}
.ctrl-row {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  gap: clamp(0.25rem, 0.8vw, 0.75rem);
  font-family: var(--a-font-sans);
  font-weight: 950;
  font-size: 10px;
  letter-spacing: 0.15em;
  color: inherit;
  flex-wrap: nowrap;
  white-space: nowrap;
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
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 10px;
  font-weight: 600;
  border-radius: 0;
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
  border-radius: 0;
  padding: 4px 16px;
  font-weight: 500;
  font-size: 11px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 0;
  transition:
    transform 0.1s,
    background-color 0.15s;
}
.main-play-btn:active {
  transform: translateY(1px);
}

.progress-container {
  width: 100%;
  min-width: 0;
  height: 2.75rem;
  display: flex;
  align-items: center;
}

.progress-container > :deep(.waveform-progress) {
  width: 100%;
}

.player-waveform {
  padding-right: 0.25rem;
}

/* Right Section */
.player-features {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;
  min-width: 0;
  font-family: var(--a-font-sans);
  font-weight: 950;
  font-size: 10px;
  letter-spacing: 0.1em;
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
  font-size: 12px;
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
  border-radius: 0;
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
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
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
  transition:
    color var(--a-motion-state) ease,
    background-color var(--a-motion-state) ease,
    opacity var(--a-motion-state) ease;
  padding: 4px 8px;
  border-radius: 0;
  background: rgba(0, 0, 0, 0.05);
  border: none;
}
:root.dark .queue-trigger {
  background: rgba(255, 255, 255, 0.1);
}

.player-fav-btn,
.player-add-btn {
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

.player-fav-btn:hover,
.player-fav-btn:focus-visible,
.player-add-btn:hover,
.player-add-btn:focus-visible {
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
}

.player-mini-window {
  position: fixed;
  right: 0;
  bottom: calc(
    var(--a-footer-reserved-height) + var(--a-mobile-nav-reserved-height) +
      1.25rem
  );
  z-index: var(--a-z-player, 720);
  display: flex;
  display: grid;
  place-items: center;
  width: 4.5rem;
  height: 4.5rem;
  overflow: visible;
  border: 1px solid var(--a-color-border-soft);
  border-right: 0;
  border-radius: 0;
  background: #fff;
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.16);
}

.player-mini-cover {
  position: relative;
  display: block;
  width: 4.5rem;
  height: 4.5rem;
  padding: 0;
  border: 0;
  background: transparent;
  font: inherit;
  cursor: pointer;
}

.player-mini-cover:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 2px;
}

.player-mini-cover .player-cover,
.player-mini-cover .player-cover-fallback {
  display: block;
  width: 100%;
  height: 100%;
}

.player-mini-progress-ring {
  position: absolute;
  inset: -0.2rem;
  width: calc(100% + 0.4rem);
  height: calc(100% + 0.4rem);
  overflow: visible;
  pointer-events: none;
}

.player-mini-progress-ring__track,
.player-mini-progress-ring__value {
  fill: none;
  stroke-width: 3;
  stroke-linejoin: miter;
}

.player-mini-progress-ring__track {
  stroke: var(--a-color-border-soft);
}

.player-mini-progress-ring__value {
  stroke: var(--a-color-primary);
  stroke-dasharray: 100;
  transition: stroke-dashoffset 160ms linear;
}

.player-mini-play-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: grid;
  place-items: center;
  color: #fff;
  background: rgba(19, 28, 46, 0.42);
  pointer-events: none;
}

.player-mini-expand {
  position: absolute;
  top: 50%;
  left: -1.25rem;
  display: grid;
  width: 1.25rem;
  height: 4.5rem;
  place-items: center;
  padding: 0;
  border: 1px solid var(--a-color-border-soft);
  border-right: 0;
  border-radius: 0;
  background: #fff;
  color: var(--a-color-muted);
  cursor: pointer;
  transform: translateY(-50%);
  z-index: 2;
}

.player-mini-expand:focus-visible {
  background: var(--a-color-primary-soft, #edf2ff);
  color: var(--a-color-primary);
  outline: none;
}

.player-display-enter-active {
  animation: player-display-enter var(--a-motion-emphasis) var(--a-motion-ease-enter) both;
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

  .volume-container {
    display: none;
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
  transition: transform var(--a-motion-overlay) var(--a-motion-ease-enter);
  will-change: transform;
}

.slide-up-leave-active {
  transition: transform var(--a-motion-overlay-exit) var(--a-motion-ease-exit);
  will-change: transform;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}

.slide-right-enter-active {
  transition: transform var(--a-motion-overlay) var(--a-motion-ease-enter);
  will-change: transform;
}
.slide-right-leave-active {
  transition: transform var(--a-motion-overlay-exit) var(--a-motion-ease-exit);
  will-change: transform;
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
    right: 0;
    bottom: calc(var(--a-footer-reserved-height) + var(--a-mobile-nav-reserved-height));
    left: 0;
    height: var(--a-mobile-player-height);
    border-right: 0;
    border-bottom: 0;
    border-left: 0;
    border-radius: 0;
  }

  .player.is-auto-hidden {
    transform: none !important;
  }

  .player-collapse-tab,
  .player-waveform,
  .feature-toggle:not(.player-mode-btn),
  .volume-container,
  .nav-btn,
  .player-fav-btn,
  .player-add-dropdown,
  .player-add-btn {
    display: none;
  }

  .player-inner {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 116px 88px;
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
    width: 3rem;
    height: 3rem;
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

  .progress-container {
    display: none;
  }

  .player-controls-hub {
    position: static;
    transform: none;
    width: auto;
    min-width: 0;
  }

  .ctrl-row {
    gap: 0.25rem;
  }

  .skip-btn {
    width: 32px;
    height: 44px;
    padding: 0;
    opacity: 1;
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

  .player-mini-window {
    right: 0;
    bottom: var(--a-mobile-nav-reserved-height);
    width: 3rem;
    height: 3rem;
  }

  .player-mini-cover {
    width: 3rem;
    height: 3rem;
  }

  .player-mini-expand {
    height: 3rem;
  }

}

</style>
