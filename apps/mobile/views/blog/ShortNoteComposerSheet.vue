<template>
  <MSheet
    :model-value="modelValue"
    title="写短笺"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="short-note-composer" data-testid="short-note-composer-sheet">
      <textarea
        v-model="content"
        class="short-note-composer__textarea"
        placeholder="记录当下闪现的灵感或思考..."
        rows="5"
        maxlength="1000"
        data-testid="composer-textarea"
      />

      <div class="short-note-composer__tools">
        <label class="short-note-composer__tool-btn">
          <MIcon name="plus" size="sm" />
          <span>添加图片</span>
          <input
            type="file"
            accept="image/*"
            class="sr-only"
            @change="handleImageSelected"
          />
        </label>
        <span class="short-note-composer__counter">{{ content.length }}/1000</span>
      </div>

      <!-- Preview Image if attached -->
      <div v-if="previewImage" class="short-note-composer__image-preview">
        <img :src="previewImage" alt="预览图片" class="preview-img" />
        <button
          type="button"
          class="remove-image-btn"
          aria-label="移除图片"
          @click="previewImage = ''"
        >
          <MIcon name="xmark" size="xs" />
        </button>
      </div>

      <div class="short-note-composer__actions">
        <MButton
          variant="secondary"
          size="sm"
          @click="$emit('update:modelValue', false)"
        >
          取消
        </MButton>
        <MButton
          variant="primary"
          size="sm"
          :disabled="!content.trim() || submitting"
          data-testid="composer-submit-btn"
          @click="handleSubmit"
        >
          {{ submitting ? '发布中...' : '发布短笺' }}
        </MButton>
      </div>
    </div>
  </MSheet>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import MSheet from '@mobile/components/ui/MSheet.vue'
import MButton from '@mobile/components/ui/MButton.vue'
import MIcon from '@mobile/components/ui/MIcon.vue'

defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'submit', payload: { content: string; image?: string }): void
}>()

const content = ref('')
const previewImage = ref('')
const submitting = ref(false)

function handleImageSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (event) => {
      previewImage.value = (event.target?.result as string) || ''
    }
    reader.readAsDataURL(file)
  }
}

function handleSubmit() {
  if (!content.value.trim() || submitting.value) return
  submitting.value = true
  try {
    emit('submit', {
      content: content.value.trim(),
      image: previewImage.value || undefined,
    })
    content.value = ''
    previewImage.value = ''
    emit('update:modelValue', false)
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.short-note-composer {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 0 16px;
}

.short-note-composer__textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--a-color-border-soft, #e4e4e7);
  border-radius: var(--a-radius-card, 4px);
  padding: 12px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--a-color-text, #18181b);
  background: var(--a-color-bg, #ffffff);
  resize: none;
  outline: none;
  font-family: inherit;
}

.short-note-composer__textarea:focus {
  border-color: var(--a-color-primary, #10b981);
}

.short-note-composer__tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.short-note-composer__tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  color: var(--a-color-text-secondary, #71717a);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--a-radius-control, 4px);
  background: var(--a-color-surface-hover, #f4f4f5);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.short-note-composer__counter {
  font-size: 11px;
  color: var(--a-color-text-secondary, #a1a1aa);
}

.short-note-composer__image-preview {
  position: relative;
  display: inline-block;
  max-width: 120px;
  border-radius: var(--a-radius-card, 4px);
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft, #e4e4e7);
}

.preview-img {
  width: 100%;
  height: 90px;
  object-fit: cover;
  display: block;
}

.remove-image-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border-radius: var(--a-radius-control, 4px);
  background: rgba(0, 0, 0, 0.6);
  color: #ffffff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.short-note-composer__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 8px;
}
</style>
