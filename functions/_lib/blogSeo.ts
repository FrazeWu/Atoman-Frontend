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
  last_modified?: string
}

export type SeoFallbackOptions = {
  kind: string
  title: string
  description: string
  canonical: string
  imageUrl?: string
  mediaUrl?: string
}

const canonicalSitemapPathPatterns = [
  /^\/posts\/post\/[^/?#]+$/,
  /^\/music\/(?:artist|album|song)\/[^/?#]+$/,
  /^\/forum\/topic\/[^/?#]+$/,
  /^\/debate\/(?!rules$)[^/?#]+$/,
  /^\/podcasts\/(?:show|episode)\/[^/?#]+$/,
  /^\/videos\/(?:watch|collections)\/[^/?#]+$/,
]

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')

export function resolveApiBase(configuredUrl: string | undefined, origin: string) {
  const base = trimTrailingSlash(configuredUrl?.trim() || `${origin}/api/v1`)
  return base.endsWith('/api') ? `${base}/v1` : base
}

export function isCanonicalSitemapPath(path: string) {
  return canonicalSitemapPathPatterns.some((pattern) => pattern.test(path))
}

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const escapeXml = escapeHtml

export function injectSeoFallbackHtml(html: string, options: SeoFallbackOptions) {
  const media = options.mediaUrl
    ? `<video controls preload="metadata"${options.imageUrl ? ` poster="${escapeHtml(options.imageUrl)}"` : ""}><source src="${escapeHtml(options.mediaUrl)}"></video>`
    : ""
  const image = options.imageUrl
    ? `<img src="${escapeHtml(options.imageUrl)}" alt="${escapeHtml(options.title)}" loading="eager">`
    : ""
  const fallback = [
    `<main data-seo-fallback="${escapeHtml(options.kind)}">`,
    `<h1>${escapeHtml(options.title)}</h1>`,
    `<p>${escapeHtml(options.description)}</p>`,
    image,
    media,
    `<a href="${escapeHtml(options.canonical)}">查看完整内容</a>`,
    "</main>",
  ].join("")
  const cleanHtml = html.replace(
    /<!--\s*seo-prerender-start\s*-->[\s\S]*?<!--\s*seo-prerender-end\s*-->/gi,
    "",
  )
  const appMarker = /<div id=["']app["']>/i
  if (appMarker.test(cleanHtml)) return cleanHtml.replace(appMarker, (marker) => `${marker}${fallback}`)
  return cleanHtml.replace(/<\/body>/i, `${fallback}</body>`)
}

const articleUrl = (origin: string, id: string) => `${origin}/posts/post/${encodeURIComponent(id)}`

function metaTag(attribute: 'name' | 'property', key: string, value: string) {
  return `<meta data-page-meta="article" ${attribute}="${escapeHtml(key)}" content="${escapeHtml(value)}">`
}

export function buildArticleHtml(html: string, post: BlogSeoPost, origin: string) {
  const canonical = articleUrl(origin, post.id)
  const title = `${post.title} | Atoman`
  const image = post.image_url || `${origin}/atoman-share.png`
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
    `<title data-page-meta="article">${escapeHtml(title)}</title>`,
    metaTag('name', 'description', post.description),
    `<link data-page-meta="article" rel="canonical" href="${escapeHtml(canonical)}">`,
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
    `<script data-page-meta="article" type="application/ld+json">${jsonLd}</script>`,
  ].join('\n    ')

  const cleanHtml = html
    .replace(/<title[^>]*>[\s\S]*?<\/title>/i, '')
    .replace(/\s*<(?:meta|link)[^>]*data-default-meta[^>]*>/gi, '')
  const fallbackHtml = injectSeoFallbackHtml(cleanHtml, {
    kind: 'article',
    title: post.title,
    description: post.description,
    canonical,
    imageUrl: image,
  })
  return fallbackHtml.replace(/<\/head>/i, `    ${tags}\n  </head>`)
}

export function buildSitemapXml(items: SitemapItem[], origin: string) {
  const entries = items.map(item => {
    const path = item.path.startsWith('/') ? item.path : `/${item.path}`
    const lastModified = item.last_modified
      ? `\n    <lastmod>${escapeXml(item.last_modified)}</lastmod>`
      : ''
    return `  <url>\n    <loc>${escapeXml(`${origin}${path}`)}</loc>${lastModified}\n  </url>`
  }).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`
}

export function buildRobotsText(origin: string) {
  return `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`
}
