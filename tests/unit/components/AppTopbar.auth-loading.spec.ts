import path from 'node:path'
import { readFileSync } from 'node:fs'

const topbarSource = readFileSync(
  path.resolve(process.cwd(), 'src/components/AppTopbar.vue'),
  'utf8',
)

describe('AppTopbar auth loading', () => {
  it('keeps authenticated inbox controls behind an async boundary', () => {
    expect(topbarSource).not.toContain("import { useInboxStore } from '@/stores/inbox'")
    expect(topbarSource).toContain("defineAsyncComponent(() => import('@/components/AppTopbarAuthControls.vue'))")
    expect(topbarSource).toContain('v-if="authStore.isAuthenticated"')
  })
})