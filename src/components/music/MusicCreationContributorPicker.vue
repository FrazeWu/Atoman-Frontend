<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { listMusicArtists, type MusicArtistListItem } from '@/api/musicV1'
import type { MusicArtistKind, MusicCreationAlbumContributorDraft } from './musicCreationTypes'
import PAvatar from '@/components/ui/PAvatar.vue'
import PInput from '@/components/ui/PInput.vue'

const props = defineProps<{
  modelValue: MusicCreationAlbumContributorDraft[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: MusicCreationAlbumContributorDraft[]): void
}>()

const query = ref('')
const loading = ref(false)
const options = ref<MusicCreationAlbumContributorDraft[]>([])
const latestRequestId = ref(0)

const selectedArtistIds = computed(() => new Set(
  props.modelValue
    .map((item) => item.artistId)
    .filter((value): value is string => !!value),
))

function inferArtistKind(artist: MusicArtistListItem): MusicArtistKind {
  return artist.members?.trim() ? 'group' : 'person'
}

function toContributor(artist: MusicArtistListItem): MusicCreationAlbumContributorDraft {
  return {
    id: `contributor-${artist.id}`,
    artistId: artist.id,
    name: artist.name,
    avatarUrl: artist.image_url ?? '',
    kind: inferArtistKind(artist),
    locked: false,
  }
}

async function searchArtists(nextQuery: string) {
  const trimmed = nextQuery.trim()
  if (!trimmed) {
    latestRequestId.value += 1
    loading.value = false
    options.value = []
    return
  }

  const requestId = latestRequestId.value + 1
  latestRequestId.value = requestId
  loading.value = true

  try {
    const result = await listMusicArtists({ q: trimmed, page: 1, page_size: 20 })
    if (requestId !== latestRequestId.value) return
    options.value = result.data
      .map(toContributor)
      .filter((item) => item.artistId && !selectedArtistIds.value.has(item.artistId))
  } catch {
    if (requestId !== latestRequestId.value) return
    options.value = []
  } finally {
    if (requestId === latestRequestId.value) {
      loading.value = false
    }
  }
}

watch(query, (value) => {
  void searchArtists(value)
})

function addContributor(contributor: MusicCreationAlbumContributorDraft) {
  emit('update:modelValue', [...props.modelValue, contributor])
  query.value = ''
  options.value = []
}

function removeContributor(contributorId: string) {
  emit('update:modelValue', props.modelValue.filter((item) => item.id !== contributorId || item.locked))
}

function formatKindLabel(kind: MusicArtistKind) {
  return kind === 'group' ? '组合' : '个人'
}
</script>

<template>
  <div class="contributor-picker">
    <div class="selected-list">
      <div
        v-for="contributor in modelValue"
        :key="contributor.id"
        class="contributor-chip"
        :data-testid="`album-contributor-chip-${contributor.artistId ?? 'new-artist'}`"
      >
        <PAvatar
          :src="contributor.avatarUrl || undefined"
          :name="contributor.name || 'Artist'"
          size="sm"
        />
        <div class="contributor-chip__meta">
          <span class="contributor-chip__name">{{ contributor.name || '未命名艺人' }}</span>
          <span class="contributor-chip__kind">{{ formatKindLabel(contributor.kind) }}</span>
        </div>
        <button
          v-if="!contributor.locked"
          :data-testid="`album-contributor-remove-${contributor.artistId ?? 'new-artist'}`"
          type="button"
          class="contributor-chip__remove"
          @click="removeContributor(contributor.id)"
        >
          移除
        </button>
      </div>
    </div>

    <div class="picker-search">
      <PInput
        v-model="query"
        data-testid="album-contributor-search-input"
        type="text"
        placeholder="搜索已有艺人"
        label="创作者"
      />
    </div>

    <div v-if="query.trim()" class="picker-results">
      <p v-if="loading" class="picker-state">搜索中…</p>
      <p v-else-if="!options.length" class="picker-state">没有匹配的艺人</p>
      <button
        v-for="contributor in options"
        v-else
        :key="contributor.id"
        :data-testid="`album-contributor-option-${contributor.artistId}`"
        type="button"
        class="picker-option"
        @mousedown.prevent="addContributor(contributor)"
      >
        <PAvatar
          :src="contributor.avatarUrl || undefined"
          :name="contributor.name || 'Artist'"
          size="sm"
        />
        <span class="picker-option__name">{{ contributor.name }}</span>
        <span class="picker-option__kind">{{ formatKindLabel(contributor.kind) }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.contributor-picker,
.selected-list,
.picker-results {
  display: grid;
  gap: 0.75rem;
}

.contributor-chip,
.picker-option {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: center;
  padding: 0.8rem 0.9rem;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper-wash);
}

.contributor-chip__meta {
  display: grid;
  gap: 0.15rem;
}

.contributor-chip__name,
.picker-option__name {
  font-weight: 700;
}

.contributor-chip__kind,
.picker-option__kind,
.picker-state {
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 0.78rem;
  font-weight: 800;
}

.contributor-chip__remove,
.picker-option {
  border-radius: 0;
}

.contributor-chip__remove {
  border: 1px solid var(--a-color-line-soft);
  padding: 0.45rem 0.7rem;
  background: var(--a-color-paper);
  color: var(--a-color-ink);
  font-family: var(--a-font-meta);
  font-size: 0.75rem;
  font-weight: 800;
  cursor: pointer;
}

.picker-option {
  border: 1px solid var(--a-color-line-soft);
  width: 100%;
  background: var(--a-color-paper);
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.picker-state {
  margin: 0;
}
</style>
