import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import InteractionBar from '@/components/shared/InteractionBar.vue'

describe('InteractionBar', () => {
  it('links to the supplied comment target', () => {
    const wrapper = mount(InteractionBar, {
      props: { liked: false, likeCount: 0, commentCount: 3, commentHref: '/posts/notes/note-1#comments' },
      global: {
        stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } },
      },
    })

    expect(wrapper.get('a').attributes('href')).toBe('/posts/notes/note-1#comments')
    expect(wrapper.get('a').text()).toBe('评论 3')
  })
})
