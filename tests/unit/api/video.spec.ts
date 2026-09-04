import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  getRecommendedVideos,
  getVideo,
  getVideoRecommendations,
  listVideos,
  duplicateVideo,
  createVideoRecommendationFeedback,
  createVideoImport,
  uploadVideoImportPart,
} from '@/api/video'

describe('video import API', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('uploads R2 import parts without application credentials and returns the ETag', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200, headers: { ETag: '"r2-etag"' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(uploadVideoImportPart(
      'https://r2.example.test/videos/task-1/part-1?X-Amz-Signature=signature',
      new Blob(['data']),
    )).resolves.toBe('"r2-etag"')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://r2.example.test/videos/task-1/part-1?X-Amz-Signature=signature',
      expect.objectContaining({ method: 'PUT', body: expect.any(Blob) }),
    )
    const [, init] = fetchMock.mock.calls[0]
    expect(init).not.toHaveProperty('credentials')
    expect(new Headers(init?.headers).has('Authorization')).toBe(false)
    expect(new Headers(init?.headers).has('X-CSRF-Token')).toBe(false)
  })

  it('rejects a non-R2 import part URL', async () => {
    await expect(uploadVideoImportPart('/api/v1/videos/imports/task-1/parts/1/upload', new Blob(['data']))).rejects.toThrow('R2')
  })

  it('infers the R2 upload content type from a video filename when the browser omits it', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'import-1' }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    await createVideoImport(new File(['video'], 'clip.MP4', { type: '' }), 'channel-1', 'token-1')

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/videos/imports', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ channel_id: 'channel-1', file_name: 'clip.MP4', file_size: 5, content_type: 'video/mp4' }),
    }))
  })

  it('encodes video path segments and query values', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await listVideos('latest&visibility=private')
    await getVideo('video/one?draft=true')
    await getRecommendedVideos('video/one?draft=true')
    await getVideoRecommendations('for-you&limit=100', 1, 8, 'token-1')

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/videos?sort=latest%26visibility%3Dprivate',
      '/api/v1/videos/video%2Fone%3Fdraft%3Dtrue',
      '/api/v1/videos/video%2Fone%3Fdraft%3Dtrue/recommended',
      '/api/v1/videos/recommend/items?mode=for-you%26limit%3D100&page=1&page_size=8',
    ])
    expect(fetchMock.mock.calls[3][1]).toEqual(expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer token-1' }),
    }))
  })

  it('creates a draft copy through the video endpoint', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'copy-1' }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    await duplicateVideo('video/one', 'token-1')

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/videos/video%2Fone/duplicate', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer token-1' }),
    }))
  })

  it('submits video recommendation feedback with an authenticated scope', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await createVideoRecommendationFeedback('channel', 'channel-1', 'token-1')

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/videos/recommendation-feedback', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer token-1' }),
      body: JSON.stringify({ scope: 'channel', target_id: 'channel-1' }),
    }))
  })
})
