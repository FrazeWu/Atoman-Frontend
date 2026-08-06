import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequestGet } from '../../../functions/media/cover'

describe('music cover proxy', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('streams images from the configured asset host', async () => {
    const upstream = new Response('cover', {
      headers: {
        'content-type': 'image/jpeg',
        etag: 'cover-etag',
      },
    })
    const fetchMock = vi.fn().mockResolvedValue(upstream)
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequestGet({
      request: new Request('https://www.atoman.org/media/cover?url=https%3A%2F%2Fassets.atoman.org%2Fmusic%2Fcovers%2Fcover.jpg'),
    })

    expect(fetchMock).toHaveBeenCalledWith(new URL('https://assets.atoman.org/music/covers/cover.jpg'), {
      headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg' },
      redirect: 'manual',
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/jpeg')
    expect(response.headers.get('etag')).toBe('cover-etag')
    expect(await response.text()).toBe('cover')
  })

  it.each([
    'https://example.com/cover.jpg',
    'http://assets.atoman.org/cover.jpg',
    'https://assets.atoman.org.evil.test/cover.jpg',
  ])('rejects an untrusted URL: %s', async (url) => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequestGet({
      request: new Request(`https://www.atoman.org/media/cover?url=${encodeURIComponent(url)}`),
    })

    expect(response.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects a non-image upstream response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not an image', {
      headers: { 'content-type': 'text/html' },
    })))

    const response = await onRequestGet({
      request: new Request('https://www.atoman.org/media/cover?url=https%3A%2F%2Fassets.atoman.org%2Fcover.jpg'),
    })

    expect(response.status).toBe(502)
  })
})
