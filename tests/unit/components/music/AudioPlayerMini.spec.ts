import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AudioPlayerMini from '@/components/music/AudioPlayerMini.vue'

describe('AudioPlayerMini.vue', () => {
  it('renders cover image and handles play/pause toggle', async () => {
    const wrapper = mount(AudioPlayerMini, {
      props: {
        coverUrl: '/test-cover.jpg',
        isPlaying: false,
        miniProgressPercent: 45,
      },
    })

    const img = wrapper.find('.player-cover')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('/test-cover.jpg')

    // Click cover to toggle play
    await wrapper.find('.player-mini-cover').trigger('click')
    expect(wrapper.emitted('toggle-play')).toHaveLength(1)
  })

  it('renders fallback monogram when cover is missing', () => {
    const wrapper = mount(AudioPlayerMini, {
      props: {
        coverFallback: 'M',
        isPlaying: true,
        miniProgressPercent: 80,
      },
    })

    expect(wrapper.find('.player-cover-fallback').text()).toBe('M')
    expect(wrapper.find('.player-mini-play-overlay').exists()).toBe(false)
  })

  it('emits expand event when clicking expand button', async () => {
    const wrapper = mount(AudioPlayerMini, {
      props: {
        isPlaying: false,
        miniProgressPercent: 10,
      },
    })

    await wrapper.find('.player-mini-expand').trigger('click')
    expect(wrapper.emitted('expand')).toHaveLength(1)
  })

  it('updates SVG progress ring strokeDashoffset correctly', () => {
    const wrapper = mount(AudioPlayerMini, {
      props: {
        isPlaying: true,
        miniProgressPercent: 30,
      },
    })

    const ring = wrapper.find('.player-mini-progress-ring__value')
    expect(ring.attributes('style')).toContain('stroke-dashoffset: 70')
  })

  it('renders track info tooltip and only retains play/pause and expand controls', async () => {
    const wrapper = mount(AudioPlayerMini, {
      props: {
        coverUrl: '/test-cover.jpg',
        songTitle: 'Test Track Title',
        artistText: 'Test Artist',
        isPlaying: true,
        miniProgressPercent: 50,
      },
    })

    const tooltip = wrapper.find('.player-mini-tooltip')
    expect(tooltip.exists()).toBe(true)
    expect(tooltip.find('.player-mini-tooltip__title').text()).toBe('Test Track Title')
    expect(tooltip.find('.player-mini-tooltip__artist').text()).toBe('Test Artist')

    // Verify only play/pause cover and expand button exist; no extra skip controls
    expect(wrapper.find('.player-mini-skip-btn--prev').exists()).toBe(false)
    expect(wrapper.find('.player-mini-skip-btn--next').exists()).toBe(false)
    expect(wrapper.find('.player-mini-expand').exists()).toBe(true)
    expect(wrapper.find('.player-mini-cover').exists()).toBe(true)

    // Double click cover
    await wrapper.find('.player-mini-cover').trigger('dblclick')
    expect(wrapper.emitted('open-lyrics')).toHaveLength(1)
  })
})
