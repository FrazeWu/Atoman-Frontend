import { describe, expect, it, vi } from 'vitest'

import { useMusicRouteSelection } from '@/composables/useMusicRouteSelection'

function createHandlers() {
  return {
    openAlbum: vi.fn(),
    closeAlbum: vi.fn(),
    openArtist: vi.fn(),
    closeArtist: vi.fn(),
    openMusicCreationFlow: vi.fn(),
    closeMusicCreationFlow: vi.fn(),
    closeMusicEditor: vi.fn(),
  }
}

describe('useMusicRouteSelection', () => {
  it('rebuilds route-selected layers when the artist or album changes', () => {
    const handlers = createHandlers()
    const { applyRouteSelection } = useMusicRouteSelection(handlers)

    applyRouteSelection({ artist: 'artist-1', album: 'album-1' })
    applyRouteSelection({ artist: 'artist-2', album: 'album-2' })

    expect(handlers.openArtist).toHaveBeenNthCalledWith(1, 'artist-1')
    expect(handlers.openAlbum).toHaveBeenNthCalledWith(1, 'album-1')
    expect(handlers.closeAlbum).toHaveBeenCalledTimes(1)
    expect(handlers.closeArtist).toHaveBeenCalledTimes(1)
    expect(handlers.openArtist).toHaveBeenNthCalledWith(2, 'artist-2')
    expect(handlers.openAlbum).toHaveBeenNthCalledWith(2, 'album-2')
  })

  it('does not reopen unchanged route-selected layers', () => {
    const handlers = createHandlers()
    const { applyRouteSelection } = useMusicRouteSelection(handlers)

    applyRouteSelection({ album: 'album-1' })
    applyRouteSelection({ album: 'album-1' })

    expect(handlers.openAlbum).toHaveBeenCalledTimes(1)
    expect(handlers.closeAlbum).not.toHaveBeenCalled()
  })

  it('closes the active editor when route editor params become invalid', () => {
    const handlers = createHandlers()
    const { applyRouteSelection } = useMusicRouteSelection(handlers)

    applyRouteSelection({ editor: 'album-edit', album: 'album-1' })
    applyRouteSelection({ editor: 'album-edit' })

    expect(handlers.openMusicCreationFlow).toHaveBeenCalledTimes(1)
    expect(handlers.closeMusicEditor).toHaveBeenCalledTimes(1)
    expect(handlers.closeMusicCreationFlow).toHaveBeenCalledTimes(1)
  })
})
