import { describe, expect, it } from 'vitest'

import {
  PUBLIC_RATING_MIN_COUNT,
  formatPublicRating,
  formatRatingSummary,
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

  it('distinguishes no ratings from a small number of saved ratings', () => {
    expect(formatRatingSummary(0, 0)).toBe('暂无评分')
    expect(formatRatingSummary(10, 1)).toBe('1 人评分 · 暂无公开均分')
    expect(formatRatingSummary(10, 4)).toBe('4 人评分 · 暂无公开均分')
    expect(formatRatingSummary(8, 5)).toBe('8.0 / 10 · 5 人')
  })
})
