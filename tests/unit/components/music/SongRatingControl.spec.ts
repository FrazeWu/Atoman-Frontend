import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import SongRatingControl from '@/components/music/SongRatingControl.vue'

describe('SongRatingControl.vue', () => {
  it('uses the shared ten-point public score and threshold', () => {
    const wrapper = mount(SongRatingControl, {
      props: { songTitle: '示例歌曲', ratingScore: 7.5, ratingCount: 5 },
    })

    expect(wrapper.get('.rating-control__public-score').text()).toBe('7.5 / 10')
  })

  it('submits half-star scores instead of five-point whole stars', async () => {
    const wrapper = mount(SongRatingControl, {
      props: { songTitle: '示例歌曲' },
    })

    await wrapper.get('button[data-score="9"]').trigger('click')

    expect(wrapper.emitted('rate')).toEqual([[9]])
  })

  it('shows the saved personal rating and forwards the clear action', async () => {
    const wrapper = mount(SongRatingControl, {
      props: { songTitle: '示例歌曲', viewerRating: 8 },
    })

    await wrapper.get('.rating-control__clear').trigger('click')

    expect(wrapper.get('.rating-control__mine').text()).toContain('我的评分：8/10 · 4.0 星（已保存）')
    expect(wrapper.emitted('clear')).toEqual([[]])
  })

  it('allows clicking half-star score targets in compact mode to submit rating', async () => {
    const wrapper = mount(SongRatingControl, {
      props: { songTitle: '示例歌曲', size: 'compact' },
    })

    const target = wrapper.get('button[data-score="8"]')
    expect(target.attributes('aria-label')).toBe('8 分，4.0 星')
    await target.trigger('click')

    expect(wrapper.emitted('rate')).toEqual([[8]])
  })
})
