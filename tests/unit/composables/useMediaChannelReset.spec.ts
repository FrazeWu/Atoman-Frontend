import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMediaChannel } from '@/composables/useMediaChannel'
import { useMediaCollections } from '@/composables/useMediaCollections'

function deferredResponse(body: unknown) {
  let resolve!: (value: Response) => void
  const promise = new Promise<Response>(innerResolve => {
    resolve = innerResolve
  })

  return {
    promise,
    resolve: () => resolve(new Response(JSON.stringify(body), { status: 200 })),
  }
}

describe('media channel reset behavior', () => {
  beforeEach(() => {
    useMediaChannel().clearChannels()
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    useMediaChannel().clearChannels()
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

  it('does not mutate the global auth token while loading channels', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ data: [{ id: 'channel-1', name: '我的频道' }] }), { status: 200 }),
    )
    localStorage.setItem('token', 'real-login-token')

    const { loadChannels } = useMediaChannel()
    await loadChannels('request-token', 'user-uuid-1')

    expect(localStorage.getItem('token')).toBe('real-login-token')

    await loadChannels(null, 'user-uuid-1')

    expect(localStorage.getItem('token')).toBe('real-login-token')
  })

  it('ignores older channel requests that resolve after a newer user request', async () => {
    const oldRequest = deferredResponse({ data: [{ id: 'old-channel', name: '旧账号频道' }] })
    const newRequest = deferredResponse({ data: [{ id: 'new-channel', name: '新账号频道' }] })
    vi.spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise)

    const { channels, currentMediaChannelId, loadChannels } = useMediaChannel()
    const oldLoad = loadChannels('old-token', 'old-user')
    const newLoad = loadChannels('new-token', 'new-user')

    newRequest.resolve()
    await newLoad
    expect(channels.value).toEqual([{ id: 'new-channel', name: '新账号频道' }])
    expect(currentMediaChannelId.value).toBe('new-channel')

    oldRequest.resolve()
    await oldLoad
    expect(channels.value).toEqual([{ id: 'new-channel', name: '新账号频道' }])
    expect(currentMediaChannelId.value).toBe('new-channel')
  })

  it('clears stale channels when loading channels for another user fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ id: 'old-channel', name: '旧账号频道' }] }), { status: 200 }),
      )
      .mockRejectedValueOnce(new Error('network failed'))

    const { channels, currentMediaChannelId, loadChannels } = useMediaChannel()
    await loadChannels('old-token', 'old-user')

    expect(channels.value).toEqual([{ id: 'old-channel', name: '旧账号频道' }])
    expect(currentMediaChannelId.value).toBe('old-channel')

    await expect(loadChannels('new-token', 'new-user')).rejects.toThrow('network failed')
    expect(channels.value).toEqual([])
    expect(currentMediaChannelId.value).toBeNull()
  })
})
