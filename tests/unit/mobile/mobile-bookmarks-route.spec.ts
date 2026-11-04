import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { mobileRoutes } from '../../../apps/mobile/mobileRoutes'

describe('mobile legacy bookmarks route', () => {
  it('resolves the shared /bookmarks link to the protected mobile blog bookmarks page', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: mobileRoutes })
    await router.push('/bookmarks')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/posts/bookmarks')
    expect(router.currentRoute.value.matched.at(-1)?.meta.requiresAuth).toBe(true)
  })
})
