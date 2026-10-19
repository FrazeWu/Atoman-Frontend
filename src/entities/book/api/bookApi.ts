import {
  getCatalogWork,
  listCatalogResources,
  searchCatalogWorks,
} from '@/api/bookCatalog'
import {
  listBookShelf,
  saveBookShelf,
  listContinueReading,
  listBookNotes,
  listAssetAnnotations,
  getPublicBookReviews,
  getBookRating,
} from '@/api/books'
import {
  getCloudReadingState,
  listReadingMarks,
} from '@/api/bookReading'
import type {
  CatalogWork,
  CatalogResource,
  CatalogPage,
  BookShelfItem,
  BookShelfListResult,
  BookContinueReading,
  ListBookNotesQuery,
  BookAnnotation,
  BookAnnotationListResult,
  CloudReadingState,
  ReadingMark,
  BookReviewListResult,
  BookRatingSummary,
} from '@/entities/book/model/types'

export async function fetchCatalogWork(workId: string): Promise<CatalogWork> {
  return getCatalogWork(workId)
}

export async function fetchCatalogResources(workId: string): Promise<{ items: CatalogResource[] }> {
  return listCatalogResources(workId)
}

export async function searchCatalog(query = '', limit = 24, offset = 0): Promise<CatalogPage> {
  return searchCatalogWorks(query, limit, offset)
}

export async function fetchBookShelf(status = '', limit = 20, offset = 0): Promise<BookShelfListResult> {
  return listBookShelf(status, limit, offset)
}

export async function fetchContinueReading(limit = 20): Promise<BookContinueReading[]> {
  return listContinueReading(limit)
}

export async function updateBookShelfStatus(
  workId: string,
  status: BookShelfItem['status'],
  note = '',
): Promise<void> {
  await saveBookShelf(workId, status, note)
}

export async function fetchBookNotes(query?: ListBookNotesQuery): Promise<BookAnnotationListResult> {
  return listBookNotes(query)
}

export async function fetchAssetAnnotations(assetId: string): Promise<BookAnnotation[]> {
  return listAssetAnnotations(assetId)
}

export async function fetchCloudReadingState(revisionId: string): Promise<CloudReadingState> {
  return getCloudReadingState(revisionId)
}

export async function fetchReadingMarks(
  revisionId: string,
): Promise<{ items: ReadingMark[]; deleted: { id: string; version: number }[] }> {
  return listReadingMarks(revisionId)
}

export async function fetchBookReviews(
  workId: string,
  limit = 20,
  offset = 0,
): Promise<BookReviewListResult> {
  return getPublicBookReviews(workId, limit, offset)
}

export async function fetchBookRating(workId: string): Promise<BookRatingSummary> {
  return getBookRating(workId)
}
