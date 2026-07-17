import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MusicAlbumCard from '@/components/music/MusicAlbumCard.vue'

describe('MusicAlbumCard', () => {
  it('does not display the backend zero-date year', () => {
    const wrapper = mount(MusicAlbumCard, {
      props: {
        album: {
          id: 'album-1',
          title: 'Unknown Year Album',
          release_date: '0001-01-01T00:00:00Z',
          artists: [{ name: 'Artist' }],
        },
      },
    })

    expect(wrapper.text()).toContain('未知年份')
    expect(wrapper.text()).not.toContain('0001')
  })
})
