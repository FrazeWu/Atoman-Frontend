<template>
  <PSurface class="album-meta-card" tone="soft" :layer="0">
    <div class="album-meta-card__grid">
      <div class="album-meta-card__field album-meta-card__field--artists">
        <label class="a-label">艺人</label>
        <ArtistSelect v-model="artistModel" :multiple="true" />
      </div>

      <div class="album-meta-card__field">
        <label class="a-label">专辑名</label>
        <PInput v-model="albumModel" placeholder="输入专辑名" />
      </div>

      <div class="album-meta-card__field">
        <label class="a-label">发行日期</label>
        <PInput v-model="releaseDateModel" type="date" />
      </div>

      <div class="album-meta-card__field">
        <PSelect v-model="albumTypeModel" label="专辑类型" :options="albumTypeOptions" placeholder="未指定" />
      </div>
    </div>
  </PSurface>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PSurface from '@/components/ui/PSurface.vue'
import PInput from '@/components/ui/PInput.vue'
import PSelect from '@/components/ui/PSelect.vue'
import ArtistSelect from './ArtistSelect.vue'
import type { Artist } from '@/types'

const props = defineProps<{
  artist: Artist[]
  album: string
  releaseDate: string
  albumType?: 'single' | 'ep' | 'album'
}>()

const emit = defineEmits<{
  (e: 'update:artist', value: Artist[]): void
  (e: 'update:album', value: string): void
  (e: 'update:releaseDate', value: string): void
  (e: 'update:albumType', value?: 'single' | 'ep' | 'album'): void
}>()

const artistModel = computed({
  get: () => props.artist,
  set: (value) => emit('update:artist', value),
})

const albumModel = computed({
  get: () => props.album,
  set: (value) => emit('update:album', value),
})

const releaseDateModel = computed({
  get: () => props.releaseDate,
  set: (value) => emit('update:releaseDate', value),
})

const albumTypeOptions: Array<{ label: string; value: 'single' | 'ep' | 'album' }> = [
  { label: 'Single', value: 'single' },
  { label: 'EP', value: 'ep' },
  { label: 'Album', value: 'album' },
]

const albumTypeModel = computed({
  get: () => props.albumType ?? '',
  set: (value) => emit('update:albumType', value ? value as 'single' | 'ep' | 'album' : undefined),
})
</script>

<style scoped>
.album-meta-card {
  padding: 1rem;
}

.album-meta-card__grid {
  display: grid;
  gap: 0.875rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.album-meta-card__field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.album-meta-card__field--artists {
  grid-column: 1 / -1;
}

@media (max-width: 720px) {
  .album-meta-card__grid {
    grid-template-columns: 1fr;
  }
}
</style>
