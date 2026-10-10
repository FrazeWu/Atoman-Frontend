<script setup lang="ts">
import { computed } from 'vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { useMusicCreationFlow } from './musicCreationFlowContext'
import MusicCreationAlbumUploadZone from '@/components/music/MusicCreationAlbumUploadZone.vue'
import MusicCreationContributorPicker from './MusicCreationContributorPicker.vue'
import { createEmptyMusicArtistDraft } from './musicCreationTypes'
import { primaryAlbumRole } from '@/utils/musicAlbumCredits'
import { musicCreationProgress } from '@/utils/musicCreationProgress'

const { state } = useMusicDrawers()
const creationFlowFallback = computed(() => state.value.creationFlow)
const creationFlow = useMusicCreationFlow(creationFlowFallback)
const albumImportDraft = computed(() => creationFlow.value?.draft.albumImport ?? null)
const artistFirstFlow = computed(() => creationFlow.value?.artistFirstFlow === true)
const progress = computed(() => musicCreationProgress(creationFlow.value))
function createArtist(name: string) {
  const flow = creationFlow.value
  if (!flow) return
  const id = `new-contributor-${Date.now()}`
  const hasPrimary = flow.draft.albumDetails.contributors.some((item) => item.roles.some((role) => role.role === 'primary'))
  flow.draft.albumDetails.contributors.push({ id, artistId: null, name, avatarUrl: '', kind: 'person', locked: false, newArtistDraft: createEmptyMusicArtistDraft({ name }), roles: hasPrimary ? [{ id: `role-${id}-featured`, role: 'featured', label: '' }] : [primaryAlbumRole(`role-${id}-primary`)] })
  flow.editingContributorId = id
  flow.contributorReturnStep = 'albumImport'
  flow.step = 'artist'
}
</script>

<template>
  <div v-if="albumImportDraft" class="album-import-step" data-testid="album-import-upload-page">
    <section class="progress-card" aria-label="创建专辑进度">
      <div class="progress-copy">
        <p class="progress-label">{{ progress.label }}</p>
        <p class="progress-value">{{ progress.value }}</p>
      </div>
      <div class="progress-steps">
        <span v-for="(step, index) in progress.steps" :key="step.key" class="progress-step" :class="{ 'progress-step--active': index === progress.index }">{{ index + 1 }} {{ step.label }}</span>
      </div>
      <div class="progress-track" aria-hidden="true">
        <div class="progress-bar" :style="{ width: `${(progress.index + 1) / progress.steps.length * 100}%` }" />
      </div>
    </section>

    <header class="album-import-step__header">
      <div>
        <p class="eyebrow">Album creation</p>
        <h2>上传专辑文件</h2>
        <p>读取到曲目后开始识别和匹配；没有艺术家信息时也会继续，全部结束后进入信息填写。</p>
      </div>
    </header>

    <section class="album-card album-card--primary">
      <div class="card-header">
        <div>
          <p class="card-kicker">上传与匹配</p>
          <p class="card-copy">文件选择后立即上传。读取到曲目并确认艺术家后开始核对外部资料。</p>
        </div>
      </div>
      <p class="archive-hint">推荐 ZIP。无法在本地读取的格式将由后台解析后匹配。</p>
      <MusicCreationAlbumUploadZone />
    </section>
    <section v-if="creationFlow && !creationFlow.draft.artist.id" class="album-card" aria-label="匹配艺术家">
      <h3>补充艺术家（可选）</h3>
      <p>可以补充主艺术家；不补充也不影响识别和匹配。</p>
      <MusicCreationContributorPicker v-model="creationFlow.draft.albumDetails.contributors" allow-create @create-artist="createArtist" />
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
  background: var(--a-color-bg);
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
  font-weight: 500;
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
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.album-import-step__header h2 {
  margin: 0;
  color: var(--a-color-text);
  font-family: var(--a-font-sans);
  font-size: clamp(1.4rem, 2.4vw, 2rem);
  font-weight: 500;
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
.artist-search-state--error { color: var(--a-color-danger); }
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
