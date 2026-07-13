import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

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
})
