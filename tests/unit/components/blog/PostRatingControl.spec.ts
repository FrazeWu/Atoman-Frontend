import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import PostRatingControl from '@/components/blog/PostRatingControl.vue'

describe('PostRatingControl.vue', () => {
  it('uses the raw public score and the shared five-rating threshold', () => {
    const wrapper = mount(PostRatingControl, {
      props: { ratingScore: 8.6, ratingCount: 5 },
    })

    expect(wrapper.get('.rating-control__public-score').text()).toBe('8.6 / 10')
    expect(wrapper.text()).toContain('5 人')
  })

  it('forwards half-star ratings and clear actions', async () => {
    const wrapper = mount(PostRatingControl, {
      props: { viewerRating: 9 },
    })

    await wrapper.get('button[data-score="7"]').trigger('click')
    await wrapper.get('.rating-control__clear').trigger('click')

    expect(wrapper.emitted('rate')).toEqual([[7]])
    expect(wrapper.emitted('clear')).toEqual([[]])
  })

  it('forwards loading and error states', () => {
    const wrapper = mount(PostRatingControl, {
      props: { loading: true, errorMessage: '评分未保存，请重试' },
    })

    expect(wrapper.get('button[data-score="10"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.rating-control__error').attributes('role')).toBe('alert')
  })
})
