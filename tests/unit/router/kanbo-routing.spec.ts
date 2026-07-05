import { describe, expect, it } from 'vitest'
import { resolveSiteContext } from '@/router/siteContext'
import { moduleUrl } from '@/router/siteUrls'
import { subdomainDefaultPath } from '@/composables/useSubdomainNav'

describe('content routes', () => {
  it('no longer treats media as a module context', () => {
    expect(resolveSiteContext('localhost', '', '/media')).toEqual({ type: 'module', module: 'feed' })
    expect(resolveSiteContext('kanbo.atoman.org', '', '/')).toEqual({ type: 'entity', handle: 'kanbo' })
    expect(moduleUrl('podcast', 'https:', 'blog.atoman.org')).toBe('/podcasts')
  })

  it('returns the real module root for current module context', () => {
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { hostname: 'localhost', search: '', pathname: '/posts' },
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
