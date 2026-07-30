import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { uploadFormDataWithProgress } from '@/api/upload'
import { clearCSRFToken, setCSRFToken } from '@/api/transport'

class FakeXMLHttpRequest {
  static current: FakeXMLHttpRequest

  status = 200
  responseText = JSON.stringify({ url: '/uploads/media.mp4' })
  withCredentials = false
  open = vi.fn()
  send = vi.fn()
  setRequestHeader = vi.fn()
  private listeners = new Map<string, () => void>()
  private uploadListeners = new Map<string, (event: ProgressEvent) => void>()
  upload = {
    addEventListener: (event: string, listener: (event: ProgressEvent) => void) => {
      this.uploadListeners.set(event, listener)
    },
  }

  constructor() {
    FakeXMLHttpRequest.current = this
  }

  addEventListener(event: string, listener: () => void) {
    this.listeners.set(event, listener)
  }

  emitProgress(loaded: number, total: number) {
    this.uploadListeners.get('progress')?.({ lengthComputable: true, loaded, total } as ProgressEvent)
  }

  emit(event: string) {
    this.listeners.get(event)?.()
  }
}

describe('uploadFormDataWithProgress', () => {
  beforeEach(() => {
    vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest)
    setCSRFToken('csrf-token')
  })

  afterEach(() => {
    clearCSRFToken()
    vi.unstubAllGlobals()
  })

  it('configures authenticated XHR and resolves parsed responses with progress', async () => {
    const progress = vi.fn()
    const form = new FormData()
    const resultPromise = uploadFormDataWithProgress<{ url: string }>('/upload', form, progress)
    const xhr = FakeXMLHttpRequest.current

    xhr.emitProgress(5, 8)
    xhr.emit('load')

    await expect(resultPromise).resolves.toEqual({ url: '/uploads/media.mp4' })
    expect(xhr.open).toHaveBeenCalledWith('POST', '/upload')
    expect(xhr.withCredentials).toBe(true)
    expect(xhr.setRequestHeader).toHaveBeenCalledWith('X-CSRF-Token', 'csrf-token')
    expect(xhr.send).toHaveBeenCalledWith(form)
    expect(progress).toHaveBeenCalledWith(63)
  })

  it('uses the caller fallback for non-JSON error responses', async () => {
    const resultPromise = uploadFormDataWithProgress(
      '/upload',
      new FormData(),
      vi.fn(),
      () => ({ error: '上传失败' }),
    )
    const xhr = FakeXMLHttpRequest.current
    xhr.status = 502
    xhr.responseText = '<html>bad gateway</html>'
    xhr.emit('load')

    await expect(resultPromise).rejects.toEqual({ error: '上传失败' })
  })

  it('rejects successful responses that are not valid JSON', async () => {
    const resultPromise = uploadFormDataWithProgress('/upload', new FormData(), vi.fn())
    const xhr = FakeXMLHttpRequest.current
    xhr.responseText = 'upload completed'
    xhr.emit('load')

    await expect(resultPromise).rejects.toEqual({ error: 'upload completed' })
  })
})
