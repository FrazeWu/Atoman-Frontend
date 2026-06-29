import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const layoutSource = readFileSync(resolve(__dirname, '../../../../src/views/media/MediaLayout.vue'), 'utf8')

describe('MediaLayout', () => {
  it('renders the six media sidebar entries in order', () => {
    const labels = [...layoutSource.matchAll(/<PSidebarItem[^>]*>([^<]+)<\/PSidebarItem>/g)].map((match) => match[1])
    expect(labels).toEqual(['创作', '文章', '视频', '播客', '订阅', '收藏'])
  })

  it('keeps media sidebar links under the media module prefix', () => {
    expect(layoutSource).toContain(':to="mediaPath(\'/create\')"')
    expect(layoutSource).toContain(':to="mediaPath(\'/articles\')"')
    expect(layoutSource).toContain(':to="mediaPath(\'/videos\')"')
    expect(layoutSource).toContain(':to="mediaPath(\'/podcasts\')"')
    expect(layoutSource).toContain(':to="mediaPath(\'/subscriptions\')"')
    expect(layoutSource).toContain(':to="mediaPath(\'/bookmarks\')"')
  })
})
