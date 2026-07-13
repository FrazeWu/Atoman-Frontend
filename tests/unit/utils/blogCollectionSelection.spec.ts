import { describe, expect, it } from 'vitest'

import { normalizeBlogCollectionSelection } from '@/utils/blogCollectionSelection'

const collections = [
  { id: 'default-1', is_default: true },
  { id: 'collection-1', is_default: false },
  { id: 'collection-2', is_default: false },
]

describe('normalizeBlogCollectionSelection', () => {
  it('keeps only the default collection when no ordinary collection is selected', () => {
    expect(normalizeBlogCollectionSelection(collections, null)).toEqual(['default-1'])
  })

  it('keeps the default collection and one selected ordinary collection', () => {
    expect(normalizeBlogCollectionSelection(collections, 'collection-2')).toEqual(['default-1', 'collection-2'])
  })

  it('treats the default collection as no ordinary selection', () => {
    expect(normalizeBlogCollectionSelection(collections, 'default-1')).toEqual(['default-1'])
  })
})
