import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import VideoRecommendationRow from '@/components/video/VideoRecommendationRow.vue'

describe('VideoRecommendationRow', () => {
  it('uses a generated preview when the published cover is missing', () => {
    const wrapper = mount(VideoRecommendationRow, {
      props: {
        videos: [{
          id: 'video-1',
          title: '推荐视频',
          thumbnail_url: '',
          preview_thumbnails: [{ time_sec: 0, url: '/generated/cover.webp', width: 160, height: 90 }],
        } as never],
      },
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    })

    expect(wrapper.find('img').attributes('src')).toContain('/generated/cover.webp')
  })
})
