<template>
  <PSurface class="album-meta-card" tone="soft" :layer="0">
    <div class="album-meta-card__grid">
      <div class="album-meta-card__field album-meta-card__field--artists">
		<MusicCreationContributorPicker :model-value="contributors" @update:model-value="$emit('update:contributors', $event)" />
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
		<PInput v-if="albumTypeModel === 'custom'" v-model="customAlbumTypeModel" label="自定义类型" placeholder="输入专辑类型" />
      </div>

      <div class="album-meta-card__field album-meta-card__field--full">
        <PTextarea v-model="descriptionModel" label="专辑简介" placeholder="输入专辑简介" :rows="4" />
      </div>
    </div>
  </PSurface>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PSurface from '@/components/ui/PSurface.vue'
import PInput from '@/components/ui/PInput.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import MusicCreationContributorPicker from './MusicCreationContributorPicker.vue'
import type { MusicCreationAlbumContributorDraft } from './musicCreationTypes'

const props = defineProps<{
	contributors: MusicCreationAlbumContributorDraft[]
  album: string
  releaseDate: string
  albumType?: string
  description: string
}>()

const emit = defineEmits<{
	(e: 'update:contributors', value: MusicCreationAlbumContributorDraft[]): void
  (e: 'update:album', value: string): void
  (e: 'update:releaseDate', value: string): void
  (e: 'update:albumType', value?: string): void
  (e: 'update:description', value: string): void
}>()

const albumModel = computed({
  get: () => props.album,
  set: (value) => emit('update:album', value),
})

const releaseDateModel = computed({
  get: () => props.releaseDate,
  set: (value) => emit('update:releaseDate', value),
})

const knownAlbumTypes = ['album', 'ep', 'single', 'mixtape', 'compilation', 'soundtrack', 'live', 'remix', 'demo']
const albumTypeOptions = [
  { label: '专辑', value: 'album' },
  { label: 'EP', value: 'ep' },
  { label: '单曲', value: 'single' },
  { label: '混音带', value: 'mixtape' },
  { label: '精选集', value: 'compilation' },
  { label: '原声带', value: 'soundtrack' },
  { label: '现场专辑', value: 'live' },
  { label: '重混专辑', value: 'remix' },
  { label: 'Demo', value: 'demo' },
  { label: '自定义', value: 'custom' },
]

const albumTypeModel = computed({
  get: () => knownAlbumTypes.includes(props.albumType ?? '') ? props.albumType : props.albumType ? 'custom' : '',
  set: (value) => emit('update:albumType', value === 'custom' ? 'custom' : value || undefined),
})

const customAlbumTypeModel = computed({
  get: () => props.albumType === 'custom' ? '' : knownAlbumTypes.includes(props.albumType ?? '') ? '' : props.albumType ?? '',
  set: (value) => emit('update:albumType', value),
})

const descriptionModel = computed({
  get: () => props.description,
  set: (value) => emit('update:description', value),
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

.album-meta-card__field--full {
  grid-column: 1 / -1;
}

@media (max-width: 720px) {
  .album-meta-card__grid {
    grid-template-columns: 1fr;
  }
}
</style>
