import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMediaCollections } from '@/composables/useMediaCollections'

const { apiGetRawMock } = vi.hoisted(() => ({
  apiGetRawMock: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  apiGetRaw: apiGetRawMock,
}))

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const channelCollectionsUrl = (channelId: string) => `/api/v1/blog/channels/${channelId}/collections`

describe('useMediaCollections', () => {
  beforeEach(() => {
    apiGetRawMock.mockReset()
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

    expect(apiGetRawMock).toHaveBeenCalledWith(channelCollectionsUrl('channel-1'))
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

  it('切换频道时立即结束旧合集加载并失效旧响应', async () => {
    const channelA = deferred<unknown>()
    apiGetRawMock.mockReturnValue(channelA.promise)
    const { collections, loadingCollections, loadCollections, resetForChannel } = useMediaCollections()

    resetForChannel('channel-a')
    const loadA = loadCollections('channel-a')
    expect(loadingCollections.value).toBe(true)

    resetForChannel('channel-b')

    expect(collections.value).toEqual([])
    expect(loadingCollections.value).toBe(false)

    channelA.resolve({ data: [{ id: 'collection-a', name: 'A 迟到合集' }] })
    await loadA
    expect(collections.value).toEqual([])
  })

  it('旧频道成功响应不能覆盖新频道合集', async () => {
    const channelA = deferred<unknown>()
    const channelB = deferred<unknown>()
    apiGetRawMock.mockImplementation((url: string) => (
      url === channelCollectionsUrl('channel-a') ? channelA.promise : channelB.promise
    ))
    const { collections, loadingCollections, loadCollections, resetForChannel } = useMediaCollections()

    resetForChannel('channel-a')
    const loadA = loadCollections('channel-a', 'article')
    expect(loadingCollections.value).toBe(true)

    resetForChannel('channel-b')
    expect(collections.value).toEqual([])
    const loadB = loadCollections('channel-b', 'video')

    expect(apiGetRawMock).toHaveBeenNthCalledWith(1, channelCollectionsUrl('channel-a'))
    expect(apiGetRawMock).toHaveBeenNthCalledWith(2, channelCollectionsUrl('channel-b'))

    channelB.resolve({ data: [{ id: 'collection-b', name: 'B 合集' }] })
    await loadB
    expect(collections.value).toEqual([{ id: 'collection-b', name: 'B 合集', type: 'video' }])

    channelA.resolve({ data: [{ id: 'collection-a', name: 'A 迟到合集' }] })
    await loadA

    expect(collections.value).toEqual([{ id: 'collection-b', name: 'B 合集', type: 'video' }])
    expect(loadingCollections.value).toBe(false)
  })

  it('切换频道后消费旧请求失败并保留新频道合集', async () => {
    const channelA = deferred<unknown>()
    apiGetRawMock.mockImplementation((url: string) => {
      if (url === channelCollectionsUrl('channel-a')) return channelA.promise
      return Promise.resolve({ data: [{ id: 'collection-b', name: 'B 合集' }] })
    })
    const { collections, loadCollections, resetForChannel } = useMediaCollections()

    resetForChannel('channel-a')
    const loadA = loadCollections('channel-a')
    resetForChannel('channel-b')
    await loadCollections('channel-b', 'podcast')

    expect(apiGetRawMock).toHaveBeenNthCalledWith(1, channelCollectionsUrl('channel-a'))
    expect(apiGetRawMock).toHaveBeenNthCalledWith(2, channelCollectionsUrl('channel-b'))

    channelA.reject(new Error('late A failure'))

    await expect(loadA).resolves.toBeUndefined()
    expect(collections.value).toEqual([{ id: 'collection-b', name: 'B 合集', type: 'podcast' }])
  })

  it('旧请求结束不能提前清除新频道加载状态', async () => {
    const channelA = deferred<unknown>()
    const channelB = deferred<unknown>()
    apiGetRawMock.mockImplementation((url: string) => (
      url === channelCollectionsUrl('channel-a') ? channelA.promise : channelB.promise
    ))
    const { loadingCollections, loadCollections, resetForChannel } = useMediaCollections()

    resetForChannel('channel-a')
    const loadA = loadCollections('channel-a')
    resetForChannel('channel-b')
    const loadB = loadCollections('channel-b')
    expect(loadingCollections.value).toBe(true)

    expect(apiGetRawMock).toHaveBeenNthCalledWith(1, channelCollectionsUrl('channel-a'))
    expect(apiGetRawMock).toHaveBeenNthCalledWith(2, channelCollectionsUrl('channel-b'))

    channelA.resolve({ data: [] })
    await loadA
    expect(loadingCollections.value).toBe(true)

    channelB.resolve({ data: [] })
    await loadB
    expect(loadingCollections.value).toBe(false)
  })

  it('当前最新合集请求失败时向调用方抛出错误', async () => {
    const requestFailure = new Error('current request failure')
    apiGetRawMock.mockRejectedValueOnce(requestFailure)
    const { loadingCollections, loadCollections } = useMediaCollections()

    await expect(loadCollections('channel-current')).rejects.toBe(requestFailure)

    expect(apiGetRawMock).toHaveBeenCalledWith(channelCollectionsUrl('channel-current'))
    expect(loadingCollections.value).toBe(false)
  })
})
