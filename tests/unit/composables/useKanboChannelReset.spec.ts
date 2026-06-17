import { afterEach, describe, expect, it, vi } from 'vitest'
import { useKanboChannel } from '@/composables/useKanboChannel'
import { useKanboCollections } from '@/composables/useKanboCollections'

describe('kanbo channel reset behavior', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('clears selected collection after switching current kanbo channel', () => {
    const { setCurrentKanboChannel } = useKanboChannel()
    const { selectCollection, selectedCollectionId } = useKanboCollections()

    selectCollection('collection-1', 'article', '长文合集')
    expect(selectedCollectionId.value).toBe('collection-1')

    setCurrentKanboChannel('channel-2')
    expect(selectedCollectionId.value).toBeNull()
  })

  it('loads channels with current user id and bearer token when provided', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'channel-1', name: '我的频道' }] }),
    } as Response)

    const { loadChannels } = useKanboChannel()
    await loadChannels('token-1', 'user-uuid-1')

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/blog/channels?user_id=user-uuid-1'),
      { headers: { Authorization: 'Bearer token-1' } },
    )
  })

  it('does not load global channels without a current user id', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'channel-1', name: '全站频道' }] }),
    } as Response)

    const { loadChannels } = useKanboChannel()
    await loadChannels('token-1', null)

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
