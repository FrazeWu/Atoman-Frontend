import { describe, expect, it } from 'vitest'
import { moduleRoutes } from '@/router/routes/modules'
import { resolveSiteContext } from '@/router/siteContext'
import { modulePathUrl, moduleUrl } from '@/router/siteUrls'
import { subdomainDefaultPath } from '@/composables/useSubdomainNav'

describe('kanbo routes', () => {
  it('registers the kanbo module and required child routes', () => {
    const routes = moduleRoutes.kanbo
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

  it('supports kanbo site context and URL helpers', () => {
    expect(resolveSiteContext('kanbo.atoman.org')).toEqual({ type: 'module', module: 'kanbo' })
    expect(resolveSiteContext('localhost', 'site=kanbo')).toEqual({ type: 'module', module: 'kanbo' })
    expect(moduleUrl('kanbo', 'https:', 'blog.atoman.org')).toBe('https://kanbo.atoman.org/')
    expect(modulePathUrl('kanbo', '/create', 'http:', 'localhost')).toBe('/create?site=kanbo')
  })

  it('returns kanbo as the default path inside kanbo context', () => {
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { hostname: 'localhost', search: '?site=kanbo' },
    })

    try {
      expect(subdomainDefaultPath()).toBe('/kanbo')
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      })
    }
  })
})
