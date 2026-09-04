import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import RatingControl from '@/components/shared/RatingControl.vue'

describe('RatingControl.vue', () => {
  it('shows a public ten-point average from the fifth rating onward', () => {
    const wrapper = mount(RatingControl, {
      props: { ratingScore: 8.6, ratingCount: 5 },
    })

    expect(wrapper.get('.rating-control__public-score').text()).toBe('8.6 / 10')
    expect(wrapper.text()).toContain('5 人')
  })

  it('hides the average and explains the threshold below five ratings', () => {
    const wrapper = mount(RatingControl, {
      props: { ratingScore: 10, ratingCount: 4 },
    })

    expect(wrapper.find('.rating-control__public-score').exists()).toBe(false)
    expect(wrapper.text()).toContain('评分人数不足（4/5）')
  })

  it('emits integer ten-point scores from half-star targets', async () => {
    const wrapper = mount(RatingControl)
    const scoreNine = wrapper.get('button[data-score="9"]')

    expect(wrapper.findAll('.rating-control__score-target')).toHaveLength(10)
    expect(scoreNine.attributes('aria-label')).toBe('9 分，4.5 星')
    await scoreNine.trigger('click')

    expect(wrapper.emitted('rate')).toEqual([[9]])
  })

  it('moves one point at a time with the keyboard', async () => {
    const wrapper = mount(RatingControl)

    await wrapper.get('button[data-score="8"]').trigger('keydown', { key: 'ArrowRight' })

    expect(wrapper.emitted('rate')).toEqual([[9]])
  })

  it('keeps the personal score visible and allows clearing it', async () => {
    const wrapper = mount(RatingControl, {
      props: { viewerRating: 9 },
    })

    expect(wrapper.get('.rating-control__mine').text()).toContain('我的评分 9/10 · 4.5 星')
    await wrapper.get('.rating-control__clear').trigger('click')

    expect(wrapper.emitted('clear')).toEqual([[]])
  })

  it('announces save errors beside the control', () => {
    const wrapper = mount(RatingControl, {
      props: { errorMessage: '评分未保存，请重试' },
    })

    expect(wrapper.get('.rating-control__error').attributes('role')).toBe('alert')
  })
})
