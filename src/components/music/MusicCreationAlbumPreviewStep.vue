<script setup lang="ts">
import { computed } from 'vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

const { state } = useMusicDrawers()
const albumImport = computed(() => state.value.creationFlow?.draft.albumImport ?? null)
const tracks = computed(() => state.value.creationFlow?.draft.tracks ?? [])
const coverUrl = computed(() => albumImport.value?.coverUrl || albumImport.value?.derivedCover || '')
const failedFiles = computed(() => (albumImport.value?.files ?? []).filter((file) => file.uploadStatus === 'failed'))
</script>

<template>
  <section v-if="albumImport" class="album-preview-step" data-testid="album-import-preview-step">
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
.album-preview-step__cover img { display: block; width: min(100%, 16rem); aspect-ratio: 1; object-fit: cover; }
.album-preview-step__section { display: grid; gap: 0.5rem; }
.album-preview-step__section h4, .album-preview-step__section p { margin: 0; }
.album-preview-step__tracks, .album-preview-step__failures { display: grid; gap: 0.35rem; margin: 0; padding-left: 1.25rem; }
</style>
