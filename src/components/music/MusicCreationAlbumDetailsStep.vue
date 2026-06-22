<script setup lang="ts">
import { computed, ref } from 'vue'
import { uploadMusicAsset } from '@/api/musicV1'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import PSelect from '@/components/ui/PSelect.vue'

const { state, closeMusicCreationFlow, setMusicCreationStep } = useMusicDrawers()

const creationFlow = computed(() => state.value.creationFlow)
const albumDetailsDraft = computed(() => creationFlow.value?.draft.albumDetails ?? null)
const tracksDraft = computed(() => creationFlow.value?.draft.tracks ?? [])
const coverUploading = ref(false)
const coverErrorMessage = ref('')

const orderedTracks = computed(() => tracksDraft.value)

function formatSequence(index: number) {
  return String(index).padStart(2, '0')
}

function renumberTracks() {
  if (!creationFlow.value) return
  creationFlow.value.draft.tracks = creationFlow.value.draft.tracks.map((track, index) => ({
    ...track,
    sequence: index + 1,
  }))
}

function moveTrack(index: number, direction: -1 | 1) {
  if (!creationFlow.value) return
  const target = index + direction
  if (target < 0 || target >= creationFlow.value.draft.tracks.length) return

  const next = [...creationFlow.value.draft.tracks]
  const [track] = next.splice(index, 1)
  next.splice(target, 0, track)
  creationFlow.value.draft.tracks = next
  renumberTracks()
}

function removeTrack(trackId: string) {
  if (!creationFlow.value) return
  creationFlow.value.draft.tracks = creationFlow.value.draft.tracks.filter((track) => track.id !== trackId)
  renumberTracks()
}

async function onCoverChange(event: Event) {
  if (!creationFlow.value || !albumDetailsDraft.value) return

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

function goBack() {
  setMusicCreationStep('albumSeed')
}
</script>

<template>
  <div v-if="albumDetailsDraft" class="album-details-step" data-testid="album-details-step">
    <section class="progress-card">
      <div class="progress-copy">
        <p class="step-kicker">Album Details</p>
        <p class="progress-label" data-testid="album-details-progress-label">第 3 步 / 完善专辑</p>
      </div>
      <p class="progress-value" data-testid="album-details-progress-value">3 / 3</p>
      <div class="progress-steps">
        <span class="progress-step" data-testid="album-details-step-label">1 创建艺术家</span>
        <span class="progress-step" data-testid="album-details-step-label">2 专辑名 + 批量上传</span>
        <span class="progress-step progress-step--active" data-testid="album-details-step-label">3 详细信息</span>
      </div>
      <div class="progress-track" aria-hidden="true">
        <div class="progress-bar" />
      </div>
    </section>

    <div class="field-stack">
      <div class="field-group" data-testid="album-details-field" data-field="cover">
        <PInput
          data-testid="album-details-cover-input"
          type="file"
          accept="image/*"
          :disabled="coverUploading"
          label="封面"
          @change="onCoverChange"
        />
        <p v-if="coverErrorMessage" class="state-line state-line--error">{{ coverErrorMessage }}</p>
        <p v-else-if="coverUploading" class="state-line">正在上传封面...</p>
        <div v-else-if="albumDetailsDraft.coverUrl" class="cover-preview">
          <img :src="albumDetailsDraft.coverUrl" alt="封面预览" class="cover-preview__image" />
          <div class="cover-preview__meta">
            <p class="cover-preview__title">已选择封面</p>
            <p class="cover-preview__sub">最终提交时会携带真实封面资源。</p>
          </div>
        </div>
      </div>

      <div class="field-group" data-testid="album-details-field" data-field="name">
        <PInput
          v-model="albumDetailsDraft.title"
          data-testid="album-details-title-input"
          type="text"
          placeholder="例如 Late Registration"
          label="名字"
        />
      </div>

      <div class="field-group" data-testid="album-details-field" data-field="date">
        <PInput
          v-model="albumDetailsDraft.releaseDate"
          data-testid="album-details-date-input"
          type="date"
          label="日期"
        />
      </div>

      <div class="field-group" data-testid="album-details-field" data-field="type">
        <PSelect
          v-model="albumDetailsDraft.type"
          label="类型"
          :options="[{ label: 'album', value: 'album' }]"
        />
        <input
          v-model="albumDetailsDraft.type"
          data-testid="album-details-type-input"
          type="hidden"
        />
      </div>

      <div class="field-group" data-testid="album-details-field" data-field="bio">
        <PTextarea
          v-model="albumDetailsDraft.bio"
          data-testid="album-details-bio-input"
          :rows="4"
          placeholder="补充专辑简介"
          label="简介"
        />
      </div>

      <section class="track-adjustment" data-testid="album-details-field" data-field="track-adjustment">
        <div class="track-adjustment__header">
          <div>
            <span class="field-label">曲目调整</span>
            <p class="track-adjustment__hint">支持在草稿内调整顺序和删除曲目。</p>
          </div>
          <p class="track-adjustment__count" data-testid="album-details-track-count">{{ orderedTracks.length }} 首</p>
        </div>

        <div v-if="orderedTracks.length" class="track-list">
          <div v-for="(track, index) in orderedTracks" :key="track.id" class="track-row">
            <span class="track-sequence" data-testid="album-track-sequence">{{ formatSequence(track.sequence) }}</span>
            <PInput
              :model-value="track.title"
              data-testid="album-track-title-input"
              class="track-row__input"
              type="text"
              readonly
            />
            <div class="track-row__actions">
              <button
                :data-testid="`album-track-move-up-${track.id}`"
                type="button"
                class="track-action"
                :disabled="index === 0"
                @click="moveTrack(index, -1)"
              >
                上移
              </button>
              <button
                :data-testid="`album-track-move-down-${track.id}`"
                type="button"
                class="track-action"
                :disabled="index === orderedTracks.length - 1"
                @click="moveTrack(index, 1)"
              >
                下移
              </button>
              <button
                :data-testid="`album-track-delete-${track.id}`"
                type="button"
                class="track-action track-action--danger"
                @click="removeTrack(track.id)"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      </section>

      <div class="field-group" data-testid="album-details-field" data-field="source">
        <PTextarea
          v-model="albumDetailsDraft.source"
          data-testid="album-details-source-input"
          :rows="3"
          placeholder="记录资料来源"
          label="来源"
        />
      </div>
    </div>

    <div class="footer-actions" data-testid="album-details-footer">
      <div class="footer-actions__left">
        <button
          data-testid="album-details-close-button"
          type="button"
          class="paper-action"
          @click="closeMusicCreationFlow"
        >
          关闭
        </button>
      </div>
      <div class="footer-actions__right">
        <button
          data-testid="album-details-back-button"
          type="button"
          class="paper-action"
          @click="goBack"
        >
          返回上一步
        </button>
        <button
          data-testid="album-details-finish-button"
          type="button"
          class="paper-submit"
        >
          完成
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.album-details-step {
  display: grid;
  gap: 1rem;
}

.progress-card,
.track-adjustment {
  padding: 1.35rem 1.45rem;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--a-color-ink) 12%, transparent);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.84), rgba(255, 255, 255, 0.72)),
    color-mix(in srgb, var(--a-color-paper-wash) 74%, white);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);
}

.progress-card {
  display: grid;
  gap: 0.75rem;
}

.progress-copy {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.step-kicker,
.progress-label,
.progress-value,
.field-label,
.track-adjustment__hint,
.track-adjustment__count,
.track-sequence,
.track-action {
  font-family: var(--a-font-meta);
}

.step-kicker,
.field-label {
  margin: 0;
  color: var(--a-color-ink-soft);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.progress-label,
.progress-value,
.track-adjustment__count {
  margin: 0;
  color: var(--a-color-ink-soft);
  font-size: 0.82rem;
  font-weight: 800;
}

.progress-track {
  height: 0.5rem;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.72);
}

.progress-steps {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.progress-step {
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 0.78rem;
  font-weight: 800;
}

.progress-step--active {
  color: var(--a-color-ink);
}

.progress-bar {
  width: 100%;
  height: 100%;
  background: color-mix(in srgb, var(--a-color-ink) 92%, #6b4f3a 8%);
}

.field-stack {
  display: grid;
  gap: 1rem;
}

.field-group {
  display: grid;
  gap: 0.45rem;
}

.field-input {
  width: 100%;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-ink) 24%, transparent);
  border-radius: 0;
  padding: 0.25rem 0 0.72rem;
  background: transparent;
  color: var(--a-color-ink);
  font: inherit;
}

.field-input:focus {
  outline: none;
  border-bottom-color: color-mix(in srgb, var(--a-color-ink) 52%, #8b5e3c 18%);
}

.field-input--textarea {
  resize: vertical;
  min-height: 6rem;
  line-height: 1.6;
}

.field-input--file {
  border: 1px dashed color-mix(in srgb, var(--a-color-ink) 16%, transparent);
  padding: 0.85rem 0.95rem;
  color: var(--a-color-ink-soft);
  background: rgba(255, 255, 255, 0.7);
}

.state-line {
  margin: 0;
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 0.82rem;
  font-weight: 800;
}

.state-line--error {
  color: #b42318;
}

.cover-preview {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr);
  gap: 0.85rem;
  align-items: center;
  padding: 0.85rem;
  border: 1px solid color-mix(in srgb, var(--a-color-ink) 10%, transparent);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
}

.cover-preview__image {
  width: 84px;
  height: 84px;
  object-fit: cover;
  border-radius: 6px;
}

.cover-preview__title,
.cover-preview__sub {
  margin: 0;
}

.cover-preview__title {
  font-family: var(--a-font-meta);
  font-size: 0.84rem;
  font-weight: 800;
}

.cover-preview__sub {
  margin-top: 0.25rem;
  color: var(--a-color-ink-soft);
  line-height: 1.5;
  font-size: 0.9rem;
}

.track-adjustment {
  display: grid;
  gap: 0.9rem;
}

.track-adjustment__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.track-adjustment__hint {
  margin: 0.35rem 0 0;
  color: var(--a-color-ink-soft);
  font-size: 0.82rem;
}

.track-list {
  display: grid;
  gap: 0.75rem;
}

.track-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: center;
  padding: 0.85rem;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--a-color-ink) 10%, transparent);
  background: rgba(255, 255, 255, 0.78);
}

.track-sequence {
  min-width: 2rem;
  color: var(--a-color-ink-soft);
  font-size: 0.78rem;
  font-weight: 800;
}

.track-row__input {
  padding-block: 0.7rem;
}

.track-row__actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.track-action {
  border: 0;
  border-radius: 0px;
  padding: 0.65rem 0.95rem;
  background: color-mix(in srgb, var(--a-color-paper-wash) 78%, white);
  color: var(--a-color-ink);
  font-size: 0.8rem;
  font-weight: 800;
  cursor: pointer;
}

.track-action:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.track-action--danger {
  color: #b42318;
}

.footer-actions,
.footer-actions__right {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.footer-actions {
  justify-content: space-between;
  align-items: center;
}

.paper-action,
.paper-submit {
  border: 0;
  border-radius: 0px;
  padding: 0.85rem 1.2rem;
  font-family: var(--a-font-meta);
  font-weight: 800;
  cursor: pointer;
}

.paper-action {
  background: color-mix(in srgb, var(--a-color-paper-wash) 78%, white);
  color: var(--a-color-ink);
}

.paper-submit {
  background: color-mix(in srgb, var(--a-color-ink) 92%, #6b4f3a 8%);
  color: white;
}

@media (max-width: 720px) {
  .progress-copy,
  .track-adjustment__header,
  .track-row {
    grid-template-columns: 1fr;
  }

  .progress-copy,
  .track-adjustment__header {
    display: grid;
  }

  .footer-actions {
    align-items: stretch;
  }
}
</style>
