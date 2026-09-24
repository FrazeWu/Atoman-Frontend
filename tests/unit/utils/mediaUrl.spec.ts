import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resolveMediaImageSrcSet, resolveMediaImageURL, resolveMediaURL, resolvePlayableAudioURL } from '@/utils/mediaUrl'

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

  it('builds responsive candidates for trusted asset images', () => {
    expect(resolveMediaImageSrcSet('https://assets.atoman.org/music/covers/album.png', [180, 320]))
      .toBe('/media/image?url=https%3A%2F%2Fassets.atoman.org%2Fmusic%2Fcovers%2Falbum.png&width=180 180w, /media/image?url=https%3A%2F%2Fassets.atoman.org%2Fmusic%2Fcovers%2Falbum.png&width=320 320w')
  })

  it('proxies supported external image hosts through the size-aware image proxy', () => {
    expect(resolveMediaImageURL('https://is1-ssl.mzstatic.com/image/thumb/Music211/cover/1200x1200bb.jpg', { width: 320 }))
      .toBe('/media/image?url=https%3A%2F%2Fis1-ssl.mzstatic.com%2Fimage%2Fthumb%2FMusic211%2Fcover%2F1200x1200bb.jpg&width=320')
    expect(resolveMediaImageURL('https://www.designmadeingermany.de/avatar.webp', { width: 40 }))
      .toBe('/media/image?url=https%3A%2F%2Fwww.designmadeingermany.de%2Favatar.webp&width=40')
    expect(resolveMediaImageURL('https://lh3.googleusercontent.com/a/avatar=s96-c', { width: 32 }))
      .toBe('/media/image?url=https%3A%2F%2Flh3.googleusercontent.com%2Fa%2Favatar%3Ds96-c&width=32')
  })

  it('does not proxy images from unknown external hosts', () => {
    expect(resolveMediaImageURL('https://cdn.example.test/cover.jpg', { width: 320 }))
      .toBe('https://cdn.example.test/cover.jpg')
  })
})
