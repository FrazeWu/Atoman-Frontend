import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const layoutSource = readFileSync(resolve(__dirname, '../../src/views/kanbo/KanboLayout.vue'), 'utf8')

describe('KanboLayout', () => {
  it('renders the six kanbo sidebar entries in order', () => {
    const labels = [...layoutSource.matchAll(/<PaperSidebarItem[^>]*>([^<]+)<\/PaperSidebarItem>/g)].map((match) => match[1])
    expect(labels).toEqual(['创作', '文章', '视频', '播客', '订阅', '收藏'])
  })
})
