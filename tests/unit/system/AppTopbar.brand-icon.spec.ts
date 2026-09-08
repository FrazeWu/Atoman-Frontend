import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const topbarSource = readFileSync(
  resolve(process.cwd(), 'src/components/system/AppTopbar.vue'),
  'utf8',
)

describe('AppTopbar brand icon', () => {
  it('uses the shared favicon asset for the topbar brand', () => {
    expect(topbarSource).toContain('<img class="logo-image" src="/favicon.png" alt="Atoman" />')
    expect(topbarSource).not.toContain('<div class="logo-inner"></div>')
  })
})
