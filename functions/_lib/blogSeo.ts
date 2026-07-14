export type BlogSeoPost = {
  id: string
  title: string
  description: string
  image_url: string
  author_name: string
  published_at: string | null
  updated_at: string
  path: string
}

export type SitemapItem = {
  path: string
  last_modified: string
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')

export function resolveApiBase(configuredUrl: string | undefined, origin: string) {
  const base = trimTrailingSlash(configuredUrl?.trim() || `${origin}/api/v1`)
  return base.endsWith('/api') ? `${base}/v1` : base
}

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const escapeXml = escapeHtml

const articleUrl = (origin: string, id: string) => `${origin}/posts/post/${encodeURIComponent(id)}`

function metaTag(attribute: 'name' | 'property', key: string, value: string) {
  return `<meta ${attribute}="${escapeHtml(key)}" content="${escapeHtml(value)}">`
}

export function buildArticleHtml(html: string, post: BlogSeoPost, origin: string) {
  const canonical = articleUrl(origin, post.id)
  const title = `${post.title} | Atoman`
  const image = post.image_url || `${origin}/favicon.png`
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    image,
    author: { '@type': 'Person', name: post.author_name },
    datePublished: post.published_at,
    dateModified: post.updated_at,
    mainEntityOfPage: canonical,
    url: canonical,
  }).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')

  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    metaTag('name', 'description', post.description),
    `<link rel="canonical" href="${escapeHtml(canonical)}">`,
    metaTag('property', 'og:type', 'article'),
    metaTag('property', 'og:title', post.title),
    metaTag('property', 'og:description', post.description),
    metaTag('property', 'og:url', canonical),
    metaTag('property', 'og:image', image),
    metaTag('name', 'twitter:card', 'summary_large_image'),
    metaTag('name', 'twitter:title', post.title),
    metaTag('name', 'twitter:description', post.description),
    metaTag('name', 'twitter:image', image),
    ...(post.published_at ? [metaTag('property', 'article:published_time', post.published_at)] : []),
    metaTag('property', 'article:modified_time', post.updated_at),
    `<script type="application/ld+json">${jsonLd}</script>`,
  ].join('\n    ')

  const cleanHtml = html
    .replace(/<title[^>]*>[\s\S]*?<\/title>/i, '')
    .replace(/\s*<(?:meta|link)[^>]*data-default-meta[^>]*>/gi, '')
  return cleanHtml.replace(/<\/head>/i, `    ${tags}\n  </head>`)
}

export function buildSitemapXml(items: SitemapItem[], origin: string) {
  const entries = items.map(item => {
    const path = item.path.startsWith('/') ? item.path : `/${item.path}`
    return `  <url>\n    <loc>${escapeXml(`${origin}${path}`)}</loc>\n    <lastmod>${escapeXml(item.last_modified)}</lastmod>\n  </url>`
  }).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`
}

export function buildRobotsText(origin: string) {
  return `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`
}
