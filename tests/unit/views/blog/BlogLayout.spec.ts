import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const layoutSource = readFileSync(resolve(__dirname, '../../../../src/views/blog/BlogLayout.vue'), 'utf8')

describe('BlogLayout', () => {
  it('restores the blog sidebar entries under /posts', () => {
    expect(layoutSource).toContain('<PSidebar')
    expect(layoutSource).toContain('to="/posts"')
    expect(layoutSource).toContain('to="/posts/subscriptions"')
    expect(layoutSource).toContain('to="/posts/bookmarks"')
    expect(layoutSource).toContain('to="/posts/manage"')
  })
})
