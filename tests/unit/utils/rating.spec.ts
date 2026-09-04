import { describe, expect, it } from 'vitest'

import {
  PUBLIC_RATING_MIN_COUNT,
  formatPublicRating,
  formatViewerRating,
  hasPublicRating,
} from '@/utils/rating'

describe('rating utilities', () => {
  it('only exposes a public average from five ratings onward', () => {
    expect(PUBLIC_RATING_MIN_COUNT).toBe(5)
    expect(hasPublicRating(4)).toBe(false)
    expect(hasPublicRating(5)).toBe(true)
  })

  it('formats public and personal scores on the shared ten-point scale', () => {
    expect(formatPublicRating(8.6, 27)).toBe('8.6 / 10 · 27 人')
    expect(formatPublicRating(10, 4)).toBeNull()
    expect(formatViewerRating(9)).toBe('9/10 · 4.5 星')
  })
})
