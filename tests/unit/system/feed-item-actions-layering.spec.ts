import path from 'node:path'
import { readFileSync } from 'node:fs'

const read = (file: string) => readFileSync(path.resolve(process.cwd(), file), 'utf8')

describe('feed item action layering', () => {
  it('delegates timeline actions and playback to a composable', () => {
    const source = read('src/views/feed/FeedView.vue')

    expect(source).toContain('useFeedItemActions({')
    for (const implementationDetail of [
      'const toggleStar = async',
      'const toggleRead =',
      'const applyAutomationRules = async',
      'const playFeedItemFromSheet =',
    ]) {
      expect(source).not.toContain(implementationDetail)
    }
  })

  it('keeps read-on-open persistence inside the article browser', () => {
    const source = read('src/composables/feed/useFeedArticleBrowser.ts')

    expect(source).toContain('feedStore.markItemsRead(')
    expect(source).not.toContain('markItemsReadAndRefresh: (ids: string[]) => Promise<void>')
  })
})
