import { describe, expect, it } from 'vitest'
import { moduleRoutes } from '@/router/routes/modules'

function lazyImportPath(component: unknown) {
  return String(component)
}

describe('music module routes', () => {
  it('registers the fixed navigation destinations under the music root', () => {
    const musicRoot = moduleRoutes.music.find((route) => route.path === '/')
    const children = musicRoot?.children || []

    expect(children.find((route) => route.path === '')).toBeTruthy()
    expect(lazyImportPath(children.find((route) => route.path === '')?.component)).toContain('HomeView.vue')

    expect(children.find((route) => route.path === 'discover')).toBeTruthy()
    expect(lazyImportPath(children.find((route) => route.path === 'discover')?.component)).toContain('ExploreView.vue')

    expect(children.find((route) => route.path === 'artists')).toBeTruthy()
    expect(lazyImportPath(children.find((route) => route.path === 'artists')?.component)).toContain('ArtistsView.vue')

		expect(children.find((route) => route.path === 'starred')?.meta?.requiresAuth).toBe(true)
		expect(children.find((route) => route.path === 'starred')?.redirect).toBeTypeOf('function')

		expect(children.find((route) => route.path === 'library')?.meta?.requiresAuth).toBe(true)
		expect(lazyImportPath(children.find((route) => route.path === 'library')?.component)).toContain('LibraryView.vue')

    expect(children.find((route) => route.path === 'history')?.meta?.requiresAuth).toBe(true)
    expect(lazyImportPath(children.find((route) => route.path === 'history')?.component)).toContain('HistoryView.vue')

    expect(children.find((route) => route.path === 'playlist/:playlistId')).toBeTruthy()
    expect(lazyImportPath(children.find((route) => route.path === 'playlist/:playlistId')?.component)).toContain('MusicPlaylistRouteView.vue')
  })
})
