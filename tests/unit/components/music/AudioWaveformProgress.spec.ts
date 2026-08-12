import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import AudioWaveformProgress from '@/components/music/AudioWaveformProgress.vue'
afterEach(() => {
  vi.unstubAllGlobals()
})

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

  it('renders stored peaks as separate bars without loading the audio file', () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const wrapper = mount(AudioWaveformProgress, {
      props: {
        songId: 'loud-song',
        audioUrl: '/loud-song.mp3',
        currentTime: 20,
        duration: 100,
        waveformPeaks: Array.from({ length: 280 }, () => 100),
      },
    })

    const path = wrapper.get('.waveform-shape__unplayed').attributes('d')
    expect(path.match(/M /g)).toHaveLength(280)
    expect(path).not.toContain('Z')
    expect(fetch).not.toHaveBeenCalled()
  })
})
