import { buildSitemapXml, resolveApiBase, type SitemapItem } from './_lib/blogSeo'

type SitemapContext = {
  request: Request
  env: { VITE_API_URL?: string }
}

export async function onRequest(context: SitemapContext) {
  const requestUrl = new URL(context.request.url)
  try {
    const apiBase = resolveApiBase(context.env.VITE_API_URL, requestUrl.origin)
    const response = await fetch(`${apiBase}/blog/seo/sitemap`, { headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error('SEO sitemap unavailable')
    const payload = await response.json() as { data?: SitemapItem[] }
    return new Response(buildSitemapXml(payload.data || [], requestUrl.origin), {
      headers: { 'content-type': 'application/xml; charset=UTF-8' },
    })
  } catch {
    return new Response(buildSitemapXml([], requestUrl.origin), {
      headers: { 'content-type': 'application/xml; charset=UTF-8' },
    })
  }
}
