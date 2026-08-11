<template>
  <div
    class="music-lyrics-line"
    :class="{
      'is-active': active,
      'is-annotation-mode': annotationMode,
      'has-annotations': activeAnnotations.length > 0,
    }"
  >
    <div v-if="line.time_ms != null" class="music-lyrics-line__time">
      {{ formatTime(line.time_ms) }}
    </div>
    <div class="music-lyrics-line__content">
      <p
        ref="textElement"
        class="music-lyrics-line__text"
        @mouseup="handleMouseUp"
      >
        <template v-for="segment in segments" :key="segment.key">
          <span v-if="!segment.annotationIds.length">{{ segment.text }}</span>
          <button
            v-else
            type="button"
            class="music-lyrics-line__highlight"
            @click="emit('open-annotations', { line, annotationIds: segment.annotationIds })"
          >
            {{ segment.text }}
          </button>
        </template>
      </p>
      <p v-if="bilingual && line.translation" class="music-lyrics-line__translation">
        {{ line.translation }}
      </p>
    </div>
    <div class="music-lyrics-line__actions">
      <button
        v-if="activeAnnotations.length"
        type="button"
        class="music-lyrics-line__annotation-action"
        :aria-label="`查看这句歌词的 ${activeAnnotations.length} 条注释`"
        :title="`查看 ${activeAnnotations.length} 条注释`"
        @click="openLineAnnotations"
      >
        <MessageSquareText :size="17" aria-hidden="true" />
        <span>{{ activeAnnotations.length }}</span>
      </button>
      <button
        v-if="annotationMode && canAnnotate"
        type="button"
        class="music-lyrics-line__annotation-action music-lyrics-line__annotation-action--create"
        aria-label="注释这句歌词"
        title="注释这句歌词"
        @click="emit('annotate-line', line)"
      >
        <SquarePen :size="17" aria-hidden="true" />
        <span>注释</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { MessageSquareText, SquarePen } from 'lucide-vue-next'
import type { MusicLyricsAnnotation, MusicSongLyricsLine } from '@/api/musicV1'

type HighlightSegment = {
  key: string
  text: string
  annotationIds: string[]
}

const props = withDefaults(defineProps<{
  line: MusicSongLyricsLine
  annotations?: MusicLyricsAnnotation[]
  active?: boolean
  bilingual?: boolean
  canSelect?: boolean
  canAnnotate?: boolean
  annotationMode?: boolean
}>(), {
  annotations: () => [],
  active: false,
  bilingual: false,
  canSelect: true,
  canAnnotate: false,
  annotationMode: false,
})

const emit = defineEmits<{
  'select-text': [payload: {
    line: MusicSongLyricsLine
    selectedText: string
    startOffset: number
    endOffset: number
  }]
  'open-annotations': [payload: {
    line: MusicSongLyricsLine
    annotationIds: string[]
  }]
  'annotate-line': [line: MusicSongLyricsLine]
}>()

const textElement = ref<HTMLElement | null>(null)
const activeAnnotations = computed(() => props.annotations.filter((annotation) => annotation.status === 'active'))

const segments = computed<HighlightSegment[]>(() => {
  const text = props.line.text
  if (!text.length) return []

  const points = new Set([0, text.length])

  for (const annotation of props.annotations) {
    if (annotation.status !== 'active') continue
    const start = Math.max(0, Math.min(text.length, annotation.start_offset))
    const end = Math.max(start, Math.min(text.length, annotation.end_offset))
    if (end <= start) continue
    points.add(start)
    points.add(end)
  }

  const sortedPoints = [...points].sort((left, right) => left - right)
  const result: HighlightSegment[] = []

  for (let index = 0; index < sortedPoints.length - 1; index += 1) {
    const start = sortedPoints[index]
    const end = sortedPoints[index + 1]
    const segmentText = text.slice(start, end)
    if (!segmentText) continue

    const annotationIds = props.annotations
      .filter((annotation) => (
        annotation.status === 'active'
        && annotation.start_offset <= start
        && annotation.end_offset >= end
      ))
      .map((annotation) => annotation.id)

    result.push({
      key: `${start}-${end}-${annotationIds.join('.') || 'plain'}`,
      text: segmentText,
      annotationIds,
    })
  }

  return result
})

function handleMouseUp() {
  if (!props.canSelect) return
  const selection = window.getSelection()
  const root = textElement.value
  if (!selection || !root || selection.rangeCount === 0 || selection.isCollapsed) return

  const range = selection.getRangeAt(0)
  if (!root.contains(range.commonAncestorContainer)) return

  const startRange = document.createRange()
  startRange.selectNodeContents(root)
  startRange.setEnd(range.startContainer, range.startOffset)

  const endRange = document.createRange()
  endRange.selectNodeContents(root)
  endRange.setEnd(range.endContainer, range.endOffset)

  const selectedText = selection.toString()
  const startOffset = startRange.toString().length
  const endOffset = endRange.toString().length

  if (!selectedText.trim() || endOffset <= startOffset) return

  emit('select-text', {
    line: props.line,
    selectedText,
    startOffset,
    endOffset,
  })
}

function openLineAnnotations() {
  emit('open-annotations', {
    line: props.line,
    annotationIds: activeAnnotations.value.map((annotation) => annotation.id),
  })
}

function formatTime(timeMs: number | null | undefined): string {
  if (timeMs == null) return ''
  const totalSeconds = Math.floor(timeMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}
</script>

<style scoped>
.music-lyrics-line {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  text-align: left;
  opacity: 0.38;
  transform: scale(0.98);
  transform-origin: left center;
  transition: opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1),
              transform 0.35s cubic-bezier(0.16, 1, 0.3, 1),
              color 0.25s ease;
  padding: 0.95rem 0;
}

.music-lyrics-line:hover,
.music-lyrics-line:focus-within,
.music-lyrics-line.is-annotation-mode,
.music-lyrics-line.has-annotations {
  opacity: 0.78;
  transform: scale(1);
}

.music-lyrics-line.is-active {
  opacity: 1;
  transform: scale(1.02);
  color: var(--a-color-text);
}

.music-lyrics-line.is-active .music-lyrics-line__text {
  font-weight: 700;
  text-shadow: 0 0 20px rgba(255, 255, 255, 0.15);
}

.music-lyrics-line.is-active .music-lyrics-line__translation {
  color: var(--a-color-text);
  opacity: 0.88;
  font-weight: 500;
}

.music-lyrics-line__time {
  font-family: var(--a-font-mono, monospace);
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  color: var(--a-color-muted);
  opacity: 0.6;
  width: 42px;
  flex-shrink: 0;
  text-align: left;
  margin-top: 0.55rem;
}

.music-lyrics-line__content {
  min-width: 0;
  flex: 1;
}

.music-lyrics-line__text {
  margin: 0;
  color: inherit;
  font-size: 1.55rem;
  font-weight: 400;
  line-height: 1.35;
  white-space: pre-wrap;
  transition: font-weight 0.2s ease, text-shadow 0.3s ease;
}

.music-lyrics-line__translation {
  margin: 0.45rem 0 0;
  color: var(--a-color-muted);
  font-size: 0.95rem;
  line-height: 1.5;
  white-space: pre-wrap;
  transition: opacity 0.25s ease, color 0.25s ease;
}

.music-lyrics-line__highlight {
  display: inline;
  border: 0;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  background: color-mix(in srgb, var(--a-color-primary, #3b82f6) 20%, transparent);
  border-bottom: 2px solid var(--a-color-primary, #3b82f6);
  color: inherit;
  cursor: pointer;
  font: inherit;
  line-height: inherit;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.music-lyrics-line__highlight:hover {
  background: color-mix(in srgb, var(--a-color-primary, #3b82f6) 36%, transparent);
  border-bottom-color: #60a5fa;
}

.music-lyrics-line__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  min-width: 5rem;
}

.music-lyrics-line__annotation-action {
  min-width: 36px;
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 9999px;
  padding: 0.4rem 0.75rem;
  background: var(--a-color-bg);
  color: var(--a-color-muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease, transform 0.15s ease;
}

.music-lyrics-line__annotation-action:hover,
.music-lyrics-line__annotation-action:focus-visible {
  border-color: var(--a-color-text);
  color: var(--a-color-text);
  transform: translateY(-1px);
}

.music-lyrics-line__annotation-action--create {
  color: var(--a-color-text);
}

@media (max-width: 900px) {
  .music-lyrics-line {
    gap: 0.75rem;
  }

  .music-lyrics-line__time {
    display: none;
  }

  .music-lyrics-line__text {
    font-size: 1.25rem;
  }

  .music-lyrics-line__actions {
    min-width: 36px;
    flex-direction: column;
  }
}

@media (prefers-reduced-motion: reduce) {
  .music-lyrics-line {
    transition: none;
  }
}
</style>
