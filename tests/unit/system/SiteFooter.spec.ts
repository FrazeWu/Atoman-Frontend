import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { appVersion } from '@/config/appVersion'
import { footbarLinks } from '@/config/moduleRooms'
import router from '@/router'

const footerSource = readFileSync(resolve(__dirname, '../../../src/components/system/SiteFooter.vue'), 'utf8')
const mobileNavSource = readFileSync(resolve(__dirname, '../../../src/components/system/MobileBottomNav.vue'), 'utf8')
const appSource = readFileSync(resolve(__dirname, '../../../src/App.vue'), 'utf8')
const footerStyle = footerSource.match(/\.site-footer\s*\{([^}]*)\}/)?.[1] ?? ''

describe('SiteFooter', () => {
  it('uses the current panel-based footer links', () => {
    expect(footerSource).toContain('凹凸庵')
    expect(footerSource).toContain('v-for="link in primaryLinks"')
    expect(footerSource).toContain('v-for="link in secondaryLinks"')
    expect(footerSource).toContain('data-footer-panel')
    expect(footerSource).toContain('SiteFooterSheet')

    expect(footbarLinks.map((link) => link.label)).toEqual([
      '关于',
      '联系我们',
      '问题反馈',
      '使用条款',
      '隐私政策',
    ])
  })

  it('registers top-level terms and privacy routes', () => {
    expect(router.resolve('/terms').matched.length).toBeGreaterThan(0)
    expect(router.resolve('/privacy').matched.length).toBeGreaterThan(0)
  })

  it('renders a build version in the footer', () => {
    expect(appVersion).toMatch(/^v\d+\.\d+\.\d+/)
    expect(footerSource).toContain('appVersion')
    expect(footerSource).toContain('site-footer-version')
  })

  it('contains no unresolved merge markers', () => {
    expect(footerSource).not.toContain('<<<<<<<')
    expect(mobileNavSource).not.toContain('<<<<<<<')
  })

  it('keeps the footer at the bottom on short pages', () => {
    expect(footerStyle).toContain('position: relative')
    expect(footerStyle).not.toMatch(/position:\s*(?:fixed|sticky)/)
    expect(footerStyle).not.toMatch(/bottom:\s*0/)
    expect(appSource).toMatch(/\.app-main\s*\{[\s\S]*?flex:\s*1/)
  })

  it('can hide below sidebar pages on mobile', () => {
    expect(footerSource).toContain('hideOnMobile')
    expect(footerSource).toContain('site-footer--mobile-hidden')
    expect(footerSource).toContain('display: none')
  })
})
