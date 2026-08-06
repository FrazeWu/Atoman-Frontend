<script setup lang="ts">
import { ref } from 'vue'

import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PSheet from '@/components/ui/PSheet.vue'
import PTextarea from '@/components/ui/PTextarea.vue'

defineProps<{
  show: boolean
  index: number
  name: string
  description: string
  isPublic: boolean
  coverPreview: string
  coverUploading: boolean
  saving: boolean
  deleting: boolean
}>()

const emit = defineEmits<{
  close: []
  save: []
  delete: []
  'update:name': [value: string]
  'update:description': [value: string]
  'update:isPublic': [value: boolean]
  'cover-change': [event: Event]
}>()

const coverInput = ref<HTMLInputElement | null>(null)
</script>

<template>
  <PSheet
    :show="show"
    title="编辑歌单"
    :index="index"
    :layer-index="index"
    :stack-size="index + 1"
    close-type="header"
    :show-backdrop="false"
    @close="emit('close')"
  >
    <div class="playlist-edit-panel">
      <PInput
        data-testid="playlist-name-input"
        :model-value="name"
        placeholder="歌单名称"
        @update:model-value="emit('update:name', $event)"
      />

      <label class="playlist-edit-toggle">
        <input
          data-testid="playlist-public-toggle"
          type="checkbox"
          :checked="isPublic"
          @change="emit('update:isPublic', ($event.target as HTMLInputElement).checked)"
        />
        <span>设为公开</span>
      </label>

      <div class="playlist-cover-editor">
        <input
          ref="coverInput"
          data-testid="playlist-cover-input"
          class="playlist-cover-input"
          type="file"
          accept="image/*"
          @change="emit('cover-change', $event)"
        />
        <button
          type="button"
          class="playlist-cover-preview"
          :disabled="coverUploading"
          @click="coverInput?.click()"
        >
          <img v-if="coverPreview" :src="coverPreview" alt="歌单封面预览" />
          <div v-else class="playlist-cover-preview__empty">点击上传</div>
          <span v-if="coverUploading" class="playlist-cover-preview__badge">上传中...</span>
        </button>
      </div>

      <PTextarea
        data-testid="playlist-description-input"
        :model-value="description"
        :rows="4"
        placeholder="一句话介绍这张歌单"
        @update:model-value="emit('update:description', $event)"
      />

      <div class="playlist-edit-actions">
        <PButton data-testid="playlist-delete-button" variant="danger" :loading="deleting" :disabled="saving" @click="emit('delete')">
          删除
        </PButton>
        <PButton variant="secondary" :disabled="saving || deleting" @click="emit('close')">
          取消
        </PButton>
        <PButton data-testid="playlist-save-button" :loading="saving" :disabled="deleting" @click="emit('save')">
          保存
        </PButton>
      </div>
    </div>
  </PSheet>
</template>

<style scoped>
.playlist-edit-panel {
  display: grid;
  gap: 1rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface-muted);
  padding: 1rem;
}

.playlist-edit-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  width: fit-content;
  font-size: 0.92rem;
  color: var(--a-color-fg);
}

.playlist-cover-editor {
  display: grid;
  gap: 0.75rem;
}

.playlist-cover-input {
  display: none;
}

.playlist-cover-preview {
  position: relative;
  width: 120px;
  height: 120px;
  padding: 0;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  overflow: hidden;
  cursor: pointer;
}

.playlist-cover-preview:hover {
  border-color: var(--a-color-text);
}

.playlist-cover-preview:disabled {
  cursor: wait;
  opacity: 0.72;
}

.playlist-cover-preview img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.playlist-cover-preview__empty {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  color: var(--a-color-muted);
  font-size: 0.86rem;
}

.playlist-cover-preview__badge {
  position: absolute;
  right: 0.5rem;
  bottom: 0.5rem;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.68);
  color: #fff;
  font-size: 0.7rem;
}

.playlist-edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}
</style>
