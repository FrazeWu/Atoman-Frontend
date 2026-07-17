import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  listAlbumBookmarks,
  listArtistBookmarks,
  listMusicPlaylists,
  createMusicPlaylist,
  getMusicPlaylist,
  listMusicStarred,
  musicV1Endpoints,
  listSongBookmarks,
} from '@/api/musicV1'

function createStorageMock() {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
  }
}

describe('music v1 starred and playlist adapters', () => {
  const localStorageMock = createStorageMock()

  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    localStorageMock.clear()
  })

  it('builds starred and playlist endpoint paths', () => {
    expect(musicV1Endpoints.artistBookmarks()).toBe('/api/v1/music/bookmarks/artists')
    expect(musicV1Endpoints.albumBookmarks()).toBe('/api/v1/music/bookmarks/albums')
    expect(musicV1Endpoints.songBookmarks()).toBe('/api/v1/music/bookmarks/songs')
    expect(musicV1Endpoints.playlists()).toBe('/api/v1/music/playlists')
    expect(musicV1Endpoints.playlistSongs('playlist-1')).toBe('/api/v1/music/playlists/playlist-1/songs')
  })

  it('lists bookmarks and playlists through existing music endpoints', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/v1/music/bookmarks/artists') {
        return new Response(JSON.stringify({ data: [{ id: 'artist-bookmark-1', artist_id: 'artist-1', created_at: '2026-07-01T00:00:00Z' }], meta: { page: 1, page_size: 20, total: 1, has_more: false } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url === '/api/v1/music/bookmarks/albums') {
        return new Response(JSON.stringify({ data: [{ id: 'album-bookmark-1', album_id: 'album-1', created_at: '2026-07-01T00:00:00Z' }], meta: { page: 1, page_size: 20, total: 1, has_more: false } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url === '/api/v1/music/bookmarks/songs') {
        return new Response(JSON.stringify({ data: [{ id: 'song-bookmark-1', song_id: 'song-1', created_at: '2026-07-01T00:00:00Z', song: { id: 'song-1', title: 'cellophane', entry_status: 'open' } }], meta: { page: 1, page_size: 20, total: 1, has_more: false } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url === '/api/v1/music/playlists') {
        return new Response(JSON.stringify({ data: [{ id: 'playlist-1', name: '夜航歌单', song_count: 2 }], meta: { page: 1, page_size: 20, total: 1, has_more: false } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url === '/api/v1/music/artists/artist-1') {
        return new Response(JSON.stringify({ data: { id: 'artist-1', name: 'FKA twigs', entry_status: 'open' } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url === '/api/v1/music/albums/album-1') {
        return new Response(JSON.stringify({ data: { id: 'album-1', title: 'MAGDALENE', entry_status: 'open' } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }))

    const [artistBookmarks, albumBookmarks, songBookmarks, playlists, starred] = await Promise.all([
      listArtistBookmarks(),
      listAlbumBookmarks(),
      listSongBookmarks(),
      listMusicPlaylists(),
      listMusicStarred(),
    ])

    expect(artistBookmarks.data).toHaveLength(1)
    expect(albumBookmarks.data).toHaveLength(1)
    expect(songBookmarks.data).toHaveLength(1)
    expect(playlists.data).toHaveLength(1)
    expect(starred.map((item) => item.kind)).toEqual(['artist', 'album', 'song', 'playlist'])
  })

  it('creates playlists through the music namespace', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({
        data: {
          id: 'playlist-2',
          name: '通勤歌单',
          song_count: 0,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))

    const result = await createMusicPlaylist({ name: '通勤歌单' })

    expect(fetch).toHaveBeenCalledWith('/api/v1/music/playlists', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ name: '通勤歌单' }),
    })
    expect(result.name).toBe('通勤歌单')
  })

  it('gets playlist details with songs', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/v1/music/playlists/playlist-1') {
        return new Response(JSON.stringify({
          data: {
            id: 'playlist-1',
            name: '夜航歌单',
            description: '凌晨反复播放',
            song_count: 2,
          },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url === '/api/v1/music/playlists/playlist-1/songs?page=1&page_size=100') {
        return new Response(JSON.stringify({
          data: [
            { id: 'song-1', title: 'cellophane', track_number: 1, audio_url: '', entry_status: 'open' },
          ],
          meta: { page: 1, page_size: 20, total: 1, has_more: false },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }))

    const result = await getMusicPlaylist('playlist-1')

    expect(fetch).toHaveBeenCalledWith('/api/v1/music/playlists/playlist-1/songs?page=1&page_size=100', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    expect(result.songs).toHaveLength(1)
  })

  it('attaches bearer auth to music bookmark and playlist requests when token exists', async () => {
    localStorageMock.setItem('token', 'music-token')

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/v1/music/bookmarks/artists') {
        return new Response(JSON.stringify({
          data: [],
          meta: { page: 1, page_size: 20, total: 0, has_more: false },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url === '/api/v1/music/playlists') {
        return new Response(JSON.stringify({
          data: {
            id: 'playlist-3',
            name: 'Auth Playlist',
            song_count: 0,
          },
        }), { status: 201, headers: { 'Content-Type': 'application/json' } })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }))

    await listArtistBookmarks()
    await createMusicPlaylist({ name: 'Auth Playlist' })

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/v1/music/bookmarks/artists', {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer music-token',
      },
    })
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/v1/music/playlists', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: 'Bearer music-token',
      },
      body: JSON.stringify({ name: 'Auth Playlist' }),
    })
  })
})
