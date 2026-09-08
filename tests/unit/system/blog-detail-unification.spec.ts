import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(process.cwd())
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('博客文章详情实现', () => {
  it('让页面和弹层都只负责容器，共用同一个阅读器', () => {
    const page = read('src/views/blog/PostDetailView.vue')
    const sheet = read('src/components/blog/BlogPostSheet.vue')

    expect(page).toContain('BlogPostReader')
    expect(sheet).toContain('BlogPostReader')
    expect(page).not.toContain('useMarkdownRenderer')
    expect(sheet).not.toContain('useMarkdownRenderer')
    expect(page).not.toContain('CommentSideSheet')
    expect(sheet).not.toContain('CommentSideSheet')
  })
})
