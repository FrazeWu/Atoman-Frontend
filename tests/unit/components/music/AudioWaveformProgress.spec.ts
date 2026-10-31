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
    expect(wrapper.get('[data-testid="waveform-duration"]').text()).toBe('0:15 / 1:40')
    await range.setValue(25)
    expect(wrapper.emitted('seek')?.at(-1)?.[0]).toBe(25)
  })

  it('formats hours correctly for long audio exceeding one hour', () => {
    const wrapper = mount(AudioWaveformProgress, {
      props: {
        songId: 'podcast-long',
        audioUrl: '/podcast.mp3',
        currentTime: 3665, // 1h 1m 5s
        duration: 5400,    // 1h 30m 0s
        generateWaveform: false,
      },
    })

    const durationText = wrapper.get('[data-testid="waveform-duration"]').text()
    expect(durationText).toBe('1:01:05 / 1:30:00')
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

  it('throttles seeks during dragging and emits final seek on pointerup', async () => {
    const wrapper = mount(AudioWaveformProgress, {
      props: {
        songId: 'seek-drag-song',
        audioUrl: '/seek.mp3',
        currentTime: 10,
        duration: 100,
        generateWaveform: false,
      },
    })
    const root = wrapper.get('.waveform-progress')
    vi.spyOn(root.element, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      width: 100,
      top: 0,
      right: 100,
      bottom: 34,
      height: 34,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    // Pointerdown starts seek at 20%
    root.element.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 20 }))
    await nextTick()
    expect(wrapper.emitted('seek')).toHaveLength(1)
    expect(wrapper.emitted('seek')?.[0]?.[0]).toBe(20)

    // Moving pointer during drag updates visual without emitting new seeks
    root.element.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 40 }))
    root.element.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 60 }))
    await nextTick()
    expect(wrapper.emitted('seek')).toHaveLength(1)

    // Pointerup commits final seek at 60%
    root.element.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 60 }))
    await nextTick()
    expect(wrapper.emitted('seek')).toHaveLength(2)
    expect(wrapper.emitted('seek')?.[1]?.[0]).toBe(60)
  })

  it('does not emit duplicate seek on click (pointerdown followed by pointerup at same position)', async () => {
    const wrapper = mount(AudioWaveformProgress, {
      props: {
        songId: 'click-song',
        audioUrl: '/click.mp3',
        currentTime: 0,
        duration: 100,
        generateWaveform: false,
      },
    })
    const root = wrapper.get('.waveform-progress')
    vi.spyOn(root.element, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      width: 100,
      top: 0,
      right: 100,
      bottom: 34,
      height: 34,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    // User clicks at 40% (pointerdown then pointerup at clientX: 40)
    root.element.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 40 }))
    await nextTick()
    root.element.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 40 }))
    await nextTick()

    // Must only emit seek ONCE, never twice!
    expect(wrapper.emitted('seek')).toHaveLength(1)
    expect(wrapper.emitted('seek')?.[0]?.[0]).toBe(40)
  })

  it('renders waveform buffer path with clip-path matching buffered ratio', () => {
    const wrapper = mount(AudioWaveformProgress, {
      props: {
        songId: 'buffer-song',
        audioUrl: '/buffer.mp3',
        currentTime: 20,
        bufferedTime: 60,
        duration: 100,
        waveformPeaks: Array.from({ length: 280 }, () => 100),
      },
    })

    const bufferedPath = wrapper.find('.waveform-shape__buffered')
    expect(bufferedPath.exists()).toBe(true)
    expect(bufferedPath.attributes('style')).toContain('clip-path: inset(0 40% 0 0)')
  })

  it('activates hover states and applies smooth clamp tooltip on pointer move', async () => {
    const wrapper = mount(AudioWaveformProgress, {
      props: {
        songId: 'hover-song',
        audioUrl: '/hover.mp3',
        currentTime: 20,
        duration: 100,
        generateWaveform: false,
      },
    })
    const root = wrapper.get('.waveform-progress')
    vi.spyOn(root.element, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      width: 200,
      top: 0,
      right: 200,
      bottom: 34,
      height: 34,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    // Pointer move at 10px (5% - near start boundary)
    root.element.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 10 }))
    await nextTick()

    expect(root.classes()).toContain('is-hovering')
    const hoverTooltip = wrapper.find('.waveform-time--hover')
    expect(hoverTooltip.exists()).toBe(true)
    expect(hoverTooltip.attributes('data-hover-ratio')).toBe('0.05')
    expect(hoverTooltip.text()).toBe('0:05')
    expect(wrapper.get('.waveform-track').attributes('style')).toContain('--waveform-time-pad: 24px')

    // Pointer move to center 100px (50%)
    root.element.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 100 }))
    await nextTick()
    expect(hoverTooltip.attributes('data-hover-ratio')).toBe('0.5')
    expect(hoverTooltip.text()).toBe('0:50')

    // Pointer leave removes hover states
    root.element.dispatchEvent(new MouseEvent('pointerleave', { bubbles: true }))
    await nextTick()
    expect(root.classes()).not.toContain('is-hovering')
    expect(wrapper.find('.waveform-time--hover').exists()).toBe(false)
  })

  it('adjusts clamp padding for long audio exceeding one hour', async () => {
    const wrapper = mount(AudioWaveformProgress, {
      props: {
        songId: 'long-song',
        audioUrl: '/long.mp3',
        currentTime: 0,
        duration: 4000,
        generateWaveform: false,
      },
    })
    expect(wrapper.get('.waveform-track').attributes('style')).toContain('--waveform-time-pad: 32px')
  })
})
