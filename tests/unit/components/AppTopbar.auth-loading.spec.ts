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

  it('renders the configured app version in a left-aligned meta row under the brand text', () => {
    expect(topbarSource).toContain("import { appVersion } from '@/config/appVersion'")
    expect(topbarSource).toContain('class="logo-copy"')
    expect(topbarSource).toContain('v-if="appVersion"')
    expect(topbarSource).toContain('class="logo-version"')
    expect(topbarSource).toContain('flex-direction: column;')
    expect(topbarSource).toContain('class="logo-meta"')
    expect(topbarSource).toContain('align-items: flex-start;')
  })

  it('renders the beta label in the same meta row as the version', () => {
    expect(topbarSource).toContain('beta')
    expect(topbarSource).not.toContain('测试阶段，不保留用户数据')
    expect(topbarSource).toContain('class="logo-notice"')
    expect(topbarSource).toContain('class="logo-meta"')
  })

  it('does not clip authenticated dropdown menus in the right side of the topbar', () => {
    const navRightRule = topbarSource.match(/\.nav-right\s*\{[^}]*\}/)?.[0] || ''
    expect(navRightRule).toContain('.nav-right')
    expect(navRightRule).not.toContain('overflow: hidden;')
  })
})
