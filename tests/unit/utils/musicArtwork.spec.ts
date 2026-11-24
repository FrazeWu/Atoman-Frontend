import { describe, expect, it } from 'vitest'
import { selectPublicMusicSeoArtwork } from '@/utils/musicArtwork'

describe('selectPublicMusicSeoArtwork', () => {
  const discogs = 'https://i.discogs.com/restricted.jpeg'
  const owned = 'https://assets.atoman.org/cover.png'
  it('preserves usable existing artwork in source order', () => {
    expect(selectPublicMusicSeoArtwork(owned, 'https://is1-ssl.mzstatic.com/image.jpg')).toBe(owned)
    expect(selectPublicMusicSeoArtwork('/uploads/music/cover.jpg')).toBe('/uploads/music/cover.jpg')
  })
  it('skips restricted Discogs artwork and uses an available alternative', () => {
    expect(selectPublicMusicSeoArtwork(discogs, owned)).toBe(owned)
    expect(selectPublicMusicSeoArtwork('https://I.DISCOGS.COM./image.jpeg', owned)).toBe(owned)
    expect(selectPublicMusicSeoArtwork(discogs, '', null)).toBeUndefined()
  })
  it('rejects credentials and non-image URL schemes', () => {
    expect(selectPublicMusicSeoArtwork('javascript:alert(1)', 'https://user:password@assets.atoman.org/a.png', '//i.discogs.com/a.jpg', owned)).toBe(owned)
  })
})
