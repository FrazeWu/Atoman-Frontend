import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  getRecommendedVideos,
  getVideo,
  getVideoRecommendations,
  listVideos,
  uploadVideoImportPart,
} from '@/api/video'

describe('video import API', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('uploads local import parts with progress and returns the ETag', async () => {
    class FakeXMLHttpRequest {
      static current: FakeXMLHttpRequest
      status = 200
      timeout = 0
      withCredentials = false
      open = vi.fn()
      send = vi.fn()
      setRequestHeader = vi.fn()
      getResponseHeader = vi.fn((name: string) => name.toLowerCase() === 'etag' ? '"local-etag"' : null)
      private listeners = new Map<string, () => void>()
      private uploadListeners = new Map<string, (event: ProgressEvent) => void>()
      upload = {
        addEventListener: (event: string, listener: (event: ProgressEvent) => void) => {
          this.uploadListeners.set(event, listener)
        },
      }

      constructor() { FakeXMLHttpRequest.current = this }

      addEventListener(event: string, listener: () => void) { this.listeners.set(event, listener) }

      emitProgress(loaded: number, total: number) {
        this.uploadListeners.get('progress')?.({ lengthComputable: true, loaded, total } as ProgressEvent)
      }

      emit(event: string) { this.listeners.get(event)?.() }
    }
    vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest as unknown as typeof XMLHttpRequest)
    const onProgress = vi.fn()
    const result = uploadVideoImportPart('/api/v1/videos/imports/task-1/parts/1/upload', new Blob(['data']), { onProgress, token: 'api-token' })
    const xhr = FakeXMLHttpRequest.current
    xhr.emitProgress(2, 4)
    xhr.emit('load')

    await expect(result).resolves.toBe('"local-etag"')
    expect(xhr.open).toHaveBeenCalledWith('PUT', '/api/v1/videos/imports/task-1/parts/1/upload')
    expect(xhr.withCredentials).toBe(true)
    expect(xhr.setRequestHeader).toHaveBeenCalledWith('Authorization', 'Bearer api-token')
    expect(onProgress).toHaveBeenCalledWith({ loaded: 2, total: 4 })
  })

  it('reports a timeout so the caller can retry a local part', async () => {
    class FakeXMLHttpRequest {
      static current: FakeXMLHttpRequest
      status = 200
      timeout = 0
      open = vi.fn()
      send = vi.fn()
      abort = vi.fn()
      setRequestHeader = vi.fn()
      getResponseHeader = vi.fn(() => '"local-etag"')
      upload = { addEventListener: vi.fn() }
      private listeners = new Map<string, () => void>()

      constructor() { FakeXMLHttpRequest.current = this }
      addEventListener(event: string, listener: () => void) { this.listeners.set(event, listener) }
      emit(event: string) { this.listeners.get(event)?.() }
    }
    vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest as unknown as typeof XMLHttpRequest)

    const result = uploadVideoImportPart('/api/v1/videos/imports/task-1/parts/1/upload', new Blob(['data']), { timeoutMs: 123 })
    const xhr = FakeXMLHttpRequest.current
    expect(xhr.timeout).toBe(123)
    xhr.emit('timeout')

    await expect(result).rejects.toThrow('视频分片超时，请重试')
  })

  it('encodes video path segments and query values', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await listVideos('latest&visibility=private')
    await getVideo('video/one?draft=true')
    await getRecommendedVideos('video/one?draft=true')
    await getVideoRecommendations('for-you&limit=100')

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/videos?sort=latest%26visibility%3Dprivate',
      '/api/v1/videos/video%2Fone%3Fdraft%3Dtrue',
      '/api/v1/videos/video%2Fone%3Fdraft%3Dtrue/recommended',
      '/api/v1/videos/recommend/items?mode=for-you%26limit%3D100&page=1&page_size=8',
    ])
  })
})
