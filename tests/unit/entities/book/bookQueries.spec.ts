import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { createTestQueryClient } from '../../helpers/queryClient'
import * as bookApi from '@/entities/book/api/bookApi'
import {
  useCatalogWorkQuery,
  useCatalogResourcesQuery,
  useBookShelfQuery,
  useContinueReadingQuery,
  useBookNotesQuery,
} from '@/entities/book'

describe('Book Vue Query hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('useCatalogWorkQuery fetches work when id is present', async () => {
    const queryClient = createTestQueryClient()
    const mockWork = {
      id: 'w-1',
      title: '百年孤独',
      lifecycle_status: 'published',
      rating_score: 9.3,
      rating_count: 100,
      authors: [],
      editions: [],
    } as any
    vi.spyOn(bookApi, 'fetchCatalogWork').mockResolvedValue(mockWork)

    const workId = ref('w-1')
    const query = useCatalogWorkQuery(workId, { queryClient })

    await query.refetch()
    expect(bookApi.fetchCatalogWork).toHaveBeenCalledWith('w-1')
    expect(query.data.value).toEqual(mockWork)
  })

  it('useCatalogResourcesQuery fetches resources when workId is present', async () => {
    const queryClient = createTestQueryClient()
    const mockResources = {
      items: [
        { id: 'res-1', work_id: 'w-1', title: '百年孤独.epub', format: 'epub', language: 'zh', status: 'active' },
      ],
    } as any
    vi.spyOn(bookApi, 'fetchCatalogResources').mockResolvedValue(mockResources)

    const query = useCatalogResourcesQuery('w-1', { queryClient })
    await query.refetch()
    expect(bookApi.fetchCatalogResources).toHaveBeenCalledWith('w-1')
    expect(query.data.value).toEqual(mockResources)
  })

  it('useBookShelfQuery fetches user shelf items', async () => {
    const queryClient = createTestQueryClient()
    const mockShelf = {
      items: [{ id: 'shelf-1', work_id: 'w-1', status: 'reading', updated_at: '', work: {} as any }],
      total: 1,
      limit: 20,
      offset: 0,
    }
    vi.spyOn(bookApi, 'fetchBookShelf').mockResolvedValue(mockShelf)

    const query = useBookShelfQuery('reading', undefined, { queryClient })
    await query.refetch()
    expect(bookApi.fetchBookShelf).toHaveBeenCalledWith('reading', 100, 0)
    expect(query.data.value).toEqual(mockShelf)
  })

  it('useContinueReadingQuery fetches continue reading list', async () => {
    const queryClient = createTestQueryClient()
    const mockContinue = [
      { asset_id: 'a-1', title: '百年孤独', file_name: 'test.epub', format: 'epub', processing_status: 'ready', reading_percent: 0.35 },
    ]
    vi.spyOn(bookApi, 'fetchContinueReading').mockResolvedValue(mockContinue)

    const query = useContinueReadingQuery(20, { queryClient })
    await query.refetch()
    expect(bookApi.fetchContinueReading).toHaveBeenCalledWith(20)
    expect(query.data.value).toEqual(mockContinue)
  })
})
