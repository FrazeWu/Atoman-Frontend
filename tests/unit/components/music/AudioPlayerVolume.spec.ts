import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AudioPlayerVolume from '@/components/music/AudioPlayerVolume.vue'

describe('AudioPlayerVolume.vue', () => {
  it('renders volume percentage and slider', async () => {
    const wrapper = mount(AudioPlayerVolume, {
      props: {
        volume: 0.65,
      },
    })

    expect(wrapper.find('.vol-percentage').text()).toBe('65%')
    const slider = wrapper.find<HTMLInputElement>('.vol-slider')
    expect(slider.element.value).toBe('0.65')
  })

  it('emits change event when slider inputs a new value', async () => {
    const wrapper = mount(AudioPlayerVolume, {
      props: {
        volume: 0.5,
      },
    })

    const slider = wrapper.find<HTMLInputElement>('.vol-slider')
    await slider.setValue('0.8')
    expect(wrapper.emitted('change')?.[0]?.[0]).toBe(0.8)
  })

  it('emits toggle-mute when clicking volume icon', async () => {
    const wrapper = mount(AudioPlayerVolume, {
      props: {
        volume: 0.5,
      },
    })

    await wrapper.find('.vol-icon').trigger('click')
    expect(wrapper.emitted('toggle-mute')).toHaveLength(1)
  })

  it('emits change event on wheel scroll up and down', async () => {
    const wrapper = mount(AudioPlayerVolume, {
      props: {
        volume: 0.5,
      },
    })

    // Scroll up (deltaY < 0 -> +0.05)
    await wrapper.find('.volume-container').trigger('wheel', { deltaY: -100 })
    expect(wrapper.emitted('change')?.[0]?.[0]).toBe(0.55)

    // Scroll down (deltaY > 0 -> -0.05)
    await wrapper.find('.volume-container').trigger('wheel', { deltaY: 100 })
    expect(wrapper.emitted('change')?.[1]?.[0]).toBe(0.45)
  })

  it('clamps volume within 0 and 1 on wheel scroll', async () => {
    const wrapper = mount(AudioPlayerVolume, {
      props: {
        volume: 0.98,
      },
    })

    // Scroll up from 0.98 -> clamped to 1
    await wrapper.find('.volume-container').trigger('wheel', { deltaY: -100 })
    expect(wrapper.emitted('change')?.[0]?.[0]).toBe(1)

    // Lower bound test
    const wrapperLow = mount(AudioPlayerVolume, {
      props: {
        volume: 0.02,
      },
    })
    await wrapperLow.find('.volume-container').trigger('wheel', { deltaY: 100 })
    expect(wrapperLow.emitted('change')?.[0]?.[0]).toBe(0)
  })
})
