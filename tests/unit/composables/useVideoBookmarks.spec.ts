import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useVideoBookmarks } from '@/composables/useVideoBookmarks'

const response = (data: unknown, status = 200) => new Response(JSON.stringify({ data, message: 'ok' }), {
  status,
  headers: { 'Content-Type': 'application/json' },
})

describe('useVideoBookmarks', () => {
  beforeEach(() => {
    useVideoBookmarks().reset()
    vi.restoreAllMocks()
  })

  it('indexes loaded bookmarks by video id', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response([
      { id: 'bookmark-1', video_id: 'video-1' },
    ])))
    const bookmarks = useVideoBookmarks()
    await bookmarks.load()
    expect(bookmarks.isBookmarked('video-1')).toBe(true)
    expect(bookmarks.bookmarkId('video-1')).toBe('bookmark-1')
  })

  it('creates and deletes a bookmark through the backend contract', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ id: 'bookmark-2', video_id: 'video-2' }, 201))
      .mockResolvedValueOnce(response(null))
    vi.stubGlobal('fetch', fetchMock)
    const bookmarks = useVideoBookmarks()
    await bookmarks.toggle('video-2')
    expect(bookmarks.isBookmarked('video-2')).toBe(true)
    await bookmarks.toggle('video-2')
    expect(bookmarks.isBookmarked('video-2')).toBe(false)
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' })
    expect(fetchMock.mock.calls[1]?.[0]).toContain('/videos/bookmarks/bookmark-2')
  })

  it('restores previous state when a toggle fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    const bookmarks = useVideoBookmarks()
    await expect(bookmarks.toggle('video-3')).rejects.toThrow('network')
    expect(bookmarks.isBookmarked('video-3')).toBe(false)
    expect(bookmarks.errorMessage.value).toBe('稍后再试')
  })
})
