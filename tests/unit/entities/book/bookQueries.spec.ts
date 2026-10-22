import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { createTestQueryClient } from '../../helpers/queryClient'
import * as bookApi from '@/entities/book/api/bookApi'
import {
  useCatalogWorkQuery,
  useCatalogResourcesQuery,
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

})
