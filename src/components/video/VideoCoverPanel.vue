<template>
  <section class="ve-cover-section">
    <label class="ve-field-label">封面图</label>

    <div v-if="generatedCoverReady && !thumbnailUrl" class="ve-auto-cover-card">
      <img :src="generatedCoverPreview" alt="自动抽帧封面预览" class="ve-auto-cover-preview" />
      <div class="ve-auto-cover-actions">
        <ABtn
          variant="secondary"
          size="sm"
          :disabled="coverUploading"
          :loading="coverUploading"
          loading-text="应用中…"
          @click="$emit('use-generated-cover')"
        >
          使用视频首帧
        </ABtn>
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
      <svg v-if="!coverUploading" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="opacity:0.3">
        <path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm-1 14l-5-6.5-4 5-3-3.5-4 4.5h16z"/>
      </svg>
      <span v-if="!coverUploading" class="ve-cover-hint">点击上传封面</span>
      <span v-else class="ve-cover-hint">上传中…</span>
    </label>
  </section>
</template>

<script setup lang="ts">
import ABtn from '@/components/ui/ABtn.vue'

const props = defineProps<{
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
