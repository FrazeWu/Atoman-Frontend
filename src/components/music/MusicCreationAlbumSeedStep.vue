<script setup lang="ts">
import { computed } from 'vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { useMusicCreationFlow } from './musicCreationFlowContext'
import MusicCreationAlbumUploadZone from '@/components/music/MusicCreationAlbumUploadZone.vue'

const { state } = useMusicDrawers()
const creationFlowFallback = computed(() => state.value.creationFlow)
const creationFlow = useMusicCreationFlow(creationFlowFallback)
const albumImportDraft = computed(() => creationFlow.value?.draft.albumImport ?? null)
const artistFirstFlow = computed(() => creationFlow.value?.artistFirstFlow === true)
</script>

<template>
  <div v-if="albumImportDraft" class="album-import-step" data-testid="album-import-upload-page">
    <section class="progress-card" aria-label="创建专辑进度">
      <div class="progress-copy">
        <p class="progress-label">{{ artistFirstFlow ? '第 2 步 / 上传与匹配' : '第 1 步 / 上传与匹配' }}</p>
        <p class="progress-value">{{ artistFirstFlow ? '2 / 3' : '1 / 2' }}</p>
      </div>
      <div class="progress-steps">
        <template v-if="artistFirstFlow">
          <span class="progress-step progress-step--done">1 创建艺术家</span>
          <span class="progress-step progress-step--active">2 上传与匹配</span>
          <span class="progress-step">3 完善专辑信息</span>
        </template>
        <template v-else>
          <span class="progress-step progress-step--active">1 上传与匹配</span>
          <span class="progress-step">2 完善专辑信息</span>
        </template>
      </div>
      <div class="progress-track" aria-hidden="true">
        <div class="progress-bar" />
      </div>
    </section>

    <header class="album-import-step__header">
      <div>
        <p class="eyebrow">Album creation</p>
        <h2>上传专辑文件</h2>
        <p>上传、元信息匹配和音频处理会分别进行，匹配完成后自动进入专辑信息。</p>
      </div>
    </header>

    <section class="album-card album-card--primary">
      <div class="card-header">
        <div>
          <p class="card-kicker">上传与匹配</p>
          <p class="card-copy">文件选择后立即上传。读取到曲目和内嵌元信息后会自动请求外部资料。</p>
        </div>
      </div>
      <p class="archive-hint">建议优先上传 ZIP、RAR 或 TAR，以便尽早读取曲目目录与元信息。</p>
      <MusicCreationAlbumUploadZone />
    </section>
  </div>
</template>

<style scoped>
.album-import-step {
  display: grid;
  gap: 1rem;
  min-width: 0;
}

.progress-card {
  display: grid;
  gap: 0.8rem;
  padding: 1rem 1.1rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface);
}

.progress-copy {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.progress-label,
.progress-value,
.progress-step {
  margin: 0;
  font-family: var(--a-font-sans);
  font-size: 0.78rem;
  font-weight: 800;
}

.progress-value { color: var(--a-color-muted); }

.progress-steps {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  color: var(--a-color-muted);
}

.progress-step--done,
.progress-step--active { color: var(--a-color-text); }

.progress-step--active { text-decoration: underline; text-decoration-color: var(--a-color-text); text-underline-offset: 0.3rem; }

.progress-track {
  height: 0.25rem;
  overflow: hidden;
  background: var(--a-color-border-soft);
}

.progress-bar {
  width: 50%;
  height: 100%;
  background: var(--a-color-text);
}
.archive-hint {
  margin: -0.25rem 0 0;
  color: var(--a-color-muted);
  font-family: var(--a-font-sans);
  font-size: 0.78rem;
}

.album-import-step__header {
  display: grid;
  gap: 0.35rem;
  padding: 0.4rem 0 0.5rem;
}

.eyebrow,
.card-kicker {
  margin: 0;
  color: var(--a-color-muted);
  font-family: var(--a-font-sans);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.album-import-step__header h2 {
  margin: 0;
  color: var(--a-color-text);
  font-family: var(--a-font-sans);
  font-size: clamp(1.4rem, 2.4vw, 2rem);
  line-height: 1.1;
}

.album-import-step__header p:last-child,
.card-copy {
  margin: 0;
  color: var(--a-color-muted);
  line-height: 1.65;
}

.album-card {
  display: grid;
  gap: 1rem;
  padding: 1.15rem 1.2rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
  background: var(--a-color-bg);
}

.album-card--primary { background: var(--a-color-bg); }

.artist-search-results {
  display: grid;
  gap: 0.5rem;
  border-top: 1px solid var(--a-color-border-soft);
  padding-top: 0.75rem;
}

.artist-search-selected {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border-top: 1px solid var(--a-color-border-soft);
  padding-top: 0.75rem;
}

.artist-search-selected > span {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.artist-search-selected strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.artist-search-selected small { color: var(--a-color-muted); }

.artist-search-option {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 1rem;
  align-items: center;
  width: 100%;
  border: 1px solid var(--a-color-border-soft);
  padding: 0.7rem 0.8rem;
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
  text-align: left;
  cursor: pointer;
}

.artist-search-option:hover { border-color: var(--a-color-text); }
.artist-search-option__body {
  display: grid;
  min-width: 0;
  gap: 0.2rem;
}

.artist-search-option__body strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--a-font-sans);
  font-size: 0.9rem;
}

.artist-search-option small,
.artist-search-state { color: var(--a-color-muted); }
.artist-search-option__description {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.artist-search-state { margin: 0; font-size: 0.82rem; }
.artist-search-state--error { color: var(--a-color-accent-destructive); }
.artist-search-empty { display: grid; gap: 0.6rem; justify-items: start; }

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

@media (max-width: 640px) {
  .album-card { padding: 1rem; }
  .progress-steps { display: grid; gap: 0.35rem; }
}
</style>
