import path from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi, afterEach } from 'vitest'
import { ApiErrorResponseError, apiGet, apiGetEnvelope, apiGetRaw, apiPatchJson, apiPostJson, apiPostMultipart } from '@/api/client'
import * as apiUrlModule from '@/composables/useApi'
import {
  createMusicArtist,
  buildCreateAlbumEdit,
  buildCreateArtistEdit,
  buildDeleteAlbumEdit,
  buildUpdateAlbumEdit,
  getMusicAlbum,
  getMusicArtist,
  listMusicArtists,
  listMusicAlbums,
  listMusicEdits,
  startMusicAlbumImportMultipart,
  updateMusicArtist,
  type MusicAlbumListItem,
  musicV1Endpoints,
  uploadMusicAlbumArchiveMultipart,
  uploadMusicAsset,
} from '@/api/musicV1'
import * as musicV1 from '@/api/musicV1'

describe('api v1 client', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('unwraps successful data envelopes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ data: { id: 'album_uuid', title: 'Album' }, meta: { source: 'test' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))

    const result = await apiGet<{ id: string; title: string }>('/api/v1/music/albums/album_uuid')

    expect(result).toEqual({ id: 'album_uuid', title: 'Album' })
    expect(fetch).toHaveBeenCalledWith('/api/v1/music/albums/album_uuid', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
  })

  it('returns success envelopes when meta is needed by the caller', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ data: [{ id: 'album_uuid', title: 'Album' }], meta: { page: 2, page_size: 1, total: 5, has_more: true } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))

    const result = await apiGetEnvelope<{ id: string; title: string }[], { page: number; page_size: number; total: number; has_more: boolean }>(
      '/api/v1/music/albums?page=2&page_size=1',
    )

    expect(result).toEqual({
      data: [{ id: 'album_uuid', title: 'Album' }],
      meta: { page: 2, page_size: 1, total: 5, has_more: true },
    })
  })

  it('returns raw JSON payloads when callers handle legacy response shapes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify([{ id: 'channel_uuid', name: 'Channel' }]),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))

    const result = await apiGetRaw<{ id: string; name: string }[]>('/api/v1/blog/channels')

    expect(result).toEqual([{ id: 'channel_uuid', name: 'Channel' }])
    expect(fetch).toHaveBeenCalledWith('/api/v1/blog/channels', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
  })

  it('throws typed errors while preserving API error code', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: { code: 'music.entry_protected', message: 'Entry is protected.', details: { role: 'admin' } } }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    )))

    await expect(apiPostJson('/api/v1/music/edits', { type: 'update_album' })).rejects.toMatchObject({
      status: 403,
      code: 'music.entry_protected',
      message: 'Entry is protected.',
      details: { role: 'admin' },
    })
  })

  it('posts multipart upload without setting a manual Content-Type header', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ data: { url: 'https://cdn.example.com/assets/music/covers/uploads/users/user-1/2026/06/cover.png', key: 'music/covers/uploads/users/user-1/2026/06/cover.png', content_type: 'image/png', size: 123 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))

    const form = new FormData()
    form.append('purpose', 'music.cover')

    const result = await apiPostMultipart<{ url: string; key: string; content_type: string; size: number }>('/api/v1/uploads', form)

    expect(result.url).toBe('https://cdn.example.com/assets/music/covers/uploads/users/user-1/2026/06/cover.png')
    const [, init] = vi.mocked(fetch).mock.calls[0]
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' })
    expect((init as RequestInit).headers).toEqual({ Accept: 'application/json' })
  })

  it('maps non-JSON error responses into typed internal errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      '<html>bad gateway</html>',
      { status: 502, headers: { 'Content-Type': 'text/html' } },
    )))

    await expect(apiGet('/api/v1/music/albums')).rejects.toMatchObject({
      status: 502,
      code: 'system.internal_error',
      message: 'Request failed.',
      details: {},
    })
  })

  it('maps non-JSON success responses into typed invalid response errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      '<html>not api json</html>',
      { status: 200, headers: { 'Content-Type': 'text/html' } },
    )))

    await expect(apiGet('/api/v1/music/albums')).rejects.toMatchObject({
      status: 200,
      code: 'system.invalid_response',
      message: 'Invalid API response.',
      details: {},
    })
  })

  it('exposes ApiErrorResponseError for component error mapping', () => {
    const error = new ApiErrorResponseError(422, 'music.invalid_source', 'Invalid source.', { field: 'sources' })

    expect(error.status).toBe(422)
    expect(error.code).toBe('music.invalid_source')
    expect(error.details).toEqual({ field: 'sources' })
  })

  it('sends PATCH JSON requests with credentials and Accept headers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ data: { id: 'artist_uuid', name: 'Updated' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))

    const result = await apiPatchJson<{ id: string; name: string }>('/api/v1/music/artists/artist_uuid', { name: 'Updated' })

    expect(fetch).toHaveBeenCalledWith('/api/v1/music/artists/artist_uuid', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    })
    expect(result.name).toBe('Updated')
  })
})

describe('music v1 adapter', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('builds api v1 endpoint paths', () => {
    expect(musicV1Endpoints.uploads()).toBe('/api/v1/uploads')
    expect(musicV1Endpoints.albums()).toBe('/api/v1/music/albums')
    expect(musicV1Endpoints.album('album_uuid')).toBe('/api/v1/music/albums/album_uuid')
    expect(musicV1Endpoints.edits()).toBe('/api/v1/music/edits')
    expect(musicV1Endpoints.editApprove('edit_uuid')).toBe('/api/v1/music/edits/edit_uuid/approve')
  })

  it('reuses the shared api base url for music endpoints', () => {
    vi.spyOn(apiUrlModule, 'useApiUrl').mockReturnValue('https://api.atoman.org/api/v1')

    expect(musicV1Endpoints.albums()).toBe('https://api.atoman.org/api/v1/music/albums')
    expect(musicV1Endpoints.artist('artist_uuid')).toBe('https://api.atoman.org/api/v1/music/artists/artist_uuid')
  })

  it('serializes list filters using the api v1 query vocabulary and preserves server pagination meta', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ data: [], meta: { page: 3, page_size: 20, total: 41, has_more: true } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))

    const result = await listMusicAlbums({ q: 'ambient', status: 'open', page: 1, page_size: 20, sort: '-created_at' })

    expect(fetch).toHaveBeenCalledWith('/api/v1/music/albums?q=ambient&status=open&page=1&page_size=20&sort=-created_at', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    expect(result).toEqual({
      data: [],
      meta: { page: 3, page_size: 20, total: 41, has_more: true },
    })
  })

  it('keeps album hot_score available to discovery views', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({
        data: [{ id: 'album_uuid', title: 'Album', entry_status: 'open', hot_score: 12.5, year: 2026 }],
        meta: { page: 1, page_size: 20, total: 1, has_more: false },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))

    const result = await listMusicAlbums({ sort: 'hot', page: 1, page_size: 20 })
    const first: MusicAlbumListItem = result.data[0]

    expect(fetch).toHaveBeenCalledWith('/api/v1/music/albums?sort=hot&page=1&page_size=20', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    expect(first.hot_score).toBe(12.5)
    expect(first.year).toBe(2026)
  })

  it('lists artists through the music v1 namespace', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ data: [{ id: 'artist_uuid', name: 'Artist', entry_status: 'open' }], meta: { page: 1, page_size: 20, total: 1, has_more: false } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))

    const result = await listMusicArtists({ q: 'artist', page: 1, page_size: 20 })

    expect(fetch).toHaveBeenCalledWith('/api/v1/music/artists?q=artist&page=1&page_size=20', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    expect(result.data).toEqual([{ id: 'artist_uuid', name: 'Artist', entry_status: 'open' }])
  })

  it('gets artist details through the direct wiki endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ data: { id: 'artist_uuid', name: 'Kanye West', bio: 'Artist bio', entry_status: 'open' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))

    const result = await getMusicArtist('artist_uuid')

    expect(fetch).toHaveBeenCalledWith('/api/v1/music/artists/artist_uuid', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    expect(result).toEqual({ id: 'artist_uuid', name: 'Kanye West', bio: 'Artist bio', entry_status: 'open' })
  })

  it('creates artists through the direct wiki endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ data: { id: 'artist_uuid', name: 'Kanye West', bio: 'Artist bio', entry_status: 'open' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))

    const result = await createMusicArtist({ name: 'Kanye West', bio: 'Artist bio' })

    expect(fetch).toHaveBeenCalledWith('/api/v1/music/artists', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ name: 'Kanye West', bio: 'Artist bio' }),
    })
    expect(result).toEqual({ id: 'artist_uuid', name: 'Kanye West', bio: 'Artist bio', entry_status: 'open' })
  })

  it('updates artists through the direct wiki endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ data: { id: 'artist_uuid', name: 'Ye', bio: 'Updated bio', entry_status: 'open' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))

    const result = await updateMusicArtist('artist_uuid', { name: 'Ye', bio: 'Updated bio' })

    expect(fetch).toHaveBeenCalledWith('/api/v1/music/artists/artist_uuid', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ name: 'Ye', bio: 'Updated bio' }),
    })
    expect(result.name).toBe('Ye')
  })

  it('gets album details through the direct wiki endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ data: { id: 'album_uuid', title: 'Graduation', entry_status: 'open' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))

    const result = await getMusicAlbum('album_uuid')

    expect(fetch).toHaveBeenCalledWith('/api/v1/music/albums/album_uuid', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    expect(result).toEqual({ id: 'album_uuid', title: 'Graduation', entry_status: 'open' })
  })

  it('loads every playlist song page for a complete detail', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ data: { id: 'playlist_uuid', name: 'Favorites', song_count: 0 } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          data: [{ id: 'playlist_song_uuid', song: { id: 'song_uuid', title: 'Song' } }],
          meta: { page: 1, page_size: 20, total: 37, has_more: true },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          data: [{ id: 'playlist_song_uuid_2', song: { id: 'song_uuid_2', title: 'Song 2' } }],
          meta: { page: 2, page_size: 20, total: 37, has_more: false },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )))

    const result = await musicV1.getMusicPlaylist('playlist_uuid')

    expect(result.song_count).toBe(37)
    expect(result.songs).toEqual([
      { id: 'song_uuid', title: 'Song' },
      { id: 'song_uuid_2', title: 'Song 2' },
    ])
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/v1/music/playlists/playlist_uuid/songs?page=1&page_size=100', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    expect(fetch).toHaveBeenNthCalledWith(3, '/api/v1/music/playlists/playlist_uuid/songs?page=2&page_size=100', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
  })

  it('builds update album edits with track collection changes', () => {
    const result = buildUpdateAlbumEdit('album_uuid', {
      title: 'Updated Album',
      artist_ids: ['artist_uuid'],
      release_date: '2026-07-01',
      album_type: 'ep',
      tracks: [
        {
          id: 'song-1',
          title: 'Keep Song',
          track_number: 1,
          lyrics: 'lyrics',
          audio_url: 'https://cdn.example.com/song-1.mp3',
        },
        {
          title: 'New Song',
          track_number: 2,
          audio_url: 'https://cdn.example.com/song-2.mp3',
        },
      ],
      reason: 'Update album tracks',
      sources: [{ type: 'url', url: 'https://example.com/source', title: 'Source' }],
    })

    expect(result).toEqual({
      type: 'update_album',
      entity_type: 'album',
      entity_id: 'album_uuid',
      payload: {},
      changes: {
        title: 'Updated Album',
        artist_ids: ['artist_uuid'],
        release_date: '2026-07-01',
        album_type: 'ep',
        tracks: [
          {
            id: 'song-1',
            title: 'Keep Song',
            track_number: 1,
            lyrics: 'lyrics',
            audio_url: 'https://cdn.example.com/song-1.mp3',
          },
          {
            title: 'New Song',
            track_number: 2,
            audio_url: 'https://cdn.example.com/song-2.mp3',
          },
        ],
      },
      reason: 'Update album tracks',
      sources: [{ type: 'url', url: 'https://example.com/source', title: 'Source' }],
    })
  })

  it('uploads music cover assets with the correct purpose', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ data: { url: 'https://cdn.example.com/assets/music/covers/uploads/users/user-1/2026/06/c.png', key: 'music/covers/uploads/users/user-1/2026/06/c.png', content_type: 'image/png', size: 1 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
    const file = new File(['x'], 'cover.png', { type: 'image/png' })

    const result = await uploadMusicAsset(file, 'music.cover')

    const [, init] = vi.mocked(fetch).mock.calls[0]
    const body = (init as RequestInit).body as FormData
    expect(result.url).toMatch(/^https:\/\/cdn\.example\.com\/assets\/music\/covers\/uploads\//)
    expect(result.url).not.toMatch(/^\/uploads\//)
    expect(body.get('purpose')).toBe('music.cover')
    expect(body.get('file')).toBe(file)
  })

  it('builds create album edit payloads instead of direct CRUD payloads', () => {
    const edit = buildCreateAlbumEdit({
      title: 'Album',
      artist_ids: ['artist_uuid'],
      release_date: '2026-05-29',
      cover: { url: 'https://cdn.example.com/assets/music/covers/uploads/users/user-1/2026/06/c.png', key: 'music/covers/uploads/users/user-1/2026/06/c.png', content_type: 'image/png', size: 1 },
      description: 'Description',
      reason: 'official release information',
      sources: [{ type: 'url', url: 'https://example.com', title: 'Official' }],
    })

    expect(edit).toEqual({
      type: 'create_album',
      entity_type: 'album',
      payload: {
        title: 'Album',
        artist_ids: ['artist_uuid'],
        release_date: '2026-05-29',
        cover_url: 'https://cdn.example.com/assets/music/covers/uploads/users/user-1/2026/06/c.png',
        cover_key: 'music/covers/uploads/users/user-1/2026/06/c.png',
        description: 'Description',
      },
      changes: {},
      reason: 'official release information',
      sources: [{ type: 'url', url: 'https://example.com', title: 'Official' }],
    })
  })

  it('builds create artist edit payloads instead of direct CRUD payloads', () => {
    const edit = buildCreateArtistEdit({
      name: 'New Artist',
      bio: 'artist biography',
      image_url: 'https://example.com/artist.jpg',
      nationality: 'JP',
      birth_date: '1990-05-21',
      birth_year: 1990,
      reason: 'official profile',
      sources: [{ type: 'url', url: 'https://example.com/profile', title: 'Official profile' }],
    })

    expect(edit).toEqual({
      type: 'create_artist',
      entity_type: 'artist',
      payload: {
        name: 'New Artist',
        bio: 'artist biography',
        image_url: 'https://example.com/artist.jpg',
        nationality: 'JP',
        birth_date: '1990-05-21',
        birth_year: 1990,
      },
      changes: {},
      reason: 'official profile',
      sources: [{ type: 'url', url: 'https://example.com/profile', title: 'Official profile' }],
    })
  })

  it('builds update and delete album edit payloads', () => {
    expect(buildUpdateAlbumEdit('album_uuid', {
      title: 'New title',
      reason: 'metadata correction',
      sources: [],
    })).toEqual({
      type: 'update_album',
      entity_type: 'album',
      entity_id: 'album_uuid',
      payload: {},
      changes: { title: 'New title' },
      reason: 'metadata correction',
      sources: [],
    })

    expect(buildDeleteAlbumEdit('album_uuid', 'duplicate album')).toEqual({
      type: 'delete_album',
      entity_type: 'album',
      entity_id: 'album_uuid',
      payload: {},
      changes: { target_status: 'closed' },
      reason: 'duplicate album',
      sources: [],
    })
  })

  it('lists review edits through /api/v1/music/edits', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ data: [], meta: { page: 2, page_size: 20, total: 24, has_more: true } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))

    const result = await listMusicEdits({ status: 'open', entity_type: 'album', page: 1, page_size: 20 })

    expect(fetch).toHaveBeenCalledWith('/api/v1/music/edits?status=open&entity_type=album&page=1&page_size=20', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    expect(result).toEqual({
      data: [],
      meta: { page: 2, page_size: 20, total: 24, has_more: true },
    })
  })

  it('does not expose revert music edit endpoints or api methods', () => {
    expect(musicV1Endpoints).not.toHaveProperty('editRevert')
    expect(musicV1).not.toHaveProperty('revertMusicEdit')
  })

  it('starts album import multipart uploads through the correct path and body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ data: { partSize: 10485760, completedParts: [] } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))

    const result = await startMusicAlbumImportMultipart('import_uuid', {
      fileName: 'album.zip',
      fileSize: 123456,
      contentType: 'application/zip',
    })

    expect(fetch).toHaveBeenCalledWith('/api/v1/music/imports/albums/import_uuid/multipart', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        fileName: 'album.zip',
        fileSize: 123456,
        contentType: 'application/zip',
      }),
    })
    expect(result).toEqual({ partSize: 10485760, completedParts: [] })
  })

  it('rejects album archive files over 2GB before sending requests', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const file = new File(['x'], 'album.zip', { type: 'application/zip' })
    Object.defineProperty(file, 'size', { value: 2 * 1024 * 1024 * 1024 + 1 })

    await expect(uploadMusicAlbumArchiveMultipart('import_uuid', file)).rejects.toThrow('文件需在 2GB 以内，请转换或压缩后上传')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('skips completed multipart parts and only uploads missing parts', async () => {
    const file = new File(['aaaabbbbcccc'], 'album.zip', { type: 'application/zip' })
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/v1/music/imports/albums/import_uuid/multipart') {
        return new Response(JSON.stringify({ data: { partSize: 4, completedParts: [{ partNumber: 2, etag: 'existing-etag' }] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.endsWith('/multipart/parts/1')) {
        return new Response(JSON.stringify({ data: { partNumber: 1, uploadUrl: 'https://r2.example.com/part-1' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.endsWith('/multipart/parts/3')) {
        return new Response(JSON.stringify({ data: { partNumber: 3, uploadUrl: 'https://r2.example.com/part-3' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url === 'https://r2.example.com/part-1') {
        expect(init).toMatchObject({ method: 'PUT' })
        expect(init?.credentials).toBeUndefined()
        expect(init?.headers).toBeUndefined()
        return new Response(null, { status: 200, headers: { ETag: '"etag-1"' } })
      }
      if (url === 'https://r2.example.com/part-3') {
        expect(init).toMatchObject({ method: 'PUT' })
        expect(init?.credentials).toBeUndefined()
        expect(init?.headers).toBeUndefined()
        return new Response(null, { status: 200, headers: { ETag: '"etag-3"' } })
      }
      if (url.endsWith('/multipart/parts/1/complete') || url.endsWith('/multipart/parts/3/complete')) {
        return new Response(JSON.stringify({ data: { ok: true } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url === '/api/v1/music/imports/albums/import_uuid/multipart/complete') {
        return new Response(JSON.stringify({ data: { importId: 'import_uuid', status: 'uploaded' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      throw new Error(`unexpected request ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await uploadMusicAlbumArchiveMultipart('import_uuid', file)

    expect(result).toMatchObject({ importId: 'import_uuid', status: 'uploaded' })
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/v1/music/imports/albums/import_uuid/multipart/parts/2',
      expect.anything(),
    )
    expect(fetchMock).toHaveBeenCalledWith('https://r2.example.com/part-1', expect.objectContaining({ method: 'PUT' }))
    expect(fetchMock).toHaveBeenCalledWith('https://r2.example.com/part-3', expect.objectContaining({ method: 'PUT' }))
  })

  it('reports multipart ETags to part complete and then completes the import', async () => {
    const file = new File(['aaaabbbb'], 'album.zip', { type: 'application/zip' })
    const progress: Array<{ loaded: number; total: number; bytesPerSecond: number }> = []
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/v1/music/imports/albums/import_uuid/multipart') {
        return new Response(JSON.stringify({ data: { partSize: 4, completedParts: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.endsWith('/multipart/parts/1')) {
        return new Response(JSON.stringify({ data: { partNumber: 1, uploadUrl: 'https://r2.example.com/part-1' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.endsWith('/multipart/parts/2')) {
        return new Response(JSON.stringify({ data: { partNumber: 2, uploadUrl: 'https://r2.example.com/part-2' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url === 'https://r2.example.com/part-1') return new Response(null, { status: 200, headers: { etag: '"etag-1"' } })
      if (url === 'https://r2.example.com/part-2') return new Response(null, { status: 200, headers: { ETag: '"etag-2"' } })
      if (url.endsWith('/multipart/parts/1/complete') || url.endsWith('/multipart/parts/2/complete')) {
        return new Response(JSON.stringify({ data: { ok: true } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url === '/api/v1/music/imports/albums/import_uuid/multipart/complete') {
        return new Response(JSON.stringify({ data: { importId: 'import_uuid', status: 'uploaded' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      throw new Error(`unexpected request ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    await uploadMusicAlbumArchiveMultipart('import_uuid', file, {
      onProgress: (event) => progress.push(event),
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/music/imports/albums/import_uuid/multipart/parts/1/complete', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ etag: '"etag-1"', size: 4 }),
    }))
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/music/imports/albums/import_uuid/multipart/parts/2/complete', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ etag: '"etag-2"', size: 4 }),
    }))
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/music/imports/albums/import_uuid/multipart/complete', expect.objectContaining({ method: 'POST' }))
    expect(progress.at(-1)).toMatchObject({ loaded: 8, total: 8 })
    expect(progress.at(-1)?.bytesPerSecond).toBeGreaterThan(0)
  })

  it('retries failed R2 PUT requests twice and succeeds on the third attempt', async () => {
    const file = new File(['aaaa'], 'album.zip', { type: 'application/zip' })
    const putCalls: RequestInit[] = []
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/v1/music/imports/albums/import_uuid/multipart') {
        return new Response(JSON.stringify({ data: { partSize: 4, completedParts: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url === '/api/v1/music/imports/albums/import_uuid/multipart/parts/1') {
        return new Response(JSON.stringify({ data: { partNumber: 1, uploadUrl: 'https://r2.example.com/retry-part' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url === 'https://r2.example.com/retry-part') {
        putCalls.push(init as RequestInit)
        expect(init?.credentials).toBeUndefined()
        expect(init?.headers).toBeUndefined()
        return new Response(null, {
          status: putCalls.length < 3 ? 500 : 200,
          headers: putCalls.length < 3 ? undefined : { ETag: '"etag-after-retry"' },
        })
      }
      if (url === '/api/v1/music/imports/albums/import_uuid/multipart/parts/1/complete') {
        return new Response(JSON.stringify({ data: { partNumber: 1, etag: '"etag-after-retry"' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url === '/api/v1/music/imports/albums/import_uuid/multipart/complete') {
        return new Response(JSON.stringify({ data: { importId: 'import_uuid', status: 'uploaded' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      throw new Error(`unexpected request ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await uploadMusicAlbumArchiveMultipart('import_uuid', file)

    expect(result).toMatchObject({ importId: 'import_uuid', status: 'uploaded' })
    expect(putCalls).toHaveLength(3)
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/music/imports/albums/import_uuid/multipart/complete', expect.objectContaining({ method: 'POST' }))
  })

  it('throws a useful error after R2 PUT retries are exhausted and skips final complete', async () => {
    const file = new File(['aaaa'], 'album.zip', { type: 'application/zip' })
    const putCalls: RequestInit[] = []
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/v1/music/imports/albums/import_uuid/multipart') {
        return new Response(JSON.stringify({ data: { partSize: 4, completedParts: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url === '/api/v1/music/imports/albums/import_uuid/multipart/parts/1') {
        return new Response(JSON.stringify({ data: { partNumber: 1, uploadUrl: 'https://r2.example.com/failing-part' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url === 'https://r2.example.com/failing-part') {
        putCalls.push(init as RequestInit)
        expect(init?.credentials).toBeUndefined()
        expect(init?.headers).toBeUndefined()
        return new Response(null, { status: 503 })
      }
      throw new Error(`unexpected request ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(uploadMusicAlbumArchiveMultipart('import_uuid', file)).rejects.toThrow('上传分片失败 (503)')

    expect(putCalls).toHaveLength(3)
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/v1/music/imports/albums/import_uuid/multipart/complete',
      expect.anything(),
    )
  })

  it('reports 100% progress when all multipart parts are already completed', async () => {
    const file = new File(['aaaabbbb'], 'album.zip', { type: 'application/zip' })
    const progress: Array<{ loaded: number; total: number; bytesPerSecond: number }> = []
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/v1/music/imports/albums/import_uuid/multipart') {
        return new Response(JSON.stringify({
          data: {
            partSize: 4,
            completedParts: [
              { partNumber: 1, etag: '"etag-1"' },
              { partNumber: 2, etag: '"etag-2"' },
            ],
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url === '/api/v1/music/imports/albums/import_uuid/multipart/complete') {
        return new Response(JSON.stringify({ data: { importId: 'import_uuid', status: 'uploaded' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      throw new Error(`unexpected request ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    await uploadMusicAlbumArchiveMultipart('import_uuid', file, {
      onProgress: (event) => progress.push(event),
    })

    expect(progress).toHaveLength(1)
    expect(progress[0]).toMatchObject({ loaded: 8, total: 8 })
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/v1/music/imports/albums/import_uuid/multipart/parts/1',
      expect.anything(),
    )
  })
})

describe('music building-block barrel', () => {
  it('exports shell and section components from the music building-block layer', () => {
    const barrel = readFileSync(path.resolve(process.cwd(), 'src/components/music/index.ts'), 'utf8')

    expect(barrel).toContain('MusicAlbumMetaSection')
    expect(barrel).toContain('MusicCoverSection')
    expect(barrel).toContain('MusicTracksSection')
    expect(barrel).toContain('MusicSourcesSection')
    expect(barrel).toContain('MusicReviewNotesSection')
    expect(barrel).toContain('AlbumEditorShell')
  })
})
