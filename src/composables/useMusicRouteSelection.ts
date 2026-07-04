import type { LocationQuery } from 'vue-router'

type MusicRouteSelectionHandlers = {
  openAlbum: (albumId: string) => void
  closeAlbum: () => void
  openArtist: (artistId: string) => void
  closeArtist: () => void
  openMusicEditor: (payload: {
    entity: 'artist' | 'album'
    mode: 'create' | 'edit'
    id?: string
    seed?: { name: string }
  }) => void
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
        handlers.openMusicEditor({
          entity: 'artist',
          mode: 'create',
          seed: typeof name === 'string' && name.trim() ? { name: name.trim() } : undefined,
        })
        lastRouteEditor = nextEditorKey
        return
      }

      if (editor === 'album-edit' && typeof album === 'string' && album) {
        handlers.openMusicEditor({
          entity: 'album',
          mode: 'edit',
          id: album,
        })
        lastRouteEditor = nextEditorKey
        return
      }
    }

    if (typeof editor !== 'string' && lastRouteEditor !== null) {
      handlers.closeMusicEditor()
      lastRouteEditor = null
    }
  }

  return {
    applyRouteSelection,
  }
}
