import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { MusicSheetLayer } from '../../../src/components/music/musicSheetTypes'
// @ts-expect-error Vitest resolves Vue/TypeScript aliases through Vite, outside the src-only tsconfig.
import { useMusicDrawers } from '@/composables/useMusicDrawers'
// @ts-expect-error Vitest resolves Vue/TypeScript aliases through Vite, outside the src-only tsconfig.
import { useMusicSheetRouteSync } from '@/composables/useMusicSheetRouteSync'

describe('useMusicSheetRouteSync', () => {
  beforeEach(() => useMusicDrawers().closeAll())

  it('pops to the artist layer when browser history returns from an album', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/music', component: { template: '<div />' } },
        { path: '/music/artist/:artistId', component: { template: '<div />' } },
        { path: '/music/album/:albumId', component: { template: '<div />' } },
      ],
    })
    useMusicSheetRouteSync(router)
    const drawers = useMusicDrawers()

    await router.push('/music')
    drawers.openArtist('artist-1')
    await flushPromises()
    drawers.openAlbum('album-2')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/music/album/album-2')

    router.back()
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/music/artist/artist-1')
    expect(drawers.layers.value.map((layer: MusicSheetLayer) => layer.key)).toEqual(['artist:artist-1'])
  })

  it('preserves the artist and album layers while opening a routed song', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/music', component: { template: '<div />' } },
        { path: '/music/artist/:artistId', component: { template: '<div />' } },
        { path: '/music/album/:albumId', component: { template: '<div />' } },
        { path: '/music/song/:songId', component: { template: '<div />' } },
      ],
    })
    useMusicSheetRouteSync(router)
    const drawers = useMusicDrawers()

    await router.push('/music')
    drawers.openArtist('artist-1')
    await flushPromises()
    drawers.openAlbum('album-2')
    await flushPromises()

    await router.push('/music/song/song-3')
    await flushPromises()
    expect(drawers.layers.value.map((layer: MusicSheetLayer) => layer.key)).toEqual([
      'artist:artist-1',
      'album:album-2',
    ])

    drawers.openSong('song-3')
    await flushPromises()
    expect(drawers.layers.value.map((layer: MusicSheetLayer) => layer.key)).toEqual([
      'artist:artist-1',
      'album:album-2',
      'song:song-3',
    ])
  })

  it('returns across multiple routed layers without reopening an intermediate sheet', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/music', component: { template: '<div />' } },
        { path: '/music/artist/:artistId', component: { template: '<div />' } },
        { path: '/music/album/:albumId', component: { template: '<div />' } },
      ],
    })
    useMusicSheetRouteSync(router)
    const drawers = useMusicDrawers()

    await router.push('/music')
    drawers.openAlbum('album-1')
    await flushPromises()
    drawers.openArtist('artist-2')
    await flushPromises()
    drawers.openAlbum('album-3')
    await flushPromises()

    drawers.returnToLayer('album:album-1')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/music/album/album-1')
    expect(drawers.layers.value.map((layer: MusicSheetLayer) => layer.key)).toEqual(['album:album-1'])
  })
})
