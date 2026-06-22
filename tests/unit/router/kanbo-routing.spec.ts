import { describe, expect, it } from 'vitest'
import { moduleRoutes } from '@/router/routes/modules'
import { resolveSiteContext } from '@/router/siteContext'
import { modulePathUrl, moduleUrl } from '@/router/siteUrls'
import { subdomainDefaultPath } from '@/composables/useSubdomainNav'

describe('content routes', () => {
  it('registers the media module and required child routes', () => {
    const routes = moduleRoutes.media
    expect(routes).toBeTruthy()

    const root = routes.find((route) => route.path === '/')
    expect(root).toBeTruthy()

    const children = root?.children || []
    expect(children.map((child) => child.path)).toEqual([
      '',
      'create',
      'articles',
      'videos',
      'podcasts',
      'subscriptions',
      'bookmarks',
    ])
  })

  it('supports the media site context as the only module identity', () => {
    expect(resolveSiteContext('media.atoman.org')).toEqual({ type: 'module', module: 'media' })
    expect(resolveSiteContext('localhost', 'site=media')).toEqual({ type: 'module', module: 'media' })
    expect(resolveSiteContext('kanbo.atoman.org')).not.toEqual({ type: 'module', module: 'media' })
    expect(moduleUrl('media', 'https:', 'blog.atoman.org')).toBe('https://media.atoman.org/')
    expect(modulePathUrl('media', '/create', 'http:', 'localhost')).toBe('/create?site=media')
  })

  it('returns media as the default path inside media context', () => {
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { hostname: 'localhost', search: '?site=media' },
    })

    try {
      expect(subdomainDefaultPath()).toBe('/media')
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      })
    }
  })
})
