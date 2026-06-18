<!-- web/src/components/music/NestedActionDrawer.vue -->
<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import PSheet from '@/components/ui/PSheet.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import {
  buildCreateAlbumEdit,
  buildCreateArtistEdit,
  buildUpdateAlbumEdit,
  buildUpdateArtistEdit,
  listMusicArtists,
  type MusicArtistListItem,
  submitMusicEdit,
  type MusicSource,
  uploadMusicAsset,
} from '@/api/musicV1'

const { state, closeNestedAction } = useMusicDrawers()
const isOpen = computed(() => state.value.nestedAction !== null)

const titleMap: Record<string, string> = {
  revise: '修订专辑',
  revise_artist: '修订艺术家',
  history: '版本历史',
  add_album: '添加新专辑',
  add_artist: '新建艺术家',
  discussion: '社区讨论'
}

const displayTitle = computed(() => titleMap[state.value.nestedAction || ''] || 'Action')

const artistDraft = reactive({
  name: '',
  bio: '',
  imageUrl: '',
  nationality: '',
  birthDate: '',
  birthYear: '',
  reason: '',
  sourceUrl: '',
})

const albumDraft = reactive({
  title: '',
  releaseDate: '',
  albumType: 'album',
  description: '',
  reason: '',
})

const albumArtistSearch = ref('')
const albumArtistResults = ref<MusicArtistListItem[]>([])
const selectedAlbumArtists = ref<MusicArtistListItem[]>([])
const artistSearchLoading = ref(false)

const sourceDraft = reactive({
  title: '',
  url: '',
})

const submitting = ref(false)
const uploadingAvatar = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const isArtistForm = computed(() => state.value.nestedAction === 'add_artist' || state.value.nestedAction === 'revise_artist')
const isCreateArtistForm = computed(() => state.value.nestedAction === 'add_artist')
const isAlbumForm = computed(() => state.value.nestedAction === 'add_album' || state.value.nestedAction === 'revise')
const needsAlbumArtistSelection = computed(() => state.value.nestedAction === 'add_album' && !state.value.artistId)
const canSubmit = computed(() => !submitting.value && (isArtistForm.value || isAlbumForm.value))

const artistRegionOptions = [
  { value: '', label: '未选择' },
  { value: 'CN', label: '中国大陆' },
  { value: 'HK', label: '中国香港' },
  { value: 'TW', label: '中国台湾' },
  { value: 'JP', label: '日本' },
  { value: 'KR', label: '韩国' },
  { value: 'US', label: '美国' },
  { value: 'GB', label: '英国' },
  { value: 'FR', label: '法国' },
  { value: 'DE', label: '德国' },
  { value: 'OTHER', label: '其他' },
]

watch(() => state.value.nestedAction, () => {
  errorMessage.value = ''
  successMessage.value = ''
  artistDraft.name = ''
  artistDraft.bio = ''
  artistDraft.imageUrl = ''
  artistDraft.nationality = ''
  artistDraft.birthDate = ''
  artistDraft.birthYear = ''
  artistDraft.reason = ''
  artistDraft.sourceUrl = ''
  albumDraft.title = ''
  albumDraft.releaseDate = ''
  albumDraft.albumType = 'album'
  albumDraft.description = ''
  albumDraft.reason = ''
  albumArtistSearch.value = ''
  albumArtistResults.value = []
  selectedAlbumArtists.value = []
  sourceDraft.title = ''
  sourceDraft.url = ''
})

function trimmed(value: string) {
  return value.trim()
}

function optionalNumber(value: string): number | undefined {
  const normalized = trimmed(value)
  if (!normalized) return undefined
  const parsed = Number.parseInt(normalized, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function yearFromDate(value: string): number | undefined {
  const normalized = trimmed(value)
  if (!normalized) return undefined
  const parsed = Number.parseInt(normalized.slice(0, 4), 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function sourcesFromDraft(): MusicSource[] {
  const url = trimmed(sourceDraft.url)
  if (!url) return []
  return [{ type: 'url', url, title: trimmed(sourceDraft.title) || undefined }]
}

function createArtistSources(): MusicSource[] {
  const url = trimmed(artistDraft.sourceUrl)
  if (!url) return []
  return [{ type: 'url', url }]
}

async function onArtistAvatarChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  errorMessage.value = ''
  uploadingAvatar.value = true
  try {
    const uploaded = await uploadMusicAsset(file, 'music.cover')
    artistDraft.imageUrl = uploaded.url
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '头像上传失败'
  } finally {
    uploadingAvatar.value = false
  }
}

async function searchAlbumArtists() {
  const query = trimmed(albumArtistSearch.value)
  if (!query) {
    albumArtistResults.value = []
    return
  }
  artistSearchLoading.value = true
  try {
    const response = await listMusicArtists({ q: query, page: 1, page_size: 10 })
    const selectedIds = new Set(selectedAlbumArtists.value.map((artist) => String(artist.id)))
    albumArtistResults.value = response.data.filter((artist) => !selectedIds.has(String(artist.id)))
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '艺术家搜索失败'
  } finally {
    artistSearchLoading.value = false
  }
}

function addAlbumArtist(artist: MusicArtistListItem) {
  if (!selectedAlbumArtists.value.some((selected) => String(selected.id) === String(artist.id))) {
    selectedAlbumArtists.value = [...selectedAlbumArtists.value, artist]
  }
  albumArtistSearch.value = ''
  albumArtistResults.value = []
}

function removeAlbumArtist(artistId: string) {
  selectedAlbumArtists.value = selectedAlbumArtists.value.filter((artist) => String(artist.id) !== artistId)
}

function albumArtistIDs(): string[] {
  if (state.value.artistId) return [state.value.artistId]
  return selectedAlbumArtists.value.map((artist) => String(artist.id))
}

async function submitEdit() {
  errorMessage.value = ''
  successMessage.value = ''

  const action = state.value.nestedAction
  if (action === 'add_artist' && !trimmed(artistDraft.name)) {
    errorMessage.value = '请输入艺术家名称'
    return
  }
  if (action === 'add_album' && !trimmed(albumDraft.title)) {
    errorMessage.value = '请输入专辑名称'
    return
  }
  if (action === 'add_album' && !albumArtistIDs().length) {
    errorMessage.value = '请选择至少一位艺术家'
    return
  }

  const reason = action === 'add_artist'
    ? '创建艺术家资料'
    : isArtistForm.value
      ? trimmed(artistDraft.reason)
      : trimmed(albumDraft.reason)
  if (!reason) {
    errorMessage.value = '请输入编辑摘要'
    return
  }

  submitting.value = true
  try {
    if (action === 'add_artist') {
      await submitMusicEdit(buildCreateArtistEdit({
        name: trimmed(artistDraft.name),
        bio: trimmed(artistDraft.bio) || undefined,
        image_url: trimmed(artistDraft.imageUrl) || undefined,
        nationality: trimmed(artistDraft.nationality) || undefined,
        birth_date: trimmed(artistDraft.birthDate) || undefined,
        birth_year: yearFromDate(artistDraft.birthDate),
        reason,
        sources: createArtistSources(),
      }))
    } else if (action === 'revise_artist') {
      if (!state.value.artistId) {
        throw new Error('缺少艺术家 ID')
      }
      await submitMusicEdit(buildUpdateArtistEdit(state.value.artistId, {
        name: trimmed(artistDraft.name) || undefined,
        bio: trimmed(artistDraft.bio) || undefined,
        image_url: trimmed(artistDraft.imageUrl) || undefined,
        nationality: trimmed(artistDraft.nationality) || undefined,
        birth_year: optionalNumber(artistDraft.birthYear),
        reason,
        sources: sourcesFromDraft(),
      }))
    } else if (action === 'add_album') {
      await submitMusicEdit(buildCreateAlbumEdit({
        title: trimmed(albumDraft.title),
        artist_ids: albumArtistIDs(),
        release_date: trimmed(albumDraft.releaseDate) || undefined,
        description: trimmed(albumDraft.description) || undefined,
        album_type: albumDraft.albumType,
        reason,
        sources: sourcesFromDraft(),
      }))
    } else if (action === 'revise') {
      if (!state.value.albumId) {
        throw new Error('缺少专辑 ID')
      }
      await submitMusicEdit(buildUpdateAlbumEdit(state.value.albumId, {
        title: trimmed(albumDraft.title) || undefined,
        release_date: trimmed(albumDraft.releaseDate) || undefined,
        description: trimmed(albumDraft.description) || undefined,
        album_type: albumDraft.albumType,
        reason,
        sources: sourcesFromDraft(),
      }))
    }

    successMessage.value = '已提交 wiki 编辑，等待审核。'
    closeNestedAction()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '提交失败，请稍后重试'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <PSheet
    :show="isOpen"
    @close="closeNestedAction"
    width="500px"
  >
    <div class="drawer-header">
      <h3 class="title">{{ displayTitle }}</h3>
    </div>

    <div class="drawer-body">
      <form v-if="isArtistForm" data-test="music-edit-submit" class="wiki-form" @submit.prevent="submitEdit">
        <div class="form-group">
          <label class="form-label" for="music-artist-name">艺术家名称</label>
          <input id="music-artist-name" v-model="artistDraft.name" data-test="artist-name-input" type="text" class="form-input">
        </div>

        <div class="form-group">
          <label class="form-label" for="music-artist-bio">个人简介</label>
          <textarea id="music-artist-bio" v-model="artistDraft.bio" data-test="artist-bio-input" class="form-input form-textarea" rows="5"></textarea>
        </div>

        <div v-if="isCreateArtistForm" class="form-group">
          <label class="form-label" for="music-artist-avatar">头像上传</label>
          <input
            id="music-artist-avatar"
            data-test="artist-avatar-input"
            type="file"
            accept="image/*"
            class="form-input"
            @change="onArtistAvatarChange"
          >
          <div v-if="artistDraft.imageUrl" class="avatar-preview">
            <img :src="artistDraft.imageUrl" alt="" class="avatar-preview-img">
            <span>已上传</span>
          </div>
          <p v-else-if="uploadingAvatar" class="form-hint">头像上传中...</p>
        </div>

        <div v-else class="form-group">
          <label class="form-label" for="music-artist-image">头像 / 图片链接</label>
          <input id="music-artist-image" v-model="artistDraft.imageUrl" type="url" class="form-input">
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label class="form-label" for="music-artist-nationality">地区</label>
            <select
              v-if="isCreateArtistForm"
              id="music-artist-nationality"
              v-model="artistDraft.nationality"
              data-test="artist-nationality-select"
              class="form-input"
            >
              <option v-for="region in artistRegionOptions" :key="region.value" :value="region.value">{{ region.label }}</option>
            </select>
            <input v-else id="music-artist-nationality" v-model="artistDraft.nationality" type="text" class="form-input">
          </div>
          <div class="form-group">
            <label class="form-label" :for="isCreateArtistForm ? 'music-artist-birth-date' : 'music-artist-birth-year'">出生年月日</label>
            <input
              v-if="isCreateArtistForm"
              id="music-artist-birth-date"
              v-model="artistDraft.birthDate"
              data-test="artist-birth-date-input"
              type="date"
              class="form-input"
            >
            <input v-else id="music-artist-birth-year" v-model="artistDraft.birthYear" type="number" class="form-input">
          </div>
        </div>

        <div v-if="!isCreateArtistForm" class="form-group">
          <label class="form-label" for="music-edit-reason">编辑摘要</label>
          <textarea id="music-edit-reason" v-model="artistDraft.reason" data-test="edit-reason-input" class="form-input form-textarea" rows="3" required></textarea>
        </div>

        <div v-if="isCreateArtistForm" class="form-group">
          <label class="form-label" for="music-artist-source-url">来源</label>
          <input
            id="music-artist-source-url"
            v-model="artistDraft.sourceUrl"
            data-test="artist-source-url-input"
            type="url"
            class="form-input"
            placeholder="https://..."
          >
        </div>

        <div v-else class="source-row">
          <input v-model="sourceDraft.title" type="text" class="form-input" placeholder="来源标题">
          <input v-model="sourceDraft.url" type="url" class="form-input" placeholder="https://...">
        </div>

        <p v-if="errorMessage" class="form-error">{{ errorMessage }}</p>
        <p v-if="successMessage" class="form-success">{{ successMessage }}</p>
        <button class="a-btn-primary" type="submit" :disabled="!canSubmit">{{ submitting ? '提交中...' : '提交 wiki 编辑' }}</button>
      </form>

      <form v-else-if="isAlbumForm" data-test="music-edit-submit" class="wiki-form" @submit.prevent="submitEdit">
        <div v-if="needsAlbumArtistSelection" class="form-group">
          <label class="form-label" for="music-album-artist-search">关联艺术家</label>
          <div v-if="selectedAlbumArtists.length" class="selected-artists">
            <span v-for="artist in selectedAlbumArtists" :key="artist.id" class="selected-artist">
              {{ artist.name }}
              <button type="button" class="selected-artist-remove" @click="removeAlbumArtist(String(artist.id))">移除</button>
            </span>
          </div>
          <div class="artist-search-row">
            <input
              id="music-album-artist-search"
              v-model="albumArtistSearch"
              data-test="album-artist-search-input"
              type="text"
              class="form-input"
              placeholder="搜索艺术家名称"
              @keydown.enter.prevent="searchAlbumArtists"
            >
            <button
              type="button"
              class="a-btn-secondary"
              data-test="album-artist-search-button"
              :disabled="artistSearchLoading"
              @click="searchAlbumArtists"
            >
              {{ artistSearchLoading ? '搜索中...' : '搜索' }}
            </button>
          </div>
          <div v-if="albumArtistResults.length" class="artist-results">
            <button
              v-for="artist in albumArtistResults"
              :key="artist.id"
              type="button"
              class="artist-result"
              data-test="album-artist-option"
              @click="addAlbumArtist(artist)"
            >
              {{ artist.name }}
            </button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="music-album-title">专辑名称</label>
          <input id="music-album-title" v-model="albumDraft.title" data-test="album-title-input" type="text" class="form-input">
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label class="form-label" for="music-album-release-date">发行日期</label>
            <input id="music-album-release-date" v-model="albumDraft.releaseDate" data-test="album-release-date-input" type="date" class="form-input">
          </div>
          <div class="form-group">
            <label class="form-label" for="music-album-type">专辑类型</label>
            <select id="music-album-type" v-model="albumDraft.albumType" class="form-input">
              <option value="album">Album</option>
              <option value="ep">EP</option>
              <option value="single">Single</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="music-album-description">专辑简介</label>
          <textarea id="music-album-description" v-model="albumDraft.description" class="form-input form-textarea" rows="5"></textarea>
        </div>

        <div class="form-group">
          <label class="form-label" for="music-album-reason">编辑摘要</label>
          <textarea id="music-album-reason" v-model="albumDraft.reason" data-test="edit-reason-input" class="form-input form-textarea" rows="3" required></textarea>
        </div>

        <div class="source-row">
          <input v-model="sourceDraft.title" type="text" class="form-input" placeholder="来源标题">
          <input v-model="sourceDraft.url" type="url" class="form-input" placeholder="https://...">
        </div>

        <p v-if="errorMessage" class="form-error">{{ errorMessage }}</p>
        <p v-if="successMessage" class="form-success">{{ successMessage }}</p>
        <button class="a-btn-primary" type="submit" :disabled="!canSubmit">{{ submitting ? '提交中...' : '提交 wiki 编辑' }}</button>
      </form>

      <!-- History placeholder -->
      <div v-else-if="state.nestedAction === 'history'">
        <div class="history-item">
          <div><strong>v8 (PENDING)</strong></div>
          <div>修改简介</div>
        </div>
      </div>
    </div>
  </PSheet>
</template>

<style scoped>
.drawer-header { padding: 1.5rem 2rem; border-bottom: none; background: var(--a-color-paper); }
.title { font-family: var(--a-font-serif); font-size: 1.5rem; margin: 0; }
.drawer-body { padding: 2rem; }

.wiki-form { display: flex; flex-direction: column; gap: 1rem; }
.form-group { margin-bottom: 1.5rem; }
.form-label { display: block; font-weight: bold; margin-bottom: 0.5rem; font-family: var(--a-font-meta); font-size: 0.8rem; }
.form-input { width: 100%; border: 1.5px solid var(--a-color-ink); padding: 0.75rem; font-size: 1rem; font-family: inherit; }
.form-textarea { resize: vertical; min-height: 6rem; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
.source-row { display: grid; grid-template-columns: 1fr 1.5fr; gap: 0.75rem; margin-bottom: 1rem; }
.avatar-preview { display: inline-flex; align-items: center; gap: 0.75rem; margin-top: 0.75rem; font-family: var(--a-font-meta); font-size: 0.8rem; font-weight: 800; }
.avatar-preview-img { width: 56px; height: 56px; border: 1.5px solid var(--a-color-ink); object-fit: cover; }
.form-hint { margin: 0.5rem 0 0; color: var(--a-color-ink-soft); font-size: 0.85rem; }
.selected-artists { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem; }
.selected-artist { display: inline-flex; align-items: center; gap: 0.5rem; border: 1.5px solid var(--a-color-ink); padding: 0.35rem 0.55rem; font-family: var(--a-font-meta); font-size: 0.8rem; font-weight: 800; }
.selected-artist-remove { border: 0; background: transparent; cursor: pointer; color: var(--a-color-ink-soft); font: inherit; padding: 0; }
.artist-search-row { display: grid; grid-template-columns: 1fr auto; gap: 0.75rem; }
.artist-results { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.75rem; }
.artist-result { border: 1.5px solid var(--a-color-ink); background: var(--a-color-paper); padding: 0.45rem 0.75rem; cursor: pointer; font-family: var(--a-font-meta); font-weight: 800; }
.artist-result:hover { background: var(--a-color-paper-soft); }
.form-error { margin: 0; color: #b42318; font-weight: 800; font-size: 0.9rem; }
.form-success { margin: 0; color: #047857; font-weight: 800; font-size: 0.9rem; }
.a-btn-primary { width: 100%; border: 1.5px solid var(--a-color-ink); padding: 0.75rem 1.5rem; font-weight: bold; background: var(--a-color-ink); color: white; cursor: pointer; font-family: var(--a-font-meta); text-transform: uppercase; }
.a-btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
.a-btn-secondary { border: 1.5px solid var(--a-color-ink); padding: 0.75rem 1rem; font-weight: bold; background: var(--a-color-paper); cursor: pointer; font-family: var(--a-font-meta); }
.a-btn-secondary:disabled { opacity: 0.55; cursor: not-allowed; }

.history-item { margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px dashed var(--a-color-line-soft); }

@media (max-width: 640px) {
  .form-grid,
  .artist-search-row,
  .source-row { grid-template-columns: 1fr; }
}
</style>
