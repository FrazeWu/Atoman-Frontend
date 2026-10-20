import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import AudioPlayerTrackInfo from '@/components/music/player/AudioPlayerTrackInfo.vue'

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/music/song/:id', component: { template: '<div />' } },
    ],
  })
}

describe('AudioPlayerTrackInfo', () => {
  const defaultProps = {
    currentSong: {
      id: 'song-101',
      title: 'Midnight City',
      artist: 'M83',
      album: "Hurry Up, We're Dreaming",
      album_id: 'album-99',
      cover_url: 'https://example.com/cover.jpg',
      artists: [{ id: 1, name: 'M83' }],
    } as any,
    isPodcast: false,
    isPodcastEpisode: false,
    isMetaCollapsed: false,
    coverFallback: 'M',
    artistText: 'M83',
    favoriteSongIds: new Set<string>(['song-101']),
    playlists: [],
    playlistLoadError: '',
  }

  it('renders track cover, title link, artist, and favorite status', () => {
    const wrapper = mount(AudioPlayerTrackInfo, {
      props: defaultProps,
      global: {
        plugins: [createTestRouter()],
        stubs: {
          AudioPlayerPlaylistPopover: true,
        },
      },
    })

    expect(wrapper.find('.player-info').exists()).toBe(true)
    expect(wrapper.find('.player-cover').attributes('src')).toBe('https://example.com/cover.jpg')
    expect(wrapper.find('.player-title').text()).toBe('Midnight City')
    expect(wrapper.find('.player-artist').text()).toContain('M83')
    expect(wrapper.find('.player-fav-btn').classes()).toContain('is-active')
  })

  it('emits toggle-lyrics when clicking cover', async () => {
    const wrapper = mount(AudioPlayerTrackInfo, {
      props: defaultProps,
      global: {
        plugins: [createTestRouter()],
        stubs: { AudioPlayerPlaylistPopover: true },
      },
    })

    await wrapper.find('.cover-wrap').trigger('click')
    expect(wrapper.emitted('toggle-lyrics')).toBeTruthy()
  })

  it('emits toggle-favorite when clicking heart button', async () => {
    const wrapper = mount(AudioPlayerTrackInfo, {
      props: defaultProps,
      global: {
        plugins: [createTestRouter()],
        stubs: { AudioPlayerPlaylistPopover: true },
      },
    })

    await wrapper.find('.player-fav-btn').trigger('click')
    expect(wrapper.emitted('toggle-favorite')?.[0]).toEqual(['song-101'])
  })

  it('renders podcast action buttons when isPodcastEpisode is true', () => {
    const wrapper = mount(AudioPlayerTrackInfo, {
      props: {
        ...defaultProps,
        isPodcast: true,
        isPodcastEpisode: true,
        currentSong: {
          id: 'podcast:1',
          title: 'Podcast Ep 1',
          source_id: 'ep-1',
        } as any,
      },
      global: {
        plugins: [createTestRouter()],
        stubs: { AudioPlayerPlaylistPopover: true },
      },
    })

    expect(wrapper.find('button[title="收藏单集"]').exists()).toBe(true)
    expect(wrapper.find('button[title="稍后听"]').exists()).toBe(true)
  })

  it('emits open-artist and open-album when clicking artist/album buttons', async () => {
    const wrapper = mount(AudioPlayerTrackInfo, {
      props: defaultProps,
      global: {
        plugins: [createTestRouter()],
        stubs: { AudioPlayerPlaylistPopover: true },
      },
    })

    const buttons = wrapper.findAll('.player-artist button')
    expect(buttons.length).toBe(2)

    await buttons[0].trigger('click')
    expect(wrapper.emitted('open-artist')?.[0]).toEqual(['1'])

    await buttons[1].trigger('click')
    expect(wrapper.emitted('open-album')?.[0]).toEqual(['album-99'])
  })

  it('renders fallback cover when cover_url is missing', () => {
    const wrapper = mount(AudioPlayerTrackInfo, {
      props: {
        ...defaultProps,
        currentSong: {
          ...defaultProps.currentSong,
          cover_url: '',
        },
        coverFallback: 'M',
      },
      global: {
        plugins: [createTestRouter()],
        stubs: { AudioPlayerPlaylistPopover: true },
      },
    })

    expect(wrapper.find('.player-cover').exists()).toBe(false)
    expect(wrapper.find('.player-cover-fallback').text()).toBe('M')
  })

  it('applies collapsed classes when isMetaCollapsed is true', () => {
    const wrapper = mount(AudioPlayerTrackInfo, {
      props: {
        ...defaultProps,
        isMetaCollapsed: true,
      },
      global: {
        plugins: [createTestRouter()],
        stubs: { AudioPlayerPlaylistPopover: true },
      },
    })

    expect(wrapper.find('.player-info').classes()).toContain('player-info--collapsed')
    expect(wrapper.find('.player-meta').classes()).toContain('player-meta--collapsed')
    expect(wrapper.find('.player-actions').classes()).toContain('player-actions--collapsed')
  })

  it('renders audio quality badge for flac or lossless audio', () => {
    const wrapper = mount(AudioPlayerTrackInfo, {
      props: {
        ...defaultProps,
        currentSong: {
          ...defaultProps.currentSong,
          audio_url: 'https://example.com/song.flac',
        },
      },
      global: {
        plugins: [createTestRouter()],
        stubs: { AudioPlayerPlaylistPopover: true },
      },
    })

    const badge = wrapper.find('.player-audio-badge')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('LOSSLESS')
  })
})
