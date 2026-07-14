import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MediaMixedFeedSection from '@/components/media/MediaMixedFeedSection.vue'
import MediaVideoCardSection from '@/components/media/MediaVideoCardSection.vue'
import { modulePathUrl } from '@/router/siteUrls'

const RouterLinkStub = defineComponent({
  name: 'RouterLink',
  props: {
    to: {
      type: [String, Object],
      required: true,
    },
  },
  template: '<a :href="typeof to === \'string\' ? to : String(to)"><slot /></a>',
})

describe('MediaMixedFeedSection', () => {
  it('shows exactly five items by default and an expand button', () => {
    const wrapper = mount(MediaMixedFeedSection, {
      props: {
        items: Array.from({ length: 8 }).map((_, index) => ({
          id: `item-${index}`,
          title: `Item ${index}`,
          type: index % 2 === 0 ? 'article' : 'podcast',
          updated_at: '2026-06-03T00:00:00Z',
        })),
      },
      global: {
        stubs: {
          RouterLink: RouterLinkStub,
        },
      },
    })
    expect(wrapper.findAll('[data-testid="media-mixed-item"]')).toHaveLength(5)
    expect(wrapper.get('[data-testid="media-expand-mixed"]').text()).toContain('展开')
  })

  it('routes article and podcast overview items to real detail entries', () => {
    const wrapper = mount(MediaMixedFeedSection, {
      props: {
        items: [
          {
            id: 'post-1',
            title: 'Article 1',
            type: 'article',
            updated_at: '2026-06-03T00:00:00Z',
          },
          {
            id: 'episode-1',
            title: 'Episode 1',
            type: 'podcast',
            updated_at: '2026-06-02T00:00:00Z',
          },
        ],
      },
      global: {
        stubs: {
          RouterLink: RouterLinkStub,
        },
      },
    })

    const links = wrapper.findAll('a')
    expect(links).toHaveLength(2)
    expect(links[0]?.attributes('href')).toBe('/posts/post/post-1')
    expect(links[1]?.attributes('href')).toBe(modulePathUrl('media', '/podcasts/episode/episode-1'))
  })
})

describe('MediaVideoCardSection', () => {
  it('routes each video overview card to the watch route', () => {
    const wrapper = mount(MediaVideoCardSection, {
      props: {
        items: [
          {
            id: 'video-1',
            title: 'Video 1',
            updated_at: '2026-06-03T00:00:00Z',
          },
        ],
      },
      global: {
        stubs: {
          RouterLink: RouterLinkStub,
        },
      },
    })

    expect(wrapper.get('a').attributes('href')).toBe(modulePathUrl('media', '/videos/watch/video-1'))
  })
})
