<template>
  <div class="cover-upload-card a-card-sm">
    <div v-if="coverUrl" class="cover-preview-wrap">
      <img :src="coverUrl" alt="封面预览" class="cover-preview-image" />
    </div>
    <div v-else class="cover-empty-state">
      <strong>未上传封面</strong>
      <p class="a-muted">上传后会自动填入文章封面地址</p>
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
    <p v-if="error" class="cover-upload-error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import PButton from '@/components/ui/PButton.vue'

defineProps<{
  coverUrl: string
  uploading: boolean
  error: string
}>()

defineEmits<{
  (e: 'trigger-upload'): void
  (e: 'remove-cover'): void
}>()
</script>

<style scoped>
.cover-upload-card {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 0.9rem;
}

.cover-preview-wrap {
  overflow: hidden;
  border: var(--a-border);
  background: var(--a-color-surface);
}

.cover-preview-image {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
}

.cover-empty-state {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 1rem;
  border: var(--a-border);
  background: var(--a-color-surface);
}

.cover-empty-state strong {
  font-size: 0.92rem;
  font-weight: 500;
}

.cover-empty-state .a-muted,
.cover-upload-hint {
  margin: 0;
}

.cover-upload-actions {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.cover-upload-error {
  margin: 0;
  color: var(--a-color-danger);
  font-size: 0.8rem;
  font-weight: 500;
}
</style>
