<template>
  <PModal
    :model-value="modelValue"
    title="导入电子书"
    size="sm"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="book-upload-modal">
      <div
        class="book-upload-dropzone"
        :class="{ 'book-upload-dropzone--dragover': isDragOver, 'book-upload-dropzone--uploading': isUploading }"
        @dragover.prevent="isDragOver = true"
        @dragleave.prevent="isDragOver = false"
        @drop.prevent="handleDrop"
        @click="triggerFileSelect"
      >
        <input
          ref="fileInputRef"
          type="file"
          class="book-upload-file-input"
          accept=".epub,.pdf,.txt,.mobi,.azw3,application/epub+zip,application/pdf,text/plain,application/x-mobipocket-ebook,application/vnd.amazon.mobi8-ebook"
          :disabled="isUploading"
          @change="handleFileChange"
        />

        <div v-if="!isUploading" class="book-upload-prompt">
          <IconUpload :size="28" class="book-upload-icon" aria-hidden="true" />
          <p class="book-upload-main-text">点击或拖拽电子书文件到此处</p>
          <span class="book-upload-sub-text">支持 EPUB、PDF、TXT、MOBI、AZW3 格式</span>
        </div>

        <div v-else class="book-upload-progress">
          <IconLoader2 :size="24" class="book-upload-spinner" aria-hidden="true" />
          <p class="book-upload-progress-text">正在上传中 {{ uploadPercent }}%</p>
          <div class="book-upload-bar-bg" role="progressbar" :aria-valuenow="uploadPercent" aria-valuemin="0" aria-valuemax="100">
            <div class="book-upload-bar-fill" :style="{ width: `${uploadPercent}%` }" />
          </div>
        </div>
      </div>

      <p v-if="errorMessage" class="book-upload-error" role="alert">
        {{ errorMessage }}
      </p>
    </div>

    <template #footer>
      <div class="book-upload-footer">
        <PButton variant="ghost" size="sm" :disabled="isUploading" @click="$emit('update:modelValue', false)">
          取消
        </PButton>
      </div>
    </template>
  </PModal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { IconUpload, IconLoader2 } from '@tabler/icons-vue'
import type { BookImportSession } from '@/api/books'
import { uploadBookFile } from '@/api/books'
import PModal from '@/components/ui/PModal.vue'
import PButton from '@/components/ui/PButton.vue'

defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  success: [session: BookImportSession]
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const isDragOver = ref(false)
const isUploading = ref(false)
const uploadPercent = ref(0)
const errorMessage = ref('')

const allowedExtensions = ['epub', 'pdf', 'txt', 'mobi', 'azw3']

function triggerFileSelect() {
  if (isUploading.value) return
  fileInputRef.value?.click()
}

function handleDrop(event: DragEvent) {
  isDragOver.value = false
  if (isUploading.value) return
  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    void processFile(files[0])
  }
}

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    void processFile(file)
  }
  // Reset input value so same file can be re-selected if failed
  target.value = ''
}

async function processFile(file: File) {
  errorMessage.value = ''
  const ext = file.name.split('.').pop()?.toLowerCase()

  if (!ext || !allowedExtensions.includes(ext)) {
    errorMessage.value = '仅支持 EPUB、PDF、TXT、MOBI 和 AZW3 文件'
    return
  }

  isUploading.value = true
  uploadPercent.value = 0

  try {
    const session = await uploadBookFile(file, {
      onProgress: ({ loaded, total }) => {
        uploadPercent.value = total > 0 ? Math.round((loaded / total) * 100) : 0
      },
    })
    emit('success', session)
    emit('update:modelValue', false)
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : '电子书上传失败，请稍后重试'
  } finally {
    isUploading.value = false
    uploadPercent.value = 0
  }
}
</script>

<style scoped>
.book-upload-modal {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.book-upload-file-input {
  display: none;
}

.book-upload-dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2.5rem 1.5rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-surface-muted);
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.book-upload-dropzone:hover {
  border-color: var(--a-color-primary);
}

.book-upload-dropzone--dragover {
  border-color: var(--a-color-primary);
  background: color-mix(in srgb, var(--a-color-primary) 5%, transparent);
}

.book-upload-dropzone--uploading {
  cursor: default;
}

.book-upload-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  text-align: center;
}

.book-upload-icon {
  color: var(--a-color-text-muted);
}

.book-upload-main-text {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--a-color-fg);
}

.book-upload-sub-text {
  font-size: 0.75rem;
  color: var(--a-color-text-muted);
}

.book-upload-progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 240px;
  gap: 0.75rem;
}

.book-upload-spinner {
  color: var(--a-color-primary);
  animation: spin 1s linear infinite;
}

.book-upload-progress-text {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--a-color-fg);
  font-weight: 500;
}

.book-upload-bar-bg {
  width: 100%;
  height: 4px;
  background: var(--a-color-border-soft);
  border-radius: 2px;
  overflow: hidden;
}

.book-upload-bar-fill {
  height: 100%;
  background: var(--a-color-primary);
  border-radius: 2px;
  transition: width 0.2s ease;
}

.book-upload-error {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--a-color-danger);
}

.book-upload-footer {
  display: flex;
  justify-content: flex-end;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
