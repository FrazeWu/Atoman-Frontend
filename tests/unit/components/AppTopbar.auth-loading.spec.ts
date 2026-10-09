import path from 'node:path'
import { readFileSync } from 'node:fs'

const topbarSource = readFileSync(
  path.resolve(process.cwd(), 'src/components/system/AppTopbar.vue'),
  'utf8',
)

describe('AppTopbar auth loading', () => {
  it('keeps authenticated inbox controls behind an async boundary', () => {
    expect(topbarSource).not.toContain("import { useInboxStore } from '@/stores/inbox'")
    expect(topbarSource).toContain("defineAsyncComponent(() => import('@/components/system/AppTopbarAuthControls.vue'))")
    expect(topbarSource).toContain('v-if="showAuthControls"')
  })

  it('keeps a stable public slot for the deferred search control', () => {
    expect(topbarSource).toMatch(
      /class="topbar-search-slot"/,
    )
    expect(topbarSource).toMatch(
      /\.topbar-search-slot\s*\{[^}]*flex:\s*0 0 9\.375rem/s,
    )
  })

  it('renders the configured app version in a left-aligned meta row under the brand text', () => {
    expect(topbarSource).toContain("import { appVersion } from '@/config/appVersion'")
    expect(topbarSource).toContain('class="logo-copy"')
    expect(topbarSource).toContain('v-if="appVersion"')
    expect(topbarSource).toContain('class="logo-version"')
    expect(topbarSource).toContain('flex-direction: column;')
    expect(topbarSource).toContain('class="logo-meta"')
    expect(topbarSource).toContain('align-items: flex-start;')
  })

  it('does not render internal beta notice in the meta row', () => {
    expect(topbarSource).not.toContain('<span class="logo-notice">beta</span>')
    expect(topbarSource).not.toContain('测试阶段，不保留用户数据')
    expect(topbarSource).toContain('class="logo-meta"')
  })

  it('does not clip authenticated dropdown menus in the right side of the topbar', () => {
    const navRightRule = topbarSource.match(/\.nav-right\s*\{[^}]*\}/)?.[0] || ''
    expect(navRightRule).toContain('.nav-right')
    expect(navRightRule).not.toContain('overflow: hidden;')
  })

  it('reads the window scroll position without forcing a document layout read', () => {
    expect(topbarSource).toContain('isScrolled.value = window.scrollY > 0')
    expect(topbarSource).not.toContain('window.scrollY || document.documentElement.scrollTop')
  })
})
