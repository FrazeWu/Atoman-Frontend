import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MusicPlaylistCard from '@/components/music/MusicPlaylistCard.vue'

describe('MusicPlaylistCard', () => {
  it('renders playlist title, description, song count, and emits click', async () => {
    const wrapper = mount(MusicPlaylistCard, {
      props: {
        playlist: {
          id: 'playlist-1',
          title: 'Late Night Mix',
          description: '夜间循环',
          song_count: 18,
        },
      },
    })

    expect(wrapper.text()).toContain('Late Night Mix')
    expect(wrapper.text()).toContain('夜间循环')
    expect(wrapper.text()).toContain('18 首')

    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })
})
