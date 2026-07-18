import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  listAlbumBookmarks,
  listArtistBookmarks,
  listPlaylistBookmarks,
  listMusicPlaylists,
  createPlaylistBookmark,
  deletePlaylistBookmark,
  createMusicPlaylist,
  deleteMusicPlaylist,
  getMusicPlaylist,
  listMusicStarred,
  mergeMusicArtists,
  mergeMusicAlbums,
  musicV1Endpoints,
  listSongBookmarks,
  reorderMusicPlaylistSongs,
  updateMusicPlaylist,
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
		expect(musicV1Endpoints.playlistBookmarks()).toBe('/api/v1/music/bookmarks/playlists')
		expect(musicV1Endpoints.playlistBookmark('playlist-1')).toBe('/api/v1/music/bookmarks/playlists/playlist-1')
    expect(musicV1Endpoints.playlists()).toBe('/api/v1/music/playlists')
    expect(musicV1Endpoints.playlistSongs('playlist-1')).toBe('/api/v1/music/playlists/playlist-1/songs')
    expect(musicV1Endpoints.artistMerge('artist-target')).toBe('/api/v1/music/artists/artist-target/merge')
    expect(musicV1Endpoints.albumRevisions('album-1')).toBe('/api/v1/albums/album-1/revisions')
    expect(musicV1Endpoints.albumDiscussions('album-1')).toBe('/api/v1/albums/album-1/discussions')
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
      if (url === '/api/v1/music/bookmarks/playlists') {
        return new Response(JSON.stringify({ data: [{ id: 'playlist-bookmark-1', playlist_id: 'playlist-1', created_at: '2026-07-01T00:00:00Z', playlist: { id: 'playlist-1', name: '夜航歌单', song_count: 2 } }], meta: { page: 1, page_size: 20, total: 1, has_more: false } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
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

    const [artistBookmarks, albumBookmarks, songBookmarks, playlistBookmarks, playlists, starred] = await Promise.all([
      listArtistBookmarks(),
      listAlbumBookmarks(),
      listSongBookmarks(),
      listPlaylistBookmarks(),
      listMusicPlaylists(),
      listMusicStarred(),
    ])

    expect(artistBookmarks.data).toHaveLength(1)
    expect(albumBookmarks.data).toHaveLength(1)
    expect(songBookmarks.data).toHaveLength(1)
		expect(playlistBookmarks.data[0]?.playlist?.name).toBe('夜航歌单')
    expect(playlists.data).toHaveLength(1)
    expect(starred.map((item) => item.kind)).toEqual(['artist', 'album', 'song', 'playlist'])
  })

	it('creates and deletes playlist bookmarks through the playlist bookmark endpoint', async () => {
		vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			if (String(input) !== '/api/v1/music/bookmarks/playlists' && String(input) !== '/api/v1/music/bookmarks/playlists/playlist-1') {
				throw new Error(`unexpected fetch: ${String(input)}`)
			}
			if (init?.method === 'POST') {
				return new Response(JSON.stringify({ data: { id: 'bookmark-1', playlist_id: 'playlist-1', created_at: '2026-07-01T00:00:00Z' } }), { status: 201, headers: { 'Content-Type': 'application/json' } })
			}
			return new Response(JSON.stringify({ data: { deleted: true } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
		}))

		await createPlaylistBookmark('playlist-1')
		await deletePlaylistBookmark('playlist-1')

		expect(fetch).toHaveBeenNthCalledWith(1, '/api/v1/music/bookmarks/playlists', {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ playlist_id: 'playlist-1' }),
		})
		expect(fetch).toHaveBeenNthCalledWith(2, '/api/v1/music/bookmarks/playlists/playlist-1', {
			method: 'DELETE',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: undefined,
		})
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

  it('renames and deletes playlists through the music namespace', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/v1/music/playlists/playlist-1' && init?.method === 'PATCH') {
        return new Response(JSON.stringify({
          data: {
            id: 'playlist-1',
            name: '晚间歌单',
            description: '夜里听',
            song_count: 0,
          },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url === '/api/v1/music/playlists/playlist-1' && init?.method === 'DELETE') {
        return new Response(JSON.stringify({ data: { deleted: true } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }))

    const updated = await updateMusicPlaylist('playlist-1', { name: '晚间歌单', description: '夜里听' })
    const deleted = await deleteMusicPlaylist('playlist-1')

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/v1/music/playlists/playlist-1', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ name: '晚间歌单', description: '夜里听' }),
    })
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/v1/music/playlists/playlist-1', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: undefined,
    })
    expect(updated.name).toBe('晚间歌单')
    expect(deleted.deleted).toBe(true)
  })

  it('reorders playlist songs through the music namespace', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ data: { reordered: true } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))

    const result = await reorderMusicPlaylistSongs('playlist-1', ['song-2', 'song-1'])

    expect(fetch).toHaveBeenCalledWith('/api/v1/music/playlists/playlist-1/songs/order', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ song_ids: ['song-2', 'song-1'] }),
    })
    expect(result.reordered).toBe(true)
  })

  it('merges artists through the music namespace', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ data: { id: 'edit-artist', type: 'merge_artist', status: 'open' } }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    )))

    const result = await mergeMusicArtists('artist-target', 'artist-source')

    expect(fetch).toHaveBeenCalledWith('/api/v1/music/artists/artist-target/merge', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ source_artist_id: 'artist-source' }),
    })
    expect(result.id).toBe('edit-artist')
    expect(result.status).toBe('open')
  })

  it('merges albums through the music namespace', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ data: { id: 'edit-album', type: 'merge_album', status: 'open' } }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    )))

    const result = await mergeMusicAlbums('album-target', 'album-source')

    expect(fetch).toHaveBeenCalledWith('/api/v1/music/albums/album-target/merge', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ source_album_id: 'album-source' }),
    })
    expect(result.id).toBe('edit-album')
    expect(result.status).toBe('open')
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
      if (url === '/api/v1/music/playlists/playlist-1/songs') {
        return new Response(JSON.stringify({
          data: [
            {
              id: 'playlist-song-1',
              playlist_id: 'playlist-1',
              song_id: 'song-1',
              song: { id: 'song-1', title: 'cellophane', track_number: 1, audio_url: '', entry_status: 'open' },
            },
          ],
          meta: { page: 1, page_size: 20, total: 1, has_more: false },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }))

    const result = await getMusicPlaylist('playlist-1')

    expect(fetch).toHaveBeenCalledWith('/api/v1/music/playlists/playlist-1/songs', {
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
