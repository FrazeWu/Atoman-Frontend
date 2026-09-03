<script setup lang="ts">
import { deleteVideoRating, getRecommendedVideos, getVideo, getVideoResource, recordVideoView, setVideoRating, type VideoRatingSummary } from '@/api/video'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { IconMessage as MessageSquare, IconPlayerPlay as Play, IconShare2 as Share2 } from '@tabler/icons-vue'
import { RouterLink, useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import type { CommentTargetRef } from '@/api/comments'
import type { Collection, Video } from '@/types'
import { parseVideoTimeParam } from '@/composables/useVideoDeepLink'
import { clearVideoProgress, getVideoProgress, saveVideoProgress } from '@/composables/useVideoProgress'
import PVideoPlayerShell from '@/components/shared/PVideoPlayerShell.vue'
import CommentSideSheet from '@/components/comment/CommentSideSheet.vue'
import PBookmarkButton from '@/components/ui/PBookmarkButton.vue'
import PostRatingControl from '@/components/blog/PostRatingControl.vue'
import VideoPlayerControls from '@/components/video/VideoPlayerControls.vue'
import VideoCollectionPlaylist from '@/components/video/VideoCollectionPlaylist.vue'
import VideoRecommendationRow from '@/components/video/VideoRecommendationRow.vue'
import { useInteractions } from '@/composables/useInteractions'
import { useVideoBookmarks } from '@/composables/useVideoBookmarks'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { isModeratorRole } from '@/utils/roles'
import { resolveMediaURL } from '@/utils/mediaUrl'
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

type CollectionContext = {
  collection: Collection
  videos: Video[]
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const feedStore = useFeedStore()
const bookmarks = useVideoBookmarks()
const lifecycle = useContentLifecycle()
const videoId = computed(() => String(route.params.id || ''))
const commentTarget = computed<CommentTargetRef>(() => ({ kind: 'video', resourceId: videoId.value }))
const interactions = useInteractions('videos', 'video', videoId)
const videoContentAnchor = ref<HTMLElement | null>(null)

const video = ref<Video | null>(null)
const activeCollection = ref<Collection | null>(null)
const collectionVideos = ref<Video[]>([])
const recommended = ref<Video[]>([])
const loading = ref(true)
const error = ref('')
const theaterMode = ref(getStoredTheaterMode())
const videoError = ref('')
const resumePosition = ref<number | null>(null)
const isLocalPlaybackActive = ref(false)
const hasRecordedView = ref(false)
const hasStartedPlayback = ref(false)
const commentsOpen = ref(false)
const descriptionExpanded = ref(false)
const ratingLoading = ref(false)
const ratingError = ref('')
const autoNextSeconds = ref<number | null>(null)
let autoNextTimer: ReturnType<typeof setInterval> | null = null
const channelSubscribed = ref(false)
const channelSubscriptionBusy = ref(false)
const canDeleteAllComments = computed(() => Boolean(
  authStore.user?.uuid === video.value?.user_id || isModeratorRole(authStore.user?.role),
))
const completedCollectionVideoIds = computed(() => collectionVideos.value
  .filter((item) => {
    const progress = getVideoProgress(item.id)
    return Boolean(progress && progress.duration_sec > 0 && progress.time_sec / progress.duration_sec >= 0.95)
  })
  .map((item) => item.id))
const isDescriptionTruncated = computed(() => {
  const description = video.value?.description || ''
  return description.length > 180 || description.split('\n').length > 3
})
const posterUrl = computed(() => video.value?.thumbnail_url ? resolveMediaURL(video.value.thumbnail_url) : undefined)
const nativeVideoUrl = computed(() => video.value?.video_url ? resolveMediaURL(video.value.video_url) : '')
const subtitleUrl = computed(() => video.value?.subtitle_url ? resolveMediaURL(video.value.subtitle_url) : '')
const channelCoverUrl = computed(() => video.value?.channel?.cover_url ? resolveMediaURL(video.value.channel.cover_url) : '')

const videoElement = ref<HTMLVideoElement | null>(null)
const currentPlaybackTime = ref(0)
const timestampHint = ref('')
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

function syncInteractionState(detail: VideoDetailResponse) {
  interactions.liked.value = detail.liked ?? detail.is_liked ?? detail.viewer_liked ?? false
  interactions.likeCount.value = detail.like_count ?? detail.likes_count ?? detail.LikeCount ?? 0
  interactions.commentCount.value = detail.comment_count ?? detail.comments_count ?? detail.CommentCount ?? 0
}

function findCollection(detail: Video, members: Video[], collectionId: string) {
  const member = members.find((item) => item.id === detail.id)
  return detail.collections?.find((item) => item.id === collectionId)
    ?? (detail.collection?.id === collectionId ? detail.collection : null)
    ?? member?.collections?.find((item) => item.id === collectionId)
    ?? (member?.collection?.id === collectionId ? member.collection : null)
    ?? null
}

async function resolveCollectionContext(detail: Video, seq: number): Promise<CollectionContext | null> {
  const requestedId = getFirstStringQueryValue(route.query.collection)
  const primaryId = detail.collection_id || detail.collection?.id || detail.collections?.[0]?.id
  const candidateIds = [...new Set([requestedId, primaryId].filter((id): id is string => Boolean(id)))]

  for (const collectionId of candidateIds) {
    try {
      const members = await getVideoResource<Video[]>(`/videos?collection_id=${encodeURIComponent(collectionId)}`, authStore.token ?? undefined)
      if (seq !== loadSeq) return null
      if (!members.some((item) => item.id === detail.id)) continue
      const collection = findCollection(detail, members, collectionId)
      if (collection) return { collection, videos: members }
    } catch {
      // Try the author-selected primary collection when an URL context is stale or inaccessible.
    }
  }
  return null
}

function filterCollectionRecommendations(items: Video[], context: CollectionContext | null) {
  if (!context) return items.slice(0, 4)
  const collectionVideoIds = new Set(context.videos.map((item) => item.id))
  return items.filter((item) => !collectionVideoIds.has(item.id)).slice(0, 4)
}

function toggleLocalPlayback() {
  if (video.value?.storage_type !== 'local' || !videoElement.value) return
  if (videoElement.value.paused) {
    playLocalVideo()
    return
  }
  videoElement.value.pause()
}

function playLocalVideo() {
  videoError.value = ''
  void videoElement.value?.play().catch(() => {
    videoError.value = '无法开始播放，请重试'
  })
}

async function load(id: string) {
  const seq = ++loadSeq
  cancelAutoNext()
  loading.value = true
  error.value = ''
  video.value = null
  activeCollection.value = null
  collectionVideos.value = []
  recommended.value = []
  videoError.value = ''
  resumePosition.value = null
  isLocalPlaybackActive.value = false
  hasRecordedView.value = false
  hasStartedPlayback.value = false
  commentsOpen.value = false
  descriptionExpanded.value = false
  ratingError.value = ''
  channelSubscribed.value = false
  currentPlaybackTime.value = 0
  lastProgressSave = 0
  consumptionTracker = null

  try {
    const [detail, recommendations] = await Promise.all([
      getVideo<VideoDetailResponse>(id, authStore.token ?? undefined),
      getRecommendedVideos<Video[]>(id).catch(() => []),
    ])
    if (seq !== loadSeq) return

    video.value = detail
    const context = await resolveCollectionContext(detail, seq)
    if (seq !== loadSeq) return
    activeCollection.value = context?.collection ?? null
    collectionVideos.value = context?.videos ?? []
    recommended.value = filterCollectionRecommendations(recommendations, context)

    consumptionTracker = createContentConsumptionTracker({
      onEvent: (event) => {
        if (!authStore.token) return
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

    if (authStore.isAuthenticated) {
      void bookmarks.load().catch(() => undefined)
      if (detail.channel?.id) {
        void feedStore.isSubscribedToChannel(detail.channel.id).then((subscribed) => {
          if (seq === loadSeq && video.value?.id === detail.id) channelSubscribed.value = subscribed
        })
      }
    }
    if (detail.storage_type !== 'local') void recordVideoViewOnce(id)
  } catch {
    if (seq === loadSeq) error.value = '加载失败，请重试'
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

onMounted(() => load(videoId.value))
onBeforeUnmount(() => { if (autoNextTimer) clearInterval(autoNextTimer) })
watch(() => route.params.id, (id) => { if (id) load(id as string) })

function syncCurrentPlaybackTime() {
  const current = Math.floor(videoElement.value?.currentTime || 0)
  const duration = videoElement.value?.duration
  currentPlaybackTime.value = current
  if (!video.value || typeof duration !== 'number' || !Number.isFinite(duration)) return
  const progress = duration > 0 ? current / duration : 0
  consumptionTracker?.update(progress)
  if (hasStartedPlayback.value && !hasRecordedView.value && progress >= 0.1) void recordVideoViewOnce(video.value.id)
  if (Date.now() - lastProgressSave < 5000) return
  lastProgressSave = Date.now()
  saveVideoProgress(video.value.id, current, Math.floor(duration))
}

async function recordVideoViewOnce(id: string) {
  if (hasRecordedView.value) return
  hasRecordedView.value = true
  await recordVideoView(id).catch(() => {
    hasRecordedView.value = false
  })
}

function seekLocalVideo(value: number) {
  if (video.value?.storage_type !== 'local' || !videoElement.value) return false
  videoElement.value.currentTime = value
  currentPlaybackTime.value = value
  return true
}

function playbackDuration() {
  const duration = videoElement.value?.duration
  if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) return duration
  return video.value?.duration_sec || 0
}

function hasResumablePosition(position: number, duration: number) {
  return Number.isFinite(position) && Number.isFinite(duration) && position >= 10 && duration > 0 && position / duration < 0.95
}

function continuePlayback() {
  if (resumePosition.value === null) return
  seekLocalVideo(resumePosition.value)
  resumePosition.value = null
  playLocalVideo()
}

function restartPlayback() {
  if (!video.value) return
  seekLocalVideo(0)
  resumePosition.value = null
  clearVideoProgress(video.value.id)
  if (authStore.token) {
    const duration = Math.floor(playbackDuration())
    void lifecycle.saveProgress({
      module: 'video', content_id: video.value.id, position_sec: 0, duration_sec: duration,
      progress: 0, completed: false, source: getFirstStringQueryValue(route.query.source) || 'direct',
    }).catch(() => undefined)
  }
  playLocalVideo()
}

async function restoreInitialPlaybackPosition() {
  const detail = video.value
  if (!detail || detail.storage_type !== 'local') return
  resumePosition.value = null
  const deepLinkTime = parseVideoTimeParam(getFirstStringQueryValue(route.query.t), detail.duration_sec)
  if (deepLinkTime !== null) {
    seekLocalVideo(deepLinkTime)
    return
  }
  if (authStore.token) {
    const serverProgress = await lifecycle.getProgress('video', detail.id).catch(() => null)
    if (video.value?.id !== detail.id) return
    if (serverProgress) {
      if (hasResumablePosition(serverProgress.position_sec, playbackDuration())) {
        resumePosition.value = Math.floor(serverProgress.position_sec)
      }
      return
    }
  }
  const saved = getVideoProgress(detail.id)
  if (saved && hasResumablePosition(saved.time_sec, playbackDuration())) {
    resumePosition.value = saved.time_sec
  }
}

function handlePauseOrUnload() {
  isLocalPlaybackActive.value = false
  const duration = videoElement.value?.duration
  if (!video.value || !videoElement.value || typeof duration !== 'number' || !Number.isFinite(duration)) return
  saveVideoProgress(video.value.id, videoElement.value.currentTime, duration)
}

function handleVideoEnded() {
  if (!video.value) return
  clearVideoProgress(video.value.id)
  consumptionTracker?.update(1)
  const current = collectionVideos.value.findIndex(item => item.id === video.value?.id)
  if (current >= 0 && collectionVideos.value[current + 1]) {
    autoNextSeconds.value = 3
    if (autoNextTimer) clearInterval(autoNextTimer)
    autoNextTimer = setInterval(() => {
      if (autoNextSeconds.value === null) return
      autoNextSeconds.value -= 1
      if (autoNextSeconds.value <= 0) {
        if (autoNextTimer) clearInterval(autoNextTimer)
        autoNextTimer = null
        autoNextSeconds.value = null
        selectAdjacentCollectionVideo(1)
      }
    }, 1000)
  }
}

function cancelAutoNext() {
  if (autoNextTimer) clearInterval(autoNextTimer)
  autoNextTimer = null
  autoNextSeconds.value = null
}

function handleVideoError() {
  resumePosition.value = null
  videoError.value = '视频暂时无法播放，请重试'
}

function handleVideoPlay() {
  resumePosition.value = null
  isLocalPlaybackActive.value = true
  hasStartedPlayback.value = true
}

function retryVideoPlayback() {
  resumePosition.value = null
  videoError.value = ''
  videoElement.value?.load()
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

async function selectCollectionVideo(id: string) {
  if (!activeCollection.value || id === video.value?.id) return
  const query: LocationQueryRaw = { ...route.query, collection: activeCollection.value.id }
  delete query.t
  await router.push({ path: `/videos/watch/${id}`, query })
}

function selectAdjacentCollectionVideo(offset: number) {
  const current = collectionVideos.value.findIndex(item => item.id === video.value?.id)
  const target = collectionVideos.value[current + offset]
  if (target) void selectCollectionVideo(target.id)
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

function currentCommentTime() {
  if (video.value?.storage_type !== 'local') return null
  return Math.floor(videoElement.value?.currentTime ?? currentPlaybackTime.value)
}

function applyRating(summary: VideoRatingSummary) {
  if (!video.value) return
  video.value.rating_score = summary.rating_score
  video.value.rating_count = summary.rating_count
  video.value.viewer_rating = summary.viewer_rating ?? null
}

async function rateVideo(score: number) {
  if (!video.value || !authStore.token) return
  ratingLoading.value = true
  ratingError.value = ''
  try {
    applyRating(await setVideoRating(video.value.id, score, authStore.token))
  } catch {
    ratingError.value = '评分失败，请稍后再试'
  } finally {
    ratingLoading.value = false
  }
}

async function clearRating() {
  if (!video.value || !authStore.token) return
  ratingLoading.value = true
  ratingError.value = ''
  try {
    applyRating(await deleteVideoRating(video.value.id, authStore.token))
  } catch {
    ratingError.value = '清除评分失败，请稍后再试'
  } finally {
    ratingLoading.value = false
  }
}

async function toggleBookmark() {
  if (!video.value) return
  if (!authStore.isAuthenticated) {
    await router.push('/login')
    return
  }
  await bookmarks.toggle(video.value.id).catch(() => undefined)
}

async function toggleChannelSubscription() {
  const channelId = video.value?.channel?.id
  if (!channelId || !authStore.isAuthenticated || channelSubscriptionBusy.value) return
  channelSubscriptionBusy.value = true
  try {
    const success = channelSubscribed.value
      ? await feedStore.unsubscribeFromChannel(channelId)
      : await feedStore.subscribeToChannel(channelId)
    if (success) channelSubscribed.value = !channelSubscribed.value
  } finally {
    channelSubscriptionBusy.value = false
  }
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
      <div ref="videoContentAnchor" class="vd-main">
      <PVideoPlayerShell
        class="vd-player-shell"
        :video="video"
        :current-time="currentPlaybackTime"
        :theater-mode="theaterMode"
        :show-copy-link="false"
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
          <template v-else-if="video.storage_type === 'local'">
            <video
              ref="videoElement"
              :src="nativeVideoUrl"
              :poster="posterUrl"
              class="vd-native"
              playsinline
              preload="metadata"
              @click="toggleLocalPlayback"
              @timeupdate="syncCurrentPlaybackTime"
              @play="handleVideoPlay"
              @loadedmetadata="restoreInitialPlaybackPosition"
              @error="handleVideoError"
              @pause="handlePauseOrUnload"
              @ended="handleVideoEnded"
            >
              <track v-if="subtitleUrl" kind="subtitles" :src="subtitleUrl" srclang="zh" label="中文" />
            </video>
            <button
              v-if="!isLocalPlaybackActive && !videoError && resumePosition === null"
              class="vd-play-overlay"
              type="button"
              aria-label="播放视频"
              data-testid="video-play"
              @click.stop="toggleLocalPlayback"
            >
              <Play :size="28" fill="currentColor" aria-hidden="true" />
            </button>
            <div v-if="resumePosition !== null && !videoError" class="vd-resume-prompt" role="group" aria-label="继续观看" data-testid="video-resume-prompt">
              <span>上次观看至 {{ fmtDuration(resumePosition) }}</span>
              <div class="vd-resume-actions">
                <button type="button" data-testid="video-resume-continue" @click="continuePlayback">继续观看</button>
                <button type="button" data-testid="video-resume-restart" @click="restartPlayback">从头播放</button>
              </div>
            </div>
            <div v-if="videoError" class="vd-player-error" role="alert">
              <p>{{ videoError }}</p>
              <button type="button" @click="retryVideoPlayback">重试播放</button>
            </div>
            <div v-if="autoNextSeconds !== null" class="vd-resume-prompt" role="status">
              <span>{{ autoNextSeconds }} 秒后播放下一集</span>
              <button type="button" @click="cancelAutoNext">取消</button>
            </div>
          </template>
          <div v-else class="vd-external">
            <a :href="video.video_url" target="_blank" rel="noopener noreferrer" class="vd-external-link">在外部平台观看</a>
          </div>
        </template>
        <template v-if="video.storage_type === 'local'" #timeline-preview>
          <VideoPlayerControls
            :video-element="videoElement"
            :duration-sec="video.duration_sec"
            :thumbnails="video.preview_thumbnails"
            :subtitles-available="Boolean(video.subtitle_url)"
            :theater-mode="theaterMode"
            @toggle-theater="toggleTheaterMode"
          />
        </template>
      </PVideoPlayerShell>

      <section class="vd-identity" aria-label="视频信息">
        <h1 class="vd-title">{{ video.title }}</h1>
        <div class="vd-meta-row">
          <RouterLink v-if="video.channel" :to="`/channel/${video.channel.slug || video.channel_id}`" class="vd-author">
            <span class="vd-author-avatar" aria-hidden="true">
              <img v-if="channelCoverUrl" :src="channelCoverUrl" alt="">
              <span v-else>{{ video.channel.name.slice(0, 1) }}</span>
            </span>
            <span class="vd-author-copy">
              <strong>{{ video.channel.name }}</strong>
              <small v-if="video.user?.username">{{ video.user.username }}</small>
            </span>
          </RouterLink>
          <div class="vd-stats">
            <span>{{ video.view_count.toLocaleString() }} 次播放</span>
            <span>{{ fmtDate(video.created_at) }}</span>
            <span v-if="video.duration_sec">{{ fmtDuration(video.duration_sec) }}</span>
          </div>
          <button
            v-if="video.channel && authStore.isAuthenticated"
            type="button"
            class="vd-subscribe"
            :disabled="channelSubscriptionBusy"
            @click="toggleChannelSubscription"
          >
            {{ channelSubscribed ? '已订阅' : '订阅频道' }}
          </button>
          <RouterLink v-else-if="video.channel" class="vd-subscribe" to="/login">登录后订阅</RouterLink>
        </div>
        <p v-if="timestampHint" class="vd-timestamp-hint">{{ timestampHint }}</p>
      </section>
      <section v-if="video.chapters?.length" class="vd-chapters" aria-label="视频章节">
        <h2>章节</h2>
        <button v-for="chapter in video.chapters" :key="`${chapter.start_sec}-${chapter.title}`" type="button" @click="handleSeekToTimestamp(chapter.start_sec)">
          {{ fmtDuration(chapter.start_sec) }} {{ chapter.title }}
        </button>
      </section>

      <VideoRecommendationRow class="vd-recommendations" :videos="recommended" />

      <section v-if="video.description || video.tags?.length" class="vd-description" data-testid="video-description">
        <pre v-if="video.description" :class="['vd-desc-text', { 'is-expanded': descriptionExpanded }]">{{ video.description }}</pre>
        <button v-if="video.description && isDescriptionTruncated" type="button" class="vd-desc-toggle" @click="descriptionExpanded = !descriptionExpanded">
          {{ descriptionExpanded ? '收起简介' : '展开简介' }}
        </button>
        <div v-if="descriptionExpanded && video.tags?.length" class="vd-tags">
          <span v-for="tag in video.tags" :key="tag.id" class="vd-tag"># {{ tag.name }}</span>
        </div>
      </section>

      <section class="vd-interactions" aria-label="视频互动">
        <PostRatingControl
          class="vd-rating"
          size="sm"
          :viewer-rating="video.viewer_rating"
          :weighted-rating-score="video.rating_score ?? null"
          :weighted-rating-count="video.rating_count ?? 0"
          :weighted-rating-active="(video.rating_count ?? 0) > 0"
          :disabled="!authStore.isAuthenticated"
          :loading="ratingLoading"
          :error-message="ratingError"
          @rate="rateVideo"
          @clear="clearRating"
        />
        <div class="vd-action-row">
          <PBookmarkButton
            :bookmarked="bookmarks.isBookmarked(video.id)"
            :disabled="bookmarks.isPending(video.id)"
            variant="bordered"
            @bookmark="toggleBookmark"
            @unbookmark="toggleBookmark"
          />
          <button
            v-if="video.visibility === 'public'"
            type="button"
            class="vd-icon-action"
            title="分享"
            aria-label="分享"
            data-testid="video-share"
            @click="shareVideo"
          >
            <Share2 :size="16" aria-hidden="true" />
          </button>
          <button type="button" class="vd-comment-action" data-testid="video-comments" @click="commentsOpen = true">
            <MessageSquare :size="16" aria-hidden="true" />
            评论 {{ interactions.commentCount.value }}
          </button>
        </div>
      </section>
    </div>

      <VideoCollectionPlaylist
        v-if="activeCollection && collectionVideos.length"
        class="vd-playlist"
        :collection="activeCollection"
        :videos="collectionVideos"
        :current-video-id="video.id"
        :completed-video-ids="completedCollectionVideoIds"
        @select="selectCollectionVideo"
        @previous="selectAdjacentCollectionVideo(-1)"
        @next="selectAdjacentCollectionVideo(1)"
      />
    </div>

    <CommentSideSheet
      v-if="video"
      :show="commentsOpen"
      :title="`视频评论-${video.title}`"
      :partial-anchor="videoContentAnchor"
      :target="commentTarget"
      noun="评论"
      :current-time="currentCommentTime"
      :can-delete="canDeleteAllComments"
      @close="commentsOpen = false"
      @seek="handleSeekToTimestamp"
      @count-change="interactions.commentCount.value = $event"
    />
  </div>
</template>

<style scoped>
.vd-page {
  max-width: 80rem;
  margin: 0 auto;
  padding: 1.5rem 1.5rem 6rem;
}

.vd-loading {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.vd-loading-player {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 4px;
  background: var(--a-color-surface);
  animation: pulse 1.5s ease-in-out infinite;
}

.vd-loading-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.vd-loading-line {
  height: 1rem;
  border-radius: 0;
  background: var(--a-color-surface);
  animation: pulse 1.5s ease-in-out infinite;
}

.vd-loading-line--lg { width: 60%; }
.vd-loading-line--sm { width: 30%; }

.vd-error {
  padding: 6rem 0;
  color: var(--a-color-danger);
  text-align: center;
}

.vd-main {
  display: grid;
  min-width: 0;
  gap: 1.25rem;
}

.vd-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 22rem;
  align-items: start;
  gap: 1.25rem 1.5rem;
}

.vd-player-shell,
.vd-identity,
.vd-recommendations,
.vd-description,
.vd-interactions {
  min-width: 0;
  grid-column: 1;
}

.vd-player-shell { grid-row: 1; }
.vd-identity { grid-row: 2; }
.vd-playlist {
  position: sticky;
  top: calc(3.5rem + 1.5rem);
  grid-column: 2;
  grid-row: 1 / span 5;
}
.vd-recommendations { grid-row: 3; }
.vd-description { grid-row: 4; }
.vd-interactions { grid-row: 5; }

.vd-layout--theater {
  grid-template-columns: minmax(0, 1fr);
}

.vd-layout--theater .vd-playlist {
  position: static;
  grid-column: 1;
  grid-row: 6;
}

.vd-embed,
.vd-native {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  border: 0;
  background: #000;
}

.vd-play-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  display: grid;
  width: 52px;
  height: 52px;
  place-items: center;
  padding: 0;
  border: 0;
  color: #fff;
  background: transparent;
  cursor: pointer;
  transform: translate(-50%, -50%);
}

.vd-play-overlay:focus-visible,
.vd-resume-actions button:focus-visible,
.vd-icon-action:focus-visible,
.vd-comment-action:focus-visible,
.vd-subscribe:focus-visible,
.vd-desc-toggle:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 3px;
}

.vd-resume-prompt,
.vd-player-error {
  position: absolute;
  inset: 0;
  display: grid;
  gap: 0.75rem;
  place-content: center;
  justify-items: center;
  color: #fff;
}

.vd-resume-prompt { background: rgba(0, 0, 0, 0.62); }
.vd-player-error { background: rgba(0, 0, 0, 0.72); }
.vd-player-error p { margin: 0; }

.vd-resume-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
}

.vd-resume-actions button,
.vd-player-error button {
  min-height: 2.5rem;
  padding: 0.45rem 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.82);
  color: #fff;
  background: transparent;
  cursor: pointer;
}

.vd-resume-actions button:first-child {
  color: #111827;
  background: #fff;
}

.vd-external {
  display: grid;
  aspect-ratio: 16 / 9;
  place-items: center;
  background: var(--a-color-surface);
}

.vd-external-link {
  color: var(--a-color-fg);
  font-size: 0.9rem;
  font-weight: 600;
}

.vd-identity {
  display: grid;
  gap: 0.7rem;
}

.vd-title {
  margin: 0;
  color: var(--a-color-fg);
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.4;
}

.vd-meta-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.7rem;
}

.vd-author {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 0.5rem;
  color: inherit;
  text-decoration: none;
}

.vd-author:hover strong { text-decoration: underline; }

.vd-author-avatar {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  color: var(--a-color-bg);
  background: var(--a-color-primary);
  font-size: 0.75rem;
  font-weight: 650;
}

.vd-author-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.vd-author-copy {
  display: grid;
  min-width: 0;
  gap: 0.1rem;
}

.vd-author-copy strong {
  overflow: hidden;
  color: var(--a-color-fg);
  font-size: 0.82rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vd-author-copy small,
.vd-stats {
  color: var(--a-color-muted);
  font-size: 0.75rem;
}

.vd-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.vd-subscribe {
  min-height: 2rem;
  padding: 0.25rem 0.55rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 3px;
  color: var(--a-color-fg);
  background: var(--a-color-bg);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}

.vd-subscribe:disabled { cursor: wait; opacity: 0.6; }

.vd-timestamp-hint {
  margin: 0;
  padding: 0.5rem 0.65rem;
  color: var(--a-color-muted);
  background: var(--a-color-surface);
  font-size: 0.75rem;
}

.vd-description {
  padding: 0.8rem;
  border-radius: 4px;
  background: var(--a-color-surface);
}

.vd-desc-text {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  color: var(--a-color-fg);
  font-family: inherit;
  font-size: 0.85rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.vd-desc-text.is-expanded {
  display: block;
}

.vd-desc-toggle {
  margin-top: 0.45rem;
  padding: 0;
  border: 0;
  color: var(--a-color-primary);
  background: transparent;
  font: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.vd-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.65rem;
}

.vd-tag {
  padding: 0.2rem 0.45rem;
  color: var(--a-color-muted);
  background: var(--a-color-bg);
  font-size: 0.72rem;
}

.vd-interactions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.65rem;
  padding: 0.7rem 0;
  border-top: 1px solid var(--a-color-border-soft);
  border-bottom: 1px solid var(--a-color-border-soft);
}

.vd-rating {
  min-width: 0;
}

.vd-rating :deep(.post-rating) {
  gap: 0.35rem;
  padding: 0;
  border: 0;
}

.vd-rating :deep(.post-rating__meta-box) {
  display: none;
}

.vd-action-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin-left: auto;
}

.vd-icon-action,
.vd-comment-action {
  display: inline-flex;
  min-height: 2rem;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 3px;
  color: var(--a-color-fg);
  background: var(--a-color-bg);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.vd-icon-action { width: 2rem; padding: 0; }
.vd-comment-action { padding: 0 0.55rem; }

@media (max-width: 1024px) {
  .vd-layout { grid-template-columns: minmax(0, 1fr) 18rem; }
}

@media (max-width: 768px) {
  .vd-page { padding: 1rem 1rem 5rem; }
  .vd-layout { grid-template-columns: minmax(0, 1fr); gap: 1rem; }
  .vd-player-shell,
  .vd-identity,
  .vd-playlist,
  .vd-recommendations,
  .vd-description,
  .vd-interactions {
    position: static;
    grid-column: 1;
    grid-row: auto;
  }
  .vd-action-row { width: 100%; margin-left: 0; }
  .vd-comment-action { margin-left: auto; }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
