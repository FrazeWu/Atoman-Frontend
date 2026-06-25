import { describe, expect, it } from 'vitest'
import { moduleRoutes } from '@/router/routes/modules'
import { channelRoutes, userRoutes } from '@/router/routes/entities'
import { portalRoutes } from '@/router/routes/portal'
import { settingRoutes } from '@/router/routes/settings'

type TestRoute = { path: string; children?: readonly TestRoute[] }

function paths(routes: readonly TestRoute[]) {
  return routes.map((route) => route.path)
}

function flattenPaths(routes: readonly TestRoute[]): string[] {
  return routes.flatMap((route) => [route.path, ...flattenPaths(route.children || [])])
}

describe('host-scoped route tables', () => {
  it('keeps blog routes relative to the module root', () => {
    const blogPaths = flattenPaths(moduleRoutes.blog)
    expect(blogPaths).toContain('/')
    expect(blogPaths).toContain('post/new')
    expect(blogPaths).toContain('bookmarks')
    expect(blogPaths).not.toContain('/posts')
  })

  it('keeps music routes relative to the module root', () => {
    const musicPaths = flattenPaths(moduleRoutes.music)
    expect(musicPaths).toContain('explore')
    expect(musicPaths).toContain('starred')
    expect(musicPaths).not.toContain('/music')
  })

  it('keeps feed and forum routes short', () => {
    const feedPaths = flattenPaths(moduleRoutes.feed)
    const forumPaths = flattenPaths(moduleRoutes.forum)
    expect(feedPaths).toContain('reading-list')
    expect(feedPaths).toContain('inbox')
    expect(forumPaths).toContain('topic/:id')
    expect(forumPaths).not.toContain('/forum')
  })

  it('renders a dedicated public homepage at the content root instead of redirecting to a leaf page', () => {
    const contentRoot = moduleRoutes.media.find((route) => route.path === '/')
    const children = contentRoot?.children || []

    expect(children.find((route) => route.path === '')?.component).toBeTruthy()
    expect(children.find((route) => route.path === '')?.redirect).toBeUndefined()
  })

  it('defines entity profile routes as aggregation spaces', () => {
    expect(paths(userRoutes)).toEqual(['/users/:handle', '/users/:handle/posts', '/users/:handle/channels'])
    expect(paths(channelRoutes)).toEqual(['/channels/:slug', '/channels/:slug/posts', '/channels/:slug/about'])
  })

  it('keeps portal routes separate from module routes', () => {
    expect(paths(portalRoutes)).toContain('/')
    expect(paths(portalRoutes)).toContain('/login')
    expect(paths(portalRoutes)).toContain('/terms')
  })

  it('does not register top-level prefixed paths inside module route tables', () => {
    const allModulePaths = Object.values(moduleRoutes).flatMap(flattenPaths)
    expect(allModulePaths).not.toContain('/posts')
    expect(allModulePaths).not.toContain('/music')
    expect(allModulePaths).not.toContain('/feed')
    expect(allModulePaths).not.toContain('/forum')
    expect(allModulePaths).not.toContain('/posts/bookmarks')
    expect(allModulePaths).not.toContain('/music/albums/:albumId')
  })

  it('does not register duplicate top-level routes already handled by layout children', () => {
    expect(paths(moduleRoutes.music)).not.toContain('/album/new')
    expect(paths(moduleRoutes.music)).not.toContain('/album/:albumId')
    expect(paths(moduleRoutes.music)).not.toContain('/artist/:artistId')
    expect(paths(moduleRoutes.feed)).not.toContain('/reading-list')
    expect(paths(moduleRoutes.feed)).not.toContain('/inbox')
    expect(paths(moduleRoutes.forum)).not.toContain('/topic/:id')
  })

  it('redirects legacy feed setting pages to the unified access settings page', () => {
    const settingRoot = settingRoutes.find((route) => route.path === '/setting')
    const children = settingRoot?.children || []

    expect(children.find((route) => route.path === 'feed-fulltext')?.redirect).toBe('/setting/access')
    expect(children.find((route) => route.path === 'feed-sources')?.redirect).toBe('/setting/access')
  })
})
