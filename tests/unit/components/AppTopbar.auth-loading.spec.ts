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

  it('renders a test-stage notice in the same meta row as the version', () => {
    expect(topbarSource).toContain('测试阶段，不保留用户数据')
    expect(topbarSource).toContain('class="logo-notice"')
    expect(topbarSource).toContain('class="logo-meta"')
  })
})
