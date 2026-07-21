<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { SUPPORTED_ARCHIVE_ACCEPT, SUPPORTED_AUDIO_ACCEPT } from '@/api/musicV1'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { useAlbumImportUpload } from '@/composables/useAlbumImportUpload'
import PButton from '@/components/ui/PButton.vue'

const { state } = useMusicDrawers()
const creationFlow = computed(() => state.value.creationFlow)
const albumImportDraft = computed(() => creationFlow.value?.draft.albumImport)

const {
  uploading,
  errorMessage,
  fileProgress,
  handleAutoFileChange,
  handleFilesUpload,
  handleRetryFile,
  handleDeleteFile,
} = useAlbumImportUpload()

const filesInputRef = ref<HTMLInputElement | null>(null)
const folderInputRef = ref<HTMLInputElement | null>(null)

const multiFileTotalProgress = computed(() => {
  if (!albumImportDraft.value) return 0
  const total = albumImportDraft.value.totalBytesTotal
  if (total <= 0) return 0
  return Math.round((albumImportDraft.value.totalBytesLoaded / total) * 100)
})

const isBackendProcessing = computed(() => {
  const status = albumImportDraft.value?.status
  return ['queued', 'extracting', 'analyzing', 'transcoding'].includes(status || '')
})

const stageLabelMap: Record<string, string> = {
  queued: '等待处理',
  extracting: '解压中',
  analyzing: '分析中',
  transcoding: '转码中',
  ready: '已就绪',
}

function formatUploadSpeed(bytesPerSecond: number) {
  if (bytesPerSecond <= 0) return '0 KB/s'
  return `${Math.round(bytesPerSecond / 1024)} KB/s`
}
</script>

<template>
  <div v-if="albumImportDraft" class="album-upload-zone">
    <div class="field-group">
      <!-- Hidden: unified file picker (archive + audio + covers, multiple) -->
      <input
        ref="filesInputRef"
        data-testid="album-import-files-input"
        type="file"
        :accept="SUPPORTED_ARCHIVE_ACCEPT + ',' + SUPPORTED_AUDIO_ACCEPT + ',.cue,.jpg,.jpeg,.png,.webp,.avif,.heic,.heif,.tiff,.tif,.bmp'"
        multiple
        :disabled="uploading"
        style="display: none"
        @change="handleAutoFileChange"
      />
      <!-- Hidden: folder picker -->
      <input
        ref="folderInputRef"
        data-testid="album-import-folder-input"
        type="file"
        webkitdirectory
        :disabled="uploading"
        style="display: none"
        @change="(e) => { handleFilesUpload((e.target as HTMLInputElement).files!) }"
      />

      <div class="p-field">
        <label class="p-field-label">
          <span class="p-field-dot" aria-hidden="true" />
          上传专辑
        </label>
        <div
          class="custom-file-picker"
          :class="{ 'is-disabled': uploading }"
          @click="filesInputRef?.click()"
        >
          <div class="file-picker-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <div class="file-picker-text">
            <span class="file-picker-title">
              <template v-if="albumImportDraft.archiveName">{{ albumImportDraft.archiveName }}</template>
              <template v-else-if="albumImportDraft.files.length > 0">已选择 {{ albumImportDraft.files.length }} 个文件</template>
              <template v-else>点击选择文件</template>
            </span>
            <span class="file-picker-subtitle">压缩包（ZIP/RAR/7Z）、音频文件或封面图片</span>
          </div>
          <PButton
            type="button"
            variant="secondary"
            :disabled="uploading"
            @click.stop="filesInputRef?.click()"
          >
            {{ albumImportDraft.archiveName || albumImportDraft.files.length > 0 ? '重新选择' : '选择文件' }}
          </PButton>
        </div>
      </div>

      <!-- Folder picker trigger -->
      <div class="folder-picker-row">
        <button
          type="button"
          class="folder-picker-btn"
          :disabled="uploading"
          @click="folderInputRef?.click()"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          选择文件夹
        </button>
      </div>
    </div>

    <!-- File list (multi-file / folder mode) -->
    <ul
      v-if="albumImportDraft.files.length > 0"
      class="import-file-list"
      data-testid="album-import-file-list"
    >
      <li
        v-for="f in albumImportDraft.files"
        :key="f.fileId"
        class="import-file-item"
        :class="`import-file-item--${f.uploadStatus}`"
      >
        <span class="import-file-name">{{ f.fileName }}</span>
        <span class="import-file-format">{{ f.detectedFormat }}</span>
        <span class="import-file-progress">
          <template v-if="f.uploadStatus === 'uploaded' || f.uploadStatus === 'completing'">✓</template>
          <template v-else-if="f.uploadStatus === 'failed'">
            <span class="import-file-error">{{ f.errorMessage || '上传失败' }}</span>
            <button
              type="button"
              class="import-file-action"
              :disabled="uploading"
              @click="handleRetryFile(f.fileId)"
            >
              重试
            </button>
            <button
              type="button"
              class="import-file-action import-file-action--danger"
              :disabled="uploading"
              @click="handleDeleteFile(f.fileId)"
            >
              移除
            </button>
          </template>
          <template v-else-if="fileProgress.get(f.fileId) !== undefined">
            {{ fileProgress.get(f.fileId) }}%
          </template>
        </span>
      </li>
    </ul>

    <!-- Error -->
    <p v-if="errorMessage" class="state-line state-line--error">{{ errorMessage }}</p>

    <!-- Archive mode progress -->
    <div v-else-if="albumImportDraft.archiveName" class="progress-panel">
      <p v-if="albumImportDraft.uploadProgress > 0" class="state-line">
        上传进度 {{ albumImportDraft.uploadProgress }}%
      </p>
      <p v-else class="state-line">上传后会自动识别封面和曲目信息。</p>
      <p
        v-if="albumImportDraft.uploadProgress > 0 || albumImportDraft.uploadSpeed > 0"
        class="state-line"
        data-testid="album-import-speed"
      >
        {{ formatUploadSpeed(albumImportDraft.uploadSpeed) }}
      </p>
    </div>

    <!-- Multi-file mode progress -->
    <div v-else-if="albumImportDraft.totalBytesTotal > 0" class="progress-panel">
      <p class="state-line">上传进度 {{ multiFileTotalProgress }}%</p>
    </div>

    <!-- Backend processing stage banner -->
    <div v-if="isBackendProcessing" class="stage-banner">
      <span class="stage-label">{{ stageLabelMap[albumImportDraft.stage] ?? '处理中' }}</span>
      <span class="stage-hint">处理完成后将自动更新</span>
    </div>
  </div>
</template>

<style scoped>
.album-upload-zone {
  display: grid;
  gap: 1rem;
}
.field-group { display: grid; gap: 0.45rem; }
.progress-panel { display: grid; gap: 0.7rem; }
.state-line {
  margin: 0;
  color: var(--a-color-muted);
  font-family: var(--a-font-sans);
  font-size: 0.82rem;
  font-weight: 800;
}
.state-line--error { color: var(--a-color-accent-destructive); }

/* Custom File Picker UI */
.custom-file-picker {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding: 1.25rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface-muted);
  cursor: pointer;
  transition: all 0.2s ease;
}
.custom-file-picker:hover:not(.is-disabled) {
  border-color: var(--a-color-text);
  background: var(--a-color-bg);
}
.custom-file-picker.is-disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.file-picker-icon {
  color: var(--a-color-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--a-color-surface-3);
}
.file-picker-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.file-picker-title {
  color: var(--a-color-text);
  font-size: 0.95rem;
  font-weight: 800;
}
.file-picker-subtitle {
  color: var(--a-color-muted);
  font-size: 0.75rem;
}

.folder-picker-row {
  display: flex;
  justify-content: flex-end;
  margin-top: -0.25rem;
}
.folder-picker-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: transparent;
  border: none;
  color: var(--a-color-muted);
  font-size: 0.76rem;
  font-weight: 800;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: all 0.15s ease;
}
.folder-picker-btn:hover:not(:disabled) {
  color: var(--a-color-text);
  background: var(--a-color-surface-3);
}
.folder-picker-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* File list */
.import-file-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface-muted);
}
.import-file-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.8rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  font-size: 0.8rem;
}
.import-file-item:last-child {
  border-bottom: none;
}
.import-file-item--uploaded, .import-file-item--completing {
  opacity: 0.7;
}
.import-file-name {
  flex: 1;
  color: var(--a-color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.import-file-format {
  color: var(--a-color-muted);
  text-transform: uppercase;
  font-size: 0.7rem;
  font-weight: 800;
}
.import-file-progress {
  min-width: 3rem;
  text-align: right;
  color: var(--a-color-text);
  font-family: monospace;
}
.import-file-error {
  color: var(--a-color-accent-destructive);
  margin-right: 0.5rem;
}
.import-file-action {
  background: transparent;
  border: none;
  color: var(--a-color-text);
  font-size: 0.76rem;
  cursor: pointer;
  text-decoration: underline;
  padding: 0 0.25rem;
}
.import-file-action--danger {
  color: var(--a-color-accent-destructive);
}

.stage-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: color-mix(in srgb, var(--a-color-accent-blue) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--a-color-accent-blue) 30%, transparent);
  border-radius: 4px;
}
.stage-label {
  color: var(--a-color-accent-blue);
  font-weight: 800;
  font-size: 0.85rem;
}
.stage-hint {
  color: var(--a-color-muted);
  font-size: 0.8rem;
}
</style>
