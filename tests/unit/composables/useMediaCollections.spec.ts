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

  it('keeps backend media collection type when loading collections', async () => {
    apiGetRawMock.mockResolvedValueOnce([
      { id: 'collection-1', name: '播客合集', type: 'podcast' },
      { id: 'collection-2', name: '视频合集', type: 'video' },
    ])
    const { collections, loadCollections } = useMediaCollections()

    await loadCollections('channel-1')

    expect(collections.value).toEqual([
      { id: 'collection-1', name: '播客合集', type: 'podcast' },
      { id: 'collection-2', name: '视频合集', type: 'video' },
    ])
  })

  it('falls back to article when backend collection type is missing or invalid', async () => {
    apiGetRawMock.mockResolvedValueOnce([
      { id: 'collection-1', name: '旧合集' },
      { id: 'collection-2', name: '未知合集', type: 'audio' },
    ])
    const { collections, loadCollections } = useMediaCollections()

    await loadCollections('channel-1')

    expect(collections.value).toEqual([
      { id: 'collection-1', name: '旧合集', type: 'article' },
      { id: 'collection-2', name: '未知合集', type: 'article' },
    ])
  })
})
