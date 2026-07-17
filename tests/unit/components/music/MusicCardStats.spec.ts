import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MusicAlbumCard from '@/components/music/MusicAlbumCard.vue'
import MusicArtistCard from '@/components/music/MusicArtistCard.vue'
import MusicPlaylistCard from '@/components/music/MusicPlaylistCard.vue'

describe('music card statistics', () => {
  it('keeps album statistics in a permanent overlay', () => {
    const wrapper = mount(MusicAlbumCard, {
      props: {
        album: {
          id: 'album-1',
          title: 'Album',
          artists: [{ name: 'Artist' }],
          play_count: 42,
          bookmark_count: 7,
        },
      },
    })

    expect(wrapper.get('.stats-overlay').text()).toContain('42')
    expect(wrapper.get('.stats-overlay').text()).toContain('7')
    expect(wrapper.find('.hover-overlay').exists()).toBe(false)
  })

  it('keeps artist statistics in a permanent overlay', () => {
    const wrapper = mount(MusicArtistCard, {
      props: {
        artist: {
          id: 'artist-1',
          name: 'Artist',
          play_count: 36,
          bookmark_count: 9,
        },
      },
    })

    expect(wrapper.get('.stats-overlay').text()).toContain('36')
    expect(wrapper.get('.stats-overlay').text()).toContain('9')
    expect(wrapper.find('.hover-overlay').exists()).toBe(false)
  })

  it('shows playlist song count even when a description is present', () => {
    const wrapper = mount(MusicPlaylistCard, {
      props: {
        playlist: {
          id: 'playlist-1',
          title: 'Playlist',
          description: 'A short description',
          song_count: 12,
        },
      },
    })

    expect(wrapper.get('.playlist-description').text()).toBe('A short description')
    expect(wrapper.get('.playlist-stats').text()).toBe('12 首歌曲')
  })
})
