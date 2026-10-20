<script setup lang="ts">
import type { MusicLyricsVersionDiffKind } from '@/utils/musicLyricsVersionDiff'

export interface MusicLyricsVersionPreviewData {
  version: number
  affectedActiveAnnotationCount: number
  lines: Array<{
    kind: MusicLyricsVersionDiffKind
    currentIndex?: number
    targetIndex?: number
    current?: { text: string; translation?: string }
    target?: { text: string; translation?: string }
  }>
}

defineProps<{
  versions: any[]
  versionsLoading: boolean
  versionsErrorMessage: string
  versionsSongId: string
  songId: string
  selectedVersionPreview: MusicLyricsVersionPreviewData | null
  saving: boolean
  reverting: boolean
}>()

const emit = defineEmits<{
  (e: 'select-preview', version: number): void
  (e: 'revert', version: number): void
}>()

function versionDiffLabel(kind: MusicLyricsVersionDiffKind) {
  return {
    unchanged: '未变更',
    added: '新增',
    removed: '删除',
    modified: '修改',
  }[kind]
}
</script>

<template>
  <div class="music-lyrics-panel__versions">
    <p v-if="versionsLoading" class="music-lyrics-panel__placeholder">正在加载版本</p>
    <p v-else-if="versionsErrorMessage" class="music-lyrics-panel__placeholder">{{ versionsErrorMessage }}</p>
    <p v-else-if="versionsSongId !== songId || !versions.length" class="music-lyrics-panel__placeholder">暂无版本</p>
    <div v-else class="music-lyrics-panel__version-list">
      <article
        v-for="version in versions"
        :key="version.id || version.version"
        class="music-lyrics-panel__version"
      >
        <div>
          <strong>第 {{ version.version }} 版</strong>
          <span>{{ version.edit_summary || '歌词更新' }}</span>
        </div>
        <button
          type="button"
          class="music-lyrics-panel__version-action"
          :data-testid="`lyrics-version-preview-${version.version}`"
          @click="emit('select-preview', version.version)"
        >
          预览
        </button>

        <div
          v-if="selectedVersionPreview && selectedVersionPreview.version === version.version"
          class="music-lyrics-panel__version-preview"
          :data-testid="`lyrics-version-diff-${version.version}`"
        >
          <p class="music-lyrics-panel__version-impact">
            {{ selectedVersionPreview.affectedActiveAnnotationCount }} 条注释需重新绑定
          </p>
          <div class="music-lyrics-panel__version-diff-lines">
            <p
              v-for="(line, index) in selectedVersionPreview.lines"
              :key="`${line.kind}-${line.currentIndex ?? ''}-${line.targetIndex ?? ''}-${index}`"
              class="music-lyrics-panel__version-diff-line"
              :class="[
                `is-${line.kind}`,
                { 'is-translation-only': line.kind === 'modified' && line.current?.text === line.target?.text },
              ]"
            >
              <span>{{ versionDiffLabel(line.kind) }}</span>
              <template v-if="line.kind === 'modified' && line.current && line.target && line.current.text === line.target.text">
                <span class="music-lyrics-panel__version-diff-original">{{ line.current.text }}</span>
                <del class="music-lyrics-panel__version-diff-translation">当前译文：{{ line.current.translation || '无译文' }}</del>
                <ins class="music-lyrics-panel__version-diff-translation">目标译文：{{ line.target.translation || '无译文' }}</ins>
              </template>
              <template v-else>
                <del v-if="line.current && line.kind !== 'unchanged'">{{ line.current.text }}</del>
                <ins v-if="line.target && line.kind !== 'removed'">{{ line.target.text }}</ins>
              </template>
            </p>
          </div>
          <button
            type="button"
            class="music-lyrics-panel__version-action"
            :disabled="saving || reverting"
            :data-testid="`lyrics-revert-version-${version.version}`"
            @click="emit('revert', version.version)"
          >
            确认恢复
          </button>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.music-lyrics-panel__placeholder {
  margin: 0;
  color: var(--a-color-muted);
}

.music-lyrics-panel__versions {
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface-muted);
  border-radius: var(--a-radius-card, 4px);
  padding: 1rem;
}

.music-lyrics-panel__version-list {
  display: grid;
  gap: 0.5rem;
}

.music-lyrics-panel__version {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  color: var(--a-color-text);
}

.music-lyrics-panel__version div {
  display: grid;
  gap: 0.2rem;
}

.music-lyrics-panel__version span {
  color: var(--a-color-muted);
  font-size: 0.82rem;
}

.music-lyrics-panel__version-action {
  border: 0;
  background: transparent;
  color: var(--a-color-text);
  cursor: pointer;
  font-family: var(--a-font-sans);
  font-size: 0.72rem;
  font-weight: 500;
  border-radius: var(--a-radius-control, 4px);
  padding: 0.3rem 0.75rem;
  box-shadow: none;
  transition: background 0.2s ease;
}

.music-lyrics-panel__version-action:hover:not(:disabled) {
  background: color-mix(in srgb, var(--a-color-text) 10%, transparent);
}

.music-lyrics-panel__version-action:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.music-lyrics-panel__version-preview {
  grid-column: 1 / -1;
  display: grid;
  gap: 0.6rem;
  border-top: 1px solid var(--a-color-border-soft);
  padding-top: 0.75rem;
}

.music-lyrics-panel__version-impact {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.82rem;
}

.music-lyrics-panel__version-diff-lines {
  display: grid;
  gap: 0.25rem;
  max-height: 14rem;
  overflow: auto;
}

.music-lyrics-panel__version-diff-line {
  display: flex;
  gap: 0.5rem;
  margin: 0;
  color: var(--a-color-text);
  font-size: 0.82rem;
  line-height: 1.5;
}

.music-lyrics-panel__version-diff-line > span {
  flex: 0 0 3rem;
  color: var(--a-color-muted);
  font-weight: 600;
}

.music-lyrics-panel__version-diff-line del,
.music-lyrics-panel__version-diff-line ins {
  text-decoration: none;
}

.music-lyrics-panel__version-diff-line.is-added ins {
  color: var(--a-color-success);
}

.music-lyrics-panel__version-diff-line.is-removed del {
  color: var(--a-color-danger);
}

.music-lyrics-panel__version-diff-line.is-modified del {
  color: var(--a-color-danger);
}

.music-lyrics-panel__version-diff-line.is-modified ins {
  color: var(--a-color-success);
}

.music-lyrics-panel__version-diff-line.is-translation-only {
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr);
}

.music-lyrics-panel__version-diff-line.is-translation-only > span:first-child {
  grid-column: 1;
}

.music-lyrics-panel__version-diff-original,
.music-lyrics-panel__version-diff-translation {
  grid-column: 2;
}
</style>
