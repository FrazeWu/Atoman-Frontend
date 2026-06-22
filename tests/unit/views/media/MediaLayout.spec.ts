import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const layoutSource = readFileSync(resolve(__dirname, '../../../../src/views/media/MediaLayout.vue'), 'utf8')

describe('MediaLayout', () => {
  it('renders the six media sidebar entries in order', () => {
    const labels = [...layoutSource.matchAll(/<PSidebarItem[^>]*>([^<]+)<\/PSidebarItem>/g)].map((match) => match[1])
    expect(labels).toEqual(['创作', '文章', '视频', '播客', '订阅', '收藏'])
  })
})
