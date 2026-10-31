import { describe, expect, it } from 'vitest'
import {
  MEDIA_SESSION_ARTWORK_SIZES,
  toAbsoluteMediaURL,
  inferImageMimeType,
  buildMediaSessionArtwork,
  sanitizeMediaPositionState,
} from '@/utils/mediaSession'

describe('mediaSession utils', () => {
  describe('toAbsoluteMediaURL', () => {
    it('returns empty string for empty input', () => {
      expect(toAbsoluteMediaURL('')).toBe('')
      expect(toAbsoluteMediaURL(null as any)).toBe('')
      expect(toAbsoluteMediaURL(undefined as any)).toBe('')
    })

    it('keeps absolute http/https/data/blob URLs as is', () => {
      expect(toAbsoluteMediaURL('https://example.com/cover.jpg')).toBe('https://example.com/cover.jpg')
      expect(toAbsoluteMediaURL('http://example.com/cover.png')).toBe('http://example.com/cover.png')
      expect(toAbsoluteMediaURL('data:image/png;base64,...')).toBe('data:image/png;base64,...')
      expect(toAbsoluteMediaURL('blob:https://example.com/uuid')).toBe('blob:https://example.com/uuid')
    })

    it('resolves protocol-relative URLs with window protocol', () => {
      const res = toAbsoluteMediaURL('//cdn.example.com/img.jpg')
      expect(res).toBe(`${window.location.protocol}//cdn.example.com/img.jpg`)
    })

    it('resolves relative URLs to window.location.origin', () => {
      const res = toAbsoluteMediaURL('/media/covers/album1.jpg')
      expect(res).toBe(`${window.location.origin}/media/covers/album1.jpg`)
    })
  })

  describe('inferImageMimeType', () => {
    it('identifies image extensions correctly', () => {
      expect(inferImageMimeType('https://cdn.com/pic.png')).toBe('image/png')
      expect(inferImageMimeType('https://cdn.com/pic.jpg')).toBe('image/jpeg')
      expect(inferImageMimeType('https://cdn.com/pic.jpeg?w=200')).toBe('image/jpeg')
      expect(inferImageMimeType('/static/pic.webp')).toBe('image/webp')
      expect(inferImageMimeType('/static/pic.avif')).toBe('image/avif')
    })

    it('returns undefined for unknown or extensionless paths', () => {
      expect(inferImageMimeType('https://cdn.com/blob')).toBeUndefined()
      expect(inferImageMimeType('')).toBeUndefined()
    })
  })

  describe('buildMediaSessionArtwork', () => {
    it('generates artworks for all defined sizes', () => {
      const artworks = buildMediaSessionArtwork('https://cdn.com/cover.jpg')
      expect(artworks).toHaveLength(MEDIA_SESSION_ARTWORK_SIZES.length)

      for (let i = 0; i < MEDIA_SESSION_ARTWORK_SIZES.length; i++) {
        const size = MEDIA_SESSION_ARTWORK_SIZES[i]
        expect(artworks[i].sizes).toBe(`${size}x${size}`)
        expect(artworks[i].src).toContain('https://cdn.com/cover.jpg')
        expect(artworks[i].type).toBe('image/jpeg')
      }
    })

    it('falls back to favicon when coverUrl is omitted', () => {
      const artworks = buildMediaSessionArtwork()
      expect(artworks.length).toBe(MEDIA_SESSION_ARTWORK_SIZES.length)
      expect(artworks[0].src).toContain('/favicon.png')
      expect(artworks[0].type).toBe('image/png')
    })
  })

  describe('sanitizeMediaPositionState', () => {
    it('returns sanitized state when valid', () => {
      const sanitized = sanitizeMediaPositionState({
        duration: 180,
        position: 45,
        playbackRate: 1.25,
      })
      expect(sanitized).toEqual({
        duration: 180,
        position: 45,
        playbackRate: 1.25,
      })
    })

    it('defaults playbackRate to 1.0 if missing, 0, or invalid', () => {
      const res0 = sanitizeMediaPositionState({ duration: 100, position: 10, playbackRate: 0 })
      expect(res0?.playbackRate).toBe(1.0)

      const resNaN = sanitizeMediaPositionState({ duration: 100, position: 10, playbackRate: NaN })
      expect(resNaN?.playbackRate).toBe(1.0)
    })

    it('clamps position to duration if position exceeds duration', () => {
      const clamped = sanitizeMediaPositionState({ duration: 100, position: 150 })
      expect(clamped?.position).toBe(100)
    })

    it('returns null for non-positive duration or negative position', () => {
      expect(sanitizeMediaPositionState({ duration: 0, position: 0 })).toBeNull()
      expect(sanitizeMediaPositionState({ duration: -10, position: 0 })).toBeNull()
      expect(sanitizeMediaPositionState({ duration: 100, position: -5 })).toBeNull()
      expect(sanitizeMediaPositionState(null)).toBeNull()
      expect(sanitizeMediaPositionState(undefined)).toBeNull()
    })
  })
})
