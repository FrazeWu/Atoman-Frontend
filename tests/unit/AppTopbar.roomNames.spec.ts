import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isRoomRouteActive, moduleNavOrder, moduleRooms, notificationRoom } from '@/config/moduleRooms'
import type { SiteContext } from '@/router/siteContext'

const topbarSource = readFileSync(resolve(__dirname, '../../src/components/AppTopbar.vue'), 'utf8')

describe('AppTopbar room names', () => {
  it('renders room navigation from the shared config', () => {
    expect(topbarSource).toContain('v-for="room in navRooms"')
    expect(topbarSource).toContain('moduleNavOrder.filter((key) => siteAccessStore.isModuleVisible(key)).map((key) => moduleRooms[key])')
    expect(topbarSource).not.toContain('to="/blog"')

    for (const key of moduleNavOrder) {
      expect(moduleRooms[key].name.length).toBeLessThanOrEqual(3)
      expect(moduleRooms[key].helper.length).toBeGreaterThan(0)
    }
  })

  it('matches active room from module site context instead of module path prefixes', () => {
    const musicContext: SiteContext = { type: 'module', module: 'music' }
    const blogContext: SiteContext = { type: 'module', module: 'blog' }
    const portalContext: SiteContext = { type: 'portal' }

    expect(isRoomRouteActive('music', musicContext)).toBe(true)
    expect(isRoomRouteActive('blog', musicContext)).toBe(false)
    expect(isRoomRouteActive('blog', blogContext)).toBe(true)
    expect(isRoomRouteActive('feed', portalContext)).toBe(false)
  })

  it('renames inbox notifications to 门房 with helper title', () => {
    expect(notificationRoom).toMatchObject({ name: '门房', helper: '通知与提醒' })
  })
})
