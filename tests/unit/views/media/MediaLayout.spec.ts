import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { modulePathUrl } from '@/router/siteUrls'

const layoutSource = readFileSync(resolve(__dirname, '../../../../src/views/media/MediaLayout.vue'), 'utf8')

describe('MediaLayout', () => {
  it('renders the six media sidebar entries in order', () => {
    const labels = [...layoutSource.matchAll(/<PSidebarItem[^>]*>([^<]+)<\/PSidebarItem>/g)].map((match) => match[1])
    expect(labels).toEqual(['创作', '文章', '视频', '播客', '订阅', '收藏'])
  })

  it('keeps media sidebar links under the media module prefix', () => {
    const sidebarPaths = [...layoutSource.matchAll(/:to="mediaPath\('([^']+)'\)"/g)].map((match) =>
      modulePathUrl('media', match[1] ?? ''),
    )

    expect(sidebarPaths).toEqual([
      '/media/create',
      '/media/articles',
      '/media/videos',
      '/media/podcasts',
      '/media/subscriptions',
      '/media/bookmarks',
    ])
    expect(layoutSource).not.toMatch(/:to="\/(?:create|articles|subscriptions)"/)
    expect(layoutSource).not.toContain(':to="/posts/bookmarks"')
  })
})
