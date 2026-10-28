import { describe, it, expect } from 'vitest'
import { resolveMobileSpace } from '@mobile/mobileSpace'
import { SPACE_TABS } from '@mobile/components/system/bottomNavConstants'

describe('mobile module navigation ownership', () => {
  it.each([
    ['/', 'global'],
    ['/modules', 'global'],
    ['/search', 'global'],
    ['/about', 'global'],
    ['/unknown-page', 'global'],
    ['/music', 'music'],
    ['/music/playlist/example', 'music'],
    ['/feed/following', 'feed'],
    ['/posts/articles', 'blog'],
    ['/post/real-post', 'blog'],
    ['/books/work/uuid', 'books'],
    ['/inbox/notifications', 'messages'],
    ['/studio', 'studio'],
    ['/debate', 'debate'],
    ['/podcasts', 'podcast'],
    ['/podcasts/show/slug', 'podcast'],
    ['/videos', 'video'],
    ['/videos/watch/uuid', 'video'],
    ['/forum', 'forum'],
    ['/forum/topic/uuid', 'forum'],
    ['/timeline', 'timeline'],
    ['/timeline/person/uuid', 'timeline'],
  ])('resolves %s to %s without inheriting music', (path, expected) => {
    expect(resolveMobileSpace(path)).toBe(expected)
    expect(SPACE_TABS[expected]?.length).toBe(4)
  })

  it('preserves explicit module search scope and rejects unknown search modules', () => {
    expect(resolveMobileSpace('/search', 'video')).toBe('video')
    expect(resolveMobileSpace('/search', 'timeline')).toBe('timeline')
    expect(resolveMobileSpace('/search', 'not-a-module')).toBe('global')
  })

  it('keeps the prior space only on the shared /me route', () => {
    expect(resolveMobileSpace('/me', undefined, 'studio')).toBe('studio')
    expect(resolveMobileSpace('/me')).toBe('global')
    expect(resolveMobileSpace('/privacy', undefined, 'music')).toBe('global')
  })

  it('every extra module bottom tab leads to a registered content route', () => {
    expect(SPACE_TABS.podcast.map(t => t.path)).toEqual(['/podcasts', '/podcasts/subscriptions', '/podcasts/favorites', '/podcasts/me'])
    expect(SPACE_TABS.video.map(t => t.path)).toEqual(['/videos', '/videos/search', '/videos/subscriptions', '/videos/favorites'])
    expect(SPACE_TABS.forum.map(t => t.path)).toEqual(['/forum', '/forum/categories', '/forum/search', '/forum/me'])
    expect(SPACE_TABS.timeline.map(t => t.path)).toEqual(['/timeline', '/timeline/persons', '/timeline/search', '/timeline/me'])
  })
})
