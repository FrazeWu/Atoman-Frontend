import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import { usePageMeta } from '@/composables/usePageMeta'

describe('usePageMeta SSR lifecycle', () => {
  beforeEach(() => {
    document.head.innerHTML = `
      <title data-page-meta="article">服务端旧文章 | Atoman</title>
      <meta data-page-meta="article" name="description" content="旧摘要">
      <meta data-page-meta="article" property="og:type" content="article">
      <meta data-page-meta="article" property="article:modified_time" content="2026-01-01T00:00:00Z">
      <link data-page-meta="article" rel="canonical" href="https://atoman.org/posts/post/old">
      <script data-page-meta="article" type="application/ld+json">{"@type":"BlogPosting","headline":"旧文章"}</script>
    `
  })

  it('reuses SSR article metadata and restores site defaults on unmount', () => {
    const wrapper = mount(defineComponent({
      setup() {
        const { setPageMeta } = usePageMeta()
        setPageMeta({
          title: '客户端新文章',
          description: '新摘要',
          canonical: 'https://atoman.org/posts/post/new',
          image: 'https://assets.atoman.org/new.jpg',
          author: 'Alice',
          publishedAt: '2026-07-10T08:00:00Z',
          updatedAt: '2026-07-14T09:30:00Z',
        })
        return () => null
      },
    }))

    expect(document.title).toBe('客户端新文章 | Atoman')
    expect(document.head.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(1)
    expect(document.head.querySelector('script[type="application/ld+json"]')?.textContent).toContain('客户端新文章')
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1)

    wrapper.unmount()

    expect(document.title).toBe('Atoman')
    expect(document.head.querySelector('[data-page-meta="article"]')).toBeNull()
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull()
    expect(document.head.querySelector('script[type="application/ld+json"]')).toBeNull()
    expect(document.head.querySelector('meta[property^="article:"]')).toBeNull()
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Atoman 内容社区')
    expect(document.head.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe('website')
    expect(document.head.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe('Atoman')
    expect(document.head.querySelector('meta[name="twitter:title"]')?.getAttribute('content')).toBe('Atoman')
  })
})
