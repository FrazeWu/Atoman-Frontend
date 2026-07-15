import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMediaCollections } from '@/composables/useMediaCollections'

const { apiGetRawMock } = vi.hoisted(() => ({
  apiGetRawMock: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  apiGetRaw: apiGetRawMock,
}))

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

  it('clears stale collection list when channel changes', () => {
    const {
      collections,
      selectCollection,
      resetForChannel,
      loadCollections,
    } = useMediaCollections()

    collections.value = [{ id: 'collection-1', type: 'article', name: '旧合集' }]
    selectCollection('collection-1')

    resetForChannel('channel-2')

    expect(collections.value).toEqual([])
  })

  it('uses the real parent channel type when loading collections', async () => {
    apiGetRawMock.mockResolvedValueOnce([
      { id: 'collection-1', name: '播客合集', channel_id: 'channel-1' },
    ])
    const { collections, loadCollections } = useMediaCollections()

    await loadCollections('channel-1', 'podcast')

    expect(collections.value).toEqual([
      { id: 'collection-1', name: '播客合集', type: 'podcast' },
    ])
  })

  it('does not trust a nonexistent backend collection type field', async () => {
    apiGetRawMock.mockResolvedValueOnce([
      { id: 'collection-1', name: '文章合集', type: 'video' },
    ])
    const { collections, loadCollections } = useMediaCollections()

    await loadCollections('channel-1')

    expect(collections.value).toEqual([
      { id: 'collection-1', name: '文章合集', type: 'article' },
    ])
  })
})
