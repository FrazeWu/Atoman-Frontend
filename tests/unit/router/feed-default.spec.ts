import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { buildAppRoutes } from '../../../src/router/buildAppRoutes'
import { moduleRoutes } from '../../../src/router/routes/modules'

function lazyImportPath(component: unknown) {
  return String(component)
}

describe('feed default route', () => {
  it('opens exploration and keeps subscriptions as a separate route', async () => {
    const root = moduleRoutes.feed.find((route) => route.path === '/')
    const children = root?.children || []
    const defaultRoute = children.find((route) => route.path === '')
    const subscriptionRoute = children.find((route) => route.path === 'subscriptions')

    expect(lazyImportPath(defaultRoute?.component)).toContain('FeedRecommendedView.vue')
    expect(lazyImportPath(subscriptionRoute?.component)).toContain('FeedView.vue')

    const router = createRouter({
      history: createMemoryHistory(),
      routes: buildAppRoutes(),
    })
    await router.push('/feed/explore?category=tech#sources')

    expect(router.currentRoute.value.fullPath).toBe('/feed?category=tech#sources')
  }, 20_000)
})
