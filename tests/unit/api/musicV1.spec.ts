import path from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi, afterEach } from 'vitest'
import { ApiErrorResponseError, apiGet, apiGetEnvelope, apiGetRaw, apiPatchJson, apiPostJson, apiPostMultipart } from '@/api/client'
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
  updateMusicArtist,
  type MusicAlbumListItem,
  musicV1Endpoints,
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
