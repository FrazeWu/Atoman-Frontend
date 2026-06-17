import { describe, expect, it } from 'vitest'
import { subdomainDefaultPath, channelUrl, moduleUrl, userUrl } from '@/composables/useSubdomainNav'
import { modulePathUrl } from '@/router/siteUrls'

describe('site URL builders', () => {
  it('builds module URLs on production subdomains', () => {
    expect(moduleUrl('blog', 'https:', 'music.atoman.org')).toBe('https://blog.atoman.org/')
    expect(moduleUrl('feed', 'https:', 'u-alice.atoman.org')).toBe('https://feed.atoman.org/')
  })

  it('builds user and channel profile subdomain URLs in production', () => {
    expect(userUrl('alice', 'https:', 'blog.atoman.org')).toBe('https://alice.atoman.org/')
    expect(channelUrl('design', 'https:', 'blog.atoman.org')).toBe('https://design.atoman.org/')
  })

  it('uses path-only URLs in local development', () => {
    expect(moduleUrl('blog', 'http:', 'localhost')).toBe('/?site=blog')
    expect(modulePathUrl('music', '/album/123', 'http:', 'localhost')).toBe('/album/123?site=music')
    expect(userUrl('alice', 'http:', 'localhost')).toBe('/?site=alice')
    expect(channelUrl('design', 'http:', 'localhost')).toBe('/?site=design')
  })

  it('builds module path URLs on production subdomains', () => {
    expect(modulePathUrl('music', '/album/123', 'https:', 'blog.atoman.org')).toBe('https://music.atoman.org/album/123')
  })

  it('keeps module subdomain roots compatible with the current prefixed route table', () => {
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { hostname: 'blog.atoman.org', search: '' },
    })

    try {
      expect(subdomainDefaultPath()).toBe('/blog')
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      })
    }
  })
})
