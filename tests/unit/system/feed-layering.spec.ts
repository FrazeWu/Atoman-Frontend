import path from 'node:path'
import { readFileSync } from 'node:fs'

describe('FeedView layering', () => {
  it('delegates reusable UI structure to feed building blocks', () => {
    const source = readFileSync(path.resolve(process.cwd(), 'src/views/feed/FeedView.vue'), 'utf8')

    expect(source).toContain('SubscriptionManageSheet')
    expect(source).toContain('SubscriptionAddSheet')
    expect(source).toContain('FeedArticleSheet')
    expect(source).toContain('FeedTimelineFooter')
  })
})
