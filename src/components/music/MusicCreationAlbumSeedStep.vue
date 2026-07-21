<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  uploadMusicAsset,
  createMusicAlbumImport,
  type MusicAlbumImport,
} from '@/api/musicV1'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import PInput from '@/components/ui/PInput.vue'
import PButton from '@/components/ui/PButton.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import PSelect from '@/components/ui/PSelect.vue'
import MusicCreationAlbumUploadZone from '@/components/music/MusicCreationAlbumUploadZone.vue'

const { state, setMusicCreationStep } = useMusicDrawers()
const coverInputRef = ref<HTMLInputElement | null>(null)

const creationFlow = computed(() => state.value.creationFlow)
const albumImportDraft = computed(() => creationFlow.value?.draft.albumImport ?? null)
const albumDetailsDraft = computed(() => creationFlow.value?.draft.albumDetails ?? null)
const tracksDraft = computed(() => creationFlow.value?.draft.tracks ?? [])
const coverUploading = ref(false)
const coverErrorMessage = ref('')
const resolvedCoverUrl = computed(() => albumImportDraft.value?.coverUrl || albumImportDraft.value?.derivedCover || '')

function renumberTracks() {
  if (!creationFlow.value) return
  creationFlow.value.draft.tracks = creationFlow.value.draft.tracks.map((track, index) => ({
    ...track,
    sequence: index + 1,
  }))
}

function addTrack() {
  if (!creationFlow.value) return
  creationFlow.value.draft.tracks = [
    ...creationFlow.value.draft.tracks,
    {
      id: `manual-track-${Date.now()}`,
      sequence: creationFlow.value.draft.tracks.length + 1,
      title: '',
      origin: 'manual',
    },
  ]
}

function updateTrackTitle(trackId: string, title: string) {
  if (!creationFlow.value) return
  creationFlow.value.draft.tracks = creationFlow.value.draft.tracks.map((track) => (
    track.id === trackId
      ? { ...track, title }
      : track
  ))
}

function removeTrack(trackId: string) {
  if (!creationFlow.value) return
  creationFlow.value.draft.tracks = creationFlow.value.draft.tracks.filter((track) => track.id !== trackId)
  renumberTracks()
}

async function onCoverChange(event: Event) {
  if (!albumDetailsDraft.value) return

  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  coverUploading.value = true
  coverErrorMessage.value = ''

  try {
    const asset = await uploadMusicAsset(file, 'music.cover')
    albumDetailsDraft.value.coverAsset = asset
    albumDetailsDraft.value.coverUrl = asset.url
  } catch (error) {
    coverErrorMessage.value = error instanceof Error ? error.message : '封面上传失败'
  } finally {
    coverUploading.value = false
    input.value = ''
  }
}


</script>

<template>
  <div v-if="albumImportDraft" class="album-seed-step" data-testid="album-seed-step">
    <div class="album-page">
      <header class="album-hero">
        <div class="album-hero__meta">
          <p class="hero-step">第 2 步 / 上传专辑</p>
        </div>
        <h4>上传专辑</h4>
      </header>

      <section class="album-card album-card--primary">
        <div class="card-header">
          <div>
            <p class="card-kicker">上传文件</p>
          </div>
        </div>
        <MusicCreationAlbumUploadZone />
      </section>

      <section class="album-card album-card--soft">
        <div class="card-header">
          <div>
            <p class="card-kicker">曲目整理</p>
          </div>
          <button
            data-testid="album-import-add-track-button"
            type="button"
            class="track-add-button"
            @click="addTrack"
          >
            新增曲目
          </button>
        </div>

        <div v-if="tracksDraft.length" class="track-list" data-testid="album-import-track-list">
          <div
            v-for="track in tracksDraft"
            :key="track.id"
            class="track-row track-row--interactive"
            data-testid="album-import-track-row"
          >
            <span class="track-seq">{{ String(track.sequence).padStart(2, '0') }}</span>
            <input
              :value="track.title"
              data-testid="album-import-track-title-input"
              class="track-title-input"
              type="text"
              placeholder="输入曲目名"
              @input="e => updateTrackTitle(track.id, (e.target as HTMLInputElement).value)"
            />
            <div class="track-row-actions" data-testid="album-import-track-actions">
              <button
                :data-testid="`album-import-track-delete-${track.id}`"
                type="button"
                class="track-action-button"
                @click="removeTrack(track.id)"
              >
                删除
              </button>
            </div>
          </div>
        </div>

        <p v-else class="state-line">上传后识别到的曲目会显示在这里，也可以手动添加。</p>
      </section>

      <section class="album-card">
        <div class="card-header">
          <div>
            <p class="card-kicker">已识别内容</p>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-chip">
            <span class="summary-label">专辑名</span>
            <strong>{{ albumImportDraft.derivedAlbumTitle || '等待上传' }}</strong>
          </div>
          <div class="info-chip">
            <span class="summary-label">封面</span>
            <div v-if="resolvedCoverUrl" class="cover-summary">
              <img
                :src="resolvedCoverUrl"
                alt="已识别专辑封面"
                class="cover-summary__image"
                data-testid="album-import-cover-preview"
              />
            </div>
            <strong v-else>等待上传</strong>
          </div>
        </div>
      </section>

      <section v-if="albumDetailsDraft" class="album-card album-card--soft">
        <div class="card-header">
          <div>
            <p class="card-kicker">专辑信息</p>
            <p class="card-copy">在这一步直接完成封面、标题、日期和简介。</p>
          </div>
        </div>

        <div class="field-stack">
          <div class="field-group">
            <input
              ref="coverInputRef"
              data-testid="album-details-cover-input"
              type="file"
              accept="image/*"
              :disabled="coverUploading"
              style="display: none"
              @change="onCoverChange"
            />
            <div class="p-field">
              <label class="p-field-label">
                <span class="p-field-dot" aria-hidden="true" />
                封面
              </label>
              <div
                class="custom-file-picker"
                :class="{ 'is-disabled': coverUploading }"
                @click="coverInputRef?.click()"
              >
                <div class="file-picker-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
                <div class="file-picker-text">
                  <span class="file-picker-title">
                    {{ albumDetailsDraft.coverUrl ? '已选择封面图片' : '点击或拖拽上传专辑封面' }}
                  </span>
                  <span class="file-picker-subtitle">支持 JPG, PNG 格式</span>
                </div>
                <PButton
                  type="button"
                  variant="secondary"
                  :disabled="coverUploading"
                  @click.stop="coverInputRef?.click()"
                >
                  {{ albumDetailsDraft.coverUrl ? '重新选择' : '浏览文件' }}
                </PButton>
              </div>
            </div>
            <p v-if="coverErrorMessage" class="state-line state-line--error">{{ coverErrorMessage }}</p>
            <p v-else-if="coverUploading" class="state-line">正在上传封面...</p>
          </div>

          <div class="field-group">
            <PInput
              v-model="albumDetailsDraft.title"
              data-testid="album-details-title-input"
              type="text"
              label="专辑名"
              placeholder="输入专辑名"
            />
          </div>

          <div class="field-grid field-grid--duo">
            <div class="field-group">
              <PInput
                v-model="albumDetailsDraft.releaseDate"
                data-testid="album-details-date-input"
                type="date"
                label="发行日期"
              />
            </div>

            <div class="field-group">
              <PSelect
                v-model="albumDetailsDraft.type"
                data-testid="album-details-type-input"
                label="类型"
                :options="[
                  { label: '专辑', value: 'album' },
                  { label: 'EP', value: 'ep' },
                  { label: '单曲', value: 'single' },
                ]"
              />
            </div>
          </div>

          <div class="field-group">
            <PTextarea
              v-model="albumDetailsDraft.bio"
              data-testid="album-details-bio-input"
              :rows="4"
              label="简介"
              placeholder="补充专辑简介"
            />
          </div>

          <div class="field-group">
            <PInput
              v-model="albumDetailsDraft.source"
              data-testid="album-details-source-input"
              type="text"
              label="来源"
              placeholder="填写专辑信息来源"
            />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.album-seed-step {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 1rem;
}

.album-page {
  display: grid;
  gap: 1rem;
}

.cover-summary {
  display: flex;
  align-items: center;
}

.cover-summary__image {
  width: 5.5rem;
  height: 5.5rem;
  object-fit: cover;
  border-radius: 0.9rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface-2);
}

.album-hero {
  display: none !important;
  gap: 0.7rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.album-hero__meta {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.hero-kicker,
.hero-step,
.card-kicker,
.summary-label {
  margin: 0;
  color: var(--a-color-muted);
  font-family: var(--a-font-sans);
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.album-hero h4 {
  margin: 0;
  font-family: var(--a-font-sans);
  font-size: 2rem;
  line-height: 1.05;
}

.hero-copy,
.card-copy {
  margin: 0;
  color: var(--a-color-muted);
  line-height: 1.7;
}

.album-card {
  display: grid;
  gap: 1rem;
  padding: 1.15rem 1.2rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
  background: var(--a-color-bg);
}

.album-card--primary {
  background: color-mix(in srgb, var(--a-color-bg) 82%, var(--a-color-surface));
}

.album-card--soft {
  background: var(--a-color-surface);
}

.card-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  flex-wrap: wrap;
}

.field-stack { display: grid; gap: 1rem; }
.field-group { display: grid; gap: 0.45rem; }
.progress-panel { display: grid; gap: 0.7rem; }

:deep(.p-input:focus) {
  border-bottom-color: var(--a-color-text);
}

.state-line {
  margin: 0;
  color: var(--a-color-muted);
  font-family: var(--a-font-sans);
  font-size: 0.82rem;
  font-weight: 800;
}

.state-line--error { color: var(--a-color-accent-destructive); }

.import-summary {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.85rem 1rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface-muted);
}

.summary-value {
  color: var(--a-color-text);
  font-size: 0.92rem;
  font-weight: 800;
}

.track-list {
  display: grid;
  gap: 0.6rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface-muted);
}

.track-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-family: var(--a-font-sans);
  padding-bottom: 0.45rem;
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-text) 12%, transparent);
}

.track-row:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.track-row--interactive .track-row-actions {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.track-row--interactive:hover .track-row-actions,
.track-row--interactive:focus-within .track-row-actions {
  opacity: 1;
  pointer-events: auto;
}

.track-seq {
  min-width: 2rem;
  color: var(--a-color-muted);
  font-size: 0.76rem;
  font-weight: 800;
}

.track-title-input {
  flex: 1;
  border: 0;
  background: transparent;
  padding: 0.5rem 0.75rem;
  color: var(--a-color-text);
  font-family: inherit;
  font-size: 0.95rem;
  width: 100%;
  border-radius: 0;
  transition: all 0.15s ease;
}
.track-title-input:focus {
  outline: none;
  background: var(--a-color-bg);
  box-shadow: inset 0 -2px 0 var(--a-color-text);
}

.track-row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.track-action-button,
.track-add-button {
  border: 1px solid var(--a-color-border-soft);
  border-radius: 0;
  background: var(--a-color-bg);
  color: var(--a-color-text);
  cursor: pointer;
  font-family: var(--a-font-sans);
  font-size: 0.76rem;
  font-weight: 800;
  padding: 0.45rem 0.7rem;
}

.info-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.info-chip {
  display: grid;
  gap: 0.5rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--a-color-border-soft);
  background: color-mix(in srgb, var(--a-color-surface-muted) 84%, var(--a-color-bg));
}

@media (max-width: 720px) {
  .info-grid {
    grid-template-columns: 1fr;
  }
}

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
  border-radius: 999px;
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
}
.file-picker-text {
  display: flex;
  flex-direction: column;
  flex: 1;
  text-align: left;
}
.file-picker-title {
  font-size: 0.88rem;
  font-weight: 800;
  color: var(--a-color-text);
  word-break: break-all;
  line-height: 1.4;
}
.file-picker-subtitle {
  font-size: 0.72rem;
  color: var(--a-color-muted-soft);
  margin-top: 0.15rem;
  line-height: 1.3;
}

.folder-picker-row {
  margin-top: 8px;
  display: flex;
  justify-content: flex-end;
}

.folder-picker-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid var(--color-border, rgba(0,0,0,0.15));
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-secondary, #666);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.folder-picker-btn:hover:not(:disabled) {
  background: var(--color-surface-secondary, rgba(0,0,0,0.05));
  color: var(--color-text, #333);
}

.folder-picker-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.import-file-list {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  max-height: 180px;
  overflow-y: auto;
}

.import-file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 2px;
  font-size: 12px;
  border-bottom: 1px solid var(--color-border-subtle, rgba(0,0,0,0.06));
}

.import-file-item--failed .import-file-name {
  color: var(--color-error, #c00);
}

.import-file-item--uploaded .import-file-name {
  opacity: 0.6;
}

.import-file-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.import-file-format {
  font-family: monospace;
  color: var(--color-text-secondary, #888);
  font-size: 11px;
  flex-shrink: 0;
}



.stage-banner {
  margin-top: 12px;
  padding: 8px 12px;
  background: var(--color-surface-secondary, rgba(0,0,0,0.04));
  border-radius: 6px;
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
}

.stage-label {
  font-weight: 500;
}

.stage-hint {
  color: var(--color-text-secondary, #888);
}

.import-file-progress {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.import-file-error {
  color: var(--color-error, #c00);
  font-size: 11px;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.import-file-action {
  padding: 1px 6px;
  font-size: 11px;
  border: 1px solid var(--color-border, rgba(0,0,0,0.15));
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  color: var(--color-text, #333);
  white-space: nowrap;
  transition: background 0.12s;
}

.import-file-action:hover:not(:disabled) {
  background: var(--color-surface-secondary, rgba(0,0,0,0.06));
}

.import-file-action:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.import-file-action--danger {
  color: var(--color-error, #c00);
  border-color: var(--color-error, #c00);
}

.import-file-action--danger:hover:not(:disabled) {
  background: rgba(204,0,0,0.06);
}
</style>
