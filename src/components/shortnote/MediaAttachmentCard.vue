<template>
  <div
    class="media-attachment-card"
    :class="[
      `media-attachment-card--${attachment.type}`,
      { 'is-playing': isPlaying },
    ]"
    @click.stop
  >
    <!-- 视频展开内嵌播放器 -->
    <div
      v-if="attachment.type === 'video' && isInlineVideoOpen"
      class="media-attachment-card__video-player"
      @click.stop
    >
      <iframe
        v-if="iframeUrl"
        :src="iframeUrl"
        class="media-attachment-card__frame"
        :title="attachment.title"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
      />
      <video
        v-else-if="videoUrl"
        :src="videoUrl"
        class="media-attachment-card__video"
        controls
        autoplay
        playsinline
      />
      <div v-else-if="loadingVideo" class="media-attachment-card__video-loading">
        <span>加载视频中...</span>
      </div>
      <div v-else class="media-attachment-card__video-fallback">
        <RouterLink
          :to="`/videos/watch/${attachment.id}`"
          class="media-attachment-card__link-btn"
        >
          前往观看视频
        </RouterLink>
      </div>
    </div>

    <!-- 媒体信息条 -->
    <div class="media-attachment-card__bar">
      <!-- 封面图及播放触发 -->
      <div class="media-attachment-card__cover" @click.stop="handlePrimaryAction">
        <img
          v-if="attachment.cover_url"
          :src="resolveMediaURL(attachment.cover_url)"
          :alt="attachment.title"
          class="media-attachment-card__img"
          loading="lazy"
        />
        <div v-else class="media-attachment-card__cover-placeholder">
          <Disc v-if="attachment.type === 'album'" :size="20" aria-hidden="true" />
          <VideoIcon v-else-if="attachment.type === 'video'" :size="20" aria-hidden="true" />
          <Music v-else :size="20" aria-hidden="true" />
        </div>

        <button
          type="button"
          class="media-attachment-card__play-overlay"
          :aria-label="isPlaying ? '暂停' : '播放'"
          data-test="media-play-btn"
          @click.stop="handlePrimaryAction"
        >
          <Pause v-if="isPlaying" :size="16" aria-hidden="true" />
          <Play v-else :size="16" aria-hidden="true" />
        </button>
      </div>

      <!-- 文字与元信息 -->
      <div
        class="media-attachment-card__info"
        :class="{ 'is-clickable': Boolean(targetHref) }"
        @click.stop="handleNavigate"
      >
        <div class="media-attachment-card__header">
          <span class="media-attachment-card__badge">{{ typeLabel }}</span>
          <span class="media-attachment-card__title" :title="attachment.title">
            {{ attachment.title }}
          </span>
        </div>

        <div class="media-attachment-card__meta" :title="subtitleText">
          <template v-if="attachment.type === 'song'">
            <span v-if="displayArtist" class="media-attachment-card__artist">
              {{ displayArtist }}
            </span>
            <span v-if="displayArtist && (attachment.album_title || attachment.year || durationFormatted)" class="media-attachment-card__dot">·</span>

            <RouterLink
              v-if="attachment.album_title && attachment.album_id"
              :to="`/music/album/${attachment.album_id}`"
              class="media-attachment-card__album-link"
              :title="`查看专辑《${attachment.album_title}》`"
              @click.stop
            >
              《{{ attachment.album_title }}》
            </RouterLink>
            <span v-else-if="attachment.album_title" class="media-attachment-card__album-name">
              《{{ attachment.album_title }}》
            </span>
            <span v-if="attachment.album_title && (attachment.year || durationFormatted)" class="media-attachment-card__dot">·</span>

            <span v-if="attachment.year" class="media-attachment-card__year">
              {{ attachment.year }}
            </span>
            <span v-if="attachment.year && durationFormatted" class="media-attachment-card__dot">·</span>

            <span v-if="durationFormatted" class="media-attachment-card__duration">
              {{ durationFormatted }}
            </span>
          </template>

          <template v-else-if="attachment.type === 'album'">
            <span v-if="displayArtist" class="media-attachment-card__artist">
              {{ displayArtist }}
            </span>
            <span v-if="displayArtist && (attachment.year || attachment.song_count)" class="media-attachment-card__dot">·</span>

            <span v-if="attachment.year" class="media-attachment-card__year">
              {{ attachment.year }}
            </span>
            <span v-if="attachment.year && attachment.song_count" class="media-attachment-card__dot">·</span>

            <span v-if="attachment.song_count" class="media-attachment-card__count">
              {{ attachment.song_count }} 首曲目
            </span>
          </template>

          <template v-else>
            <span v-if="durationFormatted" class="media-attachment-card__duration">
              {{ durationFormatted }}
            </span>
            <span v-else-if="attachment.subtitle" class="media-attachment-card__fallback-subtitle">
              {{ attachment.subtitle }}
            </span>
          </template>
        </div>
      </div>

      <!-- 右侧操作区 -->
      <div class="media-attachment-card__actions" @click.stop>
        <RouterLink
          v-if="targetHref"
          :to="targetHref"
          class="media-attachment-card__action-btn"
          :title="actionBtnTitle"
          :aria-label="actionBtnTitle"
          @click.stop
        >
          <ExternalLink :size="14" aria-hidden="true" />
        </RouterLink>

        <button
          type="button"
          class="media-attachment-card__ctrl-btn"
          :aria-label="isPlaying ? '暂停' : '播放'"
          @click.stop="handlePrimaryAction"
        >
          <Pause v-if="isPlaying" :size="15" aria-hidden="true" />
          <Play v-else :size="15" aria-hidden="true" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Disc, ExternalLink, Music, Pause, Play, Video as VideoIcon } from 'lucide-vue-next'
import { getMusicAlbum } from '@/api/musicV1'
import { getVideo } from '@/api/video'
import { useAuthStore } from '@/stores/auth'
import { usePlayerStore } from '@/stores/player'
import type { ShortNoteMediaAttachment, Song } from '@/types'
import { resolveMediaURL, resolvePlayableAudioURL } from '@/utils/mediaUrl'
import { buildPlayableSongsFromAlbum } from '@/utils/musicMedia'

const props = defineProps<{
  attachment: ShortNoteMediaAttachment
}>()

const router = useRouter()
const authStore = useAuthStore()
const player = usePlayerStore()

const isInlineVideoOpen = ref(false)
const videoUrl = ref<string | null>(null)
const iframeUrl = ref<string | null>(null)
const loadingVideo = ref(false)
const loadingAlbum = ref(false)

const typeLabel = computed(() => {
  switch (props.attachment.type) {
    case 'album':
      return '专辑'
    case 'video':
      return '视频'
    case 'song':
    default:
      return '单曲'
  }
})

const targetHref = computed(() => {
  if (props.attachment.type === 'song') {
    return `/music/song/${props.attachment.id}`
  }
  if (props.attachment.type === 'album') {
    return `/music/album/${props.attachment.id}`
  }
  if (props.attachment.type === 'video') {
    return `/videos/watch/${props.attachment.id}`
  }
  return ''
})

const actionBtnTitle = computed(() => {
  switch (props.attachment.type) {
    case 'album':
      return '进入专辑页面'
    case 'video':
      return '观看视频'
    case 'song':
    default:
      return '进入歌曲页面'
  }
})

const displayArtist = computed(() => {
  return props.attachment.artist || props.attachment.subtitle || ''
})

const durationFormatted = computed(() => {
  if (props.attachment.duration && props.attachment.duration > 0) {
    const mins = String(Math.floor(props.attachment.duration / 60)).padStart(2, '0')
    const secs = String(Math.floor(props.attachment.duration % 60)).padStart(2, '0')
    return `${mins}:${secs}`
  }
  return ''
})

const subtitleText = computed(() => {
  if (props.attachment.type === 'song') {
    const parts = [
      props.attachment.artist,
      props.attachment.album_title ? `《${props.attachment.album_title}》` : '',
      props.attachment.year ? `${props.attachment.year}` : '',
      durationFormatted.value,
    ].filter(Boolean)
    if (parts.length > 0) return parts.join(' · ')
  } else if (props.attachment.type === 'album') {
    const parts = [
      props.attachment.artist,
      props.attachment.year ? `${props.attachment.year}` : '',
      props.attachment.song_count ? `${props.attachment.song_count} 首曲目` : '',
    ].filter(Boolean)
    if (parts.length > 0) return parts.join(' · ')
  }
  if (props.attachment.subtitle) return props.attachment.subtitle
  return durationFormatted.value
})

const isCurrentSong = computed(() => {
  return Boolean(
    player.currentSong &&
    String(player.currentSong.id) === String(props.attachment.id),
  )
})

const isCurrentAlbum = computed(() => {
  if (player.currentAlbum && player.currentAlbum.length > 0) {
    return player.currentAlbum.some(
      (song) => String(song.album_id) === String(props.attachment.id),
    )
  }
  return false
})

const isPlaying = computed(() => {
  if (props.attachment.type === 'song') {
    return isCurrentSong.value && player.isPlaying
  }
  if (props.attachment.type === 'album') {
    return isCurrentAlbum.value && player.isPlaying
  }
  if (props.attachment.type === 'video') {
    return isInlineVideoOpen.value
  }
  return false
})

function buildSongPayload(): Song {
  return {
    id: props.attachment.id,
    title: props.attachment.title,
    artist: props.attachment.subtitle || '未知艺术家',
    album: '',
    album_id: '',
    year: 0,
    release_date: '',
    lyrics: '',
    audio_url: props.attachment.audio_url
      ? resolvePlayableAudioURL(props.attachment.audio_url)
      : '',
    cover_url: props.attachment.cover_url || '',
    status: 'open',
    summary_only: !props.attachment.audio_url,
  }
}

function handlePlaySong() {
  if (isCurrentSong.value) {
    player.togglePlay()
    return
  }
  player.playSong(buildSongPayload())
}

async function handlePlayAlbum() {
  if (isCurrentAlbum.value) {
    player.togglePlay()
    return
  }

  loadingAlbum.value = true
  try {
    const album = await getMusicAlbum(props.attachment.id)
    const songs = buildPlayableSongsFromAlbum(album)
    if (songs.length > 0) {
      player.playAlbum(songs)
      return
    }
  } catch {
    // 忽略加载异常，尝试使用后备单首曲目播放
  } finally {
    loadingAlbum.value = false
  }

  const fallbackSong = buildSongPayload()
  fallbackSong.album = props.attachment.title
  fallbackSong.album_id = props.attachment.id
  player.playAlbum([fallbackSong])
}

function extractTrustedVideoFrameUrl(source: string): string | undefined {
  const youtube = source.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  if (youtube) return `https://www.youtube.com/embed/${youtube[1]}?rel=0&autoplay=0`

  const bilibili = source.match(/bilibili\.com\/video\/(BV[A-Za-z0-9]+)/)
  if (bilibili) return `https://player.bilibili.com/player.html?bvid=${bilibili[1]}&autoplay=0`

  return undefined
}

async function handlePlayVideo() {
  if (isInlineVideoOpen.value) {
    isInlineVideoOpen.value = false
    return
  }

  isInlineVideoOpen.value = true
  if (videoUrl.value || iframeUrl.value) return

  if (props.attachment.audio_url) {
    const frame = extractTrustedVideoFrameUrl(props.attachment.audio_url)
    if (frame) {
      iframeUrl.value = frame
      return
    }
    videoUrl.value = resolveMediaURL(props.attachment.audio_url)
    return
  }

  loadingVideo.value = true
  try {
    const video = await getVideo(props.attachment.id, authStore.token ?? undefined)
    if (video) {
      const frame = extractTrustedVideoFrameUrl(video.video_url || '')
      if (frame) {
        iframeUrl.value = frame
      } else if (video.video_url) {
        videoUrl.value = resolveMediaURL(video.video_url)
      } else if (router) {
        router.push(`/videos/watch/${props.attachment.id}`)
      }
    } else if (router) {
      router.push(`/videos/watch/${props.attachment.id}`)
    }
  } catch {
    if (router) {
      router.push(`/videos/watch/${props.attachment.id}`)
    }
  } finally {
    loadingVideo.value = false
  }
}

function handleNavigate() {
  if (targetHref.value && router) {
    void router.push(targetHref.value)
  }
}

function handlePrimaryAction() {
  if (props.attachment.type === 'album') {
    void handlePlayAlbum()
  } else if (props.attachment.type === 'video') {
    void handlePlayVideo()
  } else {
    handlePlaySong()
  }
}
</script>

<style scoped>
.media-attachment-card {
  display: flex;
  flex-direction: column;
  background: var(--a-color-surface-muted);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  overflow: hidden;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.media-attachment-card:hover {
  border-color: var(--a-color-border);
}

.media-attachment-card.is-playing {
  border-color: var(--a-color-primary, #3b82f6);
}

/* 视频播放器区域 */
.media-attachment-card__video-player {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.media-attachment-card__frame,
.media-attachment-card__video {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
}

.media-attachment-card__video {
  object-fit: contain;
}

.media-attachment-card__video-loading,
.media-attachment-card__video-fallback {
  color: #fff;
  font-size: 0.8125rem;
}

.media-attachment-card__link-btn {
  color: #fff;
  text-decoration: underline;
}

/* 媒体栏 */
.media-attachment-card__bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
}

/* 封面区 */
.media-attachment-card__cover {
  position: relative;
  width: 2.75rem;
  height: 2.75rem;
  flex-shrink: 0;
  border-radius: 4px;
  overflow: hidden;
  background: var(--a-color-surface-soft, rgba(0, 0, 0, 0.05));
  cursor: pointer;
}

.media-attachment-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.media-attachment-card__cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-muted);
}

.media-attachment-card__play-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  color: #fff;
  border: 0;
  opacity: 0;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.media-attachment-card__cover:hover .media-attachment-card__play-overlay,
.media-attachment-card.is-playing .media-attachment-card__play-overlay {
  opacity: 1;
}

/* 信息区 */
.media-attachment-card__info {
  flex: 1;
  min-width: 0;
}

.media-attachment-card__header {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.media-attachment-card__badge {
  font-size: 0.6875rem;
  padding: 0.0625rem 0.375rem;
  border-radius: 9999px;
  background: var(--a-color-surface-soft, rgba(0, 0, 0, 0.05));
  color: var(--a-color-muted);
  flex-shrink: 0;
}

.media-attachment-card__title {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--a-color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.media-attachment-card__info.is-clickable {
  cursor: pointer;
}

.media-attachment-card__info.is-clickable:hover .media-attachment-card__title {
  color: var(--a-color-primary, #3b82f6);
  text-decoration: underline;
}

.media-attachment-card__meta,
.media-attachment-card__subtitle {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--a-color-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 0.125rem;
}

.media-attachment-card__dot {
  opacity: 0.6;
  user-select: none;
}

.media-attachment-card__album-link {
  color: var(--a-color-muted);
  text-decoration: none;
  transition: color 0.15s ease;
}

.media-attachment-card__album-link:hover {
  color: var(--a-color-primary, #3b82f6);
  text-decoration: underline;
}

/* 操作区 */
.media-attachment-card__actions {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
}

.media-attachment-card__action-btn,
.media-attachment-card__ctrl-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: var(--a-radius-control);
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-muted);
  cursor: pointer;
  text-decoration: none;
  transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
}

.media-attachment-card__action-btn:hover,
.media-attachment-card__ctrl-btn:hover {
  color: var(--a-color-text);
  border-color: var(--a-color-border);
  background: var(--a-color-surface-muted);
}
</style>
