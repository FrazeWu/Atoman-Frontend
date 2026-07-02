<template>
  <PSurface class="music-review-notes" tone="soft" :layer="0">
    <div class="music-review-notes__header">
      <div>
        <h3 class="music-review-notes__title">说明</h3>
      </div>
    </div>

    <PTextarea :model-value="notes.editNote" label="修改说明" placeholder="填写这次修改的内容" :rows="4" @update:model-value="(value) => updateNotes('editNote', value)" />
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
