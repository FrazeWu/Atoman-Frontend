import { computed, watch, type Ref } from 'vue'
import { primaryAlbumRole } from '@/utils/musicAlbumCredits'
import { parsePartialDateParts, serializePartialDate } from '@/components/music/birthDateMask'
import type {
  MusicCreationAlbumDetailsDraft,
  MusicCreationAlbumImportDraft,
  MusicCreationFlowState,
} from '@/components/music/musicCreationTypes'

export interface UseMusicCreationAlbumFormOptions {
  creationFlow: Ref<MusicCreationFlowState | null>
  albumDetailsDraft: Ref<MusicCreationAlbumDetailsDraft | null>
  albumImportDraft: Ref<MusicCreationAlbumImportDraft | null>
  isEditMode: Ref<boolean>
}

export function useMusicCreationAlbumForm({
  creationFlow,
  albumDetailsDraft,
  albumImportDraft,
  isEditMode,
}: UseMusicCreationAlbumFormOptions) {
  const albumTypeOptions = [
    { label: '专辑', value: 'album' },
    { label: 'EP', value: 'ep' },
    { label: '单曲', value: 'single' },
    { label: '泄曲', value: 'leak' },
    { label: '混音带', value: 'mixtape' },
    { label: '精选集', value: 'compilation' },
    { label: '原声带', value: 'soundtrack' },
    { label: '现场专辑', value: 'live' },
    { label: '重混专辑', value: 'remix' },
    { label: 'Demo', value: 'demo' },
    { label: '自定义', value: 'custom' },
  ]
  const knownAlbumTypes = albumTypeOptions.filter(item => item.value !== 'custom').map(item => item.value)

  const albumTypeSelection = computed<string>({
    get: () => {
      const value = albumDetailsDraft.value?.type ?? ''
      return knownAlbumTypes.includes(value) ? value : value ? 'custom' : ''
    },
    set: (value: string) => {
      if (albumDetailsDraft.value) albumDetailsDraft.value.type = value
      if (creationFlow.value) creationFlow.value.typeCustomized = true
    },
  })

  const customAlbumType = computed<string>({
    get: () =>
      albumDetailsDraft.value?.type === 'custom'
        ? ''
        : knownAlbumTypes.includes(albumDetailsDraft.value?.type ?? '')
          ? ''
          : albumDetailsDraft.value?.type ?? '',
    set: (value: string) => {
      if (albumDetailsDraft.value) albumDetailsDraft.value.type = value
      if (creationFlow.value) creationFlow.value.typeCustomized = true
    },
  })

  const titleModel = computed({
    get: () => albumDetailsDraft.value?.title ?? '',
    set: (value: string) => {
      if (!albumDetailsDraft.value) return
      if (creationFlow.value) {
        creationFlow.value.titleCustomized = true
      }
      albumDetailsDraft.value.title = value
      if (albumImportDraft.value && value.trim()) {
        albumImportDraft.value.derivedAlbumTitle = value.trim()
      }
    },
  })

  function handleTitleBlur() {
    const val = titleModel.value.trim()
    if (albumImportDraft.value && val) {
      albumImportDraft.value.derivedAlbumTitle = val
    }
  }

  function requiredLabel(label: string) {
    return `${label}*`
  }

  function createEmptyDateParts() {
    return {
      year: '',
      month: '',
      day: '',
    }
  }

  function hasDatePartsValue(parts?: { year: string; month: string; day: string }) {
    if (!parts) return false
    return !!parts.year.trim() || !!parts.month.trim() || !!parts.day.trim()
  }

  const releaseDateModel = computed({
    get: () => albumDetailsDraft.value?.releaseDateParts ?? createEmptyDateParts(),
    set: (value: { year: string; month: string; day: string }) => {
      if (!albumDetailsDraft.value || !creationFlow.value) return
      creationFlow.value.releaseDateCustomized = true
      albumDetailsDraft.value.releaseDateParts = value
    },
  })

  function updateMetadataCountry(value: string | number) {
    if (!albumImportDraft.value || !creationFlow.value) return
    albumImportDraft.value.metadataCountry = String(value)
    creationFlow.value.metadataCountryCustomized = true
  }

  watch(
    albumDetailsDraft,
    (draft) => {
      if (!draft) return

      if (!draft.releaseDateParts) {
        draft.releaseDateParts = createEmptyDateParts()
      }

      if (!draft.contributors) {
        draft.contributors = []
      }

      if (!hasDatePartsValue(draft.releaseDateParts) && draft.releaseDate.trim()) {
        draft.releaseDateParts = parsePartialDateParts(draft.releaseDate)
      } else if (!hasDatePartsValue(draft.releaseDateParts) && draft.releaseYear.trim()) {
        draft.releaseDateParts = {
          year: draft.releaseYear.trim(),
          month: '',
          day: '',
        }
      }
    },
    { immediate: true },
  )

  watch(
    () => albumDetailsDraft.value?.releaseDateParts,
    (parts) => {
      if (!albumDetailsDraft.value) return
      albumDetailsDraft.value.releaseDate = serializePartialDate(parts)
      albumDetailsDraft.value.releaseYear = parts?.year.trim() ?? ''
    },
    { deep: true, immediate: true },
  )

  function syncLockedNewArtistContributor() {
    if (!creationFlow.value || !albumDetailsDraft.value) return

    const isNewArtistFlow = !creationFlow.value.draft.artist.id
    const lockedContributorId = 'contributor-new-artist'

    if (!isNewArtistFlow) {
      albumDetailsDraft.value.contributors = albumDetailsDraft.value.contributors.filter(
        (item) => item.id !== lockedContributorId,
      )
      return
    }

    const artistName =
      creationFlow.value.draft.artist.stageNames[0]?.name.trim() ||
      creationFlow.value.draft.artist.legalName.trim()
    if (!artistName) return

    const nextContributor = {
      id: lockedContributorId,
      artistId: null,
      name: artistName,
      avatarUrl: creationFlow.value.draft.artist.avatarUrl,
      kind: creationFlow.value.draft.artist.kind,
      locked: true,
      roles:
        albumDetailsDraft.value.contributors.find((item) => item.id === lockedContributorId)?.roles ??
        [primaryAlbumRole('role-new-artist-primary')],
    }

    const existingIndex = albumDetailsDraft.value.contributors.findIndex(
      (item) => item.id === lockedContributorId,
    )
    if (existingIndex >= 0) {
      albumDetailsDraft.value.contributors.splice(existingIndex, 1, nextContributor)
      return
    }

    albumDetailsDraft.value.contributors = [nextContributor, ...albumDetailsDraft.value.contributors]
  }

  watch(
    () => [
      creationFlow.value?.draft.artist.id ?? '',
      creationFlow.value?.draft.artist.kind ?? 'person',
      creationFlow.value?.draft.artist.avatarUrl ?? '',
      creationFlow.value?.draft.artist.legalName ?? '',
      creationFlow.value?.draft.artist.stageNames[0]?.name ?? '',
    ],
    () => {
      syncLockedNewArtistContributor()
    },
    { immediate: true },
  )

  return {
    albumTypeOptions,
    knownAlbumTypes,
    albumTypeSelection,
    customAlbumType,
    titleModel,
    handleTitleBlur,
    releaseDateModel,
    updateMetadataCountry,
    requiredLabel,
    syncLockedNewArtistContributor,
  }
}
