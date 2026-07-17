import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('music module routes', () => {
  it('renders distinct pages for the sidebar destinations', () => {
    const routesSource = readFileSync('src/router/routes/modules.ts', 'utf8')
    const musicRoutes = routesSource.slice(
      routesSource.indexOf('  music: ['),
      routesSource.indexOf('  feed: [')
    )

    expect(musicRoutes).toContain("{ path: '', component: asyncRouteView(() => import('@/views/music/HomeView.vue')) }")
    expect(musicRoutes).toContain("{ path: 'discover', component: asyncRouteView(() => import('@/views/music/ExploreView.vue')) }")
    expect(musicRoutes).toContain("{ path: 'artists', component: asyncRouteView(() => import('@/views/music/ArtistsView.vue')) }")
    expect(musicRoutes).toContain("{ path: 'starred', component: asyncRouteView(() => import('@/views/music/StarredView.vue')) }")
  })
})
