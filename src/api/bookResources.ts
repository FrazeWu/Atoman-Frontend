import { apiGet, apiRequest, apiRequestEnvelope } from '@/api/client'
import { useApiUrl } from '@/composables/useApi'
import { runMultipartUpload, type MultipartUploadProgress } from './multipartUpload'
import { uploadBlobPart } from './uploadTransport'
import { bookContentType } from './books'
import type { CatalogResource } from './bookCatalog'

export interface ResourceUpload {
  id: string
  asset_id: string
  file_name: string
  format: string
  content_type: string
  size: number
  part_size: number
  completed_parts: { part_number: number; etag: string; size: number }[]
  expires_at: string
  status: 'uploading' | 'completing' | 'uploaded' | 'scanning' | 'ready' | 'failed' | 'quarantined'
  revision_id?: string
  error_message: string
}
export interface ResourceRevision {
  id: string
  asset_id: string
  number: number
  status: 'ready'
  original_filename: string
  created_at: string
}
const url = (path: string) => `${useApiUrl()}/books${path}`
const uploadPath = (id: string) => `/upload-sessions/${encodeURIComponent(id)}`
async function post<T>(path: string, body?: unknown): Promise<T> {
  return (await apiRequestEnvelope<T>(url(path), { method: 'POST', ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) })).data
}
export const createCatalogResource = (workId: string, input: { title: string; language: string; format: CatalogResource['format'] }) =>
  post<CatalogResource>(`/works/${encodeURIComponent(workId)}/assets`, input)
export const createResourceUpload = (assetId: string, file: File, confirmed: boolean) =>
  post<ResourceUpload>(`/assets/${encodeURIComponent(assetId)}/upload-sessions`, { file_name: file.name, size: file.size, content_type: bookContentType(file), public_distribution_confirmed: confirmed })
export const getResourceUpload = (id: string) => apiGet<ResourceUpload>(url(uploadPath(id)))
export const listResourceRevisions = (id: string) => apiGet<{ items: ResourceRevision[] }>(url(`/assets/${encodeURIComponent(id)}/revisions`))
export async function fetchResourceRevision(id: string, signal?: AbortSignal) {
  const response = await apiRequest(url(`/asset-revisions/${encodeURIComponent(id)}/content`), { cache: 'no-store', signal })
  if (!response.ok) throw new Error('文件不可用或无权访问，请返回图书详情检查文件状态。')
  return response.blob()
}
export function resourceReaderPath(workId: string, assetId: string, revisionId: string) {
  return `/books/read/${encodeURIComponent(workId)}/${encodeURIComponent(assetId)}/${encodeURIComponent(revisionId)}`
}

// 仅重试当前持有的同一 File；以服务器确认的分片为准，不重传已确认部分。
export async function uploadResourceFile(file: File, original: ResourceUpload, options: { signal?: AbortSignal; onProgress?: (value: MultipartUploadProgress) => void } = {}) {
  const session = await getResourceUpload(original.id)
  if (session.status !== 'uploading') return session
  if (session.file_name !== file.name || session.size !== file.size) throw new Error('请选择本次上传的原文件')
  const completed = await runMultipartUpload(file, {
    partSize: session.part_size,
    completedParts: session.completed_parts.map(part => part.part_number),
    concurrency: 2,
    signal: options.signal,
    onProgress: options.onProgress,
    uploadPart: async ({ partNumber, body, signal, onProgress }) => {
      const part = await post<{ upload_url: string }>(`${uploadPath(session.id)}/parts/${partNumber}`)
      return uploadBlobPart(part.upload_url, body, { signal, onProgress: value => onProgress(value.loaded), messages: { missingETag: '分片未返回 ETag，请重试上传' } })
    },
    completePart: async ({ partNumber, size, result }) => {
      await post(`${uploadPath(session.id)}/parts/${partNumber}/complete`, { etag: result, size })
    },
  })
  if (!completed) throw new Error('上传已中断')
  options.signal?.throwIfAborted()
  return post<ResourceUpload>(`${uploadPath(session.id)}/complete`)
}
