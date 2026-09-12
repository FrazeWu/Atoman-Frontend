<script setup lang="ts">
import { ref } from 'vue'
import PVideoPlayerShell from '@/components/shared/PVideoPlayerShell.vue'
import VideoPlayerControls from '@/components/video/VideoPlayerControls.vue'
import type { EmbedData } from '@/composables/useMarkdownRenderer'

const props = defineProps<{
  embed: EmbedData
}>()

const videoElement = ref<HTMLVideoElement | null>(null)
const theaterMode = ref(false)

function toggleVideoPlayback() {
  const video = videoElement.value
  if (!video) return
  if (video.paused) void video.play().catch(() => {})
  else video.pause()
}
</script>

<template>
  <div
    v-if="props.embed.video"
    class="blog-media-embed"
    :class="{ 'blog-media-embed--theater': theaterMode }"
  >
    <PVideoPlayerShell
      :video="props.embed.video"
      :theater-mode="theaterMode"
      :show-copy-link="false"
      @toggle-theater="theaterMode = !theaterMode"
    >
      <template #player>
        <iframe
          v-if="props.embed.iframeSrc"
          :src="props.embed.iframeSrc"
          class="blog-media-embed__frame"
          :title="props.embed.title"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        />
        <video
          v-else-if="props.embed.videoSrc"
          ref="videoElement"
          :src="props.embed.videoSrc"
          :poster="props.embed.posterUrl"
          class="blog-media-embed__video"
          playsinline
          preload="metadata"
          @click="toggleVideoPlayback"
        />
        <div v-else class="blog-media-embed__empty">视频暂不可播放</div>
      </template>
      <template v-if="props.embed.videoSrc" #timeline-preview>
        <VideoPlayerControls
          :video-element="videoElement"
          :duration-sec="props.embed.duration || 0"
          :theater-mode="theaterMode"
          @toggle-theater="theaterMode = !theaterMode"
        />
      </template>
    </PVideoPlayerShell>
  </div>
</template>

<style scoped>
.blog-media-embed,
.blog-media-embed :deep(.vps-shell),
.blog-media-embed :deep(.vps-player) {
  width: 100%;
  height: 100%;
}

.blog-media-embed :deep(.vps-shell) {
  margin: 0;
}

.blog-media-embed :deep(.vps-player) {
  border: 0;
  border-radius: 0;
}

.blog-media-embed__frame,
.blog-media-embed__video,
.blog-media-embed__empty {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #111;
}

.blog-media-embed__video {
  object-fit: contain;
}

.blog-media-embed__empty {
  display: grid;
  place-items: center;
  color: var(--a-color-muted);
}
</style>
