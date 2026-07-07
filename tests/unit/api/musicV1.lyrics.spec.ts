import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiPutJson } from '@/api/client'
import {
  createMusicLyricsAnnotation,
  deleteMusicLyricsAnnotation,
  getMusicSongLyrics,
  listMusicSongLyricsVersions,
  musicV1Endpoints,
  revertMusicSongLyricsVersion,
  updateMusicLyricsAnnotation,
  updateMusicSongLyrics,
  voteMusicLyricsAnnotation,
} from '@/api/musicV1'

describe('music lyrics api client', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('sends PUT JSON requests with credentials and Accept headers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ data: { ok: true } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))

    const result = await apiPutJson<{ ok: boolean }>('/api/v1/music/songs/song-1/lyrics', { content: 'hello' })

    expect(fetch).toHaveBeenCalledWith('/api/v1/music/songs/song-1/lyrics', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ content: 'hello' }),
    })
    expect(result).toEqual({ ok: true })
  })
})

describe('music lyrics endpoints', () => {
  it('builds music lyrics endpoint paths', () => {
    expect(musicV1Endpoints.songLyrics('song-1')).toBe('/api/v1/music/songs/song-1/lyrics')
    expect(musicV1Endpoints.lyricAnnotations('song-1')).toBe('/api/v1/music/songs/song-1/lyrics/annotations')
    expect(musicV1Endpoints.lyricAnnotation('ann-1')).toBe('/api/v1/music/lyrics/annotations/ann-1')
    expect(musicV1Endpoints.lyricAnnotationVote('ann-1')).toBe('/api/v1/music/lyrics/annotations/ann-1/vote')
    expect(musicV1Endpoints.songLyricsVersions('song-1')).toBe('/api/v1/music/songs/song-1/lyrics/versions')
    expect(musicV1Endpoints.songLyricsVersionRevert('song-1', 3)).toBe('/api/v1/music/songs/song-1/lyrics/versions/3/revert')
  })
})

describe('music lyrics api adapter', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('gets song lyrics', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({
        data: {
          song_id: 'song-1',
          format: 'lrc',
          content: '[00:01.00]Hello',
          translation: '[00:01.00]你好',
          lines: [],
          annotations: [],
          version: 4,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))

    const result = await getMusicSongLyrics('song-1')

    expect(fetch).toHaveBeenCalledWith('/api/v1/music/songs/song-1/lyrics', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    expect(result.song_id).toBe('song-1')
  })

  it('updates song lyrics', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({
        data: {
          song_id: 'song-1',
          format: 'plain',
          content: 'Hello',
          translation: '你好',
          lines: [],
          annotations: [],
          version: 5,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))

    await updateMusicSongLyrics('song-1', {
      content: 'Hello',
      translation: '你好',
      format: 'plain',
      edit_summary: 'cleanup',
      annotation_resolutions: [
        {
          annotation_id: 'ann-1',
          action: 'needs_rebind',
        },
      ],
    })

    expect(fetch).toHaveBeenCalledWith('/api/v1/music/songs/song-1/lyrics', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        content: 'Hello',
        translation: '你好',
        format: 'plain',
        edit_summary: 'cleanup',
        annotation_resolutions: [
          {
            annotation_id: 'ann-1',
            action: 'needs_rebind',
          },
        ],
      }),
    })
  })

  it('creates, updates and deletes annotations', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          data: {
            id: 'ann-1',
            line_id: 'line-1',
            body: 'note',
            selected_text: 'Hello',
            start_offset: 0,
            end_offset: 5,
            upvotes: 0,
            downvotes: 0,
            net_score: 0,
            created_at: '2026-07-07T00:00:00Z',
            updated_at: '2026-07-07T00:00:00Z',
            status: 'active',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          data: {
            id: 'ann-1',
            line_id: 'line-1',
            body: 'updated',
            selected_text: 'Hello',
            start_offset: 0,
            end_offset: 5,
            upvotes: 0,
            downvotes: 0,
            net_score: 0,
            created_at: '2026-07-07T00:00:00Z',
            updated_at: '2026-07-07T00:01:00Z',
            status: 'active',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ data: { deleted: true } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )))

    await createMusicLyricsAnnotation('song-1', {
      line_id: 'line-1',
      selected_text: 'Hello',
      start_offset: 0,
      end_offset: 5,
      body: 'note',
    })
    await updateMusicLyricsAnnotation('ann-1', { body: 'updated' })
    await deleteMusicLyricsAnnotation('ann-1')

    expect(vi.mocked(fetch).mock.calls[0]).toEqual([
      '/api/v1/music/songs/song-1/lyrics/annotations',
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          line_id: 'line-1',
          selected_text: 'Hello',
          start_offset: 0,
          end_offset: 5,
          body: 'note',
        }),
      },
    ])
    expect(vi.mocked(fetch).mock.calls[1]).toEqual([
      '/api/v1/music/lyrics/annotations/ann-1',
      {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ body: 'updated' }),
      },
    ])
    expect(vi.mocked(fetch).mock.calls[2]).toEqual([
      '/api/v1/music/lyrics/annotations/ann-1',
      {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: undefined,
      },
    ])
  })

  it('votes on annotations with PUT', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({
        data: {
          id: 'ann-1',
          line_id: 'line-1',
          body: 'note',
          selected_text: 'Hello',
          start_offset: 0,
          end_offset: 5,
          upvotes: 3,
          downvotes: 1,
          net_score: 2,
          current_user_vote: 'down',
          created_at: '2026-07-07T00:00:00Z',
          updated_at: '2026-07-07T00:00:00Z',
          status: 'active',
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))

    await voteMusicLyricsAnnotation('ann-1', 'down')

    expect(fetch).toHaveBeenCalledWith('/api/v1/music/lyrics/annotations/ann-1/vote', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ vote: 'down' }),
    })
  })

  it('lists and reverts lyrics versions', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          data: [
            {
              id: 'version-1',
              song_id: 'song-1',
              version: 1,
              edit_summary: 'initial',
              created_at: '2026-07-07T00:00:00Z',
              editor_id: 'user-1',
              is_current: false,
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          data: {
            song_id: 'song-1',
            format: 'plain',
            content: 'Hello again',
            translation: '',
            lines: [],
            annotations: [],
            version: 2,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )))

    const versions = await listMusicSongLyricsVersions('song-1')
    const reverted = await revertMusicSongLyricsVersion('song-1', 1, 'restore')

    expect(versions[0]?.version).toBe(1)
    expect(reverted.version).toBe(2)
    expect(vi.mocked(fetch).mock.calls[0]).toEqual([
      '/api/v1/music/songs/song-1/lyrics/versions',
      {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      },
    ])
    expect(vi.mocked(fetch).mock.calls[1]).toEqual([
      '/api/v1/music/songs/song-1/lyrics/versions/1/revert',
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ edit_summary: 'restore' }),
      },
    ])
  })
})
