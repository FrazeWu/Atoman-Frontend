import { describe, it, expect } from 'vitest'
import {
  BOOK_HIGHLIGHT_COLORS,
  BOOK_HIGHLIGHT_STYLES,
  type BookPublicWork,
  type BookPublicEdition,
  type BookShelfItem,
  type BookContinueReading,
  type BookAnnotation,
  type BookReadingState,
  type CatalogWork,
  type CatalogResource,
  type ActiveReadingBook,
} from '@/entities/book/model/types'
import type {
  BookPublicWork as LegacyWork,
  BookShelfItem as LegacyShelf,
  BookAnnotation as LegacyAnnotation,
} from '@/api/books'

describe('Book domain model types', () => {
  it('exports valid constants and type-compatible book domain models', () => {
    expect(BOOK_HIGHLIGHT_COLORS).toContain('yellow')
    expect(BOOK_HIGHLIGHT_STYLES).toContain('highlight')

    const mockWork: BookPublicWork = {
      id: 'work-1',
      title: '百年孤独',
      lifecycle_status: 'published',
      rating_score: 9.3,
      rating_count: 1200,
      authors: [{ id: 'author-1', name: '加西亚·马尔克斯', role: 'author' }],
      editions: [],
    }
    const legacyWork: LegacyWork = mockWork
    expect(legacyWork.title).toBe('百年孤独')

    const mockShelf: BookShelfItem = {
      id: 'shelf-1',
      work_id: 'work-1',
      status: 'reading',
      updated_at: '2026-10-19T00:00:00Z',
      work: mockWork,
    }
    const legacyShelf: LegacyShelf = mockShelf
    expect(legacyShelf.status).toBe('reading')

    const mockAnnotation: BookAnnotation = {
      id: 'anno-1',
      asset_id: 'asset-1',
      format: 'epub',
      text: '多年以后，面对行刑队...',
      color: 'yellow',
      style: 'highlight',
      created_at: '2026-10-19T00:00:00Z',
      updated_at: '2026-10-19T00:00:00Z',
    }
    const legacyAnnotation: LegacyAnnotation = mockAnnotation
    expect(legacyAnnotation.color).toBe('yellow')
  })
})
