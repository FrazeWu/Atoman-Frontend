import { afterEach, describe, expect, it, vi } from 'vitest'

import { uploadBlobPart } from '@/api/uploadTransport'

describe('uploadBlobPart', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('uploads through XHR with progress and returns the response ETag', async () => {
    class FakeXMLHttpRequest {
      static current: FakeXMLHttpRequest
      status = 200
      timeout = 0
      withCredentials = false
      open = vi.fn()
      send = vi.fn()
      abort = vi.fn()
      setRequestHeader = vi.fn()
      getResponseHeader = vi.fn((name: string) => name.toLowerCase() === 'etag' ? 'etag-1' : null)
      private listeners = new Map<string, () => void>()
      private uploadListeners = new Map<string, (event: ProgressEvent) => void>()
      upload = {
        addEventListener: (event: string, listener: (event: ProgressEvent) => void) => {
          this.uploadListeners.set(event, listener)
        },
      }

      constructor() { FakeXMLHttpRequest.current = this }
      addEventListener(event: string, listener: () => void) { this.listeners.set(event, listener) }
      emit(event: string) { this.listeners.get(event)?.() }
      emitProgress(loaded: number, total: number) {
        this.uploadListeners.get('progress')?.({ lengthComputable: true, loaded, total } as ProgressEvent)
      }
    }
    vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest as unknown as typeof XMLHttpRequest)
    const progress = vi.fn()
    const body = new Blob(['data'])

    const result = uploadBlobPart('https://storage.example.test/part-1', body, { onProgress: progress })
    const xhr = FakeXMLHttpRequest.current
    xhr.emitProgress(2, 4)
    xhr.emit('load')

    await expect(result).resolves.toBe('etag-1')
    expect(xhr.open).toHaveBeenCalledWith('PUT', 'https://storage.example.test/part-1')
    expect(xhr.send).toHaveBeenCalledWith(body)
    expect(progress).toHaveBeenCalledWith({ loaded: 2, total: 4 })
  })

  it('configures relative API uploads with credentials and explicit headers', async () => {
    class FakeXMLHttpRequest {
      static current: FakeXMLHttpRequest
      status = 200
      withCredentials = false
      open = vi.fn()
      send = vi.fn()
      abort = vi.fn()
      setRequestHeader = vi.fn()
      getResponseHeader = vi.fn(() => 'etag-2')
      upload = { addEventListener: vi.fn() }
      private listeners = new Map<string, () => void>()

      constructor() { FakeXMLHttpRequest.current = this }
      addEventListener(event: string, listener: () => void) { this.listeners.set(event, listener) }
      emit(event: string) { this.listeners.get(event)?.() }
    }
    vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest as unknown as typeof XMLHttpRequest)

    const result = uploadBlobPart('/api/v1/uploads/part-1', new Blob(['data']), {
      headers: { Authorization: 'Bearer api-token' },
    })
    const xhr = FakeXMLHttpRequest.current
    xhr.emit('load')

    await expect(result).resolves.toBe('etag-2')
    expect(xhr.withCredentials).toBe(true)
    expect(xhr.setRequestHeader).toHaveBeenCalledWith('Authorization', 'Bearer api-token')
  })
})
