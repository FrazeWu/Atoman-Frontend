import { apiGet, apiPostMultipart, apiRequest, apiRequestEnvelope } from '@/api/client'
import { fetchResourceRevision, listResourceRevisions, type ResourceRevision } from '@/api/bookResources'
import { useApiUrl } from '@/composables/useApi'
import { runMultipartUpload } from '@/api/multipartUpload'
import { uploadBlobPart } from '@/api/uploadTransport'

import type {
  BookImportStatus,
  BookAssetProcessingStatus,
  BookUploadPart,
  BookImportSession,
  BookPublicPerson,
  BookPublicPublisher,
  BookPublicProducer,
  BookPublicSource,
  BookPublicEdition,
  BookPublicWork,
  CreatePublicBookInput,
  BookPublicEditionDetail,
  BookRatingSummary,
  BookReview,
  SaveBookReviewInput,
  BookReviewListResult,
  BookShelfItem,
  BookShelfListResult,
  BookContinueReading,
  BookEditSource,
  BookEdit,
  BookEditListResult,
  SubmitBookEditInput,
  BookPublicationRequest,
  BookPublicationRequestListResult,
  BookPublicationAppeal,
  BookPublicationAppealListResult,
  SubmitPublicationInput,
  BookPublishedAsset,
  BookPublishedAssetListResult,
  BookPublicationReport,
  BookPublicationReportListResult,
  BookPublicPost,
  BookPostListResult,
  BookCatalogSearchResult,
  BookPrivateAsset,
  BookReadingState,
  SaveBookReadingStateInput,
  CreateBookImportInput,
  BookUploadPartURL,
  BookHighlightColor,
  BookHighlightStyle,
  BookAnnotation,
  BookAnnotationListResult,
  CreateBookAnnotationInput,
  UpdateBookAnnotationInput,
  ListBookNotesQuery,
} from '@/entities/book/model/types'

export type {
  BookImportStatus,
  BookAssetProcessingStatus,
  BookUploadPart,
  BookImportSession,
  BookPublicPerson,
  BookPublicPublisher,
  BookPublicProducer,
  BookPublicSource,
  BookPublicEdition,
  BookPublicWork,
  CreatePublicBookInput,
  BookPublicEditionDetail,
  BookRatingSummary,
  BookReview,
  SaveBookReviewInput,
  BookReviewListResult,
  BookShelfItem,
  BookShelfListResult,
  BookContinueReading,
  BookEditSource,
  BookEdit,
  BookEditListResult,
  SubmitBookEditInput,
  BookPublicationRequest,
  BookPublicationRequestListResult,
  BookPublicationAppeal,
  BookPublicationAppealListResult,
  SubmitPublicationInput,
  BookPublishedAsset,
  BookPublishedAssetListResult,
  BookPublicationReport,
  BookPublicationReportListResult,
  BookPublicPost,
  BookPostListResult,
  BookCatalogSearchResult,
  BookPrivateAsset,
  BookReadingState,
  SaveBookReadingStateInput,
  CreateBookImportInput,
  BookUploadPartURL,
  BookHighlightColor,
  BookHighlightStyle,
  BookAnnotation,
  BookAnnotationListResult,
  CreateBookAnnotationInput,
  UpdateBookAnnotationInput,
  ListBookNotesQuery,
}




const booksUrl = (suffix = '') => `${useApiUrl()}/books${suffix}`
const importsUrl = (suffix = '') => booksUrl(`/imports${suffix}`)
const assetsUrl = (suffix = '') => booksUrl(`/assets${suffix}`)
const catalogUrl = (suffix = '') => booksUrl(`/catalog${suffix}`)

async function requestEnvelope<T>(url: string, init: RequestInit): Promise<T> {
  const response = await apiRequestEnvelope<T>(url, init)
  return response.data
}

export const listContinueReading = (limit = 20) =>
  apiGet<BookContinueReading[]>(`${booksUrl('/library/continue')}?limit=${limit}`)

export const submitBookEdit = (input: SubmitBookEditInput) =>
  requestEnvelope<BookEdit>(booksUrl('/contributions'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

export const submitPublicationRequest = (assetId: string, input: SubmitPublicationInput) =>
  requestEnvelope<BookPublicationRequest>(assetsUrl(`/${encodeURIComponent(assetId)}/publication-requests`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

export const getBookAsset = (assetId: string) =>
  apiGet<BookPrivateAsset>(assetsUrl(`/${encodeURIComponent(assetId)}`))

export const getBookReadingState = (assetId: string) =>
  apiGet<BookReadingState>(assetsUrl(`/${encodeURIComponent(assetId)}/reading-state`))

export const saveBookReadingState = (assetId: string, input: SaveBookReadingStateInput) =>
  requestEnvelope<BookReadingState>(assetsUrl(`/${encodeURIComponent(assetId)}/reading-state`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

export const listBookNotes = (query?: ListBookNotesQuery) => {
  const params = new URLSearchParams()
  if (query?.q) params.set('q', query.q)
  if (query?.asset_id) params.set('asset_id', query.asset_id)
  if (query?.has_note !== undefined) params.set('has_note', String(query.has_note))
  if (query?.color) params.set('color', query.color)
  if (query?.limit !== undefined) params.set('limit', String(query.limit))
  if (query?.offset !== undefined) params.set('offset', String(query.offset))
  const qs = params.toString()
  return apiGet<BookAnnotationListResult>(booksUrl(`/notes${qs ? `?${qs}` : ''}`))
}

export const listAssetAnnotations = (assetId: string) =>
  apiGet<BookAnnotation[]>(assetsUrl(`/${encodeURIComponent(assetId)}/annotations`))

export const createBookAnnotation = (assetId: string, input: CreateBookAnnotationInput) =>
  requestEnvelope<BookAnnotation>(assetsUrl(`/${encodeURIComponent(assetId)}/annotations`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

export const updateBookAnnotation = (annotationId: string, input: UpdateBookAnnotationInput) =>
  requestEnvelope<BookAnnotation>(booksUrl(`/annotations/${encodeURIComponent(annotationId)}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

export const deleteBookAnnotation = (annotationId: string) =>
  requestEnvelope<{ deleted: boolean }>(booksUrl(`/annotations/${encodeURIComponent(annotationId)}`), {
    method: 'DELETE',
  })


export async function fetchBookAssetContent(assetId: string): Promise<Blob> {
  const response = await apiRequest(assetsUrl(`/${encodeURIComponent(assetId)}/content`), {
    headers: { Accept: '*/*' },
  })
  if (!response.ok) throw new Error(`无法读取电子书内容 (${response.status})`)
  return response.blob()
}

export async function uploadBookImportPart(uploadUrl: string, body: Blob): Promise<string> {
  return uploadBlobPart(uploadUrl, body, {
    transport: 'fetch',
    messages: { missingETag: '上传分片未返回 ETag' },
  })
}

export function bookContentType(file: Pick<File, 'name' | 'type'>): string {
  switch (file.name.toLowerCase().split('.').pop()) {
    case 'epub': return 'application/epub+zip'
    case 'pdf': return 'application/pdf'
    case 'txt': return 'text/plain'
    case 'cbz': return 'application/vnd.comicbook+zip'
    case 'cbr': return 'application/vnd.rar'
    case 'mobi': return 'application/x-mobipocket-ebook'
    case 'azw3': return 'application/vnd.amazon.mobi8-ebook'
    default: return file.type || 'application/octet-stream'
  }
}

export interface BookFileUploadProgress {
  loaded: number
  total: number
}


export const listBookImports = () => apiGet<BookImportSession[]>(importsUrl())

export const listBookShelf = (status = '', limit = 20, offset = 0) =>
  apiGet<BookShelfListResult>(`${booksUrl('/library')}?status=${encodeURIComponent(status)}&limit=${limit}&offset=${offset}`)

export const saveBookShelf = (workId: string, status: BookShelfItem['status'], note = '') =>
  requestEnvelope<BookShelfItem>(booksUrl(`/library/works/${encodeURIComponent(workId)}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, note }),
  })

export const getPublicBookReviews = (workId: string, limit = 20, offset = 0) =>
  apiGet<BookReviewListResult>(catalogUrl(`/works/${encodeURIComponent(workId)}/reviews?limit=${limit}&offset=${offset}`))

export const getBookRating = (workId: string) =>
  requestEnvelope<BookRatingSummary>(catalogUrl(`/works/${encodeURIComponent(workId)}/rating`), {})

// ---------------------------------------------------------------------------
// 公共阅读入口（books v2 契约）：以最新修订作为公共正文。
// ---------------------------------------------------------------------------
const publishedAssetContentType = (fileName: string): string => {
  const ext = fileName.includes('.') ? (fileName.split('.').pop() || '').toLowerCase() : ''
  if (ext === 'pdf') return 'application/pdf'
  if (ext === 'epub') return 'application/epub+zip'
  if (ext === 'txt') return 'text/plain'
  if (ext === 'cbz' || ext === 'cbr') return 'application/vnd.comicbook+zip'
  return 'application/octet-stream'
}

async function latestPublishedRevision(assetId: string): Promise<ResourceRevision> {
  const { items } = await listResourceRevisions(assetId)
  const revision = items
    .filter((item) => item.asset_id === assetId)
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0]
  if (!revision) throw new Error('公共电子书暂无可读版本')
  return revision
}

export const getPublishedBookAsset = async (assetId: string): Promise<BookPublishedAsset> => {
  const revision = await latestPublishedRevision(assetId)
  const fileName = revision.original_filename || 'book'
  const format = fileName.includes('.') ? (fileName.split('.').pop() || '').toLowerCase() : ''
  return {
    id: assetId,
    format,
    file_name: fileName,
    content_type: publishedAssetContentType(fileName),
    status: revision.status,
    created_at: revision.created_at || '',
    size: 0,
  }
}

export const fetchPublishedBookAssetContent = async (assetId: string): Promise<Blob> => {
  const revision = await latestPublishedRevision(assetId)
  const url = booksUrl(`/asset-revisions/${encodeURIComponent(revision.id)}/content`)
  const cacheName = 'atoman-public-books-v1'
  const cacheStorage = typeof caches !== 'undefined' ? caches : null
  const cached = cacheStorage ? await cacheStorage.match(url) : undefined
  try {
    const response = await apiRequest(url, { headers: { Accept: '*/*' } })
    if (!response.ok) throw new Error(`无法读取公共电子书内容 (${response.status})`)
    if (cacheStorage) {
      try {
        const cache = await cacheStorage.open(cacheName)
        await cache.put(url, response.clone())
      } catch {
        // 离线缓存尽力而为。
      }
    }
    return response.blob()
  } catch (error) {
    if (cached) return cached.blob()
    throw error
  }
}
