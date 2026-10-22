import {
  getCatalogWork,
  listCatalogResources,
  searchCatalogWorks,
} from '@/api/bookCatalog'
import {
  getCloudReadingState,
  listReadingMarks,
} from '@/api/bookReading'
import type {
  CatalogWork,
  CatalogResource,
  CatalogPage,
  CloudReadingState,
  ReadingMark,
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

export async function fetchCloudReadingState(revisionId: string): Promise<CloudReadingState> {
  return getCloudReadingState(revisionId)
}

export async function fetchReadingMarks(
  revisionId: string,
): Promise<{ items: ReadingMark[]; deleted: { id: string; version: number }[] }> {
  return listReadingMarks(revisionId)
}
