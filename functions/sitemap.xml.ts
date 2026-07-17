import { buildSitemapXml, resolveApiBase, type SitemapItem } from './_lib/blogSeo'

type SitemapContext = {
  request: Request
  env: { VITE_API_URL?: string }
}

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
  const requestUrl = new URL(context.request.url)
  try {
    const apiBase = resolveApiBase(context.env.VITE_API_URL, requestUrl.origin)
    const response = await fetch(`${apiBase}/blog/seo/sitemap`, { headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error('SEO sitemap unavailable')
    const payload = await response.json() as { data?: unknown }
    if (!isSitemapItems(payload.data)) return unavailable()
    return new Response(buildSitemapXml(payload.data, requestUrl.origin), {
      headers: { 'content-type': 'application/xml; charset=UTF-8' },
    })
  } catch {
    return unavailable()
  }
}
