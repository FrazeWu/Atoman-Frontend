import { describe, expect, it } from 'vitest'

import { buildAppRoutes } from '@/router/buildAppRoutes'

describe('blog detail route', () => {
  it('registers article details inside the posts space', () => {
    const routes = buildAppRoutes()
    const detail = routes.find((route) => route.path === '/posts/post/:id')

    expect(detail).toBeTruthy()
    expect(detail?.component).toEqual(expect.any(Object))
    expect(routes.some((route) => route.path === '/post/:id')).toBe(false)
  })
})
