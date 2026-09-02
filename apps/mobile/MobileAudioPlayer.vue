<template>
  <section class="mobile-mini-player" aria-label="正在播放">
    <button type="button" class="mobile-mini-player__track" @click="openPlayer">
      <img
        v-if="player.currentSong?.cover_url"
        :src="player.currentSong.cover_url"
        alt=""
        class="mobile-mini-player__cover"
      />
      <span v-else class="mobile-mini-player__cover mobile-mini-player__cover--fallback">
        {{ coverFallback }}
      </span>
      <span class="mobile-mini-player__meta">
        <strong>{{ player.currentSong?.title }}</strong>
        <span>{{ artistText }}</span>
      </span>
    </button>

    <button
      type="button"
      class="mobile-mini-player__action mobile-mini-player__action--primary"
      :aria-label="player.isPlaying ? '暂停' : '播放'"
      :title="player.isPlaying ? '暂停' : '播放'"
      @click="player.togglePlay()"
    >
      <LoaderCircle v-if="player.isLoading" :size="22" class="mobile-mini-player__spinner" aria-hidden="true" />
      <Pause v-else-if="player.isPlaying" :size="22" fill="currentColor" aria-hidden="true" />
      <Play v-else :size="22" fill="currentColor" aria-hidden="true" />
    </button>

    <button
      type="button"
      class="mobile-mini-player__action"
      aria-label="打开播放队列"
      title="播放队列"
      @click="openPlayer"
    >
      <ListMusic :size="22" aria-hidden="true" />
      <span v-if="player.queue.length" class="mobile-mini-player__badge">{{ player.queue.length }}</span>
    </button>

    <div class="mobile-mini-player__progress" aria-hidden="true">
      <span :style="{ width: `${progressRatio}%` }" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { IconPlaylist as ListMusic, IconLoader as LoaderCircle, IconPlayerPause as Pause, IconPlayerPlay as Play } from '@tabler/icons-vue'
import { usePlayerStore } from '@/stores/player'

const player = usePlayerStore()
const router = useRouter()
const route = useRoute()

const artistText = computed(() => {
  const song = player.currentSong
  if (!song) return '未知艺术家'
  return song.artist || '未知艺术家'
})

const coverFallback = computed(() => {
  const text = player.currentSong?.album || player.currentSong?.artist || player.currentSong?.title || 'P'
  return text.trim().charAt(0) || 'P'
})

const progressRatio = computed(() => {
  if (!player.duration) return 0
  return Math.min(100, Math.max(0, player.currentTime / player.duration * 100))
})

function openPlayer() {
  if (route.path !== '/music/player') void router.push('/music/player')
}
</script>

<style scoped>
.mobile-mini-player {
  position: fixed;
  right: 0;
  bottom: calc(64px + env(safe-area-inset-bottom, 0px));
  left: 0;
  z-index: var(--a-z-player);
  display: grid;
  grid-template-columns: minmax(0, 1fr) 44px 44px;
  gap: 0.25rem;
  align-items: center;
  min-height: var(--mobile-app-player-height, 76px);
  padding: 0.5rem 0.75rem 0.75rem;
  border-top: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface);
  box-shadow: none;
}

.mobile-mini-player__track {
  display: flex;
  min-width: 0;
  min-height: 56px;
  align-items: center;
  gap: 0.75rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--a-color-fg);
  text-align: left;
  cursor: pointer;
}

.mobile-mini-player__cover {
  width: 48px;
  height: 48px;
  flex: 0 0 48px;
  object-fit: cover;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
}

.mobile-mini-player__cover--fallback {
  display: grid;
  place-items: center;
  background: var(--a-color-surface-muted);
  color: var(--a-color-muted);
  font-size: 1.25rem;
  font-weight: 650;
}

.mobile-mini-player__meta {
  display: grid;
  min-width: 0;
  gap: 0.2rem;
}

.mobile-mini-player__meta strong,
.mobile-mini-player__meta span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-mini-player__meta strong {
  font-size: 0.9rem;
  font-weight: 650;
}

.mobile-mini-player__meta span {
  color: var(--a-color-muted);
  font-size: 0.75rem;
}

.mobile-mini-player__action {
  position: relative;
  display: inline-grid;
  width: 44px;
  height: 44px;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--a-color-fg);
  cursor: pointer;
}

.mobile-mini-player__action--primary {
  border-radius: 50%;
  background: var(--a-color-fg);
  color: var(--a-color-bg);
}

.mobile-mini-player__action:focus-visible,
.mobile-mini-player__track:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 2px;
}

.mobile-mini-player__badge {
  position: absolute;
  top: 2px;
  right: 0;
  min-width: 16px;
  padding: 0 3px;
  border-radius: 999px;
  background: var(--a-color-primary);
  color: var(--a-color-primary-contrast);
  font-size: 0.65rem;
  line-height: 16px;
  text-align: center;
}

.mobile-mini-player__progress {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 2px;
  background: var(--a-color-border-soft);
}

.mobile-mini-player__progress span {
  display: block;
  height: 100%;
  background: var(--a-color-primary);
  transition: width 120ms linear;
}

.mobile-mini-player__spinner {
  animation: mobile-player-spin 0.9s linear infinite;
}

@keyframes mobile-player-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .mobile-mini-player__spinner { animation: none; }
  .mobile-mini-player__progress span { transition: none; }
}
</style>
