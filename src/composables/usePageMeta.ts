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

type Restorer = () => void

export function usePageMeta() {
  let restorers: Restorer[] = []

  const restore = () => {
    restorers.splice(0).reverse().forEach(run => run())
    document.title = 'Atoman'
  }

  const setAttribute = (selector: string, create: () => HTMLElement, attribute: string, value: string) => {
    let element = document.head.querySelector<HTMLElement>(selector)
    const created = !element
    if (!element) {
      element = create()
      element.dataset.pageMeta = ''
      document.head.append(element)
    }
    const previous = element.getAttribute(attribute)
    element.setAttribute(attribute, value)
    restorers.push(() => {
      if (created) element?.remove()
      else if (previous === null) element?.removeAttribute(attribute)
      else element?.setAttribute(attribute, previous)
    })
  }

  const setMeta = (attribute: 'name' | 'property', key: string, content: string) => {
    setAttribute(`meta[${attribute}="${key}"]`, () => {
      const meta = document.createElement('meta')
      meta.setAttribute(attribute, key)
      return meta
    }, 'content', content)
  }

  const setPageMeta = (meta: PageMeta) => {
    restore()
    document.title = `${meta.title} | Atoman`
    setMeta('name', 'description', meta.description)
    setAttribute('link[rel="canonical"]', () => {
      const link = document.createElement('link')
      link.setAttribute('rel', 'canonical')
      return link
    }, 'href', meta.canonical)
    setMeta('property', 'og:type', 'article')
    setMeta('property', 'og:title', meta.title)
    setMeta('property', 'og:description', meta.description)
    setMeta('property', 'og:url', meta.canonical)
    setMeta('name', 'twitter:card', meta.image ? 'summary_large_image' : 'summary')
    setMeta('name', 'twitter:title', meta.title)
    setMeta('name', 'twitter:description', meta.description)
    if (meta.image) {
      setMeta('property', 'og:image', meta.image)
      setMeta('name', 'twitter:image', meta.image)
    }
    if (meta.publishedAt) setMeta('property', 'article:published_time', meta.publishedAt)
    if (meta.updatedAt) setMeta('property', 'article:modified_time', meta.updatedAt)

    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.dataset.pageMeta = ''
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'BlogPosting', headline: meta.title,
      description: meta.description, image: meta.image, author: meta.author ? { '@type': 'Person', name: meta.author } : undefined,
      datePublished: meta.publishedAt, dateModified: meta.updatedAt, mainEntityOfPage: meta.canonical, url: meta.canonical,
    }).replace(/</g, '\\u003c')
    document.head.append(script)
    restorers.push(() => script.remove())
  }

  onUnmounted(restore)
  return { setPageMeta, restorePageMeta: restore }
}
