<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { InteractionComment, Video } from '@/types'
import { parseVideoTimeParam } from '@/composables/useVideoDeepLink'
import { clearVideoProgress, getVideoProgress, saveVideoProgress } from '@/composables/useVideoProgress'
import { extractTimestampFromComment, serializeTimestampComment } from '@/composables/useVideoTimestamp'
import PVideoPlayerShell from '@/components/shared/PVideoPlayerShell.vue'
import InteractionBar from '@/components/shared/InteractionBar.vue'
import CommentThread from '@/components/shared/CommentThread.vue'
import VideoPlayerControls from '@/components/video/VideoPlayerControls.vue'
import VideoContinueList from '@/components/video/VideoContinueList.vue'
import { useApi } from '@/composables/useApi'
import { useInteractions } from '@/composables/useInteractions'
import { useAuthStore } from '@/stores/auth'
import { isModeratorRole } from '@/utils/roles'
import { createContentConsumptionTracker, useContentLifecycle } from '@/composables/useContentLifecycle'

type VideoDetailResponse = Video & {
  liked?: boolean
  is_liked?: boolean
  viewer_liked?: boolean
  like_count?: number
  likes_count?: number
  LikeCount?: number
  comment_count?: number
  comments_count?: number
  CommentCount?: number
}

const api = useApi()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const lifecycle = useContentLifecycle()
const videoId = computed(() => String(route.params.id || ''))
const interactions = useInteractions('videos', 'video', videoId)

const video = ref<Video | null>(null)
const recommended = ref<Video[]>([])
const loading = ref(true)
const error = ref('')
const theaterMode = ref(getStoredTheaterMode())
const showNextPrompt = ref(false)
let lastProgressSave = 0
let loadSeq = 0
let consumptionTracker: ReturnType<typeof createContentConsumptionTracker> | null = null

function getFirstStringQueryValue(value: unknown): string | undefined {
  const firstValue = Array.isArray(value) ? value[0] : value
  return typeof firstValue === 'string' ? firstValue : undefined
}

function getStoredTheaterMode() {
  try {
    return localStorage.getItem('atoman:video-theater-mode') === 'on'
  } catch {
    return false
  }
}

function saveStoredTheaterMode(value: boolean) {
  try {
    localStorage.setItem('atoman:video-theater-mode', value ? 'on' : 'off')
  } catch {
    // Storage may be disabled by the browser.
  }
}

// Detect embed type from URL
const embedSrc = computed(() => {
  const url = video.value?.video_url || ''
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`
  const biliMatch = url.match(/bilibili\.com\/video\/(BV[A-Za-z0-9]+)/)
  if (biliMatch) return `https://player.bilibili.com/player.html?bvid=${biliMatch[1]}&autoplay=0`
  return null
})

function fmtDuration(sec: number): string {
  if (!sec) return ''
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString('zh-CN')
}

const canComment = computed(() => authStore.isAuthenticated)
const commentNotice = computed(() => authStore.isAuthenticated ? '' : '登录后即可评论')

const canDeleteComment = (comment: InteractionComment) => {
  if (!authStore.user) return false
  const authIDs = new Set([
    authStore.user.uuid,
    authStore.user.id === undefined ? undefined : String(authStore.user.id),
  ].filter((id): id is string => Boolean(id)))
  const commentIDs = [
    comment.user_id ?? undefined,
    comment.user?.uuid,
    comment.user?.id === undefined ? undefined : String(comment.user.id),
  ].filter((id): id is string => Boolean(id))
  return (
    commentIDs.some((id) => authIDs.has(id)) ||
    authStore.user.uuid === video.value?.user_id ||
    isModeratorRole(authStore.user.role)
  )
}

async function submitComment(payload: { content: string; parentCommentId?: string }) {
  const timestamp = serializeTimestampComment(extractTimestampFromComment(payload.content))
  await interactions.createComment(
    payload.content,
    payload.parentCommentId,
    timestamp.timestamp_sec === null ? undefined : timestamp,
  )
}

function syncInteractionState(detail: VideoDetailResponse) {
  interactions.liked.value = detail.liked ?? detail.is_liked ?? detail.viewer_liked ?? false
  interactions.likeCount.value = detail.like_count ?? detail.likes_count ?? detail.LikeCount ?? 0
  interactions.commentCount.value = detail.comment_count ?? detail.comments_count ?? detail.CommentCount ?? 0
}

async function load(id: string) {
  const seq = ++loadSeq
  loading.value = true
  error.value = ''
  video.value = null
  recommended.value = []
  showNextPrompt.value = false
  currentPlaybackTime.value = 0
  lastProgressSave = 0
  consumptionTracker = null
  try {
    const [vRes, rRes] = await Promise.all([
      fetch(`${api.url}/videos/${id}`),
      fetch(`${api.url}/videos/${id}/recommended`),
    ])
    if (seq !== loadSeq) return
    if (!vRes.ok) { error.value = '视频不存在'; return }
    const detail = await vRes.json() as VideoDetailResponse
    if (seq !== loadSeq) return
    video.value = detail
    consumptionTracker = createContentConsumptionTracker({
      onEvent: (event) => {
        void lifecycle.recordEvent({ module: 'video', content_id: detail.id, event, source: getFirstStringQueryValue(route.query.source) || 'direct' }).catch(() => undefined)
      },
      onProgress: (progress) => {
        if (!authStore.token) return
        const duration = Math.floor(videoElement.value?.duration || detail.duration_sec || 0)
        void lifecycle.saveProgress({
          module: 'video', content_id: detail.id, position_sec: Math.floor(videoElement.value?.currentTime || 0),
          duration_sec: duration, progress, completed: progress >= 0.95, source: getFirstStringQueryValue(route.query.source) || 'direct',
        }).catch(() => undefined)
      },
      progressIntervalMs: 5_000,
    })
    consumptionTracker.open()
    syncInteractionState(detail)
    if (rRes.ok) {
      const data = await rRes.json()
      if (seq === loadSeq) recommended.value = data
    }
    if (seq === loadSeq) await interactions.fetchComments()
    // Fire-and-forget view count increment
    if (seq === loadSeq) fetch(`${api.url}/videos/${id}/view`, { method: 'POST' })
  } catch {
    if (seq === loadSeq) error.value = '加载失败，请重试'
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

onMounted(() => load(videoId.value))
watch(() => route.params.id, (id) => { if (id) load(id as string) })

const videoElement = ref<HTMLVideoElement | null>(null)
const currentPlaybackTime = ref(0)
const timestampHint = ref('')

function syncCurrentPlaybackTime() {
  const current = Math.floor(videoElement.value?.currentTime || 0)
  const duration = videoElement.value?.duration
  currentPlaybackTime.value = current
  if (!video.value || typeof duration !== 'number' || !Number.isFinite(duration)) return
  if (Date.now() - lastProgressSave < 5000) return
  lastProgressSave = Date.now()
  saveVideoProgress(video.value.id, current, Math.floor(duration))
  consumptionTracker?.update(duration > 0 ? current / duration : 0)
}

function seekLocalVideo(value: number) {
  if (video.value?.storage_type !== 'local' || !videoElement.value) return false
  videoElement.value.currentTime = value
  currentPlaybackTime.value = value
  return true
}

async function restoreInitialPlaybackPosition() {
  if (!video.value || video.value.storage_type !== 'local') return
  const deepLinkTime = parseVideoTimeParam(getFirstStringQueryValue(route.query.t), video.value.duration_sec)
  if (deepLinkTime !== null) {
    seekLocalVideo(deepLinkTime)
    return
  }
  if (authStore.token) {
    const serverProgress = await lifecycle.getProgress('video', video.value.id).catch(() => null)
    if (serverProgress?.position_sec) {
      seekLocalVideo(serverProgress.position_sec)
      return
    }
  }
  const saved = getVideoProgress(video.value.id)
  if (saved) seekLocalVideo(saved.time_sec)
}

function handlePauseOrUnload() {
  const duration = videoElement.value?.duration
  if (!video.value || !videoElement.value || typeof duration !== 'number' || !Number.isFinite(duration)) return
  saveVideoProgress(video.value.id, videoElement.value.currentTime, duration)
}

function handleVideoEnded() {
  if (!video.value) return
  clearVideoProgress(video.value.id)
  consumptionTracker?.update(1)
  showNextPrompt.value = recommended.value.length > 0
}

async function copyVideoLink() {
  try {
    await navigator.clipboard.writeText(window.location.href)
  } catch {
    // ignore
  }
}

async function shareVideo() {
  if (!video.value || video.value.visibility !== 'public') return
  try {
    const shareUrl = window.location.href
    if (navigator.share) {
      await navigator.share({ title: video.value.title, url: shareUrl })
    } else {
      await navigator.clipboard.writeText(shareUrl)
    }
  } catch {
    // The user may cancel native share.
  }
}

function toggleTheaterMode() {
  theaterMode.value = !theaterMode.value
  saveStoredTheaterMode(theaterMode.value)
}

function playNextVideo() {
  const next = recommended.value[0]
  if (!next) return
  router.push(`/videos/watch/${next.id}`)
}

function handleSeekToTimestamp(value: number) {
  if (video.value?.storage_type === 'local' && videoElement.value) {
    videoElement.value.currentTime = value
    currentPlaybackTime.value = value
    videoElement.value.play().catch(() => {})
    timestampHint.value = ''
    return
  }
  timestampHint.value = '当前来源暂不支持精确跳转，请手动拖动到对应时间点。'
  setTimeout(() => {
    if (timestampHint.value) timestampHint.value = ''
  }, 3000)
}
</script>

<template>
  <div class="vd-page">
    <div v-if="loading" class="vd-loading">
      <div class="vd-loading-player" />
      <div class="vd-loading-info">
        <div class="vd-loading-line vd-loading-line--lg" />
        <div class="vd-loading-line vd-loading-line--sm" />
      </div>
    </div>

    <div v-else-if="error" class="vd-error">{{ error }}</div>

    <div v-else-if="video" :class="['vd-layout', { 'vd-layout--theater': theaterMode }]">
      <!-- Main: player + info -->
      <div class="vd-main">
        <!-- Player Shell -->
        <PVideoPlayerShell
          :video="video"
          :current-time="currentPlaybackTime"
          :theater-mode="theaterMode"
          @copy-link="copyVideoLink"
          @toggle-theater="toggleTheaterMode"
        >
          <template #player>
            <iframe
              v-if="embedSrc"
              :src="embedSrc"
              class="vd-embed"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen
            />
            <video
              v-else-if="video.storage_type === 'local'"
              ref="videoElement"
              :src="video.video_url"
              :poster="video.thumbnail_url || undefined"
              class="vd-native"
              preload="metadata"
              @timeupdate="syncCurrentPlaybackTime"
              @loadedmetadata="restoreInitialPlaybackPosition"
              @pause="handlePauseOrUnload"
              @ended="handleVideoEnded"
            />
            <div v-else class="vd-external">
              <a :href="video.video_url" target="_blank" rel="noopener noreferrer" class="vd-external-link">
                在外部平台观看 →
              </a>
            </div>
          </template>
          <template v-if="video.storage_type === 'local'" #timeline-preview>
            <VideoPlayerControls
              :video-element="videoElement"
              :duration-sec="video.duration_sec"
              :thumbnails="video.preview_thumbnails"
              :theater-mode="theaterMode"
              @toggle-theater="toggleTheaterMode"
            />
          </template>
        </PVideoPlayerShell>

        <!-- Title -->
        <h1 class="vd-title">{{ video.title }}</h1>

        <!-- Meta row -->
        <div class="vd-meta-row">
          <RouterLink v-if="video.channel" :to="`/channel/${video.channel.slug || video.channel_id}`" class="vd-channel">
            {{ video.channel.name }}
          </RouterLink>
          <div class="vd-stats">
            <span>{{ video.view_count.toLocaleString() }} 次播放</span>
            <span>{{ fmtDate(video.created_at) }}</span>
            <span v-if="video.duration_sec">{{ fmtDuration(video.duration_sec) }}</span>
          </div>
          <button
            v-if="video.visibility === 'public'"
            type="button"
            class="vd-share"
            data-testid="video-share"
            @click="shareVideo"
          >
            分享
          </button>
        </div>

        <!-- Timestamp hint -->
        <p v-if="timestampHint" class="vd-timestamp-hint">{{ timestampHint }}</p>

        <!-- Interactions and comments -->
        <div class="vd-interactions" data-testid="video-comments">
          <InteractionBar
            :liked="interactions.liked.value"
            :like-count="interactions.likeCount.value"
            :comment-count="interactions.commentCount.value"
            :disabled="true"
            @like="interactions.like"
            @unlike="interactions.unlike"
          />
          <p v-if="commentNotice" class="vd-comment-notice">{{ commentNotice }}</p>
          <CommentThread
            :items="interactions.comments.value"
            :loading="interactions.loadingComments.value"
            :submitting="interactions.submittingComment.value"
            :can-comment="canComment"
            :can-delete="canDeleteComment"
            :submit-action="submitComment"
            @delete="interactions.deleteComment"
          />
        </div>

        <!-- Tags -->
        <div v-if="video.tags && video.tags.length" class="vd-tags">
          <span v-for="tag in video.tags" :key="tag.id" class="vd-tag"># {{ tag.name }}</span>
        </div>

        <!-- Description -->
        <div v-if="video.description" class="vd-desc" data-testid="video-description">
          <pre class="vd-desc-text">{{ video.description }}</pre>
        </div>
      </div>

      <!-- Sidebar: recommended -->
      <VideoContinueList
        class="vd-sidebar"
        :videos="recommended"
        :show-next-prompt="showNextPrompt"
        @play-next="playNextVideo"
      />
    </div>
  </div>
</template>

<style scoped>
.vd-page {
  max-width: 80rem;
  margin: 0 auto;
  padding: 1.5rem 1.5rem 6rem;
}

/* Loading skeleton */
.vd-loading { display: flex; flex-direction: column; gap: 1rem; }
.vd-loading-player {
  width: 100%;
  aspect-ratio: 16/9;
  background: var(--a-color-surface, #f3f4f6);
  border-radius: 4px;
  animation: pulse 1.5s ease-in-out infinite;
}
.vd-loading-info { display: flex; flex-direction: column; gap: 0.5rem; }
.vd-loading-line {
  height: 1rem;
  background: var(--a-color-surface, #f3f4f6);
  border-radius: 0px;
  animation: pulse 1.5s ease-in-out infinite;
}
.vd-loading-line--lg { width: 60%; }
.vd-loading-line--sm { width: 30%; }

.vd-error {
  text-align: center;
  padding: 6rem 0;
  color: var(--a-color-danger, #ef4444);
}

/* Main layout */
.vd-layout {
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
}

.vd-layout--theater {
  display: block;
}
.vd-layout--theater .vd-main {
  max-width: none;
}
.vd-layout--theater .vd-sidebar {
  margin-top: 2rem;
  width: auto;
}

.vd-main { flex: 1; min-width: 0; }

/* Player */
.vd-player-wrap {
  width: 100%;
  background: #000;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 1rem;
}
.vd-embed {
  display: block;
  width: 100%;
  aspect-ratio: 16/9;
  border: none;
}
.vd-native {
  display: block;
  width: 100%;
  aspect-ratio: 16/9;
  background: #000;
}
.vd-external {
  aspect-ratio: 16/9;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--a-color-surface, #111);
}
.vd-external-link {
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  text-decoration: none;
}
.vd-external-link:hover { text-decoration: underline; }

/* Info */
.vd-title {
  font-size: 1.25rem;
  font-weight: 500;
  line-height: 1.4;
  color: var(--a-color-fg);
  margin: 0 0 0.75rem 0;
}
.vd-meta-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}
.vd-channel {
  font-weight: 500;
  font-size: 0.9rem;
  color: var(--a-color-fg);
  text-decoration: none;
}
.vd-channel:hover { text-decoration: underline; }
.vd-stats {
  display: flex;
  gap: 0.75rem;
  font-size: 0.8rem;
  color: var(--a-color-muted, #6b7280);
}
.vd-share {
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 500;
  padding: 0.3rem 0.65rem;
  cursor: pointer;
}
.vd-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.75rem;
}
.vd-tag {
  font-size: 0.75rem;
  padding: 0.2rem 0.5rem;
  background: var(--a-color-surface, #f3f4f6);
  border-radius: 0px;
  color: var(--a-color-muted, #6b7280);
  cursor: pointer;
}
.vd-tag:hover { color: var(--a-color-fg); }

.vd-desc {
  margin-top: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--a-color-surface, #f9fafb);
  border-radius: 4px;
}
.vd-desc-text {
  font-size: 0.875rem;
  color: var(--a-color-fg);
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  margin: 0;
  line-height: 1.6;
}

.vd-interactions {
  display: grid;
  gap: 1rem;
  margin: 1rem 0;
}

.vd-comment-notice {
  margin: 0;
  font-size: 0.875rem;
  color: var(--a-color-muted, #6b7280);
}

/* Sidebar */
.vd-sidebar {
  width: 22rem;
  flex-shrink: 0;
}
.vd-sidebar-title {
  font-size: 0.875rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0;
  color: var(--a-color-muted, #6b7280);
  margin: 0 0 0.75rem 0;
}
.vd-recommended {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.vd-no-rec {
  font-size: 0.8rem;
  color: var(--a-color-muted, #9ca3af);
  text-align: center;
  padding: 2rem 0;
}

/* Responsive */
@media (max-width: 1024px) {
  .vd-sidebar { width: 18rem; }
}
@media (max-width: 768px) {
  .vd-layout { flex-direction: column; }
  .vd-sidebar { width: 100%; }
  .vd-recommended {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.vd-timestamp-hint {
  font-size: 0.8rem;
  color: var(--a-color-muted, #6b7280);
  padding: 0.5rem 0.75rem;
  background: var(--a-color-surface, #f3f4f6);
  border-radius: 4px;
  margin-bottom: 0.5rem;
}
</style>
