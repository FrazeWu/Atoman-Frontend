import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import VideoPlayerControls from '@/components/video/VideoPlayerControls.vue'

describe('VideoPlayerControls', () => {
  it('renders volume icon and progress timeline properly', () => {
    const wrapper = mount(VideoPlayerControls, {
      props: {
        videoElement: null,
        durationSec: 120
      }
    })

    expect(wrapper.find('.vpc-timeline').exists()).toBe(true)
    expect(wrapper.find('.vpc-progress').exists()).toBe(true)
    expect(wrapper.find('.vpc-scrubber-handle').exists()).toBe(true)
    expect(wrapper.find('.vpc-volume-wrap').exists()).toBe(true)
  })
})
