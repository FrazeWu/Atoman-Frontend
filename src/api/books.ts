import { apiGet, apiPostMultipart, apiRequest, apiRequestEnvelope } from '@/api/client'
import { useApiUrl } from '@/composables/useApi'

export type BookImportStatus =
  | 'pending_upload'
  | 'uploading'
  | 'completing'
  | 'uploaded'
  | 'scanning'
  | 'metadata_ready'
  | 'failed'
  | 'cancelled'
  | 'deleted'

export type BookAssetProcessingStatus =
  | 'pending_upload'
  | 'uploading'
  | 'uploaded'
  | 'scanning'
  | 'processing'
  | 'metadata_ready'
  | 'private_available'
  | 'failed'
  | 'rejected'
  | 'quarantined'
  | 'removed'

export interface BookUploadPart {
  part_number: number
  etag: string
  size: number
}

export interface BookImportSession {
  id: string
  title: string
  author?: string
  file_name: string
  format: 'epub' | 'pdf' | 'txt' | string
  content_type: string
  size: number
  status: BookImportStatus | string
  part_size: number
  completed_parts: BookUploadPart[]
  expires_at: string
  work_id?: string
  edition_id?: string
  asset_id?: string
  processing_status?: BookAssetProcessingStatus | string
  error_code?: string
  error_message?: string
}

export interface BookPublicPerson {
  id: string
  name: string
  role: string
}

export interface BookPublicSource {
  kind?: string
  title?: string
  url: string
  note?: string
}

export interface BookPublicEdition {
  id: string
  work_id: string
  title?: string
  publisher?: string
  isbn10?: string
  isbn13?: string
  language?: string
  published_date?: string
  page_count?: number
  binding?: string
  cover_url?: string
}

export interface BookPublicWork {
  id: string
  title: string
  subtitle?: string
  original_title?: string
  description?: string
  language?: string
  lifecycle_status: string
  rating_score: number
  rating_count: number
  authors: BookPublicPerson[]
  editions: BookPublicEdition[]
  sources?: BookPublicSource[]
  related_posts?: BookPublicPost[]
}

export interface BookPublicEditionDetail {
  edition: BookPublicEdition
  work: BookPublicWork
  sources?: BookPublicSource[]
}

export interface BookRatingSummary {
  rating_score: number
  rating_count: number
  viewer_rating?: number
}

export interface BookReview {
  id: string
  author_id: string
  work_id: string
  content: string
  spoiler: boolean
  created_at: string
  updated_at: string
}

export interface SaveBookReviewInput {
  content: string
  spoiler: boolean
  visibility: 'public' | 'private'
}

export interface BookReviewListResult {
  items: BookReview[]
  total: number
  limit: number
  offset: number
}

export interface BookShelfItem {
  id: string
  work_id: string
  status: 'want_to_read' | 'reading' | 'read' | 'on_hold' | 'dropped' | string
  note?: string
  updated_at: string
  work: BookPublicWork
}

export interface BookShelfListResult {
  items: BookShelfItem[]
  total: number
  limit: number
  offset: number
}

export interface BookContinueReading {
  asset_id: string
  title: string
  author?: string
  file_name: string
  format: 'epub' | 'pdf' | 'txt' | string
  processing_status: BookAssetProcessingStatus | string
  reading_percent: number
  last_read_at?: string
}

export interface BookEditSource {
  kind?: string
  title?: string
  url: string
  note?: string
}

export interface BookEdit {
  id: string
  type: string
  entity_type: string
  entity_id?: string
  status: string
  reason?: string
  decision_note?: string
  created_at: string
  reviewed_at?: string
  sources: BookEditSource[]
  upvote_count: number
  downvote_count: number
}

export interface BookEditListResult {
  items: BookEdit[]
  total: number
  limit: number
  offset: number
}

export interface SubmitBookEditInput {
  type: 'create' | 'update' | 'merge' | 'retire' | 'reopen'
  entity_type: 'work' | 'edition' | 'person'
  entity_id?: string
  payload: Record<string, unknown>
  reason?: string
  sources: Array<{ url: string; kind?: string; title?: string; note?: string }>
}

export interface BookPublicationRequest {
  id: string
  asset_id: string
  work_id?: string
  edition_id?: string
  status: string
  license_type: string
  rights_holder: string
  source_url: string
  declaration: string
  evidence_uploaded: boolean
  published_asset_status?: string
  reason?: string
  decision_note?: string
  created_at: string
  reviewed_at?: string
}

export interface BookPublicationRequestListResult {
  items: BookPublicationRequest[]
  total: number
  limit: number
  offset: number
}
export interface BookPublicationAppeal {
  id: string
  publication_request_id: string
  published_asset_id: string
  reason: string
  status: 'pending' | 'approved' | 'rejected' | string
  decision_note?: string
  created_at: string
  reviewed_at?: string
}

export interface BookPublicationAppealListResult {
  items: BookPublicationAppeal[]
  total: number
  limit: number
  offset: number
}


export interface SubmitPublicationInput {
  work_id?: string
  edition_id?: string
  license_type: 'public_domain' | 'open_license' | 'creator_owned' | 'authorized_distribution'
  rights_holder: string
  source_url: string
  declaration: string
  reason?: string
}

export interface BookPublishedAsset {
  id: string
  work_id?: string
  edition_id?: string
  format: 'epub' | 'pdf' | 'txt' | string
  file_name: string
  content_type: string
  size: number
  status: string
  created_at: string
}

export interface BookPublishedAssetListResult {
  items: BookPublishedAsset[]
  total: number
  limit: number
  offset: number
}

export interface BookPublicationReport {
  id: string
  asset_id: string
  reason: string
  status: string
  decision_note?: string
  created_at: string
  reviewed_at?: string
}

export interface BookPublicationReportListResult {
  items: BookPublicationReport[]
  total: number
  limit: number
  offset: number
}

export interface BookPublicPost {
  id: string
  title: string
  summary?: string
  published_at?: string
}

export interface BookPostListResult {
  items: BookPublicPost[]
  total: number
  limit: number
  offset: number
}

export interface BookCatalogSearchResult {
  items: BookPublicWork[]
  total: number
  limit: number
  offset: number
}

export interface BookPrivateAsset {
  id: string
  import_id: string
  title: string
  author?: string
  file_name: string
  format: 'epub' | 'pdf' | 'txt' | string
  content_type: string
  size: number
  status: BookImportStatus | string
  scan_status: string
  processing_status: BookAssetProcessingStatus | string
  error_message?: string
}

export interface BookReadingState {
  asset_id: string
  epub_cfi?: string
  pdf_page: number
  txt_offset: number
  reading_percent: number
  last_read_at?: string
  private_notes?: string
  preferences: Record<string, unknown>
}

export interface SaveBookReadingStateInput {
  epub_cfi?: string
  pdf_page?: number
  txt_offset?: number
  reading_percent?: number
  private_notes?: string
  preferences?: Record<string, unknown>
}

export interface CreateBookImportInput {
  title?: string
  author?: string
  file_name: string
  content_type: string
  size: number
}

export interface BookUploadPartURL {
  part_number: number
  upload_url: string
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

export const getPublishedBookAsset = (assetId: string) =>
  apiGet<BookPublishedAsset>(catalogUrl(`/assets/${encodeURIComponent(assetId)}`))

export const fetchPublishedBookAssetContent = async (assetId: string): Promise<Blob> => {
  const response = await apiRequest(catalogUrl(`/assets/${encodeURIComponent(assetId)}/content`), { headers: { Accept: '*/*' } })
  if (!response.ok) throw new Error(`无法读取公共电子书内容 (${response.status})`)
  return response.blob()
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

export async function fetchBookAssetContent(assetId: string): Promise<Blob> {
  const response = await apiRequest(assetsUrl(`/${encodeURIComponent(assetId)}/content`), {
    headers: { Accept: '*/*' },
  })
  if (!response.ok) throw new Error(`无法读取电子书内容 (${response.status})`)
  return response.blob()
}

export async function uploadBookImportPart(uploadUrl: string, body: Blob): Promise<string> {
  const response = await apiRequest(uploadUrl, { method: 'PUT', body })
  if (!response.ok) throw new Error(`上传分片失败 (${response.status})`)
  const etag = response.headers.get('ETag') || response.headers.get('etag')
  if (!etag) throw new Error('上传分片未返回 ETag')
  return etag
}

export function bookContentType(file: Pick<File, 'name' | 'type'>): string {
  if (file.type) return file.type
  switch (file.name.toLowerCase().split('.').pop()) {
    case 'epub': return 'application/epub+zip'
    case 'pdf': return 'application/pdf'
    default: return 'application/octet-stream'
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
  const completed = new Map(session.completed_parts.map((part) => [part.part_number, part]))
  const totalParts = Math.ceil(file.size / session.part_size)
  let loaded = [...completed.values()].reduce((sum, part) => sum + part.size, 0)
  options.onProgress?.({ loaded, total: file.size })

  for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
    if (completed.has(partNumber)) continue
    const start = (partNumber - 1) * session.part_size
    const body = file.slice(start, Math.min(start + session.part_size, file.size))
    const upload = await createBookUploadPart(session.id, partNumber)
    const etag = await uploadBookImportPart(upload.upload_url, body)
    await completeBookUploadPart(session.id, partNumber, { etag, size: body.size })
    loaded += body.size
    options.onProgress?.({ loaded, total: file.size })
  }
  return completeBookImport(session.id)
}
