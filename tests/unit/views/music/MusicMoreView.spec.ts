import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MusicMoreView from '@/views/music/MusicMoreView.vue'

describe('MusicMoreView', () => {
  it('exposes the music pages hidden from the primary mobile tabs', () => {
    const wrapper = mount(MusicMoreView, {
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="String(to)"><slot /></a>',
          },
        },
      },
    })

    expect(wrapper.text()).toContain('更多音乐')
    expect(wrapper.find('a[href="/music/albums"]').text()).toContain('专辑')
    expect(wrapper.find('a[href="/music/artists"]').text()).toContain('艺人')
    expect(wrapper.find('a[href="/music/bookmarks"]').text()).toContain('收藏')
    expect(wrapper.find('a[href="/music/history"]').text()).toContain('历史')
    expect(wrapper.find('a[href="/music/imports"]').text()).toContain('导入')
    expect(wrapper.find('a[href="/music/playlists"]').text()).toContain('歌单')
  })
})
