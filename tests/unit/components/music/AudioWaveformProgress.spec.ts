import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import AudioWaveformProgress from '@/components/music/AudioWaveformProgress.vue'

describe('AudioWaveformProgress', () => {
  it('seeks from pointer position and exposes an accessible range', async () => {
    const wrapper = mount(AudioWaveformProgress, {
      props: {
        songId: 'song-1',
        audioUrl: '/song.mp3',
        currentTime: 15,
        duration: 100,
        generateWaveform: false,
      },
    })
    const root = wrapper.get('.waveform-progress')
    vi.spyOn(root.element, 'getBoundingClientRect').mockReturnValue({
      left: 10,
      width: 200,
      top: 0,
      right: 210,
      bottom: 34,
      height: 34,
      x: 10,
      y: 0,
      toJSON: () => ({}),
    })

    root.element.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 110 }))
    await nextTick()
    expect(wrapper.emitted('seek')?.[0]?.[0]).toBe(50)

    const range = wrapper.get<HTMLInputElement>('[aria-label="播放进度"]')
    expect(range.attributes('aria-valuetext')).toBe('0:15 / 1:40')
    await range.setValue(25)
    expect(wrapper.emitted('seek')?.at(-1)?.[0]).toBe(25)
  })
})
