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

  it('loads the requested queue state and order', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response([]))
    vi.stubGlobal('fetch', fetchMock)

    await useVideoBookmarks().load('completed', 'popular')

    expect(fetchMock.mock.calls[0]?.[0]).toContain('/videos/bookmarks?state=completed&sort=popular')
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

  it('does not let a late load response erase a completed toggle', async () => {
    let releaseLoad!: (value: Response) => void
    const pendingLoad = new Promise<Response>(resolve => {
      releaseLoad = resolve
    })
    const fetchMock = vi.fn()
      .mockReturnValueOnce(pendingLoad)
      .mockResolvedValueOnce(response({ id: 'bookmark-4', video_id: 'video-4' }, 201))
    vi.stubGlobal('fetch', fetchMock)

    const bookmarks = useVideoBookmarks()
    const loadPromise = bookmarks.load()
    await bookmarks.toggle('video-4')
    releaseLoad(response([]))
    await loadPromise

    expect(bookmarks.isBookmarked('video-4')).toBe(true)
  })

  it('removes each selected bookmark without altering other queue records', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(null))
      .mockResolvedValueOnce(response(null))
    vi.stubGlobal('fetch', fetchMock)
    const bookmarks = useVideoBookmarks()
    bookmarks.records.value = {
      'video-1': { id: 'bookmark-1', video_id: 'video-1' },
      'video-2': { id: 'bookmark-2', video_id: 'video-2' },
      'video-3': { id: 'bookmark-3', video_id: 'video-3' },
    }

    await bookmarks.removeMany(['video-1', 'video-3'])

    expect(bookmarks.isBookmarked('video-1')).toBe(false)
    expect(bookmarks.isBookmarked('video-2')).toBe(true)
    expect(bookmarks.isBookmarked('video-3')).toBe(false)
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringContaining('/videos/bookmarks/bookmark-1'),
      expect.stringContaining('/videos/bookmarks/bookmark-3'),
    ])
  })
})
