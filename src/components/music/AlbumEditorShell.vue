<template>
  <div class="album-editor-shell">
    <PPageHeader :title="title" :sub="subtitle" accent />

    <MusicSection>
      <template #title>
        <h2 class="album-editor-shell__section-title">专辑信息与封面</h2>
      </template>
      <div class="album-editor-shell__meta-cover-grid">
        <MusicAlbumMetaSection
		  :contributors="meta.contributors"
          :album="meta.album"
          :release-date="meta.releaseDate"
          :album-type="meta.albumType"
		  :description="meta.description"
		  @update:contributors="(value) => updateMeta('contributors', value)"
          @update:album="(value) => updateMeta('album', value)"
          @update:release-date="(value) => updateMeta('releaseDate', value)"
          @update:album-type="(value) => updateMeta('albumType', value)"
		  @update:description="(value) => updateMeta('description', value)"
        />
        <MusicCoverSection :cover="cover" @update:cover="updateCover" @select:file="(file) => $emit('select:coverFile', file)" />
      </div>
    </MusicSection>

    <MusicSection>
      <template #title>
        <h2 class="album-editor-shell__section-title">曲目列表</h2>
      </template>
      <MusicTracksSection :tracks="tracks" @update:tracks="(value) => $emit('update:tracks', value)" />
    </MusicSection>

    <MusicSection>
      <template #title>
        <h2 class="album-editor-shell__section-title">补充信息</h2>
      </template>
      <div class="album-editor-shell__notes-grid">
        <MusicReviewNotesSection :notes="notes" @update:notes="(value) => $emit('update:notes', value)" />
        <MusicSourcesSection :sources="sources" @update:sources="(value) => $emit('update:sources', value)" />
      </div>
    </MusicSection>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import MusicAlbumMetaSection from './MusicAlbumMetaSection.vue'
import MusicCoverSection from './MusicCoverSection.vue'
import MusicReviewNotesSection from './MusicReviewNotesSection.vue'
import MusicSection from './MusicSection.vue'
import MusicSourcesSection from './MusicSourcesSection.vue'
import MusicTracksSection from './MusicTracksSection.vue'
import type {
  MusicAlbumMetaDraft,
  MusicCoverDraft,
  MusicReviewNotesDraft,
  MusicSourceDraft,
  MusicTrackDraft,
} from './types'

const props = defineProps<{
  mode: 'create' | 'edit'
  meta: MusicAlbumMetaDraft
  cover: MusicCoverDraft
  tracks: MusicTrackDraft[]
  notes: MusicReviewNotesDraft
  sources: MusicSourceDraft[]
}>()

const emit = defineEmits<{
  (e: 'update:meta', value: MusicAlbumMetaDraft): void
  (e: 'update:cover', value: MusicCoverDraft): void
  (e: 'update:tracks', value: MusicTrackDraft[]): void
  (e: 'update:notes', value: MusicReviewNotesDraft): void
  (e: 'update:sources', value: MusicSourceDraft[]): void
  (e: 'select:coverFile', value: File): void
}>()

const title = computed(() => (props.mode === 'create' ? '新建专辑编辑' : '编辑专辑'))
const subtitle = computed(() => '')

function updateMeta<K extends keyof MusicAlbumMetaDraft>(field: K, value: MusicAlbumMetaDraft[K]) {
  emit('update:meta', { ...props.meta, [field]: value })
}

function updateCover(value: MusicCoverDraft) {
  emit('update:cover', value)
}
</script>

<style scoped>
.album-editor-shell {
  display: grid;
  gap: 2rem;
}

.album-editor-shell__section-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 800;
}

.album-editor-shell__meta-cover-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 240px;
  gap: 1.5rem;
  align-items: start;
}

.album-editor-shell__notes-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

@media (max-width: 768px) {

  .album-editor-shell__meta-cover-grid,
  .album-editor-shell__notes-grid {
    grid-template-columns: 1fr;
  }
}
</style>
