<template>
  <ASurface class="music-tracks" tone="soft" :layer="0">
    <div class="music-tracks__header">
      <div>
        <h3 class="music-tracks__title">曲目</h3>
        <p class="music-tracks__hint">支持标题编辑、顺序调整和移除。</p>
      </div>
      <ABtn v-if="tracks.length" type="button" variant="ghost" @click="clearTracks">清空</ABtn>
    </div>

    <AEmpty v-if="!tracks.length" description="尚未添加曲目" />

    <div v-else class="music-tracks__list">
      <div v-for="(track, index) in tracks" :key="track.id" class="music-tracks__item">
        <div class="music-tracks__meta">
          <span class="music-tracks__index">{{ index + 1 }}</span>
          <span class="music-tracks__kind">{{ track.isExisting ? '已存在' : '新增' }}</span>
        </div>

        <div class="music-tracks__fields">
          <AInput :model-value="track.title" label="曲目名" placeholder="输入曲目名" @update:model-value="(value) => updateTrack(track.id, 'title', value)" />
          <AInput :model-value="track.trackNumber" label="曲序" placeholder="1" @update:model-value="(value) => updateTrack(track.id, 'trackNumber', value)" />
        </div>

        <div class="music-tracks__actions">
          <PaperClip type="button" :disabled="index === 0" @click="moveTrack(index, -1)">上移</PaperClip>
          <PaperClip type="button" :disabled="index === tracks.length - 1" @click="moveTrack(index, 1)">下移</PaperClip>
          <PaperReject type="button" @click="removeTrack(track.id)">移除</PaperReject>
        </div>
      </div>
    </div>
  </ASurface>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ASurface from '@/components/ui/ASurface.vue'
import ABtn from '@/components/ui/ABtn.vue'
import AEmpty from '@/components/ui/AEmpty.vue'
import AInput from '@/components/ui/AInput.vue'
import PaperClip from '@/components/ui/PaperClip.vue'
import PaperReject from '@/components/ui/PaperReject.vue'
import type { MusicTrackDraft } from './types'

const props = defineProps<{
  tracks: MusicTrackDraft[]
}>()

const emit = defineEmits<{
  (e: 'update:tracks', value: MusicTrackDraft[]): void
}>()

const tracks = computed({
  get: () => props.tracks,
  set: (value) => emit('update:tracks', value),
})

function updateTrack(id: string, field: 'title' | 'trackNumber', value: string) {
  tracks.value = tracks.value.map((track) =>
    track.id === id ? { ...track, [field]: value } : track,
  )
}

function moveTrack(index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= tracks.value.length) return
  const next = [...tracks.value]
  const [current] = next.splice(index, 1)
  next.splice(target, 0, current)
  tracks.value = next
}

function removeTrack(id: string) {
  tracks.value = tracks.value.filter((track) => track.id !== id)
}

function clearTracks() {
  tracks.value = []
}
</script>

<style scoped>
.music-tracks {
  padding: 1rem;
}

.music-tracks__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.music-tracks__title {
  margin: 0;
  font-size: 1rem;
}

.music-tracks__hint {
  margin: 0.25rem 0 0;
  color: var(--a-color-muted-soft);
  font-size: 0.875rem;
}

.music-tracks__list {
  display: grid;
  gap: 0.75rem;
}

.music-tracks__item {
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper);
  padding: 0.875rem;
  display: grid;
  gap: 0.75rem;
}

.music-tracks__meta {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.music-tracks__index,
.music-tracks__kind {
  font-size: 0.75rem;
  color: var(--a-color-muted-soft);
}

.music-tracks__fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 10rem;
  gap: 0.75rem;
}

.music-tracks__actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

@media (max-width: 720px) {
  .music-tracks__fields {
    grid-template-columns: 1fr;
  }
}
</style>
