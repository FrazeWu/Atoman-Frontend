<template>
  <div
    class="cover-upload-card a-card-sm"
    :class="{ 'is-dragging': isDragging, 'has-cover': Boolean(coverUrl) }"
    tabindex="0"
    role="region"
    aria-label="文章封面上传区域"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
    @paste="onPaste"
  >
    <div v-if="coverUrl" class="cover-preview-wrap">
      <img :src="coverUrl" alt="封面预览" class="cover-preview-image" />
      <div v-if="isDragging" class="cover-drop-overlay">
        <Upload :size="20" aria-hidden="true" />
        <span>松开更换封面</span>
      </div>
    </div>
    <div
      v-else
      class="cover-empty-state"
      role="button"
      tabindex="0"
      @click="$emit('trigger-upload')"
      @keydown.enter.prevent="$emit('trigger-upload')"
      @keydown.space.prevent="$emit('trigger-upload')"
    >
      <div v-if="isDragging" class="cover-drop-overlay">
        <Upload :size="22" aria-hidden="true" />
        <span>松开上传封面</span>
      </div>
      <template v-else>
        <div class="cover-empty-icon">
          <Image :size="22" aria-hidden="true" />
        </div>
        <strong>点击或拖拽图片至此</strong>
        <p class="a-muted">支持粘贴剪贴板图片，自动设为文章封面</p>
      </template>
    </div>

    <div class="cover-upload-actions">
      <PButton
        type="button"
        variant="secondary"
        size="sm"
        :loading="uploading"
        :disabled="uploading"
        loading-text="上传中…"
        @click="$emit('trigger-upload')"
      >
        {{ coverUrl ? '更换封面' : '上传封面' }}
      </PButton>
      <PButton
        v-if="coverUrl"
        type="button"
        variant="ghost"
        size="sm"
        :disabled="uploading"
        @click="$emit('remove-cover')"
      >
        移除封面
      </PButton>
    </div>
    <p class="cover-upload-hint a-muted">支持 JPEG、PNG、GIF、WebP，最大 5MB。</p>
    <p v-if="error" class="cover-upload-error" role="alert">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Image, Upload } from 'lucide-vue-next'
import PButton from '@/components/ui/PButton.vue'

defineProps<{
  coverUrl: string
  uploading: boolean
  error: string
}>()

const emit = defineEmits<{
  (e: 'trigger-upload'): void
  (e: 'remove-cover'): void
  (e: 'file-selected', file: File): void
}>()

const isDragging = ref(false)
let dragCounter = 0

const onDragEnter = (event: DragEvent) => {
  dragCounter++
  if (event.dataTransfer?.types?.includes('Files')) {
    isDragging.value = true
  }
}

const onDragOver = (event: DragEvent) => {
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
  isDragging.value = true
}

const onDragLeave = () => {
  dragCounter--
  if (dragCounter <= 0) {
    isDragging.value = false
    dragCounter = 0
  }
}

const onDrop = (event: DragEvent) => {
  dragCounter = 0
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) {
    emit('file-selected', file)
  }
}

const onPaste = (event: ClipboardEvent) => {
  const items = event.clipboardData?.items
  if (!items) return

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) {
        event.preventDefault()
        emit('file-selected', file)
        break
      }
    }
  }
}
</script>

<style scoped>
.cover-upload-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 0.9rem;
  transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
  outline: none;
}

.cover-upload-card.is-dragging {
  border-color: var(--a-color-primary, #2563eb) !important;
  border-style: solid;
  background-color: var(--a-color-primary-subtle, rgba(37, 99, 235, 0.04));
}

.cover-upload-card:focus-visible {
  box-shadow: 0 0 0 2px var(--a-color-primary, #2563eb);
}

.cover-preview-wrap {
  position: relative;
  overflow: hidden;
  border: var(--a-border);
  background: var(--a-color-bg);
}

.cover-preview-image {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
}

.cover-empty-state {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 0.45rem;
  padding: 1.5rem 1rem;
  border: 1px solid var(--a-border-color, #e2e8f0);
  background: var(--a-color-bg);
  cursor: pointer;
  user-select: none;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.cover-empty-state:hover {
  border-color: var(--a-color-muted, #94a3b8);
  background-color: var(--a-color-surface-hover, rgba(0, 0, 0, 0.02));
}

.cover-empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--a-color-surface, #f8fafc);
  color: var(--a-color-muted, #64748b);
  margin-bottom: 0.2rem;
}

.cover-empty-state strong {
  font-size: 0.92rem;
  font-weight: 500;
  color: var(--a-color-fg, #0f172a);
}

.cover-drop-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: var(--a-color-bg, #ffffff);
  opacity: 0.95;
  color: var(--a-color-primary, #2563eb);
  font-weight: 500;
  font-size: 0.92rem;
  z-index: 2;
  pointer-events: none;
}

.cover-empty-state .a-muted,
.cover-upload-hint {
  margin: 0;
  font-size: 0.8rem;
}

.cover-upload-actions {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.cover-upload-error {
  margin: 0;
  color: var(--a-color-danger, #ef4444);
  font-size: 0.8rem;
  font-weight: 500;
}
</style>
