import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { appVersion } from '@/config/appVersion'
import { footbarLinks } from '@/config/moduleRooms'
import router from '@/router'

const footerSource = readFileSync(resolve(__dirname, '../../../src/components/system/SiteFooter.vue'), 'utf8')

describe('SiteFooter', () => {
  it('renders the brand and all footbar links from config', () => {
    expect(footerSource).toContain('凹凸庵')
    expect(footerSource).toContain('v-for="link in footbarLinks"')
    expect(footerSource).toContain(':href="link.href"')

    expect(footbarLinks.map((link) => link.label)).toEqual([
      '关于',
      '联系我们',
      '提交 Issue',
      '使用条款',
      '隐私政策',
    ])
    expect(footbarLinks.find((link) => link.label === '提交 Issue')?.href).toBe('https://github.com/FrazeWu/Atoman/issues')
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

  it('allows moderators to open settings', () => {
    expect(footerSource).toContain('isModeratorRole')
  })
})
