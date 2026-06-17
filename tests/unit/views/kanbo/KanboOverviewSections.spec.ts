import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import KanboMixedFeedSection from '@/components/kanbo/KanboMixedFeedSection.vue'

describe('KanboMixedFeedSection', () => {
  it('shows exactly five items by default and an expand button', () => {
    const wrapper = mount(KanboMixedFeedSection, {
      props: {
        items: Array.from({ length: 8 }).map((_, index) => ({
          id: `item-${index}`,
          title: `Item ${index}`,
          type: index % 2 === 0 ? 'article' : 'podcast',
          updated_at: '2026-06-03T00:00:00Z',
        })),
      },
    })
    expect(wrapper.findAll('[data-testid="kanbo-mixed-item"]')).toHaveLength(5)
    expect(wrapper.get('[data-testid="kanbo-expand-mixed"]').text()).toContain('展开')
  })
})
