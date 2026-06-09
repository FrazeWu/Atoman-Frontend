import { beforeEach, describe, expect, it } from 'vitest'
import { useKanboCollections } from '@/composables/useKanboCollections'

describe('useKanboCollections', () => {
  beforeEach(() => {
    const { clearSelectionForTest } = useKanboCollections()
    clearSelectionForTest()
  })

  it('tracks selected collection id', () => {
    const { selectedCollectionId, selectCollection } = useKanboCollections()
    expect(selectedCollectionId.value).toBeNull()
    selectCollection('collection-1')
    expect(selectedCollectionId.value).toBe('collection-1')
  })

  it('clears selected collection when channel changes', () => {
    const { selectedCollectionId, selectCollection, resetForChannel } = useKanboCollections()
    selectCollection('collection-1')
    resetForChannel('channel-2')
    expect(selectedCollectionId.value).toBeNull()
  })
})
