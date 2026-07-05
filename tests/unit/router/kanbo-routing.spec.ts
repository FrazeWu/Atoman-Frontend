import { describe, expect, it } from 'vitest'
import { moduleRoutes } from '@/router/routes/modules'
import { resolveSiteContext } from '@/router/siteContext'
import { modulePathUrl, moduleUrl } from '@/router/siteUrls'
import { subdomainDefaultPath } from '@/composables/useSubdomainNav'

describe('content routes', () => {
  it('keeps the media module only as a compatibility redirect group', () => {
    const routes = moduleRoutes.media
    expect(routes).toBeTruthy()

    const root = routes.find((route) => route.path === '/')
    expect(root).toBeTruthy()

    const children = root?.children || []
    expect(children.map((child) => child.path)).toEqual([
      'articles',
      'videos',
      'podcasts',
      'subscriptions',
      'bookmarks',
    ])
  })

  it('supports the media module only through explicit paths', () => {
    expect(resolveSiteContext('media.atoman.org', '', '/media')).toEqual({ type: 'module', module: 'media' })
    expect(resolveSiteContext('localhost', '', '/media')).toEqual({ type: 'module', module: 'media' })
    expect(resolveSiteContext('kanbo.atoman.org', '', '/')).toEqual({ type: 'entity', handle: 'kanbo' })
    expect(moduleUrl('media', 'https:', 'blog.atoman.org')).toBe('/media')
    expect(modulePathUrl('media', '/create', 'http:', 'localhost')).toBe('/media/create')
  })

  it('returns media as the default path inside media context', () => {
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { hostname: 'localhost', search: '', pathname: '/media' },
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
