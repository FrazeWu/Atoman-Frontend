import { describe, it, expect, beforeEach } from 'vitest'
import { useMusicDrawers } from './useMusicDrawers'

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
})
