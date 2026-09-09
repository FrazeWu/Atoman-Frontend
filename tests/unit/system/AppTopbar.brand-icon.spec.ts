import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const topbarSource = readFileSync(
  resolve(process.cwd(), 'src/components/system/AppTopbar.vue'),
  'utf8',
)
const indexSource = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')

describe('AppTopbar brand icon', () => {
  it('uses the shared SVG asset for the topbar and browser tab', () => {
    expect(topbarSource).toContain('<img class="logo-image" src="/atoman-house.svg" alt="Atoman" />')
    expect(indexSource).toContain('<link rel="icon" type="image/svg+xml" href="/atoman-house.svg" />')
    expect(topbarSource).not.toContain('<div class="logo-inner"></div>')
  })
})
