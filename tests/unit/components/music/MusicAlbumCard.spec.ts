import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MusicAlbumCard from '@/components/music/MusicAlbumCard.vue'

describe('MusicAlbumCard', () => {
  it('resolves cover_s3_key through the configured public asset base instead of localhost', () => {
    const env = import.meta.env as ImportMetaEnv
    env.VITE_R2_PUBLIC_BASE_URL = 'https://assets.atoman.org'

    const wrapper = mount(MusicAlbumCard, {
      props: {
        album: {
          id: 'album-1',
          title: 'Album One',
          cover_s3_key: 'music/covers/album-1.jpg',
        },
      },
    })

    const image = wrapper.get('img')
    expect(image.attributes('src')).toBe('https://assets.atoman.org/music/covers/album-1.jpg')
  })

  it('keeps album, artist, and bookmark actions as separate buttons', async () => {
    const wrapper = mount(MusicAlbumCard, {
      props: {
        album: {
          id: 'album-1',
          title: 'Album One',
          artists: [{ id: 'artist-1', name: 'Artist One' }],
        },
      },
    })

    expect(wrapper.find('button button').exists()).toBe(false)

    await wrapper.get('.cover-action').trigger('click')
    await wrapper.get('.album-title-btn').trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(2)

    await wrapper.get('.artist-link').trigger('click')
    expect(wrapper.emitted('click-artist')).toEqual([['artist-1']])
    expect(wrapper.emitted('click')).toHaveLength(2)

    await wrapper.get('.bookmark-btn').trigger('click')
    expect(wrapper.emitted('toggle-bookmark')).toHaveLength(1)
    expect(wrapper.emitted('click')).toHaveLength(2)
  })
})
