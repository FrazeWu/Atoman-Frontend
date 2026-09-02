import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MusicArtistCard from '@/components/music/MusicArtistCard.vue'

describe('MusicArtistCard', () => {
  it('provides an accessible avatar action without nesting the bookmark action', async () => {
    const wrapper = mount(MusicArtistCard, {
      props: {
        artist: { id: 'artist-1', name: '测试艺人' },
      },
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    })

    const avatarAction = wrapper.get('.avatar-action')
    expect(avatarAction.attributes('type')).toBe('button')
    expect(avatarAction.attributes('aria-label')).toBe('打开艺人 测试艺人')

    await avatarAction.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)

    await wrapper.get('.bookmark-btn').trigger('click')
    expect(wrapper.emitted('toggle-bookmark')).toHaveLength(1)
    expect(wrapper.emitted('click')).toHaveLength(1)
  })
})
