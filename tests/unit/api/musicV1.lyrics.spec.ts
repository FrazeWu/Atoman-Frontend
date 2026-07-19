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
  type UpdateMusicLyricsAnnotationInput,
} from '@/api/musicV1'

const bodyOnlyAnnotationUpdate: UpdateMusicLyricsAnnotationInput = { body: 'updated' }
const rebindAnnotationUpdate: UpdateMusicLyricsAnnotationInput = {
  line_key: 'line-1',
  selected_text: 'Hello',
  start_offset: 0,
  end_offset: 5,
}
// @ts-expect-error 更新注释必须包含正文或完整锚点。
const emptyAnnotationUpdate: UpdateMusicLyricsAnnotationInput = {}
// @ts-expect-error 锚点不可只传部分字段。
const partialAnchorAnnotationUpdate: UpdateMusicLyricsAnnotationInput = { line_key: 'line-1' }

void bodyOnlyAnnotationUpdate
void rebindAnnotationUpdate
void emptyAnnotationUpdate
void partialAnchorAnnotationUpdate

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
    expect(musicV1Endpoints.lyricAnnotation('song-1', 'ann-1')).toBe('/api/v1/music/songs/song-1/lyrics/annotations/ann-1')
    expect(musicV1Endpoints.lyricAnnotationVote('song-1', 'ann-1')).toBe('/api/v1/music/songs/song-1/lyrics/annotations/ann-1/votes')
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
          id: 'lyrics-1',
          song_id: 'song-1',
          format: 'lrc',
          content: '[00:01.00]Hello',
          translation: '[00:01.00]你好',
          edit_summary: 'initial',
          updated_at: '2026-07-07T00:00:00Z',
          updated_by: 'user-1',
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
          id: 'lyrics-1',
          song_id: 'song-1',
          format: 'plain',
          content: 'Hello',
          translation: '你好',
          edit_summary: 'cleanup',
          updated_at: '2026-07-07T00:00:00Z',
          updated_by: 'user-1',
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
        { annotation_id: 'ann-1', action: 'needs_rebind' },
        {
          annotation_id: 'ann-2',
          action: 'rebind',
          line_key: 'line-2',
          selected_text: 'Hello',
          start_offset: 0,
          end_offset: 5,
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
          { annotation_id: 'ann-1', action: 'needs_rebind' },
          {
            annotation_id: 'ann-2',
            action: 'rebind',
            line_key: 'line-2',
            selected_text: 'Hello',
            start_offset: 0,
            end_offset: 5,
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
            song_id: 'song-1',
            line_key: 'line-1',
            body: 'note',
            selected_text: 'Hello',
            start_offset: 0,
            end_offset: 5,
            upvotes: 0,
            downvotes: 0,
            created_at: '2026-07-07T00:00:00Z',
            updated_at: '2026-07-07T00:00:00Z',
            status: 'active',
            creator: {
              id: 'user-1',
              username: 'fafa',
            },
            viewer_vote: 'none',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          data: {
            id: 'ann-1',
            song_id: 'song-1',
            line_key: 'line-1',
            body: 'updated',
            selected_text: 'Hello',
            start_offset: 0,
            end_offset: 5,
            upvotes: 0,
            downvotes: 0,
            created_at: '2026-07-07T00:00:00Z',
            updated_at: '2026-07-07T00:01:00Z',
            status: 'active',
            creator: {
              id: 'user-1',
              username: 'fafa',
            },
            viewer_vote: 'none',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ data: { deleted: true } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )))

    await createMusicLyricsAnnotation('song-1', {
      line_key: 'line-1',
      selected_text: 'Hello',
      start_offset: 0,
      end_offset: 5,
      body: 'note',
    })
    await updateMusicLyricsAnnotation('song-1', 'ann-1', { body: 'updated' })
    await deleteMusicLyricsAnnotation('song-1', 'ann-1')

    expect(vi.mocked(fetch).mock.calls[0]).toEqual([
      '/api/v1/music/songs/song-1/lyrics/annotations',
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          line_key: 'line-1',
          selected_text: 'Hello',
          start_offset: 0,
          end_offset: 5,
          body: 'note',
        }),
      },
    ])
    expect(vi.mocked(fetch).mock.calls[1]).toEqual([
      '/api/v1/music/songs/song-1/lyrics/annotations/ann-1',
      {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ body: 'updated' }),
      },
    ])
    expect(vi.mocked(fetch).mock.calls[2]).toEqual([
      '/api/v1/music/songs/song-1/lyrics/annotations/ann-1',
      {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: undefined,
      },
    ])
  })

  it('serializes complete anchors when rebinding an annotation', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ data: { id: 'ann-1' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))

    await updateMusicLyricsAnnotation('song-1', 'ann-1', {
      line_key: 'line-2',
      selected_text: 'Midnight',
      start_offset: 0,
      end_offset: 8,
    })

    expect(fetch).toHaveBeenCalledWith('/api/v1/music/songs/song-1/lyrics/annotations/ann-1', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        line_key: 'line-2',
        selected_text: 'Midnight',
        start_offset: 0,
        end_offset: 8,
      }),
    })
  })

  it('votes on annotations with POST', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({
        data: {
          id: 'ann-1',
          song_id: 'song-1',
          line_key: 'line-1',
          body: 'note',
          selected_text: 'Hello',
          start_offset: 0,
          end_offset: 5,
          upvotes: 3,
          downvotes: 1,
          created_at: '2026-07-07T00:00:00Z',
          updated_at: '2026-07-07T00:00:00Z',
          status: 'active',
          creator: {
            id: 'user-2',
            username: 'other',
          },
          viewer_vote: 'down',
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))

    await voteMusicLyricsAnnotation('song-1', 'ann-1', 'down')

    expect(fetch).toHaveBeenCalledWith('/api/v1/music/songs/song-1/lyrics/annotations/ann-1/votes', {
      method: 'POST',
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
              content: 'Hello',
              translation: '',
              format: 'plain',
              edit_summary: 'initial',
              created_at: '2026-07-07T00:00:00Z',
              created_by: 'user-1',
              updated_by: 'user-1',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          data: {
            id: 'lyrics-1',
            song_id: 'song-1',
            format: 'plain',
            content: 'Hello again',
            translation: '',
            edit_summary: 'restore',
            updated_at: '2026-07-07T00:01:00Z',
            updated_by: 'user-1',
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
