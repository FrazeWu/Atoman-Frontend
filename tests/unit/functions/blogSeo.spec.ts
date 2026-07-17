import { describe, expect, it } from 'vitest'

import {
  buildArticleHtml,
  buildRobotsText,
  buildSitemapXml,
  resolveApiBase,
  type BlogSeoPost,
} from '../../../functions/_lib/blogSeo'

const post: BlogSeoPost = {
  id: 'post-1',
  title: '安全 <标题> & "引号"',
  description: '摘要 </script><script>alert(1)</script> & 更多',
  image_url: 'https://assets.example/cover.jpg?size=large&crop=1',
  author_name: 'Alice',
  published_at: '2026-07-10T08:00:00Z',
  updated_at: '2026-07-14T09:30:00Z',
  path: '/posts/post/post-1',
}

describe('blog SEO helpers', () => {
  it('normalizes the configured API root', () => {
    expect(resolveApiBase('https://api.atoman.org/api', 'https://atoman.org')).toBe('https://api.atoman.org/api/v1')
    expect(resolveApiBase('https://api.atoman.org/api/v1/', 'https://atoman.org')).toBe('https://api.atoman.org/api/v1')
    expect(resolveApiBase(undefined, 'https://atoman.org')).toBe('https://atoman.org/api/v1')
  })

  it('injects escaped article metadata and script-safe JSON-LD', () => {
    const html = buildArticleHtml('<html><head><title>Atoman</title></head><body></body></html>', post, 'https://atoman.org')

    expect(html).toContain('<title data-page-meta="article">安全 &lt;标题&gt; &amp; &quot;引号&quot; | Atoman</title>')
    expect(html).toContain('property="og:type" content="article"')
    expect(html).toContain('data-page-meta="article"')
    expect(html).toContain('rel="canonical" href="https://atoman.org/posts/post/post-1"')
    expect(html).toContain('property="article:published_time" content="2026-07-10T08:00:00Z"')
    expect(html).toContain('name="twitter:card" content="summary_large_image"')
    expect(html).toContain('&lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt; &amp; 更多')
    expect(html).toContain('"@type":"BlogPosting"')
    expect(html).toContain('\\u003c/script\\u003e\\u003cscript\\u003ealert(1)\\u003c/script\\u003e')
    expect(html).not.toContain('</script><script>alert(1)</script>')
  })

  it('builds escaped absolute sitemap URLs and robots discovery', () => {
    const xml = buildSitemapXml([
      { path: '/posts/post/one&two', last_modified: '2026-07-14T09:30:00Z' },
    ], 'https://atoman.org')

    expect(xml).toContain('<loc>https://atoman.org/posts/post/one&amp;two</loc>')
    expect(xml).toContain('<lastmod>2026-07-14T09:30:00Z</lastmod>')
    expect(buildRobotsText('https://atoman.org')).toBe('User-agent: *\nAllow: /\nSitemap: https://atoman.org/sitemap.xml\n')
  })
})
