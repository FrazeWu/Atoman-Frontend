import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const layoutSource = readFileSync(resolve(__dirname, '../../../../src/views/blog/BlogLayout.vue'), 'utf8')

describe('BlogLayout', () => {
  it('renders blog content directly without an extra sidebar shell', () => {
    expect(layoutSource).toContain('<main class="a-main-content">')
    expect(layoutSource).toContain('<router-view />')
    expect(layoutSource).not.toContain('<PSidebar')
  })
})
