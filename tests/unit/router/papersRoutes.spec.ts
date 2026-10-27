import { describe, expect, it } from 'vitest'
import { buildAppRoutes } from '@/router/buildAppRoutes'
import { moduleRooms, moduleNavOrder } from '@/config/moduleRooms'

describe('Papers private module routing', () => {
  it('registers an authenticated papers index and workspace', () => {
    const routes = buildAppRoutes()
    const list = routes.find(route => route.path === '/papers')
    const workspace = routes.find(route => route.path === '/papers/:projectId')
    expect(list?.meta?.requiresAuth).toBe(true)
    expect(workspace?.meta?.requiresAuth).toBe(true)
    expect(String(list?.component)).toContain('PapersHomeView.vue')
    expect(String(workspace?.component)).toContain('PaperWorkspaceView.vue')
    expect(moduleRooms.papers.publicPathSegment).toBe('papers')
  })

  it('does not automatically advertise a private beta in public module navigation', () => {
    expect(moduleNavOrder).not.toContain('papers')
  })
})
