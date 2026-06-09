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
      <svg v-if="!coverUploading" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="opacity:0.3">
        <path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm-1 14l-5-6.5-4 5-3-3.5-4 4.5h16z"/>
      </svg>
      <span v-if="!coverUploading" class="pe-cover-hint">点击上传封面</span>
      <span v-else class="pe-cover-hint">上传中…</span>
    </label>

    <p class="pe-cover-sub">不填则优先显示合集封面，其次显示频道封面</p>
  </section>
</template>

<script setup lang="ts">
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
