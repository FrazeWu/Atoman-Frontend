import { describe, expect, it } from 'vitest'
import { resolveSiteContext } from '@/router/siteContext'
import { channelUrl, userUrl } from '@/router/siteUrls'

describe('entity subdomain routing helpers', () => {
  it('parses usernames from u-prefixed hosts', () => {
    expect(resolveSiteContext('u-alice.atoman.org')).toEqual({ type: 'user', username: 'alice' })
  })

  it('parses channel slugs from c-prefixed hosts', () => {
    expect(resolveSiteContext('c-design.atoman.org')).toEqual({ type: 'channel', slug: 'design' })
  })

  it('builds entity profile URLs without requiring subdomain DNS', () => {
    expect(userUrl('alice', 'https:', 'blog.atoman.org')).toBe('https://atoman.org/?site=u-alice')
    expect(channelUrl('design', 'https:', 'blog.atoman.org')).toBe('https://atoman.org/?site=c-design')
  })
})
