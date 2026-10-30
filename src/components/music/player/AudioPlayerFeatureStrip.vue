<template>
  <div class="player-features">
    <!-- 最爱 (Favorite) -->
    <button
      v-if="currentSong && !isPodcast"
      type="button"
      class="player-fav-btn"
      :class="{ 'is-active': isFavorite }"
      :aria-label="isFavorite ? '移出最爱' : '添加到最爱'"
      :title="isFavorite ? '移出最爱' : '添加到最爱'"
      @click="$emit('toggle-favorite', String(currentSong?.id))"
    >
      <PIcon :name="isFavorite ? 'heart-filled' : 'heart'" size="md" class="fav-icon" :class="{ 'is-filled': isFavorite }" aria-hidden="true" />
    </button>

    <!-- 收藏 (添加到歌单) -->
    <AudioPlayerPlaylistPopover
      v-if="currentSong && !isPodcast"
      :current-song-id="currentSong?.id"
      :is-podcast="isPodcast"
      :playlists="playlists"
      :playlist-load-error="playlistLoadError"
      @trigger-click="$emit('guard-playlist-menu', $event)"
      @retry-load="$emit('retry-load-playlists')"
      @add-to-playlist="(pId, sId, close) => $emit('add-to-playlist', pId, sId, close)"
    />

    <!-- 离线缓存 (Offline Cache) -->
    <button
      v-if="currentSong?.audio_url && !isPodcast"
      type="button"
      class="player-offline-btn"
      :class="{ 'is-cached': isCached, 'is-caching': isCaching }"
      :aria-label="isCached ? '移除离线副本' : '保存离线副本'"
      :title="isCached ? '已离线（点击移除）' : (isCaching ? '正在离线下载…' : '保存离线副本')"
      :disabled="isCaching"
      @click="$emit('toggle-offline-cache')"
    >
      <Check v-if="isCached" :size="16" aria-hidden="true" />
      <Loader2 v-else-if="isCaching" :size="16" class="animate-spin" aria-hidden="true" />
      <Download v-else :size="16" aria-hidden="true" />
    </button>

    <!-- 播客收藏/稍后听 -->
    <button
      v-if="isPodcastEpisode"
      type="button"
      class="player-fav-btn"
      title="收藏单集"
      data-hint="收藏单集"
      @click="$emit('add-podcast-bookmark', currentSong?.source_id)"
    >
      <PIcon name="heart" size="md" />
    </button>
    <button
      v-if="isPodcastEpisode"
      type="button"
      class="player-add-btn"
      title="稍后听"
      data-hint="稍后听"
      @click="$emit('add-podcast-listen-later', currentSong?.source_id)"
    >
      <PIcon name="clock" size="md" />
    </button>

    <!-- 歌词 / 说明切换 -->
    <button
      type="button"
      class="feature-link"
      :aria-label="isPodcast ? '节目说明' : '歌词'"
      :title="isPodcast ? '节目说明' : '歌词'"
      :data-hint="isPodcast ? '说明 (Shift+F)' : '歌词 (Shift+F)'"
      @click="$emit('toggle-lyrics')"
    >
      <span>{{ featureLabel }}</span>
    </button>

    <!-- 歌曲评论 -->
    <button
      type="button"
      class="feature-link"
      aria-label="评论"
      title="评论"
      @click="$emit('open-comments')"
    >
      <span>评</span>
    </button>

    <!-- 音量控制 -->
    <AudioPlayerVolume
      :volume="volume"
      @change="$emit('set-volume', $event)"
      @toggle-mute="$emit('toggle-mute')"
    />

    <!-- 播放队列触发按钮 -->
    <button
      class="queue-trigger"
      :class="{ active: showQueue }"
      type="button"
      aria-label="播放队列"
      title="播放队列"
      @click="$emit('toggle-queue')"
    >
      <PIcon name="list" size="lg" aria-hidden="true" />
      <span class="queue-count">{{ queueCount || 0 }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { Check, Download, Loader2 } from 'lucide-vue-next'
import PIcon from '@/components/ui/PIcon.vue'
import AudioPlayerVolume from '@/components/music/AudioPlayerVolume.vue'
import AudioPlayerPlaylistPopover from '@/components/music/AudioPlayerPlaylistPopover.vue'

withDefaults(
  defineProps<{
    featureLabel: string
    volume: number
    showQueue: boolean
    queueCount: number
    currentSong?: any
    isPodcast?: boolean
    isPodcastEpisode?: boolean
    isFavorite?: boolean
    isCached?: boolean
    isCaching?: boolean
    playlists?: any[]
    playlistLoadError?: string
  }>(),
  {
    currentSong: null,
    isPodcast: false,
    isPodcastEpisode: false,
    isFavorite: false,
    isCached: false,
    isCaching: false,
    playlists: () => [],
    playlistLoadError: '',
  },
)

defineEmits<{
  (e: 'toggle-lyrics'): void
  (e: 'open-comments'): void
  (e: 'set-volume', volume: number): void
  (e: 'toggle-mute'): void
  (e: 'toggle-queue'): void
  (e: 'toggle-favorite', songId: string): void
  (e: 'toggle-offline-cache'): void
  (e: 'guard-playlist-menu', event: MouseEvent): void
  (e: 'retry-load-playlists'): void
  (e: 'add-to-playlist', playlistId: string, songId: string, close?: () => void): void
  (e: 'add-podcast-bookmark', sourceId?: string): void
  (e: 'add-podcast-listen-later', sourceId?: string): void
}>()
</script>

<style scoped>
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
  box-shadow: none !important;
}

.feature-link {
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  border: 0;
  border-radius: var(--a-radius-control, 4px);
  background: transparent;
  color: var(--a-color-text);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  opacity: 0.65;
  padding: 0 0.55rem;
  box-shadow: none !important;
  transition:
    opacity 0.15s ease,
    background-color 0.15s ease,
    color 0.15s ease;
}

.feature-link:hover {
  opacity: 1;
  background: var(--a-color-surface-muted);
}

.player-fav-btn,
.player-add-btn,
.player-offline-btn {
  width: 2rem;
  height: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--a-radius-control, 4px);
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease;
  box-shadow: none !important;
}

.player-fav-btn:hover,
.player-fav-btn:focus-visible,
.player-add-btn:hover,
.player-add-btn:focus-visible,
.player-offline-btn:hover,
.player-offline-btn:focus-visible {
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
}

.player-offline-btn.is-cached {
  color: var(--a-color-primary, #2563eb);
}

.player-fav-btn.is-active {
  color: var(--a-color-danger);
}

.fav-icon.is-filled {
  color: var(--a-color-danger);
}

.queue-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  color: var(--a-color-muted);
  transition:
    color var(--a-motion-state, 0.15s) ease,
    background-color var(--a-motion-state, 0.15s) ease,
    opacity var(--a-motion-state, 0.15s) ease;
  padding: 4px 8px;
  border-radius: var(--a-radius-control, 4px);
  background: rgba(0, 0, 0, 0.05);
  border: none;
  box-shadow: none !important;
}

:root.dark .queue-trigger {
  background: rgba(255, 255, 255, 0.1);
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

/* Tooltip 快捷键提示 */
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
  border-radius: var(--a-radius-control, 4px);
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  box-shadow: none !important;
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

@media (hover: none) {
  [data-hint]::before {
    display: none !important;
  }
}

@media (max-width: 767px) {
  .player-fav-btn,
  .player-add-btn,
  .player-offline-btn,
  .player-add-dropdown {
    display: none;
  }

  .player-features {
    margin-left: 0;
    gap: 0;
  }

  .queue-trigger {
    width: 44px;
    height: 44px;
  }

  .feature-link {
    width: 44px;
    min-width: 44px;
    height: 44px;
    padding: 0;
    opacity: 1;
    border-bottom: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
}
</style>
