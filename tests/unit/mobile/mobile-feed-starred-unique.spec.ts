import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { mobileRoutes } from '../../../apps/mobile/mobileRoutes'

describe('mobile feed favorites route', () => {
  it('registers a single canonical guest-aware favorites view', () => {
    const feed = mobileRoutes.find(route => route.path === '/feed')
    const starred = feed?.children?.filter(route => route.path === 'starred') ?? []
    expect(starred).toHaveLength(1)
    expect(String(starred[0]?.component)).toContain('FeedStarredView.vue')
    expect(starred[0]?.meta?.requiresAuth).toBeUndefined()
    const router = createRouter({ history: createMemoryHistory(), routes: mobileRoutes })
    expect(router.resolve('/feed/starred').matched.at(-1)?.path).toBe('/feed/starred')
  })
})
