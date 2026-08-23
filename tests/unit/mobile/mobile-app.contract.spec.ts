import { describe, expect, it } from 'vitest'
import { mobileRoutes, MOBILE_MODULES } from '../../../apps/mobile/mobileRoutes'

function routePaths() {
  return mobileRoutes.map((route) => route.path)
}

describe('mobile app route boundary', () => {
  it('starts at Feed and exposes only the pilot modules', () => {
    expect(mobileRoutes[0]).toMatchObject({ path: '/', redirect: '/feed' })
    expect(MOBILE_MODULES).toEqual(['feed', 'blog'])
  })

  it('keeps the pilot module routes available for deep links', () => {
    expect(routePaths()).toEqual(expect.arrayContaining([
      '/feed',
      '/feed/subscriptions',
      '/feed/reading-list',
      '/feed/starred',
      '/feed/item/:id',
      '/posts',
      '/posts/notes',
      '/posts/subscriptions',
      '/posts/bookmarks',
      '/post/:id',
    ]))
  })

  it('does not advertise modules that are not in the pilot', () => {
    expect(routePaths()).not.toContain('/music')
    expect(routePaths()).not.toContain('/forum')
    expect(routePaths()).not.toContain('/studio')
  })
})
