import { mount, RouterLinkStub } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import ArtistSelect from '@/components/music/ArtistSelect.vue'

vi.mock('@/api/musicV1', () => ({
  listMusicArtists: vi.fn(async () => ({
    data: [],
  })),
}))

describe('ArtistSelect', () => {
  it('links the add artist action to the music artist creation route with encoded name query', async () => {
    const wrapper = mount(ArtistSelect, {
      props: {
        modelValue: [],
      },
      global: {
        stubs: {
          RouterLink: RouterLinkStub,
        },
      },
    })

    await wrapper.get('input').setValue('Sigur Rós & Jónsi')
    await wrapper.get('input').trigger('focus')

    const addArtistLink = wrapper.findComponent(RouterLinkStub)

    expect(addArtistLink.props('to')).toBe('/music/artist/new?name=Sigur%20R%C3%B3s%20%26%20J%C3%B3nsi')
    expect(addArtistLink.props('to')).not.toMatch(/^\/artist\/new/)
  })
})
