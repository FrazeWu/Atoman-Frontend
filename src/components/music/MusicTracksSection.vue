<template>
  <PSurface class="music-tracks" tone="soft" :layer="0">
    <div class="music-tracks__header">
      <div>
        <h3 class="music-tracks__title">曲目</h3>
        <p class="music-tracks__hint">支持标题、歌词、音频替换、顺序调整和移除。</p>
      </div>
      <div class="music-tracks__header-actions">
        <PButton type="button" variant="ghost" @click="addTrack">添加曲目</PButton>
        <PButton v-if="tracks.length" type="button" variant="ghost" @click="clearTracks">清空</PButton>
      </div>
    </div>

    <PEmpty v-if="!tracks.length" description="尚未添加曲目" />

    <div v-else class="music-tracks__list">
      <div
        v-for="(track, index) in tracks"
        :key="track.id"
        class="music-tracks__item"
        :class="{ 'music-tracks__item--removed': track.removed }"
      >
        <div class="music-tracks__meta">
          <span class="music-tracks__index">{{ index + 1 }}</span>
          <span class="music-tracks__kind">
            {{ track.removed ? '待删除' : (track.isExisting ? '已存在' : '新增') }}
          </span>
        </div>

        <div class="music-tracks__fields">
          <PInput :model-value="track.title" label="曲目名" placeholder="输入曲目名" @update:model-value="(value) => updateTrack(track.id, 'title', value)" />
          <PInput :model-value="track.trackNumber" label="曲序" placeholder="1" @update:model-value="(value) => updateTrack(track.id, 'trackNumber', value)" />
        </div>

        <PTextarea
          :model-value="track.lyrics ?? ''"
          label="歌词"
          placeholder="可选：输入歌词"
          :rows="4"
          @update:model-value="(value) => updateTrack(track.id, 'lyrics', value)"
        />

        <div class="music-tracks__audio">
          <input
            :ref="(node) => setFileInput(track.id, node)"
            class="music-tracks__audio-input"
            type="file"
            accept="audio/*"
            @change="(event) => onFileChange(track.id, event)"
          />
          <div class="music-tracks__audio-meta">
            <span class="music-tracks__audio-label">{{ audioLabel(track) }}</span>
          </div>
          <div class="music-tracks__audio-actions">
            <PButton type="button" variant="ghost" @click="triggerAudioInput(track.id)">
              {{ track.audioUrl || track.file ? '替换音频' : '上传音频' }}
            </PButton>
            <PButton v-if="track.audioUrl || track.file" type="button" variant="ghost" @click="clearAudio(track.id)">移除音频</PButton>
          </div>
        </div>

        <div class="music-tracks__actions">
          <PClip type="button" :disabled="track.removed || index === 0" @click="moveTrack(index, -1)">上移</PClip>
          <PClip type="button" :disabled="track.removed || index === tracks.length - 1" @click="moveTrack(index, 1)">下移</PClip>
          <PReject v-if="!track.removed" type="button" @click="removeTrack(track.id)">移除</PReject>
          <PButton v-else type="button" variant="ghost" @click="restoreTrack(track.id)">撤销删除</PButton>
        </div>
      </div>
    </div>
  </PSurface>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PSurface from '@/components/ui/PSurface.vue'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import PClip from '@/components/ui/PClip.vue'
import PReject from '@/components/ui/PReject.vue'
import type { MusicTrackDraft } from './types'
import { ref } from 'vue'

const props = defineProps<{
  tracks: MusicTrackDraft[]
}>()

const emit = defineEmits<{
  (e: 'update:tracks', value: MusicTrackDraft[]): void
}>()

const tracks = computed({
  get: () => props.tracks,
  set: (value) => emit('update:tracks', value),
})

const fileInputs = ref<Record<string, HTMLInputElement | null>>({})

function updateTrack(id: string, field: 'title' | 'trackNumber' | 'lyrics', value: string) {
  tracks.value = tracks.value.map((track) =>
    track.id === id ? { ...track, [field]: value } : track,
  )
}

function moveTrack(index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= tracks.value.length) return
  const next = [...tracks.value]
  const [current] = next.splice(index, 1)
  next.splice(target, 0, current)
  tracks.value = next
}

function removeTrack(id: string) {
  tracks.value = tracks.value.flatMap((track) => {
    if (track.id !== id) return [track]
    if (!track.isExisting) return []
    return [{ ...track, removed: true }]
  })
}

function clearTracks() {
  tracks.value = tracks.value.flatMap((track) => (
    track.isExisting ? [{ ...track, removed: true }] : []
  ))
}

function addTrack() {
  tracks.value = [
    ...tracks.value,
    {
      id: `track-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: '',
      trackNumber: String(tracks.value.length + 1),
      lyrics: '',
      audioUrl: '',
      audioAsset: null,
      file: null,
      isExisting: false,
    },
  ]
}

function setFileInput(id: string, node: unknown) {
  fileInputs.value[id] = node instanceof HTMLInputElement ? node : null
}

function triggerAudioInput(id: string) {
  fileInputs.value[id]?.click()
}

function onFileChange(id: string, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  tracks.value = tracks.value.map((track) =>
    track.id === id ? { ...track, file, audioAsset: null } : track,
  )
  input.value = ''
}

function clearAudio(id: string) {
  tracks.value = tracks.value.map((track) =>
    track.id === id ? { ...track, file: null, audioUrl: '', audioAsset: null } : track,
  )
}

function restoreTrack(id: string) {
  tracks.value = tracks.value.map((track) =>
    track.id === id ? { ...track, removed: false } : track,
  )
}

function audioLabel(track: MusicTrackDraft) {
  if (track.file) return track.file.name
  if (track.audioUrl) return '已存在音频'
  return '尚未上传音频'
}
</script>

<style scoped>
.music-tracks {
  padding: 1rem;
}

.music-tracks__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.music-tracks__header-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.music-tracks__title {
  margin: 0;
  font-size: 1rem;
}

.music-tracks__hint {
  margin: 0.25rem 0 0;
  color: var(--a-color-muted-soft);
  font-size: 0.875rem;
}

.music-tracks__list {
  display: grid;
  gap: 0.75rem;
}

.music-tracks__item {
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
  background: var(--a-color-bg);
  padding: 0.875rem;
  display: grid;
  gap: 0.75rem;
}

.music-tracks__item--removed {
  opacity: 0.62;
}

.music-tracks__meta {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.music-tracks__index,
.music-tracks__kind {
  font-size: 0.75rem;
  color: var(--a-color-muted-soft);
}

.music-tracks__fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 10rem;
  gap: 0.75rem;
}

.music-tracks__actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.music-tracks__audio {
  display: grid;
  gap: 0.5rem;
}

.music-tracks__audio-input {
  display: none;
}

.music-tracks__audio-meta {
  font-size: 0.8rem;
  color: var(--a-color-muted-soft);
}

.music-tracks__audio-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

:deep(.p-clip),
:deep(.p-reject) {
  border-radius: 4px !important;
}

:deep(.p-clip:not(:disabled):hover),
:deep(.p-reject:not(:disabled):hover) {
  transform: translateY(1px);
}

@media (max-width: 720px) {
  .music-tracks__fields {
    grid-template-columns: 1fr;
  }
}
</style>
