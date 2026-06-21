<script setup lang="ts">
import { computed, ref } from 'vue'
import { uploadMusicAudioBatch } from '@/api/musicV1'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

const { state, setMusicCreationStep } = useMusicDrawers()

const creationFlow = computed(() => state.value.creationFlow)
const albumSeedDraft = computed(() => creationFlow.value?.draft.albumSeed ?? null)
const tracksDraft = computed(() => creationFlow.value?.draft.tracks ?? [])
const uploading = ref(false)
const errorMessage = ref('')

function normalizeTrackTitle(filename: string) {
  return filename.replace(/\.[^.]+$/, '')
}

async function handleBatchUpload(event: Event) {
  if (!creationFlow.value) return

  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  if (!files.length) return

  uploading.value = true
  errorMessage.value = ''

  try {
    const uploads = await uploadMusicAudioBatch(files)
    creationFlow.value.draft.albumSeed.uploadedAssets = uploads.map((asset, index) => ({
      id: asset.key || asset.url || `upload-${index + 1}`,
      url: asset.url,
    }))
    creationFlow.value.draft.tracks = uploads.map((asset, index) => ({
      id: `draft-track-${index + 1}`,
      sequence: index + 1,
      title: normalizeTrackTitle(files[index]?.name || `Track ${index + 1}`),
      audioUrl: asset.url,
    }))
  } catch (error) {
    console.error('Failed to upload album seed audio batch:', error)
    errorMessage.value = '音频上传失败'
  } finally {
    uploading.value = false
    input.value = ''
  }
}

function goNext() {
  if (!creationFlow.value) return
  if (!creationFlow.value.draft.albumSeed.title.trim()) return
  if (!creationFlow.value.draft.tracks.length) return

  creationFlow.value.draft.albumDetails.title = creationFlow.value.draft.albumSeed.title
  setMusicCreationStep('albumDetails')
}
</script>

<template>
  <div v-if="albumSeedDraft" class="album-seed-step" data-testid="album-seed-step">
    <div class="album-seed-card">
      <p class="step-kicker">Album Seed</p>
      <h4>上传音频</h4>
      <p class="step-copy">先写专辑标题并批量上传首批音频，下一步再补全专辑细节。</p>

      <div class="field-stack">
        <label class="field-group">
          <span class="field-label">专辑标题</span>
          <input
            v-model="albumSeedDraft.title"
            data-testid="album-seed-title-input"
            class="field-input"
            type="text"
            placeholder="例如 Late Registration"
          />
        </label>

        <label class="field-group">
          <span class="field-label">批量音频</span>
          <input
            data-testid="album-seed-batch-upload"
            class="field-input field-input--file"
            type="file"
            accept="audio/*"
            multiple
            :disabled="uploading"
            @change="handleBatchUpload"
          />
        </label>

        <p v-if="errorMessage" class="state-line state-line--error">{{ errorMessage }}</p>
        <p v-else-if="uploading" class="state-line">正在上传音频...</p>
        <p v-else-if="tracksDraft.length" class="state-line">{{ tracksDraft.length }} 首曲目已加入草稿。</p>
        <p v-else class="state-line">至少上传一首音频后才能进入下一步。</p>

        <div v-if="tracksDraft.length" class="track-list" data-testid="album-seed-track-list">
          <div v-for="track in tracksDraft" :key="track.id" class="track-row">
            <span class="track-seq">{{ String(track.sequence).padStart(2, '0') }}</span>
            <span class="track-title">{{ track.title }}</span>
          </div>
        </div>
      </div>

      <div class="step-actions">
        <button
          data-testid="album-seed-next-button"
          type="button"
          class="paper-submit"
          :disabled="uploading"
          @click="goNext"
        >
          继续
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.album-seed-step { display: flex; flex: 1; flex-direction: column; gap: 1rem; }
.album-seed-card {
  display: grid;
  gap: 0.75rem;
  padding: 1.15rem 1.2rem;
  border-radius: 8px;
  background: color-mix(in srgb, var(--a-color-paper-wash) 74%, white);
}
.step-kicker {
  margin: 0;
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.album-seed-card h4 { margin: 0; font-family: var(--a-font-serif); font-size: 1.25rem; }
.step-copy { margin: 0; color: var(--a-color-ink-soft); line-height: 1.6; }
.field-stack { display: grid; gap: 0.9rem; }
.field-group { display: grid; gap: 0.4rem; }
.field-label {
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.field-input {
  width: 100%;
  border: 1px solid color-mix(in srgb, var(--a-color-ink) 12%, transparent);
  border-radius: 0px;
  padding: 0.85rem 0.95rem;
  background: rgba(255, 255, 255, 0.92);
  color: var(--a-color-ink);
  font: inherit;
}
.field-input--file {
  padding-block: 0.65rem;
  color: var(--a-color-ink-soft);
}
.state-line {
  margin: 0;
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 0.82rem;
  font-weight: 800;
}
.state-line--error { color: #b42318; }
.track-list {
  display: grid;
  gap: 0.6rem;
  padding: 0.9rem 1rem;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
}
.track-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-family: var(--a-font-meta);
}
.track-seq {
  min-width: 2rem;
  color: var(--a-color-ink-soft);
  font-size: 0.76rem;
  font-weight: 800;
}
.track-title { color: var(--a-color-ink); font-size: 0.92rem; font-weight: 800; }
.step-actions { display: flex; justify-content: flex-end; }
.paper-submit {
  border: 0;
  border-radius: 0px;
  padding: 0.85rem 1.2rem;
  font-family: var(--a-font-meta);
  font-weight: 800;
  cursor: pointer;
  background: color-mix(in srgb, var(--a-color-ink) 92%, #6b4f3a 8%);
  color: white;
}
.paper-submit:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
