import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MediaMixedFeedSection from '@/components/media/MediaMixedFeedSection.vue'

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
    })
    expect(wrapper.findAll('[data-testid="media-mixed-item"]')).toHaveLength(5)
    expect(wrapper.get('[data-testid="media-expand-mixed"]').text()).toContain('展开')
  })
})
