import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AudioPlayerPlaylistPopover from '@/components/music/AudioPlayerPlaylistPopover.vue'

describe('AudioPlayerPlaylistPopover.vue', () => {
  it('renders trigger button and emits trigger-click', async () => {
    const wrapper = mount(AudioPlayerPlaylistPopover, {
      props: {
        currentSongId: 'song-123',
        isPodcast: false,
        playlists: [
          { id: 'p1', name: '我的最爱' },
          { id: 'p2', name: '轻音乐' },
        ],
      },
    })

    const trigger = wrapper.find('.player-add-btn')
    expect(trigger.exists()).toBe(true)
    await trigger.trigger('click')
    expect(wrapper.emitted('trigger-click')).toHaveLength(1)
  })

  it('does not render for podcast or when currentSongId is absent', () => {
    const podcastWrapper = mount(AudioPlayerPlaylistPopover, {
      props: {
        currentSongId: 'song-123',
        isPodcast: true,
        playlists: [],
      },
    })
    expect(podcastWrapper.find('.player-add-btn').exists()).toBe(false)

    const noSongWrapper = mount(AudioPlayerPlaylistPopover, {
      props: {
        isPodcast: false,
        playlists: [],
      },
    })
    expect(noSongWrapper.find('.player-add-btn').exists()).toBe(false)
  })
})
