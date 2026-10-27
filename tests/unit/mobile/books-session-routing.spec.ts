import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import { mobileRoutes } from '../../../apps/mobile/mobileRoutes'

describe('mobile book session routes', () => {
  it.each(['/books/work/:id', '/books/notes'])('%s restores existing sessions without requiring anonymous users to log in', path => {
    const route = mobileRoutes.find(route => route.path === path)
    expect(route?.meta?.restoreSession).toBe(true)
    expect(route?.meta?.requiresAuth).not.toBe(true)
  })

  it('resolves the canonical reader URL with an asset revision', () => {
    const router = createRouter({ history: createMemoryHistory(), routes: mobileRoutes })
    const route = router.resolve('/books/read/work-1/asset-1/revision-1')
    expect(route.matched.some(record => record.path.endsWith('read/:workId/:assetId/:revisionId'))).toBe(true)
  })
})
