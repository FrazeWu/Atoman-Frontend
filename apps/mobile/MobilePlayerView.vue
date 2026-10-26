<template>
  <main
    class="mobile-player-view"
    :class="{ 'is-dragging': isDragging, 'is-dismissing': isDismissing }"
    :style="playerGestureStyle"
    @touchstart="handleTouchStart"
  >
    <template v-if="player.currentSong">
      <!-- Top Navigation Header -->
      <header class="mobile-player-view__header">
        <button
          type="button"
          class="mobile-player-view__header-action mobile-player-view__header-action--dismiss"
          aria-label="最小化播放器"
          title="最小化播放器"
          data-testid="player-dismiss-btn"
          @click="handleDismiss"
        >
          <MIcon name="chevron-down" size="md" />
        </button>
        <div class="mobile-player-view__header-title">
          <p class="mobile-player-view__eyebrow">{{ isPodcast ? '播客播放' : '音乐播放' }}</p>
          <h1>{{ showQueue ? '播放队列' : activeTab === 'lyrics' ? '歌词' : '正在播放' }}</h1>
        </div>
        <button
          type="button"
          class="mobile-player-view__header-action"
          :class="{ 'is-active': showQueue }"
          :aria-label="showQueue ? '返回播放器' : '打开播放队列'"
          :title="showQueue ? '返回播放器' : '打开播放队列'"
          @click="toggleQueue"
        >
          <MIcon v-if="showQueue" name="player-play" size="sm" />
          <MIcon v-else name="queue" size="sm" />
          <span v-if="!showQueue && player.queue.length">{{ player.queue.length }}</span>
        </button>
      </header>

      <!-- Middle Stage: Cover Art, Lyrics, or Queue -->
      <section class="mobile-player-view__stage" :aria-label="showQueue ? '播放队列' : activeTab === 'lyrics' ? '歌词展示' : '专辑封面'">
        <!-- 1. Cover Art View -->
        <div
          v-if="!showQueue && activeTab === 'cover'"
          class="mobile-player-view__cover-wrap"
          role="button"
          tabindex="0"
          aria-label="点击切换至歌词"
          title="点击切换至歌词"
          @click="toggleLyrics"
        >
          <img
            v-if="player.currentSong.cover_url"
            :src="player.currentSong.cover_url"
            :alt="`${player.currentSong.title} 封面`"
            class="mobile-player-view__cover"
          />
          <div v-else class="mobile-player-view__cover mobile-player-view__cover--fallback">
            <MIcon name="note" size="lg" />
          </div>
          <span class="mobile-player-view__cover-hint">点击查看歌词</span>
        </div>

        <!-- 2. Inline Lyrics View -->
        <div
          v-else-if="!showQueue && activeTab === 'lyrics'"
          ref="lyricsContainerRef"
          class="mobile-player-view__lyrics-wrap"
        >
          <div v-if="parsedLyrics.length" class="mobile-player-view__lyrics-list">
            <p
              v-for="(line, index) in parsedLyrics"
              :key="index"
              class="mobile-player-view__lyric-line"
              :class="{ 'is-active': index === activeLyricIndex }"
              @click="onLyricLineClick(line)"
            >
              {{ line.text }}
            </p>
          </div>
          <div v-else class="mobile-player-view__lyrics-empty">
            <MIcon name="file-text" size="md" />
            <p>暂无歌词</p>
            <button type="button" class="mobile-player-view__lyrics-back-btn" @click="activeTab = 'cover'">
              返回封面
            </button>
          </div>
        </div>

        <!-- 3. Queue View -->
        <div v-else class="mobile-player-view__queue-wrap">
          <div v-if="player.queue.length" class="mobile-player-view__queue-list">
            <article
              v-for="(queueSong, index) in player.queue"
              :key="player.playbackItemKey(queueSong)"
              class="mobile-player-view__queue-item"
              :class="{ 'is-current': player.currentSong && player.playbackItemKey(player.currentSong) === player.playbackItemKey(queueSong) }"
            >
              <button
                type="button"
                class="mobile-player-view__queue-main"
                :aria-label="`播放 ${queueSong.title}`"
                @click="player.playQueuedSong(queueSong)"
              >
                <img v-if="queueSong.cover_url" :src="queueSong.cover_url" alt="" />
                <span v-else class="mobile-player-view__queue-cover-fallback">{{ queueSong.title.charAt(0) }}</span>
                <span class="mobile-player-view__queue-copy">
                  <strong>{{ queueSong.title }}</strong>
                  <span>{{ queueSong.artist || '未知艺术家' }}</span>
                </span>
                <MIcon
                  v-if="player.currentSong && player.playbackItemKey(player.currentSong) === player.playbackItemKey(queueSong) && player.isPlaying"
                  name="player-pause"
                  size="xs"
                />
                <MIcon v-else name="player-play" size="xs" />
              </button>
              <div class="mobile-player-view__queue-actions">
                <button
                  type="button"
                  :disabled="index === 0"
                  :aria-label="`上移 ${queueSong.title}`"
                  title="上移"
                  @click="player.moveQueueItem(index, index - 1)"
                >
                  ↑
                </button>
                <button
                  type="button"
                  :disabled="index === player.queue.length - 1"
                  :aria-label="`下移 ${queueSong.title}`"
                  title="下移"
                  @click="player.moveQueueItem(index, index + 1)"
                >
                  ↓
                </button>
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
        </div>
      </section>

      <!-- Persistent Footer: Track Identity, Scrubber, Playback Controls, Actions -->
      <footer class="mobile-player-view__footer">
        <!-- Track Identity -->
        <div class="mobile-player-view__identity">
          <h2>{{ player.currentSong.title }}</h2>
          <p>{{ artistText }}</p>
        </div>

        <!-- Touch-Optimized Progress Scrubber -->
        <div class="mobile-player-scrubber" aria-label="播放进度调节">
          <div
            ref="scrubberTrackRef"
            class="mobile-player-scrubber__track-wrap"
            role="slider"
            tabindex="0"
            :aria-valuemin="0"
            :aria-valuemax="effectiveDuration"
            :aria-valuenow="displayCurrentTime"
            :aria-valuetext="`${formatTime(displayCurrentTime)} / ${formatTime(effectiveDuration)}`"
            @pointerdown="onScrubPointerDown"
            @keydown.left.prevent="player.skip(-5)"
            @keydown.right.prevent="player.skip(5)"
          >
            <div class="mobile-player-scrubber__track">
              <div
                class="mobile-player-scrubber__fill"
                :style="{ width: `${progressRatio}%` }"
              />
              <div
                class="mobile-player-scrubber__thumb"
                :class="{ 'is-active': isScrubbing }"
                :style="{ left: `${progressRatio}%` }"
              />
            </div>
          </div>
          <div class="mobile-player-scrubber__times">
            <span class="mobile-player-scrubber__time">{{ formatTime(displayCurrentTime) }}</span>
            <span class="mobile-player-scrubber__time">{{ formatTime(effectiveDuration) }}</span>
          </div>
        </div>

        <!-- Playback Error / Toast Notification -->
        <p v-if="player.playbackError" class="mobile-player-view__error" role="alert">
          <span>{{ player.playbackError }}</span>
          <button type="button" @click="player.retryPlayback">重试</button>
        </p>

        <Transition name="mobile-toast-fade">
          <div v-if="feedback" class="mobile-player-view__toast" role="status">
            {{ feedback }}
          </div>
        </Transition>

        <!-- Main Media Controls (Always Visible) -->
        <div class="mobile-player-view__controls" aria-label="播放控制">
          <button
            v-if="isPodcast"
            type="button"
            class="mobile-player-view__control mobile-player-view__control--secondary"
            aria-label="后退 15 秒"
            title="后退 15 秒"
            @click="player.skip(-15)"
          >
            <MIcon name="rotate-ccw" size="sm" />
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
            <MIcon name="rotate-ccw" size="sm" />
            <span>5</span>
          </button>

          <button
            type="button"
            class="mobile-player-view__control"
            aria-label="上一首"
            title="上一首"
            @click="player.playPrevious"
          >
            <MIcon name="player-prev" size="md" />
          </button>

          <button
            type="button"
            class="mobile-player-view__control mobile-player-view__control--primary"
            :aria-label="player.isPlaying ? '暂停' : '播放'"
            :title="player.isPlaying ? '暂停' : '播放'"
            @click="player.togglePlay"
          >
            <span v-if="player.isLoading" class="mobile-player-view__spinner" aria-hidden="true" />
            <MIcon v-else-if="player.isPlaying" name="player-pause" size="md" />
            <MIcon v-else name="player-play" size="md" />
          </button>

          <button
            type="button"
            class="mobile-player-view__control"
            aria-label="下一首"
            title="下一首"
            @click="player.playNext"
          >
            <MIcon name="player-next" size="md" />
          </button>

          <button
            v-if="isPodcast"
            type="button"
            class="mobile-player-view__control mobile-player-view__control--secondary"
            aria-label="前进 30 秒"
            title="前进 30 秒"
            @click="player.skip(30)"
          >
            <MIcon name="rotate-cw" size="sm" />
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
            <MIcon name="rotate-cw" size="sm" />
            <span>5</span>
          </button>
        </div>

        <!-- Bottom Action Bar (Always Visible) -->
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
            <MIcon name="heart" size="sm" />
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
            <MIcon name="heart" size="sm" />
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
            <MIcon name="clock" size="sm" />
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
            <MIcon v-if="player.playbackMode === 'random'" name="shuffle" size="sm" />
            <MIcon v-else name="repeat" size="sm" />
            <span>{{ modeLabel }}</span>
          </button>
          <button
            type="button"
            class="mobile-player-view__action"
            :class="{ 'is-active': activeTab === 'lyrics' && !showQueue }"
            :aria-label="isPodcast ? '节目说明' : '歌词'"
            :title="isPodcast ? '节目说明' : '歌词'"
            @click="toggleLyrics"
          >
            <MIcon name="file-text" size="sm" />
            <span>{{ isPodcast ? '说明' : '歌词' }}</span>
          </button>
          <button
            type="button"
            class="mobile-player-view__action"
            :class="{ 'is-active': showQueue }"
            aria-label="打开播放队列"
            title="播放队列"
            @click="toggleQueue"
          >
            <MIcon name="queue" size="sm" />
            <span>队列</span>
          </button>
        </div>
      </footer>
    </template>

    <!-- Empty State -->
    <section v-else class="mobile-player-view__empty">
      <MIcon name="music" size="lg" />
      <h1>还没有正在播放的内容</h1>
      <p>从音乐发现页选择一首歌曲开始播放。</p>
      <RouterLink to="/music" class="mobile-player-view__back-link">返回音乐</RouterLink>
    </section>
  </main>
</template>

<script lang="ts">
export default {
  name: 'MobilePlayerView',
}
</script>

<script setup lang="ts">
import { computed, nextTick, onActivated, onMounted, onUnmounted, ref, watch, type CSSProperties } from 'vue'
import { useRouter } from 'vue-router'
import MIcon from '@mobile/components/ui/MIcon.vue'
import { usePlayerStore } from '@/stores/player'
import { useAuthStore } from '@/stores/auth'
import { useLoginRedirect } from '@/composables/useLoginRedirect'
import { useMusicFavoritePlaylist } from '@/composables/useMusicFavoritePlaylist'
import { usePodcastPlayerActions } from '@/composables/usePodcastPlayerActions'
import { modulePathUrl } from '@/router/siteUrls'

const player = usePlayerStore()
const router = useRouter()
const authStore = useAuthStore()
const { requireLogin } = useLoginRedirect()
const { favoriteSongIds, loadFavoriteSongs, toggleFavoriteSong } = useMusicFavoritePlaylist()
const feedback = ref('')

const activeTab = ref<'cover' | 'lyrics'>('cover')
const lyricsContainerRef = ref<HTMLElement | null>(null)
const scrubberTrackRef = ref<HTMLElement | null>(null)

onMounted(() => {
  if (!player.currentSong) {
    player.restorePlaybackState()
  }
})

onActivated(() => {
  if (!player.currentSong) {
    player.restorePlaybackState()
  }
})

const artistText = computed(() => player.currentSong?.artist || '未知艺术家')
const isPodcast = computed(() => player.currentSong?.source_type === 'podcast_episode' || player.currentSong?.source_type === 'feed_podcast')
const isPodcastEpisode = computed(() => player.currentSong?.source_type === 'podcast_episode')
const isFavorite = computed(() => Boolean(player.currentSong && favoriteSongIds.value.has(String(player.currentSong.id))))

const showQueue = computed({
  get: () => player.showQueue,
  set: (value: boolean) => { player.showQueue = value },
})

const effectiveDuration = computed(() => {
  return player.duration || (player.currentSong as any)?.duration || (player.currentSong as any)?.duration_seconds || 0
})

const modeLabel = computed(() => {
  if (player.playbackMode === 'random') return '随机'
  if (player.playbackMode === 'single') return '单曲循环'
  return '顺序'
})

// --- Touch-Optimized Scrubber ---
const isScrubbing = ref(false)
const scrubTime = ref(0)

const displayCurrentTime = computed(() => (
  isScrubbing.value ? scrubTime.value : player.currentTime
))

const progressRatio = computed(() => {
  const d = effectiveDuration.value
  if (!d || d <= 0) return 0
  return Math.min(100, Math.max(0, (displayCurrentTime.value / d) * 100))
})

function formatTime(seconds: number): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const total = Math.floor(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

function calculateTimeFromPointer(event: PointerEvent): number {
  if (!scrubberTrackRef.value || effectiveDuration.value <= 0) return 0
  const rect = scrubberTrackRef.value.getBoundingClientRect()
  if (rect.width <= 0) return 0
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
  return ratio * effectiveDuration.value
}

function onScrubPointerDown(event: PointerEvent) {
  if (effectiveDuration.value <= 0) return
  isScrubbing.value = true
  scrubTime.value = calculateTimeFromPointer(event)

  const onPointerMove = (e: PointerEvent) => {
    if (!isScrubbing.value) return
    scrubTime.value = calculateTimeFromPointer(e)
  }

  const onPointerUp = (e: PointerEvent) => {
    if (!isScrubbing.value) return
    const finalTime = calculateTimeFromPointer(e)
    isScrubbing.value = false
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
    player.seek(finalTime)
  }

  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
}

// --- Lyrics Parsing & Sync ---
interface ParsedLyricLine {
  time: number
  text: string
}

const parsedLyrics = computed<ParsedLyricLine[]>(() => {
  const raw = player.currentSong?.lyrics
  if (!raw || typeof raw !== 'string') return []
  const lines = raw.split(/\r?\n/)
  const result: ParsedLyricLine[] = []
  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const match = trimmed.match(timeRegex)
    if (match) {
      const minutes = parseInt(match[1] || '0', 10)
      const seconds = parseInt(match[2] || '0', 10)
      const ms = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0
      const time = minutes * 60 + seconds + ms / 1000
      const text = trimmed.replace(timeRegex, '').trim()
      if (text) result.push({ time, text })
    } else {
      result.push({ time: -1, text: trimmed })
    }
  }
  return result
})

const activeLyricIndex = computed(() => {
  if (!parsedLyrics.value.length) return -1
  const t = player.currentTime
  let activeIndex = -1
  for (let i = 0; i < parsedLyrics.value.length; i++) {
    const line = parsedLyrics.value[i]
    if (line.time >= 0 && line.time <= t) {
      activeIndex = i
    }
  }
  return activeIndex
})

watch(activeLyricIndex, (newIdx) => {
  if (newIdx >= 0 && activeTab.value === 'lyrics' && !showQueue.value && lyricsContainerRef.value) {
    void nextTick(() => {
      const container = lyricsContainerRef.value
      const activeEl = container?.querySelector('.mobile-player-view__lyric-line.is-active') as HTMLElement | null
      if (container && activeEl) {
        const top = activeEl.offsetTop - container.clientHeight / 2 + activeEl.clientHeight / 2
        container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
      }
    })
  }
})

function onLyricLineClick(line: ParsedLyricLine) {
  if (line.time >= 0) {
    player.seek(line.time)
  }
}

function toggleLyrics() {
  if (suppressCoverClick) {
    suppressCoverClick = false
    return
  }
  if (isPodcast.value) {
    const song = player.currentSong
    if (!song) return
    if (song.source_type === 'podcast_episode') {
      void router.push(modulePathUrl('podcast', `/episode/${encodeURIComponent(String(song.source_id || song.id))}`))
      return
    }
    if (song.source_type === 'feed_podcast') {
      void router.push(modulePathUrl('feed', `/item/${encodeURIComponent(String(song.source_id || song.id))}`))
      return
    }
    return
  }
  if (showQueue.value) {
    showQueue.value = false
    activeTab.value = 'lyrics'
  } else {
    activeTab.value = activeTab.value === 'lyrics' ? 'cover' : 'lyrics'
  }
}

function toggleQueue() {
  showQueue.value = !showQueue.value
}

function handleDismiss() {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back()
  } else {
    void router.push('/music')
  }
}

// --- Pull-to-Dismiss and Stage Gestures ---
const isDragging = ref(false)
const isDismissing = ref(false)
const hasInteracted = ref(false)
const dragOffsetY = ref(0)
let startTouchX = 0
let startTouchY = 0
let currentTouchX = 0
let currentTouchY = 0
let startTouchTime = 0
let dismissTimer: ReturnType<typeof setTimeout> | null = null
let snapResetTimer: ReturnType<typeof setTimeout> | null = null
let suppressCoverClick = false
let isStageTouch = false

function isInteractiveElement(target: EventTarget | null): boolean {
  if (!target) return false
  const element = target instanceof Element ? target : (target as Node).parentElement
  if (!element) return false
  return Boolean(
    element.closest(
      'button, a, input, select, textarea, [data-interactive], .mobile-player-scrubber, .mobile-player-view__controls, .mobile-player-view__actions, .mobile-player-view__queue-item, .mobile-player-view__queue-actions, .mobile-player-view__clear-queue'
    )
  )
}

function handleTouchStart(e: TouchEvent) {
  if (isDismissing.value) return
  const touch = e.touches[0]
  if (!touch) return

  const target = (touch.target as EventTarget | null) || e.target
  if (isInteractiveElement(target)) return

  isStageTouch = Boolean(
    target instanceof Element && target.closest('.mobile-player-view__stage')
  )

  startTouchX = touch.clientX
  startTouchY = touch.clientY
  currentTouchX = touch.clientX
  currentTouchY = touch.clientY
  startTouchTime = Date.now()
  suppressCoverClick = false

  if (snapResetTimer) {
    clearTimeout(snapResetTimer)
    snapResetTimer = null
  }

  window.addEventListener('touchmove', handleTouchMove, { passive: false })
  window.addEventListener('touchend', handleTouchEnd)
  window.addEventListener('touchcancel', handleTouchEnd)
}

function handleTouchMove(e: TouchEvent) {
  const touch = e.touches[0]
  if (!touch) return

  currentTouchX = touch.clientX
  currentTouchY = touch.clientY

  const deltaX = currentTouchX - startTouchX
  const deltaY = currentTouchY - startTouchY
  const absX = Math.abs(deltaX)
  const absY = Math.abs(deltaY)

  // Downward pull detection
  if (deltaY > 8 && absY > absX) {
    if (e.cancelable) {
      e.preventDefault()
    }
    isDragging.value = true
    hasInteracted.value = true
    suppressCoverClick = true

    if (deltaY <= 120) {
      dragOffsetY.value = deltaY
    } else {
      dragOffsetY.value = 120 + (deltaY - 120) * 0.4
    }
  } else if (isStageTouch && absX > 15 && absX > absY) {
    suppressCoverClick = true
  }
}

function handleTouchEnd(e: TouchEvent) {
  window.removeEventListener('touchmove', handleTouchMove)
  window.removeEventListener('touchend', handleTouchEnd)
  window.removeEventListener('touchcancel', handleTouchEnd)

  const endTouch = e.changedTouches?.[0] || e.touches?.[0]
  if (endTouch) {
    currentTouchX = endTouch.clientX
    currentTouchY = endTouch.clientY
  }

  const deltaX = currentTouchX - startTouchX
  const deltaY = currentTouchY - startTouchY
  const absX = Math.abs(deltaX)
  const absY = Math.abs(deltaY)

  // Stage horizontal swipe to skip track
  if (isStageTouch && absX > 50 && absX > 1.2 * absY) {
    suppressCoverClick = true
    if (deltaX < -50) {
      player.playNext()
    } else if (deltaX > 50) {
      player.playPrevious()
    }
    isDragging.value = false
    dragOffsetY.value = 0
    return
  }

  if (!isDragging.value) {
    return
  }

  const elapsed = Math.max(1, Date.now() - startTouchTime)
  const velocity = deltaY / elapsed

  isDragging.value = false

  const isFlick = deltaY > 50 && elapsed >= 40 && elapsed < 400 && velocity > 0.5
  if (deltaY > 72 || isFlick) {
    isDismissing.value = true
    dragOffsetY.value = window.innerHeight || 800
    if (dismissTimer) clearTimeout(dismissTimer)
    dismissTimer = setTimeout(() => {
      isDismissing.value = false
      dragOffsetY.value = 0
      hasInteracted.value = false
      handleDismiss()
    }, 200)
  } else {
    dragOffsetY.value = 0
    snapResetTimer = setTimeout(() => {
      hasInteracted.value = false
      suppressCoverClick = false
    }, 240)
  }
}

const playerGestureStyle = computed<CSSProperties>(() => {
  if (isDismissing.value) {
    return {
      transform: 'translateY(100%)',
      transition: 'transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1)',
    }
  }
  if (isDragging.value) {
    return {
      transform: `translateY(${dragOffsetY.value}px)`,
      transition: 'none',
    }
  }
  if (hasInteracted.value) {
    return {
      transform: `translateY(${dragOffsetY.value}px)`,
      transition: 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
    }
  }
  return {}
})

// --- Toast Feedback ---
let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(message: string) {
  feedback.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    feedback.value = ''
    toastTimer = null
  }, 2200)
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
    showToast('收藏操作失败，请重试')
  }
}

onUnmounted(() => {
  player.showQueue = false
  window.removeEventListener('touchmove', handleTouchMove)
  window.removeEventListener('touchend', handleTouchEnd)
  window.removeEventListener('touchcancel', handleTouchEnd)
  if (dismissTimer) clearTimeout(dismissTimer)
  if (snapResetTimer) clearTimeout(snapResetTimer)
  if (toastTimer) {
    clearTimeout(toastTimer)
    toastTimer = null
  }
})
</script>

<style scoped>
.mobile-player-view {
  position: fixed;
  inset: 0;
  z-index: var(--a-z-modal, 800);
  width: 100%;
  height: 100dvh;
  box-sizing: border-box;
  max-width: 32rem;
  margin: 0 auto;
  padding: env(safe-area-inset-top, 0.75rem) 1.25rem calc(1rem + env(safe-area-inset-bottom, 24px));
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: var(--a-color-bg, #ffffff);
  overflow-y: auto;
  touch-action: pan-y;
  will-change: transform;
}

.mobile-player-view.is-dragging {
  user-select: none;
  -webkit-user-select: none;
}

.mobile-player-view__header {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.25rem;
}

.mobile-player-view__header-title {
  flex: 1;
  text-align: center;
}

.mobile-player-view__eyebrow {
  margin: 0 0 0.15rem;
  color: var(--a-color-muted);
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
}

.mobile-player-view h1 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
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
  border-radius: var(--a-radius-control, 4px);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
}

.mobile-player-view__header-action.is-active {
  border-color: var(--a-color-primary);
  color: var(--a-color-primary);
}

.mobile-player-view__header-action span {
  position: absolute;
  top: -0.35rem;
  right: -0.35rem;
  min-width: 1.1rem;
  padding: 0 0.2rem;
  border-radius: var(--a-radius-control, 4px);
  background: var(--a-color-primary);
  color: var(--a-color-primary-contrast);
  font-size: 0.65rem;
  line-height: 1.1rem;
  text-align: center;
}

/* --- Stage (Middle area) --- */
.mobile-player-view__stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 0;
  padding: 0.5rem 0;
}

.mobile-player-view__cover-wrap {
  width: min(60vw, 240px);
  aspect-ratio: 1;
  position: relative;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.mobile-player-view__cover {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card, 8px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.mobile-player-view__cover--fallback {
  display: grid;
  place-items: center;
  background: var(--a-color-surface-muted);
  color: var(--a-color-muted);
  border-radius: var(--a-radius-card, 8px);
  width: 100%;
  height: 100%;
}

.mobile-player-view__cover-hint {
  position: absolute;
  bottom: 0.5rem;
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
  background: rgba(0, 0, 0, 0.65);
  color: #ffffff;
  font-size: 0.68rem;
  opacity: 0.85;
}

/* --- Inline Lyrics Stage --- */
.mobile-player-view__lyrics-wrap {
  width: 100%;
  height: 32vh;
  min-height: 180px;
  overflow-y: auto;
  padding: 1rem 0.5rem;
  box-sizing: border-box;
  text-align: center;
  mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
}

.mobile-player-view__lyrics-list {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
  padding: 2rem 0;
}

.mobile-player-view__lyric-line {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.95rem;
  line-height: 1.5;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mobile-player-view__lyric-line.is-active {
  color: var(--a-color-fg);
  font-weight: 700;
  font-size: 1.15rem;
  transform: scale(1.05);
}

.mobile-player-view__lyrics-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 0.5rem;
  color: var(--a-color-muted);
}

.mobile-player-view__lyrics-back-btn {
  margin-top: 0.5rem;
  padding: 0.35rem 0.85rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 6px;
  background: var(--a-color-surface);
  color: var(--a-color-fg);
  font-size: 0.78rem;
  cursor: pointer;
}

/* --- Queue Stage --- */
.mobile-player-view__queue-wrap {
  width: 100%;
  max-height: 34vh;
  min-height: 180px;
  overflow-y: auto;
  border-radius: 8px;
  background: var(--a-color-surface-muted);
  border: 1px solid var(--a-color-border-soft);
  padding: 0.5rem;
  box-sizing: border-box;
}

.mobile-player-view__queue-list {
  display: grid;
  gap: 0.35rem;
}

.mobile-player-view__queue-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.4rem 0.5rem;
  border-radius: 6px;
  background: var(--a-color-surface);
}

.mobile-player-view__queue-item.is-current {
  border-left: 3px solid var(--a-color-primary);
  background: var(--a-color-surface-soft, rgba(0, 0, 0, 0.04));
}

.mobile-player-view__queue-main {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 0;
  background: transparent;
  color: var(--a-color-fg);
  text-align: left;
  cursor: pointer;
  min-width: 0;
  padding: 0;
}

.mobile-player-view__queue-main img {
  width: 36px;
  height: 36px;
  object-fit: cover;
  border-radius: 4px;
}

.mobile-player-view__queue-cover-fallback {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  background: var(--a-color-surface-muted);
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.8rem;
}

.mobile-player-view__queue-copy {
  flex: 1;
  min-width: 0;
}

.mobile-player-view__queue-copy strong {
  display: block;
  font-size: 0.85rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-player-view__queue-copy span {
  display: block;
  font-size: 0.72rem;
  color: var(--a-color-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-player-view__queue-actions {
  display: flex;
  gap: 0.25rem;
}

.mobile-player-view__queue-actions button {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
  background: var(--a-color-surface);
  color: var(--a-color-fg);
  font-size: 0.75rem;
}

.mobile-player-view__clear-queue {
  margin-top: 0.5rem;
  padding: 0.45rem;
  border: 1px dashed var(--a-color-border-soft);
  border-radius: 6px;
  background: transparent;
  color: var(--a-color-muted);
  font-size: 0.75rem;
  width: 100%;
}

.mobile-player-view__queue-empty {
  text-align: center;
  color: var(--a-color-muted);
  font-size: 0.85rem;
  margin: 2rem 0;
}

/* --- Footer Section --- */
.mobile-player-view__footer {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  min-width: 0;
}

.mobile-player-view__identity {
  min-width: 0;
  text-align: center;
}

.mobile-player-view__identity h2 {
  margin: 0 0 0.2rem;
  overflow: hidden;
  font-size: 1.25rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-player-view__identity p {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.85rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* --- Touch-Optimized Scrubber --- */
.mobile-player-scrubber {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.mobile-player-scrubber__track-wrap {
  position: relative;
  height: 36px;
  display: flex;
  align-items: center;
  cursor: pointer;
  touch-action: none;
  outline: none;
}

.mobile-player-scrubber__track-wrap:focus-visible .mobile-player-scrubber__thumb {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 2px;
}

.mobile-player-scrubber__track {
  position: relative;
  width: 100%;
  height: 4px;
  background: var(--a-color-border-soft, #e2e8f0);
  border-radius: 9999px;
}

.mobile-player-scrubber__fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: var(--a-color-primary, #0f172a);
  border-radius: 9999px;
  pointer-events: none;
}

.mobile-player-scrubber__thumb {
  position: absolute;
  top: 50%;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--a-color-primary, #0f172a);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
  transform: translate(-50%, -50%);
  pointer-events: none;
  transition: transform 0.1s ease;
}

.mobile-player-scrubber__thumb.is-active,
.mobile-player-scrubber__track-wrap:active .mobile-player-scrubber__thumb {
  transform: translate(-50%, -50%) scale(1.35);
}

.mobile-player-scrubber__times {
  display: flex;
  justify-content: space-between;
  margin-top: -6px;
  font-size: 0.72rem;
  color: var(--a-color-muted);
  font-variant-numeric: tabular-nums;
}

/* --- Controls --- */
.mobile-player-view__controls {
  display: grid;
  grid-template-columns: repeat(5, minmax(44px, 1fr));
  gap: 0.5rem;
  align-items: center;
}

.mobile-player-view__control {
  display: inline-flex;
  min-width: 44px;
  min-height: 50px;
  align-items: center;
  justify-content: center;
  gap: 0.1rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--a-color-fg);
  border-radius: var(--a-radius-control, 4px);
}

.mobile-player-view__control--secondary {
  position: relative;
  width: 48px;
  height: 48px;
  min-width: 48px;
  min-height: 48px;
  margin: 0 auto;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control, 4px);
  color: var(--a-color-muted);
  font-size: 0.65rem;
}

.mobile-player-view__control--secondary span {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 1;
  margin: 0;
  font-size: 0.65rem;
  font-weight: 600;
  line-height: 1;
  transform: translate(-50%, -50%);
}

.mobile-player-view__control--primary {
  width: 56px;
  height: 56px;
  min-width: 56px;
  min-height: 56px;
  margin: 0 auto;
  border-radius: 50%;
  background: var(--a-color-fg);
  color: var(--a-color-bg);
}

.mobile-player-view__spinner {
  width: 20px;
  height: 20px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: mobile-player-spin 0.9s linear infinite;
}

@keyframes mobile-player-spin {
  to { transform: rotate(360deg); }
}

/* --- Bottom Actions --- */
.mobile-player-view__actions {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  align-items: center;
  border-top: 1px solid var(--a-color-border-soft);
  padding-top: 0.5rem;
}

.mobile-player-view__action {
  display: grid;
  min-height: 48px;
  place-items: center;
  gap: 0.2rem;
  padding: 0.2rem;
  border: 0;
  background: transparent;
  color: var(--a-color-muted);
  font-size: 0.68rem;
}

.mobile-player-view__action.is-active {
  color: var(--a-color-primary);
}

/* --- Toast Feedback --- */
.mobile-player-view__toast {
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + 64px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  max-width: 90vw;
  padding: 0.45rem 1.125rem;
  background: rgba(15, 23, 42, 0.92);
  color: #ffffff;
  border-radius: 9999px;
  font-size: 0.8125rem;
  font-weight: 500;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.16);
  pointer-events: none;
  backdrop-filter: blur(8px);
  white-space: nowrap;
}

.mobile-toast-fade-enter-active,
.mobile-toast-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.mobile-toast-fade-enter-from,
.mobile-toast-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -8px);
}

.mobile-player-view__error {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin: 0;
  padding: 0.5rem 0.75rem;
  border-left: 3px solid var(--a-color-danger);
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
  font-size: 0.8rem;
}

.mobile-player-view__error button {
  min-height: 32px;
  padding: 0.25rem 0.65rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface);
  color: inherit;
  cursor: pointer;
}

/* --- Empty View --- */
.mobile-player-view__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60dvh;
  gap: 0.75rem;
  text-align: center;
}

.mobile-player-view__empty h1 {
  font-size: 1.25rem;
}

.mobile-player-view__empty p {
  color: var(--a-color-muted);
  font-size: 0.9rem;
  margin: 0;
}

.mobile-player-view__back-link {
  margin-top: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--a-color-primary);
  color: var(--a-color-primary-contrast);
  text-decoration: none;
  border-radius: 6px;
  font-size: 0.875rem;
}
</style>
