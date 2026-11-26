import { describe, expect, it } from 'vitest'
import { buildAppRoutes } from '@/router/buildAppRoutes'
import { moduleRooms, moduleNavOrder, topbarNavOrder } from '@/config/moduleRooms'

describe('Papers private module routing', () => {
  it('registers an authenticated papers index and workspace', () => {
    const routes = buildAppRoutes()
    const list = routes.find(route => route.path === '/papers')
    const workspace = routes.find(route => route.path === '/papers/:projectId')
    const invitation = routes.find(route => route.path === '/papers/invite')
    expect(invitation?.meta?.restoreSession).toBe(true)
    expect(invitation?.meta?.requiresAuth).not.toBe(true)
    expect(String(invitation?.component)).toContain('PaperInviteView.vue')
    expect(list?.meta?.requiresAuth).toBe(true)
    expect(workspace?.meta?.requiresAuth).toBe(true)
    expect(String(list?.component)).toContain('PapersHomeView.vue')
    expect(String(workspace?.component)).toContain('PaperWorkspaceView.vue')
    expect(moduleRooms.papers.publicPathSegment).toBe('papers')
  })

  it('advertises Papers as the last Topbar module', () => {
    expect(moduleNavOrder.at(-1)).toBe('papers')
    expect(topbarNavOrder.at(-1)).toBe('papers')
  })
})
