import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resolveMediaImageURL, resolveMediaURL, resolvePlayableAudioURL } from '@/utils/mediaUrl'

describe('resolveMediaURL', () => {
  beforeEach(() => {
    vi.stubEnv('PROD', 'true')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('proxies local MinIO URLs in development', () => {
    expect(resolveMediaURL('http://localhost:9100/atoman-dev/blog/images/user/image.jpg'))
      .toBe('/__object-storage/atoman-dev/blog/images/user/image.jpg')
  })

  it('preserves CDN URLs', () => {
    expect(resolveMediaURL('https://cdn.example.test/blog/images/user/image.jpg'))
      .toBe('https://cdn.example.test/blog/images/user/image.jpg')
  })

  it('adds the playback CORS marker to production audio URLs', () => {
    expect(resolvePlayableAudioURL('https://assets.atoman.org/music/audio/song.mp3'))
      .toBe('https://assets.atoman.org/music/audio/song.mp3?cors=1')
  })

  it('routes trusted asset images through the size-aware image proxy', () => {
    expect(resolveMediaImageURL('https://assets.atoman.org/music/covers/album.png', { width: 320 }))
      .toBe('/media/image?url=https%3A%2F%2Fassets.atoman.org%2Fmusic%2Fcovers%2Falbum.png&width=320')
  })

  it('does not proxy images from external hosts', () => {
    expect(resolveMediaImageURL('https://cdn.example.test/cover.jpg', { width: 320 }))
      .toBe('https://cdn.example.test/cover.jpg')
  })
})
