import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { resolveMobileRouteMotion, resolveScopedMobileRouteMotion } from '@mobile/composables/useMobileRouteMotion'

describe('mobile route motion policy', () => {
  it('does not animate first render or query-only filtering of the same page', () => {
    expect(resolveMobileRouteMotion('/music', '')).toBe('')
    expect(resolveMobileRouteMotion('/music/search?tab=songs', '/music/search?tab=albums')).toBe('')
    expect(resolveMobileRouteMotion('/music', '/music')).toBe('')
  })

  it('uses a quiet transition for bottom navigation and a directional transition for details', () => {
    expect(resolveMobileRouteMotion('/music/playlists', '/music')).toBe('mobile-route-switch')
    expect(resolveMobileRouteMotion('/music/playlist/123', '/music/playlists')).toBe('mobile-route-forward')
    expect(resolveMobileRouteMotion('/music/playlists', '/music/playlist/123')).toBe('mobile-route-back')
    expect(resolveMobileRouteMotion('/music/album/abc', '/music/playlist/123')).toBe('mobile-route-forward')
    expect(resolveMobileRouteMotion('/books', '/music')).toBe('mobile-route-switch')
  })

  it('uses back direction for browser back and a transition for feed source landing', () => {
    expect(resolveMobileRouteMotion('/music/search', '/music/playlists', true)).toBe('mobile-route-back')
    expect(resolveMobileRouteMotion('/feed?source_id=123', '/feed')).toBe('mobile-route-switch')
    expect(resolveMobileRouteMotion('/feed', '/feed?source_id=123')).toBe('mobile-route-switch')
    expect(resolveMobileRouteMotion('/feed?sort=latest', '/feed?sort=popular')).toBe('')
  })

  it('prevents nested and parent outlets from animating simultaneously on a space change', () => {
    expect(resolveScopedMobileRouteMotion('/music/search', '/music', '/music')).toBe('mobile-route-switch')
    expect(resolveScopedMobileRouteMotion('/feed', '/music', '/music')).toBe('')
    expect(resolveScopedMobileRouteMotion('/feed', '/music', '')).toBe('mobile-route-switch')
    expect(resolveScopedMobileRouteMotion('/podcasts/favorites', '/podcasts', '/podcasts')).toBe('mobile-route-switch')
    expect(resolveScopedMobileRouteMotion('/videos', '/podcasts', '/podcasts')).toBe('')
  })

  it('covers nested outlets and honors reduced-motion rather than animating the fixed player dock', () => {
    for (const name of ['MobileMusicLayout.vue', 'MobileFeedLayout.vue', 'MobileModuleLayout.vue']) {
      const source = readFileSync(resolve(process.cwd(), 'apps/mobile', name), 'utf8')
      expect(source).toContain('<Transition :name="routeMotion">')
      expect(source).toContain('<KeepAlive')
    }
    const studioSource = readFileSync(resolve(process.cwd(), 'apps/mobile/views/studio/StudioMobileView.vue'), 'utf8')
    const debateSource = readFileSync(resolve(process.cwd(), 'apps/mobile/views/debate/DebateHallView.vue'), 'utf8')
    expect(studioSource).toContain('<Transition name="mobile-route-switch">')
    expect(debateSource).toContain('<main :key="currentMainTab"')
    const rootSource = readFileSync(resolve(process.cwd(), 'apps/mobile/MobileApp.vue'), 'utf8')
    expect(rootSource).toContain('<Transition :name="mobileRouteTransition">')
    const css = readFileSync(resolve(process.cwd(), 'apps/mobile/mobileRouteMotion.css'), 'utf8')
    expect(css).toContain('prefers-reduced-motion: reduce')
    expect(css).not.toContain('.mobile-app-dock {')
  })
})
