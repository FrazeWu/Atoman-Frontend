import { describe, expect, it } from 'vitest'
import { resolveSiteContext } from '@/router/siteContext'
import { channelUrl, userUrl } from '@/router/siteUrls'

describe('entity subdomain routing helpers', () => {
  it('parses unified and legacy user hosts as entity handles', () => {
    expect(resolveSiteContext('alice.atoman.org')).toEqual({ type: 'entity', handle: 'alice' })
    expect(resolveSiteContext('u-alice.atoman.org')).toEqual({ type: 'entity', handle: 'alice', legacyType: 'user' })
  })

  it('parses unified and legacy channel hosts as entity handles', () => {
    expect(resolveSiteContext('design.atoman.org')).toEqual({ type: 'entity', handle: 'design' })
    expect(resolveSiteContext('c-design.atoman.org')).toEqual({ type: 'entity', handle: 'design', legacyType: 'channel' })
  })

  it('builds unified entity profile URLs', () => {
    expect(userUrl('alice', 'https:', 'blog.atoman.org')).toBe('https://alice.atoman.org/')
    expect(channelUrl('design', 'https:', 'blog.atoman.org')).toBe('https://design.atoman.org/')
  })
})
