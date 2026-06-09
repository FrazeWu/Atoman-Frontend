<template>
  <div class="album-editor-shell">
    <APageHeader :title="title" :sub="subtitle" kicker="Music Edit" accent />

    <MusicSection>
      <template #title>
        <h2 class="album-editor-shell__section-title">专辑信息</h2>
      </template>
      <MusicAlbumMetaSection
        :artist="meta.artist"
        :album="meta.album"
        :release-date="meta.releaseDate"
        :album-type="meta.albumType"
        @update:artist="(value) => updateMeta('artist', value)"
        @update:album="(value) => updateMeta('album', value)"
        @update:release-date="(value) => updateMeta('releaseDate', value)"
        @update:album-type="(value) => updateMeta('albumType', value)"
      />
    </MusicSection>

    <MusicSection>
      <template #title>
        <h2 class="album-editor-shell__section-title">封面与曲目</h2>
      </template>
      <div class="album-editor-shell__media-grid">
        <MusicCoverSection :cover="cover" @update:cover="updateCover" @select:file="(file) => $emit('select:coverFile', file)" />
        <MusicTracksSection :tracks="tracks" @update:tracks="(value) => $emit('update:tracks', value)" />
      </div>
    </MusicSection>

    <MusicSection>
      <template #title>
        <h2 class="album-editor-shell__section-title">说明与来源</h2>
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
import APageHeader from '@/components/ui/APageHeader.vue'
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
import type { Artist } from '@/types'

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
const subtitle = computed(() =>
  props.mode === 'create'
    ? '通过拆分后的 section 组件组织专辑创建流程。'
    : '通过拆分后的 section 组件组织专辑修改流程。',
)

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

.album-editor-shell__media-grid,
.album-editor-shell__notes-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

@media (max-width: 960px) {
  .album-editor-shell__media-grid,
  .album-editor-shell__notes-grid {
    grid-template-columns: 1fr;
  }
}
</style>
