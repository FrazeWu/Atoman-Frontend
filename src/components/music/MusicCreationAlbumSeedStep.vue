<script setup lang="ts">
import { computed } from 'vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { useMusicCreationFlow } from './musicCreationFlowContext'
import MusicCreationAlbumUploadZone from '@/components/music/MusicCreationAlbumUploadZone.vue'
import PInput from '@/components/ui/PInput.vue'

const { state } = useMusicDrawers()
const creationFlowFallback = computed(() => state.value.creationFlow)
const creationFlow = useMusicCreationFlow(creationFlowFallback)
const albumImportDraft = computed(() => creationFlow.value?.draft.albumImport ?? null)
const directAlbumCreation = computed(() => creationFlow.value?.directAlbumCreation === true)
const artistName = computed({
  get: () => creationFlow.value?.draft.artist.stageNames.find((item) => item.isPrimary)?.name ?? '',
  set: (value: string) => {
    const artist = creationFlow.value?.draft.artist.stageNames.find((item) => item.isPrimary)
    if (artist) artist.name = value
  },
})
</script>

<template>
  <div v-if="albumImportDraft" class="album-import-step" data-testid="album-import-upload-page">
    <section class="progress-card" aria-label="创建专辑进度">
      <div class="progress-copy">
        <p class="progress-label">{{ directAlbumCreation ? (creationFlow?.artistBeforeMatch ? '第 1 步 / 上传专辑' : '第 3 步 / 匹配') : '第 2 步 / 上传与匹配' }}</p>
        <p class="progress-value">{{ directAlbumCreation ? (creationFlow?.artistBeforeMatch ? '1 / 4' : '3 / 4') : '2 / 3' }}</p>
      </div>
      <div class="progress-steps">
        <template v-if="directAlbumCreation">
          <span class="progress-step progress-step--done">1 上传专辑</span>
          <span class="progress-step" :class="{ 'progress-step--done': !creationFlow?.artistBeforeMatch, 'progress-step--active': creationFlow?.artistBeforeMatch }">2 填写艺术家</span>
          <span class="progress-step" :class="{ 'progress-step--active': !creationFlow?.artistBeforeMatch }">3 匹配</span>
          <span class="progress-step">4 完善专辑信息</span>
        </template>
        <template v-else>
          <span class="progress-step progress-step--done">1 创建艺术家</span>
          <span class="progress-step progress-step--active">2 上传与匹配</span>
          <span class="progress-step">3 完善专辑信息</span>
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
          <p class="card-copy">文件选择后立即上传。填写艺术家可提高匹配成功率，点击下方“开始匹配”后才会请求外部资料。</p>
        </div>
      </div>
      <PInput
        v-model="artistName"
        label="艺术家（可选）"
        placeholder="输入或补充艺术家名称"
        data-testid="album-import-artist-input"
      />
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
  width: 66.666%;
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
