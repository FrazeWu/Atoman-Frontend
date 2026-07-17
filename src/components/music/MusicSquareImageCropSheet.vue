<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import PButton from '@/components/ui/PButton.vue'
import PSheet from '@/components/ui/PSheet.vue'

const props = defineProps<{
  show: boolean
  sourceFile?: File | null
  sourceUrl?: string
  title?: string
}>()

const emit = defineEmits<{
  confirm: [file: File]
  cancel: []
}>()

const VIEWPORT_SIZE = 320
const MIN_ZOOM = 1
const MAX_ZOOM = 3

const resolvedSourceUrl = ref('')
const resolvedObjectUrl = ref('')
const loading = ref(false)
const loadErrorMessage = ref('')
const naturalSize = ref({ width: 0, height: 0 })
const zoom = ref(1)
const offset = ref({ x: 0, y: 0 })
const imageRef = ref<HTMLImageElement | null>(null)
const dragState = ref<{
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
} | null>(null)

const mimeType = computed(() => props.sourceFile?.type || 'image/png')
const fileName = computed(() => {
  const rawName = props.sourceFile?.name?.trim() || 'cropped-image.png'
  if (/\.(png|jpg|jpeg|webp)$/i.test(rawName)) return rawName
  return `${rawName}.png`
})

const baseScale = computed(() => {
  const { width, height } = naturalSize.value
  if (!width || !height) return 1
  return Math.max(VIEWPORT_SIZE / width, VIEWPORT_SIZE / height)
})

const displayScale = computed(() => baseScale.value * zoom.value)
const displaySize = computed(() => ({
  width: naturalSize.value.width * displayScale.value,
  height: naturalSize.value.height * displayScale.value,
}))
const isImageReady = computed(() => {
  return !!resolvedSourceUrl.value && naturalSize.value.width > 0 && naturalSize.value.height > 0
})

const imageStyle = computed(() => ({
  width: `${displaySize.value.width}px`,
  height: `${displaySize.value.height}px`,
  transform: `translate(calc(-50% + ${offset.value.x}px), calc(-50% + ${offset.value.y}px))`,
}))

function revokeResolvedUrl() {
  if (resolvedObjectUrl.value) {
    URL.revokeObjectURL(resolvedObjectUrl.value)
    resolvedObjectUrl.value = ''
  }
}

function clampOffset(nextOffset: { x: number; y: number }) {
  const maxX = Math.max(0, (displaySize.value.width - VIEWPORT_SIZE) / 2)
  const maxY = Math.max(0, (displaySize.value.height - VIEWPORT_SIZE) / 2)

  return {
    x: Math.min(maxX, Math.max(-maxX, nextOffset.x)),
    y: Math.min(maxY, Math.max(-maxY, nextOffset.y)),
  }
}

function resetTransform() {
  zoom.value = 1
  offset.value = { x: 0, y: 0 }
}

async function resolveSource() {
  revokeResolvedUrl()
  resolvedSourceUrl.value = ''
  loadErrorMessage.value = ''
  naturalSize.value = { width: 0, height: 0 }
  resetTransform()

  if (!props.show) return

  try {
    loading.value = true

    if (props.sourceFile) {
      resolvedObjectUrl.value = URL.createObjectURL(props.sourceFile)
      resolvedSourceUrl.value = resolvedObjectUrl.value
      return
    }

    if (props.sourceUrl?.trim()) {
      const response = await fetch(props.sourceUrl)
      if (!response.ok) throw new Error('图片加载失败')
      const blob = await response.blob()
      resolvedObjectUrl.value = URL.createObjectURL(blob)
      resolvedSourceUrl.value = resolvedObjectUrl.value
      return
    }
  } catch (error) {
    loadErrorMessage.value = error instanceof Error ? error.message : '图片加载失败'
  } finally {
    loading.value = false
  }
}

function onImageLoad() {
  const image = imageRef.value
  if (!image) return
  naturalSize.value = {
    width: image.naturalWidth,
    height: image.naturalHeight,
  }
  offset.value = clampOffset(offset.value)
}

function onZoomInput(event: Event) {
  const target = event.target as HTMLInputElement
  zoom.value = Number(target.value)
  offset.value = clampOffset(offset.value)
}

function onPointerDown(event: PointerEvent) {
  if (!naturalSize.value.width || !naturalSize.value.height) return
  dragState.value = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: offset.value.x,
    originY: offset.value.y,
  }
  ;(event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  if (!dragState.value || dragState.value.pointerId !== event.pointerId) return

  const deltaX = event.clientX - dragState.value.startX
  const deltaY = event.clientY - dragState.value.startY
  offset.value = clampOffset({
    x: dragState.value.originX + deltaX,
    y: dragState.value.originY + deltaY,
  })
}

function onPointerEnd(event: PointerEvent) {
  if (!dragState.value || dragState.value.pointerId !== event.pointerId) return
  ;(event.currentTarget as HTMLElement | null)?.releasePointerCapture?.(event.pointerId)
  dragState.value = null
}

async function emitConfirm() {
  if (!isImageReady.value) return
  const image = imageRef.value
  if (!image || !naturalSize.value.width || !naturalSize.value.height) return

  const scale = displayScale.value
  const cropSize = VIEWPORT_SIZE / scale
  const sourceX = (naturalSize.value.width / 2) - (cropSize / 2) - (offset.value.x / scale)
  const sourceY = (naturalSize.value.height / 2) - (cropSize / 2) - (offset.value.y / scale)
  const outputSize = 1024

  const canvas = document.createElement('canvas')
  canvas.width = outputSize
  canvas.height = outputSize

  const context = canvas.getContext('2d')
  if (!context) throw new Error('裁剪失败')

  context.drawImage(
    image,
    sourceX,
    sourceY,
    cropSize,
    cropSize,
    0,
    0,
    outputSize,
    outputSize,
  )

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mimeType.value || 'image/png', 0.92)
  })

  if (!blob) throw new Error('裁剪失败')

  emit('confirm', new File([blob], fileName.value, { type: blob.type || mimeType.value }))
}

watch(
  () => [props.show, props.sourceFile, props.sourceUrl] as const,
  () => {
    void resolveSource()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  revokeResolvedUrl()
})
</script>

<template>
  <PSheet
    :show="show"
    :title="title || '裁剪图片'"
    width="min(100%, 560px)"
    close-type="header"
    @close="$emit('cancel')"
  >
    <div class="crop-sheet" data-testid="music-square-crop-sheet">
      <div class="crop-sheet__copy">
        <p class="crop-sheet__title">固定 1:1 裁剪</p>
        <p class="crop-sheet__hint">拖动图片调整位置，再用滑杆缩放。</p>
      </div>

      <div
        class="crop-sheet__viewport"
        data-testid="music-square-crop-viewport"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerEnd"
        @pointercancel="onPointerEnd"
      >
        <img
          v-if="resolvedSourceUrl"
          ref="imageRef"
          :src="resolvedSourceUrl"
          alt="裁剪预览"
          class="crop-sheet__image"
          :style="imageStyle"
          draggable="false"
          @load="onImageLoad"
        />
        <div class="crop-sheet__frame" aria-hidden="true" />
        <div v-if="loading" class="crop-sheet__state">图片加载中…</div>
        <div v-else-if="loadErrorMessage" class="crop-sheet__state crop-sheet__state--error">{{ loadErrorMessage }}</div>
      </div>

      <label class="crop-sheet__zoom">
        <span>缩放</span>
        <input
          data-testid="music-square-crop-zoom"
          type="range"
          :min="MIN_ZOOM"
          :max="MAX_ZOOM"
          step="0.01"
          :value="zoom"
          @input="onZoomInput"
        />
      </label>

      <div class="crop-sheet__actions">
        <PButton type="button" variant="secondary" data-testid="music-square-crop-cancel" @click="$emit('cancel')">
          取消
        </PButton>
        <PButton
          type="button"
          data-testid="music-square-crop-confirm"
          :disabled="loading || !!loadErrorMessage || !isImageReady"
          @click="emitConfirm"
        >
          确认
        </PButton>
      </div>
    </div>
  </PSheet>
</template>

<style scoped>
.crop-sheet {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
}

.crop-sheet__copy {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.crop-sheet__title,
.crop-sheet__hint {
  margin: 0;
}

.crop-sheet__title {
  font-size: 0.95rem;
  font-weight: 600;
}

.crop-sheet__hint {
  color: var(--a-color-text-secondary);
  font-size: 0.875rem;
}

.crop-sheet__viewport {
  position: relative;
  width: min(100%, 320px);
  aspect-ratio: 1 / 1;
  overflow: hidden;
  margin: 0 auto;
  background:
    linear-gradient(45deg, rgba(15, 23, 42, 0.06) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(15, 23, 42, 0.06) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(15, 23, 42, 0.06) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(15, 23, 42, 0.06) 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0;
  border-radius: 1rem;
  touch-action: none;
  user-select: none;
}

.crop-sheet__image {
  position: absolute;
  top: 50%;
  left: 50%;
  max-width: none;
  max-height: none;
  transform-origin: center center;
  pointer-events: none;
}

.crop-sheet__frame {
  position: absolute;
  inset: 0;
  border: 1px solid rgba(15, 23, 42, 0.18);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.65);
  border-radius: 1rem;
  pointer-events: none;
}

.crop-sheet__state {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  text-align: center;
  background: rgba(255, 255, 255, 0.8);
  color: var(--a-color-text-secondary);
}

.crop-sheet__state--error {
  color: var(--a-color-danger, #b42318);
}

.crop-sheet__zoom {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.crop-sheet__zoom span {
  font-size: 0.875rem;
  font-weight: 600;
}

.crop-sheet__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}
</style>
