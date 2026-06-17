<template>
  <PSurface class="music-cover" tone="soft" :layer="0">
    <div class="music-cover__header">
      <div>
        <h3 class="music-cover__title">封面</h3>
        <p class="music-cover__hint">可选。未提供时保留旧封面或使用默认封面。</p>
      </div>
      <div class="music-cover__actions">
        <PButton type="button" variant="ghost" @click="triggerInput">{{ cover.previewUrl ? '更换封面' : '上传封面' }}</PButton>
        <PButton v-if="cover.previewUrl" type="button" variant="ghost" @click="clearCover">移除封面</PButton>
      </div>
    </div>

    <input ref="fileInput" class="music-cover__input" type="file" accept="image/*" @change="onFileChange" />

    <div v-if="cover.previewUrl" class="music-cover__preview-wrap">
      <img :src="cover.previewUrl" alt="封面预览" class="music-cover__preview" />
    </div>
    <PEmpty v-else description="尚未选择封面" />
  </PSurface>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import PSurface from '@/components/ui/PSurface.vue'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import type { MusicCoverDraft } from './types'

const props = defineProps<{
  cover: MusicCoverDraft
}>()

const emit = defineEmits<{
  (e: 'update:cover', value: MusicCoverDraft): void
  (e: 'select:file', file: File): void
}>()

const fileInput = ref<HTMLInputElement | null>(null)

function triggerInput() {
  fileInput.value?.click()
}

function clearCover() {
  emit('update:cover', {
    ...props.cover,
    file: null,
    previewUrl: '',
    asset: null,
  })
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  emit('select:file', file)

  const reader = new FileReader()
  reader.onload = (loadEvent) => {
    emit('update:cover', {
      ...props.cover,
      file,
      previewUrl: String(loadEvent.target?.result ?? ''),
    })
  }
  reader.readAsDataURL(file)
  input.value = ''
}
</script>

<style scoped>
.music-cover {
  padding: 1rem;
}

.music-cover__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.music-cover__title {
  margin: 0;
  font-size: 1rem;
}

.music-cover__hint {
  margin: 0.25rem 0 0;
  color: var(--a-color-muted-soft);
  font-size: 0.875rem;
}

.music-cover__actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.music-cover__input {
  display: none;
}

.music-cover__preview-wrap {
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper);
  width: min(16rem, 100%);
}

.music-cover__preview {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
}
</style>
