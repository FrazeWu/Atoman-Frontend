import { afterEach, describe, expect, it, vi } from 'vitest'

import { onRequestGet } from '../../../functions/media/image'

describe('media image proxy', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('requests a constrained image transform from the trusted asset host', async () => {
    const upstream = new Response('optimized-cover', {
      headers: { 'content-type': 'image/webp' },
    })
    const fetchMock = vi.fn().mockResolvedValue(upstream)
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequestGet({
      request: new Request('https://www.atoman.org/media/image?url=https%3A%2F%2Fassets.atoman.org%2Fmusic%2Fcovers%2Fcover.jpg&width=320'),
    })

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://assets.atoman.org/music/covers/cover.jpg'),
      expect.objectContaining({
        headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg' },
        cf: { image: { width: 320, quality: 75, format: 'auto' } },
      }),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('max-age=31536000')
    expect(await response.text()).toBe('optimized-cover')
  })

  it.each([
    'https://example.com/cover.jpg',
    'http://assets.atoman.org/cover.jpg',
    'https://assets.atoman.org.evil.test/cover.jpg',
  ])('rejects an untrusted URL: %s', async (url) => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequestGet({
      request: new Request(`https://www.atoman.org/media/image?url=${encodeURIComponent(url)}&width=320`),
    })

    expect(response.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
