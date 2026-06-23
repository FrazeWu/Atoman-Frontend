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
    expect(resolveSiteContext('www.atoman.org', '', '/media')).toEqual({ type: 'module', module: 'media' })
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

  it('defaults root and www root to feed module context', () => {
    expect(resolveSiteContext('www.atoman.org', '', '/')).toEqual({ type: 'module', module: 'feed' })
    expect(resolveSiteContext('atoman.org', '', '/')).toEqual({ type: 'module', module: 'feed' })
  })

  it('uses the same pathname-based routing on localhost', () => {
    expect(resolveSiteContext('localhost', '', '/feed')).toEqual({ type: 'module', module: 'feed' })
    expect(resolveSiteContext('localhost', '', '/media')).toEqual({ type: 'module', module: 'media' })
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
