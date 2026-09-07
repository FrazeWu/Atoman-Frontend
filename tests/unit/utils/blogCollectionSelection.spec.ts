import { describe, expect, it } from 'vitest'

import { normalizeBlogCollectionSelection } from '@/utils/blogCollectionSelection'

const collections = [
  { id: 'default-1', is_default: true },
  { id: 'collection-1', is_default: false },
  { id: 'collection-2', is_default: false },
]

describe('normalizeBlogCollectionSelection', () => {
  it('selects the default collection when no collection is requested', () => {
    expect(normalizeBlogCollectionSelection(collections, null)).toEqual(['default-1'])
  })

  it('selects only the requested ordinary collection', () => {
    expect(normalizeBlogCollectionSelection(collections, 'collection-2')).toEqual(['collection-2'])
  })

  it('allows selecting the default collection explicitly', () => {
    expect(normalizeBlogCollectionSelection(collections, 'default-1')).toEqual(['default-1'])
  })
})
