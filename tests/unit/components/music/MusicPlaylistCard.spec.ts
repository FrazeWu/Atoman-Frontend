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

  it('renders play and bookmark stats on the cover', () => {
    const wrapper = mount(MusicPlaylistCard, {
      props: {
        playlist: {
          id: 'playlist-1',
          title: 'Late Night Mix',
          song_count: 18,
          play_count: 42,
          bookmark_count: 7,
        },
      },
    })

    const stats = wrapper.get('[aria-label="歌单统计"]')
    expect(stats.text()).toContain('42')
    expect(stats.text()).toContain('7')
    expect(wrapper.text()).toContain('播放 42')
    expect(wrapper.text()).toContain('收藏 7')
  })
})
