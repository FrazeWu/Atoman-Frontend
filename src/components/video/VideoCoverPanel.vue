<template>
  <section class="ve-cover-section">
    <label class="ve-field-label">封面图</label>

    <div v-if="generatedCoverReady && !thumbnailUrl" class="ve-auto-cover-card">
      <img :src="generatedCoverPreview" alt="自动抽帧封面预览" class="ve-auto-cover-preview" />
      <div class="ve-auto-cover-actions">
        <PButton
          variant="secondary"
          size="sm"
          :disabled="coverUploading"
          :loading="coverUploading"
          loading-text="应用中…"
          @click="$emit('use-generated-cover')"
        >
          使用视频首帧
        </PButton>
        <span class="ve-auto-cover-tip">或手动上传封面</span>
      </div>
    </div>

    <div v-if="thumbnailUrl" class="ve-cover-preview">
      <img :src="thumbnailUrl" alt="封面" class="ve-cover-img" />
      <label class="ve-cover-reupload">
        <input type="file" accept="image/*" class="ve-file-hidden" :disabled="coverUploading" @change="onCoverFileChange" />
        {{ coverUploading ? '上传中…' : '更换封面' }}
      </label>
    </div>

    <label v-else class="ve-cover-empty" :class="{ 've-cover-empty--uploading': coverUploading }">
      <input type="file" accept="image/*" class="ve-file-hidden" :disabled="coverUploading" @change="onCoverFileChange" />
      <ImagePlus v-if="!coverUploading" :size="24" aria-hidden="true" />
      <span v-if="!coverUploading" class="ve-cover-hint">点击上传封面</span>
      <span v-else class="ve-cover-hint">上传中…</span>
    </label>
  </section>
</template>

<script setup lang="ts">
import PButton from '@/components/ui/PButton.vue'
import { ImagePlus } from 'lucide-vue-next'

defineProps<{
  generatedCoverReady: boolean
  generatedCoverPreview: string
  thumbnailUrl: string
  coverUploading: boolean
}>()

const emit = defineEmits<{
  (e: 'use-generated-cover'): void
  (e: 'cover-file-change', event: Event): void
}>()

function onCoverFileChange(event: Event) {
  emit('cover-file-change', event)
}
</script>

<style scoped>
.ve-cover-section {
  display: grid;
  gap: var(--a-space-2);
}

.ve-field-label {
  color: var(--a-color-text);
  font-size: 0.8125rem;
  font-weight: 600;
}

.ve-auto-cover-card,
.ve-auto-cover-actions {
  display: grid;
  gap: var(--a-space-2);
}

.ve-auto-cover-preview,
.ve-cover-preview,
.ve-cover-empty {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: var(--a-radius-control);
}

.ve-auto-cover-preview,
.ve-cover-img {
  display: block;
  object-fit: cover;
}

.ve-auto-cover-preview {
  border: 1px solid var(--a-color-border-soft);
}

.ve-auto-cover-tip,
.ve-cover-hint {
  color: var(--a-color-muted);
  font-size: 0.75rem;
}

.ve-cover-preview {
  position: relative;
  overflow: hidden;
  background: var(--a-color-surface-muted);
}

.ve-cover-img {
  width: 100%;
  height: 100%;
}

.ve-cover-reupload {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--a-color-text) 68%, transparent);
  color: var(--a-color-bg);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.ve-cover-preview:hover .ve-cover-reupload,
.ve-cover-reupload:focus-within {
  opacity: 1;
}

.ve-cover-empty {
  display: flex;
  min-height: 144px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--a-space-2);
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface-muted);
  color: var(--a-color-muted);
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease;
}

.ve-cover-empty:hover:not(.ve-cover-empty--uploading),
.ve-cover-empty:focus-within {
  border-color: var(--a-color-text-secondary);
  background: var(--a-color-surface);
  color: var(--a-color-text);
}

.ve-cover-empty--uploading {
  cursor: default;
  opacity: 0.6;
}

.ve-file-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
