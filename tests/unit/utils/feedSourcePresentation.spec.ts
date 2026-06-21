import { describe, expect, it } from 'vitest'

import {
  buildSourceAvatarLabel,
  buildSourceColor,
  normalizeSourceUrlForCard,
} from '@/utils/feedSourcePresentation'

describe('feedSourcePresentation', () => {
  it('normalizes https RSS URLs for source cards', () => {
    expect(normalizeSourceUrlForCard('https://dense-discovery.com/rss.xml')).toBe(
      'dense-discovery.com/rss.xml',
    )
    expect(normalizeSourceUrlForCard('https://www.example.com/feed')).toBe('example.com/feed')
  })

  it('preserves query strings while normalizing absolute URLs', () => {
    expect(normalizeSourceUrlForCard('https://www.example.com/feed.xml?source=rss&v=2')).toBe(
      'example.com/feed.xml?source=rss&v=2',
    )
  })

  it('normalizes schemeless host and path inputs like absolute URLs', () => {
    expect(normalizeSourceUrlForCard('example.com/feed.xml')).toBe('example.com/feed.xml')
    expect(normalizeSourceUrlForCard('www.example.com/feed.xml?source=rss')).toBe(
      'example.com/feed.xml?source=rss',
    )
  })

  it('falls back to the title when no URL is available', () => {
    expect(normalizeSourceUrlForCard(undefined, 'Dense Discovery')).toBe('Dense Discovery')
  })

  it('builds avatar labels from trimmed titles', () => {
    expect(buildSourceAvatarLabel('Dense Discovery')).toBe('D')
    expect(buildSourceAvatarLabel('  播客精选  ')).toBe('播')
  })

  it('builds deterministic HSL colors for the same source input', () => {
    const first = buildSourceColor('https://dense-discovery.com/rss.xml')
    const second = buildSourceColor('https://dense-discovery.com/rss.xml')

    expect(first).toBe(second)
    expect(first).toMatch(/^hsl\(/)
  })
})
