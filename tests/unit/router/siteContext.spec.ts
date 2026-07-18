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
  it('maps known module paths to module context', () => {
    expect(resolveSiteContext('www.atoman.org', '', '/feed')).toEqual({ type: 'module', module: 'feed' })
    expect(resolveSiteContext('www.atoman.org', '', '/music')).toEqual({ type: 'module', module: 'music' })
    expect(resolveSiteContext('www.atoman.org', '', '/posts')).toEqual({ type: 'module', module: 'blog' })
    expect(resolveSiteContext('www.atoman.org', '', '/videos')).toEqual({ type: 'module', module: 'video' })
    expect(resolveSiteContext('www.atoman.org', '', '/podcasts')).toEqual({ type: 'module', module: 'podcast' })
  })

  it('maps explicit user and channel paths to entity context', () => {
    expect(resolveSiteContext('www.atoman.org', '', '/users/alice')).toEqual({
      type: 'entity',
      handle: 'alice',
    })
    expect(resolveSiteContext('www.atoman.org', '', '/channels/design')).toEqual({
      type: 'entity',
      handle: 'design',
    })
  })

  it('maps root and www root to portal context', () => {
    expect(resolveSiteContext('www.atoman.org', '', '/')).toEqual({ type: 'portal' })
    expect(resolveSiteContext('atoman.org', '', '/')).toEqual({ type: 'portal' })
    expect(resolveSiteContext('localhost', '', '/')).toEqual({ type: 'portal' })
  })

  it('maps production subdomains to module, entity, or unknown context', () => {
    expect(resolveSiteContext('feed.atoman.org', '', '/')).toEqual({ type: 'module', module: 'feed' })
    expect(resolveSiteContext('media.atoman.org', '', '/')).not.toEqual({ type: 'module', module: 'podcast' })
    expect(resolveSiteContext('u-alice.atoman.org', '', '/')).toEqual({
      type: 'entity',
      handle: 'alice',
    })
    expect(resolveSiteContext('alice.atoman.org', '', '/')).toEqual({
      type: 'entity',
      handle: 'alice',
    })
    expect(resolveSiteContext('-bad.atoman.org', '', '/')).toEqual({
      type: 'unknown',
      subdomain: '-bad',
    })
  })

  it('uses the same pathname-based routing on localhost', () => {
    expect(resolveSiteContext('localhost', '', '/feed')).toEqual({ type: 'module', module: 'feed' })
    expect(resolveSiteContext('localhost', '', '/media')).toEqual({ type: 'module', module: 'feed' })
    expect(resolveSiteContext('localhost', '', '/posts/post/123')).toEqual({ type: 'module', module: 'blog' })
    expect(resolveSiteContext('localhost', '', '/posts/channel/demo')).toEqual({ type: 'module', module: 'blog' })
    expect(resolveSiteContext('localhost', '', '/users/alice')).toEqual({
      type: 'entity',
      handle: 'alice',
    })
    expect(resolveSiteContext('127.9.8.7', '', '/forum')).toEqual({ type: 'module', module: 'forum' })
  })

  it('does not treat unresolved top-level paths as explicit entity context', () => {
    expect(resolveSiteContext('www.atoman.org', '', '/alice')).not.toEqual({ type: 'entity', handle: 'alice' })
    expect(resolveSiteContext('www.atoman.org', '', '/design')).not.toEqual({ type: 'entity', handle: 'design' })
  })
})
