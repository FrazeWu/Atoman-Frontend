import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const layoutSource = readFileSync(resolve(__dirname, '../../../../src/views/media/MediaLayout.vue'), 'utf8')

describe('MediaLayout', () => {
  it('renders media content directly without an extra sidebar shell', () => {
    expect(layoutSource).toContain('<main class="a-main-content">')
    expect(layoutSource).toContain('<router-view />')
    expect(layoutSource).not.toContain('<PSidebar')
    expect(layoutSource).not.toContain('modulePathUrl')
    expect(layoutSource).not.toContain('PSidebarItem')
  })
})
