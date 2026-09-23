<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { useMusicCreationFlow } from './musicCreationFlowContext'
import MusicCreationAlbumUploadZone from '@/components/music/MusicCreationAlbumUploadZone.vue'
import PInput from '@/components/ui/PInput.vue'
import { listMusicArtists, type MusicArtistListItem } from '@/api/musicV1'

const { state } = useMusicDrawers()
const creationFlowFallback = computed(() => state.value.creationFlow)
const creationFlow = useMusicCreationFlow(creationFlowFallback)
const albumImportDraft = computed(() => creationFlow.value?.draft.albumImport ?? null)
const directAlbumCreation = computed(() => creationFlow.value?.directAlbumCreation === true)
const artistSearchResults = ref<MusicArtistListItem[]>([])
const artistSearchBusy = ref(false)
const artistSearchError = ref('')
const artistSearchRequestId = ref(0)
const selectedArtistName = ref('')
let artistSearchTimer: ReturnType<typeof setTimeout> | null = null

onBeforeUnmount(() => {
  if (artistSearchTimer) clearTimeout(artistSearchTimer)
})
const artistName = computed({
  get: () => creationFlow.value?.draft.artist.stageNames.find((item) => item.isPrimary)?.name ?? '',
  set: (value: string) => {
    const artist = creationFlow.value?.draft.artist.stageNames.find((item) => item.isPrimary)
    if (artist) artist.name = value
  },
})

watch(artistName, (value, previousValue) => {
  if (creationFlow.value?.step !== 'albumImport') return
  if (selectedArtistName.value && value === selectedArtistName.value) {
    selectedArtistName.value = ''
    return
  }
  if (value !== previousValue) {
    creationFlow.value.draft.artist.id = null
    creationFlow.value.artistLookupCompleted = false
  }
  if (artistSearchTimer) clearTimeout(artistSearchTimer)
  const query = value.trim()
  artistSearchError.value = ''
  if (!query) {
    artistSearchResults.value = []
    artistSearchBusy.value = false
    return
  }
  artistSearchTimer = setTimeout(() => void searchArtists(query), 250)
})

async function searchArtists(query: string) {
  const requestId = artistSearchRequestId.value + 1
  artistSearchRequestId.value = requestId
  artistSearchBusy.value = true
  try {
    const result = await listMusicArtists({ q: query, page: 1, page_size: 8 })
    if (requestId !== artistSearchRequestId.value) return
    artistSearchResults.value = result.data
  } catch (error) {
    if (requestId !== artistSearchRequestId.value) return
    artistSearchResults.value = []
    artistSearchError.value = error instanceof Error ? error.message : '搜索艺术家失败'
  } finally {
    if (requestId === artistSearchRequestId.value) artistSearchBusy.value = false
  }
}

function selectArtist(artist: MusicArtistListItem) {
  const flow = creationFlow.value
  if (!flow) return
  flow.draft.artist.id = artist.id
  flow.draft.artist.kind = artist.artist_form === 'group' ? 'group' : 'person'
  flow.draft.artist.avatarUrl = artist.image_url ?? ''
  selectedArtistName.value = artist.display_name || artist.name
  flow.draft.artist.stageNames[0].name = selectedArtistName.value
  flow.artistLookupCompleted = true
  artistSearchResults.value = []
  artistSearchError.value = ''
}

function createArtistDraft() {
  const flow = creationFlow.value
  if (!flow || !artistName.value.trim()) return
  flow.draft.artist.id = null
  flow.artistLookupCompleted = true
  artistSearchResults.value = []
  artistSearchError.value = ''
}
</script>

<template>
  <div v-if="albumImportDraft" class="album-import-step" data-testid="album-import-upload-page">
    <section class="progress-card" aria-label="创建专辑进度">
      <div class="progress-copy">
        <p class="progress-label">{{ directAlbumCreation ? (creationFlow?.artistBeforeMatch ? '第 1 步 / 上传专辑' : '第 3 步 / 匹配') : '第 2 步 / 上传与匹配' }}</p>
        <p class="progress-value">{{ directAlbumCreation ? (creationFlow?.artistBeforeMatch ? '1 / 4' : '3 / 4') : '2 / 3' }}</p>
      </div>
      <div class="progress-steps">
        <template v-if="directAlbumCreation">
          <span class="progress-step progress-step--done">1 上传专辑</span>
          <span class="progress-step" :class="{ 'progress-step--done': !creationFlow?.artistBeforeMatch, 'progress-step--active': creationFlow?.artistBeforeMatch }">2 填写艺术家</span>
          <span class="progress-step" :class="{ 'progress-step--active': !creationFlow?.artistBeforeMatch }">3 匹配</span>
          <span class="progress-step">4 完善专辑信息</span>
        </template>
        <template v-else>
          <span class="progress-step progress-step--done">1 创建艺术家</span>
          <span class="progress-step progress-step--active">2 上传与匹配</span>
          <span class="progress-step">3 完善专辑信息</span>
        </template>
      </div>
      <div class="progress-track" aria-hidden="true">
        <div class="progress-bar" />
      </div>
    </section>

    <header class="album-import-step__header">
      <div>
        <p class="eyebrow">Album creation</p>
        <h2>上传专辑文件</h2>
        <p>上传、元信息匹配和音频处理会分别进行，匹配完成后自动进入专辑信息。</p>
      </div>
    </header>

    <section class="album-card album-card--primary">
      <div class="card-header">
        <div>
          <p class="card-kicker">上传与匹配</p>
          <p class="card-copy">文件选择后立即上传。填写艺术家可提高匹配成功率；读取到曲目后会自动请求外部资料。</p>
        </div>
      </div>
      <PInput
        v-model="artistName"
        label="艺术家（可选）"
        placeholder="输入或补充艺术家名称"
        data-testid="album-import-artist-input"
      />
      <div v-if="artistName.trim()" class="artist-search-results" data-testid="album-import-artist-results">
        <p v-if="artistSearchBusy" class="artist-search-state">搜索中…</p>
        <p v-else-if="artistSearchError" class="artist-search-state artist-search-state--error">{{ artistSearchError }}</p>
        <template v-else-if="artistSearchResults.length">
          <button
            v-for="artist in artistSearchResults"
            :key="artist.id"
            :data-testid="`album-import-artist-option-${artist.id}`"
            type="button"
            class="artist-search-option"
            @mousedown.prevent="selectArtist(artist)"
          >
            <span>{{ artist.display_name || artist.name }}</span>
            <small>{{ artist.artist_form === 'group' ? '组合' : '个人' }}</small>
          </button>
        </template>
        <div v-else class="artist-search-empty">
          <p class="artist-search-state">没有找到已有艺术家</p>
          <button data-testid="album-import-artist-create-draft" type="button" class="ui-action ui-action--inline" @click="createArtistDraft">
            使用“{{ artistName.trim() }}”创建草稿
          </button>
        </div>
      </div>
      <p class="archive-hint">建议优先上传 ZIP、RAR 或 TAR，以便尽早读取曲目目录与元信息。</p>
      <MusicCreationAlbumUploadZone />
    </section>
  </div>
</template>

<style scoped>
.album-import-step {
  display: grid;
  gap: 1rem;
  min-width: 0;
}

.progress-card {
  display: grid;
  gap: 0.8rem;
  padding: 1rem 1.1rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface);
}

.progress-copy {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.progress-label,
.progress-value,
.progress-step {
  margin: 0;
  font-family: var(--a-font-sans);
  font-size: 0.78rem;
  font-weight: 800;
}

.progress-value { color: var(--a-color-muted); }

.progress-steps {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  color: var(--a-color-muted);
}

.progress-step--done,
.progress-step--active { color: var(--a-color-text); }

.progress-step--active { text-decoration: underline; text-decoration-color: var(--a-color-text); text-underline-offset: 0.3rem; }

.progress-track {
  height: 0.25rem;
  overflow: hidden;
  background: var(--a-color-border-soft);
}

.progress-bar {
  width: 66.666%;
  height: 100%;
  background: var(--a-color-text);
}
.archive-hint {
  margin: -0.25rem 0 0;
  color: var(--a-color-muted);
  font-family: var(--a-font-sans);
  font-size: 0.78rem;
}

.album-import-step__header {
  display: grid;
  gap: 0.35rem;
  padding: 0.4rem 0 0.5rem;
}

.eyebrow,
.card-kicker {
  margin: 0;
  color: var(--a-color-muted);
  font-family: var(--a-font-sans);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.album-import-step__header h2 {
  margin: 0;
  color: var(--a-color-text);
  font-family: var(--a-font-sans);
  font-size: clamp(1.4rem, 2.4vw, 2rem);
  line-height: 1.1;
}

.album-import-step__header p:last-child,
.card-copy {
  margin: 0;
  color: var(--a-color-muted);
  line-height: 1.65;
}

.album-card {
  display: grid;
  gap: 1rem;
  padding: 1.15rem 1.2rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
  background: var(--a-color-bg);
}

.album-card--primary { background: var(--a-color-bg); }

.artist-search-results {
  display: grid;
  gap: 0.5rem;
  border-top: 1px solid var(--a-color-border-soft);
  padding-top: 0.75rem;
}

.artist-search-option {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  width: 100%;
  border: 1px solid var(--a-color-border-soft);
  padding: 0.7rem 0.8rem;
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
  text-align: left;
  cursor: pointer;
}

.artist-search-option:hover { border-color: var(--a-color-text); }
.artist-search-option small,
.artist-search-state { color: var(--a-color-muted); }
.artist-search-state { margin: 0; font-size: 0.82rem; }
.artist-search-state--error { color: var(--a-color-accent-destructive); }
.artist-search-empty { display: grid; gap: 0.6rem; justify-items: start; }

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

@media (max-width: 640px) {
  .album-card { padding: 1rem; }
  .progress-steps { display: grid; gap: 0.35rem; }
}
</style>
