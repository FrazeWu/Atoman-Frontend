import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import VideoPlayerControls from '@/components/video/VideoPlayerControls.vue'

function createVideoElement() {
  const video = document.createElement('video')
  Object.defineProperty(video, 'duration', { value: 120, configurable: true })
  video.volume = 1
  video.playbackRate = 1
  return video
}

describe('VideoPlayerControls', () => {
  it('renders bilibili-like utility controls', () => {
    const wrapper = mount(VideoPlayerControls, {
      props: {
        videoElement: createVideoElement(),
        durationSec: 120,
      },
    })

    expect(wrapper.find('[data-control="quality"]').text()).toBe('1080P 高清')
    expect(wrapper.find('[data-control="subtitle"]').text()).toBe('字幕')
    expect(wrapper.find('[data-control="settings"]').text()).toBe('设置')
  })

  it('updates video playback rate from speed menu', async () => {
    const video = createVideoElement()
    const wrapper = mount(VideoPlayerControls, {
      props: {
        videoElement: video,
        durationSec: 120,
      },
    })

    await wrapper.find('.vpc-speed-trigger').trigger('click')
    await wrapper.find('[data-speed="1.5"]').trigger('click')

    expect(video.playbackRate).toBe(1.5)
    expect(wrapper.find('.vpc-speed-trigger').text()).toBe('1.5x')
  })
})
