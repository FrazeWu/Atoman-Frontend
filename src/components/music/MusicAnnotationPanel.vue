<template>
  <aside class="music-annotation-panel">
    <header class="music-annotation-panel__header">
      <h3>注释</h3>
      <span class="music-annotation-panel__count">{{ annotations.length }}</span>
    </header>

    <p v-if="!annotations.length" class="music-annotation-panel__empty">
      暂无注释
    </p>

    <article
      v-for="annotation in annotations"
      :key="annotation.id"
      class="music-annotation-card"
    >
      <p v-if="annotation.selected_text" class="music-annotation-card__quote">
        “{{ annotation.selected_text }}”
      </p>
      <p class="music-annotation-card__body">
        {{ annotation.body }}
      </p>

      <div class="music-annotation-card__meta">
        <button
          v-if="canWrite"
          type="button"
          class="music-annotation-card__vote"
          :class="{ 'is-active': annotation.viewer_vote === 'up' }"
          @click="emit('vote', annotation.id, annotation.viewer_vote === 'up' ? null : 'up')"
        >
          赞 {{ annotation.upvotes }}
        </button>
        <button
          v-if="canWrite"
          type="button"
          class="music-annotation-card__vote"
          :class="{ 'is-active': annotation.viewer_vote === 'down' }"
          @click="emit('vote', annotation.id, annotation.viewer_vote === 'down' ? null : 'down')"
        >
          踩 {{ annotation.downvotes }}
        </button>
        <span class="music-annotation-card__score">净 {{ annotationScore(annotation) }}</span>
      </div>

      <div v-if="canWrite && canManageAnnotation(annotation)" class="music-annotation-card__actions">
        <PButton
          type="button"
          size="sm"
          variant="ghost"
          @click="emit('edit', annotation)"
        >
          编辑
        </PButton>
        <PButton
          type="button"
          size="sm"
          variant="ghost"
          @click="emit('delete', annotation.id)"
        >
          删除
        </PButton>
      </div>
    </article>
  </aside>
</template>

<script setup lang="ts">
import type { MusicLyricsAnnotation, MusicLyricsAnnotationVote } from '@/api/musicV1'
import PButton from '@/components/ui/PButton.vue'

const props = withDefaults(defineProps<{
  annotations?: MusicLyricsAnnotation[]
  canWrite?: boolean
  currentUserIds?: string[]
}>(), {
  annotations: () => [],
  canWrite: false,
  currentUserIds: () => [],
})

const emit = defineEmits<{
  vote: [annotationId: string, vote: MusicLyricsAnnotationVote | null]
  edit: [annotation: MusicLyricsAnnotation]
  delete: [annotationId: string]
}>()

function collectIdentityValues(value: Record<string, unknown> | null | undefined) {
  if (!value) return []

  return [value.id, value.uuid]
    .filter((candidate) => candidate !== null && candidate !== undefined && candidate !== '')
    .map((candidate) => String(candidate))
}

function canManageAnnotation(annotation: MusicLyricsAnnotation) {
  if (props.currentUserIds.length === 0) return false

  const creatorIds = collectIdentityValues(annotation.creator as Record<string, unknown> | null)
  return creatorIds.some((creatorId) => props.currentUserIds.includes(creatorId))
}

function annotationScore(annotation: MusicLyricsAnnotation) {
  return annotation.upvotes - annotation.downvotes
}
</script>

<style scoped>
.music-annotation-panel {
  display: grid;
  align-content: start;
  gap: 1rem;
  padding: 1rem;
  border-left: 1px solid var(--a-color-border-soft);
  background: color-mix(in srgb, var(--a-color-bg) 84%, #f3eadc 16%);
  overflow: auto;
}

.music-annotation-panel__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.music-annotation-panel__header h3 {
  margin: 0;
  color: var(--a-color-text);
  font-size: 1rem;
  font-weight: 900;
}

.music-annotation-panel__count,
.music-annotation-panel__empty,
.music-annotation-card__score {
  color: var(--a-color-muted);
  font-size: 0.82rem;
}

.music-annotation-card {
  display: grid;
  gap: 0.75rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.music-annotation-card__quote {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.82rem;
  line-height: 1.5;
}

.music-annotation-card__body {
  margin: 0;
  color: var(--a-color-text);
  line-height: 1.65;
}

.music-annotation-card__meta,
.music-annotation-card__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.music-annotation-card__vote {
  border: 1px solid var(--a-color-border-soft);
  background: transparent;
  color: var(--a-color-muted);
  padding: 0.35rem 0.55rem;
  cursor: pointer;
  font: inherit;
}

.music-annotation-card__vote.is-active {
  border-color: var(--a-color-text);
  color: var(--a-color-text);
}
</style>
