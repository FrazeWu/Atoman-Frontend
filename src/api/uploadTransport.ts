import { useApiUrl } from '@/composables/useApi'
import { configureApiXHR } from './transport'

export interface BlobPartUploadProgress {
  loaded: number
  total: number
}

export interface BlobPartUploadOptions {
  signal?: AbortSignal
  timeoutMs?: number
  headers?: HeadersInit
  onProgress?: (progress: BlobPartUploadProgress) => void
  messages?: Partial<{
    failed: string
    network: string
    timeout: string
    aborted: string
    missingETag: string
  }>
}

const defaultMessages = {
  failed: '上传分片失败',
  network: '上传分片失败，请重试',
  timeout: '上传分片超时，请重试',
  aborted: '上传已取消',
  missingETag: '上传分片失败',
}

function resolveUploadURL(uploadUrl: string) {
  if (!uploadUrl.startsWith('/')) return uploadUrl
  const apiUrl = useApiUrl()
  return /^https?:\/\//i.test(apiUrl) ? new URL(uploadUrl, apiUrl).toString() : uploadUrl
}

export function uploadBlobPart(
  uploadUrl: string,
  body: Blob,
  options: BlobPartUploadOptions = {},
): Promise<string> {
  const messages = { ...defaultMessages, ...options.messages }

  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(new Error(messages.aborted))
      return
    }

    const xhr = new XMLHttpRequest()
    let settled = false
    const abort = () => xhr.abort()
    const settle = (callback: () => void) => {
      if (settled) return
      settled = true
      options.signal?.removeEventListener('abort', abort)
      callback()
    }

    xhr.open('PUT', resolveUploadURL(uploadUrl))
    if (uploadUrl.startsWith('/')) configureApiXHR(xhr, 'PUT')
    if (options.timeoutMs && options.timeoutMs > 0) xhr.timeout = options.timeoutMs
    new Headers(options.headers).forEach((value, key) => xhr.setRequestHeader(key, value))
    options.signal?.addEventListener('abort', abort, { once: true })
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        options.onProgress?.({ loaded: event.loaded, total: event.total })
      }
    })
    xhr.addEventListener('load', () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        settle(() => reject(new Error(`${messages.failed} (${xhr.status})`)))
        return
      }
      const etag = xhr.getResponseHeader('ETag') || xhr.getResponseHeader('etag')
      if (!etag) {
        settle(() => reject(new Error(messages.missingETag)))
        return
      }
      settle(() => resolve(etag))
    })
    xhr.addEventListener('error', () => settle(() => reject(new Error(messages.network))))
    xhr.addEventListener('timeout', () => settle(() => reject(new Error(messages.timeout))))
    xhr.addEventListener('abort', () => settle(() => reject(new Error(messages.aborted))))
    xhr.send(body)
  })
}
