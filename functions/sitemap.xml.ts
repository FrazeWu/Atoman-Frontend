import { buildSitemapXml, resolveApiBase, type SitemapItem } from './_lib/blogSeo'
import { collectPublicSitemapItems } from './_lib/publicContentSeo'

type SitemapContext = {
  request: Request
  env: { VITE_API_URL?: string }
}

const canonicalOrigin = 'https://www.atoman.org'
const staticPages: SitemapItem[] = [
  { path: '/' },
  { path: '/feed' },
  { path: '/posts' },
  { path: '/music' },
  { path: '/forum' },
  { path: '/debate' },
  { path: '/timeline' },
  { path: '/podcasts' },
  { path: '/videos' },
]

function isSitemapItems(value: unknown): value is SitemapItem[] {
  return Array.isArray(value) && value.every(item => Boolean(item)
    && typeof item === 'object'
    && typeof (item as SitemapItem).path === 'string'
    && typeof (item as SitemapItem).last_modified === 'string')
}

function unavailable() {
  return new Response('Sitemap temporarily unavailable\n', {
    status: 503,
    headers: {
      'content-type': 'text/plain; charset=UTF-8',
      'retry-after': '300',
    },
  })
}

export async function onRequest(context: SitemapContext) {
  try {
    const requestUrl = new URL(context.request.url)
    const apiBase = resolveApiBase(context.env.VITE_API_URL, requestUrl.origin)
    const response = await fetch(`${apiBase}/blog/seo/sitemap`, { headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error('SEO sitemap unavailable')
    const payload = await response.json() as { data?: unknown }
    if (!isSitemapItems(payload.data)) return unavailable()
    const itemsByPath = new Map(staticPages.map(item => [item.path, item]))
    payload.data.forEach(item => itemsByPath.set(item.path, item))
    const publicItems = await collectPublicSitemapItems(apiBase)
    publicItems.forEach(item => {
      const existing = itemsByPath.get(item.path)
      if (!existing?.last_modified || item.last_modified) itemsByPath.set(item.path, item)
    })
    return new Response(buildSitemapXml([...itemsByPath.values()], canonicalOrigin), {
      headers: {
        'cache-control': 'public, max-age=300, s-maxage=3600',
        'content-type': 'application/xml; charset=UTF-8',
      },
    })
  } catch {
    return unavailable()
  }
}
