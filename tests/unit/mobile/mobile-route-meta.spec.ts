import { describe, expect, it } from 'vitest'
import { isMobileDetailRoute } from '../../../apps/mobile/mobileRouteMeta'

describe('mobile detail route metadata', () => {
  it('identifies content detail and immersive routes', () => {
    expect(isMobileDetailRoute('/feed/item/123')).toBe(true)
    expect(isMobileDetailRoute('/posts/post/123')).toBe(true)
    expect(isMobileDetailRoute('/music/album/123')).toBe(true)
    expect(isMobileDetailRoute('/music/player')).toBe(true)
    expect(isMobileDetailRoute('/videos/watch/123')).toBe(true)
    expect(isMobileDetailRoute('/books/work/123')).toBe(true)
    expect(isMobileDetailRoute('/books/edition/123')).toBe(true)
    expect(isMobileDetailRoute('/books/work/123?q=test')).toBe(true)
    expect(isMobileDetailRoute('/podcasts/episode/123')).toBe(true)
    expect(isMobileDetailRoute('/forum/topic/123/edit')).toBe(true)
    expect(isMobileDetailRoute('/timeline/person/123')).toBe(true)
    expect(isMobileDetailRoute('/debate/123#votes')).toBe(true)
  })

  it('keeps collection pages and account settings out of the detail transition', () => {
    expect(isMobileDetailRoute('/feed')).toBe(false)
    expect(isMobileDetailRoute('/music')).toBe(false)
    expect(isMobileDetailRoute('/debate/search?q=test')).toBe(false)
    expect(isMobileDetailRoute('/debate/me')).toBe(false)
    expect(isMobileDetailRoute('/users/alice/settings')).toBe(false)
  })
})
