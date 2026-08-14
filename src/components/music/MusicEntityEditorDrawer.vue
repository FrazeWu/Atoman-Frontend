<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import {
  getMusicSongDetail,
  queueMusicSongAudioReplacement,
  submitSongRevision,
  uploadMusicAsset,
  uploadMusicAssetWithProgress,
} from '@/api/musicV1'
import MusicCreationContributorPicker from '@/components/music/MusicCreationContributorPicker.vue'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PSheet from '@/components/ui/PSheet.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { reportError } from '@/utils/logger'
import {
  albumArtistCreditsFromContributors,
} from '@/utils/musicAlbumCredits'
import type { MusicCreationAlbumContributorDraft } from './musicCreationTypes'
import type { MusicSheetLayer } from './musicSheetTypes'

type EditorLayer = Extract<MusicSheetLayer, { kind: 'editor' }>

const props = withDefaults(defineProps<{
  layer?: EditorLayer
  layerIndex?: number
  stackSize?: number
}>(), {
  layerIndex: 0,
  stackSize: 1,
})

const {
  state,
  closeMusicEditor,
  refreshSong,
  closeMusicCreationFlow,
  isLayerShifted,
  isTopLayer,
  returnToLayer,
} = useMusicDrawers()

const editor = computed(() => props.layer?.payload ?? state.value.musicEditor)
const isOpen = computed(() => props.layer !== undefined || editor.value !== null)
const isSongEditor = computed(() => editor.value?.entity === 'song' && editor.value.mode === 'edit')
const sheetIndex = computed(() => {
  if (props.layer) return props.layerIndex
  let count = 0
  if (state.value.artistId !== null) count += 1
  if (state.value.albumId !== null) count += 1
  return count
})
const shifted = computed(() => props.layer ? isLayerShifted(props.layer.key) : false)
const topLayer = computed(() => props.layer ? isTopLayer(props.layer.key) : true)
let audioUploadController: AbortController | null = null
const closeCurrentEditor = () => {
  audioUploadController?.abort()
  closeMusicEditor(props.layer?.key)
}

const songLoading = ref(false)
const songSubmitting = ref(false)
const songErrorMessage = ref('')
const songDraft = reactive({
  title: '',
  trackNumber: '1',
  discNumber: '1',
  lyrics: '',
  coverUrl: '',
  coverFile: null as File | null,
  audioFile: null as File | null,
  contributors: [] as MusicCreationAlbumContributorDraft[],
})
let songCoverObjectURL = ''

watch(editor, async (value) => {
  resetSongState()
  if (value?.entity !== 'song' || value.mode !== 'edit' || !value.id) return
  closeMusicCreationFlow()
  await loadSong(value.id)
}, { immediate: true })

function resetSongState() {
  songLoading.value = false
  songSubmitting.value = false
  songErrorMessage.value = ''
  songDraft.title = ''
  songDraft.trackNumber = '1'
  songDraft.discNumber = '1'
  songDraft.lyrics = ''
  songDraft.coverUrl = ''
  songDraft.coverFile = null
  songDraft.audioFile = null
  songDraft.contributors = []
  revokeSongCoverPreview()
}

function revokeSongCoverPreview() {
  if (!songCoverObjectURL) return
  URL.revokeObjectURL(songCoverObjectURL)
  songCoverObjectURL = ''
}

onBeforeUnmount(() => {
  audioUploadController?.abort()
  revokeSongCoverPreview()
})

async function loadSong(songId: string) {
  songLoading.value = true
  try {
    const detail = await getMusicSongDetail(songId)
    songDraft.title = detail.song.title
    songDraft.trackNumber = String(detail.song.track_number ?? 1)
    songDraft.discNumber = String(detail.song.disc_number ?? 1)
    songDraft.lyrics = detail.song.lyrics ?? ''
    songDraft.coverUrl = detail.song.cover_url ?? detail.song.album?.cover_url ?? ''
    const contributors = new Map<string, MusicCreationAlbumContributorDraft>()
    for (const credit of detail.artists) {
      const current = contributors.get(credit.id) ?? {
        id: `song-contributor-${credit.id}`,
        artistId: credit.id,
        name: credit.name,
        avatarUrl: '',
        kind: 'person' as const,
        locked: false,
        roles: [],
      }
      current.roles.push({
        id: `song-role-${credit.id}-${credit.role}-${credit.custom_role ?? ''}`,
        role: credit.role,
        label: credit.custom_role ?? '',
      })
      contributors.set(credit.id, current)
    }
    songDraft.contributors = [...contributors.values()]
  } catch (error) {
    reportError(error, 'Failed to load song:')
    songErrorMessage.value = '加载歌曲失败'
  } finally {
    songLoading.value = false
  }
}

function selectSongCover(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null
  songDraft.coverFile = file
  revokeSongCoverPreview()
  if (file) {
    songCoverObjectURL = URL.createObjectURL(file)
    songDraft.coverUrl = songCoverObjectURL
  }
}

function selectSongAudio(event: Event) {
  songDraft.audioFile = (event.target as HTMLInputElement).files?.[0] ?? null
}

function hasValidSongContributors() {
  return songDraft.contributors.every(contributor => (
    contributor.name.trim()
    && contributor.roles.length > 0
    && contributor.roles.every(role => role.role !== 'custom' || role.label.trim())
  ))
}

async function handleSongEditSubmit() {
  const current = editor.value
  if (!current || current.entity !== 'song' || current.mode !== 'edit' || !current.id) return
  if (!songDraft.title.trim()) {
    songErrorMessage.value = '歌曲名不能为空'
    return
  }
  if (!hasValidSongContributors()) {
    songErrorMessage.value = '请补全创作者身份'
    return
  }

  songSubmitting.value = true
  songErrorMessage.value = ''
  try {
    const coverAsset = songDraft.coverFile
      ? await uploadMusicAsset(songDraft.coverFile, 'music.cover')
      : null
    const audioAsset = songDraft.audioFile
      ? await (() => {
        audioUploadController = new AbortController()
        return uploadMusicAssetWithProgress(songDraft.audioFile!, 'music.audio', {
          signal: audioUploadController.signal,
          timeoutMs: 5 * 60 * 1000,
        }).finally(() => { audioUploadController = null })
      })()
      : null
    await submitSongRevision(current.id, {
      title: songDraft.title.trim(),
      track_number: Number.parseInt(songDraft.trackNumber, 10) || 1,
      disc_number: Number.parseInt(songDraft.discNumber, 10) || 1,
      lyrics: songDraft.lyrics,
      ...(coverAsset ? { cover: coverAsset } : {}),
      artist_credits: albumArtistCreditsFromContributors(songDraft.contributors),
      reason: '编辑歌曲',
    })
    if (audioAsset) {
      try {
        await queueMusicSongAudioReplacement(current.id, {
          audio_url: audioAsset.url,
          source_key: audioAsset.key,
        })
      } catch (error) {
        reportError(error, 'Failed to queue song audio replacement:')
        songErrorMessage.value = '歌曲资料已保存，但音频替换提交失败，请重试'
        refreshSong()
        return
      }
    }
    refreshSong()
    closeCurrentEditor()
  } catch (error) {
    reportError(error, 'Failed to save song:')
    songErrorMessage.value = '保存失败，请稍后重试'
  } finally {
    songSubmitting.value = false
  }
}
</script>

<template>
  <PSheet
    :show="isOpen"
    title="编辑歌曲"
    content-max-width="64rem"
    :index="sheetIndex"
    :layer-index="layerIndex"
    :stack-size="stackSize"
    :is-shifted="shifted"
    :is-top-layer="topLayer"
    close-type="header"
    panel-class="entity-editor-drawer"
    @close="closeCurrentEditor"
    @activate="props.layer && returnToLayer(props.layer.key)"
  >
    <div v-if="isSongEditor" class="entity-editor__body">
      <p v-if="songErrorMessage" class="entity-editor__error">{{ songErrorMessage }}</p>
      <p v-else-if="songLoading" class="entity-editor__state">正在加载歌曲资料...</p>
      <template v-else>
        <div class="song-editor__grid">
          <PInput v-model="songDraft.title" label="歌曲名" />
          <PInput v-model="songDraft.discNumber" type="number" min="1" label="碟号" />
          <PInput v-model="songDraft.trackNumber" type="number" min="1" label="曲序" />
        </div>
        <PTextarea v-model="songDraft.lyrics" :rows="12" label="歌词" />
        <MusicCreationContributorPicker v-model="songDraft.contributors" />
        <div class="song-editor__media">
          <div>
            <img v-if="songDraft.coverUrl" :src="songDraft.coverUrl" alt="歌曲封面" class="song-editor__cover" />
            <label class="song-editor__file">封面<input type="file" accept="image/*" @change="selectSongCover" /></label>
          </div>
          <label class="song-editor__file">替换音频<input type="file" accept="audio/*" @change="selectSongAudio" /><span>{{ songDraft.audioFile?.name || '未选择文件' }}</span></label>
        </div>
        <div class="entity-editor__actions">
          <PButton variant="secondary" :disabled="songSubmitting" @click="closeCurrentEditor">取消</PButton>
          <PButton variant="warning" :loading="songSubmitting" loading-text="正在保存..." @click="handleSongEditSubmit">保存歌曲</PButton>
        </div>
      </template>
    </div>
  </PSheet>
</template>

<style scoped>
.entity-editor__body { display: grid; gap: 1rem; }
.entity-editor__actions { display: flex; justify-content: flex-end; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.5rem; }
.entity-editor__error { margin: 0; color: var(--a-color-accent-destructive); font-size: 0.92rem; }
.entity-editor__state { margin: 0; color: var(--a-color-muted); font-size: 0.95rem; }
.song-editor__grid { display: grid; grid-template-columns: minmax(0, 1fr) 8rem 8rem; gap: 0.75rem; }
.song-editor__media { display: grid; grid-template-columns: minmax(10rem, 14rem) minmax(0, 1fr); gap: 1rem; align-items: end; }
.song-editor__cover { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px; margin-bottom: 0.5rem; }
.song-editor__file { display: grid; gap: 0.4rem; color: var(--a-color-muted); font-size: 0.85rem; }
.song-editor__file input { color: var(--a-color-text); }

@media (max-width: 640px) {
  .song-editor__grid,
  .song-editor__media { grid-template-columns: 1fr; }
}

:global(.entity-editor-drawer) {
  background: var(--a-color-bg) !important;
  border-left: 1px solid var(--a-color-border-soft) !important;
  box-shadow: none !important;
}

:root.dark :global(.entity-editor-drawer) {
  background: var(--a-color-bg) !important;
  border-left: 1px solid var(--a-color-border-dark, #334155) !important;
}
</style>
