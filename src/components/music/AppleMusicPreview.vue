<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { IconPlayerPause as Pause, IconPlayerPlay as Play } from '@tabler/icons-vue'
import { getMusicAppleSongPreview, type MusicAppleSongPreview } from '@/api/musicV1'
import PButton from '@/components/ui/PButton.vue'

const props = defineProps<{
  songId: string
  storeUrl: string
}>()

const appleBadgeURL = 'https://tools.applemediaservices.com/api/badges/listen-on-apple-music/badge/zh-cn?size=250x83'
const audio = ref<HTMLAudioElement | null>(null)
const preview = ref<MusicAppleSongPreview | null>(null)
const currentTime = ref(0)
const isPlaying = ref(false)
let requestController: AbortController | null = null

const previewURL = computed(() => preview.value?.preview_url?.trim() || '')
const storeURL = computed(() => preview.value?.store_url?.trim() || props.storeUrl)
const durationLimit = computed(() => Math.min(30, preview.value?.max_duration_seconds || 30))

function releaseAudio() {
  const element = audio.value
  if (!element) return
  element.pause()
  element.removeAttribute('src')
  element.load()
  isPlaying.value = false
  currentTime.value = 0
}

async function loadPreview() {
  requestController?.abort()
  releaseAudio()
  preview.value = null
  requestController = new AbortController()
  try {
    preview.value = await getMusicAppleSongPreview(props.songId, requestController.signal)
  } catch {
    // The Apple Music link remains available when a preview cannot be loaded.
  }
}

async function togglePreview() {
  const element = audio.value
  if (!element) return
  if (isPlaying.value) {
    element.pause()
    isPlaying.value = false
    return
  }
  try {
    await element.play()
    isPlaying.value = true
  } catch {
    isPlaying.value = false
  }
}

function updateProgress() {
  const element = audio.value
  if (!element) return
  if (element.currentTime >= durationLimit.value) {
    element.pause()
    element.currentTime = 0
    currentTime.value = 0
    isPlaying.value = false
    return
  }
  currentTime.value = element.currentTime
}

function handleEnded() {
  currentTime.value = 0
  isPlaying.value = false
}

watch(() => props.songId, loadPreview, { immediate: true })

onBeforeUnmount(() => {
  requestController?.abort()
  releaseAudio()
})
</script>

<template>
  <section class="apple-preview" aria-label="Apple Music 试听">
    <div v-if="previewURL" class="apple-preview__controls">
      <audio
        ref="audio"
        :src="previewURL"
        preload="none"
        @timeupdate="updateProgress"
        @ended="handleEnded"
      />
      <PButton
        size="sm"
        variant="secondary"
        data-testid="apple-preview-toggle"
        :aria-label="isPlaying ? '暂停试听' : '播放试听'"
        @click="togglePreview"
      >
        <Pause v-if="isPlaying" :size="15" aria-hidden="true" />
        <Play v-else :size="15" aria-hidden="true" />
        {{ isPlaying ? '暂停' : '试听' }}
      </PButton>
      <progress :max="durationLimit" :value="currentTime" aria-label="试听进度" />
      <span>{{ Math.floor(currentTime) }} / {{ durationLimit }} 秒</span>
    </div>
    <div class="apple-preview__provider">
      <span v-if="previewURL">{{ preview?.attribution || '试听由 iTunes 提供' }}</span>
      <a
        data-testid="apple-music-badge"
        :href="storeURL"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="在 Apple Music 上收听"
      >
        <img :src="appleBadgeURL" width="125" height="42" alt="在 Apple Music 上收听" />
      </a>
    </div>
  </section>
</template>

<style scoped>
.apple-preview {
  display: grid;
  width: min(100%, 32rem);
  gap: 0.65rem;
  border-top: 1px solid var(--a-color-border-soft);
  border-bottom: 1px solid var(--a-color-border-soft);
  padding: 0.75rem 0;
}

.apple-preview__controls,
.apple-preview__provider {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.65rem;
}

.apple-preview__controls progress {
  min-width: 5rem;
  flex: 1;
  accent-color: var(--a-color-primary);
}

.apple-preview__controls span,
.apple-preview__provider span {
  color: var(--a-color-muted);
  font-size: 0.8rem;
  white-space: nowrap;
}

.apple-preview__provider {
  justify-content: space-between;
}

.apple-preview__provider a,
.apple-preview__provider img {
  display: block;
}

.apple-preview__provider img {
  width: 125px;
  height: auto;
}

@media (max-width: 480px) {
  .apple-preview__controls {
    flex-wrap: wrap;
  }

  .apple-preview__controls progress {
    order: 3;
    flex-basis: 100%;
  }
}
</style>
