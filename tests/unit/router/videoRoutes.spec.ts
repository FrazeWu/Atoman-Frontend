import { describe, expect, it } from 'vitest'

import { buildAppRoutes } from '@/router/buildAppRoutes'

describe('video detail route overlay', () => {
  it('keeps the video home view mounted while opening a detail sheet', () => {
    const videoRoute = buildAppRoutes().find((route) => route.path === '/videos')
    const homeRoute = videoRoute?.children?.find((route) => route.path === '')
    const watchRoute = videoRoute?.children?.find((route) => route.path === 'watch/:id')

    expect(homeRoute?.component).toBeDefined()
    expect(watchRoute?.components?.default).toBe(homeRoute?.component)
    expect(watchRoute?.components?.overlay).toBeDefined()
  })

  it('restores the detail sheet when resolving a shared video URL', () => {
    const videoRoute = buildAppRoutes().find((route) => route.path === '/videos')
    const watchRoute = videoRoute?.children?.find((route) => route.path === 'watch/:id')

    expect(watchRoute?.components?.overlay).toBeDefined()
    expect(watchRoute?.meta?.routeOverlay).toBe(true)
  })
})
