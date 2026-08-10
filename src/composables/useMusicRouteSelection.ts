import type { LocationQuery } from 'vue-router'

type MusicRouteSelectionHandlers = {
  openAlbum: (albumId: string) => void
  closeAlbum: () => void
  openArtist: (artistId: string) => void
  closeArtist: () => void
  openMusicCreationFlow: (payload?: {
    mode?: 'create' | 'edit'
    entity?: 'artist' | 'album'
    artistName?: string
    artistId?: string | null
    albumId?: string | null
    startStep?: 'artist' | 'albumImport' | 'albumDetails' | 'preview'
  }) => void
  closeMusicCreationFlow: () => void
  closeMusicEditor: () => void
}

export function useMusicRouteSelection(handlers: MusicRouteSelectionHandlers) {
  let lastRouteArtist: string | null = null
  let lastRouteAlbum: string | null = null
  let lastRouteEditor: string | null = null

  function applyRouteSelection(query: LocationQuery) {
    const artist = query.artist
    const album = query.album
    const editor = query.editor
    const name = query.name

    if (typeof artist === 'string' && artist) {
      handlers.openArtist(artist)
      lastRouteArtist = artist
    } else if (lastRouteArtist !== null) {
      handlers.closeArtist()
      lastRouteArtist = null
    }

    if (typeof album === 'string' && album) {
      handlers.openAlbum(album)
      lastRouteAlbum = album
    } else if (lastRouteAlbum !== null) {
      handlers.closeAlbum()
      lastRouteAlbum = null
    }

    const nextEditorKey = [
      typeof editor === 'string' ? editor : '',
      typeof artist === 'string' ? artist : '',
      typeof album === 'string' ? album : '',
      typeof name === 'string' ? name : '',
    ].join('|')

    if (typeof editor === 'string' && nextEditorKey !== lastRouteEditor) {
      if (editor === 'artist-create') {
        handlers.openMusicCreationFlow({
          startStep: 'artist',
          artistName: typeof name === 'string' && name.trim() ? name.trim() : undefined,
        })
        lastRouteEditor = nextEditorKey
        return
      }

      if (editor === 'album-edit' && typeof album === 'string' && album) {
        handlers.openMusicCreationFlow({
          mode: 'edit',
          entity: 'album',
          albumId: album,
          startStep: 'albumDetails',
        })
        lastRouteEditor = nextEditorKey
        return
      }
    }

    if (typeof editor !== 'string' && lastRouteEditor !== null) {
      handlers.closeMusicEditor()
      handlers.closeMusicCreationFlow()
      lastRouteEditor = null
    }
  }

  return {
    applyRouteSelection,
  }
}
