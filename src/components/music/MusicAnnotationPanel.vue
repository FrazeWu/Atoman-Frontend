<template>
  <aside class="music-annotation-panel">
    <header class="music-annotation-panel__header">
      <div>
        <h3>{{ title }}</h3>
        <span class="music-annotation-panel__count">{{ displayCount }} 条注释</span>
      </div>
      <PButton
        v-if="showCreateAction"
        type="button"
        size="sm"
        :variant="selectionMode ? 'primary' : 'secondary'"
        data-testid="annotation-create-trigger"
        @click="emit('create')"
      >
        <Plus :size="16" aria-hidden="true" />
        {{ selectionMode ? '选择歌词' : '添加注释' }}
      </PButton>
    </header>

    <p v-if="selectionMode" class="music-annotation-panel__hint" role="status">
      选择歌词片段，或点击某行的“注释”。
    </p>

    <p v-else-if="!annotations.length" class="music-annotation-panel__empty">
      {{ displayCount ? '选择带标记的歌词查看注释' : '暂无注释' }}
    </p>

    <PInteractionCard
      v-for="annotation in annotations"
      :key="annotation.id"
      class="music-annotation-card"
      variant="default"
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
          v-if="annotation.status === 'needs_rebind'"
          type="button"
          size="lg"
          variant="ghost"
          class="music-annotation-card__rebind"
          :data-testid="`annotation-rebind-${annotation.id}`"
          :aria-label="`重新绑定注释：${annotation.selected_text}`"
          @click="emit('rebind', annotation)"
        >
          重新绑定
        </PButton>
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

      <p v-if="annotation.status === 'needs_rebind'" class="music-annotation-card__status">
        待重新绑定
      </p>
    </PInteractionCard>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Plus } from 'lucide-vue-next'
import type { MusicLyricsAnnotation, MusicLyricsAnnotationVote } from '@/api/musicV1'
import PButton from '@/components/ui/PButton.vue'
import PInteractionCard from '@/components/ui/PInteractionCard.vue'

const props = withDefaults(defineProps<{
  annotations?: MusicLyricsAnnotation[]
  canWrite?: boolean
  currentUserIds?: string[]
  title?: string
  totalCount?: number
  showCreateAction?: boolean
  selectionMode?: boolean
}>(), {
  annotations: () => [],
  canWrite: false,
  currentUserIds: () => [],
  title: '解析',
  showCreateAction: false,
  selectionMode: false,
})

const emit = defineEmits<{
  vote: [annotationId: string, vote: MusicLyricsAnnotationVote | null]
  edit: [annotation: MusicLyricsAnnotation]
  delete: [annotationId: string]
  rebind: [annotation: MusicLyricsAnnotation]
  create: []
}>()

const displayCount = computed(() => props.totalCount ?? props.annotations.length)

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
  background: var(--a-color-bg);
}

.music-annotation-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.music-annotation-panel__header > div {
  display: grid;
  gap: 0.2rem;
}

.music-annotation-panel__header h3 {
  margin: 0;
  color: var(--a-color-text);
  font-size: 1rem;
  font-weight: 900;
}

.music-annotation-panel__count,
.music-annotation-panel__empty,
.music-annotation-panel__hint,
.music-annotation-card__score,
.music-annotation-card__status {
  color: var(--a-color-muted);
  font-size: 0.82rem;
}

.music-annotation-panel__empty,
.music-annotation-panel__hint {
  margin: 0;
  line-height: 1.5;
}

.music-annotation-card__status {
  margin: 0;
}

.music-annotation-card {
  display: grid;
  gap: 0.75rem;
}

.music-annotation-card:hover {
  border-color: var(--a-color-muted-soft);
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

.music-annotation-card__rebind {
  min-width: 44px;
  min-height: 44px;
}
</style>
