import { beforeEach, describe, expect, it } from 'vitest'
import { useMediaCollections } from '@/composables/useMediaCollections'

describe('useMediaCollections', () => {
  beforeEach(() => {
    const { clearSelectionForTest } = useMediaCollections()
    clearSelectionForTest()
  })

  it('tracks selected collection id', () => {
    const { selectedCollectionId, selectCollection } = useMediaCollections()
    expect(selectedCollectionId.value).toBeNull()
    selectCollection('collection-1')
    expect(selectedCollectionId.value).toBe('collection-1')
  })

  it('clears selected collection when channel changes', () => {
    const { selectedCollectionId, selectCollection, resetForChannel } = useMediaCollections()
    selectCollection('collection-1')
    resetForChannel('channel-2')
    expect(selectedCollectionId.value).toBeNull()
  })
})
