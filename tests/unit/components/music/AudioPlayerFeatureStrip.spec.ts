import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AudioPlayerFeatureStrip from '@/components/music/player/AudioPlayerFeatureStrip.vue'
import AudioPlayerVolume from '@/components/music/AudioPlayerVolume.vue'

describe('AudioPlayerFeatureStrip', () => {
  const defaultProps = {
    featureLabel: '词',
    volume: 0.7,
    showQueue: false,
    queueCount: 3,
  }

  it('renders all feature buttons and volume component properly', () => {
    const wrapper = mount(AudioPlayerFeatureStrip, {
      props: defaultProps,
    })

    expect(wrapper.find('.player-features').exists()).toBe(true)

    // Feature links: lyrics and comments
    const featureLinks = wrapper.findAll('.feature-link')
    expect(featureLinks.length).toBe(2)

    // Lyrics button
    const lyricsBtn = featureLinks[0]
    expect(lyricsBtn.text()).toBe('词')
    expect(lyricsBtn.attributes('aria-label')).toBe('歌词')
    expect(lyricsBtn.attributes('title')).toBe('歌词')
    expect(lyricsBtn.attributes('data-hint')).toBe('歌词 (Shift+F)')

    // Comments button
    const commentsBtn = featureLinks[1]
    expect(commentsBtn.text()).toBe('评')
    expect(commentsBtn.attributes('aria-label')).toBe('评论')
    expect(commentsBtn.attributes('title')).toBe('评论')

    // Volume component
    const volumeComp = wrapper.findComponent(AudioPlayerVolume)
    expect(volumeComp.exists()).toBe(true)
    expect(volumeComp.props('volume')).toBe(0.7)

    // Queue trigger button
    const queueTrigger = wrapper.find('.queue-trigger')
    expect(queueTrigger.exists()).toBe(true)
    expect(queueTrigger.attributes('aria-label')).toBe('播放队列')
    expect(queueTrigger.attributes('title')).toBe('播放队列')
    expect(queueTrigger.classes()).not.toContain('active')
    expect(queueTrigger.find('.queue-count').text()).toBe('3')
  })

  it('renders different featureLabel and 0 queue count', () => {
    const wrapper = mount(AudioPlayerFeatureStrip, {
      props: {
        featureLabel: '文',
        volume: 0,
        showQueue: false,
        queueCount: 0,
      },
    })

    expect(wrapper.findAll('.feature-link')[0].text()).toBe('文')
    expect(wrapper.find('.queue-count').text()).toBe('0')
  })

  it('renders podcast labels on feature link when isPodcast is true', () => {
    const wrapper = mount(AudioPlayerFeatureStrip, {
      props: {
        ...defaultProps,
        isPodcast: true,
        featureLabel: '说明',
      },
    })

    const featureBtn = wrapper.findAll('.feature-link')[0]
    expect(featureBtn.text()).toBe('说明')
    expect(featureBtn.attributes('aria-label')).toBe('节目说明')
    expect(featureBtn.attributes('title')).toBe('节目说明')
    expect(featureBtn.attributes('data-hint')).toBe('说明 (Shift+F)')
  })

  it('adds active class to queue trigger when showQueue is true', () => {
    const wrapper = mount(AudioPlayerFeatureStrip, {
      props: {
        ...defaultProps,
        showQueue: true,
      },
    })

    const queueTrigger = wrapper.find('.queue-trigger')
    expect(queueTrigger.classes()).toContain('active')
  })

  it('emits toggle-lyrics when clicking lyrics button', async () => {
    const wrapper = mount(AudioPlayerFeatureStrip, {
      props: defaultProps,
    })

    const lyricsBtn = wrapper.findAll('.feature-link')[0]
    await lyricsBtn.trigger('click')

    expect(wrapper.emitted('toggle-lyrics')).toHaveLength(1)
  })

  it('emits open-comments when clicking comments button', async () => {
    const wrapper = mount(AudioPlayerFeatureStrip, {
      props: defaultProps,
    })

    const commentsBtn = wrapper.findAll('.feature-link')[1]
    await commentsBtn.trigger('click')

    expect(wrapper.emitted('open-comments')).toHaveLength(1)
  })

  it('emits toggle-queue when clicking queue trigger button', async () => {
    const wrapper = mount(AudioPlayerFeatureStrip, {
      props: defaultProps,
    })

    const queueTrigger = wrapper.find('.queue-trigger')
    await queueTrigger.trigger('click')

    expect(wrapper.emitted('toggle-queue')).toHaveLength(1)
  })

  it('forwards volume change and toggle-mute events from AudioPlayerVolume', async () => {
    const wrapper = mount(AudioPlayerFeatureStrip, {
      props: defaultProps,
    })

    const volumeComp = wrapper.findComponent(AudioPlayerVolume)

    // Emit change event from volume component
    await volumeComp.vm.$emit('change', 0.85)
    expect(wrapper.emitted('set-volume')).toEqual([[0.85]])

    // Emit toggle-mute event from volume component
    await volumeComp.vm.$emit('toggle-mute')
    expect(wrapper.emitted('toggle-mute')).toHaveLength(1)
  })
})
