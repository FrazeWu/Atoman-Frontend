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
  format: 'epub' | 'pdf' | 'txt' | 'cbz' | 'cbr' | 'mobi' | 'azw3' | string
  content_type: string
  size: number
  status: BookImportStatus | string
  part_size: number
  completed_parts: BookUploadPart[]
  expires_at: string
  work_id?: string
  edition_id?: string
  asset_id?: string
  published_asset_id?: string
  processing_status?: BookAssetProcessingStatus | string
  error_code?: string
  error_message?: string
}

export interface BookPublicPerson {
  id: string
  name: string
  role: string
}

export interface BookPublicPublisher {
  id: string
  name: string
}

export interface BookPublicProducer {
  id: string
  name: string
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
  publisher_id?: string
  publisher?: string
  publisher_info?: BookPublicPublisher
  producer_id?: string
  producer?: string
  producer_info?: BookPublicProducer
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

export interface CreatePublicBookInput {
  import_id: string
  title: string
  public_distribution_confirmed: boolean
  subtitle?: string
  original_title?: string
  description?: string
  language?: string
  authors?: string[]
  edition: {
    title?: string
    publisher?: string
    producer?: string
    isbn10?: string
    isbn13?: string
    language?: string
    published_date?: string
    page_count?: number
    binding?: string
    cover_url?: string
  }
  source_url?: string
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
  format: 'epub' | 'pdf' | 'txt' | 'cbz' | 'cbr' | 'mobi' | 'azw3' | string
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
  payload?: Record<string, unknown>
}

export interface BookEditListResult {
  items: BookEdit[]
  total: number
  limit: number
  offset: number
}

export interface SubmitBookEditInput {
  type: 'create' | 'update' | 'merge' | 'retire' | 'reopen'
  entity_type: 'work' | 'edition' | 'person' | 'publisher'
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
  format: 'epub' | 'pdf' | 'txt' | 'cbz' | 'cbr' | 'mobi' | 'azw3' | string
  file_name: string
  title?: string
  author?: string
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
  format: 'epub' | 'pdf' | 'txt' | 'cbz' | 'cbr' | 'mobi' | 'azw3' | string
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

export const BOOK_HIGHLIGHT_COLORS = ['yellow', 'green', 'blue', 'pink'] as const
export type BookHighlightColor = (typeof BOOK_HIGHLIGHT_COLORS)[number]

export const BOOK_HIGHLIGHT_STYLES = ['highlight', 'underline'] as const
export type BookHighlightStyle = (typeof BOOK_HIGHLIGHT_STYLES)[number]

export interface BookAnnotation {
  id: string
  asset_id: string
  work_id?: string
  format: 'epub' | 'pdf' | 'txt' | string
  epub_cfi?: string
  pdf_page?: number
  pdf_rects?: string
  txt_offset_start?: number
  txt_offset_end?: number
  text: string
  color: BookHighlightColor
  style: BookHighlightStyle
  note?: string
  chapter_title?: string
  book_title?: string
  book_author?: string
  created_at: string
  updated_at: string
}

export interface BookAnnotationListResult {
  items: BookAnnotation[]
  total: number
}

export interface CreateBookAnnotationInput {
  format: 'epub' | 'pdf' | 'txt' | string
  epub_cfi?: string
  pdf_page?: number
  pdf_rects?: string
  txt_offset_start?: number
  txt_offset_end?: number
  text: string
  color?: BookHighlightColor
  style?: BookHighlightStyle
  note?: string
  chapter_title?: string
}

export interface UpdateBookAnnotationInput {
  color?: BookHighlightColor
  style?: BookHighlightStyle
  note?: string
}

export interface ListBookNotesQuery {
  q?: string
  asset_id?: string
  has_note?: boolean
  color?: BookHighlightColor
  limit?: number
  offset?: number
}

export interface BookFileUploadProgress {
  loaded: number
  total: number
  percent: number
  status: string
}

// Catalog types
export interface CatalogWork extends BookPublicWork {
  revision_id: string
  redirected_from?: string
}

export interface CreateCatalogWork {
  title: string
  authors: string[]
  author_ids?: string[]
  subtitle?: string
  original_title?: string
  description?: string
  language?: string
}

export interface CreateCatalogEdition {
  title?: string
  publisher?: string
  producer?: string
  isbn10?: string
  isbn13?: string
  language?: string
  published_date?: string
  page_count?: number
  binding?: string
  cover_url?: string
}

export interface CatalogResource {
  id: string
  work_id: string
  title: string
  language: string
  format: 'epub' | 'pdf' | 'txt' | 'cbz' | 'cbr'
  status: 'active' | 'removed'
  current_revision_id?: string
}

export interface CatalogPage {
  items: BookPublicWork[]
  total: number
  limit: number
  offset: number
}

// Reading session & position types
export interface ReadingPosition {
  current_percent: number
  epub_cfi: string
  pdf_page: number
  txt_offset: number
}

export interface CloudReadingState extends ReadingPosition {
  revision_id: string
  version: number
  furthest_percent: number
}

export interface ReadingSession {
  session: { id: string; last_sequence: number; heartbeat_sequence: number }
  state: CloudReadingState
}

export interface ReadingWrite extends ReadingPosition {
  session_id: string
  request_id: string
  sequence: number
  base_version: number
  furthest_percent: number
}

export interface ReadingAnchor {
  epub_start_cfi?: string
  epub_end_cfi?: string
  pdf_page?: number
  pdf_rects?: { x: number; y: number; width: number; height: number }[]
  txt_offset_start?: number
  txt_offset_end?: number
}

export interface ReadingMarkInput {
  base_version: number
  kind: 'bookmark' | 'highlight'
  anchor: ReadingAnchor
  label: string
  quote: string
  note: string
  color: string
  style: string
}

export interface ReadingMark extends Omit<ReadingMarkInput, 'base_version'> {
  id: string
  revision_id: string
  version: number
  created_at: string
}

// Reader client state types
export interface ActiveReadingBook {
  assetId: string
  workId?: string
  title: string
  author?: string
  coverUrl?: string
  format: string
  currentPage: number
  totalPages: number
  percent: number
  chapterTitle?: string
}

export type BookSidebarMode = 'thumbnails' | 'outline' | 'bookmarks' | 'none'
