import type { RouteRecordRaw } from 'vue-router'
import { describe, expect, it } from 'vitest'

import { buildAppRoutes } from '@/router/buildAppRoutes'
import { studioRoutes } from '@/router/routes/studio'

function routePaths(routes: RouteRecordRaw[], parent = ''): string[] {
  return routes.flatMap((route) => {
    const path = route.path.startsWith('/')
      ? route.path
      : `${parent.replace(/\/$/, '')}/${route.path}`.replace(/\/$/, '')
    return [path || '/', ...routePaths(route.children ?? [], path)]
  })
}

describe('studio routes', () => {
  it('provides one authenticated creator workspace with module pages and editors', () => {
    const paths = routePaths(studioRoutes)
    expect(studioRoutes).toHaveLength(1)
    expect(studioRoutes[0]?.path).toBe('/studio')
    expect(studioRoutes[0]?.meta?.requiresAuth).toBe(true)
    expect(paths).toEqual(expect.arrayContaining([
      '/studio',
      '/studio/channel',
      '/studio/:module(blog|podcast|video)/content',
      '/studio/:module(blog|podcast|video)/analytics',
      '/studio/:module(blog|podcast|video)/interactions',
      '/studio/:module(blog|podcast|video)/settings',
      '/studio/blog/new',
      '/studio/blog/:id/edit',
      '/studio/podcast/new',
      '/studio/podcast/:id/edit',
      '/studio/video/new',
      '/studio/video/:id/edit',
    ]))
  })

  it('removes every legacy creator route from the application', () => {
    const paths = routePaths(buildAppRoutes())
    for (const legacy of [
      '/posts/manage',
      '/posts/post/new',
      '/posts/post/:id/edit',
      '/podcasts/creator',
      '/podcasts/editor/:id?',
      '/videos/creator',
      '/videos/manage',
      '/videos/upload',
      '/videos/edit/:id',
      '/channels',
    ]) {
      expect(paths).not.toContain(legacy)
    }
  })
})
