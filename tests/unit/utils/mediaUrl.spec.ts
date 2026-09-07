import { describe, expect, it } from 'vitest'

import { resolveMediaURL, resolvePlayableAudioURL } from '@/utils/mediaUrl'

describe('resolveMediaURL', () => {
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
})
