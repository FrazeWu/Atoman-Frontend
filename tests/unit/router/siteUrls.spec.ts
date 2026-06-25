import { describe, expect, it } from 'vitest'
import { subdomainDefaultPath, channelUrl, moduleUrl, userUrl } from '@/composables/useSubdomainNav'
import { modulePathUrl } from '@/router/siteUrls'

describe('site URL builders', () => {
  it('builds module URLs as path prefixes', () => {
    expect(moduleUrl('blog', 'https:', 'music.atoman.org')).toBe('/posts')
    expect(moduleUrl('feed', 'https:', 'u-alice.atoman.org')).toBe('/feed')
    expect(moduleUrl('media', 'https:', 'blog.atoman.org')).toBe('/media')
  })

  it('builds user and channel URLs as explicit paths', () => {
    expect(userUrl('alice', 'https:', 'blog.atoman.org')).toBe('/users/alice')
    expect(channelUrl('design', 'https:', 'blog.atoman.org')).toBe('/channels/design')
  })

  it('uses the same path-only URLs in local development', () => {
    expect(moduleUrl('blog', 'http:', 'localhost')).toBe('/posts')
    expect(modulePathUrl('music', '/album/123', 'http:', 'localhost')).toBe('/music/album/123')
    expect(userUrl('alice', 'http:', 'localhost')).toBe('/users/alice')
    expect(channelUrl('design', 'http:', 'localhost')).toBe('/channels/design')
  })

  it('builds module path URLs with public path segments', () => {
    expect(modulePathUrl('music', '/album/123', 'https:', 'blog.atoman.org')).toBe('/music/album/123')
  })

  it('returns the explicit module root path for current module context', () => {
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { hostname: 'blog.atoman.org', search: '', pathname: '/posts' },
    })

    try {
      expect(subdomainDefaultPath()).toBe('/posts')
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      })
    }
  })
})
