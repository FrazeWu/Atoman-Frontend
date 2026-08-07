import type {
  MusicAlbumArtistCreditInput,
  MusicAlbumArtistRole,
  MusicAlbumListItem,
} from '@/api/musicV1'
import type { MusicCreationAlbumContributorDraft } from '@/components/music/musicCreationTypes'

export function primaryAlbumRole(id = 'role-primary') {
  return { id, role: 'primary' as const, label: '' }
}

export function albumContributorsFromResponse(album: MusicAlbumListItem): MusicCreationAlbumContributorDraft[] {
  const credits = album.artist_credits ?? []
  if (!credits.length) {
    return (album.artists ?? []).map((artist, index) => ({
      id: `contributor-${artist.id}`,
      artistId: artist.id,
      name: artist.name,
      avatarUrl: '',
      kind: 'person',
      locked: false,
      roles: [primaryAlbumRole(`role-${artist.id}-primary-${index}`)],
    }))
  }

  const contributors = new Map<string, MusicCreationAlbumContributorDraft>()
	for (const credit of [...credits].sort((left, right) => left.position - right.position)) {
		const artist = credit.artist ?? album.artists?.find((item) => item.id === credit.artist_id)
		if (!artist) continue
		const imageURL = 'image_url' in artist && typeof artist.image_url === 'string' ? artist.image_url : ''
		const artistForm = 'artist_form' in artist && artist.artist_form === 'group' ? 'group' : 'person'
		const current: MusicCreationAlbumContributorDraft = contributors.get(credit.artist_id) ?? {
      id: `contributor-${credit.artist_id}`,
      artistId: credit.artist_id,
      name: artist.name,
			avatarUrl: imageURL,
			kind: artistForm,
      locked: false,
      roles: [],
    }
    current.roles.push({
      id: `role-${credit.artist_id}-${credit.role}-${credit.custom_role ?? ''}`,
      role: credit.role,
      label: credit.custom_role ?? '',
    })
    contributors.set(credit.artist_id, current)
  }
  return [...contributors.values()]
}

export function songContributorsFromCredits(
  credits: NonNullable<NonNullable<MusicAlbumListItem['songs']>[number]['artist_credits']>,
): MusicCreationAlbumContributorDraft[] {
  const contributors = new Map<string, MusicCreationAlbumContributorDraft>()
  for (const credit of [...credits].sort((left, right) => left.position - right.position)) {
    if (!credit.artist) continue
    const current = contributors.get(credit.artist_id) ?? {
      id: `song-contributor-${credit.artist_id}`,
      artistId: credit.artist_id,
      name: credit.artist.name,
      avatarUrl: credit.artist.image_url ?? '',
      kind: credit.artist.artist_form === 'group' ? 'group' : 'person',
      locked: false,
      roles: [],
    }
    current.roles.push({
      id: `song-role-${credit.artist_id}-${credit.role}-${credit.custom_role ?? ''}`,
      role: credit.role,
      label: credit.custom_role ?? '',
    })
    contributors.set(credit.artist_id, current)
  }
  return [...contributors.values()]
}

export function albumArtistCreditsFromContributors(
  contributors: MusicCreationAlbumContributorDraft[],
): MusicAlbumArtistCreditInput[] {
  return contributors
    .filter((contributor) => contributor.artistId)
    .map((contributor, index) => ({
      artist_id: contributor.artistId as string,
      position: index + 1,
      roles: contributor.roles.map((role) => ({
        role: role.role,
        ...(role.role === 'custom' ? { label: role.label.trim() } : {}),
      })),
    }))
}

export function hasValidAlbumContributors(contributors: MusicCreationAlbumContributorDraft[]): boolean {
  if (!contributors.length) return false
  let hasPrimary = false
  for (const contributor of contributors) {
    if (!contributor.name.trim() || !contributor.roles.length) return false
    for (const role of contributor.roles) {
      if (role.role === 'custom' && !role.label.trim()) return false
      hasPrimary = hasPrimary || role.role === 'primary'
    }
  }
  return hasPrimary
}

export const albumArtistRoleLabels: Record<Exclude<MusicAlbumArtistRole, 'custom'>, string> = {
  primary: '主艺术家',
  featured: '合作艺术家',
  vocals: '演唱',
  backing_vocals: '和声',
  writer: '作词',
  composer: '作曲',
  arranger: '编曲',
  producer: '制作人',
  vocal_producer: '人声制作',
  recording_engineer: '录音',
  mixing_engineer: '混音',
  mastering_engineer: '母带',
  remixer: '重混',
}
