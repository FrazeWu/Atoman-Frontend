import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AudioPlayerControlsHub from '@/components/music/player/AudioPlayerControlsHub.vue'

describe('AudioPlayerControlsHub', () => {
  const defaultProps = {
    isPlaying: false,
    playbackError: null,
    isPodcast: false,
    playbackRate: 1,
    playbackMode: 'loop' as const,
  }

  it('renders default music controls correctly (play state, nav buttons, mode button)', () => {
    const wrapper = mount(AudioPlayerControlsHub, {
      props: defaultProps,
    })

    expect(wrapper.find('.player-controls-hub').exists()).toBe(true)
    expect(wrapper.find('.ctrl-row').exists()).toBe(true)

    // Nav buttons
    const navButtons = wrapper.findAll('.nav-btn')
    expect(navButtons.length).toBe(2)
    expect(navButtons[0].text()).toBe('上一首')
    expect(navButtons[1].text()).toBe('下一首')

    // Main play button in paused state
    const mainBtn = wrapper.find('.main-play-btn')
    expect(mainBtn.exists()).toBe(true)
    expect(mainBtn.text()).toBe('播放')
    expect(mainBtn.classes()).not.toContain('has-error')
    expect(mainBtn.attributes('aria-label')).toBe('播放')
    expect(mainBtn.attributes('title')).toBe('播放')
    expect(mainBtn.attributes('data-hint')).toBe('播放 (Space)')

    // Podcast controls should NOT exist in music mode
    expect(wrapper.findAll('.skip-btn').length).toBe(0)
    expect(wrapper.find('.player-rate-btn').exists()).toBe(false)

    // Mode button should exist
    expect(wrapper.find('.player-mode-btn').exists()).toBe(true)
  })

  it('renders pause state and emits toggle-play when clicked', async () => {
    const wrapper = mount(AudioPlayerControlsHub, {
      props: {
        ...defaultProps,
        isPlaying: true,
      },
    })

    const mainBtn = wrapper.find('.main-play-btn')
    expect(mainBtn.text()).toBe('暂停')
    expect(mainBtn.attributes('aria-label')).toBe('暂停')
    expect(mainBtn.attributes('title')).toBe('暂停')
    expect(mainBtn.attributes('data-hint')).toBe('暂停 (Space)')

    await mainBtn.trigger('click')
    expect(wrapper.emitted('toggle-play')).toHaveLength(1)
    expect(wrapper.emitted('retry-playback')).toBeUndefined()
  })

  it('renders error state and emits retry-playback instead of toggle-play', async () => {
    const wrapper = mount(AudioPlayerControlsHub, {
      props: {
        ...defaultProps,
        isPlaying: false,
        playbackError: 'MEDIA_ELEMENT_ERROR: 4',
      },
    })

    const mainBtn = wrapper.find('.main-play-btn')
    expect(mainBtn.classes()).toContain('has-error')
    expect(mainBtn.text()).toBe('重试')
    expect(mainBtn.attributes('aria-label')).toBe('重试播放')
    expect(mainBtn.attributes('title')).toBe('音频加载失败，点击重试')
    expect(mainBtn.attributes('data-hint')).toBe('重试')

    await mainBtn.trigger('click')
    expect(wrapper.emitted('retry-playback')).toHaveLength(1)
    expect(wrapper.emitted('toggle-play')).toBeUndefined()
  })

  it('emits play-previous and play-next when clicking nav buttons', async () => {
    const wrapper = mount(AudioPlayerControlsHub, {
      props: defaultProps,
    })

    const navButtons = wrapper.findAll('.nav-btn')
    await navButtons[0].trigger('click')
    expect(wrapper.emitted('play-previous')).toHaveLength(1)

    await navButtons[1].trigger('click')
    expect(wrapper.emitted('play-next')).toHaveLength(1)
  })

  it('renders podcast controls when isPodcast is true and emits skip and cycle-rate', async () => {
    const wrapper = mount(AudioPlayerControlsHub, {
      props: {
        ...defaultProps,
        isPodcast: true,
        playbackRate: 1.5,
      },
    })

    // Skip buttons
    const skipButtons = wrapper.findAll('.skip-btn')
    expect(skipButtons.length).toBe(2)
    expect(skipButtons[0].text()).toBe('-15S')
    expect(skipButtons[0].attributes('aria-label')).toBe('后退 15 秒')
    expect(skipButtons[1].text()).toBe('+15S')
    expect(skipButtons[1].attributes('aria-label')).toBe('前进 15 秒')

    await skipButtons[0].trigger('click')
    expect(wrapper.emitted('skip')?.[0]).toEqual([-15])

    await skipButtons[1].trigger('click')
    expect(wrapper.emitted('skip')?.[1]).toEqual([15])

    // Rate button
    const rateBtn = wrapper.find('.player-rate-btn')
    expect(rateBtn.exists()).toBe(true)
    expect(rateBtn.text()).toBe('1.5x')
    expect(rateBtn.attributes('title')).toBe('倍速播放 (1.5x)')
    expect(rateBtn.attributes('data-hint')).toBe('倍速 1.5x')

    await rateBtn.trigger('click')
    expect(wrapper.emitted('cycle-rate')).toHaveLength(1)

    // Mode button should not exist in podcast mode
    expect(wrapper.find('.player-mode-btn').exists()).toBe(false)
  })

  it('renders playback modes correctly and emits cycle-mode', async () => {
    // Mode: loop
    const wrapperLoop = mount(AudioPlayerControlsHub, {
      props: {
        ...defaultProps,
        playbackMode: 'loop',
      },
    })
    expect(wrapperLoop.find('.repeat-one-wrapper').exists()).toBe(false)
    const modeBtn = wrapperLoop.find('.player-mode-btn')
    expect(modeBtn.exists()).toBe(true)

    await modeBtn.trigger('click')
    expect(wrapperLoop.emitted('cycle-mode')).toHaveLength(1)

    // Mode: single (should show repeat-one-wrapper and one-badge)
    const wrapperSingle = mount(AudioPlayerControlsHub, {
      props: {
        ...defaultProps,
        playbackMode: 'single',
      },
    })
    expect(wrapperSingle.find('.repeat-one-wrapper').exists()).toBe(true)
    expect(wrapperSingle.find('.one-badge').text()).toBe('1')

    // Mode: random
    const wrapperRandom = mount(AudioPlayerControlsHub, {
      props: {
        ...defaultProps,
        playbackMode: 'random',
      },
    })
    expect(wrapperRandom.find('.repeat-one-wrapper').exists()).toBe(false)
    expect(wrapperRandom.find('.player-mode-btn').exists()).toBe(true)
  })
})
