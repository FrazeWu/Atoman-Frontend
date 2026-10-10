import { afterEach, describe, expect, it, vi } from 'vitest'

import { cacheMediaForOffline, getCachedMediaObjectURL, isMediaCached, MEDIA_OFFLINE_CACHE_NAME } from '@/utils/mediaOfflineCache'

const cache = {
  match: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}
const originalCaches = window.caches

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  Object.defineProperty(window, 'caches', { configurable: true, value: originalCaches })
})

describe('media offline cache', () => {
  it('stores a fetched media response in the dedicated cache', async () => {
    Object.defineProperty(window, 'caches', { configurable: true, value: { open: vi.fn().mockResolvedValue(cache) } })
    cache.put.mockResolvedValue(undefined)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('audio', { status: 200 })))

    await expect(cacheMediaForOffline('/media/song.mp3')).resolves.toBe(true)
    expect(window.caches.open).toHaveBeenCalledWith(MEDIA_OFFLINE_CACHE_NAME)
    expect(cache.put).toHaveBeenCalledWith('/media/song.mp3', expect.any(Response))
  })

  it('reads cached status and creates a playable object URL', async () => {
    Object.defineProperty(window, 'caches', { configurable: true, value: { open: vi.fn().mockResolvedValue(cache) } })
    cache.match.mockResolvedValue(new Response('video', { status: 200 }))
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:cached')

    await expect(isMediaCached('/media/video.mp4')).resolves.toBe(true)
    await expect(getCachedMediaObjectURL('/media/video.mp4')).resolves.toBe('blob:cached')
    expect(createObjectURL).toHaveBeenCalled()
  })

  it('removes a cached media response', async () => {
    Object.defineProperty(window, 'caches', { configurable: true, value: { open: vi.fn().mockResolvedValue(cache) } })
    cache.delete.mockResolvedValue(true)

    const { removeCachedMedia } = await import('@/utils/mediaOfflineCache')
    await removeCachedMedia('/media/video.mp4')

    expect(cache.delete).toHaveBeenCalledWith('/media/video.mp4')
  })
})
