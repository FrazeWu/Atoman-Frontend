import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('music module routes', () => {
  it('renders distinct pages for the sidebar destinations', () => {
    const routesSource = readFileSync('src/router/routes/modules.ts', 'utf8')
    const musicRoutes = routesSource.slice(
      routesSource.indexOf('  music: ['),
      routesSource.indexOf('  feed: [')
    )

    expect(musicRoutes).toContain("{ path: '', component: () => import('@/views/music/HomeView.vue') }")
    expect(musicRoutes).toContain("{ path: 'discover', component: () => import('@/views/music/ExploreView.vue') }")
    expect(musicRoutes).toContain("{ path: 'artists', component: () => import('@/views/music/ArtistsView.vue') }")
    expect(musicRoutes).toContain("{ path: 'starred', component: () => import('@/views/music/StarredView.vue') }")
  })
})
