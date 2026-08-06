<template>
  <PSurface class="music-tracks" tone="soft" :layer="0">
    <div class="music-tracks__header">
      <div>
        <h3 class="music-tracks__title">曲目</h3>
        <p class="music-tracks__hint">单行可拖拽排序，支持编辑标题、歌词与音频文件。</p>
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
        class="music-tracks__item-wrapper"
        :class="{
          'music-tracks__item-wrapper--dragging': draggedIndex === index,
          'music-tracks__item-wrapper--drag-over': dragOverIndex === index,
          'music-tracks__item-wrapper--removed': track.removed,
        }"
        draggable="true"
        @dragstart="onDragStart(index, $event)"
        @dragover.prevent="onDragOver(index)"
        @drop.prevent="onDrop(index)"
        @dragend="onDragEnd"
      >
        <div class="music-tracks__row">
          <div class="music-tracks__drag-handle" title="按住拖拽排序">
            <GripVertical :size="16" aria-hidden="true" />
          </div>

          <span class="music-tracks__index">{{ (index + 1).toString().padStart(2, '0') }}</span>

          <div class="music-tracks__title-cell">
            <PInput
              :model-value="track.title"
              placeholder="输入曲目名称"
              :disabled="track.removed"
              @update:model-value="(value) => updateTrack(track.id, 'title', value)"
            />
          </div>

          <div class="music-tracks__row-actions">
            <!-- Audio upload button -->
            <input
              :ref="(node) => setFileInput(track.id, node)"
              class="music-tracks__audio-input"
              type="file"
              accept="audio/*"
              @change="(event) => onFileChange(track.id, event)"
            />

            <PButton
              type="button"
              variant="ghost"
              size="sm"
              class="music-tracks__action-btn"
              :class="{ 'music-tracks__action-btn--active': track.file || track.audioUrl }"
              :disabled="track.removed"
              :title="audioLabel(track)"
              @click="triggerAudioInput(track.id)"
            >
              <Music :size="14" />
              <span class="btn-text">{{ track.file ? '已选音频' : (track.audioUrl ? '已有音频' : '音频') }}</span>
            </PButton>

            <!-- Lyrics toggle button -->
            <PButton
              type="button"
              variant="ghost"
              size="sm"
              class="music-tracks__action-btn"
              :class="{ 'music-tracks__action-btn--active': Boolean(track.lyrics?.trim()) || expandedLyrics[track.id] }"
              :disabled="track.removed"
              :title="track.lyrics?.trim() ? '包含歌词（点击编辑）' : '添加歌词'"
              @click="toggleLyrics(track.id)"
            >
              <FileText :size="14" />
              <span class="btn-text">歌词</span>
            </PButton>

            <!-- Move Up / Move Down -->
            <button
              type="button"
              class="music-tracks__icon-btn"
              :disabled="track.removed || index === 0"
              title="上移"
              @click="moveTrack(index, -1)"
            >
              <ChevronUp :size="14" />
            </button>
            <button
              type="button"
              class="music-tracks__icon-btn"
              :disabled="track.removed || index === tracks.length - 1"
              title="下移"
              @click="moveTrack(index, 1)"
            >
              <ChevronDown :size="14" />
            </button>

            <!-- Remove / Restore -->
            <button
              v-if="!track.removed"
              type="button"
              class="music-tracks__icon-btn music-tracks__icon-btn--danger"
              title="移除曲目"
              @click="removeTrack(track.id)"
            >
              <Trash2 :size="14" />
            </button>
            <button
              v-else
              type="button"
              class="music-tracks__icon-btn"
              title="撤销删除"
              @click="restoreTrack(track.id)"
            >
              <RotateCcw :size="14" />
            </button>
          </div>
        </div>

        <!-- Expanded Lyrics Editor Drawer -->
        <div v-if="expandedLyrics[track.id] && !track.removed" class="music-tracks__lyrics-drawer">
          <div class="music-tracks__lyrics-header">
            <span class="lyrics-title">编辑歌词 - {{ track.title || `曲目 ${index + 1}` }}</span>
            <button type="button" class="lyrics-close-btn" @click="toggleLyrics(track.id)">
              <X :size="14" />
            </button>
          </div>
          <PTextarea
            :model-value="track.lyrics ?? ''"
            placeholder="输入或粘贴歌词（支持 LRC 格式或纯文本）"
            :rows="5"
            @update:model-value="(value) => updateTrack(track.id, 'lyrics', value)"
          />
        </div>
      </div>
    </div>
  </PSurface>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  GripVertical,
  FileText,
  Music,
  Trash2,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  X,
} from 'lucide-vue-next'
import PSurface from '@/components/ui/PSurface.vue'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import type { MusicTrackDraft } from './types'

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
const expandedLyrics = ref<Record<string, boolean>>({})

// Drag & Drop State
const draggedIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

function toggleLyrics(id: string) {
  expandedLyrics.value[id] = !expandedLyrics.value[id]
}

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
  // Update track numbers
  tracks.value = next.map((t, idx) => ({ ...t, trackNumber: String(idx + 1) }))
}

function onDragStart(index: number, event: DragEvent) {
  draggedIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }
}

function onDragOver(index: number) {
  if (draggedIndex.value !== null && draggedIndex.value !== index) {
    dragOverIndex.value = index
  }
}

function onDrop(index: number) {
  if (draggedIndex.value !== null && draggedIndex.value !== index) {
    const next = [...tracks.value]
    const [draggedItem] = next.splice(draggedIndex.value, 1)
    next.splice(index, 0, draggedItem)
    tracks.value = next.map((t, idx) => ({ ...t, trackNumber: String(idx + 1) }))
  }
  onDragEnd()
}

function onDragEnd() {
  draggedIndex.value = null
  dragOverIndex.value = null
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
  const newTrack: MusicTrackDraft = {
    id: `track-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: '',
    trackNumber: String(tracks.value.length + 1),
    lyrics: '',
    audioUrl: '',
    audioAsset: null,
    file: null,
    isExisting: false,
  }
  tracks.value = [...tracks.value, newTrack]
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

function restoreTrack(id: string) {
  tracks.value = tracks.value.map((track) =>
    track.id === id ? { ...track, removed: false } : track,
  )
}

function audioLabel(track: MusicTrackDraft) {
  if (track.file) return `已选文件: ${track.file.name}`
  if (track.audioUrl) return '包含已有音频'
  return '未上传音频'
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
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.music-tracks__item-wrapper {
  border: 1px solid var(--a-color-border-soft);
  border-radius: 6px;
  background: var(--a-color-bg);
  transition: border-color 0.2s, background-color 0.2s, opacity 0.2s;
}

.music-tracks__item-wrapper--drag-over {
  border-color: var(--a-color-accent-primary, #3b82f6);
  background-color: var(--a-color-bg-subtle, rgba(59, 130, 246, 0.05));
}

.music-tracks__item-wrapper--dragging {
  opacity: 0.4;
}

.music-tracks__item-wrapper--removed {
  opacity: 0.5;
}

.music-tracks__row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.6rem;
  min-height: 44px;
}

.music-tracks__drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-muted);
  cursor: grab;
  padding: 0.25rem;
  user-select: none;
}

.music-tracks__drag-handle:active {
  cursor: grabbing;
}

.music-tracks__index {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--a-color-muted);
  min-width: 1.5rem;
  text-align: center;
}

.music-tracks__title-cell {
  flex: 1;
  min-width: 120px;
}

.music-tracks__row-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
}

.music-tracks__audio-input {
  display: none;
}

.music-tracks__action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8rem;
  padding: 0.25rem 0.5rem !important;
  color: var(--a-color-muted);
}

.music-tracks__action-btn--active {
  color: var(--a-color-accent-primary, #2563eb) !important;
  font-weight: 600;
}

.btn-text {
  font-size: 0.78rem;
}

.music-tracks__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--a-color-muted);
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.music-tracks__icon-btn:hover:not(:disabled) {
  background: var(--a-color-bg-subtle, rgba(0, 0, 0, 0.05));
  color: var(--a-color-fg);
}

.music-tracks__icon-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.music-tracks__icon-btn--danger:hover:not(:disabled) {
  color: var(--a-color-accent-destructive, #ef4444);
  background: rgba(239, 68, 68, 0.1);
}

.music-tracks__lyrics-drawer {
  padding: 0.75rem 0.75rem 0.75rem 2.5rem;
  border-top: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg-subtle, rgba(0, 0, 0, 0.02));
}

.music-tracks__lyrics-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.4rem;
}

.lyrics-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--a-color-muted);
}

.lyrics-close-btn {
  border: none;
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
  padding: 0.2rem;
  display: flex;
}

@media (max-width: 640px) {
  .music-tracks__row {
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .music-tracks__title-cell {
    flex: 1 1 100%;
    order: 3;
    min-width: 0;
  }
  .music-tracks__row-actions {
    margin-left: auto;
    order: 2;
  }
  .btn-text {
    display: none;
  }
}
</style>
