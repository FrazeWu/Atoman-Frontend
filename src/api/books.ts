import { apiGet, apiPostMultipart, apiRequest, apiRequestEnvelope } from '@/api/client'
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

export const listBookImports = () => apiGet<BookImportSession[]>(importsUrl())

export const getBookImport = (importId: string) =>
  apiGet<BookImportSession>(importsUrl(`/${encodeURIComponent(importId)}`))

export const createBookImport = (input: CreateBookImportInput) =>
  requestEnvelope<BookImportSession>(importsUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

export const createBookUploadPart = (importId: string, partNumber: number) =>
  requestEnvelope<BookUploadPartURL>(importsUrl(`/${encodeURIComponent(importId)}/parts/${partNumber}`), {
    method: 'POST',
  })

export const completeBookUploadPart = (
  importId: string,
  partNumber: number,
  part: Omit<BookUploadPart, 'part_number'>,
) =>
  requestEnvelope<BookImportSession>(importsUrl(`/${encodeURIComponent(importId)}/parts/${partNumber}/complete`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(part),
  })

export const completeBookImport = (importId: string) =>
  requestEnvelope<BookImportSession>(importsUrl(`/${encodeURIComponent(importId)}/complete`), {
    method: 'POST',
  })

export const deleteBookImport = (importId: string) =>
  requestEnvelope<{ deleted: boolean }>(importsUrl(`/${encodeURIComponent(importId)}`), {
    method: 'DELETE',
  })

export const retryBookImport = (importId: string) =>
  requestEnvelope<BookImportSession>(importsUrl(`/${encodeURIComponent(importId)}/retry`), {
    method: 'POST',
  })

export const linkBookImportToCatalog = (importId: string, input: { work_id?: string; edition_id?: string }) =>
  requestEnvelope<BookImportSession>(importsUrl(`/${encodeURIComponent(importId)}/catalog-link`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

export const searchPublicBooks = (query = '', limit = 20, offset = 0) =>
  apiGet<BookCatalogSearchResult>(`${catalogUrl('/search')}?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`)

export const createPublicBook = (input: CreatePublicBookInput) =>
  requestEnvelope<BookPublicWork>(catalogUrl('/works'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

export const getPublicBookWork = (workId: string) =>
  apiGet<BookPublicWork>(catalogUrl(`/works/${encodeURIComponent(workId)}`))

export const getPublicBookEdition = (editionId: string) =>
  apiGet<BookPublicEditionDetail>(catalogUrl(`/editions/${encodeURIComponent(editionId)}`))

export const getPublicBookReviews = (workId: string, limit = 20, offset = 0) =>
  apiGet<BookReviewListResult>(catalogUrl(`/works/${encodeURIComponent(workId)}/reviews?limit=${limit}&offset=${offset}`))

export const getPublicBookPosts = (workId: string, limit = 20, offset = 0) =>
  apiGet<BookPostListResult>(catalogUrl(`/works/${encodeURIComponent(workId)}/posts?limit=${limit}&offset=${offset}`))

export const getMyBookReview = (workId: string) =>
  apiGet<BookReview>(catalogUrl(`/works/${encodeURIComponent(workId)}/review`))

export const setBookRating = (workId: string, score: number) =>
  requestEnvelope<BookRatingSummary>(catalogUrl(`/works/${encodeURIComponent(workId)}/rating`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ score }),
  })

export const getBookRating = (workId: string) =>
  requestEnvelope<BookRatingSummary>(catalogUrl(`/works/${encodeURIComponent(workId)}/rating`), {})

export const deleteBookRating = (workId: string) =>
  requestEnvelope<BookRatingSummary>(catalogUrl(`/works/${encodeURIComponent(workId)}/rating`), {
    method: 'DELETE',
  })

export const saveBookReview = (workId: string, input: SaveBookReviewInput) =>
  requestEnvelope<BookReview>(catalogUrl(`/works/${encodeURIComponent(workId)}/review`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

export const deleteBookReview = (workId: string) =>
  requestEnvelope<{ deleted: boolean }>(catalogUrl(`/works/${encodeURIComponent(workId)}/review`), { method: 'DELETE' })

export const listBookShelf = (status = '', limit = 20, offset = 0) =>
  apiGet<BookShelfListResult>(`${booksUrl('/library')}?status=${encodeURIComponent(status)}&limit=${limit}&offset=${offset}`)

export const saveBookShelf = (workId: string, status: BookShelfItem['status'], note = '') =>
  requestEnvelope<BookShelfItem>(booksUrl(`/library/works/${encodeURIComponent(workId)}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, note }),
  })

export const deleteBookShelf = (workId: string) =>
  requestEnvelope<{ deleted: boolean }>(booksUrl(`/library/works/${encodeURIComponent(workId)}`), { method: 'DELETE' })

export const listContinueReading = (limit = 20) =>
  apiGet<BookContinueReading[]>(`${booksUrl('/library/continue')}?limit=${limit}`)

export const submitBookEdit = (input: SubmitBookEditInput) =>
  requestEnvelope<BookEdit>(booksUrl('/contributions'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

export const listMyBookEdits = (limit = 20, offset = 0) =>
  apiGet<BookEditListResult>(`${booksUrl('/contributions')}?limit=${limit}&offset=${offset}`)

export const withdrawBookEdit = (editId: string) =>
  requestEnvelope<{ withdrawn: boolean }>(booksUrl(`/contributions/${encodeURIComponent(editId)}/withdraw`), { method: 'POST' })

export const listBookEditReviewQueue = (limit = 20, offset = 0) =>
  apiGet<BookEditListResult>(`${booksUrl('/review/contributions')}?limit=${limit}&offset=${offset}`)

export const reviewBookEdit = (editId: string, decision: 'approved' | 'rejected', note = '') =>
  requestEnvelope<BookEdit>(booksUrl(`/review/contributions/${encodeURIComponent(editId)}/decision`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, note }),
  })

export const voteBookEdit = (editId: string, value: 1 | -1) =>
  requestEnvelope<BookEdit>(booksUrl(`/contributions/${encodeURIComponent(editId)}/vote`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  })

export const submitPublicationRequest = (assetId: string, input: SubmitPublicationInput) =>
  requestEnvelope<BookPublicationRequest>(assetsUrl(`/${encodeURIComponent(assetId)}/publication-requests`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

export const uploadPublicationEvidence = (requestId: string, file: File) => {
  const body = new FormData()
  body.append('evidence', file)
  return apiPostMultipart<BookPublicationRequest>(booksUrl(`/publication-requests/${encodeURIComponent(requestId)}/evidence`), body)
}

export const fetchPublicationEvidence = async (requestId: string): Promise<Blob> => {
  const response = await apiRequest(booksUrl(`/review/publication-requests/${encodeURIComponent(requestId)}/evidence`), { headers: { Accept: '*/*' } })
  if (!response.ok) throw new Error(`无法读取授权证据 (${response.status})`)
  return response.blob()
}
export const listMyPublicationRequests = (limit = 20, offset = 0) =>
  apiGet<BookPublicationRequestListResult>(`${booksUrl('/publication-requests')}?limit=${limit}&offset=${offset}`)

export const submitPublicationAppeal = (requestId: string, reason: string) =>
  requestEnvelope<BookPublicationAppeal>(booksUrl(`/publication-requests/${encodeURIComponent(requestId)}/appeals`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  })

export const listMyPublicationAppeals = (requestId: string, limit = 20, offset = 0) =>
  apiGet<BookPublicationAppealListResult>(`${booksUrl(`/publication-requests/${encodeURIComponent(requestId)}/appeals`)}?limit=${limit}&offset=${offset}`)

export const listPublicationReviewQueue = (limit = 20, offset = 0) =>
  apiGet<BookPublicationRequestListResult>(`${booksUrl('/review/publication-requests')}?limit=${limit}&offset=${offset}`)
export const listPublicationAppealReviewQueue = (limit = 20, offset = 0) =>
  apiGet<BookPublicationAppealListResult>(`${booksUrl('/review/publication-appeals')}?limit=${limit}&offset=${offset}`)

export const reviewPublicationAppeal = (appealId: string, decision: 'approved' | 'rejected', note = '') =>
  requestEnvelope<BookPublicationAppeal>(booksUrl(`/review/publication-appeals/${encodeURIComponent(appealId)}/decision`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, note }),
  })


export const listPublicationReports = (limit = 20, offset = 0) =>
  apiGet<BookPublicationReportListResult>(`${booksUrl('/review/publication-reports')}?limit=${limit}&offset=${offset}`)

export const reviewPublicationReport = (reportId: string, decision: 'removed' | 'rejected', note = '') =>
  requestEnvelope<BookPublicationReport>(booksUrl(`/review/publication-reports/${encodeURIComponent(reportId)}/decision`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, note }),
  })

export const reviewPublicationRequest = (requestId: string, decision: 'published' | 'rejected' | 'quarantined', note = '') =>
  requestEnvelope<BookPublicationRequest>(booksUrl(`/review/publication-requests/${encodeURIComponent(requestId)}/decision`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, note }),
  })

export const listPublishedBookAssets = (workId: string, limit = 20, offset = 0) =>
  apiGet<BookPublishedAssetListResult>(`${catalogUrl(`/works/${encodeURIComponent(workId)}/assets`)}?limit=${limit}&offset=${offset}`)

export const listPublicBookAssets = (limit = 20, offset = 0) =>
  apiGet<BookPublishedAssetListResult>(`${catalogUrl('/assets')}?limit=${limit}&offset=${offset}`)

export const getPublishedBookAsset = (assetId: string) =>
  apiGet<BookPublishedAsset>(catalogUrl(`/assets/${encodeURIComponent(assetId)}`))

export const fetchPublishedBookAssetContent = async (assetId: string): Promise<Blob> => {
  const url = catalogUrl(`/assets/${encodeURIComponent(assetId)}/content`)
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
        // Offline cache is best-effort.
      }
    }
    return response.blob()
  } catch (error) {
    if (cached) return cached.blob()
    throw error
  }
}

export const reportPublishedBookAsset = (assetId: string, reason: string) =>
  requestEnvelope<{ id: string; status: string }>(catalogUrl(`/assets/${encodeURIComponent(assetId)}/reports`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  })

export const linkBookPost = (workId: string, postId: string) =>
  requestEnvelope<{ linked: boolean }>(catalogUrl(`/works/${encodeURIComponent(workId)}/posts/${encodeURIComponent(postId)}`), {
    method: 'PUT',
  })

export const unlinkBookPost = (workId: string, postId: string) =>
  requestEnvelope<{ unlinked: boolean }>(catalogUrl(`/works/${encodeURIComponent(workId)}/posts/${encodeURIComponent(postId)}`), {
    method: 'DELETE',
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

export async function uploadBookFile(
  file: File,
  options: { title?: string; author?: string; onProgress?: (progress: BookFileUploadProgress) => void } = {},
): Promise<BookImportSession> {
  const session = await createBookImport({
    title: options.title,
    author: options.author,
    file_name: file.name,
    content_type: bookContentType(file),
    size: file.size,
  })
  await runMultipartUpload(file, {
    partSize: session.part_size,
    completedParts: session.completed_parts.map(part => part.part_number),
    uploadPart: async ({ partNumber, body }) => {
      const upload = await createBookUploadPart(session.id, partNumber)
      return uploadBlobPart(upload.upload_url, body, {
        onProgress: ({ loaded, total }) => options.onProgress?.({
          loaded: Math.min(file.size, (partNumber - 1) * session.part_size + loaded),
          total: file.size,
        }),
        messages: { missingETag: '上传分片未返回 ETag' },
      })
    },
    completePart: ({ partNumber, result: etag, size }) => (
      completeBookUploadPart(session.id, partNumber, { etag, size }).then(() => undefined)
    ),
    onProgress: options.onProgress,
  })
  return completeBookImport(session.id)
}
