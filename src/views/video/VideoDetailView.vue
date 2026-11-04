<script setup lang="ts">
import { deleteVideoRating, getRecommendedVideos, getVideo, getVideoResource, recordVideoView, reprocessVideo, setVideoRating, type VideoRatingSummary } from '@/api/video'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Copy, MessageSquare, Play, Share2 } from 'lucide-vue-next'
import { RouterLink, useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import type { CommentTargetRef } from '@/api/comments'
import type { Collection, Video } from '@/types'
import { parseVideoTimeParam } from '@/composables/useVideoDeepLink'
import { clearVideoProgress, getVideoProgress, saveVideoProgress } from '@/composables/useVideoProgress'
import PVideoPlayerShell from '@/components/shared/PVideoPlayerShell.vue'
import CommentSideSheet from '@/components/comment/CommentSideSheet.vue'
import PBookmarkButton from '@/components/ui/PBookmarkButton.vue'
import PLink from '@/components/ui/PLink.vue'
import PostRatingControl from '@/components/blog/PostRatingControl.vue'
import VideoPlayerControls from '@/components/video/VideoPlayerControls.vue'
import VideoCollectionPlaylist from '@/components/video/VideoCollectionPlaylist.vue'
import VideoRecommendationRow from '@/components/video/VideoRecommendationRow.vue'
import { useInteractions } from '@/composables/useInteractions'
import { useVideoBookmarks } from '@/composables/useVideoBookmarks'
import { useAuthStore } from '@/stores/auth'
import { useLoginRedirect } from '@/composables/useLoginRedirect'
import { useFeedStore } from '@/stores/feed'
import { isModeratorRole } from '@/utils/roles'
import { resolveMediaURL } from '@/utils/mediaUrl'
import { pickLatestMediaProgress } from '@/utils/mediaProgressConflict'
import { useOfflineMediaSource } from '@/composables/useOfflineMediaSource'
import { videoAvatarSource, videoThumbnailSource } from '@/utils/videoPresentation'
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
const { requireLogin } = useLoginRedirect()
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
const actionFeedback = ref('')
const actionError = ref('')
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
const posterUrl = computed(() => {
  const thumbnail = video.value ? videoThumbnailSource(video.value) : ''
  return thumbnail ? resolveMediaURL(thumbnail) : undefined
})
const nativeVideoUrl = computed(() => video.value?.video_url ? resolveMediaURL(video.value.video_url) : '')
const {
  playbackUrl: offlineVideoUrl,
  isCached: isVideoCached,
  isCaching: isVideoCaching,
  cacheError: videoCacheError,
  cacheCurrentMedia: cacheCurrentVideo,
  removeCurrentMedia: removeCurrentVideo,
} = useOfflineMediaSource(nativeVideoUrl)
const subtitleUrl = computed(() => video.value?.subtitle_url ? resolveMediaURL(video.value.subtitle_url) : '')
const channelCoverUrl = computed(() => {
  const url = video.value ? videoAvatarSource(video.value) : ''
  return url ? resolveMediaURL(url) : ''
})
const processingMessage = computed(() => {
  if (!video.value || video.value.storage_type !== 'local') return ''
  if (video.value.processing_status === 'pending' || video.value.processing_status === 'processing') return '正在生成封面和播放预览，完成后会自动刷新。'
  if (video.value.processing_status === 'failed') return video.value.processing_error || '封面和播放预览处理失败，可以重试。'
  return ''
})
const canReprocessVideo = computed(() => Boolean(
  video.value?.processing_status === 'failed'
  && authStore.isAuthenticated
  && authStore.user?.uuid === video.value?.user_id,
))

const videoElement = ref<HTMLVideoElement | null>(null)
const currentPlaybackTime = ref(0)
const timestampHint = ref('')
let lastProgressSave = 0
let loadSeq = 0
let consumptionTracker: ReturnType<typeof createContentConsumptionTracker> | null = null
let processingRefreshTimer: ReturnType<typeof setTimeout> | null = null

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

function stopProcessingRefresh() {
  if (processingRefreshTimer) clearTimeout(processingRefreshTimer)
  processingRefreshTimer = null
}

function scheduleProcessingRefresh() {
  stopProcessingRefresh()
  const current = video.value
  if (!current || current.storage_type !== 'local' || !['pending', 'processing'].includes(current.processing_status || '')) return
  processingRefreshTimer = setTimeout(async () => {
    if (!video.value || video.value.id !== current.id) return
    try {
      const refreshed = await getVideo(current.id, authStore.token ?? undefined)
      if (video.value?.id !== current.id) return
      video.value = { ...video.value, ...refreshed }
    } catch {
      // Keep the current state visible and retry on the next interval.
    }
    scheduleProcessingRefresh()
  }, 4000)
}

async function retryVideoProcessing() {
  if (!video.value || !canReprocessVideo.value) return
  const videoID = video.value.id
  const requestSeq = loadSeq
  actionFeedback.value = ''
  actionError.value = ''
  try {
    await reprocessVideo(video.value.id, authStore.token ?? undefined)
    if (requestSeq === loadSeq && video.value?.id === videoID) video.value = { ...video.value, processing_status: 'pending', processing_error: '' }
    scheduleProcessingRefresh()
  } catch {
    actionError.value = '重新处理失败，请稍后再试'
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
  stopProcessingRefresh()
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
  ratingLoading.value = false
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
    scheduleProcessingRefresh()
    const context = await resolveCollectionContext(detail, seq)
    if (seq !== loadSeq) return
    activeCollection.value = context?.collection ?? null
    collectionVideos.value = context?.videos ?? []
    recommended.value = filterCollectionRecommendations(recommendations, context)

    consumptionTracker = createContentConsumptionTracker({
      onEvent: (event) => {
        if (!authStore.token) return
        void lifecycle.recordEvent({ module: 'video', content_id: detail.id, event, source: getFirstStringQueryValue(route.query.source) || 'direct' }).then(() => {
          if (event === 'open') void feedStore.fetchSubscriptionHubTree()
        }).catch(() => undefined)
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

onMounted(() => {
  void load(videoId.value)
  document.addEventListener('visibilitychange', handleVisibilityChange)
})
onBeforeUnmount(() => {
  flushServerProgress()
  if (autoNextTimer) clearInterval(autoNextTimer)
  stopProcessingRefresh()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})
watch(() => [route.params.id, authStore.token], ([id]) => { if (id) void load(id as string) })

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

function flushServerProgress(completed = false) {
  if (!authStore.token || !video.value || video.value.storage_type !== 'local') return
  const duration = Math.floor(playbackDuration())
  if (duration <= 0) return
  const position = completed ? duration : Math.min(duration, Math.floor(videoElement.value?.currentTime ?? currentPlaybackTime.value))
  const progress = completed ? 1 : position / duration
  void lifecycle.saveProgress({
    module: 'video', content_id: video.value.id, position_sec: position,
    duration_sec: duration, progress, completed: completed || progress >= 0.95,
    source: getFirstStringQueryValue(route.query.source) || 'direct',
  }).catch(() => undefined)
}

function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') flushServerProgress()
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
    const saved = getVideoProgress(detail.id)
    const localCandidate: {
      position_sec: number
      duration_sec: number
      progress: number
      completed: boolean
      updated_at?: string
    } | null = saved ? {
      position_sec: saved.time_sec,
      duration_sec: saved.duration_sec,
      progress: saved.duration_sec > 0 ? saved.time_sec / saved.duration_sec : 0,
      completed: false,
      updated_at: saved.updated_at,
    } : null
    const serverCandidate = serverProgress ? {
      ...serverProgress,
      duration_sec: serverProgress.duration_sec || playbackDuration(),
      progress: serverProgress.progress ?? (playbackDuration() > 0 ? serverProgress.position_sec / playbackDuration() : 0),
    } : null
    const selected = pickLatestMediaProgress(localCandidate, serverCandidate)
    if (selected && hasResumablePosition(selected.position_sec, playbackDuration())) resumePosition.value = Math.floor(selected.position_sec)
    return
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
  flushServerProgress()
}

function handleVideoEnded() {
  if (!video.value) return
  clearVideoProgress(video.value.id)
  consumptionTracker?.update(1)
  flushServerProgress(true)
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
  actionFeedback.value = ''
  actionError.value = ''
  try {
    const shareUrl = window.location.href
    if (navigator.share) {
      await navigator.share({ title: video.value.title, url: shareUrl })
      actionFeedback.value = '已打开分享面板'
    } else {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(shareUrl)
      actionFeedback.value = '链接已复制'
    }
  } catch {
    actionError.value = '无法分享，请手动复制地址栏链接'
  }
}

async function copyVideoUuid() {
  if (!video.value) return
  actionFeedback.value = ''
  actionError.value = ''
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
    await navigator.clipboard.writeText(String(video.value.id))
    actionFeedback.value = '视频 ID 已复制'
  } catch {
    actionError.value = '复制视频 ID 失败'
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
  if (!video.value || !requireLogin() || ratingLoading.value) return
  const target = video.value
  const videoID = video.value.id
  ratingLoading.value = true
  ratingError.value = ''
  try {
    const summary = await setVideoRating(videoID, score, authStore.token || undefined)
    if (video.value === target) applyRating(summary)
  } catch {
    if (video.value === target) ratingError.value = '评分失败，请稍后再试'
  } finally {
    if (video.value === target) ratingLoading.value = false
  }
}

async function clearRating() {
  if (!video.value || !requireLogin() || ratingLoading.value) return
  const target = video.value
  const videoID = video.value.id
  ratingLoading.value = true
  ratingError.value = ''
  try {
    const summary = await deleteVideoRating(videoID, authStore.token || undefined)
    if (video.value === target) applyRating(summary)
  } catch {
    if (video.value === target) ratingError.value = '清除评分失败，请稍后再试'
  } finally {
    if (video.value === target) ratingLoading.value = false
  }
}

async function toggleBookmark() {
  if (!video.value) return
  if (!authStore.isAuthenticated) {
    await router.push('/login')
    return
  }
  actionFeedback.value = ''
  actionError.value = ''
  try {
    await bookmarks.toggle(video.value.id)
    actionFeedback.value = bookmarks.isBookmarked(video.value.id) ? '已收藏' : '已取消收藏'
  } catch {
    actionError.value = '收藏失败，请稍后再试'
  }
}

async function toggleChannelSubscription() {
  const channelId = video.value?.channel?.id
  if (!channelId || !authStore.isAuthenticated || channelSubscriptionBusy.value) return
  const videoId = video.value?.id
  const requestSeq = loadSeq
  channelSubscriptionBusy.value = true
  actionError.value = ''
  try {
    const success = channelSubscribed.value
      ? await feedStore.unsubscribeFromChannel(channelId)
      : await feedStore.subscribeToChannel(channelId)
    if (requestSeq === loadSeq && video.value?.id === videoId) {
      if (success) channelSubscribed.value = !channelSubscribed.value
      else actionError.value = '频道订阅操作失败，请稍后重试'
    }
  } catch {
    if (requestSeq === loadSeq && video.value?.id === videoId) actionError.value = '频道订阅操作失败，请稍后重试'
  } finally {
    if (requestSeq === loadSeq && video.value?.id === videoId) channelSubscriptionBusy.value = false
    else channelSubscriptionBusy.value = false
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
      <div ref="videoContentAnchor" class="vd-main vd-main--compact">
      <h1 class="vd-title">{{ video.title }}</h1>
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
          <template v-else-if="video.storage_type === 'local' && nativeVideoUrl">
            <video
              ref="videoElement"
              :src="offlineVideoUrl"
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
          <div v-else-if="video.video_url" class="vd-external">
            <PLink :href="video.video_url" external class="vd-external-link">在外部平台观看</PLink>
          </div>
          <div v-else class="vd-player-error" role="alert">
            <p>视频源不可用</p>
            <button type="button" @click="load(videoId)">重试加载</button>
          </div>
        </template>
        <template v-if="video.storage_type === 'local' && nativeVideoUrl" #timeline-preview>
          <VideoPlayerControls
            :video-element="videoElement"
            :duration-sec="video.duration_sec"
            :thumbnails="video.preview_thumbnails"
            :subtitles-available="Boolean(video.subtitle_url)"
            :theater-mode="theaterMode"
            @toggle-theater="toggleTheaterMode"
          />
        </template>
        <template #actions>
          <button
            v-if="video.storage_type === 'local' && nativeVideoUrl"
            type="button"
            class="vd-offline-action"
            :disabled="isVideoCaching"
            :aria-label="isVideoCached ? '移除视频离线副本' : '保存视频供离线播放'"
            @click="isVideoCached ? removeCurrentVideo() : cacheCurrentVideo()"
          >
            {{ isVideoCaching ? '保存中…' : isVideoCached ? '移除离线副本' : '保存离线副本' }}
          </button>
        </template>
      </PVideoPlayerShell>
      <p v-if="videoCacheError" class="vd-player-feedback" role="status">{{ videoCacheError }}</p>

      <section v-if="processingMessage" class="vd-processing-status" :class="{ 'vd-processing-status--error': video.processing_status === 'failed' }" role="status">
        <span>{{ processingMessage }}</span>
        <button v-if="canReprocessVideo" type="button" @click="retryVideoProcessing">重新处理</button>
      </section>

      <section class="vd-channel-info" aria-label="视频频道信息">
        <div class="vd-meta-row">
          <RouterLink v-if="video.channel" :to="`/channels/${video.channel.slug || video.channel_id}`" class="vd-author">
            <span class="vd-author-avatar" aria-hidden="true">
              <img v-if="channelCoverUrl" :src="channelCoverUrl" alt="">
              <span v-else>{{ video.channel.name.slice(0, 1) }}</span>
            </span>
            <span class="vd-author-copy">
              <strong>{{ video.channel.name }}</strong>
              <small v-if="video.user?.username">@{{ video.user.username }}</small>
            </span>
            <span class="vd-author__arrow" aria-hidden="true">→</span>
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

      <section class="vd-interactions" aria-label="视频互动">
        <PostRatingControl
          class="vd-rating"
          size="sm"
          :rating-score="video.rating_score"
          :rating-count="video.rating_count"
          :viewer-rating="video.viewer_rating"
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
          <button
            type="button"
            class="vd-comment-action"
            title="复制视频 ID"
            aria-label="复制视频 ID"
            data-testid="video-copy-uuid"
            @click="copyVideoUuid"
          >
            <Copy :size="16" aria-hidden="true" />
            复制视频 ID
          </button>
          <button type="button" class="vd-comment-action" data-testid="video-comments" @click="commentsOpen = true">
            <MessageSquare :size="16" aria-hidden="true" />
            评论 {{ interactions.commentCount.value }}
          </button>
        </div>
        <p v-if="actionFeedback" class="vd-action-feedback" role="status">{{ actionFeedback }}</p>
        <p v-if="actionError" class="vd-action-feedback vd-action-feedback--error" role="alert">{{ actionError }}</p>
      </section>

      <section v-if="video.chapters?.length" class="vd-chapters" aria-label="视频章节">
        <h2>章节</h2>
        <button v-for="chapter in video.chapters" :key="`${chapter.start_sec}-${chapter.title}`" type="button" @click="handleSeekToTimestamp(chapter.start_sec)">
          {{ fmtDuration(chapter.start_sec) }} {{ chapter.title }}
        </button>
      </section>

      <section v-if="video.description || video.tags?.length" class="vd-description" data-testid="video-description">
        <pre v-if="video.description" :class="['vd-desc-text', { 'is-expanded': descriptionExpanded }]">{{ video.description }}</pre>
        <button v-if="video.description && isDescriptionTruncated" type="button" class="vd-desc-toggle" @click="descriptionExpanded = !descriptionExpanded">
          {{ descriptionExpanded ? '收起简介' : '展开简介' }}
        </button>
        <div v-if="descriptionExpanded && video.tags?.length" class="vd-tags">
          <span v-for="tag in video.tags" :key="tag.id" class="vd-tag"># {{ tag.name }}</span>
        </div>
      </section>

      <VideoRecommendationRow class="vd-recommendations" :videos="recommended" />
    </div>

      <VideoCollectionPlaylist
        v-if="activeCollection && collectionVideos.length"
        :class="['vd-playlist', { 'vd-playlist--sidebar': theaterMode }]"
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
      partial-width="var(--a-comment-sheet-width)"
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
@import "./videoDetailView.css";
</style>
