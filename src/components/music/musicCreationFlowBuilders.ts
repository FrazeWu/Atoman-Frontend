import type * as musicApi from '@/api/musicV1'
import type {
  MusicCreationAlbumContributorDraft,
  MusicCreationDatePartsDraft,
  MusicCreationFlowState,
} from './musicCreationTypes'
import { activeMusicArtistDraft } from './musicCreationTypes'
import { serializePartialDate, formatStoredPartialDate } from '@/components/music/birthDateMask'
import { normalizeMusicImportSource } from '@/utils/musicImportSource'

export function hasDatePartsValue(parts?: MusicCreationDatePartsDraft) {
  if (!parts) return false
  return !!parts.year.trim() || !!parts.month.trim() || !!parts.day.trim()
}

export function formatDateFromParts(parts?: MusicCreationDatePartsDraft) {
  return serializePartialDate(parts)
}

export function deriveYearFromParts(parts?: MusicCreationDatePartsDraft) {
  if (!parts) return 0
  return Number.parseInt(parts.year.trim(), 10) || 0
}

export function formatArtistDate(parts?: MusicCreationDatePartsDraft) {
  return serializePartialDate(parts)
}

export function formatStoredArtistDate(value?: string, precision?: string, fallbackYear?: number) {
  const formatted = formatStoredPartialDate(value, precision)
  if (formatted) return formatted
  return fallbackYear && fallbackYear > 0 ? `${fallbackYear}/--/--` : ''
}

export function parseStageNames(raw: string | undefined, fallbackName: string) {
  try {
    const parsed = JSON.parse(raw || '[]') as musicApi.MusicAlbumImportCommitStageName[]
    if (Array.isArray(parsed) && parsed.length) {
      return parsed.map((item, index) => ({
        id: `stage-name-${index}`,
        name: item.name || '',
        isPrimary: item.is_primary || index === 0,
        startDateParts: { year: '', month: '', day: '' },
        endDateParts: { year: '', month: '', day: '' },
        startDateText: item.start_date_text || '',
        endDateText: item.end_date_text || '',
      }))
    }
  } catch {
    // Use the canonical name when legacy stage-name data is unavailable.
  }
  return [{
    id: 'stage-name-primary',
    name: fallbackName,
    isPrimary: true,
    startDateParts: { year: '', month: '', day: '' },
    endDateParts: { year: '', month: '', day: '' },
    startDateText: '',
    endDateText: '',
  }]
}

export function contributorsFromSongDetail(detail: musicApi.MusicSongDetail) {
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
  return [...contributors.values()]
}

export function buildArtistMembersFromDraft(artist: ReturnType<typeof activeMusicArtistDraft>) {
  return artist.members
    .filter((member) => member.name.trim())
    .map((member) => ({
      artist_id: member.artistId || '',
      name: member.name.trim(),
      join_date: formatArtistDate(member.joinDateParts),
      leave_date: formatArtistDate(member.leaveDateParts),
    }))
}

export function buildArtistMembers(flow: MusicCreationFlowState) {
  return buildArtistMembersFromDraft(flow.draft.artist)
}

export function buildSource(value: string): musicApi.MusicSource {
  const normalized = value.trim()
  return /^https?:\/\//i.test(normalized)
    ? { type: 'url', url: normalized }
    : { type: 'text', title: normalized }
}

export function buildNormalizedContributors(flow: MusicCreationFlowState) {
  const contributors = [...(flow.draft.albumDetails.contributors ?? [])]
  if (
    flow.draft.artist.id
    && contributors.length === 1
    && !contributors[0].locked
    && !contributors[0].artistId
  ) {
    contributors[0] = {
      ...contributors[0],
      id: `contributor-${flow.draft.artist.id}`,
      artistId: flow.draft.artist.id,
    }
  }
  return contributors
}

export function primaryContributor(flow: MusicCreationFlowState) {
  return buildNormalizedContributors(flow).find((contributor) =>
    contributor.roles.some((role) => role.role === 'primary'),
  )
}

export function primaryArtistDraft(flow: MusicCreationFlowState) {
  return primaryContributor(flow)?.newArtistDraft ?? flow.draft.artist
}

export function resolvedArtistSource(flow: MusicCreationFlowState) {
  const primary = primaryContributor(flow)
  const primarySource = normalizeMusicImportSource(primary?.source || primary?.newArtistDraft?.source)
  const primaryDiffersFromFlowArtist = !!primary?.artistId && primary.artistId !== flow.draft.artist.id
  return primaryDiffersFromFlowArtist
    ? primarySource
    : normalizeMusicImportSource(flow.draft.artist.source) || primarySource
}

export function requiresArtistSource(flow: MusicCreationFlowState) {
  const primary = primaryContributor(flow)
  if (primary?.newArtistDraft) return false
  return !primary?.artistId || !primary.entryStatus || primary.entryStatus === 'draft'
}

export function hasRequiredArtistSource(flow: MusicCreationFlowState) {
  if (flow.entity !== 'artist') return true
  return !requiresArtistSource(flow) || !!resolvedArtistSource(flow)
}

export function resolvedAlbumCoverUrl(flow: MusicCreationFlowState) {
  const coverAssetUrl = flow.draft.albumDetails.coverAsset?.url?.trim() || ''
  if (coverAssetUrl && !/^(blob:|data:)/i.test(coverAssetUrl)) return coverAssetUrl

  const coverUrl = flow.draft.albumDetails.coverUrl.trim()
  if (coverUrl && !/^(blob:|data:)/i.test(coverUrl)) return coverUrl

  return flow.draft.albumImport.coverUrl.trim() || flow.draft.albumImport.derivedCover.trim()
}

export function buildContributorPayload(flow: MusicCreationFlowState): NonNullable<musicApi.MusicAlbumImportCommitInput['artists']> {
  return buildNormalizedContributors(flow).map((contributor) => {
    if (!contributor.artistId) {
      const artist = contributor.newArtistDraft ?? flow.draft.artist
      const activeStartDate = formatArtistDate(artist.activeStartDateParts)
      const activeEndDate = formatArtistDate(artist.activeEndDateParts)
      const artistStageNames = artist.stageNames
        .filter((item) => item.name.trim())
        .map((item) => ({
          name: item.name.trim(),
          is_primary: item.isPrimary,
          start_date_text: item.startDateText.trim(),
          end_date_text: item.endDateText.trim(),
        }))
      return {
        artist_id: '',
        roles: contributor.roles.map((role) => ({
          role: role.role,
          ...(role.role === 'custom' ? { label: role.label.trim() } : {}),
        })),
        name: contributor.name.trim(),
        disambiguation: artist.disambiguation?.trim() || '',
        legal_name: artist.legalName.trim(),
        bio: artist.bio.trim(),
        ...(contributor.avatarUrl.trim() ? { image_url: contributor.avatarUrl.trim() } : {}),
        nationality: artist.nationality.trim(),
        birth_date: formatDateFromParts(artist.birthDateParts),
        stage_names: artistStageNames,
        birth_place: artist.birthPlace.trim(),
        artist_form: artist.kind,
        active_start_date: activeStartDate,
        active_end_date: activeEndDate,
        members: buildArtistMembersFromDraft(artist),
      }
    }

    return {
      artist_id: contributor.artistId,
      roles: contributor.roles.map((role) => ({
        role: role.role,
        ...(role.role === 'custom' ? { label: role.label.trim() } : {}),
      })),
      name: contributor.name.trim(),
      disambiguation: '',
      legal_name: '',
      bio: '',
      stage_names: [],
      birth_place: '',
      nationality: '',
      birth_date: '',
      artist_form: contributor.kind,
      active_start_date: '',
      active_end_date: '',
      members: [],
    }
  })
}

export function trackNumberWithinDisc(tracks: Array<{ discNumber?: number }>, index: number) {
  const discNumber = tracks[index]?.discNumber ?? 1
  return tracks.slice(0, index + 1).filter((track) => (track.discNumber ?? 1) === discNumber).length
}

export function hasTrackAudio(track: { audioUrl?: string; audioKey?: string; audioAssetId?: string; importFileId?: string; songId?: string }) {
  // 文件仍在处理时可登记提交；后端只有验证实际处理结果后才发布。
  return !!track.audioUrl?.trim() || !!track.audioKey?.trim() || !!track.audioAssetId?.trim() || !!track.importFileId || !!track.songId
}

export function buildCommitInput(flow: MusicCreationFlowState): musicApi.MusicAlbumImportCommitInput {
  const primaryContributorDraft = primaryArtistDraft(flow)
  const primary = primaryContributor(flow)
  const primaryStageName = primaryContributorDraft.stageNames.find((item) => item.isPrimary && item.name.trim())
    ?? primaryContributorDraft.stageNames.find((item) => item.name.trim())
  const releaseDate = formatDateFromParts(flow.draft.albumDetails.releaseDateParts)
  const derivedReleaseYear = deriveYearFromParts(flow.draft.albumDetails.releaseDateParts)
  const artists = buildContributorPayload(flow)
  const primaryArtistID = primaryContributor(flow)?.artistId || flow.draft.artist.id
  const artistSource = resolvedArtistSource(flow)
  const albumSource = normalizeMusicImportSource(flow.draft.albumDetails.source)
  const isStandaloneSong = ['single', 'leak'].includes(flow.draft.albumDetails.type.trim().toLowerCase())
  const deletedImportTrackKeys = flow.deletedImportTrackKeys ?? []
  const coverAssetUrl = flow.draft.albumDetails.coverAsset?.url?.trim() || ''
  const coverURL = coverAssetUrl
    ? (/^(blob:|data:)/i.test(coverAssetUrl) ? '' : coverAssetUrl)
    : resolvedAlbumCoverUrl(flow)

  return {
    ...(primaryArtistID ? { artist_id: primaryArtistID } : {}),
    ...(flow.metadataConfirmed ? { metadata_confirmed: true } : {}),
    draft_customization: {
      title: !!flow.titleCustomized,
      tracks: !!flow.tracksCustomized,
      releaseDate: !!flow.releaseDateCustomized,
      cover: !!flow.coverCustomized,
      type: !!flow.typeCustomized,
      tags: !!flow.metadataTagsApplied,
      country: !!flow.metadataCountryCustomized,
      source: !!flow.sourceCustomized,
    },
    artist: {
      name: primary?.newArtistDraft
        ? primary.name.trim()
        : primaryStageName?.name.trim() || primaryContributorDraft.legalName.trim(),
      legal_name: primaryContributorDraft.legalName.trim(),
      bio: primaryContributorDraft.bio.trim(),
      ...(primaryContributorDraft.avatarUrl.trim() ? { image_url: primaryContributorDraft.avatarUrl.trim() } : {}),
      nationality: primaryContributorDraft.nationality.trim(),
      birth_date: formatDateFromParts(primaryContributorDraft.birthDateParts),
      stage_names: primaryContributorDraft.stageNames
        .filter((item) => item.name.trim())
        .map((item) => ({
          name: item.name.trim(),
          is_primary: item.isPrimary,
          start_date_text: item.startDateText.trim(),
          end_date_text: item.endDateText.trim(),
        })),
      birth_place: primaryContributorDraft.birthPlace.trim(),
    },
    artists,
    artist_source: artistSource,
    ...(artistSource ? { artist_sources: [buildSource(artistSource)] } : {}),
    album: {
      title: flow.draft.albumDetails.title.trim(),
      description: flow.draft.albumDetails.bio.trim(),
      album_type: flow.draft.albumDetails.type.trim() || 'album',
      ...(coverURL && !/^(blob:|data:)/i.test(coverURL) ? { cover_url: coverURL } : {}),
      ...(releaseDate ? { release_date: releaseDate } : {}),
      release_year: derivedReleaseYear || 0,
      metadata: {
        genres: flow.draft.albumImport.metadataGenres ?? [],
        styles: flow.draft.albumImport.metadataStyles ?? [],
        labels: flow.draft.albumImport.metadataLabels ?? [],
        country: flow.draft.albumImport.metadataCountry ?? '',
        formats: flow.draft.albumImport.metadataFormats ?? [],
      },
      tracks: flow.draft.tracks.map((track, index) => ({
        ...(track.songId ? { song_id: track.songId } : {}),
        ...(track.importFileId ? { file_id: track.importFileId } : {}),
        ...(track.audioAssetId ? { audio_asset_id: track.audioAssetId } : {}),
        ...(track.audioKey ? { audio_key: track.audioKey } : {}),
        title: isStandaloneSong ? flow.draft.albumDetails.title.trim() : track.title.trim(),
        disc_number: track.discNumber ?? 1,
        track_number: trackNumberWithinDisc(flow.draft.tracks, index),
        ...(track.originalTitle ? { original_title: track.originalTitle } : {}),
        ...(track.originalDiscNumber ? { original_disc_number: track.originalDiscNumber } : {}),
        ...(track.originalTrackNumber ? { original_track_number: track.originalTrackNumber } : {}),
        ...(track.matchStatus ? { match_status: track.matchStatus } : {}),
        ...(track.matchProvider ? { match_provider: track.matchProvider } : {}),
        ...(track.matchExternalId ? { match_external_id: track.matchExternalId } : {}),
        ...(track.matchSourceUrl ? { match_source_url: track.matchSourceUrl } : {}),
        ...(track.matchConfidence !== undefined ? { match_confidence: track.matchConfidence } : {}),
        ...(track.titleCustomized ? { title_customized: true } : {}),
        ...(track.sequenceCustomized ? { sequence_customized: true } : {}),
        ...(track.lyricsDraft ? {
          lyrics: {
            content: track.lyricsDraft.content,
            translation: track.lyricsDraft.translation,
            format: track.lyricsDraft.format,
            language: track.lyricsDraft.language,
            edit_summary: track.lyricsDraft.editSummary,
          },
        } : {}),
        ...(track.lyricsSource ? { lyrics_source: track.lyricsSource } : {}),
      })),
    },
    ...(deletedImportTrackKeys.length > 0
      ? { deleted_import_track_keys: [...deletedImportTrackKeys] }
      : {}),
    album_source: albumSource,
    ...(albumSource ? { album_sources: [buildSource(albumSource)] } : {}),
  }
}

export function hasCreationDraft(flow: MusicCreationFlowState) {
  if (flow.mode === 'edit') return flow.dirty

  const { artist, albumImport, albumDetails, tracks } = flow.draft

  return (
    flow.dirty ||
    !!artist.avatarUrl.trim() ||
    !!artist.legalName.trim() ||
    !!artist.disambiguation?.trim() ||
    artist.stageNames.some((stageName) => !!stageName.name.trim()) ||
    artist.members.some((member) => !!member.name.trim()) ||
    !!artist.nationality.trim() ||
    !!artist.birthPlace.trim() ||
    hasDatePartsValue(artist.birthDateParts) ||
    hasDatePartsValue(artist.activeStartDateParts) ||
    hasDatePartsValue(artist.activeEndDateParts) ||
    !!artist.bio.trim() ||
    !!artist.source.trim() ||
    !!albumImport.archiveName.trim() ||
    albumImport.uploadProgress > 0 ||
    !!albumImport.derivedAlbumTitle.trim() ||
    albumImport.derivedTracks.length > 0 ||
    !!albumDetails.coverUrl.trim() ||
    !!albumDetails.title.trim() ||
    (albumDetails.contributors?.length ?? 0) > 0 ||
    hasDatePartsValue(albumDetails.releaseDateParts) ||
    !!albumDetails.bio.trim() ||
    albumDetails.tags.length > 0 ||
    !!albumDetails.source.trim() ||
    tracks.length > 0
  )
}
