<template>
  <div class="music-lyrics-line" :class="{ 'is-active': active }">
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
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
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
}>(), {
  annotations: () => [],
  active: false,
  bilingual: false,
  canSelect: true,
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
}>()

const textElement = ref<HTMLElement | null>(null)

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
</script>

<style scoped>
.music-lyrics-line {
  padding: 0.9rem 0;
  opacity: 0.32; /* 调低未激活歌词的透明度，增大对比度 */
  filter: blur(0.5px); /* 可选：给不活跃行添加极其微弱的模糊 */
  transform: scale(0.98);
  transform-origin: left center;
  transition: all 0.38s cubic-bezier(0.25, 1, 0.5, 1);
}

.music-lyrics-line.is-active {
  opacity: 1;
  filter: blur(0);
  transform: scale(1.03) translateX(0.5rem);
  text-shadow: 0 0 12px rgba(255, 255, 255, 0.15);
}

.music-lyrics-line__text {
  margin: 0;
  color: var(--a-color-text);
  font-size: clamp(1.25rem, 2vw, 2rem);
  font-weight: 900;
  line-height: 1.3;
  white-space: pre-wrap;
}

.music-lyrics-line__translation {
  margin: 0.4rem 0 0;
  color: var(--a-color-muted);
  font-size: 0.95rem;
  line-height: 1.5;
  white-space: pre-wrap;
}

.music-lyrics-line__highlight {
  display: inline;
  border: 0;
  padding: 0 0.16rem;
  background: color-mix(in srgb, #ffe27a 58%, transparent);
  color: inherit;
  cursor: pointer;
  font: inherit;
  line-height: inherit;
}

.music-lyrics-line__highlight:hover {
  background: color-mix(in srgb, #ffd84c 72%, transparent);
}
</style>
