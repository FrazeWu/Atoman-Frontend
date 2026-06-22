import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMediaChannel } from '@/composables/useMediaChannel'
import { useMediaCollections } from '@/composables/useMediaCollections'

describe('media channel reset behavior', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('clears selected collection after switching current media channel', () => {
    const { setCurrentMediaChannel } = useMediaChannel()
    const { selectCollection, selectedCollectionId } = useMediaCollections()

    selectCollection('collection-1', 'article', '长文合集')
    expect(selectedCollectionId.value).toBe('collection-1')

    setCurrentMediaChannel('channel-2')
    expect(selectedCollectionId.value).toBeNull()
  })

  it('loads channels with current user id and bearer token when provided', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: 'channel-1', name: '我的频道' }] }), { status: 200 }),
    )

    const { loadChannels } = useMediaChannel()
    await loadChannels('token-1', 'user-uuid-1')

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/blog/channels?user_id=user-uuid-1'),
      {
        credentials: 'include',
        headers: { Accept: 'application/json', Authorization: 'Bearer token-1' },
      },
    )
  })

  it('does not load global channels without a current user id', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: 'channel-1', name: '全站频道' }] }), { status: 200 }),
    )

    const { loadChannels } = useMediaChannel()
    await loadChannels('token-1', null)

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
