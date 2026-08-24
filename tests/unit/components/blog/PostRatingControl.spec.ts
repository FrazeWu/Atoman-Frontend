import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PostRatingControl from '@/components/blog/PostRatingControl.vue'

describe('PostRatingControl.vue', () => {
  it('renders rating summary correctly', () => {
    const wrapper = mount(PostRatingControl, {
      props: {
        ratingScore: 7.8,
        ratingCount: 15,
      },
    })

    expect(wrapper.text()).toContain('7.8')
    expect(wrapper.text()).toContain('(15)')
    expect(wrapper.find('.post-rating__guidelines-popover').exists()).toBe(true)
    expect(wrapper.text()).toContain('6 分及格线')
  })

  it('shows hover score dynamically when hovering on half stars', async () => {
    const wrapper = mount(PostRatingControl, {
      props: {
        ratingScore: 6.0,
        ratingCount: 5,
      },
    })

    // Find the 4th star right half (8 points)
    const rightHalves = wrapper.findAll('.post-rating__half--right')
    expect(rightHalves.length).toBe(5)

    await rightHalves[3].trigger('mouseenter')
    expect(wrapper.find('.post-rating__dynamic-score').text()).toBe('8 分')

    await wrapper.find('.post-rating__control').trigger('mouseleave')
    expect(wrapper.find('.post-rating__dynamic-score').exists()).toBe(false)
  })

  it('emits rate event when clicking on a star half', async () => {
    const wrapper = mount(PostRatingControl, {
      props: {
        ratingScore: 0,
        ratingCount: 0,
      },
    })

    const leftHalves = wrapper.findAll('.post-rating__half--left')
    // Click 3rd star left half -> 5 points
    await leftHalves[2].trigger('click')

    expect(wrapper.emitted('rate')).toBeTruthy()
    expect(wrapper.emitted('rate')![0]).toEqual([5])
  })

  it('emits clear event when clicking clear button', async () => {
    const wrapper = mount(PostRatingControl, {
      props: {
        ratingScore: 8.0,
        ratingCount: 1,
        viewerRating: 8,
      },
    })

    expect(wrapper.text()).toContain('我的评分 8')
    const clearBtn = wrapper.find('.post-rating__clear')
    expect(clearBtn.exists()).toBe(true)

    await clearBtn.trigger('click')
    expect(wrapper.emitted('clear')).toBeTruthy()
  })

  it('contains rating guidelines with 6-point pass baseline', () => {
    const wrapper = mount(PostRatingControl)
    const popover = wrapper.find('.post-rating__guidelines-popover')
    expect(popover.text()).toContain('力荐')
    expect(popover.text()).toContain('推荐')
    expect(popover.text()).toContain('及格 / 还行')
    expect(popover.text()).toContain('一般')
    expect(popover.text()).toContain('较差')
  })
})
