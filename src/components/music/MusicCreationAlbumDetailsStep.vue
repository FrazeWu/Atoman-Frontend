<script setup lang="ts">
import { computed } from 'vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

const { state, closeMusicCreationFlow, setMusicCreationStep } = useMusicDrawers()

const creationFlow = computed(() => state.value.creationFlow)
const albumDetailsDraft = computed(() => creationFlow.value?.draft.albumDetails ?? null)
const tracksDraft = computed(() => creationFlow.value?.draft.tracks ?? [])

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
      <label class="field-group" data-testid="album-details-field" data-field="cover">
        <span class="field-label">封面</span>
        <input
          data-testid="album-details-cover-input"
          class="field-input field-input--file"
          type="file"
          disabled
        />
      </label>

      <label class="field-group" data-testid="album-details-field" data-field="name">
        <span class="field-label">名字</span>
        <input
          v-model="albumDetailsDraft.title"
          data-testid="album-details-title-input"
          class="field-input"
          type="text"
          placeholder="例如 Late Registration"
        />
      </label>

      <label class="field-group" data-testid="album-details-field" data-field="date">
        <span class="field-label">日期</span>
        <input
          v-model="albumDetailsDraft.releaseDate"
          data-testid="album-details-date-input"
          class="field-input"
          type="date"
        />
      </label>

      <label class="field-group" data-testid="album-details-field" data-field="type">
        <span class="field-label">类型</span>
        <select
          v-model="albumDetailsDraft.type"
          data-testid="album-details-type-input"
          class="field-input"
        >
          <option value="album">album</option>
        </select>
      </label>

      <label class="field-group" data-testid="album-details-field" data-field="bio">
        <span class="field-label">简介</span>
        <textarea
          v-model="albumDetailsDraft.bio"
          data-testid="album-details-bio-input"
          class="field-input field-input--textarea"
          rows="4"
          placeholder="补充专辑简介"
        />
      </label>

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
            <input
              :value="track.title"
              data-testid="album-track-title-input"
              class="field-input track-row__input"
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

      <label class="field-group" data-testid="album-details-field" data-field="source">
        <span class="field-label">来源</span>
        <textarea
          v-model="albumDetailsDraft.source"
          data-testid="album-details-source-input"
          class="field-input field-input--textarea"
          rows="3"
          placeholder="记录资料来源"
        />
      </label>
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
  padding: 1.15rem 1.2rem;
  border-radius: 8px;
  background: color-mix(in srgb, var(--a-color-paper-wash) 74%, white);
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
  gap: 0.9rem;
}

.field-group {
  display: grid;
  gap: 0.4rem;
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

.field-input--textarea {
  resize: vertical;
  min-height: 6rem;
}

.field-input--file {
  padding-block: 0.65rem;
  color: var(--a-color-ink-soft);
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
