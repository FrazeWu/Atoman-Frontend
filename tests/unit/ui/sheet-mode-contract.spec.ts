import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const frontendRoot = resolve(__dirname, '../../..')
const read = (relativePath: string) => readFileSync(resolve(frontendRoot, relativePath), 'utf8')

describe('desktop right sheet mode contract', () => {
  it('keeps the selected partial sheets on the recommendation width', () => {
    const revision = read('src/components/debate/DebateRevisionSheet.vue')
    const crop = read('src/components/music/MusicSquareImageCropSheet.vue')
    const security = read('src/components/user/AccountSecurityPanel.vue')

    expect(revision).toMatch(/<PSheet[\s\S]*?mode="partial"[\s\S]*?partial-width="var\(--a-recommendation-width\)"/)
    expect(crop).toMatch(/<PSheet[\s\S]*?mode="partial"/)
    expect(security).toMatch(/title="登录设备详情"[\s\S]*?mode="partial"[\s\S]*?partial-width="var\(--a-recommendation-width\)"/)
    expect(security).toMatch(/title="安全日志详情"[\s\S]*?mode="partial"[\s\S]*?partial-width="var\(--a-recommendation-width\)"/)
  })

  it('keeps source article and source item lists as full sheets', () => {
    const sourceArticles = read('src/components/feed/FeedSourceArticlesSheet.vue')
    const sourceItems = read('src/components/setting/SettingFeedSourceItemsSheet.vue')

    expect(sourceArticles).toMatch(/<PSheet[\s\S]*?mode="full"/)
    expect(sourceItems).toMatch(/<PSheet[\s\S]*?mode="full"/)
  })

  it('uses a full sheet for primary article reading', () => {
    const post = read('src/components/blog/BlogPostSheet.vue')

    expect(post).toMatch(/<PSheet[\s\S]*?side="right"[\s\S]*?mode="full"/)
    expect(post).not.toContain('partial-width="var(--a-comment-sheet-width)"')
  })
})
