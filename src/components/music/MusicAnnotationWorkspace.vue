<template>
  <div class="music-annotation-workspace">
    <MusicAnnotationPanel
      :annotations="annotations"
      :can-write="canWrite"
      :current-user-ids="currentUserIds"
      :total-count="totalCount"
      :selection-mode="selectionMode"
      show-create-action
      @create="emit('create')"
      @vote="(...args) => emit('vote', ...args)"
      @edit="emit('edit', $event)"
      @delete="emit('delete', $event)"
      @rebind="emit('rebind', $event)"
    />

    <MusicAnnotationEditor
      v-if="canWrite"
      :show="editorVisible"
      :selected-text="selectedText"
      :initial-body="initialBody"
      :mode="editorMode"
      @save="emit('save', $event)"
      @cancel="emit('cancel')"
      @confirm-rebind="emit('confirm-rebind')"
    />
  </div>
</template>

<script setup lang="ts">
import type { MusicLyricsAnnotation, MusicLyricsAnnotationVote } from '@/api/musicV1'
import MusicAnnotationEditor from '@/components/music/MusicAnnotationEditor.vue'
import MusicAnnotationPanel from '@/components/music/MusicAnnotationPanel.vue'

withDefaults(defineProps<{
  annotations?: MusicLyricsAnnotation[]
  canWrite?: boolean
  currentUserIds?: string[]
  totalCount?: number
  selectionMode?: boolean
  editorVisible?: boolean
  selectedText?: string
  initialBody?: string
  editorMode?: 'create' | 'edit' | 'rebind'
}>(), {
  annotations: () => [],
  canWrite: false,
  currentUserIds: () => [],
  totalCount: 0,
  selectionMode: false,
  editorVisible: false,
  selectedText: '',
  initialBody: '',
  editorMode: 'create',
})

const emit = defineEmits<{
  create: []
  vote: [annotationId: string, vote: MusicLyricsAnnotationVote | null]
  edit: [annotation: MusicLyricsAnnotation]
  delete: [annotationId: string]
  rebind: [annotation: MusicLyricsAnnotation]
  save: [body: string]
  cancel: []
  'confirm-rebind': []
}>()
</script>

<style scoped>
.music-annotation-workspace {
  min-height: 0;
  display: grid;
  align-content: start;
  gap: 1rem;
}
</style>
