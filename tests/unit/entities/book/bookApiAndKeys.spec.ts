import { describe, it, expect } from 'vitest'
import { bookKeys } from '@/entities/book/queries/bookKeys'
import * as bookApi from '@/entities/book/api/bookApi'

describe('bookKeys factory and bookApi', () => {
  it('generates consistent hierarchical query keys', () => {
    expect(bookKeys.all).toEqual(['books'])
    expect(bookKeys.catalog()).toEqual(['books', 'catalog'])
    expect(bookKeys.catalogWorks()).toEqual(['books', 'catalog', 'works'])
    expect(bookKeys.catalogWork('w-123')).toEqual(['books', 'catalog', 'works', 'w-123'])
    expect(bookKeys.catalogResources('w-123')).toEqual(['books', 'catalog', 'resources', 'w-123'])
    expect(bookKeys.shelf()).toEqual(['books', 'shelf'])
    expect(bookKeys.shelfList('reading')).toEqual(['books', 'shelf', 'list', 'reading'])
    expect(bookKeys.continueReading()).toEqual(['books', 'continue-reading'])
    expect(bookKeys.readingState('rev-1')).toEqual(['books', 'reading-state', 'rev-1'])
    expect(bookKeys.readingMarks('rev-1')).toEqual(['books', 'reading-marks', 'rev-1'])
    expect(bookKeys.notesList({ limit: 10 })).toEqual(['books', 'notes', 'list', { limit: 10 }])
  })

  it('exports expected bookApi functions', () => {
    expect(typeof bookApi.fetchCatalogWork).toBe('function')
    expect(typeof bookApi.fetchCatalogResources).toBe('function')
    expect(typeof bookApi.fetchCloudReadingState).toBe('function')
    expect(typeof bookApi.fetchReadingMarks).toBe('function')
  })
})
