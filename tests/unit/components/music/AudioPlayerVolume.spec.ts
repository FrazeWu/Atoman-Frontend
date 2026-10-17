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
})
