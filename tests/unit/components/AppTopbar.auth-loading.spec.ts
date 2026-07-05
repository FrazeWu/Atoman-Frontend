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

  it('renders the configured app version below the brand text and right aligned', () => {
    expect(topbarSource).toContain('import.meta.env.VITE_APP_VERSION')
    expect(topbarSource).toContain('class="logo-copy"')
    expect(topbarSource).toContain('v-if="appVersion"')
    expect(topbarSource).toContain('class="logo-version"')
    expect(topbarSource).toContain('flex-direction: column;')
    expect(topbarSource).toContain('align-self: flex-end;')
  })
})
