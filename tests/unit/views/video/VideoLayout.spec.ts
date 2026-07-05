import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const layoutSource = readFileSync(resolve(__dirname, '../../../../src/views/video/VideoLayout.vue'), 'utf8')

describe('VideoLayout', () => {
  it('renders video content directly without an extra sidebar shell', () => {
    expect(layoutSource).toContain('<main class="a-main-content">')
    expect(layoutSource).toContain('<router-view />')
    expect(layoutSource).not.toContain('<PSidebar')
  })
})
