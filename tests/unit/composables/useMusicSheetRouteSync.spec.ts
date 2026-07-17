import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useMusicDrawers } from '@/composables/useMusicDrawers'
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
    expect(drawers.layers.value.map(layer => layer.key)).toEqual(['artist:artist-1'])
  })
})
