<script setup lang="ts">
import { computed } from 'vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

const { state } = useMusicDrawers()
const albumImport = computed(() => state.value.creationFlow?.draft.albumImport ?? null)
const tracks = computed(() => state.value.creationFlow?.draft.tracks ?? [])
const coverUrl = computed(() => albumImport.value?.coverUrl || albumImport.value?.derivedCover || '')
const failedFiles = computed(() => (albumImport.value?.files ?? []).filter((file) => (
  file.uploadStatus === 'failed' || file.processingStatus === 'failed'
)))
const uploadProgress = computed(() => {
  const total = albumImport.value?.totalBytesTotal ?? 0
  const loaded = albumImport.value?.totalBytesLoaded ?? 0
  return total > 0 ? Math.round((loaded / total) * 100) : 0
})
const uploadSpeed = computed(() => Math.round((albumImport.value?.uploadSpeed ?? 0) / 1024))
const stageLabels = {
  upload: '上传中',
  queued: '等待处理',
  extracting: '解压中',
  analyzing: '分析中',
  transcoding: '转码中',
  committing: '正在保存',
  ready: '已就绪',
  completed: '已完成',
  failed: '处理失败',
  canceled: '已取消',
} as const
const stageLabel = computed(() => stageLabels[albumImport.value?.stage ?? 'upload'])
</script>

<template>
  <section v-if="albumImport" class="album-preview-step" data-testid="album-import-preview-step">
    <section class="album-preview-step__status" data-testid="album-import-preview-status">
      <strong>{{ stageLabel }}</strong>
      <span v-if="albumImport.totalBytesTotal > 0">上传进度 {{ uploadProgress }}%</span>
      <span v-if="albumImport.totalBytesTotal > 0">{{ uploadSpeed }} KB/s</span>
    </section>
    <p v-if="albumImport.errorMessage" class="album-preview-step__error">{{ albumImport.errorMessage }}</p>
    <div v-if="coverUrl" class="album-preview-step__cover">
      <img :src="coverUrl" alt="专辑封面预览" />
    </div>

    <section class="album-preview-step__section">
      <h4>曲目</h4>
      <ol v-if="tracks.length" class="album-preview-step__tracks">
        <li v-for="track in tracks" :key="track.id">{{ track.title }}</li>
      </ol>
      <p v-else>未识别到曲目</p>
    </section>

    <section v-if="failedFiles.length" class="album-preview-step__section">
      <h4>需要处理</h4>
      <ul class="album-preview-step__failures">
        <li v-for="file in failedFiles" :key="file.fileId">
          {{ file.fileName }}{{ file.errorMessage ? `：${file.errorMessage}` : '' }}
        </li>
      </ul>
    </section>
  </section>
</template>

<style scoped>
.album-preview-step { display: grid; gap: 1.25rem; }
.album-preview-step__status { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; font-size: 0.88rem; }
.album-preview-step__cover img { display: block; width: min(100%, 16rem); aspect-ratio: 1; object-fit: cover; }
.album-preview-step__section { display: grid; gap: 0.5rem; }
.album-preview-step__section h4, .album-preview-step__section p { margin: 0; }
.album-preview-step__error { margin: 0; color: var(--a-color-accent-destructive); }
.album-preview-step__tracks, .album-preview-step__failures { display: grid; gap: 0.35rem; margin: 0; padding-left: 1.25rem; }
</style>
