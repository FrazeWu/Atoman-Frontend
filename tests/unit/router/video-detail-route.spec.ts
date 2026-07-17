import { describe, expect, it } from 'vitest'

import { buildAppRoutes } from '@/router/buildAppRoutes'

describe('video detail route', () => {
  it('registers /videos/watch/:id as a real child page without a self redirect', () => {
    const routes = buildAppRoutes()
    const videoRoot = routes.find((route) => route.path === '/videos')
    const detail = videoRoot?.children?.find((route) => route.path === 'watch/:id')

    expect(detail).toBeTruthy()
    expect(detail?.component).toEqual(expect.any(Object))
    expect(videoRoot?.children?.some((route) => route.path === 'videos/watch/:id')).toBe(false)
    expect(routes.some((route) => route.path === '/videos/watch/:id')).toBe(false)
  })
})
