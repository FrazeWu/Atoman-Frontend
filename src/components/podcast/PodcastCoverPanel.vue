<template>
  <section class="pe-cover-section">
    <label class="pe-field-label">单集封面（可选）</label>

    <div v-if="effectiveCoverURL" class="pe-cover-preview">
      <img :src="effectiveCoverURL" :alt="effectiveCoverLabel || '单集封面'" class="pe-cover-img" />
      <span v-if="effectiveCoverLabel" class="pe-cover-source">{{ effectiveCoverLabel }}</span>
      <label class="pe-cover-reupload">
        <input type="file" accept="image/*" class="pe-file-hidden" :disabled="coverUploading" @change="onCoverFileChange" />
        {{ coverUploading ? '上传中…' : '更换封面' }}
      </label>
    </div>

    <label v-else class="pe-cover-empty" :class="{ 'pe-cover-empty--uploading': coverUploading }">
      <input type="file" accept="image/*" class="pe-file-hidden" :disabled="coverUploading" @change="onCoverFileChange" />
      <ImagePlus v-if="!coverUploading" :size="24" aria-hidden="true" />
      <span v-if="!coverUploading" class="pe-cover-hint">点击上传封面</span>
      <span v-else class="pe-cover-hint">上传中…</span>
    </label>

    <p class="pe-cover-sub">不填则优先显示合集封面，其次显示频道封面</p>
  </section>
</template>

<script setup lang="ts">
import { ImagePlus } from 'lucide-vue-next'

defineProps<{
  effectiveCoverURL: string
  effectiveCoverLabel: string
  coverUploading: boolean
}>()

const emit = defineEmits<{
  (e: 'cover-file-change', event: Event): void
}>()

function onCoverFileChange(event: Event) {
  emit('cover-file-change', event)
}
</script>

<style scoped>
.pe-cover-section {
  display: grid;
  gap: var(--a-space-2);
}

.pe-field-label {
  color: var(--a-color-text);
  font-size: 0.8125rem;
  font-weight: 600;
}

.pe-cover-preview,
.pe-cover-empty {
  width: 100%;
  aspect-ratio: 1;
  border-radius: var(--a-radius-control);
}

.pe-cover-preview {
  position: relative;
  overflow: hidden;
  background: var(--a-color-surface-muted);
}

.pe-cover-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pe-cover-source {
  position: absolute;
  left: var(--a-space-2);
  bottom: var(--a-space-2);
  padding: 3px 7px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--a-color-text) 68%, transparent);
  color: var(--a-color-bg);
  font-size: 0.6875rem;
}

.pe-cover-reupload {
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

.pe-cover-preview:hover .pe-cover-reupload,
.pe-cover-reupload:focus-within {
  opacity: 1;
}

.pe-cover-empty {
  display: flex;
  min-height: 180px;
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

.pe-cover-empty:hover:not(.pe-cover-empty--uploading),
.pe-cover-empty:focus-within {
  border-color: var(--a-color-text-secondary);
  background: var(--a-color-surface);
  color: var(--a-color-text);
}

.pe-cover-empty--uploading {
  cursor: default;
  opacity: 0.6;
}

.pe-cover-hint,
.pe-cover-sub {
  color: var(--a-color-muted);
  font-size: 0.75rem;
}

.pe-cover-sub {
  margin: 0;
  line-height: 1.5;
}

.pe-file-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
