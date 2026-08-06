import { describe, expect, it } from 'vitest'
import { moduleRoutes } from '@/router/routes/modules'

function lazyImportPath(component: unknown) {
  return String(component)
}

describe('music module routes', () => {
  it('registers the fixed navigation destinations under the music root', () => {
    const musicRoot = moduleRoutes.music.find((route) => route.path === '/')
    const children = musicRoot?.children || []

    const homeRoute = children.find((route) => route.path === '')
    expect(homeRoute?.redirect).toBeTypeOf('function')
    if (typeof homeRoute?.redirect === 'function') {
      expect(homeRoute.redirect({ query: { editor: 'album-create' }, hash: '#create' } as never)).toEqual({
        path: '/music/discover',
        query: { editor: 'album-create' },
        hash: '#create',
      })
    }

    expect(children.find((route) => route.path === 'discover')).toBeTruthy()
    expect(lazyImportPath(children.find((route) => route.path === 'discover')?.component)).toContain('DiscoverView.vue')

    expect(children.find((route) => route.path === 'artists')).toBeTruthy()
    expect(lazyImportPath(children.find((route) => route.path === 'artists')?.component)).toContain('ArtistsView.vue')

    const starredRoute = children.find((route) => route.path === 'starred')
    expect(starredRoute?.meta?.requiresAuth).toBe(true)
    expect(starredRoute?.redirect).toBeTypeOf('function')
    if (typeof starredRoute?.redirect === 'function') {
      expect(starredRoute.redirect({ path: '/music/starred/', query: { sort: 'popular' }, hash: '#saved' } as never)).toEqual({
        path: '/music/library',
        query: { sort: 'popular' },
        hash: '#saved',
      })
    }

    expect(children.find((route) => route.path === 'library')?.meta?.requiresAuth).toBe(true)
    expect(lazyImportPath(children.find((route) => route.path === 'library')?.component)).toContain('LibraryView.vue')

    expect(children.find((route) => route.path === 'history')?.meta?.requiresAuth).toBe(true)
    expect(lazyImportPath(children.find((route) => route.path === 'history')?.component)).toContain('HistoryView.vue')

    expect(children.find((route) => route.path === 'playlist/:playlistId')).toBeTruthy()
    expect(lazyImportPath(children.find((route) => route.path === 'playlist/:playlistId')?.component)).toContain('MusicPlaylistRouteView.vue')
  })
})
