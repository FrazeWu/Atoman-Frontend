import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createMusicPlaylist,
  getMusicPlaylist,
  listMusicStarred,
} from '@/api/musicV1'

describe('music starred api contract', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('uses the existing backend playlist songs endpoint for playlist detail', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ data: [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))

    await getMusicPlaylist('playlist-1')

    expect(fetch).toHaveBeenCalledWith('/api/v1/music/playlists/playlist-1/songs', expect.anything())
  })

  it('does not rely on a nonexistent aggregated /music/starred endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ data: [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))

    await listMusicStarred()

    expect(fetch).not.toHaveBeenCalledWith('/api/v1/music/starred', expect.anything())
  })

  it('creates playlists through the existing backend playlist collection endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ data: { id: 'playlist-1', name: 'Test' } }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    )))

    await createMusicPlaylist({ name: 'Test' })

    expect(fetch).toHaveBeenCalledWith('/api/v1/music/playlists', expect.objectContaining({
      method: 'POST',
    }))
  })
})
