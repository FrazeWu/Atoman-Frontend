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
})
