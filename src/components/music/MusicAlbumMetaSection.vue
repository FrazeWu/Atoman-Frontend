<template>
  <PSurface class="album-meta-card" tone="soft" :layer="0">
    <div class="album-meta-card__layout">
      <div class="album-meta-card__fields">
        <div class="album-meta-card__field album-meta-card__field--inline">
          <PInput v-model="albumModel" label="专辑名" placeholder="输入专辑名" />
        </div>

        <div class="album-meta-card__field album-meta-card__field--artists">
		  <MusicCreationContributorPicker :model-value="contributors" @update:model-value="$emit('update:contributors', $event)" />
        </div>

        <div class="album-meta-card__row-two-col">
          <div class="album-meta-card__field album-meta-card__field--inline">
            <PMaskedDateInput v-model="releaseDatePartsModel" label="日期" />
          </div>

          <div class="album-meta-card__field album-meta-card__field--inline">
            <PSelect v-model="albumTypeModel" label="类型" :options="albumTypeOptions" placeholder="未指定" />
            <PInput v-if="albumTypeModel === 'custom'" v-model="customAlbumTypeModel" label="自定义类型" placeholder="输入专辑类型" />
          </div>
        </div>
      </div>

      <div class="album-meta-card__description">
        <PTextarea v-model="descriptionModel" label="简介" placeholder="输入专辑简介" :rows="4" />
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
import PMaskedDateInput from '@/components/ui/PMaskedDateInput.vue'
import { parsePartialDateParts, serializePartialDate } from '@/components/music/birthDateMask'
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

const releaseDatePartsModel = computed({
	get: () => parsePartialDateParts(props.releaseDate),
	set: (value) => emit('update:releaseDate', serializePartialDate(value)),
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
  padding: 0;
}

.album-meta-card__layout {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(240px, 0.95fr);
  gap: 1.25rem;
  align-items: stretch;
}

.album-meta-card__fields {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
  padding: 1.25rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  border-radius: var(--a-radius-card);
  box-shadow: var(--a-shadow-sm);
}

.album-meta-card__field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.album-meta-card__field--inline :deep(.p-field),
.album-meta-card__field--artists :deep(.picker-search .p-field),
.album-meta-card__row-two-col > .album-meta-card__field--inline :deep(.p-field) {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  align-items: center;
  gap: 0.75rem;
}

.album-meta-card__field--inline :deep(.p-field-label),
.album-meta-card__field--artists :deep(.p-field-label),
.album-meta-card__row-two-col :deep(.field-label) {
  margin: 0;
  white-space: nowrap;
}

.album-meta-card__field--inline :deep(.p-field-label)::after,
.album-meta-card__field--artists :deep(.p-field-label)::after,
.album-meta-card__row-two-col :deep(.field-label)::after {
  content: '：';
}

.album-meta-card__row-two-col {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  min-width: 0;
}

.album-meta-card__row-two-col > .album-meta-card__field--inline :deep(.p-date-input-container) {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  align-items: center;
  gap: 0.75rem;
}

.album-meta-card__description {
  display: flex;
  min-height: 100%;
  padding: 1.25rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  border-radius: var(--a-radius-card);
  box-shadow: var(--a-shadow-sm);
}

.album-meta-card__description :deep(.p-field) {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.album-meta-card__description :deep(.p-textarea-wrapper) {
  display: flex;
  flex: 1;
  min-height: 0;
}

.album-meta-card__description :deep(.p-textarea) {
  flex: 1;
  min-height: 12rem;
  resize: vertical;
}

@media (max-width: 768px) {
  .album-meta-card__layout,
  .album-meta-card__row-two-col {
    grid-template-columns: 1fr;
  }
}
</style>
