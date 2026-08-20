import { describe, expect, it, vi } from 'vitest'

import { onRequest as articleHandler } from '../../../functions/posts/post/[id]'
import { onRequest as sitemapHandler } from '../../../functions/sitemap.xml'
import { onRequest as robotsHandler } from '../../../functions/robots.txt'

const shell = '<!doctype html><html><head><title>Atoman</title></head><body><div id="app"></div></body></html>'

describe('blog SEO Pages Functions', () => {
  it('injects metadata into the article SPA response', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({
      data: {
        id: 'post-1', title: '文章标题', description: '文章摘要', image_url: '', author_name: 'Alice',
        published_at: '2026-07-10T08:00:00Z', updated_at: '2026-07-14T09:30:00Z', path: '/posts/post/post-1',
      },
    })))
    vi.stubGlobal('fetch', fetch)

    const response = await articleHandler({
      request: new Request('https://atoman.org/posts/post/post-1'),
      env: { VITE_API_URL: 'https://api.atoman.org/api' },
      params: { id: 'post-1' },
      next: async () => new Response(shell, { headers: { 'content-type': 'text/html' } }),
    })

    expect(fetch).toHaveBeenCalledWith('https://api.atoman.org/api/v1/blog/seo/posts/post-1', expect.any(Object))
    expect(await response.text()).toContain('<title data-page-meta="article">文章标题 | Atoman</title>')
  })

  it('returns the untouched SPA shell when the SEO API fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('unavailable', { status: 503 })))

    const response = await articleHandler({
      request: new Request('https://atoman.org/posts/post/post-1'), env: {}, params: { id: 'post-1' },
      next: async () => new Response(shell, { headers: { 'content-type': 'text/html' } }),
    })

    expect(await response.text()).toBe(shell)
  })

  it.each([403, 404])('returns a noindex 404 when the SEO API returns %i', async (status) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status })))

    const response = await articleHandler({
      request: new Request('https://atoman.org/posts/post/post-1'), env: {}, params: { id: 'post-1' },
      next: async () => new Response(shell, { headers: { 'content-type': 'text/html' } }),
    })

    expect(response.status).toBe(404)
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
    expect(response.headers.get('cache-control')).toBe('no-store')
    const html = await response.text()
    expect(html).toContain('<meta name="robots" content="noindex, nofollow">')
    expect(html).not.toContain('rel="canonical"')
  })

  it('returns a noindex 404 for a malformed successful SEO response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      data: { id: 'post-1', title: 123, description: null },
    }))))

    const response = await articleHandler({
      request: new Request('https://atoman.org/posts/post/post-1'), env: {}, params: { id: 'post-1' },
      next: async () => new Response(shell, { headers: { 'content-type': 'text/html' } }),
    })

    expect(response.status).toBe(404)
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
  })

  it('serves sitemap XML from backend data', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      data: [{ path: '/posts/post/post-1', last_modified: '2026-07-14T09:30:00Z' }],
    }))))

    const response = await sitemapHandler({ request: new Request('https://atoman.org/sitemap.xml'), env: {} })

    expect(response.headers.get('content-type')).toContain('application/xml')
    expect(response.headers.get('cache-control')).toContain('s-maxage=3600')
    const xml = await response.text()
    expect(xml).toContain('<loc>https://www.atoman.org/</loc>')
    expect(xml).toContain('<loc>https://www.atoman.org/feed</loc>')
    expect(xml).toContain('<loc>https://www.atoman.org/posts/post/post-1</loc>')
  })

  it('serves static public pages when the backend data set is empty', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [] }))))

    const response = await sitemapHandler({ request: new Request('https://atoman.org/sitemap.xml'), env: {} })

    expect(response.status).toBe(200)
    const xml = await response.text()
    expect(xml).toContain('<urlset')
    expect(xml).toContain('<loc>https://www.atoman.org/posts</loc>')
  })

  it.each([
    ['network failure', () => Promise.reject(new Error('offline'))],
    ['backend 5xx', () => Promise.resolve(new Response('unavailable', { status: 503 }))],
    ['invalid JSON', () => Promise.resolve(new Response('{invalid'))],
    ['malformed envelope', () => Promise.resolve(new Response(JSON.stringify({ data: [{ path: 42 }] })))],
  ])('returns 503 when sitemap data has a %s', async (_case, fetchResult) => {
    vi.stubGlobal('fetch', vi.fn(fetchResult))

    const response = await sitemapHandler({ request: new Request('https://atoman.org/sitemap.xml'), env: {} })

    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBeTruthy()
  })

  it('serves robots.txt for the current origin', async () => {
    const response = await robotsHandler({ request: new Request('https://atoman.org/robots.txt') })

    expect(response.headers.get('content-type')).toContain('text/plain')
    expect(await response.text()).toContain('Sitemap: https://atoman.org/sitemap.xml')
  })
})
