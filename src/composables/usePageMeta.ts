import { onUnmounted } from 'vue'

export type PageMeta = {
  title: string
  description: string
  canonical: string
  image?: string
  author?: string
  publishedAt?: string
  updatedAt?: string
}

const defaultMeta = [
  ['name', 'description', '聚合博客、播客、音乐与讨论，帮助深度内容读者快速建立自己的高质量内容订阅流。'],
  ['property', 'og:type', 'website'],
  ['property', 'og:title', 'Atoman - 3 分钟建立你的高质量内容订阅流'],
  ['property', 'og:description', '聚合博客、播客、音乐与讨论，帮助深度内容读者快速建立自己的高质量内容订阅流。'],
  ['property', 'og:url', 'https://www.atoman.org/'],
  ['property', 'og:image', 'https://www.atoman.org/favicon.png'],
  ['name', 'twitter:card', 'summary'],
  ['name', 'twitter:title', 'Atoman - 3 分钟建立你的高质量内容订阅流'],
  ['name', 'twitter:description', '聚合博客、播客、音乐与讨论，帮助深度内容读者快速建立自己的高质量内容订阅流。'],
  ['name', 'twitter:image', 'https://www.atoman.org/favicon.png'],
] as const

function createMeta(attribute: 'name' | 'property', key: string) {
  const meta = document.createElement('meta')
  meta.setAttribute(attribute, key)
  document.head.append(meta)
  return meta
}

function restoreSiteDefaults() {
  document.head.querySelectorAll('[data-page-meta="article"]').forEach(element => element.remove())
  document.head.querySelectorAll('link[rel="canonical"], meta[property^="article:"]').forEach(element => element.remove())
  document.title = 'Atoman - 3 分钟建立你的高质量内容订阅流'

  for (const [attribute, key, content] of defaultMeta) {
    const selector = `meta[${attribute}="${key}"]`
    const meta = document.head.querySelector<HTMLMetaElement>(selector) || createMeta(attribute, key)
    meta.removeAttribute('data-page-meta')
    meta.dataset.defaultMeta = ''
    meta.content = content
  }
}

function upsertMeta(attribute: 'name' | 'property', key: string, content: string) {
  const selector = `meta[${attribute}="${key}"]`
  const meta = document.head.querySelector<HTMLMetaElement>(selector) || createMeta(attribute, key)
  meta.removeAttribute('data-default-meta')
  meta.dataset.pageMeta = 'article'
  meta.content = content
}

export function usePageMeta() {
  const setPageMeta = (meta: PageMeta) => {
    document.title = `${meta.title} | Atoman`
    document.querySelector('title')?.setAttribute('data-page-meta', 'article')
    upsertMeta('name', 'description', meta.description)
    upsertMeta('property', 'og:type', 'article')
    upsertMeta('property', 'og:title', meta.title)
    upsertMeta('property', 'og:description', meta.description)
    upsertMeta('property', 'og:url', meta.canonical)
    upsertMeta('name', 'twitter:card', meta.image ? 'summary_large_image' : 'summary')
    upsertMeta('name', 'twitter:title', meta.title)
    upsertMeta('name', 'twitter:description', meta.description)
    if (meta.image) {
      upsertMeta('property', 'og:image', meta.image)
      upsertMeta('name', 'twitter:image', meta.image)
    }
    if (meta.publishedAt) upsertMeta('property', 'article:published_time', meta.publishedAt)
    if (meta.updatedAt) upsertMeta('property', 'article:modified_time', meta.updatedAt)

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.append(canonical)
    }
    canonical.dataset.pageMeta = 'article'
    canonical.href = meta.canonical

    let script = document.head.querySelector<HTMLScriptElement>('script[data-page-meta="article"][type="application/ld+json"]')
    if (!script) {
      script = document.createElement('script')
      script.type = 'application/ld+json'
      script.dataset.pageMeta = 'article'
      document.head.append(script)
    }
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'BlogPosting', headline: meta.title,
      description: meta.description, image: meta.image, author: meta.author ? { '@type': 'Person', name: meta.author } : undefined,
      datePublished: meta.publishedAt, dateModified: meta.updatedAt, mainEntityOfPage: meta.canonical, url: meta.canonical,
    }).replace(/</g, '\\u003c')
  }

  onUnmounted(restoreSiteDefaults)
  return { setPageMeta, restorePageMeta: restoreSiteDefaults }
}
