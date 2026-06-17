<template>
  <PSurface class="music-review-notes" tone="soft" :layer="0">
    <div class="music-review-notes__header">
      <div>
        <h3 class="music-review-notes__title">编辑说明</h3>
        <p class="music-review-notes__hint">说明本次变更内容与审核理由。</p>
      </div>
    </div>

    <PTextarea :model-value="notes.editNote" label="编辑摘要" placeholder="简要说明本次改动" :rows="3" @update:model-value="(value) => updateNotes('editNote', value)" />
    <PTextarea :model-value="notes.reviewNote" label="审核理由" placeholder="为什么这次提交应被接受" :rows="4" @update:model-value="(value) => updateNotes('reviewNote', value)" />
  </PSurface>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PSurface from '@/components/ui/PSurface.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import type { MusicReviewNotesDraft } from './types'

const props = defineProps<{
  notes: MusicReviewNotesDraft
}>()

const emit = defineEmits<{
  (e: 'update:notes', value: MusicReviewNotesDraft): void
}>()

const notes = computed({
  get: () => props.notes,
  set: (value) => emit('update:notes', value),
})

function updateNotes(field: keyof MusicReviewNotesDraft, value: string) {
  notes.value = { ...notes.value, [field]: value }
}
</script>

<style scoped>
.music-review-notes {
  padding: 1rem;
  display: grid;
  gap: 0.75rem;
}

.music-review-notes__title {
  margin: 0;
  font-size: 1rem;
}

.music-review-notes__hint {
  margin: 0.25rem 0 0;
  color: var(--a-color-muted-soft);
  font-size: 0.875rem;
}
</style>
