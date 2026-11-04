import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { mobileRoutes } from '../../../apps/mobile/mobileRoutes'
import { buildAppRoutes } from '../../../src/router/buildAppRoutes'

describe('saved collection route compatibility', () => {
  it('restores session for mobile starred articles, while allowing guests', () => {
    const feed = mobileRoutes.find(route => route.path === '/feed')
    const starred = feed?.children?.filter(route => route.path === 'starred') ?? []
    expect(starred).toHaveLength(1)
    expect(starred[0]?.meta?.restoreSession).toBe(true)
    expect(starred[0]?.meta?.requiresAuth).toBeUndefined()
  })
  it('redirects desktop shelf deep links to protected library', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: buildAppRoutes() })
    await router.push('/books/shelf')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/books/library')
    expect(router.currentRoute.value.meta.requiresAuth).toBe(true)
  })
})
