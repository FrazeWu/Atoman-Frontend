<template>
  <main class="mobile-player-view">
    <template v-if="player.currentSong">
      <header class="mobile-player-view__header">
        <div>
          <p class="mobile-player-view__eyebrow">{{ isPodcast ? '播客播放' : '音乐播放' }}</p>
          <h1>{{ showQueue ? '播放队列' : '正在播放' }}</h1>
        </div>
        <button
          type="button"
          class="mobile-player-view__header-action"
          :aria-label="showQueue ? '返回播放器' : '打开播放队列'"
          :title="showQueue ? '返回播放器' : '打开播放队列'"
          @click="showQueue = !showQueue"
        >
          <Play v-if="showQueue" :size="20" aria-hidden="true" />
          <ListMusic v-else :size="20" aria-hidden="true" />
          <span v-if="!showQueue && player.queue.length">{{ player.queue.length }}</span>
        </button>
      </header>

      <section v-if="!showQueue" class="mobile-player-view__content" aria-label="播放器">
        <div class="mobile-player-view__cover-wrap">
          <img
            v-if="player.currentSong.cover_url"
            :src="player.currentSong.cover_url"
            :alt="`${player.currentSong.title} 封面`"
            class="mobile-player-view__cover"
          />
          <div v-else class="mobile-player-view__cover mobile-player-view__cover--fallback">
            {{ coverFallback }}
          </div>
        </div>

        <div class="mobile-player-view__identity">
          <h2>{{ player.currentSong.title }}</h2>
          <p>{{ artistText }}</p>
        </div>

        <AudioWaveformProgress
          :song-id="String(player.currentSong.id)"
          :audio-url="player.currentSong.audio_url"
          :waveform-peaks="player.currentSong.waveform_peaks"
          :current-time="player.currentTime"
          :duration="player.duration"
          :generate-waveform="!isPodcast"
          @seek="player.seek"
        />

        <p v-if="player.playbackError" class="mobile-player-view__error" role="alert">
          <span>{{ player.playbackError }}</span>
          <button type="button" @click="player.retryPlayback">重试</button>
        </p>
        <p v-else-if="feedback" class="mobile-player-view__feedback" role="status">{{ feedback }}</p>

        <div class="mobile-player-view__controls" aria-label="播放控制">
          <button
            v-if="isPodcast"
            type="button"
            class="mobile-player-view__control mobile-player-view__control--secondary"
            aria-label="后退 15 秒"
            title="后退 15 秒"
            @click="player.skip(-15)"
          >
            <RotateCcw :size="22" aria-hidden="true" />
            <span>15</span>
          </button>
          <button
            v-else
            type="button"
            class="mobile-player-view__control mobile-player-view__control--secondary"
            aria-label="后退 5 秒"
            title="后退 5 秒"
            @click="player.skip(-5)"
          >
            <RotateCcw :size="22" aria-hidden="true" />
            <span>5</span>
          </button>

          <button
            type="button"
            class="mobile-player-view__control"
            aria-label="上一首"
            title="上一首"
            @click="player.playPrevious"
          >
            <SkipBack :size="24" fill="currentColor" aria-hidden="true" />
          </button>

          <button
            type="button"
            class="mobile-player-view__control mobile-player-view__control--primary"
            :aria-label="player.isPlaying ? '暂停' : '播放'"
            :title="player.isPlaying ? '暂停' : '播放'"
            @click="player.togglePlay"
          >
            <LoaderCircle v-if="player.isLoading" :size="30" class="mobile-player-view__spinner" aria-hidden="true" />
            <Pause v-else-if="player.isPlaying" :size="30" fill="currentColor" aria-hidden="true" />
            <Play v-else :size="30" fill="currentColor" aria-hidden="true" />
          </button>

          <button
            type="button"
            class="mobile-player-view__control"
            aria-label="下一首"
            title="下一首"
            @click="player.playNext"
          >
            <SkipForward :size="24" fill="currentColor" aria-hidden="true" />
          </button>

          <button
            v-if="isPodcast"
            type="button"
            class="mobile-player-view__control mobile-player-view__control--secondary"
            aria-label="前进 30 秒"
            title="前进 30 秒"
            @click="player.skip(30)"
          >
            <RotateCw :size="22" aria-hidden="true" />
            <span>30</span>
          </button>
          <button
            v-else
            type="button"
            class="mobile-player-view__control mobile-player-view__control--secondary"
            aria-label="前进 5 秒"
            title="前进 5 秒"
            @click="player.skip(5)"
          >
            <RotateCw :size="22" aria-hidden="true" />
            <span>5</span>
          </button>
        </div>

        <div class="mobile-player-view__actions" aria-label="更多播放操作">
          <button
            v-if="!isPodcast"
            type="button"
            class="mobile-player-view__action"
            :class="{ 'is-active': isFavorite }"
            :aria-label="isFavorite ? '移出最爱' : '加入最爱'"
            :title="isFavorite ? '移出最爱' : '加入最爱'"
            @click="toggleFavorite"
          >
            <Heart :size="20" :fill="isFavorite ? 'currentColor' : 'none'" aria-hidden="true" />
            <span>收藏</span>
          </button>
          <button
            v-if="isPodcastEpisode"
            type="button"
            class="mobile-player-view__action"
            aria-label="收藏单集"
            title="收藏单集"
            @click="addPodcastBookmark(player.currentSong.source_id)"
          >
            <Heart :size="20" aria-hidden="true" />
            <span>收藏</span>
          </button>
          <button
            v-if="isPodcastEpisode"
            type="button"
            class="mobile-player-view__action"
            aria-label="稍后听"
            title="稍后听"
            @click="addPodcastListenLater(player.currentSong.source_id)"
          >
            <Clock3 :size="20" aria-hidden="true" />
            <span>稍后听</span>
          </button>
          <button
            v-if="!isPodcast"
            type="button"
            class="mobile-player-view__action"
            :aria-label="modeLabel"
            :title="modeLabel"
            @click="player.cyclePlaybackMode"
          >
            <Shuffle v-if="player.playbackMode === 'random'" :size="20" aria-hidden="true" />
            <Repeat v-else :size="20" aria-hidden="true" />
            <span>{{ modeLabel }}</span>
          </button>
          <button
            type="button"
            class="mobile-player-view__action"
            :aria-label="isPodcast ? '打开节目说明' : '打开歌词'"
            :title="isPodcast ? '打开节目说明' : '打开歌词'"
            @click="openLyrics"
          >
            <FileText :size="20" aria-hidden="true" />
            <span>{{ isPodcast ? '说明' : '歌词' }}</span>
          </button>
          <button
            type="button"
            class="mobile-player-view__action"
            aria-label="打开播放队列"
            title="播放队列"
            @click="showQueue = true"
          >
            <ListMusic :size="20" aria-hidden="true" />
            <span>队列</span>
          </button>
        </div>
      </section>

      <section v-else class="mobile-player-view__queue" aria-label="播放队列">
        <div v-if="player.queue.length" class="mobile-player-view__queue-list">
          <article
            v-for="(queueSong, index) in player.queue"
            :key="player.playbackItemKey(queueSong)"
            class="mobile-player-view__queue-item"
            :class="{ 'is-current': player.currentSong && player.playbackItemKey(player.currentSong) === player.playbackItemKey(queueSong) }"
          >
            <button type="button" class="mobile-player-view__queue-main" @click="player.playQueuedSong(queueSong)">
              <img v-if="queueSong.cover_url" :src="queueSong.cover_url" alt="" />
              <span v-else class="mobile-player-view__queue-cover-fallback">{{ queueSong.title.charAt(0) }}</span>
              <span class="mobile-player-view__queue-copy">
                <strong>{{ queueSong.title }}</strong>
                <span>{{ queueSong.artist || '未知艺术家' }}</span>
              </span>
              <Pause v-if="player.currentSong && player.playbackItemKey(player.currentSong) === player.playbackItemKey(queueSong) && player.isPlaying" :size="18" fill="currentColor" aria-label="正在播放" />
              <Play v-else :size="18" fill="currentColor" aria-label="播放" />
            </button>
            <div class="mobile-player-view__queue-actions">
              <button type="button" :disabled="index === 0" :aria-label="`上移 ${queueSong.title}`" title="上移" @click="player.moveQueueItem(index, index - 1)">↑</button>
              <button type="button" :disabled="index === player.queue.length - 1" :aria-label="`下移 ${queueSong.title}`" title="下移" @click="player.moveQueueItem(index, index + 1)">↓</button>
              <button
                v-if="!player.currentSong || player.playbackItemKey(player.currentSong) !== player.playbackItemKey(queueSong)"
                type="button"
                :aria-label="`移除 ${queueSong.title}`"
                title="移除"
                @click="player.removeFromQueue(queueSong)"
              >
                ×
              </button>
            </div>
          </article>
          <button type="button" class="mobile-player-view__clear-queue" @click="player.clearQueue">清空后续歌曲</button>
        </div>
        <p v-else class="mobile-player-view__queue-empty">播放队列为空</p>
      </section>
    </template>

    <section v-else class="mobile-player-view__empty">
      <Music2 :size="32" aria-hidden="true" />
      <h1>还没有正在播放的内容</h1>
      <p>从音乐发现页选择一首歌曲开始播放。</p>
      <RouterLink to="/music" class="mobile-player-view__back-link">返回音乐</RouterLink>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { IconClock as Clock3, IconFileText as FileText, IconHeart as Heart, IconPlaylist as ListMusic, IconLoader as LoaderCircle, IconMusic as Music2, IconPlayerPause as Pause, IconPlayerPlay as Play, IconRepeat as Repeat, IconRotate2 as RotateCcw, IconRotateClockwise as RotateCw, IconArrowsShuffle as Shuffle, IconPlayerSkipBack as SkipBack, IconPlayerSkipForward as SkipForward } from '@tabler/icons-vue'
import { usePlayerStore } from '@/stores/player'
import { useAuthStore } from '@/stores/auth'
import { useLoginRedirect } from '@/composables/useLoginRedirect'
import { useMusicFavoritePlaylist } from '@/composables/useMusicFavoritePlaylist'
import { usePodcastPlayerActions } from '@/composables/usePodcastPlayerActions'
import AudioWaveformProgress from '@/components/music/AudioWaveformProgress.vue'

const player = usePlayerStore()
const router = useRouter()
const authStore = useAuthStore()
const { requireLogin } = useLoginRedirect()
const { favoriteSongIds, loadFavoriteSongs, toggleFavoriteSong } = useMusicFavoritePlaylist()
const feedback = ref('')

const artistText = computed(() => player.currentSong?.artist || '未知艺术家')
const isPodcast = computed(() => player.currentSong?.source_type === 'podcast_episode' || player.currentSong?.source_type === 'feed_podcast')
const isPodcastEpisode = computed(() => player.currentSong?.source_type === 'podcast_episode')
const isFavorite = computed(() => Boolean(player.currentSong && favoriteSongIds.value.has(String(player.currentSong.id))))
const showQueue = computed({
  get: () => player.showQueue,
  set: (value: boolean) => { player.showQueue = value },
})
const coverFallback = computed(() => {
  const text = player.currentSong?.album || player.currentSong?.artist || player.currentSong?.title || 'P'
  return text.trim().charAt(0) || 'P'
})
const modeLabel = computed(() => {
  if (player.playbackMode === 'random') return '随机'
  if (player.playbackMode === 'single') return '单曲循环'
  return '顺序'
})

function showToast(message: string) {
  feedback.value = message
}

function openLyrics() {
  if (player.currentSong) void router.push('/music/lyrics')
}

const { addPodcastBookmark, addPodcastListenLater } = usePodcastPlayerActions(showToast)

watch(
  [() => player.currentSong?.id, () => authStore.isAuthenticated],
  async ([songId, isAuthenticated]) => {
    if (!songId || !isAuthenticated || isPodcast.value) {
      favoriteSongIds.value = new Set()
      return
    }
    try {
      await loadFavoriteSongs([String(songId)])
    } catch {
      favoriteSongIds.value = new Set()
    }
  },
  { immediate: true },
)

async function toggleFavorite() {
  if (!player.currentSong || !requireLogin()) return
  try {
    const result = await toggleFavoriteSong(String(player.currentSong.id))
    showToast(result.message)
  } catch {
    feedback.value = '收藏操作失败，请重试'
  }
}

onUnmounted(() => {
  player.showQueue = false
})
</script>

<style scoped>
.mobile-player-view {
  min-height: calc(100dvh - var(--a-topbar-height) - var(--a-mobile-nav-reserved-height));
  max-width: 34rem;
  margin: 0 auto;
  padding: 1.25rem 1rem 2rem;
}

.mobile-player-view__header {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.mobile-player-view__eyebrow {
  margin: 0 0 0.25rem;
  color: var(--a-color-muted);
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
}

.mobile-player-view h1,
.mobile-player-view h2,
.mobile-player-view p {
  margin-top: 0;
}

.mobile-player-view h1 {
  margin-bottom: 0;
  font-size: 1.25rem;
  font-weight: 650;
}

.mobile-player-view__header-action,
.mobile-player-view__control,
.mobile-player-view__action,
.mobile-player-view__queue-actions button,
.mobile-player-view__clear-queue {
  cursor: pointer;
}

.mobile-player-view__header-action {
  position: relative;
  display: inline-flex;
  width: 44px;
  height: 44px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
}

.mobile-player-view__header-action span {
  position: absolute;
  top: -0.35rem;
  right: -0.35rem;
  min-width: 1.1rem;
  padding: 0 0.2rem;
  border-radius: 999px;
  background: var(--a-color-primary);
  color: var(--a-color-primary-contrast);
  font-size: 0.65rem;
  line-height: 1.1rem;
  text-align: center;
}

.mobile-player-view__content {
  display: grid;
  gap: 1.25rem;
}

.mobile-player-view__cover-wrap {
  width: min(78vw, 320px);
  aspect-ratio: 1;
  margin: 0 auto;
}

.mobile-player-view__cover {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border: 1px solid var(--a-color-border-soft);
}

.mobile-player-view__cover--fallback {
  display: grid;
  place-items: center;
  background: var(--a-color-surface-muted);
  color: var(--a-color-muted);
  font-size: 4rem;
  font-weight: 650;
}

.mobile-player-view__identity {
  min-width: 0;
  text-align: center;
}

.mobile-player-view__identity h2 {
  margin-bottom: 0.35rem;
  overflow: hidden;
  font-size: 1.35rem;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-player-view__identity p {
  margin-bottom: 0;
  color: var(--a-color-muted);
  font-size: 0.9rem;
}

.mobile-player-view__controls {
  display: grid;
  grid-template-columns: repeat(5, minmax(44px, 1fr));
  gap: 0.5rem;
  align-items: center;
}

.mobile-player-view__control {
  display: inline-flex;
  min-width: 44px;
  min-height: 52px;
  align-items: center;
  justify-content: center;
  gap: 0.1rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--a-color-fg);
}

.mobile-player-view__control--secondary {
  position: relative;
  width: 52px;
  height: 52px;
  min-width: 52px;
  min-height: 52px;
  margin: 0 auto;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 50%;
  color: var(--a-color-muted);
  font-size: 0.7rem;
}

.mobile-player-view__control--secondary svg {
  position: absolute;
  inset: 0;
  margin: auto;
}

.mobile-player-view__control--secondary span {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 1;
  margin: 0;
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1;
  transform: translate(-50%, -50%);
}

.mobile-player-view__control--primary {
  width: 60px;
  height: 60px;
  min-width: 60px;
  min-height: 60px;
  margin: 0 auto;
  border-radius: 50%;
  background: var(--a-color-fg);
  color: var(--a-color-bg);
}

.mobile-player-view__control:disabled {
  cursor: default;
  opacity: 0.45;
}

.mobile-player-view__control:focus-visible,
.mobile-player-view__action:focus-visible,
.mobile-player-view__header-action:focus-visible,
.mobile-player-view__queue-actions button:focus-visible,
.mobile-player-view__clear-queue:focus-visible,
.mobile-player-view__queue-main:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 2px;
}

.mobile-player-view__spinner {
  animation: mobile-player-spin 0.9s linear infinite;
}

.mobile-player-view__actions {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.25rem;
  border-top: 1px solid var(--a-color-border-soft);
  padding-top: 0.75rem;
}

.mobile-player-view__action {
  display: grid;
  min-height: 52px;
  place-items: center;
  gap: 0.25rem;
  padding: 0.25rem;
  border: 0;
  background: transparent;
  color: var(--a-color-muted);
  font-size: 0.68rem;
}

.mobile-player-view__action.is-active {
  color: var(--a-color-primary);
}

.mobile-player-view__error,
.mobile-player-view__feedback {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0;
  padding: 0.65rem 0.75rem;
  border-left: 3px solid var(--a-color-danger);
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
  font-size: 0.8rem;
}

.mobile-player-view__feedback {
  border-left-color: var(--a-color-primary);
}

.mobile-player-view__error button {
  min-height: 36px;
  padding: 0.35rem 0.65rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: inherit;
  cursor: pointer;
}

.mobile-player-view__queue {
  min-height: 60dvh;
}

.mobile-player-view__queue-list {
  display: grid;
  gap: 0.5rem;
}

.mobile-player-view__queue-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.5rem;
  align-items: center;
  border-bottom: 1px solid var(--a-color-border-soft);
  padding: 0.5rem 0;
}

.mobile-player-view__queue-item.is-current {
  color: var(--a-color-primary);
}

.mobile-player-view__queue-main {
  display: flex;
  min-width: 0;
  min-height: 52px;
  align-items: center;
  gap: 0.65rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.mobile-player-view__queue-main img,
.mobile-player-view__queue-cover-fallback {
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  object-fit: cover;
  border: 1px solid var(--a-color-border-soft);
}

.mobile-player-view__queue-cover-fallback {
  display: grid;
  place-items: center;
  background: var(--a-color-surface-muted);
  color: var(--a-color-muted);
}

.mobile-player-view__queue-copy {
  display: grid;
  min-width: 0;
  gap: 0.2rem;
}

.mobile-player-view__queue-copy strong,
.mobile-player-view__queue-copy span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-player-view__queue-copy strong {
  color: var(--a-color-fg);
  font-size: 0.88rem;
  font-weight: 600;
}

.mobile-player-view__queue-copy span {
  color: var(--a-color-muted);
  font-size: 0.75rem;
}

.mobile-player-view__queue-actions {
  display: flex;
  gap: 0.1rem;
}

.mobile-player-view__queue-actions button {
  display: inline-grid;
  width: 44px;
  height: 44px;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 1.1rem;
}

.mobile-player-view__queue-actions button:disabled {
  cursor: default;
  opacity: 0.3;
}

.mobile-player-view__clear-queue {
  min-height: 44px;
  margin-top: 1rem;
  padding: 0 0.75rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-muted);
}

.mobile-player-view__queue-empty,
.mobile-player-view__empty {
  color: var(--a-color-muted);
  text-align: center;
}

.mobile-player-view__queue-empty {
  padding-top: 3rem;
}

.mobile-player-view__empty {
  display: grid;
  min-height: 60dvh;
  place-items: center;
  align-content: center;
  gap: 0.75rem;
}

.mobile-player-view__empty h1,
.mobile-player-view__empty p {
  margin-bottom: 0;
}

.mobile-player-view__empty h1 {
  color: var(--a-color-fg);
  font-size: 1.2rem;
}

.mobile-player-view__back-link {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  padding: 0 1rem;
  border: 1px solid var(--a-color-border-soft);
  color: var(--a-color-fg);
  text-decoration: none;
}

@keyframes mobile-player-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .mobile-player-view__spinner { animation: none; }
}
</style>
