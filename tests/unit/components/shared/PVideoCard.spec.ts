import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'

import PVideoCard from '@/components/shared/PVideoCard.vue'

const RouterLinkStub = defineComponent({
  name: 'RouterLink',
  props: {
    to: {
      type: [String, Object],
      required: true,
    },
  },
  setup(props, { slots }) {
    return () => h('a', { href: String(props.to) }, slots.default?.())
  },
})

describe('PVideoCard.vue', () => {
  it('degrades the watch-later affordance into non-clickable text before the feature exists', () => {
    const wrapper = mount(PVideoCard, {
      props: {
        video: {
          id: 'video-1',
          title: 'Video Title',
          thumbnail_url: '',
          view_count: 12,
          duration_sec: 90,
          created_at: '2026-01-02T00:00:00Z',
        },
      },
      global: {
        stubs: {
          RouterLink: RouterLinkStub,
        },
      },
    })

    expect(wrapper.text()).toContain('稍后看')
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.find('.vc-watch-later').element.tagName).toBe('SPAN')
  })
})
