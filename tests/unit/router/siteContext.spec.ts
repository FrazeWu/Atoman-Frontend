import { describe, expect, it } from 'vitest'
import { isLocalHost, resolveSiteContext } from '@/router/siteContext'

describe('isLocalHost', () => {
  it('only treats explicit localhost variants as local', () => {
    expect(isLocalHost('localhost')).toBe(true)
    expect(isLocalHost('127.0.0.1')).toBe(true)
    expect(isLocalHost('127.9.8.7')).toBe(true)
    expect(isLocalHost('0.0.0.0')).toBe(true)
    expect(isLocalHost('::1')).toBe(true)
    expect(isLocalHost('[::1]')).toBe(true)
    expect(isLocalHost('203.0.113.10')).toBe(false)
    expect(isLocalHost('192.168.1.20')).toBe(false)
  })
})

describe('resolveSiteContext', () => {
  it('resolves root and www hosts to the default feed module', () => {
    expect(resolveSiteContext('atoman.org')).toEqual({ type: 'module', module: 'feed' })
    expect(resolveSiteContext('www.atoman.org')).toEqual({ type: 'module', module: 'feed' })
  })

  it('resolves module subdomains before entity prefixes', () => {
    expect(resolveSiteContext('blog.atoman.org')).toEqual({ type: 'module', module: 'blog' })
    expect(resolveSiteContext('music.atoman.org')).toEqual({ type: 'module', module: 'music' })
    expect(resolveSiteContext('feed.atoman.org')).toEqual({ type: 'module', module: 'feed' })
    expect(resolveSiteContext('media.atoman.org')).toEqual({ type: 'module', module: 'media' })
  })

  it('no longer treats kanbo as a module subdomain', () => {
    expect(resolveSiteContext('kanbo.atoman.org')).toEqual({ type: 'entity', handle: 'kanbo' })
  })

  it('resolves unified entity subdomains', () => {
    expect(resolveSiteContext('alice.atoman.org')).toEqual({ type: 'entity', handle: 'alice' })
    expect(resolveSiteContext('design.atoman.org')).toEqual({ type: 'entity', handle: 'design' })
    expect(resolveSiteContext('u-alice.atoman.org')).toEqual({ type: 'entity', handle: 'alice', legacyType: 'user' })
    expect(resolveSiteContext('c-design.atoman.org')).toEqual({ type: 'entity', handle: 'design', legacyType: 'channel' })
  })

  it('rejects malformed entity subdomains as unknown', () => {
    expect(resolveSiteContext('u-.atoman.org')).toEqual({ type: 'unknown', subdomain: 'u-' })
    expect(resolveSiteContext('c-Design.atoman.org')).toEqual({ type: 'unknown', subdomain: 'c-Design' })
  })

  it('supports explicit site override query values', () => {
    expect(resolveSiteContext('localhost', 'site=blog')).toEqual({ type: 'module', module: 'blog' })
    expect(resolveSiteContext('localhost', 'site=media')).toEqual({ type: 'module', module: 'media' })
    expect(resolveSiteContext('localhost', 'site=alice')).toEqual({ type: 'entity', handle: 'alice' })
    expect(resolveSiteContext('localhost', 'site=design')).toEqual({ type: 'entity', handle: 'design' })
    expect(resolveSiteContext('localhost', 'site=u-alice')).toEqual({ type: 'entity', handle: 'alice', legacyType: 'user' })
    expect(resolveSiteContext('localhost', 'site=c-design')).toEqual({ type: 'entity', handle: 'design', legacyType: 'channel' })
    expect(resolveSiteContext('127.9.8.7', 'site=forum')).toEqual({ type: 'module', module: 'forum' })
    expect(resolveSiteContext('0.0.0.0', 'site=music')).toEqual({ type: 'module', module: 'music' })
    expect(resolveSiteContext('atoman.org', 'site=music')).toEqual({ type: 'module', module: 'music' })
    expect(resolveSiteContext('atoman.org', '?site=blog')).toEqual({ type: 'module', module: 'blog' })
  })

  it('resolves non-local IP hosts without explicit site overrides as unknown subdomains', () => {
    expect(resolveSiteContext('203.0.113.10')).toEqual({ type: 'unknown', subdomain: '203' })
  })

  it('supports IPv6 localhost dev override', () => {
    expect(resolveSiteContext('[::1]', 'site=blog')).toEqual({ type: 'module', module: 'blog' })
    expect(resolveSiteContext('::1', 'site=design')).toEqual({ type: 'entity', handle: 'design' })
  })

  it('enforces slug boundary rules for entity labels', () => {
    const validThirtyChars = 'a'.repeat(30)
    const invalidThirtyOneChars = 'a'.repeat(31)

    expect(resolveSiteContext('a.atoman.org')).toEqual({ type: 'unknown', subdomain: 'a' })
    expect(resolveSiteContext('ab.atoman.org')).toEqual({ type: 'entity', handle: 'ab' })
    expect(resolveSiteContext(`u-${validThirtyChars}.atoman.org`)).toEqual({
      type: 'entity',
      handle: validThirtyChars,
      legacyType: 'user',
    })
    expect(resolveSiteContext(`u-${invalidThirtyOneChars}.atoman.org`)).toEqual({
      type: 'unknown',
      subdomain: `u-${invalidThirtyOneChars}`,
    })
    expect(resolveSiteContext('-start.atoman.org')).toEqual({ type: 'unknown', subdomain: '-start' })
    expect(resolveSiteContext('end-.atoman.org')).toEqual({ type: 'unknown', subdomain: 'end-' })
    expect(resolveSiteContext('under_score.atoman.org')).toEqual({
      type: 'unknown',
      subdomain: 'under_score',
    })
  })
})
