import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import MusicSheetStack from '@/components/music/MusicSheetStack.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

describe('MusicSheetStack', () => {
  beforeEach(() => useMusicDrawers().closeAll())

  it('renders repeated entity kinds as separate ordered layers', () => {
    const drawers = useMusicDrawers()
    drawers.openArtist('artist-1')
    drawers.openArtist('artist-2')
    drawers.openAlbum('album-3')

    const wrapper = mount(MusicSheetStack, {
      global: {
        stubs: {
          ArtistDrawer: { props: ['layer'], template: '<div class="artist-layer">{{ layer.key }}</div>' },
          AlbumDrawer: { props: ['layer'], template: '<div class="album-layer">{{ layer.key }}</div>' },
          PlaylistDrawer: true,
          MusicEntityEditorDrawer: true,
          MusicCreationFlowDrawer: true,
          NestedActionDrawer: true,
          MusicMergeDrawer: true,
        },
      },
    })

    expect(wrapper.findAll('.artist-layer').map(node => node.text())).toEqual([
      'artist:artist-1',
      'artist:artist-2',
    ])
    expect(wrapper.get('.album-layer').text()).toBe('album:album-3')
  })

  it('keeps the new top sheet mounted while the lower path switches', async () => {
    vi.useFakeTimers()
    const drawers = useMusicDrawers()
    const layerStub = {
      props: ['layer'],
      template: '<div class="sheet-layer-stub" :data-layer-key="layer.key">{{ layer.key }}</div>',
    }
    const wrapper = mount(MusicSheetStack, {
      global: {
        stubs: {
          ArtistDrawer: layerStub,
          AlbumDrawer: layerStub,
          PlaylistDrawer: layerStub,
          MusicEntityEditorDrawer: layerStub,
          MusicCreationFlowDrawer: layerStub,
          NestedActionDrawer: layerStub,
          MusicMergeDrawer: layerStub,
        },
      },
    })

    drawers.openArtist('artist-1')
    drawers.openAlbum('album-1')
    drawers.openNestedAction('revise', { albumId: 'album-1' })
    drawers.openNestedAction('history', { albumId: 'album-1' })
    await nextTick()

    const selector = '[data-layer-key="action:history:album-1"]'
    const topBeforeSwitch = wrapper.get(selector).element
    expect(wrapper.findAll('.sheet-layer-stub')).toHaveLength(4)

    await vi.advanceTimersByTimeAsync(300)
    await nextTick()

    expect(wrapper.findAll('.sheet-layer-stub')).toHaveLength(2)
    expect(wrapper.get(selector).element).toBe(topBeforeSwitch)
    vi.useRealTimers()
  })
})
