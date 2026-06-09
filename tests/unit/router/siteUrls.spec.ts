import { describe, expect, it } from 'vitest'
import { subdomainDefaultPath, channelUrl, moduleUrl, userUrl } from '@/composables/useSubdomainNav'
import { modulePathUrl } from '@/router/siteUrls'

describe('site URL builders', () => {
  it('builds module URLs on the base domain without requiring subdomain DNS', () => {
    expect(moduleUrl('blog', 'https:', 'music.atoman.org')).toBe('https://atoman.org/?site=blog')
    expect(moduleUrl('feed', 'https:', 'u-alice.atoman.org')).toBe('https://atoman.org/?site=feed')
  })

  it('builds user and channel profile URLs', () => {
    expect(userUrl('alice', 'https:', 'blog.atoman.org')).toBe('https://atoman.org/?site=u-alice')
    expect(channelUrl('design', 'https:', 'blog.atoman.org')).toBe('https://atoman.org/?site=c-design')
  })

  it('uses path-only URLs in local development', () => {
    expect(moduleUrl('blog', 'http:', 'localhost')).toBe('/?site=blog')
    expect(modulePathUrl('music', '/album/123', 'http:', 'localhost')).toBe('/album/123?site=music')
    expect(userUrl('alice', 'http:', 'localhost')).toBe('/?site=u-alice')
    expect(channelUrl('design', 'http:', 'localhost')).toBe('/?site=c-design')
  })

  it('builds module URLs with canonical query context on the base domain', () => {
    expect(modulePathUrl('music', '/album/123', 'https:', 'blog.atoman.org')).toBe('https://atoman.org/album/123?site=music')
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
