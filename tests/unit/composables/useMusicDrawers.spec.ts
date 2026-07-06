import { describe, it, expect, beforeEach } from 'vitest'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

describe('useMusicDrawers', () => {
  beforeEach(() => {
    const { closeAll } = useMusicDrawers()
    closeAll()
  })

  it('manages artist drawer state', () => {
    const { state, openArtist, closeArtist } = useMusicDrawers()
    expect(state.value.artistId).toBeNull()
    
    openArtist('artist-123')
    expect(state.value.artistId).toBe('artist-123')
    
    closeArtist()
    expect(state.value.artistId).toBeNull()
  })

  it('manages album drawer state', () => {
    const { state, openAlbum, closeAlbum } = useMusicDrawers()
    openAlbum('album-456')
    expect(state.value.albumId).toBe('album-456')
    
    closeAlbum()
    expect(state.value.albumId).toBeNull()
  })

  it('manages nested action drawer state', () => {
    const { state, openNestedAction, closeNestedAction } = useMusicDrawers()
    openNestedAction('revise', { title: 'Test' })
    expect(state.value.nestedAction).toBe('revise')
    expect(state.value.nestedPayload).toEqual({ title: 'Test' })
    
    closeNestedAction()
    expect(state.value.nestedAction).toBeNull()
  })

  it('manages unified music editor state', () => {
    const { state, openMusicEditor, closeMusicEditor } = useMusicDrawers()

    openMusicEditor({ entity: 'artist', mode: 'create', seed: { name: 'Ye' } })
    expect(state.value.musicEditor).toEqual({
      entity: 'artist',
      mode: 'create',
      seed: { name: 'Ye' },
    })

    openMusicEditor({ entity: 'album', mode: 'edit', id: 'album-1' })
    expect(state.value.musicEditor).toEqual({
      entity: 'album',
      mode: 'edit',
      id: 'album-1',
    })

    closeMusicEditor()
    expect(state.value.musicEditor).toBeNull()
  })

  it('computes shifted states correctly', () => {
    const { isMainShifted, isArtistShifted, isAlbumShifted, openArtist, openAlbum, openNestedAction } = useMusicDrawers()
    
    expect(isMainShifted.value).toBe(false)
    
    openArtist('1')
    expect(isMainShifted.value).toBe(true)
    expect(isArtistShifted.value).toBe(false)
    
    openAlbum('2')
    expect(isArtistShifted.value).toBe(true)
    expect(isAlbumShifted.value).toBe(false)
    
    openNestedAction('revise')
    expect(isAlbumShifted.value).toBe(true)
  })

  it('computes isMainShifted correctly with add_artist', () => {
    const { isMainShifted, openNestedAction } = useMusicDrawers()
    expect(isMainShifted.value).toBe(false)
    openNestedAction('add_artist')
    expect(isMainShifted.value).toBe(true)
  })

  it('computes shifted states correctly with unified music editor', () => {
    const { isMainShifted, isArtistShifted, isAlbumShifted, openMusicEditor } = useMusicDrawers()

    openMusicEditor({ entity: 'artist', mode: 'create' })
    expect(isMainShifted.value).toBe(true)
    expect(isArtistShifted.value).toBe(true)
    expect(isAlbumShifted.value).toBe(false)

    openMusicEditor({ entity: 'album', mode: 'edit', id: 'album-1' })
    expect(isMainShifted.value).toBe(true)
    expect(isArtistShifted.value).toBe(true)
    expect(isAlbumShifted.value).toBe(true)
  })

  it('computes isArtistShifted correctly with add_album', () => {
    const { isArtistShifted, openNestedAction } = useMusicDrawers()
    expect(isArtistShifted.value).toBe(false)
    openNestedAction('add_album')
    expect(isArtistShifted.value).toBe(true)
  })

  it('computes isArtistShifted correctly with revise_artist', () => {
    const { isArtistShifted, openNestedAction } = useMusicDrawers()
    expect(isArtistShifted.value).toBe(false)
    openNestedAction('revise_artist')
    expect(isArtistShifted.value).toBe(true)
  })

  it('can refresh artist drawer data explicitly', () => {
    const { state, refreshArtist } = useMusicDrawers()
    expect(state.value.artistRefreshToken).toBe(0)
    refreshArtist()
    expect(state.value.artistRefreshToken).toBe(1)
  })
})

describe('useMusicDrawers music creation flow', () => {
  beforeEach(() => {
    const { closeAll } = useMusicDrawers()
    closeAll()
  })

  it('opens the creation flow with artist step and preserves seeded artist context', () => {
    const drawers = useMusicDrawers()

    expect(drawers.isMainShifted.value).toBe(false)
    expect(drawers.isArtistShifted.value).toBe(false)

    drawers.openMusicCreationFlow({ artistId: 'artist-7' })

    expect(drawers.state.value.creationFlow?.step).toBe('artist')
    expect(drawers.state.value.creationFlow?.draft.artist.id).toBe('artist-7')
    expect(drawers.state.value.creationFlow?.draft.artist.kind).toBe('person')
    expect(drawers.state.value.creationFlow?.draft.artist.members).toEqual([])
    expect(drawers.state.value.creationFlow?.draft.artist.birthDateParts).toEqual({
      year: '',
      month: '',
      day: '',
    })
    expect(drawers.state.value.creationFlow?.draft.artist.activeStartDateParts).toEqual({
      year: '',
      month: '',
      day: '',
    })
    expect(drawers.state.value.creationFlow?.draft.artist.activeEndDateParts).toEqual({
      year: '',
      month: '',
      day: '',
    })
    expect(drawers.state.value.creationFlow?.draft.artist.stageNames[0]).toMatchObject({
      startDateParts: {
        year: '',
        month: '',
        day: '',
      },
      endDateParts: {
        year: '',
        month: '',
        day: '',
      },
    })
    expect(drawers.state.value.creationFlow?.draft.albumSeed.title).toBe('')
    expect(drawers.state.value.creationFlow?.draft.albumDetails.releaseDateParts).toEqual({
      year: '',
      month: '',
      day: '',
    })
    expect(drawers.state.value.creationFlow?.draft.albumDetails.contributors).toEqual([
      {
        id: 'contributor-artist-7',
        artistId: 'artist-7',
        name: '',
        avatarUrl: '',
        kind: 'person',
        locked: false,
      },
    ])
    expect('name' in (drawers.state.value.creationFlow?.draft.artist ?? {})).toBe(false)
    expect('country' in (drawers.state.value.creationFlow?.draft.artist ?? {})).toBe(false)
    expect('birthday' in (drawers.state.value.creationFlow?.draft.artist ?? {})).toBe(false)

    expect(drawers.isMainShifted.value).toBe(true)
    expect(drawers.isArtistShifted.value).toBe(true)
  })

  it('opens standalone artist-first flow with empty contributors and reusable member draft structure', () => {
    const drawers = useMusicDrawers()

    drawers.openMusicCreationFlow()

    expect(drawers.state.value.creationFlow?.draft.artist.members).toEqual([])
    expect(drawers.state.value.creationFlow?.draft.albumDetails.contributors).toEqual([])
  })

  it('clears the creation flow draft when closeMusicCreationFlow is called', () => {
    const drawers = useMusicDrawers()

    drawers.openMusicCreationFlow()
    drawers.state.value.creationFlow!.draft.artist.legalName = 'Kanye West'
    drawers.closeMusicCreationFlow()

    expect(drawers.state.value.creationFlow).toBeNull()
  })

  it('clears creationFlow together when closing the music editor', () => {
    const drawers = useMusicDrawers()

    drawers.openMusicEditor({ entity: 'artist', mode: 'create' })
    drawers.openMusicCreationFlow()
    drawers.closeMusicEditor()

    expect(drawers.state.value.musicEditor).toBeNull()
    expect(drawers.state.value.creationFlow).toBeNull()
  })

  it('clears create-mode musicEditor when closing the creation flow', () => {
    const drawers = useMusicDrawers()

    drawers.openMusicEditor({ entity: 'artist', mode: 'create' })
    drawers.openMusicCreationFlow()
    drawers.closeMusicCreationFlow()

    expect(drawers.state.value.creationFlow).toBeNull()
    expect(drawers.state.value.musicEditor).toBeNull()
  })
})
